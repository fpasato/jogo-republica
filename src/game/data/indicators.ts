// ============================================================
// TIPOS
// ============================================================

export type IndicatorCategory =
  | 'economia'
  | 'saude'
  | 'educacao'
  | 'seguranca'
  | 'infraestrutura'
  | 'social'
  | 'ambiente'
  | 'gestao'
  | 'politica';

/**
 * Onde o indicador existe e como é obtido.
 *
 * - national:            único valor nacional, independente (não vem dos estados)
 * - state:               só existe em estados, sem agregado nacional
 * - state_aggregated:    estados possuem valor, e existe um agregado nacional calculado
 * - national_and_state:  existe valor federal E valor em cada estado (são independentes)
 */
export type IndicatorScope =
  | 'national'
  | 'state'
  | 'state_aggregated'
  | 'national_and_state';

export type IndicatorDirection =
  | 'higher_is_better'
  | 'lower_is_better'
  | 'neutral';

/**
 * Peso usado na agregação nacional derivada.
 * Cada indicador escolhe o peso adequado ao seu significado.
 */
export type AggregationWeight =
  | 'population'         // população total
  | 'pea'                // população economicamente ativa
  | 'target_population'  // população-alvo do indicador (ex: crianças, alunos)
  | 'none';

export type AggregationRule =
  | { kind: 'none' }                                                // não agrega
  | { kind: 'sum' }                                                 // soma valores
  | { kind: 'mean' }                                                // média simples
  | { kind: 'weighted_mean'; weight: AggregationWeight };           // média ponderada

export interface IndicatorClassificationTier {
  label: string;
  /** Limite inferior (inclusive). null no primeiro tier. */
  from: number | null;
  /** Limite superior (exclusive). null no último tier. */
  to: number | null;
}


export interface IndicatorDef {
  id: string;
  name: string;
  short?: string;
  category: IndicatorCategory;
  scope: IndicatorScope;
  unit: string;
  direction: IndicatorDirection;
  min: number;
  max: number;
  /** Valor inicial do Brasil — obrigatório só pra escopo "national". */
  initial?: number;
  /** Regra de agregação nacional — obrigatório pra "state_aggregated". */
  aggregation?: AggregationRule;
  /** Faixas qualitativas (Muito ruim … Muito bom). Se ausente, o engine gera 5 tiers. */
  classification?: IndicatorClassificationTier[];
  description?: string;
}

/** Tipos usados pelo estado salvo e pelas telas legadas. */
export type IndicatorId = string;
export type IndicatorValues = Record<string, number>;
export type Area = IndicatorCategory;

// ============================================================
// HELPERS DE AGREGAÇÃO
// ============================================================

const AGG_NONE: AggregationRule = { kind: 'none' };
const AGG_SUM: AggregationRule = { kind: 'sum' };
const AGG_POP: AggregationRule = { kind: 'weighted_mean', weight: 'population' };
const AGG_PEA: AggregationRule = { kind: 'weighted_mean', weight: 'pea' };
const AGG_TARGET: AggregationRule = { kind: 'weighted_mean', weight: 'target_population' };

// ============================================================
// FÁBRICAS CURTAS
// ============================================================

// Nacional independente
const N = (
  id: string,
  name: string,
  unit: string,
  initial: number,
  min: number,
  max: number,
  direction: IndicatorDirection,
  opts: Partial<IndicatorDef> = {},
): IndicatorDef => ({
  id, name, unit, initial, min, max, direction,
  category: 'economia', scope: 'national',
  aggregation: AGG_NONE, ...opts,
});

// Estadual + agregado nacional (precisa de regra)
const SA = (
  id: string,
  name: string,
  unit: string,
  min: number,
  max: number,
  direction: IndicatorDirection,
  aggregation: AggregationRule,
  category: IndicatorCategory,
  opts: Partial<IndicatorDef> = {},
): IndicatorDef => ({
  id, name, unit, min, max, direction,
  category, scope: 'state_aggregated',
  aggregation, ...opts,
});

// Nacional + estadual (dois valores, sem agregação)
const NS = (
  id: string,
  name: string,
  unit: string,
  min: number,
  max: number,
  direction: IndicatorDirection,
  category: IndicatorCategory,
  initial?: number,
  opts: Partial<IndicatorDef> = {},
): IndicatorDef => ({
  id, name, unit, min, max, direction,
  category, scope: 'national_and_state',
  aggregation: AGG_NONE, initial, ...opts,
});

// ============================================================
// 1. ECONOMIA
// ============================================================

