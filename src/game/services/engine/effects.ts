
import type {
    GameState,
    IndicatorId,
    GroupId,
} from '../../types/game';
import type { PolicyMeasure, IndicatorEffect, StateEffect } from '../../types/policy';
import { INDICATORS } from '../../data/indicators';
import { GROUPS, GROUP_IDS } from '../../data/groups';
import { SLIDERS } from '../../data/sliders';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/** Progresso do efeito (0 a 1) no turno atual */
export function effectProgress(
    effect: Pick<IndicatorEffect | StateEffect, 'delayMonths' | 'rampMonths'>,
    activatedAt: number,
    currentTurn: number,
): number {
    const elapsed = currentTurn - activatedAt;
    if (elapsed < effect.delayMonths) return 0;
    const ramp = elapsed - effect.delayMonths;
    if (ramp >= effect.rampMonths) return 1;
    return ramp / effect.rampMonths;
}

/**
 * Aplica efeitos graduais de todas as políticas ativas.
 * Usa a diferença entre progresso(t) e progresso(t-1) para nunca duplicar.
 */
export function applyIndicatorEffects(state: GameState): Record<IndicatorId, number> {
    const result = { ...state.indicators };

    for (const policy of state.activePolicies) {
        if (policy.status !== 'active') continue;
        if (policy.activatedAtTurn == null) continue;

        for (const effect of policy.indicatorEffects) {
            const def = INDICATORS[effect.indicatorId];
            if (!def) continue;

            const pNow = effectProgress(effect, policy.activatedAtTurn, state.turn);
            const pPrev = effectProgress(effect, policy.activatedAtTurn, state.turn - 1);
            const delta = effect.target * (pNow - pPrev);
            if (delta === 0) continue;

            result[effect.indicatorId] = clamp(
                result[effect.indicatorId] + delta,
                def.min,
                def.max,
            );
        }
    }

    return result;
}

/**
 * Recalcula apoio de cada grupo combinando:
 *  - Apoio atual (inércia)
 *  - Sensibilidade a sliders (posição atual vs. posição neutra)
 *  - Sensibilidade a indicadores (níveis vs. referência)
 *  - Reações de políticas ativas (one-shot já aplicado em applyPolicyReactions)
 */
export function computeGroupSupport(state: GameState): Record<GroupId, number> {
    const result = {} as Record<GroupId, number>;

    // Reações de políticas ativas (intensidade acumulada, uma vez por política)
    const policyReactions = new Map<GroupId, number>();
    for (const policy of state.activePolicies) {
        if (policy.status !== 'active') continue;
        for (const r of policy.groupReactions) {
            policyReactions.set(r.groupId, (policyReactions.get(r.groupId) ?? 0) + r.intensity * 5);
        }
    }

    for (const groupId of GROUP_IDS) {
        const group = GROUPS[groupId];
        const current = state.groups[groupId].support;

        // Base neutra: 50
        let target = 50;

        // Sliders: soma de (valor normalizado - 0.5) * sensibilidade * 40
        for (const [sliderId, sens] of Object.entries(group.sliderSensitivity)) {
            const def = SLIDERS[sliderId as keyof typeof SLIDERS];
            if (!def) continue;
            const value = state.sliders[sliderId as keyof typeof state.sliders];
            const normalized = (value - def.min) / (def.max - def.min);
            target += (normalized - 0.5) * sens * 40;
        }

        // Indicadores: soma de (valor normalizado - 0.5) * sensibilidade * 30
        for (const [indId, sens] of Object.entries(group.indicatorSensitivity)) {
            const value = state.indicators[indId as IndicatorId];
            const def = INDICATORS[indId as IndicatorId];
            if (!def) continue;
            const normalized = (value - def.min) / (def.max - def.min);
            target += (normalized - 0.5) * sens * 30;
        }

        // Reações a políticas ativas
        target += policyReactions.get(groupId) ?? 0;

        // Aproximação suave
        const next = current * 0.85 + clamp(target, 0, 100) * 0.15;
        result[groupId] = clamp(next, 0, 100);
    }

    return result;
}

/**
 * Calcula aprovação nacional = média ponderada dos apoios dos grupos.
 * O peso de cada grupo é seu `influence`.
 */
export function computeNationalApproval(groups: Record<GroupId, { support: number }>): number {
    let total = 0;
    let weightSum = 0;
    for (const groupId of GROUP_IDS) {
        const w = GROUPS[groupId].influence;
        total += groups[groupId].support * w;
        weightSum += w;
    }
    return weightSum > 0 ? total / weightSum : 50;
}

/**
 * Atualiza aprovação nos estados: cada estado se aproxima da aprovação nacional,
 * com inércia e diferença inicial.
 */
export function computeStateApprovals(
    state: GameState,
    nationalApproval: number,
): Record<string, { approval: number; lastChange: number }> {
    const result: Record<string, { approval: number; lastChange: number }> = {};

    for (const [stateId, snap] of Object.entries(state.states)) {
        let directDelta = 0;
        for (const policy of state.activePolicies) {
            if (policy.status !== 'active' || policy.activatedAtTurn == null) continue;
            for (const effect of policy.stateEffects ?? []) {
                if (effect.stateId !== stateId) continue;
                const pNow = effectProgress(effect, policy.activatedAtTurn, state.turn);
                const pPrev = effectProgress(effect, policy.activatedAtTurn, state.turn - 1);
                directDelta += effect.target * (pNow - pPrev);
            }
        }
        const next = snap.approval * 0.85 + nationalApproval * 0.15 + directDelta;
        result[stateId] = {
            approval: clamp(next, 0, 100),
            lastChange: next - snap.approval,
        };
    }

    return result;
}

/**
 * Aprovação nacional ponderada por peso político dos estados.
 * (Garante consistência entre popularidade por grupo e por estado.)
 */
export function approvalFromStates(
    stateApprovals: Record<string, { approval: number }>,
    stateWeights: Record<string, number>,
): number {
    let total = 0;
    let wSum = 0;
    for (const [stateId, snap] of Object.entries(stateApprovals)) {
        const w = stateWeights[stateId] ?? 0;
        total += snap.approval * w;
        wSum += w;
    }
    return wSum > 0 ? total / wSum : 50;
}

/** Verifica se uma política expirou neste turno */
export function isExpired(policy: PolicyMeasure, currentTurn: number): boolean {
    if (policy.duration === 'permanente') return false;
    if (policy.activatedAtTurn == null) return false;
    // A duração conta meses de jogo posteriores à aprovação. Uma política de
    // 1 mês aprovada no turno T permanece ativa durante o turno T+1.
    return currentTurn > policy.activatedAtTurn + policy.duration;
}
