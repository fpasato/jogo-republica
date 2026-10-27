// src/game/services/engine/trends.ts

import { getIndicator } from '../../data/indicators';
import { themeOf, type NewsTheme } from '../../data/newsThemes';
import { MACRO_BY_ID } from '../../data/macroIndicators';
import type { ContextSnapshot } from '../../types/ai';

// ============================================================
// TIPOS
// ============================================================

export type TrendDirection = 'subindo' | 'caindo' | 'estável';
export type TrendSeverity = 'melhorando' | 'estável' | 'piorando' | 'crítico';

export interface Trend {
  /** id do indicador ou macro. */
  indicatorId: string;
  /** Nome legível em português. */
  label: string;
  /** Unidade (%, R$, dias...). */
  unit: string;
  /** Valor atual. */
  value: number;
  /** Direção da série. */
  direction: TrendDirection;
  /** Quantos meses a série tem (janela olhada). */
  months: number;
  /** Variação total no período (último − primeiro). */
  totalDelta: number;
  /** Variação média por mês. */
  avgDelta: number;
  /** Classificação qualitativa. */
  severity: TrendSeverity;
  /** Tema de notícia (economy, security, health...). */
  category: NewsTheme;
  /** Variação percentual sobre o valor inicial (útil pra ordenar). */
  pctChange: number;
}

export interface TrendsOptions {
  /** Quantos meses olhar pra trás. Default: 6. */
  windowMonths?: number;
  /** Variação mínima pra considerar "tendência" e não ruído. */
  minPctChange?: number;
}

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_WINDOW = 6;

/**
 * Mudança mínima (em %) pra não ser considerado ruído.
 * Ex: 1,5% de variação total. Se o indicador está em 100, precisa
 * mexer pelo menos 1,5 unidades pra virar "tendência".
 */
const DEFAULT_MIN_PCT = 0.015;

/**
 * Indicadores que NÃO valem analisar tendência.
 * São valores que se movem sempre, sem significado narrativo.
 */
const IGNORED_IDS = new Set<string>([
  'pib_nominal',
  'receitas_publicas',
  'gastos_publicos',
  'empregos_formais',
  'familias_programas_sociais',
  'pessoas_rua',
  'emissoes_gee',
  'capacidade_geracao',
  'investimentos_concluidos',
  'irregularidades',
  'deficit_habitacional',
]);

// ============================================================
// API PRINCIPAL
// ============================================================

/**
 * Analisa o histórico e devolve tendências ordenadas por relevância.
 *
 * A janela usa os últimos `windowMonths` snapshots + o valor atual.
 * Se o histórico tiver menos snapshots que isso, usa o que tem.
 */
export function analyzeTrends(
  history: ContextSnapshot[],
  options: TrendsOptions = {},
): Trend[] {
  const windowMonths = options.windowMonths ?? DEFAULT_WINDOW;
  const minPct = options.minPctChange ?? DEFAULT_MIN_PCT;

  // Precisa de pelo menos 3 pontos pra dizer que há tendência
  if (history.length < 3) return [];

  // Pega a janela (últimos N snapshots)
  const window = history.slice(-windowMonths);

  const trends: Trend[] = [];

  // ---------- Indicadores nacionais ----------
  const nationalIds = new Set<string>();
  for (const snap of window) {
    for (const id of Object.keys(snap.national)) nationalIds.add(id);
  }
  for (const id of nationalIds) {
    if (IGNORED_IDS.has(id)) continue;
    const trend = analyzeOne(id, window, 'national');
    if (trend && Math.abs(trend.pctChange) >= minPct) {
      trends.push(trend);
    }
  }

  // ---------- Macros ----------
  const macroIds = new Set<string>();
  for (const snap of window) {
    for (const id of Object.keys(snap.macros)) macroIds.add(id);
  }
  for (const id of macroIds) {
    if (IGNORED_IDS.has(id)) continue;
    const trend = analyzeOne(id, window, 'macro');
    if (trend && Math.abs(trend.pctChange) >= minPct) {
      trends.push(trend);
    }
  }

  // ---------- Ordena por relevância ----------
  trends.sort((a, b) => scoreOf(b) - scoreOf(a));

  return trends;
}

