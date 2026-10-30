// src/store/gameStore.ts

import { create } from 'zustand';
import {
  buildInitialState,
  snapshotFromState,
  type GameState,
} from '../game/services/engine/initialState';
import {
  runGameTurn,
  recalculateEconomy,
  type TurnLog,
  type TurnSummary,
} from '../game/services/engine/turn';
import {
  indicatorSensitivityDelta,
  clampApproval,
  computeNationalApproval,
} from '../game/services/engine/approval';
import {
  analyzePolicy,
  createCancellationToken,
  type PolicyAIOptions,
  type PolicyAIMetadata,
} from '../game/services/ai/policyAI';
import { FISCAL_MAGNITUDE_REAIS } from '../game/data/catalog';
import { ensureFinancialControlCard, inferFinancialCategory } from '../game/services/ai/validation';
import type {
  AIInterpretation,
  ContextInput,
  ProfileContext,
  PlayerProfile,
} from '../game/types/ai';
import type { ActivePolicy, PolicyHistoryEntry } from '../game/types/policy';
import { SaveManager, createSave, loadSave } from '../game/services/persistence/db';
import { profileToContext } from '../game/services/politics/profileService';
import { STATES, STATE_IDS, stateApprovalShift } from '../game/data/states';

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

export type GameScreen = 'dashboard' | 'politicas' | 'pais' | 'medidas';

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
  applyIndicatorChange(indicatorId: string, value: number): boolean;
  updateNewPolicyIndicator(indicatorId: string, value: number): boolean;

  analyzeProposal(text: string, options?: PolicyAIOptions): Promise<void>;
  cancelAnalysis(): void;
  confirmProposal(proposal?: { text: string; analysis: AIInterpretation; name?: string }): boolean;
  recordRejectedProposal(proposal: { text: string; analysis: AIInterpretation; name: string }): void;
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

