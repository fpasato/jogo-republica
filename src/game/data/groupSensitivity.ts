// src/game/data/groupSensitivity.ts
// Sensibilidade dos 12 grupos a mudanças nos indicadores

export type GroupSensitivityMap = Record<string, Record<string, number>>;

export const GROUP_SENSITIVITY: GroupSensitivityMap = {
  // Conservadores: segurança, inflação, valores, ordem fiscal
  conservadores: {
    criminalidade: -0.4,
    homicidios: -0.3,
    inflacao: -0.4,
    qualidade_vida: 0.2,
    efetivo_policial: 0.3,
    orcamento_seguranca: 0.3,
    saldo_orcamentario: 0.2,
    divida_publica: -0.2,
  },
  // Progressistas: desigualdade, educação, saúde, cultura, pobreza, sustentabilidade
  progressistas: {
    desigualdade_renda: -0.5,
    taxa_pobreza: -0.4,
    orcamento_educacao: 0.4,
    orcamento_saude: 0.3,
    qualidade_educacao: 0.3,
    producao_cultural: 0.3,
    acesso_cultura: 0.3,
    orcamento_cultura: 0.4,
    participacao_renovaveis: 0.4,
    investimento_energia: 0.3,
    bolsa_familia: 0.3,
  },
  // Liberais econômicos: impostos, gastos, dívida, Selic, inflação, liberdade de mercado
  liberais_economicos: {
    iva: -0.6,
    imposto_renda: -0.5,
    imposto_empresas: -0.6,
    divida_publica: -0.4,
    saldo_orcamentario: 0.5,
    inflacao: -0.4,
    crescimento_pib: 0.5,
    despesas_governo: -0.4,
  },
  // Trabalhistas e social-democratas: salário mínimo, emprego, serviços públicos, previdência
  trabalhistas: {
    salario_minimo: 0.6,
    desemprego: -0.6,
    bolsa_familia: 0.4,
    orcamento_saude: 0.3,
    orcamento_educacao: 0.3,
    qualidade_saude: 0.3,
    qualidade_educacao: 0.3,
    desigualdade_renda: -0.4,
    iva: -0.3, // IVA encarece cesta básica e consumo da classe trabalhadora
  },
  // Jovens: emprego, educação, moradia, salário mínimo, cultura, custo de vida
  jovens: {
    desemprego: -0.6,
    salario_minimo: 0.4,
    orcamento_educacao: 0.4,
    qualidade_educacao: 0.4,
    orcamento_cultura: 0.3,
    acesso_cultura: 0.3,
    investimento_habitacao: 0.3,
    participacao_renovaveis: 0.3,
    iva: -0.3, // Encarece eletrônicos, lazer, vestuário
  },
  // Idosos: saúde, medicamentos, aposentadoria, inflação, serviços essenciais
  idosos: {
    inflacao: -0.6,
    orcamento_saude: 0.5,
    qualidade_saude: 0.5,
    acesso_saude: 0.5,
    tempo_espera_saude: -0.4,
    salarios_saude: 0.2,
    iva: -0.3, // Encarece remédios e alimentos
  },
  // Religiosos: costumes, família, assistência social, combate à pobreza, segurança
  religiosos: {
    taxa_pobreza: -0.4,
    bolsa_familia: 0.3,
    orcamento_assistencia_social: 0.3,
    criminalidade: -0.3,
    qualidade_vida: 0.3,
    homicidios: -0.2,
  },
  // População de baixa renda: Bolsa Família, salário mínimo, inflação, alimentos, consumo essencial
  baixa_renda: {
    bolsa_familia: 0.8,
    salario_minimo: 0.7,
    inflacao: -0.7,
    desemprego: -0.6,
    investimento_habitacao: 0.4,
    acesso_saude: 0.4,
    orcamento_saude: 0.3,
    iva: -0.6, // Imposto sobre consumo pesa proporcionalmente muito mais no pobre
  },
  // Classe média: IR, IVA, inflação, desemprego, segurança, saúde, educação
  classe_media: {
    iva: -0.5, // Consome produtos e serviços tributados pelo IVA
    imposto_renda: -0.6,
    inflacao: -0.6,
    desemprego: -0.5,
    criminalidade: -0.4,
    orcamento_seguranca: 0.3,
    qualidade_saude: 0.3,
    qualidade_educacao: 0.3,
    custo_energia: -0.3,
  },
  // Empresários: impostos, juros, crescimento, inflação, consumo, custo de produção
  empresarios: {
    iva: -0.5, // Reduz consumo das famílias e encarece vendas
    imposto_empresas: -0.8,
    taxa_selic: -0.5,
    crescimento_pib: 0.6,
    inflacao: -0.4,
    investimento_publico: 0.4,
    salario_minimo: -0.3, // Aumento abrupto eleva custo de folha
  },
  // Agronegócio: crédito, exportação, juros, estradas/investimento, energia, diesel
  agronegocio: {
    taxa_selic: -0.5,
    investimento_publico: 0.5, // Infraestrutura de escoamento de safra
    dolar: 0.4, // Dólar alto favorece exportações do agro
    custo_energia: -0.3,
    iva: -0.3, // Insumos e maquinários agrícolas
    imposto_empresas: -0.4,
  },
  // Servidores públicos: salários, contratação, orçamento dos ministérios
  servidores_publicos: {
    salarios_saude: 0.6,
    salarios_professores: 0.6,
    orcamento_saude: 0.4,
    orcamento_educacao: 0.4,
    orcamento_seguranca: 0.3,
    despesas_governo: 0.4,
    orcamento_assistencia_social: 0.3,
  },
};