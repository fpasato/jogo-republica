import type { IndicatorDef } from './indicators';
import { getIndicator, hasIndicator } from './indicators';
import type { StateId, StateStructural } from './states';
import { STATES } from './states';
import { estimateStateIdh } from './idh';

type Spec = (s: StateStructural) => number;


// ============================================================
// 1. BASE NACIONAL — valor médio do Brasil para cada indicador estadual
// ============================================================

const BASE: Record<string, number> = {
  // Economia
  desemprego: 8.0,
  crescimento_pib: 2.0,
  poder_compra: 60,
  informalidade: 40,
  investimentos_privados: 0,      // derivado
  receitas_publicas: 0,           // derivado
  gastos_publicos: 0,             // derivado
  saldo_orcamentario: 0,          // derivado
  investimentos_publicos: 0,      // derivado
  orcamento_saude: 0,             // derivado
  orcamento_educacao: 0,          // derivado

  // Saúde
  acesso_saude: 60,
  tempo_espera_saude: 45,
  cobertura_vacinacao: 75,
  medicos_por_habitante: 2.5,
  capacidade_hospitais: 55,
  ocupacao_hospitais: 75,
  mortalidade_infantil: 12,
  mortalidade_materna: 60,
  satisfacao_saude: 50,

  // Educação
  frequencia_escolar: 92,
  evasao_escolar: 8,
  conclusao_medio: 65,
  alfabetizacao: 93,
  analfabetismo: 7,
  infraestrutura_escolar: 55,
  acesso_educacao_infantil: 65,
  professores_por_aluno: 22,

  // Segurança
  homicidios: 22,
  roubos: 400,
  furtos: 500,
  investigacao_policial: 45,
  crimes_solucionados: 35,
  efetivo_policial: 300,
  tempo_resposta_policial: 18,
  capacidade_prisional: 50,
  percepcao_seguranca: 45,

  // Infraestrutura
  acesso_agua: 85,
  coleta_esgoto: 65,
  tratamento_esgoto: 55,
  qualidade_estradas: 55,
  acesso_internet: 80,
  qualidade_transporte: 50,
  tempo_deslocamento: 40,
  investimento_infraestrutura: 0, // derivado

  // Social
  pobreza: 30,
  pobreza_extrema: 7,
  gini: 0.52,
  renda_media: 2200,
  moradia_adequada: 70,
  desemprego_jovem: 20,
  familias_programas_sociais: 0,  // derivado
  pessoas_rua: 0,                 // derivado

  // Ambiente
  desmatamento: 0,                // derivado
  qualidade_ar: 65,
  qualidade_agua: 60,
  emissoes_gee: 0,                // derivado
  renovaveis_energia: 60,
  capacidade_geracao: 0,          // derivado
  custo_energia: 0.85,
  reciclagem: 25,
  areas_protegidas: 15,

  // Gestão
  eficiencia_gastos: 50,
  execucao_orcamento: 85,
  investimentos_concluidos: 0,    // derivado
  qualidade_servicos: 50,
  tempo_espera_servicos: 30,
  capacidade_administrativa: 50,
  transparencia: 60,
  irregularidades: 0,             // derivado
  eficiencia_arrecadacao: 70,

  // Política
  satisfacao_servicos: 50,
  idh: 0.7, // recalculado por estado a partir de saúde, educação e renda
};

// ============================================================
// 2. AJUSTE REGIONAL — soma sobre a base
// ============================================================

