// src/game/types/ai.ts

import type { InstrumentId } from '../data/catalog';
import type { IndicatorDirection } from '../data/indicators';
import type { ActivePolicy } from './policy';

export type FiscalType = 'neutro' | 'custo' | 'economia';
export type LegalRisk = 'baixo' | 'medio' | 'alto';
export type FiscalMagnitude = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ImpactoFiscal {
  tipo: FiscalType;
  magnitude: FiscalMagnitude;
  valor_anual_bi?: number;
  nota: string;
}

export interface AIInterpretation {
  interpretacao: string;
  instrumento: InstrumentId;
  motivo_instrumento: string;
  impacto_fiscal: ImpactoFiscal;
  intensidade: 0 | 1 | 2 | 3;
  implementationMonths?: number;
  effectRampUpMonths?: number;
  durationType?: 'permanent' | 'temporary';
  durationMonths?: number;
  posicao_ideologica: number;
  grupos: Record<string, number>;
  indicadores: Record<string, number>;
  risco_juridico: LegalRisk;
  assessoria_juridica: string;
  area_principal?: string;
  areas_secundarias?: string[];
  objetivo?: string;
  beneficios?: string[];
  riscos?: string[];
  efeitos_colaterais?: string[];
  _elaboration_bonus?: boolean;
  _quality?: number;
  _fallback?: boolean;
  warnings?: string[];
}

export interface QueryRequest {
  type: string;
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

export interface QueryCapability {
  type: string;
  description: string;
  argsSchema: string;
  examples: string[];
  whenToUse: string;
}

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

export interface GroupSummary {
  id: string;
  name: string;
  weight: number;
  approval: number;
  lean: number;
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
  indicators: Record<string, number>;
}

export interface ProfileContext {
  playerName: string;
  partyId: string;
  partyAcronym: string;
  govIdeology: number;
  govIdeologyLabel?: string;
  axes: {
    economia: number;
    costumes: number;
    seguranca: number;
    ambiente: number;
    gasto_social: number;
    trabalho?: number;
    politica_externa?: number;
    [key: string]: number | undefined;
  };
}

export interface PolicyContext {
  proposal: string;
  month: number;
  profile: ProfileContext;
  national: NationalContext;
  states: any[];
  groups: GroupSummary[];
  activePolicies: ActivePolicyContext[];
  activeCrises: any[];
  history: HistoryContext;
  availableQueries: QueryCapability[];
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

export interface ContextSnapshot {
  month: number;
  national: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  nationalApproval: number;
}

export interface ContextInput {
  month: number;
  proposal: string;
  profile: ProfileContext;
  nationalIndicators: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  nationalApproval: number;
  activePolicies: ActivePolicy[];
  history: ContextSnapshot[];
}

import type { NewsTheme } from '../data/newsThemes';

export type NewsTone = 'positivo' | 'neutro' | 'negativo';
export type NewsImportance = 1 | 2 | 3;

export interface NewsHighlight {
  id: string;
  label: string;
  value: number;
  delta?: number;
}

export type TriggerKind =
  | 'shock3'
  | 'reaction'
  | 'crisis'
  | 'trend'
  | 'random'
  | 'player_action';

export interface NewsTrigger {
  kind: TriggerKind;
  tema: NewsTheme;
  detalhe: string;
  impacto: number;
  refId?: string;
}

export interface Noticia {
  id: string;
  mes?: number;
  titulo?: string;
  manchete: string;
  submanchete?: string;
  corpo: string;
  veiculo: string;
  tom: NewsTone;
  importancia: NewsImportance;
  tema?: NewsTheme;
  imagem?: string;
  impactoPolitico?: number;
  repercussaoSocial?: number;
  tags?: string[];
  gatilho?: NewsTrigger;
  destaques?: NewsHighlight[];
  indicadoresCitados?: string[];
  gruposAfetados?: string[];
  isPlaceholder?: boolean;
}

export interface NewsAIOptions {
  model?: string;
  temperatures?: number[];
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  count?: number;
}

export interface NewsAIMetadata {
  attempts: number;
  usedFallback: boolean;
  totalDurationMs: number;
  promptTokens: number;
  responseTokens: number;
}

export interface NewsAIResult {
  noticias: Noticia[];
  metadata: NewsAIMetadata;
}

export interface NewsContextInput {
  game: GameStateForNews;
  history: ContextSnapshot[];
  lastTurnLog: unknown;
  lastTurnSummary: unknown;
}

export interface GameStateForNews {
  year: number;
  month: number;
  macros: Record<string, number>;
  nationalIndicators: Record<string, number>;
  groupApprovals: Record<string, number>;
  nationalApproval: number;
  activePolicies: Array<{
    id: string;
    name: string;
    type: string;
    activeMonths: number;
    fiscalAnnual: number;
    effects: Record<string, number | undefined>;
  }>;
  stateApprovals?: Record<string, number>;
  activeReactions?: Array<{ groupId: string; monthsActive: number }>;
}
