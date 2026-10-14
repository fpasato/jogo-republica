import { STATE_IDS, STATES, type StateId } from '../../data/states';
import {
  INDICATORS,
  getIndicator,
  classifyById,
} from '../../data/indicators';
import { GROUP_BY_ID, getGroup } from '../../data/groups';
import { MACRO_BY_ID } from '../../data/macroIndicators';
import { VALID_QUERY_TYPES } from '../../data/queryCatalog';
import type {
  QueryRequest,
  QueryResult,
  QueryResultOk,
  QueryResultError,
  ContextSnapshot,
} from '../../types/ai';
import type { ActivePolicy } from '../../types/policy';

// ============================================================
// CONSTANTES
// ============================================================

/** Máximo de consultas que a IA pode pedir por rodada. */
export const MAX_QUERIES_PER_ROUND = 8;

/** Máximo de meses de histórico que a IA pode pedir de uma vez. */
export const MAX_HISTORY_MONTHS = 12;

/** Máximo de estados numa comparação. */
export const MAX_COMPARE_STATES = 27;

// ============================================================
// ESTADO DE CONSULTA
// ============================================================
// O queryService é uma função pura: recebe tudo do turno atual.
// O caller (policyAI.ts) monta isso a partir do store.

export interface QueryState {
  month: number;
  stateIndicators: Record<StateId, Record<string, number>>;
  nationalIndicators: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  stateApprovals: Record<StateId, number>;
  activePolicies: ActivePolicy[];
  /** Snapshots anteriores ao mês atual, ordem cronológica. */
  history: ContextSnapshot[];
}

// ============================================================
// EXECUTOR PRINCIPAL
// ============================================================

export interface RunQueriesOutput {
  results: QueryResult[];
  executed: number;
  rejected: number;
}

/**
 * Executa as consultas pedidas pela IA contra o estado atual do jogo.
 * Nunca lança — retorna erros estruturados em QueryResultError.
 */
export function runQueries(
  requests: QueryRequest[],
  state: QueryState,
): RunQueriesOutput {
  const limited = requests.slice(0, MAX_QUERIES_PER_ROUND);
  const results: QueryResult[] = [];
  let executed = 0;
  let rejected = 0;

  for (const req of limited) {
    const result = executeOne(req, state);
    results.push(result);
    if (result.ok) executed++;
    else rejected++;
  }

  // Se a IA pediu mais que o limite, avisa
  if (requests.length > MAX_QUERIES_PER_ROUND) {
    results.push({
      ok: false,
      type: 'limit_exceeded',
      error: `Você pediu ${requests.length} consultas, mas o limite é ${MAX_QUERIES_PER_ROUND} por rodada. As primeiras ${MAX_QUERIES_PER_ROUND} foram processadas.`,
    });
    rejected++;
  }

  return { results, executed, rejected };
}

// ============================================================
// DESPACHO
// ============================================================

function executeOne(req: QueryRequest, state: QueryState): QueryResult {
  if (!req || typeof req.type !== 'string') {
    return error('unknown', 'Requisição sem campo "type" válido.');
  }

  if (!VALID_QUERY_TYPES.has(req.type)) {
    return error(
      req.type,
      `Tipo de consulta "${req.type}" não existe.`,
      Array.from(VALID_QUERY_TYPES),
    );
  }

  switch (req.type) {
    case 'national_indicators':
      return queryNationalIndicators(req, state);
    case 'state_indicators':
      return queryStateIndicators(req, state);
    case 'compare_states':
      return queryCompareStates(req, state);
    case 'indicator_history':
      return queryIndicatorHistory(req, state);
    case 'group_details':
      return queryGroupDetails(req, state);
    case 'active_policies':
      return queryActivePolicies(state);
    default:
      return error(req.type, `Consulta "${req.type}" não implementada.`);
  }
}

// ============================================================
// national_indicators
// ============================================================