const ECONOMIA: IndicatorDef[] = [
  N('inflacao', 'Inflação', '% ao ano', 4.5, -10, 100, 'lower_is_better', { category: 'economia' }),
  SA('desemprego', 'Desemprego', '%', 0, 40, 'lower_is_better', AGG_PEA, 'economia'),
  SA('crescimento_pib', 'Crescimento do PIB', '% ao ano', -15, 15, 'higher_is_better', AGG_POP, 'economia'),
  N('pib_nominal', 'PIB nominal', 'R$ bilhões', 11000, 500, 50000, 'higher_is_better', { category: 'economia' }),
  N('divida_publica', 'Dívida pública', 'R$ bilhões', 7800, 0, 30000, 'lower_is_better', { category: 'economia', description: 'Armazenada em R$ bilhões. % do PIB é calculada à parte.' }),
  N('carga_tributaria', 'Carga tributária', '% do PIB', 33, 15, 60, 'lower_is_better', { category: 'economia' }),
  NS('receitas_publicas', 'Receitas públicas', 'R$ bilhões', 0, 20000, 'higher_is_better', 'economia'),
  NS('gastos_publicos', 'Gastos públicos', 'R$ bilhões', 0, 20000, 'neutral', 'economia'),
  NS('saldo_orcamentario', 'Saldo orçamentário', 'R$ bilhões', -3000, 3000, 'higher_is_better', 'economia'),
  N('cotacao_dolar', 'Cotação do dólar', 'R$/US$', 5.20, 0.5, 30, 'neutral', { category: 'economia' }),
  N('selic', 'Taxa Selic', '% ao ano', 10.5, 0, 60, 'neutral', { category: 'economia' }),
  N('salario_minimo', 'Salário mínimo', 'R$', 1412, 0, 20000, 'higher_is_better', { category: 'economia' }),
  SA('poder_compra', 'Poder de compra', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'economia'),
  SA('empregos_formais', 'Empregos formais', 'empregos', 0, 200_000_000, 'higher_is_better', AGG_SUM, 'economia'),
  SA('informalidade', 'Informalidade', '% dos ocupados', 0, 100, 'lower_is_better', AGG_PEA, 'economia'),
  NS('investimentos_publicos', 'Investimentos públicos', 'R$ bilhões', 0, 5000, 'higher_is_better', 'economia'),
  SA('investimentos_privados', 'Investimentos privados', 'R$ bilhões', 0, 20000, 'higher_is_better', AGG_SUM, 'economia'),
  N('balanca_comercial', 'Balança comercial', 'R$ bilhões', 80, -500, 500, 'higher_is_better', { category: 'economia' }),
  NS('orcamento_saude', 'Orçamento da saúde', 'R$ bilhões', 0, 3000, 'higher_is_better', 'economia'),
  NS('orcamento_educacao', 'Orçamento da educação', 'R$ bilhões', 0, 3000, 'higher_is_better', 'economia'),
];

// ============================================================
// 2. SAÚDE
// ============================================================

const SAUDE: IndicatorDef[] = [
  SA('acesso_saude', 'Acesso à saúde', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'saude'),
  SA('tempo_espera_saude', 'Tempo de espera na saúde', 'dias', 0, 365, 'lower_is_better', AGG_POP, 'saude'),
  SA('cobertura_vacinacao', 'Cobertura vacinal', '%', 0, 100, 'higher_is_better', AGG_TARGET, 'saude'),
  SA('medicos_por_habitante', 'Médicos por habitante', 'por 1.000 hab.', 0, 20, 'higher_is_better', AGG_POP, 'saude'),
  SA('capacidade_hospitais', 'Capacidade dos hospitais', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'saude'),
  SA('ocupacao_hospitais', 'Ocupação dos hospitais', '%', 0, 100, 'lower_is_better', AGG_POP, 'saude'),
  SA('mortalidade_infantil', 'Mortalidade infantil', 'por 1.000 nascidos', 0, 80, 'lower_is_better', AGG_POP, 'saude'),
  SA('mortalidade_materna', 'Mortalidade materna', 'por 100.000 nascidos', 0, 400, 'lower_is_better', AGG_POP, 'saude'),
  SA('satisfacao_saude', 'Satisfação com a saúde', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'saude'),
];

// ============================================================
// 3. EDUCAÇÃO
// ============================================================

