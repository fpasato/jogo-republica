import { STATE_IDS, type StateId } from '../../data/states';
import { estimateStateIdh } from '../../data/idh';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MAX_MONTHLY_IDH_CHANGE = 0.002;

export function deriveStateIdh(
  stateIndicators: Record<StateId, Record<string, number>>,
): void {
  for (const sid of STATE_IDS) {
    const s = stateIndicators[sid];
    if (!s) continue;

    const target = estimateStateIdh(s);
    const current = typeof s.idh === 'number' && Number.isFinite(s.idh)
      ? s.idh
      : target;
    const monthlyChange = clamp(
      target - current,
      -MAX_MONTHLY_IDH_CHANGE,
      MAX_MONTHLY_IDH_CHANGE,
    );
    s.idh = clamp(current + monthlyChange, 0, 1);
  }
}