function queryNationalIndicators(
  req: QueryRequest,
  state: QueryState,
): QueryResult {
  const ids = Array.isArray((req as any).ids) ? ((req as any).ids as string[]) : null;
  if (!ids || ids.length === 0) {
    return error('national_indicators', 'Campo "ids" obrigatório (array de strings).');
  }

  const found: Array<{
    id: string;
    label: string;
    unit: string;
    value: number;
    classification: string;
    direction: string;
  }> = [];
  const missing: string[] = [];

  for (const id of ids) {
    // Aceita indicador detalhado com valor nacional
    const ind = INDICATORS[id];
    if (
      ind &&
      (ind.scope === 'national' ||
        ind.scope === 'state_aggregated' ||
        ind.scope === 'national_and_state')
    ) {
      const value = state.nationalIndicators[id];
      if (typeof value === 'number') {
        found.push({
          id,
          label: ind.name,
          unit: ind.unit,
          value,
          classification: classifyById(id, value),
          direction: ind.direction,
        });
        continue;
      }
    }

    // Aceita macro do catalog.ts
    const macro = MACRO_BY_ID[id];
    if (macro) {
      const value = state.macros[id];
      if (typeof value === 'number') {
        found.push({
          id,
          label: macro.nome,
          unit: macro.unidade,
          value,
          classification: '—',
          direction:
            macro.melhorQuando === 'subir'
              ? 'higher_is_better'
              : 'lower_is_better',
        });
        continue;
      }
    }

    missing.push(id);
  }

  return ok('national_indicators', {
    values: found,
    missing,
    note: missing.length
      ? `Indicadores não encontrados: ${missing.join(', ')}.`
      : undefined,
  });
}

// ============================================================
// state_indicators
// ============================================================

function queryStateIndicators(
  req: QueryRequest,
  state: QueryState,
): QueryResult {
  const sid = (req as any).state as string;
  const ids = (req as any).ids as string[] | undefined;

  if (!sid || !STATE_IDS.includes(sid as StateId)) {
    return error('state_indicators', `Estado "${sid}" inválido.`, STATE_IDS);
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return error('state_indicators', 'Campo "ids" obrigatório (array de strings).');
  }

  const stateValues = state.stateIndicators[sid as StateId] ?? {};
  const found: Array<{
    id: string;
    label: string;
    unit: string;
    value: number;
    classification: string;
    direction: string;
  }> = [];
  const missing: string[] = [];

  for (const id of ids) {
    const ind = INDICATORS[id];
    if (!ind) {
      missing.push(id);
      continue;
    }
    // Só aceita indicadores que existem no plano estadual
    if (
      ind.scope !== 'state' &&
      ind.scope !== 'state_aggregated' &&
      ind.scope !== 'national_and_state'
    ) {
      missing.push(id);
      continue;
    }
    const value = stateValues[id];
    if (typeof value !== 'number') {
      missing.push(id);
      continue;
    }
    found.push({
      id,
      label: ind.name,
      unit: ind.unit,
      value,
      classification: classifyById(id, value),
      direction: ind.direction,
    });
  }

  return ok('state_indicators', {
    state: sid,
    stateName: STATES[sid as StateId].name,
    values: found,
    missing,
  });
}

// ============================================================
// compare_states
// ============================================================

function queryCompareStates(
  req: QueryRequest,
  state: QueryState,
): QueryResult {
  const indicatorId = (req as any).indicator as string;
  const requested = (req as any).states as string[] | undefined;

  if (!indicatorId || !INDICATORS[indicatorId]) {
    return error(
      'compare_states',
      `Indicador "${indicatorId}" não existe.`,
      Object.keys(INDICATORS).slice(0, 20),
    );
  }

  const ind = getIndicator(indicatorId);
  if (
    ind.scope !== 'state' &&
    ind.scope !== 'state_aggregated' &&
    ind.scope !== 'national_and_state'
  ) {
    return error(
      'compare_states',
      `Indicador "${indicatorId}" não tem valor por estado.`,
    );
  }

  const targets: StateId[] =
    requested && requested.length > 0
      ? (requested.filter((s) =>
          STATE_IDS.includes(s as StateId),
        ) as StateId[])
      : STATE_IDS;

  if (targets.length > MAX_COMPARE_STATES) {
    return error(
      'compare_states',
      `Máximo de ${MAX_COMPARE_STATES} estados por comparação.`,
    );
  }

  const rows = targets.map((sid) => {
    const value = state.stateIndicators[sid]?.[indicatorId];
    return {
      state: sid,
      name: STATES[sid].name,
      region: STATES[sid].region,
      value: typeof value === 'number' ? value : null,
      classification:
        typeof value === 'number' ? classifyById(indicatorId, value) : null,
    };
  });

  const present = rows
    .filter((r) => r.value !== null)
    .map((r) => r.value as number);

  const stats = present.length
    ? {
        min: Math.min(...present),
        max: Math.max(...present),
        mean: present.reduce((a, b) => a + b, 0) / present.length,
        national: state.nationalIndicators[indicatorId] ?? null,
      }
    : null;

  return ok('compare_states', {
    indicator: indicatorId,
    label: ind.name,
    unit: ind.unit,
    direction: ind.direction,
    rows,
    stats,
    subset: !requested || requested.length === 0 ? false : true,
  });
}