const EDUCACAO: IndicatorDef[] = [
  SA('frequencia_escolar', 'Frequência escolar', '%', 0, 100, 'higher_is_better', AGG_TARGET, 'educacao'),
  SA('evasao_escolar', 'Evasão escolar', '%', 0, 100, 'lower_is_better', AGG_TARGET, 'educacao'),
  SA('conclusao_medio', 'Conclusão do ensino médio', '%', 0, 100, 'higher_is_better', AGG_TARGET, 'educacao'),
  SA('alfabetizacao', 'Alfabetização', '%', 0, 100, 'higher_is_better', AGG_POP, 'educacao'),
  SA('analfabetismo', 'Analfabetismo', '%', 0, 100, 'lower_is_better', AGG_POP, 'educacao'),
  SA('infraestrutura_escolar', 'Infraestrutura escolar', '0–100', 0, 100, 'higher_is_better', AGG_TARGET, 'educacao'),
  SA('acesso_educacao_infantil', 'Acesso à educação infantil', '%', 0, 100, 'higher_is_better', AGG_TARGET, 'educacao'),
  SA('professores_por_aluno', 'Professores por aluno', 'alunos por professor', 0, 80, 'lower_is_better', AGG_TARGET, 'educacao'),
];

// ============================================================
// 4. SEGURANÇA PÚBLICA
// ============================================================

const SEGURANCA: IndicatorDef[] = [
  SA('homicidios', 'Taxa de homicídios', 'por 100.000 hab.', 0, 200, 'lower_is_better', AGG_POP, 'seguranca'),
  SA('roubos', 'Taxa de roubos', 'por 100.000 hab.', 0, 2000, 'lower_is_better', AGG_POP, 'seguranca'),
  SA('furtos', 'Taxa de furtos', 'por 100.000 hab.', 0, 3000, 'lower_is_better', AGG_POP, 'seguranca'),
  SA('investigacao_policial', 'Capacidade de investigação', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'seguranca'),
  SA('crimes_solucionados', 'Crimes solucionados', '%', 0, 100, 'higher_is_better', AGG_POP, 'seguranca'),
  SA('efetivo_policial', 'Efetivo policial', 'por 100.000 hab.', 0, 1500, 'higher_is_better', AGG_POP, 'seguranca'),
  SA('tempo_resposta_policial', 'Tempo de resposta policial', 'minutos', 0, 240, 'lower_is_better', AGG_POP, 'seguranca'),
  SA('capacidade_prisional', 'Capacidade do sistema prisional', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'seguranca'),
  SA('percepcao_seguranca', 'Percepção de segurança', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'seguranca'),
];

// ============================================================
// 5. INFRAESTRUTURA E SANEAMENTO
// ============================================================

const INFRAESTRUTURA: IndicatorDef[] = [
  SA('acesso_agua', 'Acesso à água tratada', '%', 0, 100, 'higher_is_better', AGG_POP, 'infraestrutura'),
  SA('coleta_esgoto', 'Coleta de esgoto', '%', 0, 100, 'higher_is_better', AGG_POP, 'infraestrutura'),
  SA('tratamento_esgoto', 'Tratamento de esgoto', '%', 0, 100, 'higher_is_better', AGG_POP, 'infraestrutura'),
  SA('qualidade_estradas', 'Qualidade das estradas', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'infraestrutura'),
  SA('acesso_internet', 'Acesso à internet', '% domicílios', 0, 100, 'higher_is_better', AGG_POP, 'infraestrutura'),
  SA('deficit_habitacional', 'Déficit habitacional', 'domicílios', 0, 20_000_000, 'lower_is_better', AGG_SUM, 'infraestrutura'),
  NS('investimento_infraestrutura', 'Investimento em infraestrutura', 'R$ bilhões', 0, 2000, 'higher_is_better', 'infraestrutura'),
  SA('qualidade_transporte', 'Qualidade do transporte público', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'infraestrutura'),
  SA('tempo_deslocamento', 'Tempo médio de deslocamento', 'min/trajeto', 0, 180, 'lower_is_better', AGG_POP, 'infraestrutura'),
];

// ============================================================
// 6. ASSISTÊNCIA SOCIAL E DESIGUALDADE
// ============================================================

