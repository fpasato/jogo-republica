// services/engine/approval.ts

import { GROUPS, getGroup } from '../../data/groups';
import { GROUP_SENSITIVITY } from '../../data/groupSensitivity';
import { getIndicator } from '../../data/indicators';
import { STATE_IDS, STATES, type StateId } from '../../data/states';
import type { ActivePolicy } from '../../types/policy';

// ============================================================
// CONSTANTES
// ============================================================

export const APPROVAL_MIN = 1;
export const APPROVAL_MAX = 100;
export const NEUTRAL = 50;

export const clampApproval = (n: number) =>
  Math.min(APPROVAL_MAX, Math.max(APPROVAL_MIN, Number.isFinite(n) ? n : NEUTRAL));

/** Velocidade de drift ao baseline (0.02 = meia-vida ~35 meses). */
const BASELINE_DRIFT_RATE = 0.02;

/** Quanto da sensibilidade bruta vira mudança efetiva por turno. */
const SENSITIVITY_RATE = 0.25;

/** Marca permanente de uma política no baseline (25% do choque inicial). */
const POLICY_MARK_RATE = 0.25;

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
  return idleMonths <= 0 ? 0 : -Math.min(3, 1 + Math.floor(idleMonths / 2));
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
    nationalApproval: computeNationalApproval(approvals),
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
): Record<StateId, number> {
  const out = {} as Record<StateId, number>;
  for (const sid of STATE_IDS) {
    const inclination = STATES[sid].politicalInclination;
    const alignment = -inclination * (govIdeology / 3);
    const shift = alignment * 12;
    out[sid] = clampApproval(nationalApproval + shift);
  }
  return out;
}
