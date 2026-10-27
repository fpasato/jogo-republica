// src/game/data/groupSensitivity.ts
// Sensibilidade dos 12 grupos a mudanças nos indicadores

export type GroupSensitivityMap = Record<string, Record<string, number>>;

export const GROUP_SENSITIVITY: GroupSensitivityMap = {
  // Conservadores: segurança, inflação, valores
  conservadores: {
    criminalidade: -0.4,
    homicidios: -0.3,
    inflacao: -0.3,
    qualidade_vida: 0.2,
  },
  // Progressistas: desigualdade, educação, saúde, cultura, pobreza
  progressistas: {
    desigualdade_renda: -0.5,
    taxa_pobreza: -0.4,
    qualidade_educacao: 0.3,
    producao_cultural: 0.3,
    acesso_cultura: 0.3,
    participacao_renovaveis: 0.4,
  },
  // Liberais econômicos: impostos, gastos, dívida, Selic, inflação
  liberais_economicos: {
    iva: -0.5,
    imposto_renda: -0.5,
    imposto_empresas: -0.6,
    divida_publica: -0.4,
    saldo_orcamentario: 0.5,
    inflacao: -0.4,
    crescimento_pib: 0.5,
  },
  // Trabalhistas e social-democratas: salário mínimo, emprego, serviços públicos
  trabalhistas: {
    salario_minimo: 0.6,
    desemprego: -0.6,
    bolsa_familia: 0.3,
    qualidade_saude: 0.3,
    qualidade_educacao: 0.3,
    desigualdade_renda: -0.4,
  },
  // Jovens: emprego, educação, moradia, salário mínimo, cultura
  jovens: {
    desemprego: -0.6,
    salario_minimo: 0.4,
    qualidade_educacao: 0.4,
    acesso_cultura: 0.3,
    investimento_habitacao: 0.3,
    participacao_renovaveis: 0.3,
  },
  // Idosos: saúde, medicamentos, aposentadoria, inflação
  idosos: {
    inflacao: -0.6,
    qualidade_saude: 0.5,
    acesso_saude: 0.5,
    tempo_espera_saude: -0.4,
  },
  // Religiosos: costumes, pobreza, assistência social
  religiosos: {
    taxa_pobreza: -0.4,
    criminalidade: -0.3,
    qualidade_vida: 0.3,
  },
  // População de baixa renda: Bolsa Família, salário mínimo, inflação, desemprego, habitação
  baixa_renda: {
    bolsa_familia: 0.8,
    salario_minimo: 0.7,
    inflacao: -0.7,
    desemprego: -0.6,
    investimento_habitacao: 0.4,
    acesso_saude: 0.4,
  },
  // Classe média: IR, inflação, desemprego, segurança, saúde, educação
  classe_media: {
    imposto_renda: -0.6,
    inflacao: -0.6,
    desemprego: -0.5,
    criminalidade: -0.4,
    qualidade_saude: 0.3,
    qualidade_educacao: 0.3,
    custo_energia: -0.3,
  },
  // Empresários: impostos, juros, crescimento, inflação, consumo
  empresarios: {
    imposto_empresas: -0.8,
    taxa_selic: -0.5,
    crescimento_pib: 0.6,
    inflacao: -0.4,
    investimento_publico: 0.3,
  },
  // Agronegócio: crédito, exportação, juros, estradas/investimento, energia
  agronegocio: {
    taxa_selic: -0.5,
    investimento_publico: 0.5,
    dolar: 0.4, // Dólar alto favorece exportações do agro
    custo_energia: -0.3,
  },
  // Servidores públicos: salários, contratação, orçamento
  servidores_publicos: {
    salarios_saude: 0.6,
    salarios_professores: 0.6,
    despesas_governo: 0.4,
    orcamento_assistencia_social: 0.2,
  },
};