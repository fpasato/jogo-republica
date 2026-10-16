import type { GameState } from '../../types/game';
import { applyRules } from './rules';
import {
  applyIndicatorEffects,
  computeGroupSupport,
  computeNationalApproval,
  computeStateApprovals,
  approvalFromStates,
  isExpired,
} from './effects';
import { STATE_WEIGHTS } from '../../data/states';
import { GROUP_IDS } from '../../data/groups';
import { generateTurnMedia } from '../templates/orchestrator';

/** Avança um mês e devolve o novo estado (com mídia do turno) */
export function advanceTurn(state: GameState): GameState {
  const nextTurn = state.turn + 1;

  // 1. Marca políticas expiradas
  const activePolicies = state.activePolicies.map(p =>
    isExpired(p, nextTurn) ? { ...p, status: 'expired' as const } : p,
  );

  // 2. Ativa políticas pendentes
  const stillActive = activePolicies.filter(p => p.status === 'active');
  const pendingActivated = state.pendingPolicies.map(p => ({
    ...p,
    status: 'active' as const,
    activatedAtTurn: nextTurn,
  }));

  const workingState: GameState = {
    ...state,
    turn: nextTurn,
    activePolicies: [...stillActive, ...pendingActivated],
    pendingPolicies: [],
  };

  // 3. Aplica regras determinísticas
  let indicators = applyRules(workingState);

  // 4. Aplica efeitos graduais das políticas ativas
  indicators = applyIndicatorEffects({ ...workingState, indicators });

  // 5. Recalcula apoio dos grupos
  const groupSupports = computeGroupSupport({ ...workingState, indicators });
  const groups = GROUP_IDS.reduce((acc, id) => {
    const prev = state.groups[id].support;
    const support = groupSupports[id];
    acc[id] = {
      support,
      lastChange: support - prev,
      trend:
        support - prev > 0.5 ? 'up' : support - prev < -0.5 ? 'down' : 'stable',
    };
    return acc;
  }, {} as GameState['groups']);

  // 6. Aprovação nacional via grupos + estados
  const approvalFromGroups = computeNationalApproval(groups);
  const stateApprovals = computeStateApprovals(workingState, approvalFromGroups);
  const approvalFromStatesValue = approvalFromStates(stateApprovals, STATE_WEIGHTS);
  const aprovacao = (approvalFromGroups + approvalFromStatesValue) / 2;

  indicators.aprovacao = aprovacao;

  // 7. Snapshot do histórico
  const history = [
    ...state.history,
    {
      turn: state.turn,
      indicators: { ...state.indicators },
      sliders: { ...state.sliders },
    },
  ].slice(-120); // mantém 10 anos

  const nextState: GameState = {
    ...workingState,
    indicators,
    groups,
    states: stateApprovals,
    history,
  };

  // 8. Gera mídia do turno (notícias, posts, reações)
  const previous = state.history[state.history.length - 1] ?? {
    indicators: state.indicators,
    sliders: state.sliders,
  };

  const activatedPolicyId = workingState.activePolicies.find(
    p => p.activatedAtTurn === nextTurn,
  )?.id;

  const media = generateTurnMedia(
    nextState,
    previous.indicators,
    previous.sliders,
    activatedPolicyId,
  );

  return { ...nextState, media };
}

/**
 * Ativa uma política imediatamente (ex.: votação aprovada).
 * - Move pending → active
 * - Aplica mudanças de slider na hora
 * - NÃO gera mídia (isso só acontece em advanceTurn)
 */
export function activatePolicy(state: GameState, policyId: string): GameState {
  const idx = state.pendingPolicies.findIndex(p => p.id === policyId);
  if (idx === -1) return state;

  const policy = state.pendingPolicies[idx];
  const activated = {
    ...policy,
    status: 'active' as const,
    activatedAtTurn: state.turn,
  };

  const sliders = { ...state.sliders };
  for (const change of activated.sliderChanges ?? []) {
    sliders[change.sliderId] = change.newValue;
  }

  // Aplica o custo de negociação uma única vez
  const indicators = { ...state.indicators };
  if (activated.negotiationCost) {
    indicators.aprovacao = Math.max(
      0,
      indicators.aprovacao - activated.negotiationCost,
    );
  }

  return {
    ...state,
    sliders,
    indicators,
    activePolicies: [...state.activePolicies, activated],
    pendingPolicies: state.pendingPolicies.filter((_, i) => i !== idx),
  };
}

/** Adiciona uma política criada pelo jogador à fila de votação */
export function queuePolicy(state: GameState, policy: import('../../types/policy').PolicyMeasure): GameState {
  return {
    ...state,
    pendingPolicies: [...state.pendingPolicies, { ...policy, status: 'voting' }],
  };
}