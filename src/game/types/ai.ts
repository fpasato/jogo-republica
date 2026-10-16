import type {
  SliderId,
  IndicatorId,
  GroupId,
  StateId,
} from './game';
import type { PolicyArea, PolicyType } from './policy';

/** Resposta crua esperada do Ollama ao interpretar uma medida */
export interface MeasureInterpretationRaw {
  name: string;
  description: string;
  area: PolicyArea;
  type: PolicyType;
  initialCost: number;
  recurringCost: number;
  savings: number;
  revenue: number;
  indicatorEffects: Array<{
    indicatorId: IndicatorId;
    target: number;
    delayMonths: number;
    rampMonths: number;
    reason: string;
  }>;
  /** Estados que a medida altera diretamente; omita para efeitos somente indiretos. */
  stateEffects?: Array<{
    stateId: StateId;
    target: number;
    delayMonths: number;
    rampMonths: number;
    reason: string;
  }>;
  groupReactions: Array<{
    groupId: GroupId;
    intensity: number;
    reason: string;
  }>;
  sliderChanges?: Array<{
    sliderId: SliderId;
    newValue: number;
    reason: string;
  }>;
  parameters?: Array<{
    key: string;
    label: string;
    value: number;
    unit: string;
  }>;
  timeToEffect: number;
  duration: number | 'permanente';
  confidence: number;
  position?: number; 
}

export interface MeasureValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: MeasureInterpretationRaw;
}
