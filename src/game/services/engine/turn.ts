import { STATE_IDS, type StateId } from '../../data/states';
import { getIndicator, INDICATORS } from '../../data/indicators';
import type { ActivePolicy } from '../../types/policy';
import {
  runTurn as runRulesEngine,
  type TurnLogEntry,
} from './rulesEngine';
import { aggregateAll } from './aggregation';
import {
  computeReactions,
  type ReactionsOutput,
} from './reactions';
import { syncMacroIndicators } from './macroSync';
import {
  runApprovalTurn,
  computeStateApprovals,
  countIdleMonths,
  idleDrift,
  monthIndex,
  type IndicatorDeltas,
} from './approval';
import type { GameState } from './initialState';
// ============================================================
// TIPOS
// ============================================================

/**
 * Input do turno = estado completo + deltas brutos (medidas recém-aprovadas
 * fora do fluxo de `activePolicies`).
 */
export interface TurnInput extends GameState {
  rawDeltas: {
    states: Record<StateId, Record<string, number>>;
    national: Record<string, number>;
  };
}

export interface TurnSummary {
  /** Frases curtas legíveis — vão direto pro contexto da IA. */
  lines: string[];
  /** Top deltas por |valor|. */
  topDeltas: Array<{ id: string; stateId: StateId | null; delta: number; category: string }>;
}

export interface TurnLog {
  policies: Array<{ policyId: string; name: string; applied: number; expired: boolean }>;
  rules: TurnLogEntry[];
  reactions: ReactionsOutput['log'];
  macroSync: Array<{ macroId: string; from: number; to: number }>;
  approval: ReturnType<typeof runApprovalTurn>['log'];
  reactionDeltas: {
    states: Record<StateId, Record<string, number>>;
    national: Record<string, number>;
  };
}

/** Output = estado completo + log/summary do turno. */
export interface TurnOutput extends GameState {
  log: TurnLog;
  summary: TurnSummary;
}

// ============================================================
// 1. DELTAS DAS POLÍTICAS ATIVAS
// ============================================================

const SPECIAL_EFFECT_KEYS = new Set(['budget', 'expenses', 'approval']);

interface PolicyDeltas {
  states: Record<StateId, Record<string, number>>;
  national: Record<string, number>;
  /** Detalhe por política, pro log. */
  perPolicy: Array<{ policyId: string; name: string; applied: number }>;
  /** Políticas que devem ser removidas neste turno (temporárias expiradas). */
  expired: string[];
}

/**
 * Delta mensal da política para um indicador.
 *
 * O `target` é o delta FINAL (definido pela IA). O motor distribui esse
 * valor em parcelas iguais ao longo de `effectRampUpMonths` (padrão: 1 =
 * aplica tudo de uma vez) e para de adicionar depois disso.
 *
 * Se `implementationMonths > 0`, nada é aplicado até o fim da carência.
 */
function policyMonthlyDelta(policy: ActivePolicy, target: number): number {
  const impl = policy.implementationMonths ?? 0;
  const active = policy.activeMonths ?? 0;
  if (active < impl) return 0;

  const effective = active - impl;
  const ramp = policy.effectRampUpMonths ?? 1;

  if (ramp <= 1) return effective === 0 ? target : 0;
  if (effective >= ramp) return 0;
  return target / ramp;
}

/**
 * Efeito acumulado total que a política já aplicou até agora.
 * Usado pra reverter quando uma política temporária expira.
 */
function policyAccumulated(policy: ActivePolicy, target: number): number {
  const impl = policy.implementationMonths ?? 0;
  const active = policy.activeMonths ?? 0;
  const effective = Math.max(0, active - impl);
  const ramp = policy.effectRampUpMonths ?? 1;
  if (ramp <= 1) return effective > 0 ? target : 0;
  return target * Math.min(1, effective / ramp);
}