// ============================================================
// indicator_history
// ============================================================

function queryIndicatorHistory(
  req: QueryRequest,
  state: QueryState,
): QueryResult {
  const scope = ((req as any).scope as string) ?? 'national';
  const id = (req as any).id as string;
  const months = Math.max(
    1,
    Math.min(MAX_HISTORY_MONTHS, Number((req as any).months) || 6),
  );
  const sid = (req as any).state as string | undefined;

  if (!id) return error('indicator_history', 'Campo "id" obrigatório.');

  if (scope === 'state') {
    if (!sid || !STATE_IDS.includes(sid as StateId)) {
      return error('indicator_history', `Estado "${sid}" inválido.`, STATE_IDS);
    }
    const ind = INDICATORS[id];
    if (!ind) {
      return error('indicator_history', `Indicador "${id}" não existe.`);
    }

    return ok('indicator_history', {
      scope: 'state',
      state: sid,
      indicator: id,
      label: ind.name,
      unit: ind.unit,
      monthsRequested: months,
      monthsAvailable: 1,
      series: [state.stateIndicators[sid as StateId]?.[id] ?? null],
      note: 'Histórico detalhado de indicadores estaduais ainda não é armazenado. Apenas o valor atual está disponível.',
    });
  }

  // scope === 'national' (default)
  const ind = INDICATORS[id];
  const macro = MACRO_BY_ID[id];

  if (!ind && !macro) {
    return error('indicator_history', `Indicador "${id}" não existe.`);
  }

  const label = ind ? ind.name : macro!.nome;
  const unit = ind ? ind.unit : macro!.unidade;

  const series: number[] = [];
  const slice = state.history.slice(-months);

  if (ind) {
    for (const snap of slice) {
      const v = snap.national[id];
      if (typeof v === 'number') series.push(v);
    }
    const current = state.nationalIndicators[id];
    if (typeof current === 'number') series.push(current);
  } else {
    for (const snap of slice) {
      const v = snap.macros[id];
      if (typeof v === 'number') series.push(v);
    }
    const current = state.macros[id];
    if (typeof current === 'number') series.push(current);
  }

  return ok('indicator_history', {
    scope: 'national',
    indicator: id,
    label,
    unit,
    monthsRequested: months,
    monthsAvailable: series.length,
    series,
  });
}

// ============================================================
// group_details
// ============================================================

function queryGroupDetails(
  req: QueryRequest,
  state: QueryState,
): QueryResult {
  const id = (req as any).id as string;
  if (!id || !GROUP_BY_ID[id]) {
    return error(
      'group_details',
      `Grupo "${id}" não existe.`,
      Object.keys(GROUP_BY_ID),
    );
  }

  const g = getGroup(id);
  const approval = state.groupApprovals[id] ?? 50;

  return ok('group_details', {
    id: g.id,
    name: g.nome,
    weight: g.peso,
    combativeness: g.combatividade,
    lean: g.lean,
    axes: g.eixos,
    approval,
    reactionThreshold: g.limiarReacao,
    reaction: g.reacao
      ? {
          title: g.reacao.titulo,
          effect: g.reacao.efeito,
          monthly: g.reacao.mensal,
        }
      : null,
  });
}

// ============================================================
// active_policies
// ============================================================

function queryActivePolicies(state: QueryState): QueryResult {
  const rows = state.activePolicies.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    activeMonths: p.activeMonths,
    rampUpMonths: p.effectRampUpMonths,
    durationType: p.durationType,
    durationMonths: p.durationMonths,
    fiscalAnnual: p.fiscalAnnual,
    effects: p.effects,
    groupReactions: p.groupReactions,
  }));

  return ok('active_policies', {
    count: rows.length,
    policies: rows,
  });
}

// ============================================================
// HELPERS
// ============================================================

function ok(type: string, data: unknown): QueryResultOk {
  return { ok: true, type, data };
}

function error(
  type: string,
  message: string,
  suggestions?: string[],
): QueryResultError {
  return { ok: false, type, error: message, suggestions };
}