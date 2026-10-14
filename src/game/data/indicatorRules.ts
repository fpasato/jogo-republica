import type { StateId } from './states';
import type { IndicatorDef } from './indicators';
import { getIndicator } from './indicators';

// ============================================================
// TIPOS
// ============================================================

/**
 * Como o destino reage à variação da origem.
 *
 * - `elasticity`     → ambos são taxas/índices: Δ%dest = elasticidade × Δ%origem
 * - `unit_response`  → origem absoluta, destino contínuo: Δdest = (Δorigem / unit) × per
 *
 * Ex. elasticity: salário mínimo sobe 10% → poder de compra sobe 0.3 × 10% = 3%
 * Ex. unit_response: R$ 20 bi a mais em saúde → -0.15 × (20/1) = -3 dias de espera
 */
export type RuleKind =
  | { type: 'elasticity'; elasticity: number }
  | { type: 'unit_response'; per: number; unit: number };

export interface RuleContext {
  sourceValue: number;
  sourceDelta: number;
  targetValue: number;
  sourceDef: IndicatorDef;
  targetDef: IndicatorDef;
  stateId?: StateId;
}

export interface IndicatorRule {
  id: string;
  source: string;
  target: string;
  kind: RuleKind;
  /**
   * Ordem de processamento dentro do mês.
   * Regras menores rodam antes. O motor processa em ordem crescente
   * e cada regra vê o resultado já atualizado das anteriores.
   */
  order: number;
  /** Meses de espera antes da regra começar a fazer efeito. Default 0. */
  delay?: number;
  /** Meses para distribuir o efeito total. Default 1 (imediato). */
  duration?: number;
  /** Restringe a estados específicos. Ausente = todos (quando aplicável). */
  states?: StateId[];
  /** Condição opcional avaliada a cada execução. */
  when?: (ctx: RuleContext) => boolean;
  /** Explicação em linguagem natural — vai também pro contexto da IA. */
  description: string;
  /** Apenas para organização visual. */
  category: string;
}

// ============================================================
// ATALHOS
// ============================================================

const E = (elasticity: number): RuleKind => ({ type: 'elasticity', elasticity });
const U = (per: number, unit = 1): RuleKind => ({ type: 'unit_response', per, unit });

// ============================================================
// REGRAS
// ============================================================
// Ordem por blocos causais:
//   10-19 macro (câmbio, juros, atividade)
//   20-29 mercado de trabalho e renda
//   30-39 saúde
//   40-49 educação
//   50-59 segurança
//   60-69 infraestrutura e saneamento
//   70-79 social e desigualdade
//   80-89 ambiente
//   90-99 gestão pública
//   100+  satisfação política (agrega tudo)

