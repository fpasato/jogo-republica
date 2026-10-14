// src/hooks/useIndicatorRows.ts
// Constrói linhas prontas pra tabela de indicadores, já com:
//   - valor (nacional, estadual ou agregado dos estados)
//   - delta em relação ao mês anterior
//   - trend (últimos 3 pontos)
//
// A agregação de estados é delegada ao motor (aggregateAll em services/engine/aggregation).

import type {
  IndicatorCategory,
  IndicatorDef,
  IndicatorDirection,
} from '../game/data/indicators';
import { INDICATORS } from '../game/data/indicators';
import type { StateId } from '../game/data/states';
import { STATE_IDS } from '../game/data/states';
import type { ContextSnapshot } from '../game/types/ai';

// ============================================================
// TIPOS PÚBLICOS
// ============================================================

export interface Row {
  def: IndicatorDef;
  valor: number;
  delta: number | null;
  trend: 'subindo' | 'caindo' | 'estável' | null;
  extra?: string;
}

export type Scope = 'nacional' | 'estadual';

export interface BuildRowsOptions {
  scope: Scope;
  /** Filtra por categoria. 'todas' ou ausente = sem filtro. */
  area?: IndicatorCategory | 'todas';

  /** Estado-alvo (obrigatório quando scope='estadual'). */
  stateId?: StateId;

  /**
   * Valores atuais. Quando scope='nacional', use `nationalIndicators`.
   * Quando scope='estadual', passe o mapa do estado.
   */
  values: Record<string, number>;

  /** Valores do mês anterior (mesma origem de `values`). */
  valuesAnterior?: Record<string, number>;

  /**
   * Histórico nacional (dos snapshots). Quando scope='nacional',
   * cada snapshot usa `snap.national`. Quando scope='estadual',
   * cada snapshot usa o valor do estado-alvo (se disponível).
   */
  history?: ContextSnapshot[];

  /** Hook pra injetar coluna "extra" (ex: "Soma dos estados"). */
  extra?: (def: IndicatorDef) => string | undefined;

  /**
   * Mapa opcional de agregados nacionais já calculados pelo motor.
   * Quando presente, o hook NÃO recalcula — usa direto.
   * Chave: id do indicador. Valor: número.
   */
  aggregates?: Record<string, number>;
}

// ============================================================
// HELPERS
// ============================================================

/** Indicador tem valor no escopo pedido? */
function matchesScope(def: IndicatorDef, scope: Scope): boolean {
  if (scope === 'nacional') {
    return (
      def.scope === 'national' ||
      def.scope === 'state_aggregated' ||
      def.scope === 'national_and_state'
    );
  }
  // estadual
  return (
    def.scope === 'state' ||
    def.scope === 'state_aggregated' ||
    def.scope === 'national_and_state'
  );
}

/** Série do indicador num snapshot, no escopo certo. */
function seriesValue(
  snap: ContextSnapshot,
  def: IndicatorDef,
  scope: Scope,
  stateId: StateId | undefined,
): number | undefined {
  if (scope === 'nacional') {
    // Preferência: valor nacional (detalhado). Cai pro macro se não achar.
    const v = snap.national[def.id];
    if (typeof v === 'number') return v;
    return snap.macros[def.id];
  }
  // Estadual: snapshots só guardam aprovação nacional e nacional de indicadores.
  // Para série estadual, o snapshot não tem — devolvemos undefined.
  // (Séries estaduais exigiriam snapshots maiores; ver observação abaixo.)
  void stateId;
  return undefined;
}

function computeTrend(
  def: IndicatorDef,
  values: number[],
): Row['trend'] {
  if (values.length < 3) return null;
  const first = values[values.length - 3];
  const last = values[values.length - 1];
  const tolerance = Math.max(
    (def.max - def.min) * 0.0001,
    Math.abs(last) * 0.001,
    0.0001,
  );
  if (Math.abs(last - first) <= tolerance) return 'estável';
  return last > first ? 'subindo' : 'caindo';
}

// ============================================================
// BUILD
// ============================================================

export function buildRows(opts: BuildRowsOptions): Row[] {
  const {
    scope,
    area,
    stateId,
    values,
    valuesAnterior,
    history,
    extra,
    aggregates,
  } = opts;

  const rows: Row[] = [];

  for (const def of Object.values(INDICATORS)) {
    if (!matchesScope(def, scope)) continue;
    if (area && area !== 'todas' && def.category !== area) continue;

    // ---------- Valor atual ----------
    let valor: number | undefined;
    if (scope === 'nacional') {
      valor = aggregates?.[def.id] ?? values[def.id];
    } else {
      valor = values[def.id];
    }
    if (valor === undefined || !Number.isFinite(valor)) continue;

    // ---------- Valor anterior ----------
    const anterior = valuesAnterior?.[def.id];

    // ---------- Série pro trend ----------
    const series: number[] = [];
    if (history) {
      for (const snap of history) {
        const v = seriesValue(snap, def, scope, stateId);
        if (typeof v === 'number') series.push(v);
      }
    }
    series.push(valor);

    rows.push({
      def,
      valor,
      delta: anterior === undefined ? null : valor - anterior,
      trend: computeTrend(def, series),
      extra: extra?.(def),
    });
  }

  return rows;
}

// ============================================================
// VERIFICAÇÃO DE DIREÇÃO (usa o novo campo `direction`)
// ============================================================

/** Retorna true se subir é "bom" para esse indicador. */
export function isMelhoraSubindo(def: IndicatorDef): boolean | null {
  if (def.direction === 'higher_is_better') return true;
  if (def.direction === 'lower_is_better') return false;
  return null;
}