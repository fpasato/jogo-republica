import type {
  SliderId,
  IndicatorId,
  GroupId,
  StateId,
} from './game';

export type PolicyArea =
  | 'economia'
  | 'saude'
  | 'educacao'
  | 'seguranca'
  | 'infraestrutura'
  | 'social'
  | 'meioAmbiente'
  | 'gestao';

export type PolicyType =
  | 'imposto'
  | 'beneficio'
  | 'corte'
  | 'programa'
  | 'investimento'
  | 'regulacao';

export type PolicyStatus =
  | 'draft'
  | 'voting'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'expired';

export interface PolicyParameter {
  key: string;
  label: string;
  value: number;
  unit: string;
}

export interface IndicatorEffect {
  indicatorId: IndicatorId;
  /** Quanto o indicador se move até o alvo (absoluto) */
  target: number;
  /** Meses até o efeito começar */
  delayMonths: number;
  /** Meses até o efeito se completar */
  rampMonths: number;
  reason: string;
}

/** Efeito estadual direto. Estados não listados recebem somente efeitos indiretos do jogo. */
export interface StateEffect {
  stateId: StateId;
  target: number;
  delayMonths: number;
  rampMonths: number;
  reason: string;
}

export interface GroupReaction {
  groupId: GroupId;
  /** -1 (rejeita) a 1 (apoia) */
  intensity: number;
  reason: string;
}

export interface SliderChange {
  sliderId: SliderId;
  newValue: number;
  reason: string;
}

export interface PolicyMeasure {
  id: string;
  name: string;
  description: string;
  area: PolicyArea;
  type: PolicyType;

  // Finanças (em R$ bilhões)
  initialCost: number;
  recurringCost: number;   // por ano
  savings: number;         // por ano
  revenue: number;         // por ano

  // Efeitos
  indicatorEffects: IndicatorEffect[];
  stateEffects?: StateEffect[];
  groupReactions: GroupReaction[];
  sliderChanges?: SliderChange[];
  parameters?: PolicyParameter[];

  // Tempo
  timeToEffect: number;    // meses
  duration: number | 'permanente';

  // Estado
  status: PolicyStatus;
  createdAtTurn: number;
  activatedAtTurn?: number;
  expiresAtTurn?: number;

  // Metadados
  source: 'player' | 'ai' | 'catalog';
  confidence?: number;     // 0–1 (quando vem da IA)

  /** Posição ideológica da medida (-3 esquerda .. +3 direita). Opcional — fallback por área. */
  position?: number;

  /** Instrumento jurídico. Definido pelo código a partir do PolicyType. */
  instrumentId?: string;

  /** Custo de aprovação acumulado por negociação (pontos de aprovação) */
  negotiationCost?: number;

  /** Diluição aplicada pelo texto (0..0.5) */
  dilutionApplied?: number;

}
