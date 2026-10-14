
import type { StateId } from '../../data/states';
import { STATE_IDS, STATES } from '../../data/states';
import { hasDynamics, computeDrift } from '../../data/indicatorDynamics';
import { getIndicator } from '../../data/indicators';

// ============================================================
// TIPOS
// ============================================================

export interface DriftOutput {
  states: Record<StateId, Record<string, number>>;
  national: Record<string, number>;
}

export interface DriftLogEntry {
  indicatorId: string;
  stateId: StateId | null;
  delta: number;
  reason: string;
}

export interface DriftResult {
  output: DriftOutput;
  log: DriftLogEntry[];
}

// ============================================================
// CÁLCULO
// ============================================================

/**
 * Calcula a tendência natural de TODOS os indicadores que têm dinâmica.
 * Função pura: recebe o estado no início do turno e devolve os deltas.
 *
 * Importante: usa os valores de ENTRADA (antes do turno começar),
 * não os valores já modificados pelos efeitos pendentes ou brutos.
 * Isso garante determinismo e evita acoplamento estranho.
 */
export function computeNaturalDrift(
  stateIndicators: Record<StateId, Record<string, number>>,
  nationalIndicators: Record<string, number>,
): DriftResult {
  const output: DriftOutput = {
    states: Object.fromEntries(STATE_IDS.map((id) => [id, {}])) as DriftOutput['states'],
    national: {},
  };
  const log: DriftLogEntry[] = [];

  // ---------- Nacional ----------
  for (const [id, value] of Object.entries(nationalIndicators)) {
    if (!hasDynamics(id)) continue;

    const ind = getIndicator(id);

    // Só indicadores que existem no plano nacional
    if (ind.scope !== 'national' && ind.scope !== 'national_and_state') continue;

    const delta = computeDrift(id, { currentValue: value, national: nationalIndicators });
    if (delta === 0) continue;

    output.national[id] = delta;
    log.push({
      indicatorId: id,
      stateId: null,
      delta,
      reason: 'tendência natural',
    });
  }

  // ---------- Estadual ----------
  for (const stateId of STATE_IDS) {
    const stateValues = stateIndicators[stateId];
    const structural = STATES[stateId];
    const stateOut: Record<string, number> = {};

    for (const [id, value] of Object.entries(stateValues)) {
      if (!hasDynamics(id)) continue;

      const ind = getIndicator(id);

      // Só indicadores que existem no plano estadual
      if (
        ind.scope !== 'state' &&
        ind.scope !== 'state_aggregated' &&
        ind.scope !== 'national_and_state'
      ) continue;

      const delta = computeDrift(id, {
        currentValue: value,
        stateId,
        state: structural,
        national: nationalIndicators,
      });
      if (delta === 0) continue;

      stateOut[id] = delta;
      log.push({
        indicatorId: id,
        stateId,
        delta,
        reason: 'tendência natural',
      });
    }

    if (Object.keys(stateOut).length > 0) {
      output.states[stateId] = stateOut;
    }
  }

  return { output, log };
}
