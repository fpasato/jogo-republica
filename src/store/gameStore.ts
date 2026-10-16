import { create } from 'zustand';
import type { GameState } from '../game/types/game';
import type { SliderId } from '../game/types/game';
import { SLIDERS } from '../game/data/sliders';
import type { PolicyMeasure } from '../game/types/policy';
import type { TurnMedia } from '../game/services/templates/types';
import type { VotingOutcome } from '../game/services/parliament/votingService';

import { createInitialState } from '../game/services/engine/initialState';
import { advanceTurn, activatePolicy } from '../game/services/engine/turn';

import { interpretMeasure } from '../game/services/ai/measureAI';
import {
  runPolicyVoting,
  projectPolicyVoting,
  applyDilution,
} from '../game/services/engine/votingIntegration';
import { resolveOffers } from '../game/services/parliament/negotiationService';

import {
  createSave,
  loadSave,
  updateSave,
  listSaves,
  deleteSave,
  type SaveGame,
} from '../game/services/persistence/db';

// ============================================================
// TIPOS
// ============================================================

export interface PendingProposal {
  /** Texto que o jogador digitou. */
  text: string;
  /** Medida já validada, pronta para virar política. */
  policy: PolicyMeasure;
  /** Erros/avisos da IA. */
  errors: string[];
  warnings: string[];
  /** Timestamp local. */
  createdAt: number;
}

export interface GameStoreState {
  // ---------- Estado do jogo ----------
  game: GameState | null;
  saveId: number | null;

  // ---------- Proposta em revisão ----------
  pendingProposal: PendingProposal | null;

  // ---------- Negociação + votação ----------
  negotiation: Record<string, string[]>;
  votingOutcome: VotingOutcome | null;

  // ---------- Mídia do último turno ----------
  lastMedia: TurnMedia | null;

  // ---------- Flags ----------
  isAnalyzing: boolean;
  isRunningTurn: boolean;
  lastError: string | null;

  // ---------- Ciclo de vida ----------
  newGame(name?: string, partyId?: string): Promise<void>;
  loadGame(saveId: number): Promise<void>;
  listSaves(): Promise<SaveGame[]>;
  deleteSave(saveId: number): Promise<void>;
  reset(): void;
  hydrate(state: GameState, saveId: number): void;

  // ---------- Sliders ----------
  setSlider(id: keyof GameState['sliders'], value: number): void;
  saveSlider(id: SliderId, value: number): boolean;

  // ---------- Proposta ----------
  analyzeProposal(text: string): Promise<void>;
  discardProposal(): void;
  confirmProposal(): boolean;

  // ---------- Negociação ----------
  setOffer(partyId: string, offerId: string, enable: boolean): void;
  clearOffers(): void;
  projectVoting(): Promise<void>;

  // ---------- Votação ----------
  submitToVoting(playerPartyId?: string | null): Promise<void>;

  // ---------- Turno ----------
  runMonth(): void;
}

// ============================================================
// HELPERS
// ============================================================

let policyCounter = 0;
function newPolicyId(): string {
  policyCounter += 1;
  return `pol_${Date.now().toString(36)}_${policyCounter}`;
}

