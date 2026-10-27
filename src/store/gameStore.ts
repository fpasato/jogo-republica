// src/store/gameStore.ts

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

export interface PendingProposal {
  text: string;
  analysis: AIInterpretation;
  metadata: PolicyAIMetadata;
  createdAt: number;
}

export interface PreparedMonth {
  game: GameState;
  log: TurnLog;
  summary: TurnSummary;
}

export type GameScreen = 'dashboard' | 'politicas' | 'pais';

export interface GameStoreState {
  game: GameState | null;
  saveId: number | null;
  pendingProposal: PendingProposal | null;
  lastTurnLog: TurnLog | null;
  lastTurnSummary: TurnSummary | null;
  isAnalyzing: boolean;
  isRunningTurn: boolean;
  lastError: string | null;
  currentScreen: GameScreen;

  newGame(profile?: ProfileContext, name?: string): Promise<void>;
  createNewGame(profile: PlayerProfile, name?: string): Promise<void>;
  loadGame(saveId: number): Promise<void>;
  reset(): void;
  hydrate(state: GameState, saveId: number): void;
  exportState(): GameState | null;

  setScreen(screen: GameScreen): void;

  runMonth(): void;
  prepareMonth(): PreparedMonth | null;
  commitPreparedMonth(prepared: PreparedMonth): void;

  setIndicatorSlider(indicatorId: string, value: number): void;

  analyzeProposal(text: string, options?: PolicyAIOptions): Promise<void>;
  cancelAnalysis(): void;
  confirmProposal(proposal?: { text: string; analysis: AIInterpretation; name?: string }): boolean;
  discardProposal(): void;

  getContextInput(proposalText: string): ContextInput | null;
}

let currentAnalysisToken: { signal: AbortSignal; cancel: () => void } | null = null;
let saveManager: SaveManager | null = null;

const HISTORY_SNAPSHOTS = 6;

let policyCounter = 0;
function newPolicyId(): string {
  policyCounter += 1;
  return `pol_${Date.now().toString(36)}_${policyCounter}`;
}

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
    effects: analysis.indicadores ?? {},
    groupReactions: analysis.grupos ?? {},
    implementationMonths: analysis.implementationMonths ?? 0,
    effectRampUpMonths: analysis.effectRampUpMonths ?? 0,
    durationType: analysis.durationType ?? 'permanent',
    durationMonths: analysis.durationMonths ?? 0,
    activeMonths: 0,
    fiscalAnnual,
  };
}

function derivePolicyName(text: string, analysis: AIInterpretation): string {
  if (analysis.objetivo) return analysis.objetivo.slice(0, 80);
  if (analysis.interpretacao) return analysis.interpretacao.slice(0, 80);
  return text.slice(0, 80);
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  saveId: null,
  pendingProposal: null,
  lastTurnLog: null,
  lastTurnSummary: null,
  isAnalyzing: false,
  isRunningTurn: false,
  lastError: null,
  currentScreen: 'dashboard',

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
      currentScreen: 'dashboard',
    });
  },

  setScreen(screen: GameScreen) {
    set({ currentScreen: screen });
  },

  exportState() {
    return get().game;
  },

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

  setIndicatorSlider(indicatorId: string, value: number) {
    const { game } = get();
    if (!game) return;
    set({
      game: {
        ...game,
        nationalIndicators: {
          ...game.nationalIndicators,
          [indicatorId]: value,
        },
      },
    });
  },

  runMonth() {
    const prepared = get().prepareMonth();
    if (prepared) get().commitPreparedMonth(prepared);
  },

  prepareMonth() {
    const { game, isRunningTurn } = get();
    if (!game || isRunningTurn) return null;
    set({ lastError: null });

    try {
      const snapshot = snapshotFromState(game);
      const newHistory = [...game.history, snapshot].slice(-HISTORY_SNAPSHOTS);

      const turnOutput = runGameTurn({
        ...game,
        history: newHistory,
        rawDeltas: { national: {} },
      });

      return {
        game: turnOutput,
        log: turnOutput.log,
        summary: turnOutput.summary,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[prepareMonth] Erro:', err);
      set({ lastError: message });
      return null;
    }
  },

  commitPreparedMonth(prepared: PreparedMonth) {
    const { game, log, summary } = prepared;
    const { saveId } = get();

    set({
      game,
      lastTurnLog: log,
      lastTurnSummary: summary,
      isRunningTurn: false,
      lastError: null,
    });

    if (saveId !== null && saveManager) {
      saveManager.autoSave(game).catch((err) => {
        console.error('[commitPreparedMonth] Falha no auto-save:', err);
      });
    }
  },

  async analyzeProposal(text: string, options?: PolicyAIOptions) {
    const { game, isAnalyzing } = get();
    if (!game || isAnalyzing) return;

    const trimmed = text.trim();
    if (!trimmed) {
      set({ lastError: 'A proposta não pode ser vazia.' });
      return;
    }

    if (currentAnalysisToken) {
      currentAnalysisToken.cancel();
    }
    const token = createCancellationToken();
    currentAnalysisToken = token;

    set({ isAnalyzing: true, lastError: null, pendingProposal: null });

    try {
      const contextInput = get().getContextInput(trimmed);
      if (!contextInput) {
        set({ isAnalyzing: false, lastError: 'Jogo não iniciado.' });
        return;
      }

      const result = await analyzePolicy(contextInput, {
        signal: token.signal,
        ...options,
      });

      if (token.signal.aborted) return;

      set({
        isAnalyzing: false,
        pendingProposal: {
          text: trimmed,
          analysis: result.analysis,
          metadata: result.metadata,
          createdAt: Date.now(),
        },
      });
    } catch (err) {
      if (token.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      set({ isAnalyzing: false, lastError: message });
    } finally {
      if (currentAnalysisToken === token) {
        currentAnalysisToken = null;
      }
    }
  },

  cancelAnalysis() {
    if (currentAnalysisToken) {
      currentAnalysisToken.cancel();
      currentAnalysisToken = null;
    }
    set({ isAnalyzing: false });
  },

  confirmProposal(proposal) {
    const { game } = get();
    const pending = proposal
      ? {
          text: proposal.text,
          analysis: proposal.analysis,
          name: proposal.name,
        }
      : get().pendingProposal;

    if (!game || !pending) return false;

    const id = newPolicyId();
    const name = proposal?.name || derivePolicyName(pending.text, pending.analysis);
    const active = buildActivePolicy(id, name, pending.analysis);

    const updatedGame: GameState = {
      ...game,
      activePolicies: [...game.activePolicies, active],
      policyHistory: [
        ...game.policyHistory,
        {
          monthIndex: (game.year - 2026) * 12 + (game.month - 1),
          id,
        },
      ],
    };

    set({
      game: updatedGame,
      pendingProposal: null,
      lastError: null,
    });

    return true;
  },

  discardProposal() {
    set({ pendingProposal: null, lastError: null });
  },

  getContextInput(proposalText: string): ContextInput | null {
    const { game } = get();
    if (!game) return null;
    return {
      month: game.month,
      proposal: proposalText,
      profile: game.profile,
      nationalIndicators: game.nationalIndicators,
      macros: game.macros,
      groupApprovals: game.groupApprovals,
      nationalApproval: game.nationalApproval,
      activePolicies: game.activePolicies,
      history: game.history,
    };
  },
}));
