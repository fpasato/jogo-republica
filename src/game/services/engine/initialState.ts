import type { GameState, GroupId, GroupState, IndicatorId, SliderId, StateId } from '../../types/game';
import { SLIDERS, SLIDER_IDS } from '../../data/sliders';
import { INDICATORS, INDICATOR_IDS } from '../../data/indicators';
import { GROUPS, GROUP_IDS } from '../../data/groups';
import { STATES, STATE_IDS } from '../../data/states';

export function createInitialState(): GameState {
  const sliders = SLIDER_IDS.reduce((acc, id) => {
    acc[id] = SLIDERS[id].defaultValue;
    return acc;
  }, {} as Record<SliderId, number>);

  const indicators = INDICATOR_IDS.reduce((acc, id) => {
    acc[id] = INDICATORS[id].defaultValue;
    return acc;
  }, {} as Record<IndicatorId, number>);

  const groups = GROUP_IDS.reduce((acc, id) => {
    acc[id] = {
      support: GROUPS[id].baseSupport,
      lastChange: 0,
      trend: 'stable',
    } as GroupState;
    return acc;
  }, {} as Record<GroupId, GroupState>);

  const states = STATE_IDS.reduce((acc, id) => {
    acc[id] = {
      approval: STATES[id].initialApproval,
      lastChange: 0,
    };
    return acc;
  }, {} as Record<StateId, { approval: number; lastChange: number }>);

  return {
    turn: 1,
    sliders,
    indicators,
    groups,
    states,
    activePolicies: [],
    pendingPolicies: [],
    history: [],
  };
}