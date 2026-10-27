// src/game/services/engine/initialState.ts

import { INDICATORS } from '../../data/indicators';
import { initialMacroValues } from '../../data/macroIndicators';
import { GROUPS } from '../../data/groups';
import {
  computeGroupBaseline,
  computeNationalApproval,
  clampApproval,
} from './approval';
import type { ProfileContext, ContextSnapshot } from '../../types/ai';
import type { ActivePolicy } from '../../types/policy';
import { PROFILE_AXES } from '../../data/profile';

export interface GameState {
  year: number;
  month: number;
  profile: ProfileContext;
  nationalIndicators: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  nationalApproval: number;
  activePolicies: ActivePolicy[];
  policyHistory: { monthIndex: number; id: string }[];
  history: ContextSnapshot[];
}

export interface InitialStateOptions {
  month?: number;
  profile?: ProfileContext;
}

export const DEFAULT_PROFILE: ProfileContext = {
  playerName: 'Jogador',
  partyId: 'psb',
  partyAcronym: 'PSB',
  govIdeology: -0.5,
  govIdeologyLabel: 'centro_esquerda',
  axes: {
    economia: -1,
    costumes: -1,
    seguranca: -1,
    ambiente: 1,
    gasto_social: 1,
  },
};

export function buildInitialState(opts: InitialStateOptions = {}): GameState {
  const month = opts.month ?? 1;
  const profile = opts.profile ?? DEFAULT_PROFILE;

  // 1. Indicadores nacionais (valores iniciais definidos no catálogo)
  const nationalIndicators: Record<string, number> = {};
  for (const ind of INDICATORS) {
    nationalIndicators[ind.id] = ind.initial;
  }

  // 2. Macros
  const macros = initialMacroValues();
  for (const [k, v] of Object.entries(macros)) {
    if (nationalIndicators[k] !== undefined) {
      macros[k] = nationalIndicators[k];
    }
  }

  // 3. Grupos e aprovações
  const groupApprovals: Record<string, number> = {};
  for (const g of GROUPS) {
    const axisAffinity = PROFILE_AXES.reduce((sum, axis) => {
      const val = profile.axes[axis.id as keyof ProfileContext['axes']] ?? 0;
      return sum + (val * (axis.afinidade[g.id] ?? 0)) / 3;
    }, 0);
    const baseline = computeGroupBaseline(g.id, profile.govIdeology, []);
    groupApprovals[g.id] = clampApproval(baseline + axisAffinity);
  }

  // 4. Aprovação nacional
  const nationalApproval = computeNationalApproval(groupApprovals);
  nationalIndicators.aprovacao_popular = nationalApproval;

  return {
    year: 2026,
    month,
    profile,
    nationalIndicators,
    macros,
    groupApprovals,
    nationalApproval,
    activePolicies: [],
    policyHistory: [],
    history: [],
  };
}

export function snapshotFromState(state: GameState): ContextSnapshot {
  return {
    month: state.month,
    national: { ...state.nationalIndicators },
    macros: { ...state.macros },
    groupApprovals: { ...state.groupApprovals },
    nationalApproval: state.nationalApproval,
  };
}
