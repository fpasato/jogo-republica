import type { AIInterpretation } from './ai';
import type { InstrumentId } from '../data/catalog';

export type PolicyType = InstrumentId;

export type PolicyEffects = Partial<Record<string, number>> & {
  budget?: number;
  expenses?: number;
  approval?: number;
};

export type PolicyStatus = 'active' | 'approved' | 'rejected' | 'archived';

export interface ActivePolicy {
  id: string;
  name: string;
  type: PolicyType;
  effects: PolicyEffects;
  groupReactions: Record<string, number>;
  implementationMonths: number;
  effectRampUpMonths: number;
  durationType: 'permanent' | 'temporary';
  durationMonths: number;
  activeMonths: number;
  fiscalAnnual: number;
}

export interface PolicyHistoryEntry {
  id: string;
  name: string;
  type: PolicyType;
  originalText: string;
  createdAt: string;
  month: number;
  analysis: AIInterpretation;
  status: PolicyStatus;
  impactoFinanceiro: {
    custoImplementacao: number;
  };
  implementationMonths: number;
  effectRampUpMonths?: number;
  durationType?: 'permanent' | 'temporary';
  durationMonths: number;
}
