import type { AIInterpretation } from './ai';
import type { InstrumentId } from '../data/catalog';
import type { IndicatorId } from '../data/indicators';

/**
 * O tipo de uma medida é exatamente o instrumento legislativo que a IA
 * classificou (mp, projeto_lei, lei_complementar, pec, decreto…).
 * Fonte única: catálogo em `data/catalog.ts`.
 */
export type PolicyType = InstrumentId;

// ---------------------------------------------------------------------------
// Efeitos sobre indicadores do catálogo e ajustes fiscais/políticos do motor.
// Todos opcionais — a medida só declara o que afeta.
// ---------------------------------------------------------------------------

export type PolicyEffects = Partial<Record<IndicatorId, number>> & {
  budget?: number;
  expenses?: number;
  approval?: number;
};

// ---------------------------------------------------------------------------
// Status possíveis de uma medida no histórico.
// O store atual só grava 'active' ao apresentar, mas os outros valores
// ficam prontos para quando a votação marcar aprovada/rejeitada.
// ---------------------------------------------------------------------------

export type PolicyStatus = 'active' | 'approved' | 'rejected' | 'archived';

// ---------------------------------------------------------------------------
// Medida em vigor.
// Espelha exatamente o objeto criado em presentPolicy().
// ---------------------------------------------------------------------------

export interface ActivePolicy {
  id: string;
  name: string;
  type: PolicyType;

  /** Efeitos sobre indicadores (aplicados por fração mensal). */
  effects: PolicyEffects;

  /** Reação de cada grupo social (id do grupo → delta de aprovação). */
  groupReactions: Record<string, number>;

  /** Mês (relativo) em que a medida começou a vigorar. */
  implementationMonths: number;

  /** Quantos meses leva para o efeito chegar ao total (0 = aplica direto). */
  effectRampUpMonths: number;

  /** Permanente ou temporária (reverte ao fim de durationMonths). */
  durationType: 'permanent' | 'temporary';

  /** Duração em meses (só usada quando durationType === 'temporary'). */
  durationMonths: number;

  /** Quantos meses já se passaram desde a criação. */
  activeMonths: number;

  /** Impacto fiscal anual em reais (positivo = economia, negativo = custo). */
  fiscalAnnual: number;
}

// ---------------------------------------------------------------------------
// Registro histórico de uma medida apresentada.
// Espelha o objeto criado em presentPolicy() como `historyEntry`.
// ---------------------------------------------------------------------------

export interface PolicyHistoryEntry {
  id: string;
  name: string;
  type: PolicyType;

  /** Texto original que o jogador digitou ao propor a medida. */
  originalText: string;

  /** Data ISO da criação. */
  createdAt: string;

  /** Mês da partida em que foi apresentada. */
  month: number;

  /** Interpretação completa da IA (guardada para auditoria/exibição). */
  analysis: AIInterpretation;

  /** Estado atual no histórico. */
  status: PolicyStatus;

  /** Impacto financeiro resumido (para exibir na UI). */
  impactoFinanceiro: {
    custoImplementacao: number; // em bilhões de reais
  };

  /** Quantos meses leva para implementar (0 = imediato). */
  implementationMonths: number;

  effectRampUpMonths?: number;

  durationType?: 'permanent' | 'temporary';

  /** Duração em meses (0 = permanente). */
  durationMonths: number;
}
