import type { QueryCapability } from '../types/ai';

// ============================================================
// MENU DE CONSULTAS DISPONÍVEIS À IA
// ============================================================
// Este catálogo é a fonte única do que pode ser consultado.
//   - buildContext inclui este menu no contexto inicial.
//   - queryService valida os pedidos da IA contra estes tipos.
//   - promptBuilder orienta o modelo a usar SOMENTE estes tipos.

export const AVAILABLE_QUERIES: QueryCapability[] = [
  {
    type: 'national_indicators',
    description: 'Valores atuais de indicadores nacionais detalhados.',
    argsSchema: '{ "type": "national_indicators", "ids": string[] }',
    examples: [
      '{ "type": "national_indicators", "ids": ["acesso_saude", "tempo_espera_saude"] }',
      '{ "type": "national_indicators", "ids": ["homicidios", "roubos"] }',
    ],
    whenToUse: 'Precisa de um indicador detalhado nacional que não está no contexto inicial.',
  },
  {
    type: 'state_indicators',
    description: 'Indicadores detalhados de um estado específico.',
    argsSchema: '{ "type": "state_indicators", "state": "SP", "ids": string[] }',
    examples: [
      '{ "type": "state_indicators", "state": "RJ", "ids": ["homicidios", "efetivo_policial"] }',
    ],
    whenToUse: 'A proposta afeta um estado específico e você precisa dos valores atuais.',
  },
  {
    type: 'compare_states',
    description: 'Compara um indicador entre estados.',
    argsSchema: '{ "type": "compare_states", "indicator": string, "states"?: string[] }',
    examples: [
      '{ "type": "compare_states", "indicator": "homicidios", "states": ["RJ","SP","MG"] }',
    ],
    whenToUse: 'Quer saber se o valor de um estado está acima ou abaixo da média.',
  },
  {
    type: 'indicator_history',
    description: 'Série histórica de um indicador.',
    argsSchema:
      '{ "type": "indicator_history", "scope": "national"|"state", "state"?: string, "id": string, "months": 3..12 }',
    examples: [
      '{ "type": "indicator_history", "scope": "national", "id": "inflacao", "months": 6 }',
    ],
    whenToUse: 'Precisa ver a tendência de um indicador para além do resumo inicial.',
  },
  {
    type: 'group_details',
    description: 'Detalhes completos de um grupo social (eixos, reação, afinidade).',
    argsSchema: '{ "type": "group_details", "id": string }',
    examples: ['{ "type": "group_details", "id": "trabalhadores" }'],
    whenToUse: 'Precisa entender afinidades e reações de um grupo específico.',
  },
  {
    type: 'active_policies',
    description: 'Lista das políticas em vigor com efeitos e reações completos.',
    argsSchema: '{ "type": "active_policies" }',
    examples: ['{ "type": "active_policies" }'],
    whenToUse: 'Precisa detectar sobreposição ou sinergia com medidas vigentes.',
  },
];

export function getQueryCapability(type: string): QueryCapability | undefined {
  return AVAILABLE_QUERIES.find((q) => q.type === type);
}

export const VALID_QUERY_TYPES = new Set(AVAILABLE_QUERIES.map((q) => q.type));

export const QUERY_MENU_TEXT = AVAILABLE_QUERIES.map(
  (q) => `- ${q.type}: ${q.description}\n  args: ${q.argsSchema}`,
).join('\n');