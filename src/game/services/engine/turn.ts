import { STATE_IDS, STATES, totalPopulation, type StateId } from '../../data/states';
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
import { propagateChains, applyCascadeDeltas } from './propagation';
import { deriveStateIdh } from './deriveStateIdh';
import { INDICATOR_CHAINS } from '../../data/indicatorChains';

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
const POLICY_DIAGNOSTIC_INDICATORS = new Set([
  'salario_minimo',
  'receitas_publicas',
  'gastos_publicos',
]);
const BRAZIL_POPULATION = totalPopulation();

/** Distribui medidas nacionais de contagem conforme a população estadual.
 * Indicadores em taxa/média recebem o mesmo delta em cada estado; assim,
 * o agregado ponderado muda pelo delta original e os eventos absolutos
 * correspondentes crescem proporcionalmente à população.
 */
function statePolicyDelta(
  indicator: ReturnType<typeof getIndicator>,
  amount: number,
  stateId: StateId,
  isRegionalPolicy: boolean,
): number {
  if (
    !isRegionalPolicy &&
    indicator.scope === 'state_aggregated' &&
    indicator.aggregation?.kind === 'sum'
  ) {
    return amount * (STATES[stateId].population / BRAZIL_POPULATION);
  }
  return amount;
}

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
function policyEffectStep(policy: ActivePolicy, includeCurrentTurn: boolean): number {
  const impl = policy.implementationMonths ?? 0;
  const active = policy.activeMonths ?? 0;
  const elapsed = active + (includeCurrentTurn ? 1 : 0);
  if (elapsed < impl) return -1;
  // impl=0 começa no primeiro turno; impl>0 começa no primeiro turno
  // que cumpre o prazo de implementação.
  return Math.max(0, elapsed - impl - (impl === 0 ? 1 : 0));
}

function policyMonthlyDelta(policy: ActivePolicy, indicatorId: string, target: number): number {
  const step = policyEffectStep(policy, true);
  if (step < 0) return 0;
  if (indicatorId === 'salario_minimo') return step === 0 ? target : 0;

  const ramp = policy.effectRampUpMonths ?? 1;
  if (ramp <= 1) return step === 0 ? target : 0;
  if (step >= ramp) return 0;
  return target / ramp;
}

/**
 * Efeito acumulado total que a política já aplicou até agora.
 * Usado pra reverter quando uma política temporária expira.
 */
function policyAccumulated(policy: ActivePolicy, indicatorId: string, target: number): number {
  const step = policyEffectStep(policy, false);
  const completedSteps = step < 0 ? 0 : step + 1;
  if (indicatorId === 'salario_minimo') return completedSteps > 0 ? target : 0;
  const ramp = policy.effectRampUpMonths ?? 1;
  if (ramp <= 1) return completedSteps > 0 ? target : 0;
  return target * Math.min(1, completedSteps / ramp);
}

/** Delta fiscal na taxa anualizada, em R$ bilhões por turno. */
function policyMonthlyFiscal(policy: ActivePolicy): number {
  if (!policy.fiscalAnnual) return 0;
  const step = policyEffectStep(policy, true);
  if (step < 0) return 0;
  const ramp = Math.max(1, policy.effectRampUpMonths ?? 1);
  if (step >= ramp) return 0;
  return (policy.fiscalAnnual / 1e9) / ramp;
}

/** Impacto fiscal anualizado já incorporado, para reverter medidas temporárias. */
function policyAccumulatedFiscal(policy: ActivePolicy): number {
  if (!policy.fiscalAnnual) return 0;
  const step = policyEffectStep(policy, false);
  const completedSteps = step < 0 ? 0 : step + 1;
  const ramp = Math.max(1, policy.effectRampUpMonths ?? 1);
  return (policy.fiscalAnnual / 1e9) * Math.min(1, completedSteps / ramp);
}