const RULES: IndicatorRule[] = [
  // ============================================================
  // 10–19 MACROECONOMIA
  // ============================================================
  {
    id: 'dolar_inflacao',
    source: 'cotacao_dolar',
    target: 'inflacao',
    kind: E(0.35),
    order: 10,
    delay: 1,
    duration: 3,
    description: 'Dólar mais caro pressiona a inflação (repasse cambial).',
    category: 'macro',
  },
  {
    id: 'selic_investimento_privado',
    source: 'selic',
    target: 'investimentos_privados',
    kind: E(-0.55),
    order: 11,
    delay: 1,
    duration: 3,
    description: 'Juros altos reduzem investimento privado.',
    category: 'macro',
  },
  {
    id: 'selic_inflacao',
    source: 'selic',
    target: 'inflacao',
    kind: E(-0.30),
    order: 12,
    delay: 2,
    duration: 6,
    description: 'Juros altos esfriam a demanda e reduzem a inflação.',
    category: 'macro',
  },
  {
    id: 'inflacao_selic',
    source: 'inflacao',
    target: 'selic',
    kind: E(0.45),
    order: 13,
    delay: 1,
    duration: 2,
    description: 'Banco Central reage à inflação subindo a Selic.',
    category: 'macro',
  },
  {
    id: 'pib_desemprego',
    source: 'crescimento_pib',
    target: 'desemprego',
    kind: E(-0.50),
    order: 14,
    delay: 1,
    duration: 4,
    description: 'Lei de Okun: crescimento reduz desemprego.',
    category: 'macro',
  },
  {
    id: 'juros_dolar',
    source: 'selic',
    target: 'cotacao_dolar',
    kind: E(-0.25),
    order: 15,
    delay: 1,
    duration: 3,
    description: 'Juros altos atraem capital externo e apreciam o real.',
    category: 'macro',
  },

  // ============================================================
  // 20–29 TRABALHO E RENDA
  // ============================================================
  {
    id: 'salario_minimo_poder_compra',
    source: 'salario_minimo',
    target: 'poder_compra',
    kind: E(0.30),
    order: 20,
    description: 'Aumento do salário mínimo eleva o poder de compra.',
    category: 'trabalho',
  },
  {
    id: 'salario_minimo_desemprego',
    source: 'salario_minimo',
    target: 'desemprego',
    kind: E(0.12),
    order: 21,
    delay: 2,
    duration: 6,
    description: 'Mínimo mais alto encarece contratações; efeito pequeno.',
    category: 'trabalho',
  },
  {
    id: 'salario_minimo_informalidade',
    source: 'salario_minimo',
    target: 'informalidade',
    kind: E(0.10),
    order: 22,
    delay: 3,
    duration: 6,
    description: 'Custo maior do trabalho formal empurra parte para a informalidade.',
    category: 'trabalho',
  },
  {
    id: 'salario_minimo_inflacao',
    source: 'salario_minimo',
    target: 'inflacao',
    kind: E(0.08),
    order: 23,
    delay: 2,
    duration: 4,
    description: 'Reajuste do mínimo gera pequena pressão inflacionária.',
    category: 'trabalho',
  },
  {
    id: 'desemprego_pobreza',
    source: 'desemprego',
    target: 'pobreza',
    kind: E(0.45),
    order: 24,
    delay: 1,
    duration: 3,
    description: 'Mais desemprego aumenta a pobreza.',
    category: 'trabalho',
  },
  {
    id: 'informalidade_pobreza',
    source: 'informalidade',
    target: 'pobreza',
    kind: E(0.25),
    order: 25,
    delay: 1,
    duration: 4,
    description: 'Informalidade reduz renda média e amplia pobreza.',
    category: 'trabalho',
  },
  {
    id: 'informalidade_renda',
    source: 'informalidade',
    target: 'renda_media',
    kind: E(-0.30),
    order: 26,
    delay: 1,
    duration: 4,
    description: 'Informalidade puxa a renda média para baixo.',
    category: 'trabalho',
  },

  // ============================================================
  // 30–39 SAÚDE
  // ============================================================
  {
    id: 'orcamento_saude_acesso',
    source: 'orcamento_saude',
    target: 'acesso_saude',
    kind: E(0.40),
    order: 30,
    delay: 1,
    duration: 4,
    description: 'Mais verba na saúde amplia o acesso.',
    category: 'saude',
  },
  {
    id: 'orcamento_saude_espera',
    source: 'orcamento_saude',
    target: 'tempo_espera_saude',
    kind: U(-0.15, 1),
    order: 31,
    delay: 1,
    duration: 4,
    description: 'Cada R$ 1 bi extra reduz ~0,15 dia de espera.',
    category: 'saude',
  },
  {
    id: 'orcamento_saude_medicos',
    source: 'orcamento_saude',
    target: 'medicos_por_habitante',
    kind: U(0.004, 1),
    order: 32,
    delay: 3,
    duration: 8,
    description: 'Investimento em saúde amplia o efetivo médico.',
    category: 'saude',
  },
  {
    id: 'acesso_mortalidade_infantil',
    source: 'acesso_saude',
    target: 'mortalidade_infantil',
    kind: E(-0.40),
    order: 33,
    delay: 2,
    duration: 6,
    description: 'Acesso à saúde reduz mortalidade infantil.',
    category: 'saude',
  },
  {
    id: 'acesso_mortalidade_materna',
    source: 'acesso_saude',
    target: 'mortalidade_materna',
    kind: E(-0.45),
    order: 34,
    delay: 2,
    duration: 6,
    description: 'Acesso à saúde reduz mortalidade materna.',
    category: 'saude',
  },
  {
    id: 'agua_mortalidade_infantil',
    source: 'acesso_agua',
    target: 'mortalidade_infantil',
    kind: E(-0.25),
    order: 35,
    delay: 2,
    duration: 6,
    description: 'Água tratada reduz doenças e mortalidade infantil.',
    category: 'saude',
  },
  {
    id: 'esgoto_mortalidade_infantil',
    source: 'coleta_esgoto',
    target: 'mortalidade_infantil',
    kind: E(-0.20),
    order: 36,
    delay: 2,
    duration: 6,
    description: 'Saneamento reduz mortalidade infantil.',
    category: 'saude',
  },
  {
    id: 'espera_satisfacao_saude',
    source: 'tempo_espera_saude',
    target: 'satisfacao_saude',
    kind: E(-0.55),
    order: 37,
    delay: 1,
    duration: 2,
    description: 'Filas longas derrubam a satisfação com a saúde.',
    category: 'saude',
  },
  {
    id: 'acesso_satisfacao_saude',
    source: 'acesso_saude',
    target: 'satisfacao_saude',
    kind: E(0.35),
    order: 38,
    delay: 1,
    duration: 3,
    description: 'Bom acesso melhora a percepção da saúde.',
    category: 'saude',
  },

  // ============================================================
  // 40–49 EDUCAÇÃO
  // ============================================================
  {
    id: 'orcamento_educacao_infraestrutura',
    source: 'orcamento_educacao',
    target: 'infraestrutura_escolar',
    kind: E(0.45),
    order: 40,
    delay: 1,
    duration: 5,
    description: 'Verba de educação melhora a infraestrutura escolar.',
    category: 'educacao',
  },
  {
    id: 'orcamento_educacao_professores',
    source: 'orcamento_educacao',
    target: 'professores_por_aluno',
    kind: U(-0.15, 1),
    order: 41,
    delay: 2,
    duration: 6,
    description: 'Mais verba reduz alunos por professor (contratações).',
    category: 'educacao',
  },
  {
    id: 'infraestrutura_frequencia',
    source: 'infraestrutura_escolar',
    target: 'frequencia_escolar',
    kind: E(0.25),
    order: 42,
    delay: 2,
    duration: 6,
    description: 'Escola melhor atrai e retém alunos.',
    category: 'educacao',
  },
  {
    id: 'infraestrutura_evasao',
    source: 'infraestrutura_escolar',
    target: 'evasao_escolar',
    kind: E(-0.30),
    order: 43,
    delay: 2,
    duration: 6,
    description: 'Infraestrutura reduz evasão.',
    category: 'educacao',
  },
  {
    id: 'frequencia_conclusao',
    source: 'frequencia_escolar',
    target: 'conclusao_medio',
    kind: E(0.45),
    order: 44,
    delay: 3,
    duration: 12,
    description: 'Frequência vira conclusão do médio alguns anos depois.',
    category: 'educacao',
  },
  {
    id: 'alfabetizacao_renda',
    source: 'alfabetizacao',
    target: 'renda_media',
    kind: E(0.30),
    order: 45,
    delay: 6,
    duration: 12,
    description: 'Alfabetização melhora produtividade e renda no longo prazo.',
    category: 'educacao',
  },
  {
    id: 'conclusao_renda',
    source: 'conclusao_medio',
    target: 'renda_media',
    kind: E(0.25),
    order: 46,
    delay: 6,
    duration: 12,
    description: 'Conclusão do médio aumenta renda futura.',
    category: 'educacao',
  },

  // ============================================================
  // 50–59 SEGURANÇA
  // ============================================================
  {
    id: 'efetivo_homicidios',
    source: 'efetivo_policial',
    target: 'homicidios',
    kind: E(-0.30),
    order: 50,
    delay: 1,
    duration: 4,
    description: 'Mais policiais reduzem homicídios.',
    category: 'seguranca',
  },
  {
    id: 'investigacao_solucionados',
    source: 'investigacao_policial',
    target: 'crimes_solucionados',
    kind: E(0.55),
    order: 51,
    delay: 1,
    duration: 3,
    description: 'Capacidade de investigação aumenta crimes solucionados.',
    category: 'seguranca',
  },
  {
    id: 'solucionados_homicidios',
    source: 'crimes_solucionados',
    target: 'homicidios',
    kind: E(-0.20),
    order: 52,
    delay: 3,
    duration: 6,
    description: 'Impunidade menor dissuade homicídios.',
    category: 'seguranca',
  },
  {
    id: 'homicidios_percepcao',
    source: 'homicidios',
    target: 'percepcao_seguranca',
    kind: E(-0.60),
    order: 53,
    delay: 1,
    duration: 2,
    description: 'Homicídios derrubam a percepção de segurança.',
    category: 'seguranca',
  },
  {
    id: 'roubos_percepcao',
    source: 'roubos',
    target: 'percepcao_seguranca',
    kind: E(-0.30),
    order: 54,
    delay: 1,
    duration: 2,
    description: 'Roubos afetam a percepção de segurança.',
    category: 'seguranca',
  },
  {
    id: 'tempo_resposta_percepcao',
    source: 'tempo_resposta_policial',
    target: 'percepcao_seguranca',
    kind: E(-0.25),
    order: 55,
    delay: 1,
    duration: 2,
    description: 'Demora no atendimento reduz sensação de segurança.',
    category: 'seguranca',
  },
  {
    id: 'pobreza_homicidios',
    source: 'pobreza',
    target: 'homicidios',
    kind: E(0.35),
    order: 56,
    delay: 3,
    duration: 8,
    description: 'Pobreza alimenta violência no médio prazo.',
    category: 'seguranca',
  },

  // ============================================================
  // 60–69 INFRAESTRUTURA E SANEAMENTO
  // ============================================================
  {
    id: 'invest_infra_agua',
    source: 'investimento_infraestrutura',
    target: 'acesso_agua',
    kind: E(0.30),
    order: 60,
    delay: 1,
    duration: 6,
    description: 'Investimento em infraestrutura amplia acesso à água.',
    category: 'infraestrutura',
  },
  {
    id: 'invest_infra_esgoto',
    source: 'investimento_infraestrutura',
    target: 'coleta_esgoto',
    kind: E(0.35),
    order: 61,
    delay: 1,
    duration: 6,
    description: 'Investimento expande coleta de esgoto.',
    category: 'infraestrutura',
  },
  {
    id: 'invest_infra_estradas',
    source: 'investimento_infraestrutura',
    target: 'qualidade_estradas',
    kind: E(0.40),
    order: 62,
    delay: 1,
    duration: 6,
    description: 'Investimento melhora estradas.',
    category: 'infraestrutura',
  },
  {
    id: 'invest_infra_internet',
    source: 'investimento_infraestrutura',
    target: 'acesso_internet',
    kind: E(0.25),
    order: 63,
    delay: 2,
    duration: 8,
    description: 'Investimento amplia acesso à internet.',
    category: 'infraestrutura',
  },
  {
    id: 'esgoto_qualidade_agua',
    source: 'coleta_esgoto',
    target: 'qualidade_agua',
    kind: E(0.45),
    order: 64,
    delay: 2,
    duration: 6,
    description: 'Mais esgoto coletado melhora a qualidade da água.',
    category: 'infraestrutura',
  },
  {
    id: 'tratamento_qualidade_agua',
    source: 'tratamento_esgoto',
    target: 'qualidade_agua',
    kind: E(0.35),
    order: 65,
    delay: 2,
    duration: 6,
    description: 'Tratamento protege rios e mananciais.',
    category: 'infraestrutura',
  },
  {
    id: 'internet_renda',
    source: 'acesso_internet',
    target: 'renda_media',
    kind: E(0.15),
    order: 66,
    delay: 6,
    duration: 12,
    description: 'Conectividade melhora produtividade e renda.',
    category: 'infraestrutura',
  },

  // ============================================================
  // 70–79 SOCIAL E DESIGUALDADE
  // ============================================================
  {
    id: 'renda_pobreza',
    source: 'renda_media',
    target: 'pobreza',
    kind: E(-0.55),
    order: 70,
    delay: 1,
    duration: 3,
    description: 'Renda maior reduz pobreza.',
    category: 'social',
  },
  {
    id: 'renda_poder_compra',
    source: 'renda_media',
    target: 'poder_compra',
    kind: E(0.50),
    order: 71,
    delay: 1,
    duration: 2,
    description: 'Renda maior eleva o poder de compra.',
    category: 'social',
  },
  {
    id: 'programas_pobreza',
    source: 'familias_programas_sociais',
    target: 'pobreza',
    kind: E(-0.25),
    order: 72,
    delay: 1,
    duration: 3,
    description: 'Programas sociais reduzem pobreza.',
    category: 'social',
  },
  {
    id: 'programas_pobreza_extrema',
    source: 'familias_programas_sociais',
    target: 'pobreza_extrema',
    kind: E(-0.45),
    order: 73,
    delay: 1,
    duration: 3,
    description: 'Programas atingem principalmente a pobreza extrema.',
    category: 'social',
  },
  {
    id: 'gini_pobreza',
    source: 'gini',
    target: 'pobreza',
    kind: E(0.20),
    order: 74,
    delay: 2,
    duration: 6,
    description: 'Mais desigualdade aumenta pobreza.',
    category: 'social',
  },
  {
    id: 'pobreza_rua',
    source: 'pobreza',
    target: 'pessoas_rua',
    kind: E(0.40),
    order: 75,
    delay: 2,
    duration: 6,
    description: 'Pobreza empurra pessoas para a situação de rua.',
    category: 'social',
  },
  {
    id: 'desemprego_jovem_homicidios',
    source: 'desemprego_jovem',
    target: 'homicidios',
    kind: E(0.20),
    order: 76,
    delay: 3,
    duration: 8,
    description: 'Desemprego jovem está ligado à violência.',
    category: 'social',
  },

  // ============================================================
  // 80–89 AMBIENTE
  // ============================================================
  {
    id: 'desmatamento_emissoes',
    source: 'desmatamento',
    target: 'emissoes_gee',
    kind: U(3000, 1),
    order: 80,
    description: 'Cada km² desmatado libera ~3.000 tCO₂e.',
    category: 'ambiente',
  },
  {
    id: 'renovaveis_emissoes',
    source: 'renovaveis_energia',
    target: 'emissoes_gee',
    kind: E(-0.40),
    order: 81,
    delay: 2,
    duration: 6,
    description: 'Mais renováveis reduzem emissões.',
    category: 'ambiente',
  },
  {
    id: 'desmatamento_qualidade_ar',
    source: 'desmatamento',
    target: 'qualidade_ar',
    kind: E(-0.15),
    order: 82,
    delay: 2,
    duration: 6,
    description: 'Queimadas e desmatamento pioram o ar.',
    category: 'ambiente',
  },
  {
    id: 'emissoes_qualidade_ar',
    source: 'emissoes_gee',
    target: 'qualidade_ar',
    kind: E(-0.25),
    order: 83,
    delay: 2,
    duration: 6,
    description: 'Emissões pioram a qualidade do ar.',
    category: 'ambiente',
  },
  {
    id: 'qualidade_agua_saude',
    source: 'qualidade_agua',
    target: 'acesso_saude',
    kind: E(0.10),
    order: 84,
    delay: 2,
    duration: 6,
    description: 'Água limpa reduz demanda e melhora indicadores de saúde.',
    category: 'ambiente',
  },

  // ============================================================
  // 90–99 GESTÃO PÚBLICA
  // ============================================================
  {
    id: 'transparencia_irregularidades',
    source: 'transparencia',
    target: 'irregularidades',
    kind: E(-0.45),
    order: 90,
    delay: 2,
    duration: 4,
    description: 'Transparência reduz irregularidades.',
    category: 'gestao',
  },
  {
    id: 'capacidade_eficiencia',
    source: 'capacidade_administrativa',
    target: 'eficiencia_gastos',
    kind: E(0.40),
    order: 91,
    delay: 1,
    duration: 4,
    description: 'Capacidade administrativa melhora eficiência dos gastos.',
    category: 'gestao',
  },
  {
    id: 'eficiencia_qualidade_servicos',
    source: 'eficiencia_gastos',
    target: 'qualidade_servicos',
    kind: E(0.45),
    order: 92,
    delay: 1,
    duration: 4,
    description: 'Gastar bem melhora os serviços entregues.',
    category: 'gestao',
  },
  {
    id: 'execucao_concluidos',
    source: 'execucao_orcamento',
    target: 'investimentos_concluidos',
    kind: E(0.50),
    order: 93,
    delay: 1,
    duration: 3,
    description: 'Boa execução orçamentária entrega mais obras.',
    category: 'gestao',
  },
  {
    id: 'eficiencia_arrecadacao_receita',
    source: 'eficiencia_arrecadacao',
    target: 'receitas_publicas',
    kind: E(0.35),
    order: 94,
    delay: 1,
    duration: 4,
    description: 'Arrecadar melhor aumenta receita sem subir imposto.',
    category: 'gestao',
  },
  {
    id: 'qualidade_servicos_satisfacao',
    source: 'qualidade_servicos',
    target: 'satisfacao_servicos',
    kind: E(0.50),
    order: 95,
    delay: 1,
    duration: 3,
    description: 'Serviço de qualidade eleva a satisfação.',
    category: 'gestao',
  },
  {
    id: 'tempo_espera_satisfacao',
    source: 'tempo_espera_servicos',
    target: 'satisfacao_servicos',
    kind: E(-0.40),
    order: 96,
    delay: 1,
    duration: 2,
    description: 'Filas longas derrubam a satisfação geral.',
    category: 'gestao',
  },

  // ============================================================
  // 100+ SATISFAÇÃO POLÍTICA (convergência de tudo)
  // ============================================================
  {
    id: 'desemprego_satisfacao',
    source: 'desemprego',
    target: 'satisfacao_servicos',
    kind: E(-0.35),
    order: 100,
    delay: 1,
    duration: 3,
    description: 'Desemprego corrói a satisfação com o governo.',
    category: 'politica',
  },
  {
    id: 'renda_satisfacao',
    source: 'renda_media',
    target: 'satisfacao_servicos',
    kind: E(0.25),
    order: 101,
    delay: 1,
    duration: 3,
    description: 'Renda melhor aumenta a satisfação.',
    category: 'politica',
  },
  {
    id: 'inflacao_satisfacao',
    source: 'inflacao',
    target: 'satisfacao_servicos',
    kind: E(-0.40),
    order: 102,
    delay: 1,
    duration: 2,
    description: 'Inflação é o que mais corrói a percepção do governo.',
    category: 'politica',
  },
  {
    id: 'homicidios_satisfacao',
    source: 'homicidios',
    target: 'satisfacao_servicos',
    kind: E(-0.20),
    order: 103,
    delay: 1,
    duration: 3,
    description: 'Violência afeta a percepção geral do governo.',
    category: 'politica',
  },
  {
    id: 'satisfacao_servicos_confianca',
    source: 'satisfacao_servicos',
    target: 'confianca_instituicoes',
    kind: E(0.55),
    order: 110,
    delay: 1,
    duration: 3,
    description: 'Boa entrega de serviços eleva a confiança nas instituições.',
    category: 'politica',
  },
];