function computePolicyDeltas(policies: ActivePolicy[]): PolicyDeltas {
  const states: Record<StateId, Record<string, number>> = Object.fromEntries(
    STATE_IDS.map((id) => [id, {}]),
  ) as Record<StateId, Record<string, number>>;
  const national: Record<string, number> = {};
  const perPolicy: PolicyDeltas['perPolicy'] = [];
  const expired: string[] = [];

  for (const p of policies) {
    const active = p.activeMonths ?? 0;

    // Expiração: reverte o acumulado antes de sair
    if (
      p.durationType === 'temporary' &&
      p.durationMonths > 0 &&
      active >= p.durationMonths
    ) {
      for (const [rawId, rawTarget] of Object.entries(p.effects)) {
        if (SPECIAL_EFFECT_KEYS.has(rawId)) continue;
        const target = rawTarget as number;
        if (target === 0) continue;
        const accumulated = policyAccumulated(p, target);
        const reverse = -accumulated;
        const ind = getIndicator(rawId);
        if (ind.scope === 'national') {
          national[rawId] = (national[rawId] ?? 0) + reverse;
        } else if (ind.scope === 'national_and_state') {
          national[rawId] = (national[rawId] ?? 0) + reverse;
          for (const sid of STATE_IDS) {
            states[sid][rawId] = (states[sid][rawId] ?? 0) + reverse;
          }
        } else {
          for (const sid of STATE_IDS) {
            states[sid][rawId] = (states[sid][rawId] ?? 0) + reverse;
          }
        }
      }
      expired.push(p.id);
      perPolicy.push({ policyId: p.id, name: p.name, applied: 0 });
      continue;
    }

    let applied = 0;
    for (const [rawId, rawTarget] of Object.entries(p.effects)) {
      if (SPECIAL_EFFECT_KEYS.has(rawId)) continue;
      const target = rawTarget as number;
      const amount = policyMonthlyDelta(p, target);
      if (amount === 0) continue;

      const ind = getIndicator(rawId);
      if (ind.scope === 'national') {
        national[rawId] = (national[rawId] ?? 0) + amount;
      } else if (ind.scope === 'national_and_state') {
        national[rawId] = (national[rawId] ?? 0) + amount;
        for (const sid of STATE_IDS) {
          states[sid][rawId] = (states[sid][rawId] ?? 0) + amount;
        }
      } else {
        for (const sid of STATE_IDS) {
          states[sid][rawId] = (states[sid][rawId] ?? 0) + amount;
        }
      }
      applied++;
    }
    perPolicy.push({ policyId: p.id, name: p.name, applied });
  }

  return { states, national, perPolicy, expired };
}

function mergeRawDeltas(
  a: TurnInput['rawDeltas'],
  b: PolicyDeltas,
): TurnInput['rawDeltas'] {
  const states: Record<StateId, Record<string, number>> = {} as any;
  for (const sid of STATE_IDS) {
    states[sid] = { ...(a.states[sid] ?? {}) };
    for (const [id, v] of Object.entries(b.states[sid] ?? {})) {
      states[sid][id] = (states[sid][id] ?? 0) + v;
    }
  }
  const national = { ...a.national };
  for (const [id, v] of Object.entries(b.national)) {
    national[id] = (national[id] ?? 0) + v;
  }
  return { states, national };
}

// ============================================================
// 2. APLICAR DELTAS DAS REAÇÕES
// ============================================================

function applyReactionDeltas(
  stateValues: Record<StateId, Record<string, number>>,
  nationalValues: Record<string, number>,
  reactions: ReactionsOutput,
): {
  stateIndicators: Record<StateId, Record<string, number>>;
  nationalIndicators: Record<string, number>;
} {
  const outState: Record<StateId, Record<string, number>> = {} as any;
  for (const sid of STATE_IDS) {
    outState[sid] = { ...stateValues[sid] };
    const deltas = reactions.stateDeltas[sid];
    if (!deltas) continue;
    for (const [id, d] of Object.entries(deltas)) {
      const ind = getIndicator(id);
      const current = outState[sid][id] ?? 0;
      outState[sid][id] = Math.max(ind.min, Math.min(ind.max, current + d));
    }
  }

  const outNational = { ...nationalValues };
  for (const [id, d] of Object.entries(reactions.nationalDeltas)) {
    // Macros standalone não estão em `indicators.ts` — aplicam direto
    if (!(id in INDICATORS)) {
      outNational[id] = (outNational[id] ?? 0) + d;
      continue;
    }
    const ind = getIndicator(id);
    const current = outNational[id] ?? 0;
    outNational[id] = Math.max(ind.min, Math.min(ind.max, current + d));
  }

  return { stateIndicators: outState, nationalIndicators: outNational };
}

