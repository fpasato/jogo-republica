// services/engine/approval.ts

import { GROUPS, getGroup } from '../../data/groups';
import { GROUP_SENSITIVITY } from '../../data/groupSensitivity';
import { getIndicator } from '../../data/indicators';
import { STATE_IDS, STATES, type StateId } from '../../data/states';
import type { ActivePolicy } from '../../types/policy';
import type { ContextSnapshot } from '../../types/ai';

// ============================================================
// CONSTANTES
// ============================================================

export const APPROVAL_MIN = 1;
export const APPROVAL_MAX = 100;
export const NEUTRAL = 50;

export const clampApproval = (n: number) =>
  Math.min(APPROVAL_MAX, Math.max(APPROVAL_MIN, Number.isFinite(n) ? n : NEUTRAL));

/** Velocidade de drift reduzida para preservar efeitos de medidas por mais tempo. */
const BASELINE_DRIFT_RATE = 0.012;
const NATIONAL_APPROVAL_INERTIA = 0.35;

/** Quanto da sensibilidade bruta vira mudança efetiva por turno. */
const SENSITIVITY_RATE = 0.25;

/** Marca permanente de uma política no baseline (25% do choque inicial). */
const POLICY_MARK_RATE = 0.25;
const STATE_WELLBEING_SHIFT_MAX = 10;
const STATE_APPROVAL_ADJUSTMENT_RATE = 0.3;

type WellbeingMetric = {
  id: string;
  min: number;
  max: number;
  direction: 'up' | 'down';
};

const STATE_WELLBEING_CATEGORIES: Array<{
  weight: number;
  metrics: WellbeingMetric[];
}> = [
  {
    weight: 0.25,
    metrics: [
      { id: 'acesso_saude', min: 0, max: 100, direction: 'up' },
      { id: 'satisfacao_saude', min: 0, max: 100, direction: 'up' },
      { id: 'cobertura_vacinacao', min: 0, max: 100, direction: 'up' },
      { id: 'tempo_espera_saude', min: 0, max: 180, direction: 'down' },
    ],
  },
  {
    weight: 0.2,
    metrics: [
      { id: 'frequencia_escolar', min: 0, max: 100, direction: 'up' },
      { id: 'conclusao_medio', min: 0, max: 100, direction: 'up' },
      { id: 'alfabetizacao', min: 0, max: 100, direction: 'up' },
      { id: 'evasao_escolar', min: 0, max: 30, direction: 'down' },
    ],
  },
  {
    weight: 0.25,
    metrics: [
      { id: 'percepcao_seguranca', min: 0, max: 100, direction: 'up' },
      { id: 'homicidios', min: 0, max: 60, direction: 'down' },
      { id: 'roubos', min: 0, max: 1000, direction: 'down' },
      { id: 'crimes_solucionados', min: 0, max: 100, direction: 'up' },
    ],
  },
  {
    weight: 0.2,
    metrics: [
      { id: 'renda_media', min: 0, max: 8000, direction: 'up' },
      { id: 'pobreza', min: 0, max: 70, direction: 'down' },
      { id: 'pobreza_extrema', min: 0, max: 30, direction: 'down' },
      { id: 'desemprego', min: 0, max: 25, direction: 'down' },
      { id: 'gini', min: 0.3, max: 0.7, direction: 'down' },
    ],
  },
  {
    weight: 0.1,
    metrics: [
      { id: 'acesso_agua', min: 0, max: 100, direction: 'up' },
      { id: 'coleta_esgoto', min: 0, max: 100, direction: 'up' },
      { id: 'tratamento_esgoto', min: 0, max: 100, direction: 'up' },
      { id: 'qualidade_estradas', min: 0, max: 100, direction: 'up' },
      { id: 'acesso_internet', min: 0, max: 100, direction: 'up' },
      { id: 'qualidade_transporte', min: 0, max: 100, direction: 'up' },
      { id: 'tempo_deslocamento', min: 0, max: 120, direction: 'down' },
    ],
  },
];

type StateIndicatorValues = Record<StateId, Record<string, number>>;

function stateWellbeingScore(values: Record<string, number>): number {
  let score = 0;
  let availableWeight = 0;

  for (const category of STATE_WELLBEING_CATEGORIES) {
    const metricScores: number[] = [];
    for (const metric of category.metrics) {
      const value = values[metric.id];
      if (!Number.isFinite(value)) continue;
      const normalized = Math.max(0, Math.min(1, (value - metric.min) / (metric.max - metric.min)));
      metricScores.push((metric.direction === 'up' ? normalized : 1 - normalized) * 100);
    }
    if (metricScores.length === 0) continue;
    score += (metricScores.reduce((sum, current) => sum + current, 0) / metricScores.length) * category.weight;
    availableWeight += category.weight;
  }

  return availableWeight > 0 ? score / availableWeight : 50;
}

