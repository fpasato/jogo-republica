import type { IndicatorRule } from '../../data/indicatorRules';
import {
  computeRuleDelta,
  INDICATOR_RULES,
} from '../../data/indicatorRules';

import type { IndicatorScope } from '../../data/indicators';
import { getIndicator } from '../../data/indicators';

import type { StateId } from '../../data/states';
import { STATE_IDS } from '../../data/states';

import { aggregateAll } from './aggregation';
import { computeNaturalDrift } from './naturalDrift';

// ============================================================
// TIPOS
// ============================================================

export interface PendingEffect {
    /** id único da fila (permite rastrear no log). */
    id: string;
    ruleId: string;
    targetId: string;
    stateId: StateId | null;       // null = nacional
    perParcelDelta: number;        // parcela aplicada por turno
    parcelsLeft: number;           // quantas parcelas ainda faltam
    turnsUntilStart: number;       // delay antes da primeira parcela
}

export interface TurnInput {
    month: number;
    stateIndicators: Record<StateId, Record<string, number>>;
    nationalIndicators: Record<string, number>;
    /** Mudanças brutas que JÁ aconteceram antes das regras rodarem. */
    rawDeltas: {
        states: Record<StateId, Record<string, number>>;
        national: Record<string, number>;
    };
    pendingEffects: PendingEffect[];
}

export interface TurnLogEntry {
    kind: 'raw' | 'pending' | 'rule' | 'aggregate';
    indicatorId: string;
    stateId: StateId | null;
    delta: number;
    ruleId?: string;
    reason: string;
}

export interface TurnResult {
    stateIndicators: Record<StateId, Record<string, number>>;
    nationalIndicators: Record<string, number>;
    pendingEffects: PendingEffect[];
    log: TurnLogEntry[];
}

// ============================================================
// HELPERS DE ESCOPO
// ============================================================

const EPS = 1e-6;

function scopeOf(id: string): IndicatorScope {
    return getIndicator(id).scope;
}

function isNationalValue(id: string): boolean {
    const s = scopeOf(id);
    return s === 'national' || s === 'national_and_state';
}

// ============================================================
// APLICAÇÃO
// ============================================================

function applyStateDelta(
    values: Record<StateId, Record<string, number>>,
    stateId: StateId,
    indicatorId: string,
    delta: number,
): void {
    const ind = getIndicator(indicatorId);
    const current = values[stateId][indicatorId] ?? 0;
    const next = Math.max(ind.min, Math.min(ind.max, current + delta));
    values[stateId][indicatorId] = next;
}

function applyNationalDelta(
    values: Record<string, number>,
    indicatorId: string,
    delta: number,
): void {
    const ind = getIndicator(indicatorId);
    const current = values[indicatorId] ?? 0;
    const next = Math.max(ind.min, Math.min(ind.max, current + delta));
    values[indicatorId] = next;
}

// ============================================================
// PROCESSAMENTO DOS EFEITOS PENDENTES (fila)
// ============================================================

function processPending(
    input: TurnInput,
    stateValues: Record<StateId, Record<string, number>>,
    nationalValues: Record<string, number>,
    log: TurnLogEntry[],
): PendingEffect[] {
    const stillPending: PendingEffect[] = [];

    for (const eff of input.pendingEffects) {
        let { turnsUntilStart, parcelsLeft } = eff;

        // Fase de delay
        if (turnsUntilStart > 0) {
            stillPending.push({ ...eff, turnsUntilStart: turnsUntilStart - 1 });
            continue;
        }

        // Fase de parcelas
        if (parcelsLeft > 0) {
            if (eff.stateId === null) {
                applyNationalDelta(nationalValues, eff.targetId, eff.perParcelDelta);
            } else {
                applyStateDelta(stateValues, eff.stateId, eff.targetId, eff.perParcelDelta);
            }
            parcelsLeft -= 1;

            log.push({
                kind: 'pending',
                indicatorId: eff.targetId,
                stateId: eff.stateId,
                delta: eff.perParcelDelta,
                ruleId: eff.ruleId,
                reason: 'parcela de efeito diferido',
            });

            if (parcelsLeft > 0) {
                stillPending.push({ ...eff, parcelsLeft, turnsUntilStart: 0 });
            }
        }
    }

    return stillPending;
}

// ============================================================
// EXECUÇÃO DE UMA REGRA
// ============================================================

let pendingCounter = 0;
function newPendingId(): string {
    pendingCounter += 1;
    return `pe_${Date.now().toString(36)}_${pendingCounter}`;
}

/**
 * Executa uma regra:
 *   - Lê a variação da origem no turno (deltas acumulados).
 *   - Calcula o delta total no destino.
 *   - Aplica imediatamente OU enfileira.
 *
 * Regras caem em 4 quadrantes:
 *   NN — origem nacional, destino nacional
 *   NS — origem nacional, destino estadual (aplica a todos os estados)
 *   SS — origem estadual, destino estadual (aplica por estado)
 *   SN — origem estadual, destino nacional (usa agregado da origem)
 */
