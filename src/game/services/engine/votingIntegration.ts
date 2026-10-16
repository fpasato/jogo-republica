import type { GameState } from '../../types/game';
import type { PolicyMeasure, PolicyArea, PolicyType } from '../../types/policy';
import type { VotingContext, VotingOutcome } from '../parliament/votingService';
import { GROUPS } from '../../data/groups';
import { simulateVoting, projectSupport } from '../parliament/votingService';
import { getMembers } from '../parliament/memberService';

// ─────────────────────────────────────────────────────────
// 1. POSIÇÃO IDEOLÓGICA — fallback por área + tipo
// ─────────────────────────────────────────────────────────

const AREA_POSITION: Record<PolicyArea, number> = {
  social:        -2,
  saude:         -1,
  educacao:      -1,
  meioAmbiente:  -2,
  infraestrutura: 0,
  gestao:         0,
  economia:       1,
  seguranca:      2,
};

const TYPE_ADJUSTMENT: Partial<Record<PolicyType, number>> = {
  imposto:        +0.5,   // mais à esquerda (mais Estado)
  corte:          -0.5,   // mais à direita
  beneficio:      -0.5,
  investimento:   +0.5,
  regulacao:      -0.5,
  programa:        0,
};

/** Resolve a posição: usa IA se veio, senão deriva da área + tipo */
export function resolvePosition(policy: PolicyMeasure): number {
  if (policy.position !== undefined) {
    return Math.max(-3, Math.min(3, policy.position));
  }
  const base = AREA_POSITION[policy.area] ?? 0;
  const adj = TYPE_ADJUSTMENT[policy.type] ?? 0;
  return Math.max(-3, Math.min(3, base + adj));
}

// ─────────────────────────────────────────────────────────
// 2. INSTRUMENTO JURÍDICO — mapeado do PolicyType
// ─────────────────────────────────────────────────────────

const TYPE_INSTRUMENT: Record<PolicyType, string> = {
  imposto:       'lei_complementar',
  beneficio:     'projeto_lei',
  corte:         'projeto_lei',
  programa:      'projeto_lei',
  investimento:  'projeto_lei',
  regulacao:     'medida_provisoria',
};

export function resolveInstrumentId(policy: PolicyMeasure): string {
  return policy.instrumentId ?? TYPE_INSTRUMENT[policy.type] ?? 'projeto_lei';
}

// ─────────────────────────────────────────────────────────
// 3. APELO DA MEDIDA — derivado das reações dos grupos
// ─────────────────────────────────────────────────────────

export function computeMeasureAppeal(policy: PolicyMeasure): number {
  let score = 0;
  let weight = 0;

  for (const r of policy.groupReactions) {
    const inf = GROUPS[r.groupId]?.influence ?? 0;
    score += r.intensity * inf;
    weight += inf;
  }

  if (weight === 0) return 0;
  // Média ponderada (-1..1) → escala -10..+10
  return Math.max(-10, Math.min(10, (score / weight) * 10));
}

// ─────────────────────────────────────────────────────────
// 4. CONTEXTO DE VOTAÇÃO — monta o VotingContext
// ─────────────────────────────────────────────────────────

export interface VotingBridgeInput {
  state: GameState;
  policy: PolicyMeasure;
  playerPartyId?: string | null;
  negotiation?: Record<string, number>;
  /** Bônus/penalidade adicional vindo da diluição (ex.: concessões reduzem apelo) */
  dilutionPenalty?: number;
}

export function buildVotingContext(input: VotingBridgeInput): VotingContext {
  const { state, policy, playerPartyId, negotiation, dilutionPenalty } = input;

  const baseAppeal = computeMeasureAppeal(policy);
  const measureAppeal = baseAppeal - (dilutionPenalty ?? 0);

  return {
    governmentApproval: state.indicators.aprovacao,
    measureAppeal: Math.max(-10, Math.min(10, measureAppeal)),
    policyPosition: resolvePosition(policy),
    playerPartyId: playerPartyId ?? null,
    negotiation: negotiation ?? {},
  };
}

// ─────────────────────────────────────────────────────────
// 5. EXECUÇÃO — roda a votação e devolve o outcome
// ─────────────────────────────────────────────────────────

export async function runPolicyVoting(
  saveId: number,
  input: VotingBridgeInput,
): Promise<VotingOutcome> {
  const ctx = buildVotingContext(input);
  const instrumentId = resolveInstrumentId(input.policy);

  const [camara, senado, stf] = await Promise.all([
    getMembers(saveId, 'camara'),
    getMembers(saveId, 'senado'),
    getMembers(saveId, 'stf'),
  ]);

  return simulateVoting(instrumentId, { camara, senado, stf }, ctx);
}

// ─────────────────────────────────────────────────────────
// 6. PROJEÇÃO — usa os mesmos membros salvos, sem sorteio
// ─────────────────────────────────────────────────────────

export async function projectPolicyVoting(
  saveId: number,
  input: VotingBridgeInput,
) {
  const ctx = buildVotingContext(input);
  const instrumentId = resolveInstrumentId(input.policy);

  const [camara, senado, stf] = await Promise.all([
    getMembers(saveId, 'camara'),
    getMembers(saveId, 'senado'),
    getMembers(saveId, 'stf'),
  ]);

  return projectSupport({ camara, senado, stf }, instrumentId, ctx);
}

// ─────────────────────────────────────────────────────────
// 7. DILUIÇÃO — aplica desconto nos efeitos quando há concessão
// ─────────────────────────────────────────────────────────

/**
 * Aplica diluição a uma política: reduz indicatorEffects e revenue.
 * Retorna uma nova PolicyMeasure (não muta a original).
 */
export function applyDilution(
  policy: PolicyMeasure,
  dilution: number,
): PolicyMeasure {
  if (dilution <= 0) return policy;
  const factor = 1 - dilution;

  return {
    ...policy,
    revenue: policy.revenue * factor,
    savings: policy.savings * factor,
    indicatorEffects: policy.indicatorEffects.map(e => ({
      ...e,
      target: e.target * factor,
    })),
    dilutionApplied: dilution,
  };
}