const REGION_DELTA: Record<string, Record<string, number>> = {
  Norte: {
    acesso_saude: -10, tempo_espera_saude: +15, medicos_por_habitante: -1.0,
    mortalidade_infantil: +5, mortalidade_materna: +20,
    frequencia_escolar: -6, evasao_escolar: +6, conclusao_medio: -12,
    infraestrutura_escolar: -10, professores_por_aluno: +3,
    homicidios: +10, roubos: -100, investigacao_policial: -10,
    acesso_agua: -20, coleta_esgoto: -30, tratamento_esgoto: -25,
    qualidade_estradas: -20, acesso_internet: -20,
    pobreza: +15, pobreza_extrema: +5, renda_media: -700, gini: +0.03,
    desmatamento: +1500, emissoes_gee: +5_000_000,
    eficiencia_gastos: -8, transparencia: -10,
  },
  Nordeste: {
    acesso_saude: -12, tempo_espera_saude: +18, medicos_por_habitante: -1.2,
    mortalidade_infantil: +6, mortalidade_materna: +25,
    frequencia_escolar: -8, evasao_escolar: +7, conclusao_medio: -15,
    alfabetizacao: -6, analfabetismo: +6, infraestrutura_escolar: -12,
    professores_por_aluno: +4, acesso_educacao_infantil: -10,
    homicidios: +15, roubos: -50, investigacao_policial: -12,
    acesso_agua: -15, coleta_esgoto: -25, tratamento_esgoto: -20,
    qualidade_estradas: -15, acesso_internet: -15, qualidade_transporte: -10,
    pobreza: +20, pobreza_extrema: +7, renda_media: -900, gini: +0.04,
    desemprego: +3, informalidade: +8, poder_compra: -12,
    eficiencia_gastos: -10, transparencia: -12, capacidade_administrativa: -8,
  },
  'Centro-Oeste': {
    acesso_saude: -3, medicos_por_habitante: -0.3,
    frequencia_escolar: -1, conclusao_medio: +2,
    homicidios: +5, roubos: -50,
    acesso_agua: +3, coleta_esgoto: -5,
    renda_media: +300, pobreza: -5,
    desmatamento: +800, emissoes_gee: +3_000_000,
    eficiencia_gastos: +2, transparencia: +2,
  },
  Sudeste: {
    acesso_saude: +6, tempo_espera_saude: -5, medicos_por_habitante: +0.7,
    frequencia_escolar: +3, conclusao_medio: +6, infraestrutura_escolar: +8,
    homicidios: -3, investigacao_policial: +5,
    acesso_agua: +8, coleta_esgoto: +12, tratamento_esgoto: +10,
    qualidade_estradas: +8, acesso_internet: +8,
    pobreza: -8, renda_media: +500,
    eficiencia_gastos: +5, transparencia: +5, capacidade_administrativa: +5,
  },
  Sul: {
    acesso_saude: +8, tempo_espera_saude: -8, medicos_por_habitante: +0.9,
    frequencia_escolar: +4, conclusao_medio: +8, infraestrutura_escolar: +10,
    alfabetizacao: +2, analfabetismo: -2,
    homicidios: -5, percepcao_seguranca: +10,
    acesso_agua: +8, coleta_esgoto: +15, tratamento_esgoto: +15,
    qualidade_estradas: +12, acesso_internet: +8,
    pobreza: -10, renda_media: +600,
    eficiencia_gastos: +8, transparencia: +6,
  },
};

// ============================================================
// 3. OVERRIDES POR ESTADO — exceções pontuais
// ============================================================

const STATE_OVERRIDE: Partial<Record<StateId, Record<string, number>>> = {
  SP: {
    desemprego: -1.5, informalidade: -6, renda_media: +400,
    // Taxa estadual de homicídios por 100 mil habitantes (DATASUS, 2023).
    homicidios: 6.35, roubos: +50,
    coleta_esgoto: +8, acesso_internet: +5,
    gini: +0.01, tempo_deslocamento: +15,
  },
  RJ: {
    // Taxa estadual de homicídios por 100 mil habitantes (DATASUS, 2023).
    homicidios: 20, roubos: +250, furtos: +200,
    percepcao_seguranca: -15, investigacao_policial: -8, crimes_solucionados: -10,
    capacidade_prisional: -15, tempo_resposta_policial: +6,
    renda_media: -200, pobreza: +5,
    eficiencia_gastos: -8,
  },
  MG: {
    homicidios: -4, renda_media: -100,
    acesso_agua: +5, coleta_esgoto: +5,
  },
  ES: {
    homicidios: +8, renda_media: +200,
    acesso_agua: +5, coleta_esgoto: +5,
  },
  BA: {
    desemprego: +2, informalidade: +5, renda_media: -300,
    homicidios: +20, pobreza: +5,
  },
  PE: { homicidios: +18, renda_media: -200 },
  CE: { homicidios: +15, renda_media: -150 },
  DF: {
    renda_media: +1500, gini: +0.05, pobreza: -15,
    medicos_por_habitante: +1.5, acesso_saude: +12,
    homicidios: -8, investigacao_policial: +15,
    coleta_esgoto: +15, acesso_internet: +8,
    transparencia: +15, capacidade_administrativa: +12, eficiencia_arrecadacao: +10,
  },
  MT: { desmatamento: +2500, renda_media: +500, homicidios: +5 },
  PA: { desmatamento: +3500, homicidios: +15 },
  AM: { desmatamento: +1200 },
  RO: { desmatamento: +800, renda_media: +300 },
  SC: {
    renda_media: +300, pobreza: -5, homicidios: -6,
    acesso_internet: +5, coleta_esgoto: +8, transparencia: +5,
  },
  RS: { homicidios: +3, renda_media: +150 },
  PR: { renda_media: +200, homicidios: -2 },
};

// ============================================================
// 4. DERIVADOS — valores que dependem da população do estado
// ============================================================
// Unidades monetárias em R$ bilhões, conforme o catálogo.

