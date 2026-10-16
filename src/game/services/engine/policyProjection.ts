import type { GameState, IndicatorId } from '../../types/game';
import type { PolicyMeasure } from '../../types/policy';
import { INDICATORS } from '../../data/indicators';
import { effectProgress } from './effects';

export interface EffectProjection {
  indicatorId: IndicatorId;
  label: string;
  unit?: string;
  totalDelta: number;     // impacto final esperado
  appliedDelta: number;   // quanto já foi aplicado
  progress: number;       // 0 a 1
  delayMonths: number;
  rampMonths: number;
}

export interface PolicyProjection {
  initialCost: number;
  monthlyNet: number;     // + gasto líquido, - economia (R$ bi/mês)
  annualNet: number;      // + gasto líquido, - economia (R$ bi/ano)
  revenue: number;
  recurringCost: number;
  savings: number;
  totalCost: number | null; // null se permanente
  effects: EffectProjection[];
}

export function projectPolicy(
  policy: PolicyMeasure,
  state: GameState,
): PolicyProjection {
  const revenue = policy.revenue ?? 0;
  const recurringCost = policy.recurringCost ?? 0;
  const savings = policy.savings ?? 0;
  const initialCost = policy.initialCost ?? 0;
  const annualNet = recurringCost - revenue - savings;
  const monthlyNet = annualNet / 12;

  const duration = policy.duration;
  const totalCost =
    duration === 'permanente' ? null : initialCost + monthlyNet * duration;

  // Se ainda não foi ativada, simula como se ativasse no turno atual
  const activatedAt = policy.activatedAtTurn ?? state.turn;

  const effects: EffectProjection[] = policy.indicatorEffects.map(e => {
    const def = INDICATORS[e.indicatorId];
    const progress = policy.activatedAtTurn == null
      ? 0
      : effectProgress(e, activatedAt, state.turn);
    return {
      indicatorId: e.indicatorId,
      label: def?.name ?? e.indicatorId,
      unit: def?.unit,
      totalDelta: e.target,
      appliedDelta: e.target * progress,
      progress,
      delayMonths: e.delayMonths,
      rampMonths: e.rampMonths,
    };
  });

  return { initialCost, monthlyNet, annualNet, revenue, recurringCost, savings, totalCost, effects };
}
