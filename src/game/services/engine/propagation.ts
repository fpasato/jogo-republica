import type { IndicatorChain } from '../../data/indicatorChains';
import { getIndicator } from '../../data/indicators';
import { STATE_IDS, type StateId } from '../../data/states';

export interface DeltasMap {
  [id: string]: number;
}

export function propagateChains(
  directDeltas: DeltasMap,
  chains: IndicatorChain[],
): DeltasMap {
  const cascade: DeltasMap = {};

  for (const [sourceId, sourceDelta] of Object.entries(directDeltas)) {
    for (const chain of chains) {
      if (chain.from !== sourceId) continue;
      if (Math.abs(sourceDelta) < chain.threshold) continue;

      const effect = sourceDelta * chain.factor;
      if (!Number.isFinite(effect) || effect === 0) continue;

      cascade[chain.to] = (cascade[chain.to] ?? 0) + effect;
    }
  }

  return cascade;
}

export function applyCascadeDeltas(
  nationalValues: Record<string, number>,
  stateValues: Record<StateId, Record<string, number>>,
  cascade: DeltasMap,
): void {
  for (const [id, d] of Object.entries(cascade)) {
    const ind = getIndicator(id);
    if (!ind || d === 0) continue;

    if (ind.scope === 'national') {
      const cur = nationalValues[id] ?? ind.min;
      nationalValues[id] = Math.max(ind.min, Math.min(ind.max, cur + d));
    } else if (ind.scope === 'national_and_state') {
      const cur = nationalValues[id] ?? ind.min;
      nationalValues[id] = Math.max(ind.min, Math.min(ind.max, cur + d));
      for (const sid of STATE_IDS) {
        const s = stateValues[sid];
        if (!s) continue;
        const c = s[id] ?? ind.min;
        s[id] = Math.max(ind.min, Math.min(ind.max, c + d));
      }
    } else {
      for (const sid of STATE_IDS) {
        const s = stateValues[sid];
        if (!s) continue;
        const c = s[id] ?? ind.min;
        s[id] = Math.max(ind.min, Math.min(ind.max, c + d));
      }
    }
  }
}