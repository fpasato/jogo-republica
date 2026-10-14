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
  /** Estimativa do impacto anual em R$ bilhões, quando a IA fornecer. */
  valor_anual_bi?: number;
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
  // Metadados internos
  _elaboration_bonus?: boolean;
  _quality?: number;
  _fallback?: boolean;

  /** Avisos gerados pelo sanitizador de deltas (ex.: valor ajustado
   *  para o mínimo viável). Exibidos na UI junto da análise. */
  warnings?: string[];
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

  /** Valores crus dos indicadores nacionais (id → valor).
   *  Usado pelo prompt builder para a IA calcular deltas absolutos. */
  indicators?: Record<string, number>;   // 👈 NOVO
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
// NOTÍCIAS
// ============================================================

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
  /** Mês do jogo em que a notícia foi publicada. */
  mes: number;
  manchete: string;
  submanchete?: string;
  corpo: string;
  /** id de data/newsVehicles.ts */
  veiculo: string;
  tema: NewsTheme;
  tom: NewsTone;
  importancia: NewsImportance;
  /** Caminho da imagem (asset). */
  imagem: string;
  destaques: NewsHighlight[];
  gatilho: NewsTrigger;
}

// ============================================================
// REDE SOCIAL
// ============================================================

export type PostTone = 'apoio' | 'critica' | 'neutro' | 'agressivo';

export interface PostStatsData {
  views: number;
  likes: number;
  reposts: number;
}

export interface Post {
  id: string;
  /** Mês do jogo (1-12). */
  mes: number;
  /** Dia do mês (1-28). */
  dia: number;
  /** Hora (0-23). */
  hora: number;
  /** Minuto (0-59). */
  minuto: number;
  /** id do perfil em data/socialProfiles.ts ou 'player'. */
  autorId: string;
  texto: string;
  tom: PostTone;
  /** id do post original, se for resposta. */
  respostaA?: string;
  /** id da notícia em Noticia[], se estiver comentando uma. */
  noticiaVinculada?: string;
  /** Caminho de imagem opcional. */
  midia?: string;
  stats: PostStatsData;
  geradoPor: 'ia' | 'jogador' | 'template';
}

// ============================================================
// POSTS DO JOGADOR
// ============================================================

export type PlayerPostTone = 'oficial' | 'normal' | 'agressivo';

export interface PlayerPost {
  id: string;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  texto: string;
  tom: PlayerPostTone;
  /** id do post original, se for resposta. */
  respostaA?: string;
  stats: PostStatsData;
  /** Preenchido no turno seguinte pela análise. */
  analyzed?: PlayerPostAnalysis;
}

export interface PlayerPostAnalysis {
  postId: string;
  viralizou: boolean;
  virouNoticia: boolean;
  mancheteNoticia?: string;
  /** Impacto na aprovação dos grupos (-5..+5). */
  reacaoSocial: number;
  /** Adição em scandalExposure (0..5). */
  scandalAdd: number;
  /** Respostas geradas por outros perfis. */
  respostas: Array<{
    perfilId: string;
    texto: string;
    tom: PostTone;
  }>;
}

// ============================================================
// RESULTADOS DE IA (rede)
// ============================================================

export interface SocialAIOptions {
  model?: string;
  temperatures?: number[];
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Quantos posts gerar (default: 20). */
  count?: number;
}

export interface SocialAIMetadata {
  attempts: number;
  usedFallback: boolean;
  totalDurationMs: number;
  promptTokens: number;
  responseTokens: number;
}

export interface SocialAIResult {
  posts: Post[];
  metadata: SocialAIMetadata;
}

// ============================================================
// RESULTADOS DE IA (notícia)
// ============================================================

export interface NewsAIOptions {
  model?: string;
  temperatures?: number[];
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Quantas notícias gerar (2-4). */
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

// ============================================================
// RESULTADO DE IA (análise de post do jogador)
// ============================================================

export interface PlayerPostAIOptions {
  model?: string;
  temperatures?: number[];
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface PlayerPostAIMetadata {
  attempts: number;
  usedFallback: boolean;
  totalDurationMs: number;
  promptTokens: number;
  responseTokens: number;
}

export interface PlayerPostAIResult {
  analyses: PlayerPostAnalysis[];
  metadata: PlayerPostAIMetadata;
}

// ============================================================
// INPUT DOS MOTORES
// ============================================================

export interface NewsContextInput {
  game: GameStateForNews;
  history: ContextSnapshot[];
  lastTurnLog: unknown;   // TurnLog — evita import circular
  lastTurnSummary: unknown;
}

/**
 * Subset do GameState que a IA de notícia precisa.
 * Evita import circular do initialState.ts.
 */
export interface GameStateForNews {
  year: number;
  month: number;
  macros: Record<string, number>;
  nationalIndicators: Record<string, number>;
  groupApprovals: Record<string, number>;
  stateApprovals: Record<string, number>;
  nationalApproval: number;
  activePolicies: Array<{
    id: string;
    name: string;
    type: string;
    activeMonths: number;
    fiscalAnnual: number;
    effects: Record<string, number | undefined>;
  }>;
  activeReactions: Array<{
    groupId: string;
    monthsActive: number;
  }>;
}

export interface SocialContextInput {
  year: number;
  month: number;
  game: GameStateForNews;
  noticias: Noticia[];
  playerPostsFromLastTurn: PlayerPost[];
  profileSeed?: {
    playerName: string;
    playerHandle: string;
    seguidores: number;
  };
}

export interface PlayerPostContextInput {
  year: number;
  month: number;
  playerPosts: PlayerPost[];
  noticias: Noticia[];
  recentPosts: Post[];
  game: GameStateForNews;
}