function averagedStateWellbeingScores(
  stateIndicators: StateIndicatorValues,
  history: ContextSnapshot[],
  currentStateIndicators?: StateIndicatorValues,
): Record<StateId, number> {
  const recentSnapshots = history.slice(-1);
  const scores = {} as Record<StateId, number>;

  for (const sid of STATE_IDS) {
    const stateSamples = recentSnapshots
      .map((snapshot) => snapshot.states?.find((state) => state.id === sid)?.values)
      .filter((values): values is Record<string, number> => !!values);
    if (currentStateIndicators?.[sid]) stateSamples.push(currentStateIndicators[sid]);
    stateSamples.push(stateIndicators[sid] ?? {});
    scores[sid] = stateSamples.reduce((sum, values) => sum + stateWellbeingScore(values), 0) / stateSamples.length;
  }

  return scores;
}

// ============================================================
// BASELINE
// ============================================================

export function computeGroupBaseline(
  groupId: string,
  govIdeology: number,
  activePolicies: ActivePolicy[],
): number {
  const g = getGroup(groupId);
  let base = 50 + govIdeology * g.lean * 12;

  for (const p of activePolicies) {
    const reaction = p.groupReactions[groupId] ?? 0;
    if (reaction !== 0) base += reaction * POLICY_MARK_RATE;
  }

  return clampApproval(base);
}

// ============================================================
// DRIFT
// ============================================================

export function groupDriftTowards(
  current: number,
  baseline: number,
  rate = BASELINE_DRIFT_RATE,
): number {
  return (baseline - current) * rate;
}

export const START_YEAR = 2026;

export function monthIndex(year: number, month: number): number {
  return (year - START_YEAR) * 12 + (month - 1);
}

export function countIdleMonths(
  history: { monthIndex: number }[],
  currentMonthIndex: number,
): number {
  const withPolicy = new Set(history.map((h) => h.monthIndex));
  let n = 0;
  for (
    let m = currentMonthIndex;
    m >= 0 && !withPolicy.has(m);
    m--
  ) n++;
  return n;
}

export function idleDrift(idleMonths: number): number {
  return idleMonths <= 0 ? 0 : -Math.min(1.8, 0.6 * (1 + Math.floor(idleMonths / 2)));
}

// ============================================================
// SENSIBILIDADE A INDICADORES
// ============================================================

export interface IndicatorDeltas {
  national: Record<string, number>;
  states: Record<StateId, Record<string, number>>;
}

export function indicatorSensitivityDelta(
  groupId: string,
  deltas: IndicatorDeltas,
): {
  delta: number;
  breakdown: Array<{ indicatorId: string; delta: number; weight: number }>;
} {
  const sens = GROUP_SENSITIVITY[groupId];
  if (!sens) return { delta: 0, breakdown: [] };

  const g = getGroup(groupId);
  const combat = g.combatividade ?? 1;
  const breakdown: Array<{ indicatorId: string; delta: number; weight: number }> = [];
  let total = 0;

  for (const [indicatorId, weight] of Object.entries(sens)) {
    if (weight === 0) continue;
    const ind = getIndicator(indicatorId);

    let indicatorDelta = 0;

    if (ind.scope === 'national') {
      indicatorDelta = deltas.national[indicatorId] ?? 0;
    } else if (
      ind.scope === 'state_aggregated' ||
      ind.scope === 'state' ||
      ind.scope === 'national_and_state'
    ) {
      let num = 0;
      let den = 0;
      for (const sid of STATE_IDS) {
        const d = deltas.states[sid]?.[indicatorId];
        if (d === undefined) continue;
        const pop = STATES[sid].population;
        num += d * pop;
        den += pop;
      }
      indicatorDelta = den > 0 ? num / den : 0;

      if (indicatorDelta === 0 && ind.scope === 'national_and_state') {
        indicatorDelta = deltas.national[indicatorId] ?? 0;
      }
    }

    if (indicatorDelta === 0) continue;

    const contribution = indicatorDelta * weight * combat * SENSITIVITY_RATE;
    total += contribution;
    breakdown.push({ indicatorId, delta: indicatorDelta, weight });
  }

  return { delta: total, breakdown };
}

// ============================================================
// TURNO
// ============================================================

export interface ApprovalTurnInput {
  groupApprovals: Record<string, number>;
  previousNationalApproval?: number;
  govIdeology: number;
  activePolicies: ActivePolicy[];
  indicatorDeltas: IndicatorDeltas;
  extraGroupDeltas?: Record<string, number>;
  idleDriftAmount?: number;
}