const SOCIAL: IndicatorDef[] = [
  SA('idh', 'IDH (simulado)', '0–1', 0, 1, 'higher_is_better', AGG_POP, 'social', {
    description: 'Índice de desenvolvimento humano do jogo, estimado por saúde, educação e renda; não é o cálculo oficial do IDH.',
  }),
  SA('pobreza', 'Taxa de pobreza', '%', 0, 100, 'lower_is_better', AGG_POP, 'social'),
  SA('pobreza_extrema', 'Pobreza extrema', '%', 0, 100, 'lower_is_better', AGG_POP, 'social'),
  SA('gini', 'Desigualdade (Gini)', '0–1', 0, 1, 'lower_is_better', AGG_POP, 'social'),
  SA('renda_media', 'Renda média das famílias', 'R$/mês', 0, 30000, 'higher_is_better', AGG_POP, 'social'),
  SA('familias_programas_sociais', 'Famílias em programas sociais', 'famílias', 0, 100_000_000, 'higher_is_better', AGG_SUM, 'social'),
  SA('pessoas_rua', 'Pessoas em situação de rua', 'pessoas', 0, 2_000_000, 'lower_is_better', AGG_SUM, 'social'),
  SA('moradia_adequada', 'Acesso à moradia adequada', '%', 0, 100, 'higher_is_better', AGG_POP, 'social'),
  SA('desemprego_jovem', 'Desemprego entre jovens', '%', 0, 60, 'lower_is_better', AGG_PEA, 'social'),
];

// ============================================================
// 7. MEIO AMBIENTE E ENERGIA
// ============================================================

const AMBIENTE: IndicatorDef[] = [
  SA('desmatamento', 'Desmatamento', 'km²/ano', 0, 50000, 'lower_is_better', AGG_SUM, 'ambiente'),
  SA('qualidade_ar', 'Qualidade do ar', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'ambiente'),
  SA('qualidade_agua', 'Qualidade da água', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'ambiente'),
  SA('emissoes_gee', 'Emissões de GEE', 'tCO₂e/ano', 0, 5_000_000_000, 'lower_is_better', AGG_SUM, 'ambiente'),
  SA('renovaveis_energia', 'Participação renovável', '%', 0, 100, 'higher_is_better', AGG_POP, 'ambiente'),
  SA('capacidade_geracao', 'Capacidade de geração', 'MW', 0, 500_000, 'higher_is_better', AGG_SUM, 'ambiente'),
  SA('custo_energia', 'Custo da energia', 'R$/kWh', 0, 5, 'lower_is_better', AGG_POP, 'ambiente'),
  SA('reciclagem', 'Coleta e reciclagem', '%', 0, 100, 'higher_is_better', AGG_POP, 'ambiente'),
  SA('areas_protegidas', 'Áreas protegidas', '% do território', 0, 100, 'higher_is_better', AGG_POP, 'ambiente'),
];

// ============================================================
// 8. GESTÃO PÚBLICA
// ============================================================

const GESTAO: IndicatorDef[] = [
  NS('eficiencia_gastos', 'Eficiência dos gastos públicos', '0–100', 0, 100, 'higher_is_better', 'gestao', 50),
  NS('execucao_orcamento', 'Execução do orçamento', '%', 0, 100, 'higher_is_better', 'gestao', 85),
  NS('investimentos_concluidos', 'Investimentos concluídos', 'projetos', 0, 100_000, 'higher_is_better', 'gestao'),
  NS('qualidade_servicos', 'Qualidade dos serviços públicos', '0–100', 0, 100, 'higher_is_better', 'gestao', 50),
  NS('tempo_espera_servicos', 'Tempo de espera por serviços', 'dias', 0, 365, 'lower_is_better', 'gestao', 30),
  NS('capacidade_administrativa', 'Capacidade administrativa', '0–100', 0, 100, 'higher_is_better', 'gestao', 50),
  NS('transparencia', 'Transparência pública', '0–100', 0, 100, 'higher_is_better', 'gestao', 60),
  NS('irregularidades', 'Irregularidades identificadas', 'casos', 0, 100000, 'lower_is_better', 'gestao'),
  NS('eficiencia_arrecadacao', 'Eficiência na arrecadação', '%', 0, 100, 'higher_is_better', 'gestao', 70),
];

// ============================================================
// 9. POLÍTICA E OPINIÃO PÚBLICA
// ============================================================

const POLITICA: IndicatorDef[] = [
  N('apoio_camara', 'Apoio na Câmara', '%', 40, 0, 100, 'higher_is_better', { category: 'politica' }),
  N('apoio_senado', 'Apoio no Senado', '%', 40, 0, 100, 'higher_is_better', { category: 'politica' }),
  N('confianca_instituicoes', 'Confiança nas instituições', '0–100', 50, 0, 100, 'higher_is_better', { category: 'politica' }),
  SA('satisfacao_servicos', 'Satisfação com serviços públicos', '0–100', 0, 100, 'higher_is_better', AGG_POP, 'politica'),
  // 'apoio_por_regiao' é derivado — não armazenado aqui.
];

// ============================================================
// CATÁLOGO CONSOLIDADO
// ============================================================

