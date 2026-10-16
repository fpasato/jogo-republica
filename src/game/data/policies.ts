import type { PolicyMeasure } from '../types/policy';

/**
 * Catálogo de medidas pré-prontas.
 * Servem como sementes e exemplos — o jogador também pode criar via IA.
 * Estrutura idêntica à usada pelo motor para qualquer medida.
 */
export const POLICY_CATALOG: PolicyMeasure[] = [
  {
    id: 'catalog_beneficio_familias',
    name: 'Benefício mensal para famílias de baixa renda',
    description: 'Transferência mensal para famílias em situação de vulnerabilidade.',
    area: 'social',
    type: 'beneficio',
    initialCost: 5,
    recurringCost: 30,
    savings: 0,
    revenue: 0,
    indicatorEffects: [
      { indicatorId: 'poderCompra',       target: 8,  delayMonths: 2, rampMonths: 6, reason: 'Renda adicional às famílias' },
      { indicatorId: 'gini',              target: -0.03, delayMonths: 3, rampMonths: 12, reason: 'Redução da desigualdade' },
      { indicatorId: 'idh',               target: 0.02, delayMonths: 6, rampMonths: 18, reason: 'Melhora no desenvolvimento humano' },
      { indicatorId: 'despesaPublica',    target: 30, delayMonths: 1, rampMonths: 1, reason: 'Gasto recorrente' },
    ],
    groupReactions: [
      { groupId: 'beneficiarios',    intensity:  0.9, reason: 'Beneficiários diretos' },
      { groupId: 'trabalhadores',    intensity:  0.5, reason: 'Base trabalhadora' },
      { groupId: 'socialistas',      intensity:  0.8, reason: 'Bandeira histórica' },
      { groupId: 'progressistas',    intensity:  0.6, reason: 'Pauta social' },
      { groupId: 'mercadoFinanceiro',intensity: -0.4, reason: 'Aumento de gasto' },
      { groupId: 'conservadores',    intensity: -0.2, reason: 'Gasto público elevado' },
    ],
    timeToEffect: 3,
    duration: 'permanente',
    status: 'draft',
    createdAtTurn: 0,
    source: 'catalog',
  },
  {
    id: 'catalog_combate_crime',
    name: 'Programa de combate ao crime organizado',
    description: 'Reforço de policiamento e inteligência em áreas críticas.',
    area: 'seguranca',
    type: 'programa',
    initialCost: 8,
    recurringCost: 15,
    savings: 0,
    revenue: 0,
    indicatorEffects: [
      { indicatorId: 'criminalidade', target: -12, delayMonths: 3, rampMonths: 12, reason: 'Ação ostensiva' },
      { indicatorId: 'confiancaInstituicoes', target: 5, delayMonths: 4, rampMonths: 12, reason: 'Percepção de ordem' },
      { indicatorId: 'despesaPublica', target: 15, delayMonths: 1, rampMonths: 1, reason: 'Custeio' },
    ],
    groupReactions: [
      { groupId: 'segurancaMilitar', intensity:  0.8, reason: 'Ampliação de recursos' },
      { groupId: 'conservadores',    intensity:  0.7, reason: 'Pauta de ordem' },
      { groupId: 'populacaoGeral',   intensity:  0.5, reason: 'Percepção de segurança' },
      { groupId: 'progressistas',    intensity: -0.3, reason: 'Preocupação com direitos' },
    ],
    timeToEffect: 4,
    duration: 'permanente',
    status: 'draft',
    createdAtTurn: 0,
    source: 'catalog',
  },
  {
    id: 'catalog_reforma_tributaria',
    name: 'Reforma tributária progressiva',
    description: 'Aumento de alíquotas sobre renda e patrimônio.',
    area: 'economia',
    type: 'imposto',
    initialCost: 0,
    recurringCost: 0,
    savings: 0,
    revenue: 40,
    indicatorEffects: [
      { indicatorId: 'receitaPublica',     target: 40,  delayMonths: 3, rampMonths: 6, reason: 'Nova arrecadação' },
      { indicatorId: 'gini',               target: -0.04, delayMonths: 6, rampMonths: 18, reason: 'Redistribuição' },
      { indicatorId: 'saldoOrcamentario',  target: 40,  delayMonths: 3, rampMonths: 6, reason: 'Melhora fiscal' },
    ],
    groupReactions: [
      { groupId: 'socialistas',      intensity:  0.9, reason: 'Pauta central' },
      { groupId: 'progressistas',    intensity:  0.7, reason: 'Justiça fiscal' },
      { groupId: 'empresarios',      intensity: -0.8, reason: 'Aumento de carga' },
      { groupId: 'mercadoFinanceiro',intensity: -0.5, reason: 'Impacto em investimentos' },
      { groupId: 'agronegocio',      intensity: -0.7, reason: 'Setor afetado' },
    ],
    sliderChanges: [
      { sliderId: 'impostos', newValue: 30, reason: 'Reforma aumenta carga média' },
    ],
    timeToEffect: 6,
    duration: 'permanente',
    status: 'draft',
    createdAtTurn: 0,
    source: 'catalog',
  },
];