const DERIVED: Record<string, Spec> = {
  // População × ~0,40 — aproximação dos formais sobre a PEA
  empregos_formais: (s) => s.population * s.peaShare * 0.65,

  // Investimento privado ≈ R$ 8.000/hab/ano → bilhões
  investimentos_privados: (s) => (s.population * 8_000) / 1e9,

  // Arrecadação estadual ≈ R$ 6.000/hab/ano → bilhões
  receitas_publicas: (s) => (s.population * 6_000) / 1e9,

  // Gastos estaduais ≈ R$ 6.200/hab/ano → bilhões
  gastos_publicos: (s) => (s.population * 6_200) / 1e9,

  // Saldo levemente negativo na média
  saldo_orcamentario: (s) => -(s.population * 200) / 1e9,

  // Investimento público ≈ R$ 400/hab/ano → bilhões
  investimentos_publicos: (s) => (s.population * 400) / 1e9,

  // Orçamento da saúde estadual ≈ R$ 900/hab/ano → bilhões
  orcamento_saude: (s) => (s.population * 900) / 1e9,

  // Orçamento da educação estadual ≈ R$ 1.100/hab/ano → bilhões
  orcamento_educacao: (s) => (s.population * 1_100) / 1e9,

  // Infraestrutura: R$ 350/hab/ano → bilhões
  investimento_infraestrutura: (s) => (s.population * 350) / 1e9,

  // Déficit habitacional ≈ 8% dos domicílios (≈ pop/3)
  deficit_habitacional: (s) => (s.population / 3) * 0.08,

  // Programas sociais ≈ 15% das famílias (≈ pop/3)
  familias_programas_sociais: (s) => (s.population / 3) * 0.15,

  // Pessoas em situação de rua ≈ 0,03% da população
  pessoas_rua: (s) => s.population * 0.0003,

  // Emissões ≈ 6 tCO₂e/hab/ano (base; Norte/Centro-Oeste somam mais)
  emissoes_gee: (s) => s.population * 6,

  // Capacidade de geração ≈ 500 kW/hab (base)
  capacidade_geracao: (s) => (s.population * 500) / 1000,

  // Desmatamento base — só estados com bioma relevante recebem via região/override
  desmatamento: () => 0,

  // Investimentos concluídos ≈ 1 projeto por 100 mil hab/ano
  investimentos_concluidos: (s) => Math.round(s.population / 100_000),

  // Irregularidades ≈ 0,01% da população
  irregularidades: (s) => Math.round(s.population * 0.0001),
};

// ============================================================
// BUILD
// ============================================================

function clampToCatalog(id: string, value: number): number {
  const ind: IndicatorDef | undefined = hasIndicator(id) ? getIndicator(id) : undefined;
  if (!ind) return value;
  return Math.max(ind.min, Math.min(ind.max, value));
}

function buildForState(state: StateStructural): Record<string, number> {
  const out: Record<string, number> = {};

  // Aplica sobre todos os ids que têm valor estadual
  const ids = new Set<string>([
    ...Object.keys(BASE),
    ...Object.keys(DERIVED),
  ]);

  for (const id of ids) {
    // Derivados sempre vencem — são proporcionais à população
    if (DERIVED[id]) {
      out[id] = clampToCatalog(id, DERIVED[id](state));
      continue;
    }

    let v = BASE[id] ?? 0;
    v += REGION_DELTA[state.region]?.[id] ?? 0;
    out[id] = clampToCatalog(id, v);
  }

  // Overrides por estado vencem tudo
  const ov = STATE_OVERRIDE[state.id];
  if (ov) {
    for (const [id, value] of Object.entries(ov)) {
      out[id] = clampToCatalog(id, value);
    }
  }

  // Proxy do IDH para o jogo: média geométrica de saúde, educação e renda.
  // Não pretende reproduzir o cálculo oficial, que exige outros dados.
  out.idh = estimateStateIdh(out);

  return out;
}

export const STATE_BASELINES = Object.fromEntries(
  (Object.keys(STATES) as StateId[]).map((id) => [id, buildForState(STATES[id])]),
) as Record<StateId, Record<string, number>>;

/** Conveniência: valor inicial de um indicador num estado. */
export function baselineOf(stateId: StateId, indicatorId: string): number {
  return STATE_BASELINES[stateId][indicatorId];
}

// ============================================================
// LADO NACIONAL dos indicadores "national_and_state"
// ============================================================
// Os indicadores nacionais independentes já têm `initial` no catálogo.
// Aqui ficam só os que têm um valor federal separado do estadual.

export const NATIONAL_SIDE_INITIAL: Record<string, number> = {
  receitas_publicas: 2400,     // R$ bi/ano
  gastos_publicos: 2600,       // R$ bi/ano
  saldo_orcamentario: -200,    // R$ bi/ano
  investimentos_publicos: 150, // R$ bi/ano
  orcamento_saude: 200,        // R$ bi/ano (federal)
  orcamento_educacao: 180,     // R$ bi/ano (federal)
  investimento_infraestrutura: 90,
  eficiencia_gastos: 52,
  execucao_orcamento: 88,
  investimentos_concluidos: 350,
  qualidade_servicos: 50,
  tempo_espera_servicos: 25,
  capacidade_administrativa: 55,
  transparencia: 62,
  irregularidades: 120,
  eficiencia_arrecadacao: 72,
};