const ALL: IndicatorDef[] = [
  ...ECONOMIA,
  ...SAUDE,
  ...EDUCACAO,
  ...SEGURANCA,
  ...INFRAESTRUTURA,
  ...SOCIAL,
  ...AMBIENTE,
  ...GESTAO,
  ...POLITICA,
];

export const INDICATORS: Record<string, IndicatorDef> = Object.fromEntries(
  ALL.map((i) => [i.id, i]),
);

export const INDICATOR_IDS = ALL.map((i) => i.id);

// ============================================================
// HELPERS
// ============================================================

export function getIndicator(id: string): IndicatorDef {
  const ind = INDICATORS[id];
  if (!ind) throw new Error(`Indicador desconhecido: ${id}`);
  return ind;
}

export function hasIndicator(id: string): boolean {
  return id in INDICATORS;
}

export function indicatorsByCategory(cat: IndicatorCategory): IndicatorDef[] {
  return ALL.filter((i) => i.category === cat);
}

export function isNationalIndependent(i: IndicatorDef): boolean {
  return i.scope === 'national';
}

export function isStateAggregated(i: IndicatorDef): boolean {
  return i.scope === 'state_aggregated';
}

export function isNationalAndState(i: IndicatorDef): boolean {
  return i.scope === 'national_and_state';
}

export function isStateOnly(i: IndicatorDef): boolean {
  return i.scope === 'state';
}

/** Indicadores que existem por estado (todos os escopos que têm valor estadual). */
export function stateScopedIndicators(): IndicatorDef[] {
  return ALL.filter(
    (i) => i.scope === 'state' || i.scope === 'state_aggregated' || i.scope === 'national_and_state',
  );
}

/** Indicadores com valor nacional independente armazenado. */
export function nationalIndependentIndicators(): IndicatorDef[] {
  return ALL.filter((i) => i.scope === 'national');
}

/** Indicadores cujo valor nacional é calculado a partir dos estados. */
export function nationalDerivedIndicators(): IndicatorDef[] {
  return ALL.filter((i) => i.scope === 'state_aggregated');
}

// ============================================================
// CLASSIFICAÇÃO QUALITATIVA
// ============================================================

/** Labels padrão para escalas "quanto maior, melhor". */
const TIERS_HIGHER_IS_BETTER = [
  'Muito ruim',
  'Ruim',
  'Regular',
  'Bom',
  'Muito bom',
] as const;

/** Labels padrão para escalas "quanto menor, melhor". */
const TIERS_LOWER_IS_BETTER = [
  'Muito bom',
  'Bom',
  'Regular',
  'Ruim',
  'Muito ruim',
] as const;

/** Labels neutros — usados quando o indicador não tem direção valorativa. */
const TIERS_NEUTRAL = [
  'Muito baixo',
  'Baixo',
  'Médio',
  'Alto',
  'Muito alto',
] as const;

const TIER_COUNT = 5;

function labelsFor(direction: IndicatorDirection): readonly string[] {
  switch (direction) {
    case 'higher_is_better': return TIERS_HIGHER_IS_BETTER;
    case 'lower_is_better': return TIERS_LOWER_IS_BETTER;
    case 'neutral': return TIERS_NEUTRAL;
  }
}

/**
 * Retorna as faixas de classificação do indicador.
 * Se o indicador já traz `classification`, usa. Caso contrário, gera 5 faixas
 * iguais no intervalo [min, max], com os rótulos invertidos conforme a direção.
 */
export function generateClassification(ind: IndicatorDef): IndicatorClassificationTier[] {
  if (ind.classification && ind.classification.length > 0) {
    return ind.classification;
  }

  const labels = labelsFor(ind.direction);
  const span = ind.max - ind.min;
  const step = span / TIER_COUNT;

  const tiers: IndicatorClassificationTier[] = [];
  for (let i = 0; i < TIER_COUNT; i++) {
    const from = ind.min + i * step;
    const to = i === TIER_COUNT - 1 ? null : ind.min + (i + 1) * step;
    tiers.push({ label: labels[i], from, to });
  }
  return tiers;
}

/** Retorna o rótulo qualitativo de um valor para um indicador. */
export function classifyValue(ind: IndicatorDef, value: number): string {
  const tiers = generateClassification(ind);
  for (const tier of tiers) {
    const aboveMin = tier.from === null || value >= tier.from;
    const belowMax = tier.to === null || value < tier.to;
    if (aboveMin && belowMax) return tier.label;
  }
  // Caso extremo: valor igual ao `max` exato cai no último tier.
  return tiers[tiers.length - 1].label;
}

/** Conveniência: classifica direto por id. */
export function classifyById(id: string, value: number): string {
  return classifyValue(getIndicator(id), value);
}