export interface ApprovalTurnResult {
  approvals: Record<string, number>;
  baselines: Record<string, number>;
  log: Array<{
    groupId: string;
    before: number;
    after: number;
    parts: {
      baselineDrift: number;
      sensitivity: number;
      extra: number;
      idle: number;
    };
    breakdown: Array<{ indicatorId: string; delta: number; weight: number }>;
  }>;
  nationalApproval: number;
}

export function runApprovalTurn(input: ApprovalTurnInput): ApprovalTurnResult {
  const approvals: Record<string, number> = {};
  const baselines: Record<string, number> = {};
  const log: ApprovalTurnResult['log'] = [];

  for (const g of GROUPS) {
    const before = input.groupApprovals[g.id] ?? NEUTRAL;
    const baseline = computeGroupBaseline(
      g.id,
      input.govIdeology,
      input.activePolicies,
    );
    baselines[g.id] = baseline;

    const baselineDrift = groupDriftTowards(before, baseline);
    const { delta: sensitivity, breakdown } = indicatorSensitivityDelta(
      g.id,
      input.indicatorDeltas,
    );
    const extra = input.extraGroupDeltas?.[g.id] ?? 0;
    const idle = input.idleDriftAmount ?? 0;

    const after = clampApproval(before + baselineDrift + sensitivity + extra + idle);
    approvals[g.id] = after;

    log.push({
      groupId: g.id,
      before,
      after,
      parts: { baselineDrift, sensitivity, extra, idle },
      breakdown,
    });
  }

  return {
    approvals,
    baselines,
    log,
    nationalApproval: input.previousNationalApproval === undefined
      ? computeNationalApproval(approvals)
      : clampApproval(input.previousNationalApproval + (
        computeNationalApproval(approvals) - input.previousNationalApproval
      ) * NATIONAL_APPROVAL_INERTIA),
  };
}

// ============================================================
// APROVAÇÃO NACIONAL
// ============================================================

export function computeNationalApproval(
  groupApprovals: Record<string, number>,
  stateApprovals?: Record<StateId, number>,
): number {
  let num = 0;
  let den = 0;
  for (const g of GROUPS) {
    const v = groupApprovals[g.id];
    if (v === undefined) continue;
    num += v * g.peso;
    den += g.peso;
  }
  const fromGroups = den > 0 ? num / den : NEUTRAL;

  if (!stateApprovals) return clampApproval(fromGroups);

  let stNum = 0;
  let stDen = 0;
  for (const sid of STATE_IDS) {
    const v = stateApprovals[sid];
    if (v === undefined) continue;
    stNum += v * STATES[sid].population;
    stDen += STATES[sid].population;
  }
  const fromStates = stDen > 0 ? stNum / stDen : NEUTRAL;

  return clampApproval(0.5 * fromStates + 0.5 * fromGroups);
}

// ============================================================
// APROVAÇÃO POR ESTADO
// ============================================================

export function computeStateApprovals(
  nationalApproval: number,
  govIdeology: number,
  stateIndicators?: StateIndicatorValues,
  history: ContextSnapshot[] = [],
  previousApprovals?: Record<StateId, number>,
  currentStateIndicators?: StateIndicatorValues,
): Record<StateId, number> {
  const out = {} as Record<StateId, number>;
  const wellbeingScores = stateIndicators
    ? averagedStateWellbeingScores(stateIndicators, history, currentStateIndicators)
    : null;
  let nationalWellbeing = 50;
  if (wellbeingScores) {
    const totalPopulation = STATE_IDS.reduce((sum, sid) => sum + STATES[sid].population, 0);
    nationalWellbeing = STATE_IDS.reduce(
      (sum, sid) => sum + wellbeingScores[sid] * STATES[sid].population,
      0,
    ) / totalPopulation;
  }

  for (const sid of STATE_IDS) {
    const inclination = STATES[sid].politicalInclination;
    const alignment = -inclination * (govIdeology / 3);
    const ideologyShift = alignment * 12;
    let wellbeingShift = 0;

    if (wellbeingScores) {
      const absoluteShift = ((wellbeingScores[sid] - 50) / 50) * STATE_WELLBEING_SHIFT_MAX;
      const relativeShift = ((wellbeingScores[sid] - nationalWellbeing) / 50) * STATE_WELLBEING_SHIFT_MAX;
      wellbeingShift = Math.max(
        -STATE_WELLBEING_SHIFT_MAX,
        Math.min(STATE_WELLBEING_SHIFT_MAX, relativeShift * 0.7 + absoluteShift * 0.3),
      );
    }

    const target = clampApproval(nationalApproval + ideologyShift + wellbeingShift);
    const previous = previousApprovals?.[sid];
    out[sid] = previous === undefined
      ? target
      : clampApproval(previous + (target - previous) * STATE_APPROVAL_ADJUSTMENT_RATE);
  }
  return out;
}