function executeRule(
    rule: IndicatorRule,
    stateValues: Record<StateId, Record<string, number>>,
    nationalValues: Record<string, number>,
    stateDeltas: Record<StateId, Record<string, number>>,
    nationalDeltas: Record<string, number>,
    log: TurnLogEntry[],
): PendingEffect[] {
    const created: PendingEffect[] = [];
    const sourceIsNational = isNationalValue(rule.source);
    const targetIsNational = isNationalValue(rule.target);

    const delay = rule.delay ?? 0;
    const duration = rule.duration ?? 1;

    // ---------- NN: nacional → nacional ----------
    if (sourceIsNational && targetIsNational) {
        const srcDelta = nationalDeltas[rule.source] ?? 0;
        if (Math.abs(srcDelta) < EPS) return created;

        const srcValue = nationalValues[rule.source];
        const tgtValue = nationalValues[rule.target];
        const total = computeRuleDelta(rule, srcValue, srcDelta, tgtValue);
        if (Math.abs(total) < EPS) return created;

        if (delay === 0 && duration === 1) {
            applyNationalDelta(nationalValues, rule.target, total);
            nationalDeltas[rule.target] = (nationalDeltas[rule.target] ?? 0) + total;
            log.push({
                kind: 'rule', ruleId: rule.id, indicatorId: rule.target,
                stateId: null, delta: total, reason: rule.description,
            });
        } else {
            created.push({
                id: newPendingId(), ruleId: rule.id, targetId: rule.target,
                stateId: null,
                perParcelDelta: total / duration,
                parcelsLeft: duration,
                turnsUntilStart: delay,
            });
        }
        return created;
    }

    // ---------- NS: nacional → estadual ----------
    if (sourceIsNational && !targetIsNational) {
        const srcDelta = nationalDeltas[rule.source] ?? 0;
        if (Math.abs(srcDelta) < EPS) return created;

        const srcValue = nationalValues[rule.source];

        for (const stateId of STATE_IDS) {
            if (rule.states && !rule.states.includes(stateId)) continue;

            const tgtValue = stateValues[stateId][rule.target];
            if (tgtValue === undefined) continue;

            const total = computeRuleDelta(rule, srcValue, srcDelta, tgtValue, stateId);
            if (Math.abs(total) < EPS) continue;

            if (delay === 0 && duration === 1) {
                applyStateDelta(stateValues, stateId, rule.target, total);
                stateDeltas[stateId][rule.target] =
                    (stateDeltas[stateId][rule.target] ?? 0) + total;
                log.push({
                    kind: 'rule', ruleId: rule.id, indicatorId: rule.target,
                    stateId, delta: total, reason: rule.description,
                });
            } else {
                created.push({
                    id: newPendingId(), ruleId: rule.id, targetId: rule.target,
                    stateId,
                    perParcelDelta: total / duration,
                    parcelsLeft: duration,
                    turnsUntilStart: delay,
                });
            }
        }
        return created;
    }

    // ---------- SS: estadual → estadual ----------
    if (!sourceIsNational && !targetIsNational) {
        for (const stateId of STATE_IDS) {
            if (rule.states && !rule.states.includes(stateId)) continue;

            const srcDelta = stateDeltas[stateId][rule.source] ?? 0;
            if (Math.abs(srcDelta) < EPS) continue;

            const srcValue = stateValues[stateId][rule.source];
            const tgtValue = stateValues[stateId][rule.target];
            if (srcValue === undefined || tgtValue === undefined) continue;

            const total = computeRuleDelta(rule, srcValue, srcDelta, tgtValue, stateId);
            if (Math.abs(total) < EPS) continue;

            if (delay === 0 && duration === 1) {
                applyStateDelta(stateValues, stateId, rule.target, total);
                stateDeltas[stateId][rule.target] =
                    (stateDeltas[stateId][rule.target] ?? 0) + total;
                log.push({
                    kind: 'rule', ruleId: rule.id, indicatorId: rule.target,
                    stateId, delta: total, reason: rule.description,
                });
            } else {
                created.push({
                    id: newPendingId(), ruleId: rule.id, targetId: rule.target,
                    stateId,
                    perParcelDelta: total / duration,
                    parcelsLeft: duration,
                    turnsUntilStart: delay,
                });
            }
        }
        return created;
    }

    // ---------- SN: estadual → nacional ----------
    // Usa o delta agregado da origem como se fosse uma variação nacional.
    {
        // Soma ponderada pela população só para o delta (aproximação rápida).
        // O agregado "real" da origem é recalculado no passo de agregação.
        let totalSrcDelta = 0;
        let totalWeight = 0;
        for (const stateId of STATE_IDS) {
            if (rule.states && !rule.states.includes(stateId)) continue;
            const d = stateDeltas[stateId][rule.source] ?? 0;
            if (Math.abs(d) < EPS) continue;
            // Peso simples pela população — só para ponderar o delta.
            totalSrcDelta += d;
            totalWeight += 1;
        }
        if (totalWeight === 0) return created;
        const avgDelta = totalSrcDelta / totalWeight;

        const srcValue = nationalValues[rule.source] ?? 0;
        const tgtValue = nationalValues[rule.target];
        const total = computeRuleDelta(rule, srcValue, avgDelta, tgtValue);
        if (Math.abs(total) < EPS) return created;

        if (delay === 0 && duration === 1) {
            applyNationalDelta(nationalValues, rule.target, total);
            nationalDeltas[rule.target] = (nationalDeltas[rule.target] ?? 0) + total;
            log.push({
                kind: 'rule', ruleId: rule.id, indicatorId: rule.target,
                stateId: null, delta: total, reason: rule.description,
            });
        } else {
            created.push({
                id: newPendingId(), ruleId: rule.id, targetId: rule.target,
                stateId: null,
                perParcelDelta: total / duration,
                parcelsLeft: duration,
                turnsUntilStart: delay,
            });
        }
        return created;
    }
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================

export function runTurn(input: TurnInput): TurnResult {
    const log: TurnLogEntry[] = [];

    // Clona estado (imutabilidade)
    const stateValues: Record<StateId, Record<string, number>> = Object.fromEntries(
        STATE_IDS.map((id) => [id, { ...input.stateIndicators[id] }]),
    ) as Record<StateId, Record<string, number>>;

    const nationalValues: Record<string, number> = { ...input.nationalIndicators };

    // Deltas acumulados do turno — usados para disparar regras em cascata
    const stateDeltas: Record<StateId, Record<string, number>> = Object.fromEntries(
        STATE_IDS.map((id) => [id, {}]),
    ) as Record<StateId, Record<string, number>>;
    const nationalDeltas: Record<string, number> = {};

    // ---------- 1. Efeitos pendentes de turnos anteriores ----------
    let pending = processPending(input, stateValues, nationalValues, log);

    // Registra os deltas dos pendentes (podem disparar regras abaixo)
    for (const entry of log) {
        if (entry.kind !== 'pending') continue;
        if (entry.stateId === null) {
            nationalDeltas[entry.indicatorId] =
                (nationalDeltas[entry.indicatorId] ?? 0) + entry.delta;
        } else {
            stateDeltas[entry.stateId][entry.indicatorId] =
                (stateDeltas[entry.stateId][entry.indicatorId] ?? 0) + entry.delta;
        }
    }

    // ---------- 2. Deltas brutos (medidas, drift) ----------
    for (const [id, delta] of Object.entries(input.rawDeltas.national)) {
        if (Math.abs(delta) < EPS) continue;
        applyNationalDelta(nationalValues, id, delta);
        nationalDeltas[id] = (nationalDeltas[id] ?? 0) + delta;
        log.push({
            kind: 'raw', indicatorId: id, stateId: null,
            delta, reason: 'delta bruto do turno',
        });
    }
    for (const stateId of STATE_IDS) {
        const raw = input.rawDeltas.states[stateId];
        if (!raw) continue;
        for (const [id, delta] of Object.entries(raw)) {
            if (Math.abs(delta) < EPS) continue;
            applyStateDelta(stateValues, stateId, id, delta);
            stateDeltas[stateId][id] = (stateDeltas[stateId][id] ?? 0) + delta;
            log.push({
                kind: 'raw', indicatorId: id, stateId,
                delta, reason: 'delta bruto do turno',
            });
        }
    }
    // ---------- 2.5. Tendência natural (drift) ----------
    const drift = computeNaturalDrift(input.stateIndicators, input.nationalIndicators);

    for (const [id, delta] of Object.entries(drift.output.national)) {
        applyNationalDelta(nationalValues, id, delta);
        nationalDeltas[id] = (nationalDeltas[id] ?? 0) + delta;
    }
    for (const stateId of STATE_IDS) {
        const stateDrift = drift.output.states[stateId];
        if (!stateDrift) continue;
        for (const [id, delta] of Object.entries(stateDrift)) {
            applyStateDelta(stateValues, stateId, id, delta);
            stateDeltas[stateId][id] = (stateDeltas[stateId][id] ?? 0) + delta;
        }
    }

    for (const entry of drift.log) {
        log.push({
            kind: 'raw',                       // ou crie um kind 'drift' se preferir
            indicatorId: entry.indicatorId,
            stateId: entry.stateId,
            delta: entry.delta,
            reason: entry.reason,
        });
    }
    // ---------- 3. Regras em ordem ----------
    for (const rule of INDICATOR_RULES) {
        const created = executeRule(
            rule, stateValues, nationalValues,
            stateDeltas, nationalDeltas, log,
        );
        pending = pending.concat(created);
    }

    // ---------- 4. Recalcula agregados nacionais ----------
    const aggregated = aggregateAll(stateValues);
    for (const [id, value] of Object.entries(aggregated)) {
        const before = nationalValues[id];
        if (before !== undefined) {
            nationalValues[id] = value;
            log.push({
                kind: 'aggregate', indicatorId: id, stateId: null,
                delta: value - before,
                reason: 'recalculo do agregado nacional',
            });
        } else {
            nationalValues[id] = value;
        }
    }

    return {
        stateIndicators: stateValues,
        nationalIndicators: nationalValues,
        pendingEffects: pending,
        log,
    };
}
