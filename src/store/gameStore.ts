import { create } from 'zustand';
import {
  buildInitialState,
  snapshotFromState,
  type GameState,
} from '../game/services/engine/initialState';
import {
  runGameTurn,
  type TurnLog,
  type TurnSummary,
} from '../game/services/engine/turn';
import {
  analyzePolicy,
  createCancellationToken,
  type PolicyAIOptions,
  type PolicyAIMetadata,
} from '../game/services/ai/policyAI';
import { FISCAL_MAGNITUDE_REAIS } from '../game/data/catalog';
import type {
  AIInterpretation,
  ContextInput,
  ProfileContext,
  PlayerProfile,
} from '../game/types/ai';
import type { ActivePolicy } from '../game/types/policy';
import { SaveManager, createSave, loadSave } from '../game/services/persistence/db';
import { profileToContext } from '../game/services/politics/profileService';
import { STATE_IDS, type StateId } from '../game/data/states';
import { monthIndex } from '../game/services/engine/approval';

// ============================================================
// TIPOS
// ============================================================

export interface PendingProposal {
  /** Texto que o jogador digitou. */
  text: string;
  /** Análise retornada pela IA. */
  analysis: AIInterpretation;
  /** Metadados (tentativas, duração, tokens, fallback?). */
  metadata: PolicyAIMetadata;
  /** Timestamp local da criação (não é mês de jogo). */
  createdAt: number;
}

export interface GameStoreState {
  // ---------- Estado do jogo ----------
  game: GameState | null;
  saveId: number | null;

  // ---------- Proposta em análise ----------
  pendingProposal: PendingProposal | null;

  // ---------- Resultado do último turno (para UI/notícias) ----------
  lastTurnLog: TurnLog | null;
  lastTurnSummary: TurnSummary | null;

  // ---------- Flags ----------
  isAnalyzing: boolean;
  isRunningTurn: boolean;
  lastError: string | null;

  // ---------- Ciclo de vida ----------
  newGame(profile?: ProfileContext, name?: string): Promise<void>;
  createNewGame(profile: PlayerProfile, name?: string): Promise<void>;
  loadGame(saveId: number): Promise<void>;
  reset(): void;
  hydrate(state: GameState, saveId: number): void;
  exportState(): GameState | null;

  // ---------- Turno ----------
  runMonth(): void;

  // ---------- Proposta ----------
  analyzeProposal(text: string, options?: PolicyAIOptions): Promise<void>;
  cancelAnalysis(): void;
  confirmProposal(): void;
  discardProposal(): void;

  // ---------- Helpers ----------
  getContextInput(proposalText: string): ContextInput | null;
}

// ============================================================
// HELPERS INTERNOS
// ============================================================

let currentAnalysisToken: { signal: AbortSignal; cancel: () => void } | null = null;
let saveManager: SaveManager | null = null;

/** Quantos snapshots manter no histórico do contexto. */
const HISTORY_SNAPSHOTS = 6;

function emptyStateDeltas(): Record<StateId, Record<string, number>> {
  return Object.fromEntries(STATE_IDS.map((id) => [id, {}])) as Record<StateId, Record<string, number>>;
}

let policyCounter = 0;
function newPolicyId(): string {
  policyCounter += 1;
  return `pol_${Date.now().toString(36)}_${policyCounter}`;
}

/** Converte AIInterpretation em ActivePolicy (o que o motor vai processar). */
function buildActivePolicy(
  id: string,
  name: string,
  analysis: AIInterpretation,
): ActivePolicy {
  const magnitude = analysis.impacto_fiscal.magnitude;
  const fiscalBase = FISCAL_MAGNITUDE_REAIS[magnitude] ?? 0;

  let fiscalAnnual = 0;
  if (analysis.impacto_fiscal.tipo === 'custo') fiscalAnnual = -fiscalBase;
  else if (analysis.impacto_fiscal.tipo === 'economia') fiscalAnnual = +fiscalBase;

  return {
    id,
    name,
    type: analysis.instrumento,
    effects: analysis.indicadores,
    groupReactions: analysis.grupos,
    implementationMonths: analysis.implementationMonths ?? 0,
    effectRampUpMonths: analysis.effectRampUpMonths ?? 0,
    durationType: analysis.durationType ?? 'permanent',
    durationMonths: analysis.durationMonths ?? 0,
    activeMonths: 0,
    fiscalAnnual,
  };
}

