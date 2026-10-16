// Tipos centrais do jogo

export type SliderId =
  | 'impostos'
  | 'salarioMinimo'
  | 'selic'
  | 'tarifasImportacao'
  | 'gastosPublicos'
  | 'investimentosPublicos'
  | 'beneficiosSociais'
  | 'policiamento'
  | 'sistemaPrisional'
  | 'saude'
  | 'educacao'
  | 'servidores'
  | 'salariosServidores'
  | 'privatizacao';

export type IndicatorId =
  // Economia
  | 'inflacao'
  | 'desemprego'
  | 'crescimentoPib'
  | 'dolar'
  | 'poderCompra'
  | 'emprego'
  // Finanças públicas
  | 'receitaPublica'
  | 'despesaPublica'
  | 'saldoOrcamentario'
  | 'dividaPublica'
  | 'resultadoFiscal'
  // Segurança
  | 'criminalidade'
  // Saúde
  | 'acessoSaude'
  | 'qualidadeSaude'
  // Educação
  | 'acessoEducacao'
  | 'qualidadeEducacao'
  // Saneamento
  | 'aguaTratada'
  | 'coletaEsgoto'
  | 'tratamentoEsgoto'
  // Popularidade
  | 'aprovacao'
  // Sociais
  | 'idh'
  | 'gini'
  | 'confiancaInstituicoes';

export type IndicatorCategory =
  | 'economia'
  | 'financas'
  | 'seguranca'
  | 'saude'
  | 'educacao'
  | 'saneamento'
  | 'popularidade'
  | 'social';

export type GroupId =
  | 'empresarios'
  | 'trabalhadores'
  | 'mercadoFinanceiro'
  | 'conservadores'
  | 'progressistas'
  | 'socialistas'
  | 'servidoresPublicos'
  | 'agronegocio'
  | 'segurancaMilitar'
  | 'populacaoGeral'
  | 'beneficiarios'
  | 'aposentados';

export type StateId = string; // "SP", "RJ", etc.

export type Trend = 'up' | 'down' | 'stable';

export interface Slider {
  id: SliderId;
  name: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description: string;
  /** true se compõe o envelope de gastos públicos */
  insideBudget?: boolean;
}

export interface Indicator {
  id: IndicatorId;
  name: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
  category: IndicatorCategory;
  /** 1 = maior é melhor, -1 = menor é melhor, 0 = neutro */
  direction: 1 | -1 | 0;
  description: string;
}

export interface Group {
  id: GroupId;
  name: string;
  /** Apoio inicial 0–100 */
  baseSupport: number;
  /** Peso do grupo na aprovação geral 0–1 */
  influence: number;
  /** Sensibilidade a cada slider (-1 a 1) */
  sliderSensitivity: Partial<Record<SliderId, number>>;
  /** Sensibilidade a cada indicador (-1 a 1) */
  indicatorSensitivity: Partial<Record<IndicatorId, number>>;
}

export interface State {
  id: StateId;
  name: string;
  region: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
  /** População em milhões (para ponderação) */
  population: number;
  /** Peso político 0–1 (influência no parlamento) */
  politicalWeight: number;
  /** Aprovação inicial do governo no estado (0–100) */
  initialApproval: number;
}

export interface GroupState {
  support: number;       // 0–100
  lastChange: number;    // delta no último turno
  trend: Trend;
}

export interface StateSnapshot {
  approval: number;      // 0–100
  lastChange: number;
}


// ─── Tipos de mídia ────────────────────────────────────
export type NewsCategory =
  | 'economia' | 'politica' | 'social' | 'seguranca'
  | 'saude' | 'educacao' | 'infraestrutura' | 'meioAmbiente';

export type NewsTone = 'positiva' | 'negativa' | 'neutra' | 'critica' | 'alarmante';

export interface NewsItem {
  id: string;
  turn: number;
  category: NewsCategory;
  tone: NewsTone;
  title: string;
  body: string;
  source: string;
  imageSeed: string;
  relatedIndicators: IndicatorId[];
  relatedPolicyId?: string;
}

export type PostTone = 'apoio' | 'critica' | 'neutro' | 'ironia';

export interface SocialPost {
  id: string;
  turn: number;
  authorGroup: GroupId;
  authorName: string;
  handle: string;
  tone: PostTone;
  text: string;
  likes: number;
  reposts: number;
  replies: number;
  avatarSeed: string;
  relatedPolicyId?: string;
}

export interface NarrativeReaction {
  groupId: GroupId;
  headline: string;
  summary: string;
  intensity: number;
}

export interface TurnMedia {
  news: NewsItem[];
  posts: SocialPost[];
  reactions: NarrativeReaction[];
}

export interface GameState {
  turn: number;
  sliders: Record<SliderId, number>;
  indicators: Record<IndicatorId, number>;
  groups: Record<GroupId, GroupState>;
  states: Record<StateId, StateSnapshot>;
  activePolicies: import('./policy').PolicyMeasure[];
  pendingPolicies: import('./policy').PolicyMeasure[];
  history: Array<{
    turn: number;
    indicators: Record<IndicatorId, number>;
    sliders: Record<SliderId, number>;
  }>;
  /** Último turno em que cada controle permanente foi salvo. */
  sliderSavedAtTurn?: Partial<Record<SliderId, number>>;
  /** Registro das alterações manuais salvas nos controles permanentes. */
  sliderChangeHistory?: Array<{ sliderId: SliderId; previousValue: number; newValue: number; turn: number }>;
  media?: TurnMedia;

  // ── novos ──
  playerName?: string;
  playerPartyId?: string;
}
