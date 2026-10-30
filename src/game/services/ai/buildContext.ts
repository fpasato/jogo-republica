import { GROUPS } from '../../data/groups';
import { MACRO_INDICATORS } from '../../data/macroIndicators';
import { AVAILABLE_QUERIES } from '../../data/queryCatalog';
import type { ActivePolicy } from '../../types/policy';
import type {
  PolicyContext,
  ContextInput,
  ContextSnapshot,
  GroupSummary,
  ActivePolicyContext,
  HistoryContext,
  NationalContext,
} from '../../types/ai';
import { INDICATORS } from '../../data/indicators';

const HISTORY_MONTHS = 6;

function computeTrend(series: number[]): 'subindo' | 'caindo' | 'estável' {
  if (series.length < 2) return 'estável';
  const first = series[0];
  const last = series[series.length - 1];
  const change = last - first;
  const threshold = Math.max(0.1, Math.abs(first) * 0.015);
  if (change > threshold) return 'subindo';
  if (change < -threshold) return 'caindo';
  return 'estável';
}

function buildNationalContext(
  input: ContextInput,
  history: ContextSnapshot[],
): NationalContext {
  const approvalSeries = history.map((s) => s.nationalApproval);

  return {
    month: input.month,
    approval: input.nationalApproval,
    approvalTrend: computeTrend(approvalSeries),
    indicators: input.nationalIndicators,
  };
}

function buildGroupSummaries(input: ContextInput): GroupSummary[] {
  return GROUPS.map((g) => ({
    id: g.id,
    name: g.nome,
    weight: g.peso,
    approval: input.groupApprovals[g.id] ?? g.initialApproval ?? 50,
    lean: g.lean,
  }));
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
    const affectedIndicators = Object.keys(p.effects);
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
      newIndicators: p.newIndicators ?? [],
      affectedGroups,
      fiscalAnnual: p.fiscalAnnual,
    };

    if (p.durationType === 'temporary' && p.durationMonths > 0) {
      ctx.monthsToExpire = Math.max(0, p.durationMonths - active);
    }

    return ctx;
  });
}

function buildHistoryContext(history: ContextSnapshot[]): HistoryContext {
  const indicators: Record<string, number[]> = {};
  const groupApprovals: Record<string, number[]> = {};

  for (const g of GROUPS) {
    groupApprovals[g.id] = history.map((s) => s.groupApprovals[g.id] ?? 50);
  }

  for (const m of MACRO_INDICATORS) {
    indicators[m.id] = history.map((s) => s.national[m.id] ?? m.initial);
  }

  return {
    months: history.length,
    indicators,
    groupApprovals,
    nationalApproval: history.map((s) => s.nationalApproval),
  };
}

export function buildContext(input: ContextInput): PolicyContext {
  const compactIds = new Set([
    'aprovacao_popular', 'crescimento_pib', 'inflacao', 'desemprego', 'divida_pib',
    'taxa_pobreza', 'gini', 'idh', 'homicidios', 'esperanca_vida',
    'ideb_ensino_medio', 'saldo_orcamentario', 'risco_pais', 'produtividade',
  ]);
  const proposal = input.proposal.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const categories: Array<[string, RegExp]> = [
    ['economia', /impost|tribut|inflac|preco|pib|emprego|salario|empresa|econom|juros|selic|cambio|dolar|arrecad|orcament|fiscal|gasto|divida/],
    ['saude', /saude|sus|hospital|medic|vacina|doenca|leito|mortalidade|enferm|upa/],
    ['educacao', /escol|alun|avali|aprendiz|professor|educa|estud|ideb|analfabet|creche|pisa/],
    ['social', /famil|benef|renda|pobre|moradia|habitac|assistencia|desigual|bolsa|gini|idh/],
    ['seguranca', /crime|criminal|polic|prisao|seguranca|violencia|homicid|justica|penal/],
    ['energia', /energia|eletric|renovavel|solar|eolic|tarifa|usina/],
    ['infraestrutura', /infraestrutura|rodovia|ferrovia|porto|saneamento|esgoto|transporte|agua|logistic/],
    ['meio_ambiente', /ambient|desmat|poluic|emisso|floresta|clima|reciclagem|amazonia|cerrado/],
    ['ciencia_tecnologia', /ciencia|tecnolog|pesquisa|inova|patente|startup|digital|internet/],
    ['administracao', /administra|burocracia|transparen|corrupcao|licitac|servidor|digitaliz/],
    ['cultura', /cultur|museu|arte|patrimonio|audiovisual|cinema|teatro|acervo/],
  ];
  const relevant = new Set(categories.filter(([, pattern]) => pattern.test(proposal)).map(([category]) => category));
  for (const indicator of INDICATORS) {
    if (relevant.has(indicator.category) && indicator.type === 'calculated') compactIds.add(indicator.id);
  }
  const compactIndicators = Object.fromEntries(
    Object.entries(input.nationalIndicators).filter(([id]) => compactIds.has(id)),
  );
  const currentSnapshot: ContextSnapshot = {
    month: input.month,
    national: compactIndicators,
    macros: input.macros,
    groupApprovals: input.groupApprovals,
    nationalApproval: input.nationalApproval,
  };

  const fullHistory = [...input.history, currentSnapshot];
  const trimmed = fullHistory.slice(-HISTORY_MONTHS);

  return {
    proposal: input.proposal,
    month: input.month,
    profile: input.profile,
    national: buildNationalContext({ ...input, nationalIndicators: compactIndicators }, trimmed),
    states: [],
    groups: buildGroupSummaries(input),
    activePolicies: buildActivePolicyContexts(input.activePolicies),
    activeCrises: [],
    history: buildHistoryContext(trimmed),
    availableQueries: AVAILABLE_QUERIES,
  };
}
