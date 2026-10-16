import type { GameState } from '../../types/game';
import { SLIDER_IDS } from '../../data/sliders';
import { INDICATOR_IDS } from '../../data/indicators';
import { GROUP_IDS } from '../../data/groups';
import { STATES, STATE_IDS } from '../../data/states';
import { buildMeasureContext } from './measureContext';

/**
 * Prompt principal: interpreta uma medida em texto livre e devolve JSON
 * no formato MeasureInterpretationRaw.
 */
export function buildMeasurePrompt(
  playerText: string,
  state: GameState,
): string {
  const context = buildMeasureContext(state, playerText);

  const schema = {
    name: 'string',
    description: 'string',
    area: 'economia|saude|educacao|seguranca|infraestrutura|social|meioAmbiente|gestao',
    type: 'imposto|beneficio|corte|programa|investimento|regulacao',
    initialCost: 'number (R$ bilhões)',
    recurringCost: 'number (R$ bilhões/ano)',
    savings: 'number (R$ bilhões/ano)',
    revenue: 'number (R$ bilhões/ano)',
    indicatorEffects: [
      {
        indicatorId: `<um de: ${INDICATOR_IDS.join(', ')}>`,
        target: 'number (delta absoluto no indicador até o fim do ramp)',
        delayMonths: 'number (meses até começar)',
        rampMonths: 'number (meses para completar)',
        reason: 'string',
      },
    ],
    stateEffects: [
      {
        stateId: `<um de: ${STATE_IDS.map(id => `${id} (${STATES[id].name})`).join(', ')}>` ,
        target: 'number (variação total da aprovação estadual, 0 a 100)',
        delayMonths: 'number',
        rampMonths: 'number',
        reason: 'string (justificativa territorial direta)',
      },
    ],
    groupReactions: [
      {
        groupId: `<um de: ${GROUP_IDS.join(', ')}>`,
        intensity: 'number entre -1 (rejeita) e 1 (apoia)',
        reason: 'string',
      },
    ],
    sliderChanges: [
      {
        sliderId: `<um de: ${SLIDER_IDS.join(', ')}>`,
        newValue: 'number (dentro da faixa)',
        reason: 'string',
      },
    ],
    parameters: [
      { key: 'string', label: 'string', value: 'number', unit: 'string' },
    ],
    timeToEffect: 'number (meses até o primeiro efeito)',
    duration: 'number (meses) ou "permanente"',
    confidence: 'number entre 0 e 1',
    position: 'number entre -3 (esquerda) e 3 (direita). Opcional — omita se não conseguir identificar.',
  };

  return `Você é o interpretador de medidas de um jogo de simulação política do Brasil.
O jogador descreve uma medida em texto livre. Você devolve APENAS um JSON válido,
sem comentários, sem markdown, sem texto fora do JSON.

REGRAS:
1. Não invente indicadores, sliders, grupos ou estados. Use somente os IDs válidos.
2. Se a medida mexe num slider existente (ex.: salário mínimo, impostos), coloque em sliderChanges.
   Se cria algo novo (ex.: novo benefício), NÃO crie slider; registre em parameters com custos.
3. Custos, receitas e economias em R$ bilhões (número). Zero é válido.
4. Identifique somente indicadores nacionais diretamente afetados. Efeitos secundários serão calculados pelas regras do motor.
5. stateEffects é opcional: inclua somente estados citados pelo jogador ou claramente delimitados na medida. Não replique o efeito em todos os estados.
6. Toda medida precisa de pelo menos 1 efeito em indicador OU 1 mudança de slider.
7. Reações de grupos: entre -1 e 1. Só inclua grupos diretamente afetados.
8. delayMonths + rampMonths = tempo total até efeito pleno.
9. duration: "permanente" ou número de meses.
10. confidence: o quão seguro você está da interpretação (0 a 1).
11. Se identificar claramente a orientação política da medida, inclua "position" (-3 a 3).
   Se for ambígua, OMITA o campo. Não invente.

CONTEXTO ATUAL DO JOGO:
${context}

MEDIDA DO JOGADOR:
"""
${playerText}
"""

ESQUEMA ESPERADO (JSON):
${JSON.stringify(schema, null, 2)}

Responda somente com o JSON.`;
}

/** Prompt de correção quando a validação rejeita */
export function buildCorrectionPrompt(
  previousJson: string,
  errors: string[],
): string {
  return `O JSON abaixo foi rejeitado pela validação. Corrija APENAS os problemas listados
e devolva o JSON completo corrigido, sem comentários nem markdown.

ERROS:
${errors.map(e => `- ${e}`).join('\n')}

JSON ANTERIOR:
${previousJson}`;
}
