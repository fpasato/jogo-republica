// src/game/data/indicators.ts
// Catálogo de atributos nacionais — 11 áreas, valores REAIS (sem "scores" fictícios).
// Índices 0–100 só são usados quando são medidas reconhecidas (Gini, transparência, corrupção, etc.)

export type IndicatorCategory =
  | 'economia'
  | 'saude'
  | 'educacao'
  | 'social'
  | 'seguranca'
  | 'energia'
  | 'infraestrutura'
  | 'meio_ambiente'
  | 'ciencia_tecnologia'
  | 'administracao'
  | 'cultura';

export type IndicatorType = 'slider' | 'calculated';
export type IndicatorDirection = 'higher_is_better' | 'lower_is_better' | 'neutral';

export type IndicatorFormat =
  | 'percent'
  | 'currency_year'
  | 'currency_month'
  | 'currency_unit'
  | 'currency_total'
  | 'currency_per_capita'
  | 'days'
  | 'minutes'
  | 'hours'
  | 'months'
  | 'years'
  | 'per_thousand'
  | 'per_hundred_thousand'
  | 'count'
  | 'index'          // índice real (Gini, transparência, CPI, etc.) — exibe número cru
  | 'ratio'          // 0–1 (ex: IDH)
  | 'points'         // escala real (IDEB 0–10, PISA 0–600)
  | 'km'
  | 'km2'
  | 'gwh'
  | 'mt_co2'
  | 'kwh_per_capita'
  | 'physical';      // qualquer unidade física no campo `unidade`

export interface IndicatorDef {
  id: string;
  nome: string;
  curto: string;
  category: IndicatorCategory;
  type: IndicatorType;
  unidade: string;
  direction: IndicatorDirection;
  min: number;
  max: number;
  step?: number;
  initial: number;
  descricao: string;
  formatKind: IndicatorFormat;
}