function computePolicyDeltas(policies: ActivePolicy[]): PolicyDeltas {
  const states: Record<StateId, Record<string, number>> = Object.fromEntries(
    STATE_IDS.map((id) => [id, {}]),
  ) as Record<StateId, Record<string, number>>;
  const national: Record<string, number> = {};
  const perPolicy: PolicyDeltas['perPolicy'] = [];
  const expired: string[] = [];

  for (const p of policies) {
    const targetStates = p.targetStates?.length
      ? STATE_IDS.filter((sid) => p.targetStates?.includes(sid))
      : STATE_IDS;
    const isRegionalPolicy = p.targetStates !== undefined && p.targetStates.length > 0;
    const active = p.activeMonths ?? 0;
    const diagnosticEffects = Object.fromEntries(
      Object.entries(p.effects).filter(([id]) => POLICY_DIAGNOSTIC_INDICATORS.has(id)),
    );
    if (active === 0 || Object.keys(diagnosticEffects).length > 0) {
      console.info('[runGameTurn] Efeitos de salário/orçamento na política', {
        policyId: p.id,
        name: p.name,
        activeMonths: active,
        implementationMonths: p.implementationMonths ?? 0,
        effectRampUpMonths: p.effectRampUpMonths ?? 0,
        fiscalAnnual: p.fiscalAnnual,
        effects: diagnosticEffects,
      });
    }
    if (active === 0 && Object.keys(diagnosticEffects).length === 0) {
      console.warn(`[runGameTurn] A política "${p.name}" não contém salário mínimo, receitas ou gastos nos efeitos.`);
    }

    // Expiração: reverte o acumulado antes de sair
    if (
      p.durationType === 'temporary' &&
      p.durationMonths > 0 &&
      active >= p.durationMonths
    ) {
      const fiscalAccumulated = policyAccumulatedFiscal(p);
      if (fiscalAccumulated > 0) {
        national.receitas_publicas = (national.receitas_publicas ?? 0) - fiscalAccumulated;
      } else if (fiscalAccumulated < 0) {
        national.gastos_publicos = (national.gastos_publicos ?? 0) + Math.abs(fiscalAccumulated);
      }

      for (const [rawId, rawTarget] of Object.entries(p.effects)) {
        if (SPECIAL_EFFECT_KEYS.has(rawId)) continue;
        const target = rawTarget as number;
        if (target === 0) continue;
        const accumulated = policyAccumulated(p, rawId, target);
        const reverse = -accumulated;
        const ind = getIndicator(rawId);
        if (ind.scope === 'national') {
          national[rawId] = (national[rawId] ?? 0) + reverse;
        } else if (ind.scope === 'national_and_state') {
          if (!isRegionalPolicy) {
            national[rawId] = (national[rawId] ?? 0) + reverse;
          }
          for (const sid of targetStates) {
            states[sid][rawId] = (states[sid][rawId] ?? 0) + statePolicyDelta(ind, reverse, sid, isRegionalPolicy);
          }
        } else {
          for (const sid of targetStates) {
            states[sid][rawId] = (states[sid][rawId] ?? 0) + statePolicyDelta(ind, reverse, sid, isRegionalPolicy);
          }
        }
      }
      expired.push(p.id);
      perPolicy.push({ policyId: p.id, name: p.name, applied: 0 });
      continue;
    }

    let applied = 0;
    const fiscalDelta = policyMonthlyFiscal(p);
    if (fiscalDelta !== 0) {
      console.info('[runGameTurn] Parcela fiscal aplicada', {
        policyId: p.id,
        fiscalAnnual: p.fiscalAnnual,
        fiscalDeltaBi: fiscalDelta,
        destination: fiscalDelta > 0 ? 'receitas_publicas' : 'gastos_publicos',
        activeMonths: active,
        implementationMonths: p.implementationMonths,
        effectRampUpMonths: p.effectRampUpMonths,
      });
    }
    if (fiscalDelta > 0) {
      national.receitas_publicas = (national.receitas_publicas ?? 0) + fiscalDelta;
      applied++;
    } else if (fiscalDelta < 0) {
      national.gastos_publicos = (national.gastos_publicos ?? 0) + Math.abs(fiscalDelta);
      applied++;
    }
    for (const [rawId, rawTarget] of Object.entries(p.effects)) {
      if (SPECIAL_EFFECT_KEYS.has(rawId)) continue;
      const target = rawTarget as number;
      const amount = policyMonthlyDelta(p, rawId, target);
      if (POLICY_DIAGNOSTIC_INDICATORS.has(rawId)) {
        console.info('[runGameTurn] Parcela calculada para indicador nacional', {
          policyId: p.id,
          name: p.name,
          indicatorId: rawId,
          targetDelta: target,
          monthlyDelta: amount,
          activeMonths: active,
          implementationMonths: p.implementationMonths ?? 0,
          effectRampUpMonths: p.effectRampUpMonths ?? 0,
        });
      }
      if (amount === 0) continue;

      const ind = getIndicator(rawId);
      if (ind.scope === 'national') {
        national[rawId] = (national[rawId] ?? 0) + amount;
      } else if (ind.scope === 'national_and_state') {
        if (!isRegionalPolicy) {
          national[rawId] = (national[rawId] ?? 0) + amount;
        }
        for (const sid of targetStates) {
          states[sid][rawId] = (states[sid][rawId] ?? 0) + statePolicyDelta(ind, amount, sid, isRegionalPolicy);
        }
      } else {
        for (const sid of targetStates) {
          states[sid][rawId] = (states[sid][rawId] ?? 0) + statePolicyDelta(ind, amount, sid, isRegionalPolicy);
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

  // ---------- 4a. Cadeias de propagação ----------
  const directDeltas = computeIndicatorDeltas(
    input,
    afterReactions.stateIndicators,
    afterReactions.nationalIndicators,
  ).national;

  const cascadeDeltas = propagateChains(directDeltas, INDICATOR_CHAINS);

  applyCascadeDeltas(
    afterReactions.nationalIndicators,
    afterReactions.stateIndicators,
    cascadeDeltas,
  );

  // ---------- 4b. Deriva IDH estadual a partir de saúde/educação/renda ----------
  deriveStateIdh(afterReactions.stateIndicators);

  // ---------- 4c. Re-agregação nacional ----------
  const reAggregated = aggregateAll(afterReactions.stateIndicators);
  for (const [id, value] of Object.entries(reAggregated)) {
    afterReactions.nationalIndicators[id] = value;
  }

  for (const [id, d] of Object.entries(cascadeDeltas)) {
    const ind = INDICATORS[id];
    if (!ind) continue;                 // segurança: ignora ids desconhecidos
    const current = afterReactions.nationalIndicators[id] ?? 0;
    afterReactions.nationalIndicators[id] = Math.max(
      ind.min,
      Math.min(ind.max, current + d),
    );
  }

  // Saldo nacional é derivado dos fluxos federais depois das políticas,
  // regras, reações e cascatas deste turno.
  const receipts = afterReactions.nationalIndicators.receitas_publicas ?? 0;
  const expenses = afterReactions.nationalIndicators.gastos_publicos ?? 0;
  const balanceDef = INDICATORS.saldo_orcamentario;
  afterReactions.nationalIndicators.saldo_orcamentario = Math.max(
    balanceDef.min,
    Math.min(balanceDef.max, receipts - expenses),
  );


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
    previousNationalApproval: input.nationalApproval,
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
    afterReactions.stateIndicators,
    input.history,
    input.stateApprovals,
    input.stateIndicators,
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

  console.info('[runGameTurn] Resultado nacional de salário e orçamento', {
    before: Object.fromEntries(
      [...POLICY_DIAGNOSTIC_INDICATORS].map((id) => [id, input.nationalIndicators[id]]),
    ),
    after: Object.fromEntries(
      [...POLICY_DIAGNOSTIC_INDICATORS].map((id) => [id, afterReactions.nationalIndicators[id]]),
    ),
    policyLog,
  });

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
