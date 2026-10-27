// src/game/services/ai/queryService.ts

import { INDICATORS_BY_ID, getIndicator } from '../../data/indicators';
import { GROUPS_BY_ID, getGroup } from '../../data/groups';
import { MACRO_BY_ID } from '../../data/macroIndicators';
import type {
  QueryRequest,
  QueryResult,
  QueryResultOk,
  QueryResultError,
  ContextSnapshot,
} from '../../types/ai';
import type { ActivePolicy } from '../../types/policy';

export const MAX_QUERIES_PER_ROUND = 8;
export const MAX_HISTORY_MONTHS = 12;

export interface QueryState {
  month: number;
  nationalIndicators: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  activePolicies: ActivePolicy[];
  history: ContextSnapshot[];
}

export interface RunQueriesOutput {
  results: QueryResult[];
  executed: number;
  rejected: number;
}

export function runQueries(
  queries: QueryRequest[],
  state: QueryState,
): RunQueriesOutput {
  const results: QueryResult[] = [];
  let executed = 0;
  let rejected = 0;

  const slice = queries.slice(0, MAX_QUERIES_PER_ROUND);

  for (const q of slice) {
    const res = executeQuery(q, state);
    results.push(res);
    if (res.ok) executed++;
    else rejected++;
  }

  return { results, executed, rejected };
}

function ok(type: string, data: unknown): QueryResultOk {
  return { ok: true, type, data };
}

function error(type: string, msg: string, suggestions?: string[]): QueryResultError {
  return { ok: false, type, error: msg, suggestions };
}

function executeQuery(req: QueryRequest, state: QueryState): QueryResult {
  switch (req.type) {
    case 'national_indicators':
      return queryNationalIndicators(req, state);
    case 'indicator_history':
      return queryIndicatorHistory(req, state);
    case 'group_details':
      return queryGroupDetails(req, state);
    case 'active_policies':
      return queryActivePolicies(state);
    default:
      return error(req.type, `Tipo de consulta desconhecido: "${req.type}".`);
  }
}

function queryNationalIndicators(req: QueryRequest, state: QueryState): QueryResult {
  const category = (req as any).category as string | undefined;
  const rows: Array<{ id: string; name: string; value: number; unit: string }> = [];

  for (const [id, value] of Object.entries(state.nationalIndicators)) {
    const ind = INDICATORS_BY_ID[id];
    if (!ind) continue;
    if (category && ind.category !== category) continue;
    rows.push({
      id,
      name: ind.nome,
      value,
      unit: ind.unidade,
    });
  }

  return ok('national_indicators', { rows });
}

function queryIndicatorHistory(req: QueryRequest, state: QueryState): QueryResult {
  const id = (req as any).id as string;
  const months = Math.max(1, Math.min(MAX_HISTORY_MONTHS, Number((req as any).months) || 6));

  if (!id) return error('indicator_history', 'Campo "id" obrigatório.');

  const ind = INDICATORS_BY_ID[id];
  const macro = MACRO_BY_ID[id];

  if (!ind && !macro) {
    return error('indicator_history', `Indicador "${id}" não existe.`);
  }

  const label = ind ? ind.nome : macro!.name;
  const unit = ind ? ind.unidade : macro!.unit;

  const series: number[] = [];
  const slice = state.history.slice(-months);

  for (const snap of slice) {
    const v = snap.national[id];
    if (typeof v === 'number') series.push(v);
  }
  const current = state.nationalIndicators[id];
  if (typeof current === 'number') series.push(current);

  return ok('indicator_history', {
    indicator: id,
    label,
    unit,
    monthsRequested: months,
    monthsAvailable: series.length,
    series,
  });
}

function queryGroupDetails(req: QueryRequest, state: QueryState): QueryResult {
  const id = (req as any).id as string;
  if (!id) return error('group_details', 'Campo "id" obrigatório.');

  const g = GROUPS_BY_ID[id];
  if (!g) {
    return error('group_details', `Grupo "${id}" não existe.`);
  }

  const approval = state.groupApprovals[id] ?? 50;

  return ok('group_details', {
    id: g.id,
    name: g.nome,
    category: g.categoria,
    description: g.descricao,
    influence: g.peso,
    combativeness: g.combatividade,
    lean: g.lean,
    approval,
  });
}

function queryActivePolicies(state: QueryState): QueryResult {
  const rows = state.activePolicies.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    activeMonths: p.activeMonths,
    fiscalAnnual: p.fiscalAnnual,
    effects: p.effects,
  }));

  return ok('active_policies', { count: rows.length, policies: rows });
}