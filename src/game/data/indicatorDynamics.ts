import type { StateId, StateStructural } from './states';

// ============================================================
// TIPOS
// ============================================================

export interface DriftContext {
  currentValue: number;
  stateId?: StateId;
  state?: StateStructural;
  /** Snapshot dos indicadores nacionais no início do turno. */
  national?: Record<string, number>;
}

export type DriftFn = (ctx: DriftContext) => number;

export interface IndicatorDynamics {
  /**
   * Delta mensal. Pode ser:
   *   - número fixo (absoluto)
   *   - função do contexto (permite proporcional, regional, etc.)
   *
   * Ausente = indicador não tem tendência natural própria.
   */
  drift?: number | DriftFn;

  /**
   * Reversão à média — DESATIVADA por padrão.
   * Só habilitar em indicadores com justificativa explícita.
   * Se baseline/reversion não estão definidos, é ignorada.
   */
  baseline?: number | ((stateId?: StateId) => number);
  reversion?: number;
}

// ============================================================
// HELPERS DE ESCRITA
// ============================================================

/** Drift absoluto constante. */
const A = (perMonth: number): DriftFn => () => perMonth;

/** Drift proporcional ao valor atual (composto mês a mês). */
const P = (pctPerMonth: number): DriftFn => ({ currentValue }) =>
  currentValue * pctPerMonth;

/** Drift absoluto que varia por estado. */
const S = (fn: (state?: StateStructural) => number): DriftFn =>
  ({ state }) => fn(state);

/** Drift proporcional + absoluto somados. */
// ============================================================
// CATÁLOGO DE DINÂMICAS
// ============================================================
// Valores calibrados para dar "gravidade" perceptível em 12–24 meses.
// Ajuste fino depois é trivial — só muda número aqui.

export const INDICATOR_DYNAMICS: Record<string, IndicatorDynamics> = {
  // ----------------------------------------------------------
  // MACROECONOMIA
  // ----------------------------------------------------------
  // Inércia inflacionária: +1,8% ao ano se nada for feito
  inflacao: { drift: A(+0.15) },
  // PIB nominal cresce com inflação + crescimento real
  pib_nominal: {
    drift: ({ national, currentValue }) => {
      const infl = (national?.inflacao ?? 4.5) / 100 / 12;
      const cresc = (national?.crescimento_pib ?? 2.0) / 100 / 12;
      return (infl + cresc) * currentValue;
    },
  },

  // Carga tributária é estável por natureza — só muda por medida
  carga_tributaria: { drift: A(0) },

  // Desalinhamento cambial natural: ~+4,3% ao ano
  cotacao_dolar: { drift: P(+0.0035) },

  // Dívida cresce com juros sobre juros: ~+4,9% ao ano
  divida_publica: { drift: P(+0.0040) },

  // Receitas crescem com PIB nominal: ~+3,7% ao ano
  receitas_publicas: { drift: P(+0.0030) },

  // Gastos crescem um pouco mais rápido (pressão estrutural): ~+4,3% ao ano
  gastos_publicos: { drift: P(+0.0035) },

  // Renda nominal acompanha inflação + produtividade: ~+1,8% ao ano
  renda_media: { drift: P(+0.0015) },

  // ----------------------------------------------------------
  // TRABALHO E RENDA
  // ----------------------------------------------------------
  // Poder de compra corroído se renda não acompanha inflação
  poder_compra: { drift: A(-0.10) },

  // ----------------------------------------------------------
  // INVESTIMENTO
  // ----------------------------------------------------------
  // Sem incentivo, investimento privado recua (depreciação, custo de capital)
  investimentos_privados: { drift: P(-0.0010) },

  // Investimento público sofre depreciação (obras param, equipamento envelhece)
  investimentos_publicos: { drift: P(-0.0015) },

  // ----------------------------------------------------------
  // SAÚDE
  // ----------------------------------------------------------
  // Demanda cresce mais rápido que oferta sem investimento
  acesso_saude: { drift: A(-0.10) },

  // Filas crescem ~3,6 dias por ano se nada for feito
  tempo_espera_saude: { drift: A(+0.30) },

  // Hospitais e equipamentos degradam lentamente
  capacidade_hospitais: { drift: A(-0.12) },

  // ----------------------------------------------------------
  // EDUCAÇÃO
  // ----------------------------------------------------------
  // Prédios, móveis, laboratórios degradam
  infraestrutura_escolar: { drift: A(-0.15) },

  // ----------------------------------------------------------
  // INFRAESTRUTURA
  // ----------------------------------------------------------
  // Estradas se deterioram sem manutenção
  qualidade_estradas: { drift: A(-0.20) },

  // ----------------------------------------------------------
  // AMBIENTE (drift regional)
  // ----------------------------------------------------------
  // Sem fiscalização, desmatamento avança.
  // Só estados com bioma relevante recebem drift.
  desmatamento: {
    drift: S((state) => {
      if (!state) return 0;
      switch (state.region) {
        case 'Norte': return 60;   // ~720 km²/ano
        case 'Centro-Oeste': return 30;   // ~360 km²/ano
        case 'Nordeste': return 4;
        case 'Sudeste': return 1;
        case 'Sul': return 1;
      }
    }),
  },
};

// ============================================================
// API
// ============================================================

export function hasDynamics(indicatorId: string): boolean {
  return indicatorId in INDICATOR_DYNAMICS;
}

export function getDynamics(indicatorId: string): IndicatorDynamics | undefined {
  return INDICATOR_DYNAMICS[indicatorId];
}

/**
 * Aplica a dinâmica natural de um indicador e devolve o delta mensal.
 * Não aplica reversão por padrão (reversion ausente).
 */
export function computeDrift(
  indicatorId: string,
  ctx: DriftContext,
): number {
  const dyn = INDICATOR_DYNAMICS[indicatorId];
  if (!dyn) return 0;

  let delta = 0;

  if (dyn.drift !== undefined) {
    delta += typeof dyn.drift === 'function' ? dyn.drift(ctx) : dyn.drift;
  }

  // Reversão — só roda se explicitamente configurada
  if (dyn.reversion !== undefined && dyn.baseline !== undefined) {
    const baseline =
      typeof dyn.baseline === 'function'
        ? dyn.baseline(ctx.stateId)
        : dyn.baseline;
    delta += (baseline - ctx.currentValue) * dyn.reversion;
  }

  return delta;
}
