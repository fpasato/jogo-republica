import type { StateId } from '../../data/states';
import { STATE_IDS, STATES } from '../../data/states';

import type { IndicatorDirection } from '../../data/indicators';
import { getIndicator, classifyById } from '../../data/indicators';

import { getGroup, GROUPS } from '../../data/groups';
import { MACRO_INDICATORS, MACRO_BY_ID } from '../../data/macroIndicators';
import { AVAILABLE_QUERIES } from '../../data/queryCatalog';
import type { ActivePolicy } from '../../types/policy';
import type {
  PolicyContext,
  ContextInput,
  ContextSnapshot,
  IndicatorSnapshot,
  StateSummary,
  GroupSummary,
  ActivePolicyContext,
  CrisisContext,
  HistoryContext,
  NationalContext,
} from '../../types/ai';
// ============================================================
// CONSTANTES
// ============================================================

const HISTORY_MONTHS = 6;

/** Indicadores fiscais detalhados que compõem o header nacional. */
const FISCAL_IDS = [
  'receitas_publicas',
  'gastos_publicos',
  'saldo_orcamentario',
  'carga_tributaria',
] as const;

/** Série nacional no histórico: macros + aprovação + fiscal-chave. */
const HISTORY_INDICATORS = [
  'inflacao', 'desemprego', 'crescimento_pib', 'selic', 'cotacao_dolar',
  'divida_publica', 'homicidios', 'acesso_saude', 'carga_tributaria',
];

/**
 * Ranges para classificar os macros que não estão no catálogo detalhado.
 * min/max são "de referência" pra dividir em 5 tiers.
 */
const MACRO_RANGES: Record<
  string,
  { min: number; max: number; direction: IndicatorDirection }
> = {
  unemployment:     { min: 0,  max: 20,  direction: 'lower_is_better' },
  growth:           { min: -5, max: 8,   direction: 'higher_is_better' },
  inflation:        { min: 0,  max: 15,  direction: 'lower_is_better' },
  debt:             { min: 30, max: 150, direction: 'lower_is_better' },
  criminality:      { min: 0,  max: 100, direction: 'lower_is_better' },
  dollar:           { min: 3,  max: 10,  direction: 'lower_is_better' },
  selicRate:        { min: 2,  max: 20,  direction: 'lower_is_better' },
  scandalExposure:  { min: 0,  max: 100, direction: 'lower_is_better' },
  militaryLoyalty:  { min: 0,  max: 100, direction: 'higher_is_better' },
  crisisClimate:    { min: 0,  max: 100, direction: 'lower_is_better' },
};

// ============================================================
// HELPERS
// ============================================================

function classifyFromRange(
  min: number,
  max: number,
  direction: IndicatorDirection,
  value: number,
): string {
  const span = max - min;
  if (span <= 0) return 'Regular';
  const normalized = Math.max(0, Math.min(1, (value - min) / span));
  const idx = Math.min(4, Math.floor(normalized * 5));
  const higher = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Muito bom'];
  const lower = ['Muito bom', 'Bom', 'Regular', 'Ruim', 'Muito ruim'];
  const neutral = ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'];
  const labels =
    direction === 'higher_is_better' ? higher
    : direction === 'lower_is_better' ? lower
    : neutral;
  return labels[idx];
}

function computeTrend(series: number[]): 'subindo' | 'caindo' | 'estável' {
  if (series.length < 2) return 'estável';
  const first = series[0];
  const last = series[series.length - 1];
  const change = last - first;
  // Threshold: 1,5% do valor de referência, com piso em 0,1.
  const threshold = Math.max(0.1, Math.abs(first) * 0.015);
  if (change > threshold) return 'subindo';
  if (change < -threshold) return 'caindo';
  return 'estável';
}

/** Cria snapshot para um indicador do catálogo detalhado. */
function detailedSnapshot(
  id: string,
  series: number[],
): IndicatorSnapshot {
  const ind = getIndicator(id);
  const value = series[series.length - 1] ?? 0;
  return {
    id,
    label: ind.name,
    unit: ind.unit,
    value,
    recentDelta: series.length >= 2 ? value - series[0] : 0,
    trend: computeTrend(series),
    classification: classifyById(id, value),
    direction: ind.direction,
  };
}

/** Cria snapshot para um macro do catalog.ts. */
function macroSnapshot(
  id: string,
  series: number[],
): IndicatorSnapshot {
  const m = MACRO_BY_ID[id];
  const value = series[series.length - 1] ?? 0;
  const range = MACRO_RANGES[id] ?? { min: 0, max: 100, direction: 'neutral' as const };
  return {
    id,
    label: m.nome,
    unit: m.unidade,
    value,
    recentDelta: series.length >= 2 ? value - series[0] : 0,
    trend: computeTrend(series),
    classification: classifyFromRange(range.min, range.max, range.direction, value),
    direction: range.direction,
  };
}

