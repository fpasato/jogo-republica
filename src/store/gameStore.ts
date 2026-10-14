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

export interface PreparedMonth {
  game: GameState;
  log: TurnLog;
  summary: TurnSummary;
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
  prepareMonth(): PreparedMonth | null;
  commitPreparedMonth(prepared: PreparedMonth): void;

  // ---------- Proposta ----------
  analyzeProposal(text: string, options?: PolicyAIOptions): Promise<void>;
  cancelAnalysis(): void;
  confirmProposal(proposal?: { text: string; analysis: AIInterpretation; name?: string }): boolean;
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
  const fiscalBase = analysis.impacto_fiscal.valor_anual_bi !== undefined
    ? analysis.impacto_fiscal.valor_anual_bi * 1e9
    : FISCAL_MAGNITUDE_REAIS[magnitude] ?? 0;

  let fiscalAnnual = 0;
  if (analysis.impacto_fiscal.tipo === 'custo') fiscalAnnual = -fiscalBase;
  else if (analysis.impacto_fiscal.tipo === 'economia') fiscalAnnual = +fiscalBase;

  return {
    id,
    name,
    type: analysis.instrumento,
    targetStates: analysis.estados_alvo,
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
    const prepared = get().prepareMonth();
    if (prepared) get().commitPreparedMonth(prepared);
  },

  prepareMonth() {
    const { game, isRunningTurn } = get();
    console.log('=== RUN MONTH', game?.month, '===');
    console.log('activePolicies:', game?.activePolicies);
    console.log('salario antes:', game?.nationalIndicators.salario_minimo);

    if (!game || isRunningTurn) return null;
    set({ lastError: null });
    try {
      // Snapshot do mês que está terminando (antes de rodar o turno)
      const snapshot = snapshotFromState(game);
      const newHistory = [...game.history, snapshot].slice(-HISTORY_SNAPSHOTS);

      const result = runGameTurn({
        ...game,
        history: newHistory,
        rawDeltas: { states: emptyStateDeltas(), national: {} },
      });

      return {
        game: {
          ...game,
          year: result.year,
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
        log: result.log,
        summary: result.summary,
      };
    } catch (err) {
      set({
        lastError: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  },

  commitPreparedMonth(prepared) {
    set({
      game: prepared.game,
      lastTurnLog: prepared.log,
      lastTurnSummary: prepared.summary,
      isRunningTurn: false,
      lastError: null,
    });

    if (saveManager) {
      void saveManager.persist(prepared.game).catch((err) => {
        set({
          lastError: err instanceof Error
            ? `Falha ao salvar o histórico mensal: ${err.message}`
            : 'Falha ao salvar o histórico mensal.',
        });
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

      console.info('[policyAI] Análise validada', {
        instrumento: result.analysis.instrumento,
        indicadores: result.analysis.indicadores,
        implementationMonths: result.analysis.implementationMonths ?? 0,
        effectRampUpMonths: result.analysis.effectRampUpMonths ?? 0,
        durationType: result.analysis.durationType ?? 'permanent',
        durationMonths: result.analysis.durationMonths ?? 0,
        warnings: result.metadata.attemptLog.flatMap((attempt) => attempt.warnings),
        rejected: result.metadata.attemptLog.flatMap((attempt) => attempt.rejected),
      });

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

  confirmProposal(proposalInput) {
    const { game, pendingProposal } = get();
    const proposal = proposalInput ?? pendingProposal;
    if (!game || !proposal) {
      console.error('[policy] Assinatura cancelada: jogo ou proposta indisponível.', {
        hasGame: !!game,
        hasPendingProposal: !!pendingProposal,
        hasExplicitProposal: !!proposalInput,
      });
      return false;
    }

    const id = newPolicyId();
    const name = ('name' in proposal && proposal.name) || derivePolicyName(proposal.text, proposal.analysis);
    const policy = buildActivePolicy(id, name, proposal.analysis);
    const nextGame: GameState = {
      ...game,
      activePolicies: [...game.activePolicies, policy],
      policyHistory: [
        ...game.policyHistory,
        { monthIndex: monthIndex(game.year, game.month), id },
      ],
    };

    set({
      game: nextGame,
      pendingProposal: null,
    });

    const signed = get().game?.activePolicies.some((active) => active.id === id) ?? false;
    if (!signed) {
      console.error('[policy] A medida não permaneceu no estado do jogo após a assinatura.', { id });
      return false;
    }
    console.info('[policy] Medida assinada e adicionada ao jogo', {
      id,
      name,
      instrument: policy.type,
      effects: policy.effects,
      implementationMonths: policy.implementationMonths,
      effectRampUpMonths: policy.effectRampUpMonths,
      durationType: policy.durationType,
      durationMonths: policy.durationMonths,
      activeMonths: policy.activeMonths,
      activePolicyCount: get().game?.activePolicies.length ?? 0,
    });
    return true;
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