// ============================================================
// ANÁLISE DE UM INDICADOR
// ============================================================

type Origin = 'national' | 'macro';

function analyzeOne(
  id: string,
  window: ContextSnapshot[],
  origin: Origin,
): Trend | null {
  // ---------- Metadados ----------
  const meta = lookupMeta(id, origin);
  if (!meta) return null;

  // ---------- Série ----------
  const series: number[] = [];
  for (const snap of window) {
    const v =
      origin === 'national' ? snap.national[id] : snap.macros[id];
    if (typeof v === 'number') series.push(v);
  }
  if (series.length < 3) return null;

  // ---------- Direção + variação ----------
  const first = series[0];
  const last = series[series.length - 1];
  const totalDelta = last - first;
  const avgDelta = totalDelta / (series.length - 1);
  const pctChange = first === 0 ? 0 : totalDelta / Math.abs(first);

  const direction = directionOf(totalDelta, first);

  // ---------- Severidade ----------
  const severity = severityOf(meta.direction, direction, pctChange);

  return {
    indicatorId: id,
    label: meta.label,
    unit: meta.unit,
    value: last,
    direction,
    months: series.length,
    totalDelta,
    avgDelta,
    severity,
    category: meta.theme,
    pctChange,
  };
}

// ============================================================
// METADADOS (nome, unidade, direção, tema)
// ============================================================

interface IndicatorMeta {
  label: string;
  unit: string;
  /** Se subir é bom ('higher_is_better'), ruim ('lower_is_better') ou indiferente. */
  direction: 'higher_is_better' | 'lower_is_better' | 'neutral';
  theme: NewsTheme;
}

function lookupMeta(id: string, origin: Origin): IndicatorMeta | null {
  // Macro
  if (origin === 'macro') {
    const macro = MACRO_BY_ID[id];
    if (!macro) return null;
    return {
      label: macro.name,
      unit: macro.unit,
      direction: 'neutral',
      theme: themeOf(id),
    };
  }

  // Indicador detalhado
  try {
    const ind = getIndicator(id);
    return {
      label: ind.nome,
      unit: ind.unidade,
      direction: ind.direction,
      theme: themeOf(id),
    };
  } catch {
    return null;
  }
}

// ============================================================
// CLASSIFICAÇÕES
// ============================================================

function directionOf(
  totalDelta: number,
  first: number,
): TrendDirection {
  const tolerance = Math.max(Math.abs(first) * 0.001, 0.0001);
  if (Math.abs(totalDelta) <= tolerance) return 'estável';
  return totalDelta > 0 ? 'subindo' : 'caindo';
}

/**
 * Combina direção do indicador + direção da série + magnitude
 * pra decidir se a tendência é boa ou ruim.
 */
function severityOf(
  indicatorDirection: IndicatorMeta['direction'],
  trendDirection: TrendDirection,
  pctChange: number,
): TrendSeverity {
  if (trendDirection === 'estável') return 'estável';
  if (indicatorDirection === 'neutral') return 'estável';

  const subiu = trendDirection === 'subindo';
  const bom =
    indicatorDirection === 'higher_is_better' ? subiu : !subiu;

  const pct = Math.abs(pctChange);
  const critico = pct >= 0.15; // 15% = crítico

  if (bom) return 'melhorando';
  if (critico) return 'crítico';
  return 'piorando';
}

/**
 * Pontuação pra ordenar. Quanto maior, mais importante a notícia.
 * Dá peso extra pra tendências críticas e longas.
 */
function scoreOf(t: Trend): number {
  const severityWeight: Record<TrendSeverity, number> = {
    crítico: 4,
    piorando: 3,
    melhorando: 2,
    estável: 1,
  };
  const mag = Math.min(2, Math.abs(t.pctChange) * 10); // 0..2
  const duration = Math.min(1.5, t.months / 6);        // 0..1.5
  return severityWeight[t.severity] * mag * duration;
}
