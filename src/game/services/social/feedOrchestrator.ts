// src/game/services/social/feedOrchestrator.ts

import { generateNews } from '../ai/newsAI';
import { generateSocialFeed } from '../ai/socialAI';
import { analyzePlayerPosts } from '../ai/playerPostAI';
import { pickImage } from '../engine/newsImagePicker';
import { NEWS_VEHICLES } from '../../data/newsVehicles';
import type {
  Noticia,
  Post,
  PlayerPost,
  PlayerPostAnalysis,
  NewsAIMetadata,
  SocialAIMetadata,
  PlayerPostAIMetadata,
  ContextSnapshot,
  GameStateForNews,
} from '../../types/ai';
import type { TurnLog, TurnSummary } from '../engine/turn';

// ============================================================
// TIPOS
// ============================================================

export interface FeedPipelineInput {
  game: GameStateForNews;
  history: ContextSnapshot[];
  lastTurnLog: TurnLog;
  lastTurnSummary: TurnSummary;
  /** Posts que o jogador escreveu no turno ANTERIOR (para análise). */
  playerPostsFromLastTurn: PlayerPost[];
  /** Perfil do jogador (nome + handle). */
  playerSeed: {
    nome: string;
    handle: string;
    ideology: string;
  };
  /** Quantos posts gerar na rede social (default: 22). */
  socialPostCount?: number;
}

export interface FeedPipelineOptions {
  model?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (stage: 'player_posts' | 'news' | 'social') => void;
}

export interface FeedPipelineMetadata {
  news: NewsAIMetadata;
  social: SocialAIMetadata;
  playerPosts: PlayerPostAIMetadata;
  totalDurationMs: number;
}

export interface FeedPipelineResult {
  noticias: Noticia[];
  posts: Post[];
  analyses: PlayerPostAnalysis[];
  /** Notícias que surgiram de posts do jogador (subset de `noticias`). */
  noticiasDePosts: Noticia[];
  /** Notícias geradas pela IA a partir dos gatilhos. */
  noticiasDeGatilhos: Noticia[];
  metadata: FeedPipelineMetadata;
}

// ============================================================
// PIPELINE
// ============================================================

export async function runFeedPipeline(
  input: FeedPipelineInput,
  options: FeedPipelineOptions = {},
): Promise<FeedPipelineResult> {
  const start = Date.now();

  // ---------- 1. Análise de posts do jogador ----------
  options.onProgress?.('player_posts');
  const playerResult = await analyzePlayerPosts(
    {
      game: input.game,
      playerPosts: input.playerPostsFromLastTurn,
      noticias: [],
      recentPosts: [],
      playerSeed: input.playerSeed,
    },
    {
      model: options.model,
      timeoutMs: options.timeoutMs,
      maxAttempts: options.maxAttempts,
      signal: options.signal,
    },
  );

  // ---------- 2. Converte posts vira-notícia ----------
  const noticiasDePosts = playerResult.analyses
    .filter((a) => a.virouNoticia && a.mancheteNoticia)
    .map((a) => buildNoticiaFromPost(a, input));

  // ---------- 3. Gera notícias de gatilhos ----------
  options.onProgress?.('news');
  const newsResult = await generateNews(
    {
      game: input.game,
      history: input.history,
      lastTurnLog: input.lastTurnLog,
      lastTurnSummary: input.lastTurnSummary,
    },
    {
      model: options.model,
      timeoutMs: options.timeoutMs,
      maxAttempts: options.maxAttempts,
      signal: options.signal,
    },
  );

  // ---------- 4. Combina notícias ----------
  const allNoticias = [...noticiasDePosts, ...newsResult.noticias];

  // ---------- 5. Gera feed social ----------
  options.onProgress?.('social');
  const socialResult = await generateSocialFeed(
    {
      game: input.game,
      noticias: allNoticias,
      playerPostsFromLastTurn: input.playerPostsFromLastTurn,
      playerSeed: input.playerSeed,
      targetCount: input.socialPostCount ?? 22,
    },
    {
      model: options.model,
      timeoutMs: options.timeoutMs,
      maxAttempts: options.maxAttempts,
      signal: options.signal,
    },
  );

  return {
    noticias: allNoticias,
    posts: socialResult.posts,
    analyses: playerResult.analyses,
    noticiasDePosts,
    noticiasDeGatilhos: newsResult.noticias,
    metadata: {
      news: newsResult.metadata,
      social: socialResult.metadata,
      playerPosts: playerResult.metadata,
      totalDurationMs: Date.now() - start,
    },
  };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Constrói uma Noticia a partir de uma análise de post do jogador
 * que "virou notícia". Atribui veículo aleatório e tema politics.
 */
function buildNoticiaFromPost(
  analysis: PlayerPostAnalysis,
  input: FeedPipelineInput,
): Noticia {
  // Escolhe um veículo aleatório (a IA de rede vai comentar depois)
  const veiculo = NEWS_VEHICLES[Math.floor(Math.random() * NEWS_VEHICLES.length)];
  const postOriginal = input.playerPostsFromLastTurn.find(
    (p) => p.id === analysis.postId,
  );
  const textoPost = postOriginal?.texto ?? '';

  // Tom negativo se a reação social foi ruim
  const tom = analysis.reacaoSocial < 0 ? 'negativo' : analysis.reacaoSocial > 0 ? 'positivo' : 'neutro';

  // Importância alta se houve escândalo
  const importancia: 1 | 2 | 3 =
    analysis.scandalAdd >= 3 ? 3 : analysis.scandalAdd >= 1 ? 2 : 1;

  const id = `news_post_${input.game.year}_${input.game.month}_${analysis.postId}_${Date.now().toString(36)}`;

  return {
    id,
    mes: input.game.month,
    manchete: analysis.mancheteNoticia ?? 'Presidente gera repercussão nas redes',
    submanchete: `Declaração do presidente repercute: "${truncate(textoPost, 100)}"`,
    corpo: buildCorpoNoticiaPost(analysis, textoPost),
    veiculo: veiculo.id,
    tema: 'politics',
    tom,
    importancia,
    imagem: pickImage('politics'),
    destaques: [],
    gatilho: {
      kind: 'player_action',
      tema: 'politics',
      detalhe: `Post do presidente: "${truncate(textoPost, 80)}"`,
      impacto: 8 + analysis.scandalAdd,
      refId: analysis.postId,
    },
  };
}

function buildCorpoNoticiaPost(
  analysis: PlayerPostAnalysis,
  textoPost: string,
): string {
  const p1 = `O presidente da República publicou nas redes sociais uma declaração que gerou forte repercussão nesta semana. O post, com tom ${analysis.reacaoSocial < 0 ? 'polêmico' : 'destacado'}, dividiu opiniões e dominou as conversas digitais.`;

  const p2 = `"${truncate(textoPost, 180)}" — escreveu o presidente.`;

  const p3 = analysis.scandalAdd >= 2
    ? 'A oposição cobrou explicações e prometeu acionar os mecanismos institucionais. O governo ainda não se manifestou oficialmente.'
    : 'Assessores do Planalto minimizaram o episódio, mas aliados reconhecem que o tema deve repercutir nos próximos dias.';

  return [p1, p2, p3].join('\n\n');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
