// types/ai.ts

import type { InstrumentId } from '../data/catalog';
import type { StateId, Region } from '../data/states';
import type { IndicatorDirection } from '../data/indicators';
import type { ActivePolicy } from './policy';
import type { PendingEffect } from '../services/engine/rulesEngine';
import type { ActiveReaction } from '../services/engine/reactions';

// ============================================================
// RESPOSTA DA IA — ANÁLISE DE MEDIDA
// ============================================================

export type FiscalType = 'neutro' | 'custo' | 'economia';
export type LegalRisk = 'baixo' | 'medio' | 'alto';
export type FiscalMagnitude = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ImpactoFiscal {
  tipo: FiscalType;
  magnitude: FiscalMagnitude;
  nota: string;
}

export interface AIInterpretation {
  interpretacao: string;
  instrumento: InstrumentId;
  motivo_instrumento: string;
  impacto_fiscal: ImpactoFiscal;
  intensidade: 0 | 1 | 2 | 3;

  /** Parâmetros de implementação sugeridos pela IA e limitados pelo motor. */
  implementationMonths?: number;
  effectRampUpMonths?: number;
  durationType?: 'permanent' | 'temporary';
  durationMonths?: number;

  posicao_ideologica: number;

  /** id do grupo social → delta de aprovação. */
  grupos: Record<string, number>;

  /**
   * Deltas por indicador (chave = id em data/indicators.ts).
   * Valor = delta TOTAL ao longo de `effectRampUpMonths`.
   * Positivo = aumentar, negativo = reduzir.
   */
  indicadores: Record<string, number>;

  /** Estados alvo, quando a medida é regional. */
  estados_alvo?: string[];

  risco_juridico: LegalRisk;
  assessoria_juridica: string;

  area_principal?: string;
  areas_secundarias?: string[];
  objetivo?: string;
  beneficios?: string[];
  riscos?: string[];
  efeitos_colaterais?: string[];

  // Metadados internos
  _elaboration_bonus?: boolean;
  _quality?: number;
  _fallback?: boolean;
}

// ============================================================
// LOOP DE CONSULTA (2 FASES)
// ============================================================

export interface QueryRequest {
  type:
    | 'national_indicators'
    | 'state_indicators'
    | 'compare_states'
    | 'indicator_history'
    | 'group_details'
    | 'active_policies';
  [key: string]: unknown;
}

export interface QueryResultOk {
  ok: true;
  type: string;
  data: unknown;
}

export interface QueryResultError {
  ok: false;
  type: string;
  error: string;
  suggestions?: string[];
}

export type QueryResult = QueryResultOk | QueryResultError;

export interface AIQueryRequest {
  phase: 'query';
  reasoning: string;
  queries: QueryRequest[];
}

export interface AIAnalysisResponse {
  phase: 'analysis';
  analysis: AIInterpretation;
}

export type AIResponse = AIQueryRequest | AIAnalysisResponse;

// ============================================================
// CATÁLOGO DE CONSULTAS DISPONÍVEIS
// ============================================================

export interface QueryCapability {
  type: string;
  description: string;
  argsSchema: string;
  examples: string[];
  whenToUse: string;
}

// ============================================================
// CONTEXTO — PEÇAS
// ============================================================

export interface IndicatorSnapshot {
  id: string;
  label: string;
  unit: string;
  value: number;
  recentDelta: number;
  trend: 'subindo' | 'caindo' | 'estável';
  classification: string;
  direction: IndicatorDirection;
}

export interface StateSummary {
  id: StateId;
  name: string;
  region: Region;
  population: number;
  approval: number;
  politicalInclination: number;
  highlighted: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  weight: number;
  approval: number;
  lean: number;
  combativeness?: number;
  reaction?: {
    title: string;
    active: boolean;
    monthsActive?: number;
  };
}

export interface ActivePolicyContext {
  id: string;
  name: string;
  type: string;
  status: 'iniciando' | 'aplicando' | 'encerrando';
  activeMonths: number;
  monthsToFullEffect: number;
  monthsToExpire?: number;
  affectedIndicators: string[];
  affectedGroups: Array<{ id: string; delta: number }>;
  fiscalAnnual: number;
}

export interface CrisisContext {
  kind: 'crisis_climate' | 'scandal' | 'military' | 'reaction';
  severity: 'baixa' | 'média' | 'alta';
  description: string;
  since?: number;
}

export interface HistoryContext {
  months: number;
  indicators: Record<string, number[]>;
  groupApprovals: Record<string, number[]>;
  nationalApproval: number[];
}

export interface NationalContext {
  month: number;
  approval: number;
  approvalTrend: 'subindo' | 'caindo' | 'estável';
  macro: IndicatorSnapshot[];
  fiscal: IndicatorSnapshot[];
}

export interface ProfileContext {
  playerName: string;
  partyId: string;
  partyAcronym: string;
  /** -3..+3, derivado dos eixos ou do partido. */
  govIdeology: number;
  /** Rótulo do eixo resultante (ex: 'centro_esquerda'). */
  govIdeologyLabel?: string;
  /** 5 eixos do PROFILE_AXES, cada um -3..+3. */
  axes: {
    economia: number;
    costumes: number;
    seguranca: number;
    ambiente: number;
    gasto_social: number;
  };
}

export interface PlayerProfile {
  nome: string;
  partyId: string;
  sliders: Partial<{
    economia: number;
    costumes: number;
    seguranca: number;
    ambiente: number;
    gasto_social: number;
  }>;
}

// ============================================================
// CONTEXTO — AGREGADO
// ============================================================

export interface PolicyContext {
  proposal: string;
  month: number;
  profile: ProfileContext;
  national: NationalContext;
  states: StateSummary[];
  groups: GroupSummary[];
  activePolicies: ActivePolicyContext[];
  activeCrises: CrisisContext[];
  history: HistoryContext;
  availableQueries: QueryCapability[];
}

// ============================================================
// SNAPSHOT E INPUT DO BUILDER
// ============================================================

export interface ContextSnapshot {
  month: number;
  national: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  nationalApproval: number;
  states?: { id: StateId; population: number; values: Record<string, number> }[];
}

export interface ContextInput {
  month: number;
  proposal: string;
  profile: ProfileContext;
  stateIndicators: Record<StateId, Record<string, number>>;
  nationalIndicators: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  stateApprovals: Record<StateId, number>;
  nationalApproval: number;
  activePolicies: ActivePolicy[];
  pendingEffects: PendingEffect[];
  activeReactions: ActiveReaction[];
  history: ContextSnapshot[];
}

// ============================================================
// OUTRAS TAREFAS (notícia, social, narrativa)
// ============================================================
// Contextos específicos serão redesenhados quando implementarmos cada tarefa.
// Por ora só os formatos de saída:

export interface NoticiaIA {
  manchete: string;
  corpo: string;
  tom: 'positivo' | 'neutro' | 'negativo';
}

export interface PostIA {
  autorId: string;
  texto: string;
  tom: 'apoio' | 'critica' | 'neutro';
}

export type PaginaIA =
  | 'congresso'
  | 'estado'
  | 'jornal'
  | 'rede-social'
  | 'economia';

export type TarefaIA = 'medida' | 'noticia' | 'social' | 'narrativa';