/** Deriva um nome curto e legível para a política. */
function derivePolicyName(text: string, analysis: AIInterpretation): string {
  if (analysis.objetivo) return analysis.objetivo.slice(0, 80);
  if (analysis.interpretacao) return analysis.interpretacao.slice(0, 80);
  return text.slice(0, 80);
}

// ============================================================
// STORE
// ============================================================

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  saveId: null,
  pendingProposal: null,
  lastTurnLog: null,
  lastTurnSummary: null,
  isAnalyzing: false,
  isRunningTurn: false,
  lastError: null,

  // ============================================================
  // CICLO DE VIDA
  // ============================================================

  async newGame(profile, name = 'Nova Partida') {
    const game = buildInitialState({ profile });
    const saveId = await createSave(name, game);
    saveManager = new SaveManager(saveId);
    set({
      game,
      saveId,
      pendingProposal: null,
      lastTurnLog: null,
      lastTurnSummary: null,
      lastError: null,
      isAnalyzing: false,
      isRunningTurn: false,
    });
  },

  reset() {
    if (currentAnalysisToken) {
      currentAnalysisToken.cancel();
      currentAnalysisToken = null;
    }
    set({
      game: null,
      saveId: null,
      pendingProposal: null,
      lastTurnLog: null,
      lastTurnSummary: null,
      lastError: null,
      isAnalyzing: false,
      isRunningTurn: false,
    });
  },

  hydrate(state, saveId) {
    saveManager = new SaveManager(saveId);
    set({
      game: state,
      saveId,
      pendingProposal: null,
      lastError: null,
    });
  },

  exportState() {
    return get().game;
  },

  // Wrapper para compatibilidade com o menu (PlayerProfile → ProfileContext)
  async createNewGame(profile: PlayerProfile, name = 'Nova Partida') {
    await get().newGame(profileToContext(profile), name);
  },

  async loadGame(saveId: number) {
    const save = await loadSave(saveId);
    if (!save) {
      set({ lastError: 'Save não encontrado.' });
      return;
    }
    get().hydrate(save.game, saveId);
  },

  // ============================================================
  // TURNO
  // ============================================================

  runMonth() {
    const { game, isRunningTurn } = get();
    if (!game || isRunningTurn) return;

    set({ isRunningTurn: true, lastError: null });

    try {
      // Snapshot do mês que está terminando (antes de rodar o turno)
      const snapshot = snapshotFromState(game);
      const newHistory = [...game.history, snapshot].slice(-HISTORY_SNAPSHOTS);

      const result = runGameTurn({
        ...game,
        history: newHistory,
        rawDeltas: { states: emptyStateDeltas(), national: {} },
      });

      set({
        game: {
          ...game,
          month: result.month,
          stateIndicators: result.stateIndicators,
          nationalIndicators: result.nationalIndicators,
          macros: result.macros,
          groupApprovals: result.groupApprovals,
          stateApprovals: result.stateApprovals,
          nationalApproval: result.nationalApproval,
          activePolicies: result.activePolicies,
          pendingEffects: result.pendingEffects,
          activeReactions: result.activeReactions,
          policyHistory: result.policyHistory,
          history: newHistory,
        },
        lastTurnLog: result.log,
        lastTurnSummary: result.summary,
        isRunningTurn: false,
      });

      // Persistência fire-and-forget
      const next = get().game;
      if (next && saveManager) {
        void saveManager.persist(next).catch((err) => {
          set({
            lastError: err instanceof Error
              ? `Falha ao salvar o histórico mensal: ${err.message}`
              : 'Falha ao salvar o histórico mensal.',
          });
        });
      }
    } catch (err) {
      set({
        isRunningTurn: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // ============================================================
  // PROPOSTA
  // ============================================================

  async analyzeProposal(text, options) {
    const { game } = get();
    if (!game) return;

    // Cancela análise anterior, se houver
    if (currentAnalysisToken) currentAnalysisToken.cancel();
    currentAnalysisToken = createCancellationToken();
    const token = currentAnalysisToken;

    set({ isAnalyzing: true, lastError: null, pendingProposal: null });

    try {
      const input = get().getContextInput(text);
      if (!input) throw new Error('Estado de jogo indisponível.');

      const result = await analyzePolicy(input, {
        ...options,
        signal: token.signal,
      });

      if (token.signal.aborted) return;

      set({
        pendingProposal: {
          text,
          analysis: result.analysis,
          metadata: result.metadata,
          createdAt: Date.now(),
        },
        isAnalyzing: false,
      });
    } catch (err) {
      if (token.signal.aborted) return;
      set({
        isAnalyzing: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (currentAnalysisToken === token) currentAnalysisToken = null;
    }
  },

  cancelAnalysis() {
    if (currentAnalysisToken) {
      currentAnalysisToken.cancel();
      currentAnalysisToken = null;
    }
    set({ isAnalyzing: false, pendingProposal: null });
  },

  confirmProposal() {
    const { game, pendingProposal } = get();
    if (!game || !pendingProposal) return;

    const id = newPolicyId();
    const name = derivePolicyName(pendingProposal.text, pendingProposal.analysis);
    const policy = buildActivePolicy(id, name, pendingProposal.analysis);

    set({
      game: {
        ...game,
        activePolicies: [...game.activePolicies, policy],
        policyHistory: [
          ...game.policyHistory,
          { monthIndex: monthIndex(game.year, game.month), id },
        ],
      },
      pendingProposal: null,
    });
  },

  discardProposal() {
    set({ pendingProposal: null });
  },

  // ============================================================
  // HELPERS
  // ============================================================

  getContextInput(proposalText) {
    const { game } = get();
    if (!game) return null;

    return {
      month: game.month,
      proposal: proposalText,
      profile: game.profile,
      stateIndicators: game.stateIndicators,
      nationalIndicators: game.nationalIndicators,
      macros: game.macros,
      groupApprovals: game.groupApprovals,
      stateApprovals: game.stateApprovals,
      nationalApproval: game.nationalApproval,
      activePolicies: game.activePolicies,
      pendingEffects: game.pendingEffects,
      activeReactions: game.activeReactions,
      history: game.history,
    };
  },
}));

// ============================================================
// SELETORES
// ============================================================
// Importe e use como `useGameStore(selectMonth)` para evitar re-render
// de componentes que não se importam com o estado inteiro.

export const selectGame = (s: GameStoreState) => s.game;
export const selectMonth = (s: GameStoreState) => s.game?.month ?? 0;
export const selectNationalApproval = (s: GameStoreState) =>
  s.game?.nationalApproval ?? 50;
export const selectMacros = (s: GameStoreState) => s.game?.macros ?? {};
export const selectNationalIndicators = (s: GameStoreState) =>
  s.game?.nationalIndicators ?? {};
export const selectStateIndicators = (s: GameStoreState) =>
  s.game?.stateIndicators ?? {};
export const selectStateApprovals = (s: GameStoreState) =>
  s.game?.stateApprovals ?? {};
export const selectGroupApprovals = (s: GameStoreState) =>
  s.game?.groupApprovals ?? {};
export const selectActivePolicies = (s: GameStoreState) =>
  s.game?.activePolicies ?? [];
export const selectActiveReactions = (s: GameStoreState) =>
  s.game?.activeReactions ?? [];
export const selectPolicyHistory = (s: GameStoreState) =>
  s.game?.policyHistory ?? [];
export const selectHistory = (s: GameStoreState) => s.game?.history ?? [];
export const selectProfile = (s: GameStoreState) => s.game?.profile ?? null;

export const selectPendingProposal = (s: GameStoreState) => s.pendingProposal;
export const selectIsAnalyzing = (s: GameStoreState) => s.isAnalyzing;
export const selectIsRunningTurn = (s: GameStoreState) => s.isRunningTurn;
export const selectLastTurnSummary = (s: GameStoreState) => s.lastTurnSummary;
export const selectLastTurnLog = (s: GameStoreState) => s.lastTurnLog;
export const selectLastError = (s: GameStoreState) => s.lastError;

/** Fábrica de seletor para indicador nacional específico. */
export const selectNationalIndicator = (id: string) =>
  (s: GameStoreState) => s.game?.nationalIndicators[id];

/** Fábrica de seletor para macro específico. */
export const selectMacro = (id: string) =>
  (s: GameStoreState) => s.game?.macros[id];

/** Fábrica de seletor para indicador estadual específico. */
export const selectStateIndicator = (stateId: string, indicatorId: string) =>
  (s: GameStoreState) => s.game?.stateIndicators[stateId as StateId]?.[indicatorId];

/** Fábrica de seletor para aprovação de grupo. */
export const selectGroupApproval = (groupId: string) =>
  (s: GameStoreState) => s.game?.groupApprovals[groupId];

/** Fábrica de seletor para aprovação de estado. */
export const selectStateApproval = (stateId: string) =>
  (s: GameStoreState) => s.game?.stateApprovals[stateId as StateId];