// ============================================================
// ÍNDICES
// ============================================================

export const INDICATOR_RULES: IndicatorRule[] = [...RULES].sort(
  (a, b) => a.order - b.order,
);

export const RULES_BY_ID: Record<string, IndicatorRule> = Object.fromEntries(
  RULES.map((r) => [r.id, r]),
);

export const RULES_BY_SOURCE: Record<string, IndicatorRule[]> = (() => {
  const map: Record<string, IndicatorRule[]> = {};
  for (const r of INDICATOR_RULES) (map[r.source] ??= []).push(r);
  return map;
})();

export const RULES_BY_TARGET: Record<string, IndicatorRule[]> = (() => {
  const map: Record<string, IndicatorRule[]> = {};
  for (const r of INDICATOR_RULES) (map[r.target] ??= []).push(r);
  return map;
})();

// ============================================================
// HELPERS
// ============================================================

export function rulesFrom(sourceId: string): IndicatorRule[] {
  return RULES_BY_SOURCE[sourceId] ?? [];
}

export function rulesTo(targetId: string): IndicatorRule[] {
  return RULES_BY_TARGET[targetId] ?? [];
}

/** Detecta ciclos simples A→B→A no grafo. Útil pra avisar em dev. */
export function detectDirectCycles(): Array<[string, string]> {
  const cycles: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const r of INDICATOR_RULES) {
    const pair = [r.source, r.target].sort().join('|');
    if (seen.has(pair)) continue;
    seen.add(pair);
    const back = RULES_BY_SOURCE[r.target]?.some((x) => x.target === r.source);
    if (back) cycles.push([r.source, r.target]);
  }
  return cycles;
}

/** Simula o efeito de uma regra dado o Δ da origem e o valor atual do destino. */
export function computeRuleDelta(
  rule: IndicatorRule,
  sourceValue: number,
  sourceDelta: number,
  targetValue: number,
  stateId?: StateId,
): number {
  const sourceDef = getIndicator(rule.source);
  const targetDef = getIndicator(rule.target);

  if (rule.when && !rule.when({ sourceValue, sourceDelta, targetValue, sourceDef, targetDef, stateId })) {
    return 0;
  }

  if (rule.kind.type === 'elasticity') {
    if (sourceValue === 0) return 0;
    const pctSource = (sourceDelta / sourceValue) * 100;
    const pctTarget = rule.kind.elasticity * pctSource;
    return (pctTarget / 100) * targetValue;
  }

  // unit_response
  const steps = sourceDelta / rule.kind.unit;
  return steps * rule.kind.per;
}