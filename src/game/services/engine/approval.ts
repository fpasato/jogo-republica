// src/game/services/engine/approval.ts

import { GROUPS, getGroup } from '../../data/groups';
import { GROUP_SENSITIVITY } from '../../data/groupSensitivity';
import { getIndicator } from '../../data/indicators';
import type { ActivePolicy } from '../../types/policy';

export const APPROVAL_MIN = 1;
export const APPROVAL_MAX = 100;
export const NEUTRAL = 50;

export const clampApproval = (n: number) =>
  Math.min(APPROVAL_MAX, Math.max(APPROVAL_MIN, Number.isFinite(n) ? n : NEUTRAL));

const BASELINE_DRIFT_RATE = 0.02;
const SENSITIVITY_RATE = 0.25;
const POLICY_MARK_RATE = 0.25;

export function computeGroupBaseline(
  groupId: string,
  govIdeology: number,
  activePolicies: ActivePolicy[] = [],
): number {
  const g = getGroup(groupId);
  // govIdeology (-3..+3) e lean (-1..+1)
  const alignment = (govIdeology / 3) * g.lean;
  let base = 50 + alignment * 15;

  for (const p of activePolicies) {
    const reaction = p.groupReactions[groupId] ?? 0;
    if (reaction !== 0) base += reaction * POLICY_MARK_RATE;
  }

  return clampApproval(base);
}

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
  for (let m = currentMonthIndex; m >= 0 && !withPolicy.has(m); m--) n++;
  return n;
}

export function idleDrift(idleMonths: number): number {
  return idleMonths <= 0 ? 0 : -Math.min(2.0, 0.5 * idleMonths);
}

export interface IndicatorDeltas {
  national: Record<string, number>;
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
    const indDelta = deltas.national[indicatorId] ?? 0;
    if (indDelta === 0) continue;

    const ind = getIndicator(indicatorId);
    // Normalizar direção do indicador se necessário
    const effectiveDelta = ind.formatKind === 'percent' || ind.formatKind === 'score'
      ? indDelta
      : (indDelta / (Math.abs(ind.initial) || 1)) * 10;

    const contribution = effectiveDelta * weight * combat * SENSITIVITY_RATE;
    total += contribution;
    breakdown.push({ indicatorId, delta: indDelta, weight });
  }

  return { delta: total, breakdown };
}

export interface ApprovalTurnInput {
  groupApprovals: Record<string, number>;
  previousNationalApproval?: number;
  govIdeology: number;
  activePolicies: ActivePolicy[];
  indicatorDeltas: IndicatorDeltas;
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
    const before = input.groupApprovals[g.id] ?? g.initialApproval ?? NEUTRAL;
    const baseline = computeGroupBaseline(g.id, input.govIdeology, input.activePolicies);
    baselines[g.id] = baseline;

    const baselineDrift = groupDriftTowards(before, baseline);
    const { delta: sensitivity, breakdown } = indicatorSensitivityDelta(g.id, input.indicatorDeltas);
    const idle = input.idleDriftAmount ?? 0;

    const after = clampApproval(before + baselineDrift + sensitivity + idle);
    approvals[g.id] = after;

    log.push({
      groupId: g.id,
      before,
      after,
      parts: { baselineDrift, sensitivity, idle },
      breakdown,
    });
  }

  const nationalApproval = computeNationalApproval(approvals);

  return {
    approvals,
    baselines,
    log,
    nationalApproval,
  };
}

export function computeNationalApproval(
  groupApprovals: Record<string, number>,
): number {
  let num = 0;
  let den = 0;
  for (const g of GROUPS) {
    const v = groupApprovals[g.id];
    if (v === undefined) continue;
    num += v * g.peso;
    den += g.peso;
  }
  return clampApproval(den > 0 ? num / den : NEUTRAL);
}
