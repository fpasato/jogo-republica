import type { GameState } from '../../types/game';
import type { PolicyMeasure } from '../../types/policy';
import type { MeasureInterpretationRaw } from '../../types/ai';
import { callOllama } from './ollamaClient';
import { buildMeasurePrompt, buildCorrectionPrompt } from './measurePrompts';
import { validateMeasure } from './validation';

const MAX_ATTEMPTS = 2;

export interface InterpretMeasureResult {
  success: boolean;
  policy?: PolicyMeasure;
  raw?: MeasureInterpretationRaw;
  errors: string[];
  warnings: string[];
  elapsedMs: number;
}

/**
 * Fluxo principal:
 *  1. Chama Ollama com o prompt de interpretação
 *  2. Valida
 *  3. Se falhar, tenta corrigir uma vez
 *  4. Converte para PolicyMeasure e devolve
 */
export async function interpretMeasure(
  playerText: string,
  state: GameState,
): Promise<InterpretMeasureResult> {
  const started = Date.now();
  let lastRaw: string | undefined;
  let lastErrors: string[] = [];
  let lastWarnings: string[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 0
        ? buildMeasurePrompt(playerText, state)
        : buildCorrectionPrompt(lastRaw ?? '', lastErrors);

    let response;
    try {
      response = await callOllama(prompt, { format: 'json', temperature: 0.3 });
    } catch (err) {
      return {
        success: false,
        errors: [`Falha ao chamar Ollama: ${(err as Error).message}`],
        warnings: [],
        elapsedMs: Date.now() - started,
      };
    }

    lastRaw = response.raw;

    // Se a resposta veio malformada, tenta extrair JSON por segurança
    let parsed: unknown = response.parsed;
    if (!parsed) {
      parsed = tryExtractJson(response.raw);
    }

    const validation = validateMeasure(parsed, playerText);
    lastErrors = validation.errors;
    lastWarnings = validation.warnings;

    if (validation.valid && validation.normalized) {
      const policy = toPolicyMeasure(validation.normalized, state.turn);
      return {
        success: true,
        policy,
        raw: validation.normalized,
        errors: [],
        warnings: validation.warnings,
        elapsedMs: Date.now() - started,
      };
    }
  }

  return {
    success: false,
    errors: lastErrors,
    warnings: lastWarnings,
    elapsedMs: Date.now() - started,
  };
}

/** Tenta achar um JSON dentro de uma string bruta (útil se o modelo "vazar" texto) */
function tryExtractJson(text: string): unknown {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return undefined;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return undefined;
  }
}

/** Converte o resultado validado em PolicyMeasure pronta para o motor */
function toPolicyMeasure(
  raw: MeasureInterpretationRaw,
  currentTurn: number,
): PolicyMeasure {
  return {
    id: `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: raw.name,
    description: raw.description,
    area: raw.area,
    type: raw.type,
    initialCost: raw.initialCost,
    recurringCost: raw.recurringCost,
    savings: raw.savings,
    revenue: raw.revenue,
    indicatorEffects: raw.indicatorEffects,
    stateEffects: raw.stateEffects,
    groupReactions: raw.groupReactions,
    sliderChanges: raw.sliderChanges,
    parameters: raw.parameters,
    timeToEffect: raw.timeToEffect,
    duration: raw.duration,
    status: 'draft',
    createdAtTurn: currentTurn,
    source: 'player',
    confidence: raw.confidence,
    position: raw.position,
  };
}