function addMissingFinancialCards(game: GameState): GameState {
  let changed = false;
  const nationalIndicators = { ...game.nationalIndicators };
  const activePolicies = (game.activePolicies ?? []).map((policy) => {
    const history = game.measureHistory?.find((entry) => entry.id === policy.id);
    const policyText = history?.originalText ?? policy.name;
    const inferredCategory = inferFinancialCategory(policyText);
    const categorizedIndicators = (policy.newIndicators ?? []).map((indicator) =>
      inferredCategory && indicator.categoria !== inferredCategory
        ? { ...indicator, categoria: inferredCategory }
        : indicator,
    );
    const categoryChanged = categorizedIndicators.some((indicator, index) => indicator !== policy.newIndicators?.[index]);
    if (policy.newIndicators?.some((indicator) => indicator.tipo === 'slider') && !categoryChanged) return policy;
    const analysis: AIInterpretation = history?.analysis ?? {
      titulo: policy.name,
      tipo_medida: policy.measureKind,
      interpretacao: policy.name,
      instrumento: policy.type,
      motivo_instrumento: '',
      impacto_fiscal: {
        tipo: policy.fiscalAnnual > 0 ? 'economia' : policy.fiscalAnnual < 0 ? 'custo' : 'neutro',
        magnitude: 0,
        valor_anual_bi: Math.abs(policy.fiscalAnnual) / 1e9,
        nota: '',
      },
      intensidade: 0,
      posicao_ideologica: 0,
      grupos: policy.groupReactions ?? {},
      indicadores: Object.fromEntries(Object.entries(policy.effects ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === 'number')),
      risco_juridico: 'baixo',
      assessoria_juridica: '',
      novosIndicadores: categorizedIndicators,
    };
    analysis.novosIndicadores = [...categorizedIndicators];
    ensureFinancialControlCard(analysis, policyText);
    const newIndicators = analysis.novosIndicadores ?? [];
    if (newIndicators.length === (policy.newIndicators?.length ?? 0) && !categoryChanged) return policy;
    changed = true;
    for (const indicator of newIndicators) {
      if (indicator.tipo === 'slider') nationalIndicators[indicator.id] = indicator.valorProposto ?? indicator.valorInicial;
    }
    if (history) history.analysis.novosIndicadores = newIndicators;
    return { ...policy, newIndicators };
  });
  if (!changed) return game;
  recalculateEconomy(nationalIndicators, activePolicies);
  return { ...game, activePolicies, nationalIndicators };
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

  const sliderAffectedIds = new Set((analysis.novosIndicadores ?? [])
    .filter((indicator) => indicator.tipo === 'slider')
    .flatMap((indicator) => Object.keys(indicator.affects ?? {})));
  const policyEffects = { ...(analysis.indicadores ?? {}) };
  for (const indicatorId of sliderAffectedIds) delete policyEffects[indicatorId];

  return {
    id,
    name,
    measureKind: analysis.tipo_medida ?? 'medida',
    type: analysis.instrumento,
    effects: {
      ...policyEffects,
      ...(analysis.novosIndicadores ?? []).reduce<Record<string, number>>((all, indicator) => {
        if (indicator.tipo === 'informativo') Object.assign(all, indicator.affects ?? {});
        return all;
      }, {}),
    },
    groupReactions: analysis.grupos ?? {},
    newIndicators: analysis.novosIndicadores ?? [],
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
    const savedApprovals = state.stateApprovals ?? {};
    const existing = STATE_IDS.map((id) => savedApprovals[id]).filter((value): value is number => typeof value === 'number');
    const hasRegionalVariation = existing.length > 1 && Math.max(...existing) - Math.min(...existing) > 0.5;
    const shifts = STATE_IDS.map((id) => stateApprovalShift(STATES[id], state.profile.govIdeology));
    const meanShift = shifts.reduce((sum, value) => sum + value, 0) / shifts.length;
    const stateApprovals = hasRegionalVariation
      ? savedApprovals
      : Object.fromEntries(STATE_IDS.map((id, index) => [
          id,
          clampApproval((savedApprovals[id] ?? state.nationalApproval) + shifts[index] - meanShift),
        ]));
    const nationalIndicators = { ...state.nationalIndicators };
    recalculateEconomy(nationalIndicators, state.activePolicies ?? []);
    const hydratedGame = addMissingFinancialCards({ ...state, nationalIndicators, stateApprovals, measureHistory: state.measureHistory ?? [] });
    set({
      game: hydratedGame,
      saveId,
      pendingProposal: null,
      lastError: null,
      currentScreen: 'dashboard',
    });
  },

  setScreen(screen: GameScreen) {
    const { game, saveId } = get();
    const updatedGame = screen === 'politicas' && game ? addMissingFinancialCards(game) : game;
    set({ currentScreen: screen, ...(updatedGame && updatedGame !== game ? { game: updatedGame } : {}) });
    if (updatedGame && updatedGame !== game && saveId !== null && saveManager) {
      saveManager.autoSave(updatedGame).catch((err) => console.error('[setScreen] Falha ao salvar cards fiscais:', err));
    }
  },

  exportState() {
    return get().game;
  },

  async createNewGame(profile: PlayerProfile, name = 'Nova Partida') {
    const playerName = profile.nome || name || 'Jogador';
    await get().newGame(profileToContext(profile), playerName);
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
    const updated = {
      ...game.nationalIndicators,
      [indicatorId]: value,
    };
    recalculateEconomy(updated, game.activePolicies);
    set({
      game: {
        ...game,
        nationalIndicators: updated,
      },
    });
  },

  applyIndicatorChange(indicatorId: string, value: number): boolean {
    const { game, saveId } = get();
    if (!game) return false;

    const currentMonthIdx = (game.year - 2026) * 12 + (game.month - 1);
    if (game.lastModifiedIndicatorMonth === currentMonthIdx) {
      set({ lastError: 'Você já realizou uma alteração de política/indicador este mês. Aguarde o próximo turno para aplicar outra.' });
      return false;
    }

    const updated = {
      ...game.nationalIndicators,
      [indicatorId]: value,
    };
    recalculateEconomy(updated, game.activePolicies);

    // Imediatamente calcula a repercussão nos 12 grupos sociais
    const deltas = Object.fromEntries(Object.keys(updated).map((id) => [id, updated[id] - (game.nationalIndicators[id] ?? updated[id])]));
    const updatedApprovals = { ...game.groupApprovals };
    if (Object.values(deltas).some((delta) => Math.abs(delta) > 0.0001)) {
      const indicatorDeltas = { national: deltas };
      for (const [groupId, currentApp] of Object.entries(game.groupApprovals)) {
        const { delta: groupDelta } = indicatorSensitivityDelta(groupId, indicatorDeltas);
        updatedApprovals[groupId] = clampApproval(currentApp + groupDelta);
      }
    }
    const updatedNatApproval = computeNationalApproval(updatedApprovals);
    updated.aprovacao_popular = updatedNatApproval;

    const updatedGame: GameState = {
      ...game,
      nationalIndicators: updated,
      groupApprovals: updatedApprovals,
      nationalApproval: updatedNatApproval,
      lastModifiedIndicatorMonth: currentMonthIdx,
    };

    set({
      game: updatedGame,
      lastError: null,
    });

    if (saveId !== null && saveManager) {
      saveManager.autoSave(updatedGame).catch((err) => {
        console.error('[applyIndicatorChange] Falha no auto-save:', err);
      });
    }

    return true;
  },

  updateNewPolicyIndicator(indicatorId: string, value: number): boolean {
    const { game, saveId } = get();
    if (!game || !Number.isFinite(value)) return false;
    const definition = game.activePolicies.flatMap((policy) => policy.newIndicators ?? []).find((indicator) => indicator.id === indicatorId);
    if (!definition || definition.tipo !== 'slider') return false;
    const currentMonthIdx = (game.year - 2026) * 12 + (game.month - 1);
    if (game.lastModifiedIndicatorMonth === currentMonthIdx) {
      set({ lastError: 'Você já realizou uma alteração de política/indicador este mês. Aguarde o próximo turno para aplicar outra.' });
      return false;
    }
    const nextValue = Math.max(definition.minimo ?? value, Math.min(definition.maximo ?? value, value));
    const updated = { ...game.nationalIndicators, [indicatorId]: nextValue };
    recalculateEconomy(updated, game.activePolicies);
    const updatedApprovals = { ...game.groupApprovals };
    const deltas = Object.fromEntries(Object.keys(updated).map((id) => [id, updated[id] - (game.nationalIndicators[id] ?? updated[id])]));
    if (Object.values(deltas).some((delta) => Math.abs(delta) > 0.0001)) {
      const indicatorDeltas = { national: deltas };
      for (const policy of game.activePolicies) {
        if (!policy.newIndicators?.some((indicator) => indicator.id === indicatorId)) continue;
        for (const groupId of Object.keys(updatedApprovals)) {
          const { delta: groupDelta } = indicatorSensitivityDelta(groupId, indicatorDeltas);
          updatedApprovals[groupId] = clampApproval((updatedApprovals[groupId] ?? 50) + groupDelta);
        }
      }
    }
    const updatedNatApproval = computeNationalApproval(updatedApprovals);
    updated.aprovacao_popular = updatedNatApproval;
    const updatedGame: GameState = { ...game, nationalIndicators: updated, groupApprovals: updatedApprovals, nationalApproval: updatedNatApproval, lastModifiedIndicatorMonth: currentMonthIdx };
    set({ game: updatedGame, lastError: null });
    if (saveId !== null && saveManager) saveManager.autoSave(updatedGame).catch((err) => console.error('[updateNewPolicyIndicator] Falha no auto-save:', err));
    return true;
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
    const historyEntry: PolicyHistoryEntry = {
      id,
      name,
      type: pending.analysis.instrumento,
      originalText: pending.text,
      createdAt: new Date().toISOString(),
      month: game.month,
      analysis: pending.analysis,
      status: 'active',
      impactoFinanceiro: { custoImplementacao: Math.max(0, -active.fiscalAnnual) },
      implementationMonths: active.implementationMonths,
      effectRampUpMonths: active.effectRampUpMonths,
      durationType: active.durationType,
      durationMonths: active.durationMonths,
    };
    const nationalIndicators = { ...game.nationalIndicators };
    for (const indicator of active.newIndicators ?? []) {
      if (indicator.tipo === 'slider') nationalIndicators[indicator.id] = indicator.valorProposto ?? indicator.valorInicial;
    }
    recalculateEconomy(nationalIndicators, [...game.activePolicies, active]);

    const updatedGame: GameState = {
      ...game,
      nationalIndicators,
      activePolicies: [...game.activePolicies, active],
      measureHistory: [...(game.measureHistory ?? []), historyEntry],
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

  recordRejectedProposal(proposal) {
    const { game, saveId } = get();
    if (!game) return;
    const entry: PolicyHistoryEntry = {
      id: newPolicyId(),
      name: proposal.name,
      type: proposal.analysis.instrumento,
      originalText: proposal.text,
      createdAt: new Date().toISOString(),
      month: game.month,
      analysis: proposal.analysis,
      status: 'rejected',
      impactoFinanceiro: { custoImplementacao: 0 },
      implementationMonths: proposal.analysis.implementationMonths ?? 0,
      effectRampUpMonths: proposal.analysis.effectRampUpMonths,
      durationType: proposal.analysis.durationType,
      durationMonths: proposal.analysis.durationMonths ?? 0,
    };
    const updatedGame = { ...game, measureHistory: [...(game.measureHistory ?? []), entry] };
    set({ game: updatedGame, lastError: null });
    if (saveId !== null && saveManager) {
      saveManager.autoSave(updatedGame).catch((err) => console.error('[recordRejectedProposal] Falha no auto-save:', err));
    }
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