// ============================================================
// STORE
// ============================================================

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  saveId: null,
  pendingProposal: null,
  negotiation: {},
  votingOutcome: null,
  lastMedia: null,
  isAnalyzing: false,
  isRunningTurn: false,
  lastError: null,

  // ============================================================
  // CICLO DE VIDA
  // ============================================================

  async newGame(name = 'Nova Partida', partyId) {
    const game = createInitialState();
    game.playerName = name;
    game.playerPartyId = partyId;

    const saveId = await createSave(name, game);
    set({
      game,
      saveId,
      pendingProposal: null,
      negotiation: {},
      votingOutcome: null,
      lastMedia: null,
      lastError: null,
      isAnalyzing: false,
      isRunningTurn: false,
    });
  },

  async loadGame(saveId) {
    const save = await loadSave(saveId);
    if (!save) {
      set({ lastError: 'Save não encontrado.' });
      return;
    }
    get().hydrate(save.game, saveId);
  },

  async listSaves() {
    return listSaves();
  },

  async deleteSave(saveId) {
    await deleteSave(saveId);
    if (get().saveId === saveId) get().reset();
  },

  hydrate(state, saveId) {
    set({
      game: state,
      saveId,
      pendingProposal: null,
      negotiation: {},
      votingOutcome: null,
      lastMedia: state.media ?? null,
      lastError: null,
    });
  },

  reset() {
    set({
      game: null,
      saveId: null,
      pendingProposal: null,
      negotiation: {},
      votingOutcome: null,
      lastMedia: null,
      lastError: null,
      isAnalyzing: false,
      isRunningTurn: false,
    });
  },

  // ============================================================
  // SLIDERS
  // ============================================================

  setSlider(id, value) {
    const { game, saveId } = get();
    if (!game) return;

    const next: GameState = {
      ...game,
      sliders: { ...game.sliders, [id]: value },
    };

    set({ game: next });
    if (saveId != null) void updateSave(saveId, next);
  },

  saveSlider(id, value) {
    const { game, saveId } = get();
    if (!game || game.sliderSavedAtTurn?.[id] === game.turn) return false;

    const definition = SLIDERS[id];
    const bounded = Math.min(definition.max, Math.max(definition.min, value));
    const previousValue = game.sliders[id];
    const next: GameState = {
      ...game,
      sliders: { ...game.sliders, [id]: bounded },
      sliderSavedAtTurn: { ...game.sliderSavedAtTurn, [id]: game.turn },
      sliderChangeHistory: [
        ...(game.sliderChangeHistory ?? []),
        { sliderId: id, previousValue, newValue: bounded, turn: game.turn },
      ],
    };

    set({ game: next });
    if (saveId != null) void updateSave(saveId, next);
    return true;
  },

  // ============================================================
  // PROPOSTA (IA)
  // ============================================================

  async analyzeProposal(text) {
    const { game } = get();
    if (!game) return;

    set({ isAnalyzing: true, lastError: null, pendingProposal: null });

    try {
      const result = await interpretMeasure(text, game);

      if (!result.success || !result.policy) {
        set({
          isAnalyzing: false,
          lastError: result.errors.join(' • ') || 'A IA não conseguiu interpretar a medida.',
        });
        return;
      }

      set({
        isAnalyzing: false,
        pendingProposal: {
          text,
          policy: result.policy,
          errors: result.errors,
          warnings: result.warnings,
          createdAt: Date.now(),
        },
      });
    } catch (err) {
      set({
        isAnalyzing: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  discardProposal() {
    set({ pendingProposal: null, negotiation: {}, votingOutcome: null });
  },

  confirmProposal() {
    const { game, pendingProposal } = get();
    if (!game || !pendingProposal) return false;

    // Reconstrói com ID único + status voting
    const policy: PolicyMeasure = {
      ...pendingProposal.policy,
      id: newPolicyId(),
      status: 'voting',
      createdAtTurn: game.turn,
    };

    const next: GameState = {
      ...game,
      pendingPolicies: [...game.pendingPolicies, policy],
    };

    set({ game: next, pendingProposal: null, negotiation: {}, votingOutcome: null });
    return true;
  },

  // ============================================================
  // NEGOCIAÇÃO
  // ============================================================

  setOffer(partyId, offerId, enable) {
    const negotiation = { ...get().negotiation };
    const current = new Set(negotiation[partyId] ?? []);
    if (enable) current.add(offerId);
    else current.delete(offerId);
    negotiation[partyId] = Array.from(current);
    set({ negotiation });
  },

  clearOffers() {
    set({ negotiation: {} });
  },

  async projectVoting() {
    const { game, saveId, negotiation, pendingProposal } = get();
    if (!game || saveId == null) return;

    // Pega a última política pendente (a mais recente confirmada)
    const policy = pendingProposal?.policy ?? game.pendingPolicies[game.pendingPolicies.length - 1];
    if (!policy) {
      set({ lastError: 'Nenhuma medida para projetar.' });
      return;
    }

    try {
      const { negotiation: resolved, diluicao } = resolveOffers(negotiation);

      const projection = await projectPolicyVoting(saveId, {
        state: game,
        policy,
        negotiation: resolved,
        dilutionPenalty: diluicao * 20,
      });

      // Guarda só a projeção (não altera a política)
      set({ lastError: null });
      // A UI pode ler `projection` — deixamos como campo local via retorno
      // (para simplificar, jogamos em lastError como string legível se quiser mostrar)
      console.info('[projection]', projection);
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  // ============================================================
  // VOTAÇÃO
  // ============================================================

  async submitToVoting(playerPartyId) {
    const { game, saveId, negotiation } = get();
    if (!game || saveId == null) return;

    const partyId = playerPartyId ?? game.playerPartyId ?? null;

    const policy = game.pendingPolicies[game.pendingPolicies.length - 1];
    if (!policy) {
      set({ lastError: 'Nenhuma medida pendente para votar.' });
      return;
    }

    try {
      const { negotiation: resolved, custoAprovacao, diluicao } = resolveOffers(
        negotiation,
        partyId,
      );

      // Aplica diluição no conteúdo da medida antes de votar
      const diluted = applyDilution(policy, diluicao);
      diluted.negotiationCost = custoAprovacao;

      const outcome = await runPolicyVoting(saveId, {
        state: game,
        policy: diluted,
        playerPartyId: partyId,
        negotiation: resolved,
        dilutionPenalty: diluicao * 20,
      });

      set({ votingOutcome: outcome });

      if (outcome.approved) {
        // Atualiza a política em pendingPolicies para a versão diluída
        const pendingPolicies = game.pendingPolicies.map(p =>
          p.id === policy.id ? diluted : p,
        );
        let next: GameState = { ...game, pendingPolicies };

        // Ativa (aplica sliders + custo de negociação)
        next = activatePolicy(next, diluted.id);

        set({ game: next, negotiation: {}, pendingProposal: null });
        if (saveId != null) void updateSave(saveId, next);
      } else {
        // Rejeitada: move para histórico e remove de pending
        const next: GameState = {
          ...game,
          pendingPolicies: game.pendingPolicies.filter(p => p.id !== policy.id),
        };
        set({ game: next, negotiation: {} });
        if (saveId != null) void updateSave(saveId, next);
      }
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  // ============================================================
  // TURNO
  // ============================================================

  runMonth() {
    const { game, saveId, isRunningTurn } = get();
    if (!game || isRunningTurn) return;

    set({ isRunningTurn: true, lastError: null });

    try {
      const next = advanceTurn(game);
      set({
        game: next,
        lastMedia: next.media ?? null,
        isRunningTurn: false,
        votingOutcome: null,
      });
      if (saveId != null) {
        void updateSave(saveId, next).catch(err => {
          set({ lastError: `Falha ao salvar: ${err.message}` });
        });
      }
    } catch (err) {
      set({
        isRunningTurn: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },
}));

// ============================================================
// SELETORES
// ============================================================

export const selectGame = (s: GameStoreState) => s.game;
export const selectTurn = (s: GameStoreState) => s.game?.turn ?? 0;
export const selectSliders = (s: GameStoreState) => s.game?.sliders ?? null;
export const selectIndicators = (s: GameStoreState) => s.game?.indicators ?? null;
export const selectGroups = (s: GameStoreState) => s.game?.groups ?? null;
export const selectStates = (s: GameStoreState) => s.game?.states ?? null;
export const selectActivePolicies = (s: GameStoreState) => s.game?.activePolicies ?? [];
export const selectPendingPolicies = (s: GameStoreState) => s.game?.pendingPolicies ?? [];
export const selectHistory = (s: GameStoreState) => s.game?.history ?? [];
export const selectApproval = (s: GameStoreState) => s.game?.indicators.aprovacao ?? 50;

export const selectPendingProposal = (s: GameStoreState) => s.pendingProposal;
export const selectVotingOutcome = (s: GameStoreState) => s.votingOutcome;
export const selectNegotiation = (s: GameStoreState) => s.negotiation;
export const selectLastMedia = (s: GameStoreState) => s.lastMedia;

export const selectIsAnalyzing = (s: GameStoreState) => s.isAnalyzing;
export const selectIsRunningTurn = (s: GameStoreState) => s.isRunningTurn;
export const selectLastError = (s: GameStoreState) => s.lastError;