// ============================================================
// 3. DELTAS PARA A APROVAÇÃO
// ============================================================

function computeIndicatorDeltas(
  before: TurnInput,
  afterState: Record<StateId, Record<string, number>>,
  afterNational: Record<string, number>,
): IndicatorDeltas {
  const states: Record<StateId, Record<string, number>> = {} as any;
  for (const sid of STATE_IDS) {
    states[sid] = {};
    const beforeS = before.stateIndicators[sid] ?? {};
    const afterS = afterState[sid] ?? {};
    for (const id of Object.keys(afterS)) {
      const b = beforeS[id] ?? afterS[id];
      const a = afterS[id];
      if (a !== b) states[sid][id] = a - b;
    }
  }
  const national: Record<string, number> = {};
  for (const [id, a] of Object.entries(afterNational)) {
    const b = before.nationalIndicators[id];
    if (b === undefined) continue;
    if (a !== b) national[id] = a - b;
  }
  return { states, national };
}

// ============================================================
// 4. IDADE DAS POLÍTICAS
// ============================================================

function ageAndExpirePolicies(
  policies: ActivePolicy[],
  expiredIds: Set<string>,
): ActivePolicy[] {
  return policies
    .filter((p) => !expiredIds.has(p.id))
    .map((p) => ({ ...p, activeMonths: (p.activeMonths ?? 0) + 1 }));
}

// ============================================================
// 5. RESUMO NARRATIVO
// ============================================================

function buildSummary(
  input: TurnInput,
  output: {
    stateIndicators: Record<StateId, Record<string, number>>;
    nationalIndicators: Record<string, number>;
    macros: Record<string, number>;
    nationalApproval: number;
  },
  policyLog: PolicyDeltas['perPolicy'],
): TurnSummary {
  const lines: string[] = [];
  const topDeltas: TurnSummary['topDeltas'] = [];

  // Aprovação nacional
  lines.push(`Aprovação nacional: ${output.nationalApproval.toFixed(1)}`);

  // Macros principais
  const macroDiffs: string[] = [];
  for (const [id, val] of Object.entries(output.macros)) {
    const before = input.macros[id];
    if (before === undefined) continue;
    const diff = val - before;
    if (Math.abs(diff) < 0.05) continue;
    macroDiffs.push(`${id}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}`);
  }
  if (macroDiffs.length > 0) lines.push(`Macros: ${macroDiffs.join(', ')}`);

  // Top deltas (nacional + estados)
  const deltas: Array<{ id: string; stateId: StateId | null; delta: number }> = [];

  for (const [id, val] of Object.entries(output.nationalIndicators)) {
    const before = input.nationalIndicators[id];
    if (before === undefined) continue;
    const diff = val - before;
    if (Math.abs(diff) < 1e-3) continue;
    deltas.push({ id, stateId: null, delta: diff });
  }
  for (const sid of STATE_IDS) {
    const after = output.stateIndicators[sid];
    const before = input.stateIndicators[sid] ?? {};
    for (const [id, val] of Object.entries(after)) {
      const b = before[id];
      if (b === undefined) continue;
      const diff = val - b;
      if (Math.abs(diff) < 1e-3) continue;
      deltas.push({ id, stateId: sid, delta: diff });
    }
  }

  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const top = deltas.slice(0, 12);

  for (const d of top) {
    const ind = INDICATORS[d.id];
    topDeltas.push({
      id: d.id,
      stateId: d.stateId,
      delta: d.delta,
      category: ind?.category ?? 'outro',
    });
  }

  // Políticas
  const applied = policyLog.filter((p) => p.applied > 0).length;
  if (applied > 0) lines.push(`${applied} medida(s) ativa(s) aplicando efeitos.`);

  // Macros de crise
  if (output.macros.crisisClimate >= 60) lines.push('Clima de crise elevado.');
  if (output.macros.militaryLoyalty <= 40) lines.push('Lealdade militar baixa.');
  if (output.macros.scandalExposure >= 50) lines.push('Exposição a escândalo alta.');

  return { lines, topDeltas };
}