export const INDICATORS: IndicatorDef[] = [
  // =====================================================================
  // 1. ECONOMIA E FINANÇAS PÚBLICAS
  // =====================================================================
  // --- Sliders ---
  { id: 'iva', nome: 'IVA (Imposto sobre Valor Agregado)', curto: 'IVA',
    category: 'economia', type: 'slider', unidade: '%', direction: 'neutral',
    min: 5, max: 40, step: 0.5, initial: 26.5, formatKind: 'percent',
    descricao: 'Alíquota geral de tributação sobre o consumo.' },

  { id: 'imposto_renda', nome: 'Imposto de renda', curto: 'IR',
    category: 'economia', type: 'slider', unidade: '%', direction: 'neutral',
    min: 0, max: 45, step: 0.5, initial: 27.5, formatKind: 'percent',
    descricao: 'Alíquota máxima de IRPF.' },

  { id: 'imposto_empresas', nome: 'Imposto sobre empresas', curto: 'IRPJ/CSLL',
    category: 'economia', type: 'slider', unidade: '%', direction: 'neutral',
    min: 5, max: 50, step: 0.5, initial: 34.0, formatKind: 'percent',
    descricao: 'Carga tributária sobre lucro corporativo.' },

  { id: 'taxa_selic', nome: 'Taxa Selic', curto: 'Selic',
    category: 'economia', type: 'slider', unidade: '% a.a.', direction: 'lower_is_better',
    min: 2, max: 30, step: 0.25, initial: 11.25, formatKind: 'percent',
    descricao: 'Taxa básica de juros da economia.' },

  { id: 'salario_minimo', nome: 'Salário mínimo', curto: 'Salário mínimo',
    category: 'economia', type: 'slider', unidade: 'R$/mês', direction: 'higher_is_better',
    min: 1000, max: 6000, step: 10, initial: 1518, formatKind: 'currency_month',
    descricao: 'Piso salarial legal nacional.' },

  { id: 'investimento_publico', nome: 'Investimento público', curto: 'Inv. público',
    category: 'economia', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 10e9, max: 400e9, step: 1e9, initial: 85e9, formatKind: 'currency_year',
    descricao: 'Aportes federais em infraestrutura, portos, rodovias e logística.' },

  // --- Calculados ---
  { id: 'receitas_governo', nome: 'Receitas do governo', curto: 'Receitas',
    category: 'economia', type: 'calculated', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 500e9, max: 5000e9, initial: 2450e9, formatKind: 'currency_year',
    descricao: 'Arrecadação federal total (impostos + contribuições).' },

  { id: 'despesas_governo', nome: 'Despesas do governo', curto: 'Despesas',
    category: 'economia', type: 'calculated', unidade: 'R$/ano', direction: 'lower_is_better',
    min: 500e9, max: 5000e9, initial: 2520e9, formatKind: 'currency_year',
    descricao: 'Gasto público total (custeio, previdência, orçamentos).' },

  { id: 'saldo_orcamentario', nome: 'Saldo orçamentário', curto: 'Saldo primário',
    category: 'economia', type: 'calculated', unidade: 'R$/ano', direction: 'higher_is_better',
    min: -500e9, max: 500e9, initial: -70e9, formatKind: 'currency_year',
    descricao: 'Diferença entre receitas e despesas (superávit/déficit).' },

  { id: 'divida_publica', nome: 'Dívida pública bruta', curto: 'Dívida',
    category: 'economia', type: 'calculated', unidade: 'R$', direction: 'lower_is_better',
    min: 1000e9, max: 25000e9, initial: 8900e9, formatKind: 'currency_total',
    descricao: 'Estoque total da dívida bruta do setor público.' },

  { id: 'divida_pib', nome: 'Dívida / PIB', curto: 'Dívida/PIB',
    category: 'economia', type: 'calculated', unidade: '% do PIB', direction: 'lower_is_better',
    min: 20, max: 180, initial: 79.5, formatKind: 'percent',
    descricao: 'Relação dívida bruta / PIB.' },

  { id: 'inflacao', nome: 'Inflação (IPCA)', curto: 'Inflação',
    category: 'economia', type: 'calculated', unidade: '% ao ano', direction: 'lower_is_better',
    min: 0, max: 40, initial: 4.2, formatKind: 'percent',
    descricao: 'Variação anualizada do custo de vida.' },

  { id: 'desemprego', nome: 'Taxa de desemprego', curto: 'Desemprego',
    category: 'economia', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 2, max: 25, initial: 7.3, formatKind: 'percent',
    descricao: 'Percentual da PEA sem ocupação.' },

  { id: 'desemprego_jovens', nome: 'Desemprego juvenil (18–24)', curto: 'Desemp. jovem',
    category: 'economia', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 5, max: 45, initial: 18.5, formatKind: 'percent',
    descricao: 'Desemprego entre jovens de 18 a 24 anos.' },

  { id: 'crescimento_pib', nome: 'Crescimento do PIB', curto: 'Crescimento PIB',
    category: 'economia', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: -15, max: 15, initial: 2.5, formatKind: 'percent',
    descricao: 'Taxa de expansão anual do PIB.' },

  { id: 'pib', nome: 'PIB nominal', curto: 'PIB',
    category: 'economia', type: 'calculated', unidade: 'R$', direction: 'higher_is_better',
    min: 2000e9, max: 30000e9, initial: 11200e9, formatKind: 'currency_total',
    descricao: 'Produto Interno Bruto.' },

  { id: 'pib_per_capita', nome: 'PIB per capita', curto: 'PIB/hab',
    category: 'economia', type: 'calculated', unidade: 'R$/hab/ano', direction: 'higher_is_better',
    min: 10000, max: 120000, initial: 52500, formatKind: 'currency_per_capita',
    descricao: 'PIB dividido pela população.' },

  { id: 'dolar', nome: 'Cotação do Dólar', curto: 'Dólar',
    category: 'economia', type: 'calculated', unidade: 'R$/US$', direction: 'lower_is_better',
    min: 2.0, max: 12.0, initial: 5.75, formatKind: 'currency_unit',
    descricao: 'Taxa de câmbio nominal.' },

  { id: 'renda_media_real', nome: 'Renda média real', curto: 'Renda média',
    category: 'economia', type: 'calculated', unidade: 'R$/mês', direction: 'higher_is_better',
    min: 800, max: 6000, initial: 2950, formatKind: 'currency_month',
    descricao: 'Rendimento médio real deflacionado (poder de compra).' },

  { id: 'carga_tributaria_efetiva', nome: 'Carga tributária efetiva', curto: 'Carga trib.',
    category: 'economia', type: 'calculated', unidade: '% do PIB', direction: 'neutral',
    min: 5, max: 60, initial: 32, formatKind: 'percent',
    descricao: 'Arrecadação total / PIB.' },

  { id: 'investimento_privado_pib', nome: 'Investimento privado', curto: 'Inv. privado',
    category: 'economia', type: 'calculated', unidade: '% do PIB', direction: 'higher_is_better',
    min: 5, max: 30, initial: 15.5, formatKind: 'percent',
    descricao: 'Formação bruta de capital fixo privada.' },

  { id: 'produtividade', nome: 'Produtividade do trabalho', curto: 'Produtividade',
    category: 'economia', type: 'calculated', unidade: 'R$/hora', direction: 'higher_is_better',
    min: 20, max: 250, initial: 62, formatKind: 'currency_unit',
    descricao: 'PIB por hora trabalhada.' },

  { id: 'risco_pais', nome: 'Risco-país (EMBI)', curto: 'Risco-país',
    category: 'economia', type: 'calculated', unidade: 'bps', direction: 'lower_is_better',
    min: 100, max: 2500, initial: 260, formatKind: 'physical',
    descricao: 'Prêmio de risco cobrado de títulos públicos.' },

  { id: 'confianca_consumidor', nome: 'Confiança do consumidor', curto: 'Conf. consumidor',
    category: 'economia', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 20, max: 90, initial: 55, formatKind: 'percent',
    descricao: 'Parcela de consumidores otimistas (pesquisa).' },

  // =====================================================================
  // 2. SAÚDE
  // =====================================================================
  { id: 'orcamento_saude', nome: 'Orçamento da saúde', curto: 'Orç. saúde',
    category: 'saude', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 50e9, max: 500e9, step: 2e9, initial: 218e9, formatKind: 'currency_year',
    descricao: 'Dotação anual do SUS e atenção básica.' },

  { id: 'salarios_saude', nome: 'Salários dos profissionais de saúde', curto: 'Sal. saúde',
    category: 'saude', type: 'slider', unidade: 'R$/mês', direction: 'higher_is_better',
    min: 2000, max: 25000, step: 100, initial: 6800, formatKind: 'currency_month',
    descricao: 'Remuneração média de médicos e enfermeiros.' },

  { id: 'investimento_hospitais', nome: 'Investimento em hospitais e UBS', curto: 'Inv. hospitais',
    category: 'saude', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 5e9, max: 100e9, step: 1e9, initial: 24e9, formatKind: 'currency_year',
    descricao: 'Leitos, UPAs, equipamentos e reformas.' },

  { id: 'esperanca_vida', nome: 'Esperança de vida ao nascer', curto: 'Esperança vida',
    category: 'saude', type: 'calculated', unidade: 'anos', direction: 'higher_is_better',
    min: 50, max: 90, initial: 76.4, formatKind: 'years',
    descricao: 'Expectativa média de vida da população.' },

  { id: 'mortalidade_infantil', nome: 'Mortalidade infantil', curto: 'Mort. infantil',
    category: 'saude', type: 'calculated', unidade: '/1.000 nascidos', direction: 'lower_is_better',
    min: 1, max: 50, initial: 11.8, formatKind: 'per_thousand',
    descricao: 'Óbitos de menores de 1 ano por mil nascidos vivos.' },

  { id: 'mortalidade_geral', nome: 'Mortalidade geral', curto: 'Mort. geral',
    category: 'saude', type: 'calculated', unidade: '/1.000 hab', direction: 'lower_is_better',
    min: 3, max: 20, initial: 6.5, formatKind: 'per_thousand',
    descricao: 'Óbitos anuais por mil habitantes.' },

  { id: 'mortalidade_materna', nome: 'Mortalidade materna', curto: 'Mort. materna',
    category: 'saude', type: 'calculated', unidade: '/100 mil nascidos', direction: 'lower_is_better',
    min: 5, max: 200, initial: 62, formatKind: 'per_hundred_thousand',
    descricao: 'Mortes de mães por causas ligadas à gravidez/parto.' },

  { id: 'leitos_por_mil', nome: 'Leitos hospitalares', curto: 'Leitos/mil',
    category: 'saude', type: 'calculated', unidade: 'leitos/1.000 hab', direction: 'higher_is_better',
    min: 1, max: 6, initial: 2.3, formatKind: 'per_thousand',
    descricao: 'Leitos hospitalares por mil habitantes.' },

  { id: 'medicos_por_mil', nome: 'Médicos por mil habitantes', curto: 'Médicos/mil',
    category: 'saude', type: 'calculated', unidade: 'médicos/1.000 hab', direction: 'higher_is_better',
    min: 0.5, max: 6, initial: 2.8, formatKind: 'per_thousand',
    descricao: 'Densidade médica por mil habitantes.' },

  { id: 'tempo_espera_saude', nome: 'Tempo médio de espera', curto: 'Espera saúde',
    category: 'saude', type: 'calculated', unidade: 'dias', direction: 'lower_is_better',
    min: 1, max: 180, initial: 42, formatKind: 'days',
    descricao: 'Espera por consultas e exames especializados.' },

  { id: 'fila_cirurgias', nome: 'Fila de cirurgias eletivas', curto: 'Fila cirurgias',
    category: 'saude', type: 'calculated', unidade: 'pessoas', direction: 'lower_is_better',
    min: 100000, max: 5000000, initial: 950000, formatKind: 'count',
    descricao: 'Pacientes aguardando cirurgia eletiva no SUS.' },

  { id: 'cobertura_atencao_basica', nome: 'Cobertura da atenção básica', curto: 'Atenção básica',
    category: 'saude', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 0, max: 100, initial: 72, formatKind: 'percent',
    descricao: 'População coberta por equipes de atenção básica.' },

  { id: 'cobertura_vacinal', nome: 'Cobertura vacinal', curto: 'Vacinação',
    category: 'saude', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 0, max: 100, initial: 88, formatKind: 'percent',
    descricao: 'Cobertura do calendário nacional de vacinação.' },

  { id: 'disponibilidade_medicamentos', nome: 'Disponibilidade de medicamentos', curto: 'Medicamentos',
    category: 'saude', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 0, max: 100, initial: 70, formatKind: 'percent',
    descricao: 'Percentual de itens da farmácia básica disponíveis.' },

  { id: 'satisfacao_sus', nome: 'Satisfação com o SUS', curto: 'Satisfação SUS',
    category: 'saude', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 0, max: 100, initial: 55, formatKind: 'percent',
    descricao: 'Parcela da população satisfeita com o SUS.' },

  { id: 'gasto_saude_pib', nome: 'Gasto em saúde / PIB', curto: 'Gasto saúde/PIB',
    category: 'saude', type: 'calculated', unidade: '% do PIB', direction: 'higher_is_better',
    min: 3, max: 15, initial: 9.5, formatKind: 'percent',
    descricao: 'Gasto público + privado em saúde em relação ao PIB.' },

  // =====================================================================
  // 3. EDUCAÇÃO
  // =====================================================================
  { id: 'orcamento_educacao', nome: 'Orçamento da educação', curto: 'Orç. educação',
    category: 'educacao', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 50e9, max: 400e9, step: 2e9, initial: 175e9, formatKind: 'currency_year',
    descricao: 'Verba do MEC + FUNDEB.' },

  { id: 'salarios_professores', nome: 'Salário médio dos professores', curto: 'Sal. professores',
    category: 'educacao', type: 'slider', unidade: 'R$/mês', direction: 'higher_is_better',
    min: 2000, max: 20000, step: 100, initial: 4850, formatKind: 'currency_month',
    descricao: 'Piso médio pago ao docente da educação básica.' },

  { id: 'investimento_escolas', nome: 'Investimento em escolas e creches', curto: 'Inv. escolas',
    category: 'educacao', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 5e9, max: 80e9, step: 1e9, initial: 22e9, formatKind: 'currency_year',
    descricao: 'Infraestrutura escolar, laboratórios e conectividade.' },

  { id: 'ideb_anos_iniciais', nome: 'IDEB — anos iniciais', curto: 'IDEB iniciais',
    category: 'educacao', type: 'calculated', unidade: '0–10', direction: 'higher_is_better',
    min: 1, max: 10, initial: 5.8, formatKind: 'points',
    descricao: 'Índice de Desenvolvimento da Educação Básica (1º–5º ano).' },

  { id: 'ideb_anos_finais', nome: 'IDEB — anos finais', curto: 'IDEB finais',
    category: 'educacao', type: 'calculated', unidade: '0–10', direction: 'higher_is_better',
    min: 1, max: 10, initial: 5.0, formatKind: 'points',
    descricao: 'IDEB (6º–9º ano).' },

  { id: 'ideb_ensino_medio', nome: 'IDEB — ensino médio', curto: 'IDEB médio',
    category: 'educacao', type: 'calculated', unidade: '0–10', direction: 'higher_is_better',
    min: 1, max: 10, initial: 4.2, formatKind: 'points',
    descricao: 'IDEB do ensino médio.' },

  { id: 'pisa_matematica', nome: 'PISA — Matemática', curto: 'PISA mat.',
    category: 'educacao', type: 'calculated', unidade: 'pontos', direction: 'higher_is_better',
    min: 300, max: 600, initial: 379, formatKind: 'points',
    descricao: 'Escore médio em matemática no PISA.' },

  { id: 'taxa_analfabetismo', nome: 'Taxa de analfabetismo', curto: 'Analfabetismo',
    category: 'educacao', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 0.5, max: 25, initial: 5.4, formatKind: 'percent',
    descricao: 'População 15+ anos analfabeta.' },

  { id: 'evasao_escolar', nome: 'Evasão escolar', curto: 'Evasão escolar',
    category: 'educacao', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 0.5, max: 30, initial: 7.1, formatKind: 'percent',
    descricao: 'Abandono no ensino fundamental e médio.' },

  { id: 'taxa_matricula_liquida', nome: 'Matrícula líquida (6–14)', curto: 'Matrícula',
    category: 'educacao', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 50, max: 100, initial: 94, formatKind: 'percent',
    descricao: 'Parcela da população em idade escolar matriculada.' },

  { id: 'anos_estudo_medio', nome: 'Anos médios de estudo (25+)', curto: 'Anos de estudo',
    category: 'educacao', type: 'calculated', unidade: 'anos', direction: 'higher_is_better',
    min: 3, max: 15, initial: 9.5, formatKind: 'years',
    descricao: 'Escolaridade média da população adulta.' },

  { id: 'conclusao_ensino_medio', nome: 'Conclusão do ensino médio', curto: 'Conclusão EM',
    category: 'educacao', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 20, max: 100, initial: 68, formatKind: 'percent',
    descricao: 'Percentual de jovens que concluem o EM na idade certa.' },

  { id: 'formacao_tecnica_jovens', nome: 'Jovens em ensino técnico', curto: 'Form. técnica',
    category: 'educacao', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 2, max: 40, initial: 11, formatKind: 'percent',
    descricao: 'Parcela de jovens em cursos técnicos.' },

  { id: 'inclusao_digital', nome: 'Escolas com internet adequada', curto: 'Inclusão digital',
    category: 'educacao', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 0, max: 100, initial: 65, formatKind: 'percent',
    descricao: 'Escolas com banda larga de qualidade.' },

  { id: 'qualificacao_docente', nome: 'Professores com formação superior', curto: 'Qualif. docente',
    category: 'educacao', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 20, max: 100, initial: 78, formatKind: 'percent',
    descricao: 'Docentes da educação básica com curso superior.' },

  { id: 'gasto_educacao_pib', nome: 'Gasto em educação / PIB', curto: 'Gasto educ./PIB',
    category: 'educacao', type: 'calculated', unidade: '% do PIB', direction: 'higher_is_better',
    min: 2, max: 12, initial: 6.0, formatKind: 'percent',
    descricao: 'Investimento público em educação / PIB.' },

  // =====================================================================
  // 4. SOCIAL E TRABALHO
  // =====================================================================
  { id: 'bolsa_familia', nome: 'Bolsa Família (valor médio)', curto: 'Bolsa Família',
    category: 'social', type: 'slider', unidade: 'R$/família/mês', direction: 'higher_is_better',
    min: 200, max: 2000, step: 10, initial: 685, formatKind: 'currency_month',
    descricao: 'Benefício mensal médio de transferência de renda.' },

  { id: 'orcamento_assistencia_social', nome: 'Orçamento da assistência social', curto: 'Assist. social',
    category: 'social', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 20e9, max: 300e9, step: 2e9, initial: 168e9, formatKind: 'currency_year',
    descricao: 'SUAS, BPC, acolhimento e combate à fome.' },

  { id: 'investimento_habitacao', nome: 'Investimento em habitação popular', curto: 'Habitação',
    category: 'social', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 2e9, max: 80e9, step: 1e9, initial: 18e9, formatKind: 'currency_year',
    descricao: 'Construção e subsídio de moradias populares.' },

  { id: 'taxa_pobreza', nome: 'Taxa de pobreza', curto: 'Pobreza',
    category: 'social', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 2, max: 50, initial: 24.2, formatKind: 'percent',
    descricao: 'População abaixo da linha de pobreza.' },

  { id: 'extrema_pobreza', nome: 'Extrema pobreza', curto: 'Extrema pobreza',
    category: 'social', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 0.5, max: 20, initial: 4.8, formatKind: 'percent',
    descricao: 'População em miséria / insegurança alimentar severa.' },

  { id: 'gini', nome: 'Índice de Gini', curto: 'Gini',
    category: 'social', type: 'calculated', unidade: '0–100', direction: 'lower_is_better',
    min: 20, max: 80, initial: 51.8, formatKind: 'index',
    descricao: 'Desigualdade de renda (0 = igual, 100 = totalmente desigual).' },

  { id: 'idh', nome: 'IDH', curto: 'IDH',
    category: 'social', type: 'calculated', unidade: '0–1', direction: 'higher_is_better',
    min: 0.3, max: 1, initial: 0.76, formatKind: 'ratio',
    descricao: 'Índice de Desenvolvimento Humano (ONU).' },

  { id: 'renda_per_capita', nome: 'Renda domiciliar per capita', curto: 'Renda p.c.',
    category: 'social', type: 'calculated', unidade: 'R$/mês', direction: 'higher_is_better',
    min: 200, max: 4000, initial: 1450, formatKind: 'currency_month',
    descricao: 'Renda média por membro da família.' },

  { id: 'taxa_informalidade', nome: 'Taxa de informalidade', curto: 'Informalidade',
    category: 'social', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 10, max: 70, initial: 39, formatKind: 'percent',
    descricao: 'Trabalhadores sem carteira ou por conta própria.' },

  { id: 'seguranca_alimentar', nome: 'Segurança alimentar', curto: 'Seg. alimentar',
    category: 'social', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 20, max: 100, initial: 72, formatKind: 'percent',
    descricao: 'Lares em segurança alimentar.' },

  { id: 'deficit_habitacional', nome: 'Déficit habitacional', curto: 'Déficit habit.',
    category: 'social', type: 'calculated', unidade: 'moradias', direction: 'lower_is_better',
    min: 100000, max: 8000000, initial: 5900000, formatKind: 'count',
    descricao: 'Famílias sem moradia adequada.' },

  { id: 'populacao_rua', nome: 'População em situação de rua', curto: 'Pop. rua',
    category: 'social', type: 'calculated', unidade: 'pessoas', direction: 'lower_is_better',
    min: 20000, max: 800000, initial: 280000, formatKind: 'count',
    descricao: 'Pessoas vivendo nas ruas.' },

  { id: 'mobilidade_social_pct', nome: 'Mobilidade social intergeracional', curto: 'Mobilidade',
    category: 'social', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 70, initial: 34, formatKind: 'percent',
    descricao: 'Filhos que superam a renda dos pais.' },

  // =====================================================================
  // 5. SEGURANÇA E JUSTIÇA
  // =====================================================================
  { id: 'orcamento_seguranca', nome: 'Orçamento da segurança', curto: 'Orç. segurança',
    category: 'seguranca', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 10e9, max: 150e9, step: 1e9, initial: 42e9, formatKind: 'currency_year',
    descricao: 'Polícia Federal, PRF, inteligência e FNSP.' },

  { id: 'efetivo_policial', nome: 'Efetivo policial', curto: 'Efetivo',
    category: 'seguranca', type: 'slider', unidade: 'agentes', direction: 'higher_is_better',
    min: 200000, max: 900000, step: 5000, initial: 490000, formatKind: 'count',
    descricao: 'Total de policiais em atividade.' },

  { id: 'orcamento_prisional', nome: 'Orçamento prisional', curto: 'Orç. prisional',
    category: 'seguranca', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 2e9, max: 40e9, step: 0.5e9, initial: 12e9, formatKind: 'currency_year',
    descricao: 'Gestão penitenciária e novas vagas.' },

  { id: 'homicidios', nome: 'Taxa de homicídios', curto: 'Homicídios',
    category: 'seguranca', type: 'calculated', unidade: '/100 mil hab', direction: 'lower_is_better',
    min: 2, max: 60, initial: 21.4, formatKind: 'per_hundred_thousand',
    descricao: 'Mortes violentas intencionais por 100 mil hab.' },

  { id: 'roubos_por_100k', nome: 'Roubos', curto: 'Roubos',
    category: 'seguranca', type: 'calculated', unidade: '/100 mil hab', direction: 'lower_is_better',
    min: 50, max: 1500, initial: 420, formatKind: 'per_hundred_thousand',
    descricao: 'Roubos registrados por 100 mil hab.' },

  { id: 'furtos_por_100k', nome: 'Furtos', curto: 'Furtos',
    category: 'seguranca', type: 'calculated', unidade: '/100 mil hab', direction: 'lower_is_better',
    min: 100, max: 2000, initial: 550, formatKind: 'per_hundred_thousand',
    descricao: 'Furtos registrados por 100 mil hab.' },

  { id: 'taxa_elucidacao', nome: 'Taxa de elucidação de crimes', curto: 'Elucidação',
    category: 'seguranca', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 90, initial: 32, formatKind: 'percent',
    descricao: 'Percentual de crimes resolvidos.' },

  { id: 'tempo_medio_processo', nome: 'Duração média de processo judicial', curto: 'Tempo processo',
    category: 'seguranca', type: 'calculated', unidade: 'meses', direction: 'lower_is_better',
    min: 6, max: 72, initial: 30, formatKind: 'months',
    descricao: 'Tempo médio entre abertura e sentença.' },

  { id: 'populacao_carceraria', nome: 'População carcerária', curto: 'Presos',
    category: 'seguranca', type: 'calculated', unidade: 'pessoas', direction: 'lower_is_better',
    min: 100000, max: 1500000, initial: 830000, formatKind: 'count',
    descricao: 'Total de pessoas privadas de liberdade.' },

  { id: 'taxa_encarceramento', nome: 'Taxa de encarceramento', curto: 'Encarceramento',
    category: 'seguranca', type: 'calculated', unidade: '/100 mil hab', direction: 'lower_is_better',
    min: 50, max: 800, initial: 390, formatKind: 'per_hundred_thousand',
    descricao: 'Presos por 100 mil hab.' },

  { id: 'presos_provisorios_pct', nome: 'Presos sem condenação', curto: 'Provisórios',
    category: 'seguranca', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 5, max: 70, initial: 32, formatKind: 'percent',
    descricao: 'Presos aguardando julgamento.' },

  { id: 'condicoes_prisionais', nome: 'Presos em condições adequadas', curto: 'Condições pris.',
    category: 'seguranca', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 0, max: 100, initial: 32, formatKind: 'percent',
    descricao: 'Parcela da população carcerária em unidades com capacidade respeitada.' },

  { id: 'reincidencia_prisional', nome: 'Reincidência prisional', curto: 'Reincidência',
    category: 'seguranca', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 10, max: 90, initial: 52, formatKind: 'percent',
    descricao: 'Detentos que reincidem após soltura.' },

  { id: 'letalidade_policial', nome: 'Letalidade policial', curto: 'Letalidade pol.',
    category: 'seguranca', type: 'calculated', unidade: '/100 mil hab', direction: 'lower_is_better',
    min: 0, max: 20, initial: 3.2, formatKind: 'per_hundred_thousand',
    descricao: 'Mortes por intervenção policial por 100 mil hab.' },

  { id: 'confianca_seguranca', nome: 'Confiança na segurança pública', curto: 'Confiança seg.',
    category: 'seguranca', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 90, initial: 50, formatKind: 'percent',
    descricao: 'Parcela da população que confia nas polícias.' },

  { id: 'tempo_resposta_emergencia', nome: 'Tempo de resposta a emergências', curto: 'Resp. emergência',
    category: 'seguranca', type: 'calculated', unidade: 'minutos', direction: 'lower_is_better',
    min: 3, max: 45, initial: 18, formatKind: 'minutes',
    descricao: 'Tempo médio de chegada da primeira viatura.' },

  // =====================================================================
  // 6. ENERGIA
  // =====================================================================
  { id: 'investimento_energia', nome: 'Investimento no setor energético', curto: 'Inv. energia',
    category: 'energia', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 5e9, max: 120e9, step: 1e9, initial: 35e9, formatKind: 'currency_year',
    descricao: 'Geração, transmissão e distribuição.' },

  { id: 'subsidios_energia', nome: 'Subsídios à energia', curto: 'Subsídios energia',
    category: 'energia', type: 'slider', unidade: 'R$/ano', direction: 'neutral',
    min: 0, max: 80e9, step: 1e9, initial: 22e9, formatKind: 'currency_year',
    descricao: 'Subvenções tarifárias e incentivos de transição.' },

  { id: 'custo_energia', nome: 'Custo médio da energia', curto: 'Custo energia',
    category: 'energia', type: 'calculated', unidade: 'R$/kWh', direction: 'lower_is_better',
    min: 0.2, max: 2.5, initial: 0.88, formatKind: 'currency_unit',
    descricao: 'Tarifa média residencial.' },

  { id: 'reserva_capacidade', nome: 'Margem de reserva de geração', curto: 'Reserva geração',
    category: 'energia', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 60, initial: 25, formatKind: 'percent',
    descricao: 'Folga entre oferta firme e demanda máxima.' },

  { id: 'participacao_renovaveis', nome: 'Participação de renováveis', curto: 'Renováveis',
    category: 'energia', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 100, initial: 84.5, formatKind: 'percent',
    descricao: 'Hídrica + eólica + solar + biomassa na matriz elétrica.' },

  { id: 'horas_sem_energia', nome: 'Horas sem energia por ano', curto: 'Horas sem luz',
    category: 'energia', type: 'calculated', unidade: 'horas/ano', direction: 'lower_is_better',
    min: 1, max: 60, initial: 12, formatKind: 'hours',
    descricao: 'Interrupções médias anuais por consumidor (DEC).' },

  { id: 'emissoes_energia', nome: 'Emissões do setor energético', curto: 'Emissões energia',
    category: 'energia', type: 'calculated', unidade: 'Mt CO₂/ano', direction: 'lower_is_better',
    min: 20, max: 800, initial: 430, formatKind: 'mt_co2',
    descricao: 'Emissões de CO₂ da matriz energética.' },

  { id: 'capacidade_geracao_gw', nome: 'Capacidade instalada de geração', curto: 'Capacidade GW',
    category: 'energia', type: 'calculated', unidade: 'GW', direction: 'higher_is_better',
    min: 100, max: 500, initial: 195, formatKind: 'physical',
    descricao: 'Potência total instalada.' },

  { id: 'acesso_energia', nome: 'Acesso à rede elétrica', curto: 'Acesso energia',
    category: 'energia', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 80, max: 100, initial: 99.2, formatKind: 'percent',
    descricao: 'Domicílios ligados à rede elétrica.' },

  { id: 'perda_distribuicao', nome: 'Perdas na distribuição', curto: 'Perdas dist.',
    category: 'energia', type: 'calculated', unidade: '%', direction: 'lower_is_better',
    min: 3, max: 30, initial: 15, formatKind: 'percent',
    descricao: 'Energia injetada que não chega ao consumidor.' },

  { id: 'consumo_per_capita_kwh', nome: 'Consumo de energia per capita', curto: 'Consumo kWh',
    category: 'energia', type: 'calculated', unidade: 'kWh/hab/ano', direction: 'neutral',
    min: 800, max: 8000, initial: 2450, formatKind: 'kwh_per_capita',
    descricao: 'Consumo final de energia por habitante.' },

  // =====================================================================
  // 7. INFRAESTRUTURA E HABITAÇÃO
  // =====================================================================
  { id: 'investimento_infraestrutura', nome: 'Investimento em infraestrutura', curto: 'Inv. infra',
    category: 'infraestrutura', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 5e9, max: 200e9, step: 2e9, initial: 55e9, formatKind: 'currency_year',
    descricao: 'Rodovias, ferrovias, portos e aeroportos.' },

  { id: 'investimento_saneamento', nome: 'Investimento em saneamento', curto: 'Inv. saneamento',
    category: 'infraestrutura', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 1e9, max: 60e9, step: 1e9, initial: 12e9, formatKind: 'currency_year',
    descricao: 'Água tratada, esgoto e drenagem.' },

  { id: 'investimento_transportes', nome: 'Investimento em transporte urbano', curto: 'Inv. transportes',
    category: 'infraestrutura', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 2e9, max: 80e9, step: 1e9, initial: 14e9, formatKind: 'currency_year',
    descricao: 'Metrôs, BRTs, VLTs, ciclovias.' },

  { id: 'rodovias_pavimentadas', nome: 'Rodovias pavimentadas', curto: 'Rodovias pav.',
    category: 'infraestrutura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 80, initial: 13, formatKind: 'percent',
    descricao: 'Percentual da malha rodoviária pavimentada.' },

  { id: 'rodovias_conservacao', nome: 'Rodovias em bom estado', curto: 'Conservação rodovias',
    category: 'infraestrutura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 90, initial: 45, formatKind: 'percent',
    descricao: 'Trechos pavimentados com condição boa/ótima.' },

  { id: 'ferrovias_km', nome: 'Malha ferroviária', curto: 'Ferrovias',
    category: 'infraestrutura', type: 'calculated', unidade: 'km', direction: 'higher_is_better',
    min: 20000, max: 60000, initial: 30000, formatKind: 'km',
    descricao: 'Extensão total da malha ferroviária operacional.' },

  { id: 'portos_eficiencia', nome: 'Tempo médio em portos', curto: 'Tempo portos',
    category: 'infraestrutura', type: 'calculated', unidade: 'dias', direction: 'lower_is_better',
    min: 1, max: 20, initial: 8.5, formatKind: 'days',
    descricao: 'Tempo médio de atracação + liberação.' },

  { id: 'esgoto_tratado', nome: 'Esgoto coletado e tratado', curto: 'Esgoto tratado',
    category: 'infraestrutura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 100, initial: 55, formatKind: 'percent',
    descricao: 'Percentual de esgoto coletado e tratado.' },

  { id: 'acesso_agua_tratada', nome: 'Acesso à água tratada', curto: 'Água tratada',
    category: 'infraestrutura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 50, max: 100, initial: 84, formatKind: 'percent',
    descricao: 'Domicílios com água tratada.' },

  { id: 'tempo_deslocamento_medio', nome: 'Tempo médio casa–trabalho', curto: 'Deslocamento',
    category: 'infraestrutura', type: 'calculated', unidade: 'minutos', direction: 'lower_is_better',
    min: 15, max: 120, initial: 55, formatKind: 'minutes',
    descricao: 'Deslocamento médio nas grandes cidades.' },

  { id: 'custo_logistico_pib', nome: 'Custo logístico / PIB', curto: 'Custo logístico',
    category: 'infraestrutura', type: 'calculated', unidade: '% do PIB', direction: 'lower_is_better',
    min: 5, max: 25, initial: 12.5, formatKind: 'percent',
    descricao: 'Custos logísticos nacionais em relação ao PIB.' },

  { id: 'qualidade_transporte_publico', nome: 'Satisfação com transporte público', curto: 'Transporte público',
    category: 'infraestrutura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 90, initial: 42, formatKind: 'percent',
    descricao: 'Usuários satisfeitos com o transporte público.' },

  // =====================================================================
  // 8. MEIO AMBIENTE
  // =====================================================================
  { id: 'orcamento_meio_ambiente', nome: 'Orçamento do meio ambiente', curto: 'Orç. ambiente',
    category: 'meio_ambiente', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.5e9, max: 30e9, step: 0.5e9, initial: 4.2e9, formatKind: 'currency_year',
    descricao: 'Ministério, IBAMA, ICMBio, fiscalização.' },

  { id: 'fiscalizacao_ambiental', nome: 'Fiscalização ambiental', curto: 'Fiscalização',
    category: 'meio_ambiente', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.2e9, max: 15e9, step: 0.2e9, initial: 2.1e9, formatKind: 'currency_year',
    descricao: 'Operações de campo e monitoramento por satélite.' },

  { id: 'orcamento_combate_desmatamento', nome: 'Combate ao desmatamento', curto: 'Combate desmat.',
    category: 'meio_ambiente', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.1e9, max: 10e9, step: 0.1e9, initial: 1.2e9, formatKind: 'currency_year',
    descricao: 'Prevenção, brigadas, alternativas econômicas.' },

  { id: 'desmatamento_amazonia', nome: 'Desmatamento — Amazônia', curto: 'Desmat. Amazônia',
    category: 'meio_ambiente', type: 'calculated', unidade: 'km²/ano', direction: 'lower_is_better',
    min: 1000, max: 30000, initial: 9000, formatKind: 'km2',
    descricao: 'Área desmatada anualmente na Amazônia Legal.' },

  { id: 'desmatamento_cerrado', nome: 'Desmatamento — Cerrado', curto: 'Desmat. Cerrado',
    category: 'meio_ambiente', type: 'calculated', unidade: 'km²/ano', direction: 'lower_is_better',
    min: 1000, max: 20000, initial: 7000, formatKind: 'km2',
    descricao: 'Área desmatada anualmente no Cerrado.' },

  { id: 'emissao_co2', nome: 'Emissões totais de CO₂', curto: 'CO₂ total',
    category: 'meio_ambiente', type: 'calculated', unidade: 'Mt CO₂/ano', direction: 'lower_is_better',
    min: 200, max: 3000, initial: 2200, formatKind: 'mt_co2',
    descricao: 'Emissões brutas nacionais (energia + uso da terra).' },

  { id: 'qualidade_ar_pm25', nome: 'Concentração de PM2,5', curto: 'Poluição PM2,5',
    category: 'meio_ambiente', type: 'calculated', unidade: 'µg/m³', direction: 'lower_is_better',
    min: 3, max: 60, initial: 14, formatKind: 'physical',
    descricao: 'Material particulado fino médio anual.' },

  { id: 'qualidade_agua', nome: 'Qualidade da água', curto: 'Qualidade água',
    category: 'meio_ambiente', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 100, initial: 56, formatKind: 'percent',
    descricao: 'Corpos d\'água em condição boa/ótima.' },

  { id: 'taxa_reciclagem', nome: 'Taxa de reciclagem', curto: 'Reciclagem',
    category: 'meio_ambiente', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 1, max: 50, initial: 4.5, formatKind: 'percent',
    descricao: 'Resíduos sólidos reciclados.' },

  { id: 'areas_protegidas', nome: 'Áreas protegidas', curto: 'Áreas protegidas',
    category: 'meio_ambiente', type: 'calculated', unidade: 'milhões ha', direction: 'higher_is_better',
    min: 100, max: 300, initial: 230, formatKind: 'physical',
    descricao: 'Unidades de conservação + terras indígenas.' },

  { id: 'especies_ameacadas', nome: 'Espécies ameaçadas', curto: 'Espécies ameaçadas',
    category: 'meio_ambiente', type: 'calculated', unidade: 'espécies', direction: 'lower_is_better',
    min: 200, max: 3000, initial: 1200, formatKind: 'count',
    descricao: 'Espécies na lista vermelha brasileira.' },

  { id: 'indice_pegada_ecologica', nome: 'Pegada ecológica', curto: 'Pegada ecol.',
    category: 'meio_ambiente', type: 'calculated', unidade: 'gha/hab', direction: 'lower_is_better',
    min: 1.5, max: 8, initial: 2.9, formatKind: 'physical',
    descricao: 'Hectares globais por habitante.' },

  // =====================================================================
  // 9. CIÊNCIA E TECNOLOGIA
  // =====================================================================
  { id: 'orcamento_ciencia', nome: 'Orçamento de C&T', curto: 'Orç. C&T',
    category: 'ciencia_tecnologia', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 2e9, max: 60e9, step: 1e9, initial: 12e9, formatKind: 'currency_year',
    descricao: 'MCTI, CNPq, Finep e institutos de pesquisa.' },

  { id: 'incentivos_inovacao', nome: 'Incentivos à inovação', curto: 'Incentivos inov.',
    category: 'ciencia_tecnologia', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.5e9, max: 40e9, step: 0.5e9, initial: 8e9, formatKind: 'currency_year',
    descricao: 'Renúncia fiscal, BNDES, EMBRAPII, subvenção.' },

  { id: 'investimento_pesquisa', nome: 'Investimento em pesquisa', curto: 'Inv. pesquisa',
    category: 'ciencia_tecnologia', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.5e9, max: 50e9, step: 0.5e9, initial: 6.5e9, formatKind: 'currency_year',
    descricao: 'P&D empresarial + universidades federais.' },

  { id: 'investimento_pd_pib', nome: 'Investimento em P&D', curto: 'P&D/PIB',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: '% do PIB', direction: 'higher_is_better',
    min: 0.3, max: 4.5, initial: 1.15, formatKind: 'percent',
    descricao: 'Gasto bruto em P&D / PIB.' },

  { id: 'patentes_ano', nome: 'Patentes registradas', curto: 'Patentes',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: 'patentes/ano', direction: 'higher_is_better',
    min: 5000, max: 80000, initial: 25000, formatKind: 'count',
    descricao: 'Patentes depositadas no INPI + PCT.' },

  { id: 'publicacoes_ano', nome: 'Publicações científicas', curto: 'Publicações',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: 'artigos/ano', direction: 'higher_is_better',
    min: 20000, max: 200000, initial: 80000, formatKind: 'count',
    descricao: 'Artigos indexados na Scopus/Web of Science.' },

  { id: 'pesquisadores_por_mil', nome: 'Pesquisadores por mil hab.', curto: 'Pesquisadores',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: 'pesq./1.000 hab', direction: 'higher_is_better',
    min: 0.5, max: 8, initial: 1.3, formatKind: 'per_thousand',
    descricao: 'Densidade de pesquisadores.' },

  { id: 'empresas_inovadoras_pct', nome: 'Empresas que inovam', curto: 'Empresas inov.',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 70, initial: 34, formatKind: 'percent',
    descricao: 'Empresas que investiram em inovação no último ano.' },

  { id: 'startups_ativas', nome: 'Startups ativas', curto: 'Startups',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: 'empresas', direction: 'higher_is_better',
    min: 500, max: 80000, initial: 13000, formatKind: 'count',
    descricao: 'Startups em operação com CNPJ ativo.' },

  { id: 'exportacao_tecnologia_pct', nome: 'Exportação de alta tecnologia', curto: 'Exp. alta tec.',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: '% das exportações', direction: 'higher_is_better',
    min: 2, max: 40, initial: 12, formatKind: 'percent',
    descricao: 'Parcela da pauta exportadora de alta tecnologia.' },

  { id: 'banda_larga_pct', nome: 'Domicílios com banda larga', curto: 'Banda larga',
    category: 'ciencia_tecnologia', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 20, max: 100, initial: 78, formatKind: 'percent',
    descricao: 'Domicílios com internet de banda larga.' },

  // =====================================================================
  // 10. ADMINISTRAÇÃO PÚBLICA
  // =====================================================================
  { id: 'orcamento_administracao', nome: 'Orçamento da administração', curto: 'Orç. adm.',
    category: 'administracao', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 20e9, max: 200e9, step: 2e9, initial: 60e9, formatKind: 'currency_year',
    descricao: 'Custeio da máquina pública federal.' },

  { id: 'orcamento_digitalizacao', nome: 'Investimento em governo digital', curto: 'Gov. digital',
    category: 'administracao', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.5e9, max: 20e9, step: 0.5e9, initial: 3.5e9, formatKind: 'currency_year',
    descricao: 'Plataformas digitais, interoperabilidade, serviços online.' },

  { id: 'eficiencia_arrecadacao', nome: 'Eficiência da arrecadação', curto: 'Efic. arrecadação',
    category: 'administracao', type: 'calculated', unidade: '% do potencial', direction: 'higher_is_better',
    min: 60, max: 100, initial: 87, formatKind: 'percent',
    descricao: 'Arrecadação efetiva vs potencial teórico.' },

  { id: 'indice_transparencia', nome: 'Transparência pública', curto: 'Transparência',
    category: 'administracao', type: 'calculated', unidade: '0–100', direction: 'higher_is_better',
    min: 10, max: 100, initial: 55, formatKind: 'index',
    descricao: 'Índice de transparência orçamentária e de dados abertos.' },

  { id: 'indice_percepcao_corrupcao', nome: 'Índice de percepção da corrupção', curto: 'CPI corrupção',
    category: 'administracao', type: 'calculated', unidade: '0–100', direction: 'higher_is_better',
    min: 5, max: 95, initial: 36, formatKind: 'index',
    descricao: 'Índice da Transparência Internacional.' },

  { id: 'tempo_abertura_empresa', nome: 'Tempo para abrir uma empresa', curto: 'Abertura empresa',
    category: 'administracao', type: 'calculated', unidade: 'dias', direction: 'lower_is_better',
    min: 1, max: 60, initial: 12, formatKind: 'days',
    descricao: 'Dias para formalizar uma empresa.' },

  { id: 'servidores_por_mil', nome: 'Servidores públicos por mil hab.', curto: 'Servidores/mil',
    category: 'administracao', type: 'calculated', unidade: 'servidores/1.000 hab', direction: 'neutral',
    min: 3, max: 25, initial: 9, formatKind: 'per_thousand',
    descricao: 'Densidade de servidores públicos.' },

  { id: 'digitalizacao_servicos_pct', nome: 'Serviços públicos digitais', curto: 'Serviços digitais',
    category: 'administracao', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 100, initial: 65, formatKind: 'percent',
    descricao: 'Serviços públicos disponíveis 100% online.' },

  { id: 'tempo_medio_licitacao', nome: 'Tempo médio de licitação', curto: 'Tempo licitação',
    category: 'administracao', type: 'calculated', unidade: 'dias', direction: 'lower_is_better',
    min: 20, max: 400, initial: 180, formatKind: 'days',
    descricao: 'Duração média de um processo licitatório.' },

  { id: 'satisfacao_servicos_publicos', nome: 'Satisfação com serviços públicos', curto: 'Satisf. serv. púb.',
    category: 'administracao', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 90, initial: 42, formatKind: 'percent',
    descricao: 'Usuários satisfeitos com serviços públicos federais.' },

  { id: 'custo_administracao_pib', nome: 'Custo da máquina / PIB', curto: 'Custo adm./PIB',
    category: 'administracao', type: 'calculated', unidade: '% do PIB', direction: 'lower_is_better',
    min: 2, max: 20, initial: 6.5, formatKind: 'percent',
    descricao: 'Custeio administrativo / PIB.' },

  // =====================================================================
  // 11. CULTURA
  // =====================================================================
  { id: 'orcamento_cultura', nome: 'Orçamento da cultura', curto: 'Orç. cultura',
    category: 'cultura', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.5e9, max: 20e9, step: 0.2e9, initial: 3.5e9, formatKind: 'currency_year',
    descricao: 'Orçamento direto do Ministério da Cultura.' },

  { id: 'incentivos_culturais', nome: 'Incentivos à produção cultural', curto: 'Incentivos cult.',
    category: 'cultura', type: 'slider', unidade: 'R$/ano', direction: 'higher_is_better',
    min: 0.2e9, max: 15e9, step: 0.2e9, initial: 4.2e9, formatKind: 'currency_year',
    descricao: 'Lei Rouanet, Paulo Gustavo, Aldir Blanc, editais.' },

  { id: 'acesso_cultura_pct', nome: 'População com acesso à cultura', curto: 'Acesso cultura',
    category: 'cultura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 100, initial: 44, formatKind: 'percent',
    descricao: 'Pessoas que frequentaram equipamentos culturais no ano.' },

  { id: 'producao_audiovisual_ano', nome: 'Produção audiovisual nacional', curto: 'Produção audiovisual',
    category: 'cultura', type: 'calculated', unidade: 'obras/ano', direction: 'higher_is_better',
    min: 50, max: 800, initial: 220, formatKind: 'count',
    descricao: 'Longas nacionais lançados por ano.' },

  { id: 'patrimonio_preservado_pct', nome: 'Patrimônio em bom estado', curto: 'Patrimônio',
    category: 'cultura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 100, initial: 48, formatKind: 'percent',
    descricao: 'Bens tombados em bom estado de conservação.' },

  { id: 'empregos_culturais_num', nome: 'Empregos no setor cultural', curto: 'Empregos culturais',
    category: 'cultura', type: 'calculated', unidade: 'postos', direction: 'higher_is_better',
    min: 100000, max: 3000000, initial: 850000, formatKind: 'count',
    descricao: 'Postos de trabalho formais no setor criativo.' },

  { id: 'diversidade_cultural_pct', nome: 'Diversidade de expressões culturais', curto: 'Diversidade cult.',
    category: 'cultura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 10, max: 100, initial: 52, formatKind: 'percent',
    descricao: 'Índice de diversidade de manifestações apoiadas.' },

  { id: 'acervos_digitalizados_pct', nome: 'Acervos digitalizados', curto: 'Acervos digitais',
    category: 'cultura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 100, initial: 50, formatKind: 'percent',
    descricao: 'Acervos de museus e arquivos digitalizados.' },

  { id: 'economia_criativa_pib', nome: 'Economia criativa / PIB', curto: 'Econ. criativa',
    category: 'cultura', type: 'calculated', unidade: '% do PIB', direction: 'higher_is_better',
    min: 0.5, max: 8, initial: 2.6, formatKind: 'percent',
    descricao: 'PIB do setor criativo.' },

  { id: 'participacao_cultural_pct', nome: 'Participação em atividades culturais', curto: 'Participação cult.',
    category: 'cultura', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 5, max: 100, initial: 44, formatKind: 'percent',
    descricao: 'Pessoas que participaram de atividades culturais no mês.' },

  // =====================================================================
  // Indicador político (mantido na categoria social)
  // =====================================================================
  { id: 'aprovacao_popular', nome: 'Aprovação popular do governo', curto: 'Aprovação',
    category: 'social', type: 'calculated', unidade: '%', direction: 'higher_is_better',
    min: 1, max: 100, initial: 50, formatKind: 'percent',
    descricao: 'Avaliação positiva direta do governo.' },
];

export const INDICATORS_BY_ID = Object.fromEntries(
  INDICATORS.map((ind) => [ind.id, ind]),
) as Record<string, IndicatorDef>;

export const INDICATOR_IDS = INDICATORS.map((i) => i.id);

export function getIndicator(id: string): IndicatorDef {
  const ind = INDICATORS_BY_ID[id];
  if (!ind) {
    return {
      id, nome: id, curto: id, category: 'economia', type: 'calculated',
      unidade: '', direction: 'neutral', min: 0, max: 100, initial: 0,
      descricao: '', formatKind: 'physical',
    };
  }
  return ind;
}