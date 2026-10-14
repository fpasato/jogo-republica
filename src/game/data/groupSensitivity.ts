// ============================================================
// SENSIBILIDADE: grupo → { indicador → peso }
// ============================================================
//
// Como ler: `trabalhadores: { desemprego: -1.2 }` significa que
// +1 p.p. de desemprego derruba a aprovação dos trabalhadores em
// ~1,2 ponto no mês (antes da modulação por combatividade).
//
// Regras de calibração:
//   - Grupos com `combatividade > 1` amplificam tudo.
//   - O motor multiplica pelo `combatividade` do grupo.
//   - Use ordem de grandeza "realista": indicadores que o grupo
//     sente no bolso/na vida valem 0,5 a 1,5; secundários 0,1–0,3.
//
// Nomes dos indicadores batem com data/indicators.ts.

export type GroupSensitivityMap = Record<string, Record<string, number>>;

export const GROUP_SENSITIVITY: GroupSensitivityMap = {
  // ----------------------------------------------------------
  // ECONÔMICOS
  // ----------------------------------------------------------
  empresarios: {
    selic: -0.5,
    divida_publica: -0.3,
    carga_tributaria: -0.8,
    crescimento_pib: 0.9,
    inflacao: -0.4,
    informalidade: -0.3,
    investimentos_privados: 0.5,
    eficiencia_gastos: 0.4,
    transparencia: 0.3,
  },
  mercado_financeiro: {
    selic: 0.3,           // juros altos agradam o mercado no curto prazo
    inflacao: -0.9,
    divida_publica: -0.8,
    cotacao_dolar: -0.5,
    crescimento_pib: 0.4,
    saldo_orcamentario: 0.7,
    eficiencia_gastos: 0.6,
    transparencia: 0.4,
  },
  agronegocio: {
    cotacao_dolar: 0.7,   // dólar alto favorece exportador
    qualidade_estradas: 0.5,
    acesso_internet: 0.3,
    desmatamento: -0.1,   // sensível, mas não prioridade
    custo_energia: -0.6,
    investimento_infraestrutura: 0.5,
    eficiencia_arrecadacao: -0.2,
  },

  // ----------------------------------------------------------
  // TRABALHO
  // ----------------------------------------------------------
  trabalhadores: {
    desemprego: -1.2,
    poder_compra: 0.9,
    salario_minimo: 0.5,
    inflacao: -0.8,
    renda_media: 0.6,
    informalidade: -0.5,
    desemprego_jovem: -0.4,
    gini: -0.4,
    pobreza: -0.5,
  },
  servidores_publicos: {
    inflacao: -0.9,
    poder_compra: 0.7,
    qualidade_servicos: 0.4,
    eficiencia_gastos: -0.2,
    execucao_orcamento: 0.3,
  },
  aposentados: {
    inflacao: -1.0,
    poder_compra: 0.9,
    acesso_saude: 0.7,
    tempo_espera_saude: -0.6,
    renda_media: 0.3,
    mortalidade_infantil: 0.1,
  },
  jovens: {
    desemprego_jovem: -1.1,
    desemprego: -0.6,
    acesso_educacao_infantil: 0.4,
    conclusao_medio: 0.5,
    acesso_internet: 0.3,
    renda_media: 0.3,
  },

  // ----------------------------------------------------------
  // SEGURANÇA E ORDEM
  // ----------------------------------------------------------
  conservadores: {
    homicidios: -0.8,
    roubos: -0.7,
    furtos: -0.4,
    percepcao_seguranca: 1.0,
    efetivo_policial: 0.5,
    capacidade_prisional: 0.4,
  },
  militares: {
    homicidios: -0.4,
    percepcao_seguranca: 0.5,
    efetivo_policial: 0.3,
    // lealdade_militar é macro, tratado à parte
  },
  policiais: {
    homicidios: -0.6,
    roubos: -0.5,
    efetivo_policial: 0.8,
    capacidade_prisional: 0.5,
    investigacao_policial: 0.6,
    tempo_resposta_policial: -0.5,
    percepcao_seguranca: 0.6,
  },

  // ----------------------------------------------------------
  // IGREJA E COSTUMES
  // ----------------------------------------------------------
  religiosos: {
    // Sensíveis a costumes — tratados via reações diretas de medidas
    // (a IA passa os grupos afetados). Poucos indicadores numéricos.
    homicidios: -0.3,
    pobreza: -0.2,
  },

  // ----------------------------------------------------------
  // SOCIAIS E DIREITOS
  // ----------------------------------------------------------
  progressistas: {
    pobreza: -0.7,
    gini: -0.8,
    desemprego: -0.5,
    homicidios: -0.4,
    acesso_saude: 0.5,
    acesso_educacao_infantil: 0.4,
    alfabetizacao: 0.4,
    desmatamento: -0.5,
    qualidade_ar: 0.4,
  },
  socialistas: {
    pobreza: -0.9,
    gini: -1.0,
    desemprego: -0.8,
    renda_media: 0.5,
    familias_programas_sociais: 0.6,
  },
  movimento_negro: {
    pobreza: -0.7,
    gini: -0.9,
    homicidios: -0.6,
    renda_media: 0.5,
    acesso_educacao_infantil: 0.4,
  },
  feministas: {
    pobreza: -0.4,
    gini: -0.5,
    mortalidade_materna: -0.8,
    acesso_saude: 0.5,
  },
  lgbtqia: {
    pobreza: -0.3,
    gini: -0.4,
    homicidios: -0.4,
  },
  povos_indigenas: {
    desmatamento: -1.2,
    qualidade_agua: 0.7,
    areas_protegidas: 1.0,
    acesso_saude: 0.6,
    homicidios: -0.4,
  },

  // ----------------------------------------------------------
  // CONHECIMENTO E CULTURA
  // ----------------------------------------------------------
  universitarios: {
    desemprego_jovem: -0.7,
    infraestrutura_escolar: 0.6,
    orcamento_educacao: 0.8,
    conclusao_medio: 0.4,
    acesso_internet: 0.3,
  },
  ciencia: {
    orcamento_educacao: 0.7,
    infraestrutura_escolar: 0.5,
    acesso_internet: 0.4,
    desmatamento: -0.5,
    qualidade_ar: 0.4,
  },
  artistas: {
    orcamento_educacao: 0.3,
    orcamento_saude: 0.2,
    pobreza: -0.3,
    gini: -0.3,
    desmatamento: -0.3,
  },
};

// ============================================================
// HELPERS
// ============================================================

/** Retorna o peso de um indicador para um grupo (0 se não sensível). */
export function sensitivityOf(groupId: string, indicatorId: string): number {
  return GROUP_SENSITIVITY[groupId]?.[indicatorId] ?? 0;
}

/** Lista os grupos que reagem a um indicador (peso ≠ 0). */
export function groupsReactingTo(indicatorId: string): string[] {
  const out: string[] = [];
  for (const [groupId, map] of Object.entries(GROUP_SENSITIVITY)) {
    if (map[indicatorId]) out.push(groupId);
  }
  return out;
}

/** Lista os indicadores que um grupo sente. */
export function indicatorsFeltBy(groupId: string): string[] {
  return Object.keys(GROUP_SENSITIVITY[groupId] ?? {});
}