/** Série histórica de um indicador nacional em ContextSnapshot. */
function nationalSeries(
  id: string,
  history: ContextSnapshot[],
): number[] {
  const fromHistory: number[] = [];
  for (const snap of history) {
    const v = snap.national[id];
    if (typeof v === 'number') fromHistory.push(v);
  }
  return fromHistory;
}

/** Série histórica de um macro. */
function macroSeries(
  id: string,
  history: ContextSnapshot[],
): number[] {
  const fromHistory: number[] = [];
  for (const snap of history) {
    const v = snap.macros[id];
    if (typeof v === 'number') fromHistory.push(v);
  }
  return fromHistory;
}

// ============================================================
// DETECÇÃO DE MENÇÕES A ESTADOS
// ============================================================

function findMentionedStates(text: string): Set<StateId> {
  const found = new Set<StateId>();
  const upper = text.toUpperCase();

  // Nomes mais longos primeiro para evitar "Rio" casando antes de "Rio Grande"
  const byNameLength = [...STATE_IDS].sort(
    (a, b) => STATES[b].name.length - STATES[a].name.length,
  );

  for (const sid of byNameLength) {
    const name = STATES[sid].name.toUpperCase();
    if (upper.includes(name)) {
      found.add(sid);
      continue;
    }
    // Acrônimo isolado
    const re = new RegExp(`\\b${sid}\\b`);
    if (re.test(upper)) found.add(sid);
  }

  return found;
}

// ============================================================
// SUB-BUILDERS
// ============================================================

function buildNationalContext(
  input: ContextInput,
  history: ContextSnapshot[],
): NationalContext {
  const macro: IndicatorSnapshot[] = MACRO_INDICATORS.map((m) =>
    macroSnapshot(m.id, macroSeries(m.id, history)),
  );

  const fiscal: IndicatorSnapshot[] = FISCAL_IDS
    .filter((id) => input.nationalIndicators[id] !== undefined)
    .map((id) => detailedSnapshot(id, nationalSeries(id, history)));

  const approvalSeries = history.map((s) => s.nationalApproval);

  return {
    month: input.month,
    approval: input.nationalApproval,
    approvalTrend: computeTrend(approvalSeries),
    macro,
    fiscal,
    indicators: input.nationalIndicators,   // 👈 NOVA LINHA
  };
}

function buildStateSummaries(
  input: ContextInput,
  mentioned: Set<StateId>,
): StateSummary[] {
  return STATE_IDS.map((sid) => {
    const s = STATES[sid];
    return {
      id: sid,
      name: s.name,
      region: s.region,
      population: s.population,
      approval: input.stateApprovals[sid] ?? 50,
      politicalInclination: s.politicalInclination,
      highlighted: mentioned.has(sid),
    };
  });
}

function buildGroupSummaries(
  input: ContextInput,
): GroupSummary[] {
  const activeByGroup = new Map(
    input.activeReactions.map((r) => [r.groupId, r]),
  );

  return GROUPS.map((g) => {
    const approval = input.groupApprovals[g.id] ?? 50;
    const active = activeByGroup.get(g.id);

    const summary: GroupSummary = {
      id: g.id,
      name: g.nome,
      weight: g.peso,
      approval,
      lean: g.lean,
    };

    if (g.combatividade && g.combatividade !== 1) {
      summary.combativeness = g.combatividade;
    }

    if (g.reacao) {
      summary.reaction = {
        title: g.reacao.titulo,
        active: !!active,
        monthsActive: active?.monthsActive,
      };
    }

    return summary;
  });
}

function policyStatus(p: ActivePolicy): 'iniciando' | 'aplicando' | 'encerrando' {
  const active = p.activeMonths ?? 0;
  const rampUp = p.effectRampUpMonths ?? 0;
  if (rampUp > 0 && active < rampUp) return 'iniciando';
  if (p.durationType === 'temporary' && p.durationMonths > 0) {
    const remaining = p.durationMonths - active;
    if (remaining <= 2) return 'encerrando';
  }
  return 'aplicando';
}