// ============================================================
// 6. ORQUESTRADOR
// ============================================================

export function runGameTurn(input: TurnInput): TurnOutput {
  // ---------- 1. Políticas → deltas + expiração ----------
  const policyDeltas = computePolicyDeltas(input.activePolicies);
  const mergedRawDeltas = mergeRawDeltas(input.rawDeltas, policyDeltas);

  const policyLog = policyDeltas.perPolicy.map((p) => ({
    policyId: p.policyId,
    name: p.name,
    applied: p.applied,
    expired: policyDeltas.expired.includes(p.policyId),
  }));

  // ---------- 2. rulesEngine (pending + raw + drift + regras + agregação) ----------
  const rulesResult = runRulesEngine({
    month: input.month,
    stateIndicators: input.stateIndicators,
    nationalIndicators: input.nationalIndicators,
    rawDeltas: mergedRawDeltas,
    pendingEffects: input.pendingEffects,
  });

  // ---------- 3. Reações sociais ----------
  const reactionsResult = computeReactions({
    groupApprovals: input.groupApprovals,
    active: input.activeReactions,
    nationalIndicators: rulesResult.nationalIndicators,
  });

  // ---------- 4. Aplica deltas das reações + re-agrega ----------
  const afterReactions = applyReactionDeltas(
    rulesResult.stateIndicators,
    rulesResult.nationalIndicators,
    reactionsResult,
  );

  // Re-agregação: as reações podem ter mexido em indicadores estaduais,
  // e os derivados nacionais precisam refletir isso.
  const reAggregated = aggregateAll(afterReactions.stateIndicators);
  for (const [id, value] of Object.entries(reAggregated)) {
    afterReactions.nationalIndicators[id] = value;
  }

  // ---------- 5. macroSync ----------
  const macroSyncResult = syncMacroIndicators(input.macros, {
    national: afterReactions.nationalIndicators,
    stateIndicators: afterReactions.stateIndicators,
  });

  // ---------- 6. Aprovação dos grupos ----------
  const idleMonths = countIdleMonths(
    input.policyHistory,
    monthIndex(input.year, input.month),
  );
  const approvalResult = runApprovalTurn({
    groupApprovals: input.groupApprovals,
    govIdeology: input.profile.govIdeology,
    activePolicies: input.activePolicies,
    indicatorDeltas: computeIndicatorDeltas(
      input,
      afterReactions.stateIndicators,
      afterReactions.nationalIndicators,
    ),
    extraGroupDeltas: reactionsResult.groupApprovalDeltas,
    idleDriftAmount: idleDrift(idleMonths),
  });

  // ---------- 7. Aprovação por estado ----------
  const stateApprovals = computeStateApprovals(
    approvalResult.nationalApproval,
    input.profile.govIdeology,
  );

  // ---------- 8. Idade das políticas ----------
  const agedPolicies = ageAndExpirePolicies(
    input.activePolicies,
    new Set(policyDeltas.expired),
  );

  // ---------- 9. Monta output ----------
  const log: TurnLog = {
    policies: policyLog,
    rules: rulesResult.log,
    reactions: reactionsResult.log,
    macroSync: macroSyncResult.log,
    approval: approvalResult.log,
    reactionDeltas: {
      states: reactionsResult.stateDeltas,
      national: reactionsResult.nationalDeltas,
    },
  };

  const summary = buildSummary(
    input,
    {
      stateIndicators: afterReactions.stateIndicators,
      nationalIndicators: afterReactions.nationalIndicators,
      macros: macroSyncResult.macros,
      nationalApproval: approvalResult.nationalApproval,
    },
    policyDeltas.perPolicy,
  );

  return {
    ...input,
    year: input.month >= 12 ? input.year + 1 : input.year,
    month: input.month >= 12 ? 1 : input.month + 1,
    stateIndicators: afterReactions.stateIndicators,
    nationalIndicators: afterReactions.nationalIndicators,
    macros: macroSyncResult.macros,
    groupApprovals: approvalResult.approvals,
    stateApprovals,
    nationalApproval: approvalResult.nationalApproval,
    activePolicies: agedPolicies,
    pendingEffects: rulesResult.pendingEffects,
    activeReactions: reactionsResult.remaining,
    log,
    summary,
  };
}
