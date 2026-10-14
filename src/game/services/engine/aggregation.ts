import type {
  AggregationRule,
  AggregationWeight,
  IndicatorDef,
} from '../../data/indicators';
import {
  getIndicator,
  nationalDerivedIndicators,
} from '../../data/indicators';

import type { StateId, StateStructural } from '../../data/states';
import { STATES } from '../../data/states';


// ============================================================
// TIPOS
// ============================================================

/**
 * Valores estaduais de UM indicador: { SP: 12.5, RJ: 15.2, ... }
 * Só os estados presentes aqui entram no cálculo.
 */
export type StateValues = Partial<Record<StateId, number>>;

/**
 * Funções que retornam o "peso" de cada estado para um indicador.
 * O peso é sempre um número absoluto — o motor normaliza por soma.
 */
export type WeightFn = (state: StateStructural) => number;

// ============================================================
// PESOS
// ============================================================

/**
 * Peso por tipo. Cada indicador "state_aggregated" referencia um destes.
 * Se você adicionar um peso novo, adiciona aqui também.
 */
const WEIGHT_FNS: Record<AggregationWeight, WeightFn | null> = {
  population:        (s) => s.population,
  pea:               (s) => s.population * s.peaShare,
  target_population: (s) => s.population * targetShareFor(s),
  none:              null,
};

/**
 * Fração "alvo" — depende do indicador.
 * Aqui resolvemos por um fallback genérico; se um indicador específico
 * precisar de fração diferente (ex: só alunos do fundamental),
 * a função pode ser sobreposta num mapa mais abaixo.
 */
function targetShareFor(s: StateStructural): number {
  // Default: população em idade escolar obrigatória (4–17).
  // Cobre alfabetização, frequência, evasão, professores/aluno etc.
  return s.studentShare;
}

// ============================================================
// CÁLCULO
// ============================================================

function applyRule(
  rule: AggregationRule,
  values: StateValues,
  weightFn: WeightFn | null,
): number | null {
  const entries = Object.entries(values) as Array<[StateId, number]>;
  if (entries.length === 0) return null;

  switch (rule.kind) {
    case 'none':
      // Não deveria ser chamado — indicador nacional independente.
      return null;

    case 'sum':
      return entries.reduce((acc, [, v]) => acc + v, 0);

    case 'mean':
      return entries.reduce((acc, [, v]) => acc + v, 0) / entries.length;

    case 'weighted_mean': {
      if (!weightFn) return null;
      let num = 0;
      let den = 0;
      for (const [id, v] of entries) {
        const state = STATES[id];
        if (!state) continue;
        const w = weightFn(state);
        num += v * w;
        den += w;
      }
      if (den === 0) return null;
      return num / den;
    }
  }
}

function clampToCatalog(ind: IndicatorDef, value: number): number {
  return Math.max(ind.min, Math.min(ind.max, value));
}

// ============================================================
// API PRINCIPAL
// ============================================================

/**
 * Agrega UM indicador a partir dos valores estaduais.
 * Retorna null se o indicador não tem agregação ou se não há dados.
 */
export function aggregateIndicator(
  indicatorId: string,
  stateValues: StateValues,
): number | null {
  const ind = getIndicator(indicatorId);
  if (ind.scope !== 'state_aggregated') return null;
  if (!ind.aggregation) return null;

  const weightFn =
    ind.aggregation.kind === 'weighted_mean'
      ? WEIGHT_FNS[ind.aggregation.weight]
      : null;

  const raw = applyRule(ind.aggregation, stateValues, weightFn);
  if (raw === null) return null;
  return clampToCatalog(ind, raw);
}

/**
 * Recebe a estrutura completa dos estados e recalcula TODOS
 * os indicadores nacionais derivados de uma vez.
 *
 * `stateIndicators` é: { SP: { desemprego: 7.1, pobreza: 22, ... }, ... }
 */
export function aggregateAll(
  stateIndicators: Record<StateId, Record<string, number>>,
): Record<string, number> {
  const derived = nationalDerivedIndicators();
  const out: Record<string, number> = {};

  for (const ind of derived) {
    const stateValues: StateValues = {};
    for (const [stateId, values] of Object.entries(stateIndicators) as Array<
      [StateId, Record<string, number>]
    >) {
      const v = values[ind.id];
      if (typeof v === 'number' && Number.isFinite(v)) {
        stateValues[stateId] = v;
      }
    }

    const result = aggregateIndicator(ind.id, stateValues);
    if (result !== null) out[ind.id] = result;
  }

  return out;
}

// ============================================================
// HELPERS DE INSPEÇÃO
// ============================================================

/**
 * Detalha como cada estado contribuiu para o agregado.
 * Útil para UI, debug e para alimentar a IA com "por que o número subiu".
 */
export interface AggregationBreakdown {
  indicatorId: string;
  rule: AggregationRule;
  result: number;
  contributions: Array<{
    stateId: StateId;
    value: number;
    weight: number;
    /** Fração do peso total (0–1). Só faz sentido em weighted_mean. */
    weightShare: number;
  }>;
}

export function explainAggregation(
  indicatorId: string,
  stateValues: StateValues,
): AggregationBreakdown | null {
  const ind = getIndicator(indicatorId);
  if (ind.scope !== 'state_aggregated' || !ind.aggregation) return null;

  const entries = Object.entries(stateValues) as Array<[StateId, number]>;
  const weightFn =
    ind.aggregation.kind === 'weighted_mean'
      ? WEIGHT_FNS[ind.aggregation.weight]
      : null;

  // Calcula pesos
  const weights: Array<{ stateId: StateId; value: number; weight: number }> = [];
  let totalWeight = 0;
  for (const [id, v] of entries) {
    const w = weightFn ? weightFn(STATES[id]) : 1;
    weights.push({ stateId: id, value: v, weight: w });
    totalWeight += w;
  }

  const result = aggregateIndicator(indicatorId, stateValues);
  if (result === null) return null;

  return {
    indicatorId,
    rule: ind.aggregation,
    result,
    contributions: weights.map((w) => ({
      ...w,
      weightShare: totalWeight > 0 ? w.weight / totalWeight : 0,
    })),
  };
}