function buildActivePolicyContexts(
  policies: ActivePolicy[],
): ActivePolicyContext[] {
  return policies.map((p) => {
    const rampUp = p.effectRampUpMonths ?? 0;
    const active = p.activeMonths ?? 0;
    const monthsToFullEffect = Math.max(0, rampUp - active);

    const affectedIndicators = Object.keys(p.effects).filter(
      (k) => k !== 'budget' && k !== 'expenses' && k !== 'approval',
    );

    const affectedGroups = Object.entries(p.groupReactions)
      .filter(([, delta]) => delta !== 0)
      .map(([id, delta]) => ({ id, delta }));

    const ctx: ActivePolicyContext = {
      id: p.id,
      name: p.name,
      type: p.type,
      status: policyStatus(p),
      activeMonths: active,
      monthsToFullEffect,
      affectedIndicators,
      affectedGroups,
      fiscalAnnual: p.fiscalAnnual,
    };

    if (p.durationType === 'temporary' && p.durationMonths > 0) {
      ctx.monthsToExpire = Math.max(0, p.durationMonths - active);
    }

    return ctx;
  });
}

function buildCrises(
  input: ContextInput,
): CrisisContext[] {
  const out: CrisisContext[] = [];
  const { macros } = input;

  if ((macros.crisisClimate ?? 0) >= 60) {
    const v = macros.crisisClimate;
    out.push({
      kind: 'crisis_climate',
      severity: v >= 80 ? 'alta' : 'média',
      description: `Clima de crise em ${v.toFixed(0)}/100. Ruas tensas, oposição mobilizada.`,
    });
  }
  if ((macros.scandalExposure ?? 0) >= 50) {
    const v = macros.scandalExposure;
    out.push({
      kind: 'scandal',
      severity: v >= 70 ? 'alta' : 'média',
      description: `Exposição a escândalo em ${v.toFixed(0)}/100. Governo sob pressão.`,
    });
  }
  if ((macros.militaryLoyalty ?? 100) <= 40) {
    const v = macros.militaryLoyalty;
    out.push({
      kind: 'military',
      severity: v <= 25 ? 'alta' : 'média',
      description: `Lealdade militar em ${v.toFixed(0)}/100. Mal-estar nos quartéis.`,
    });
  }

  for (const r of input.activeReactions) {
    const g = getGroup(r.groupId);
    if (!g.reacao) continue;
    out.push({
      kind: 'reaction',
      severity: r.monthsActive >= 3 ? 'alta' : 'média',
      description: `${g.nome}: ${g.reacao.titulo} (${r.monthsActive} ${r.monthsActive === 1 ? 'mês' : 'meses'}).`,
      since: r.monthsActive,
    });
  }

  return out;
}

function buildHistoryContext(
  history: ContextSnapshot[],
): HistoryContext {
  const indicators: Record<string, number[]> = {};
  for (const id of HISTORY_INDICATORS) {
    const series = nationalSeries(id, history);
    if (series.length > 0) indicators[id] = series;
  }

  const groupApprovals: Record<string, number[]> = {};
  for (const g of GROUPS) {
    const series = history
      .map((s) => s.groupApprovals[g.id])
      .filter((v): v is number => typeof v === 'number');
    if (series.length > 0) groupApprovals[g.id] = series;
  }

  return {
    months: history.length,
    indicators,
    groupApprovals,
    nationalApproval: history.map((s) => s.nationalApproval),
  };
}

// ============================================================
// BUILDER PRINCIPAL
// ============================================================

export function buildContext(input: ContextInput): PolicyContext {
  // Junta os snapshots do histórico com o estado atual e limita a HISTORY_MONTHS.
  const currentSnapshot: ContextSnapshot = {
    month: input.month,
    national: input.nationalIndicators,
    macros: input.macros,
    groupApprovals: input.groupApprovals,
    nationalApproval: input.nationalApproval,
  };

  const fullHistory = [...input.history, currentSnapshot];
  const trimmed = fullHistory.slice(-HISTORY_MONTHS);

  const mentioned = findMentionedStates(input.proposal);

  return {
    proposal: input.proposal,
    month: input.month,
    profile: input.profile,
    national: buildNationalContext(input, trimmed),
    states: buildStateSummaries(input, mentioned),
    groups: buildGroupSummaries(input),
    activePolicies: buildActivePolicyContexts(input.activePolicies),
    activeCrises: buildCrises(input),
    history: buildHistoryContext(trimmed),
    availableQueries: AVAILABLE_QUERIES,
  };
}

// ============================================================
// HELPERS DE SAÍDA (opcional)
// ============================================================

/** Estimativa de tamanho em caracteres — útil pra log/telemetria. */
export function estimateContextSize(ctx: PolicyContext): number {
  return JSON.stringify(ctx).length;
}

/** Estados que a proposta mencionou, para debug. */
export function mentionedStates(ctx: PolicyContext): StateId[] {
  return ctx.states.filter((s) => s.highlighted).map((s) => s.id);
}
