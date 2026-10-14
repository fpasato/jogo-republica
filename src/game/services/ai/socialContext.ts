// src/game/services/ai/socialContext.ts

import { SOCIAL_PROFILES, type Perfil } from '../../data/socialProfiles';
import { getGroup } from '../../data/groups';
import type { Noticia, PlayerPost } from '../../types/ai';
import type { GameStateForNews } from '../../types/ai';

// ============================================================
// TIPOS
// ============================================================

export interface SocialContextInput {
  game: GameStateForNews;
  noticias: Noticia[];
  playerPostsFromLastTurn: PlayerPost[];
  /** Perfil do jogador (nome + handle). */
  playerSeed: {
    nome: string;
    handle: string;
    ideology: string;
  };
  /** Quantos posts gerar. */
  targetCount: number;
}

/** Perfil resumido que a IA pode usar. */
export interface SocialPerfilResumo {
  id: string;
  handle: string;
  nome: string;
  kind: string;
  ideology: string;
  temperamento: string;
  foco?: string;
  bio?: string;
}

export interface SocialTopic {
  tipo: 'noticia' | 'reacao' | 'crise' | 'player_post';
  refId: string;
  resumo: string;
}

export interface SocialContext {
  year: number;
  month: number;
  /** Aprovação nacional + macros em destaque. */
  pais: {
    approval: number;
    crise: boolean;
    escandalo: boolean;
    militar: boolean;
  };
  /** Notícias que os perfis podem comentar. */
  noticias: Array<{
    id: string;
    manchete: string;
    tom: string;
    veiculo: string;
    tema: string;
  }>;
  /** Posts do jogador do turno anterior (alvo de reações). */
  playerPosts: Array<{
    id: string;
    texto: string;
    tom: string;
    diasAtras: number;
  }>;
  /** Grupos insatisfeitos. */
  gruposEmCrise: Array<{ id: string; nome: string }>;
  /** Tópicos que devem dominar o feed. */
  topicos: SocialTopic[];
  /** Perfis disponíveis pra postar. */
  perfis: SocialPerfilResumo[];
  /** Perfil do jogador. */
  jogador: {
    nome: string;
    handle: string;
    ideology: string;
  };
  /** Meta de posts. */
  targetCount: number;
}

// ============================================================
// CONSTANTES
// ============================================================

/**
 * Prioriza perfis que combinam com o mês.
 * Ex: se há crise econômica, jornal_economico + economista postam mais.
 */
function relevanceScore(p: Perfil, ctx: {
  crise: boolean;
  escandalo: boolean;
  temas: Set<string>;
}): number {
  let score = 1;

  // Foco editorial casa com tema do mês
  if (p.foco && ctx.temas.has(p.foco)) score += 3;

  // Crise faz todos postarem
  if (ctx.crise) score += 1;

  // Escândalo atrai haters + opositores
  if (ctx.escandalo && (p.kind === 'hater' || p.kind === 'opositor')) score += 2;

  // Imprensa sempre ativa
  if (p.kind === 'imprensa') score += 1;

  return score;
}

// ============================================================
// API
// ============================================================

export function buildSocialContext(input: SocialContextInput): SocialContext {
  const { game, noticias, playerPostsFromLastTurn, playerSeed, targetCount } = input;

  // ---------- Estado do país ----------
  const crise = (game.macros.crisisClimate ?? 0) >= 55;
  const escandalo = (game.macros.scandalExposure ?? 0) >= 45;
  const militar = (game.macros.militaryLoyalty ?? 100) <= 45;

  // ---------- Temas dominantes ----------
  const temas = new Set<string>();
  for (const n of noticias) temas.add(n.tema);
  if (crise) temas.add('politics');
  if (escandalo) temas.add('politics');

  // ---------- Perfis ordenados por relevância ----------
  const scored = SOCIAL_PROFILES
    .filter((p) => p.ativo)
    .map((p) => ({ p, score: relevanceScore(p, { crise, escandalo, temas }) }))
    .sort((a, b) => b.score - a.score);

  const perfis: SocialPerfilResumo[] = scored.map(({ p }) => ({
    id: p.id,
    handle: p.handle,
    nome: p.nome,
    kind: p.kind,
    ideology: p.ideology,
    temperamento: p.temperamento,
    foco: p.foco,
    bio: p.bio,
  }));

  // ---------- Notícias para o contexto ----------
  const noticiasResumo = noticias.map((n) => ({
    id: n.id,
    manchete: n.manchete,
    tom: n.tom,
    veiculo: n.veiculo,
    tema: n.tema,
  }));

  // ---------- Player posts ----------
  const playerPostsResumo = playerPostsFromLastTurn.map((p) => ({
    id: p.id,
    texto: p.texto,
    tom: p.tom,
    diasAtras: Math.max(0, game.month - p.mes),
  }));

  // ---------- Grupos em crise ----------
  const gruposEmCrise = Object.entries(game.groupApprovals)
    .filter(([, v]) => v < 35)
    .map(([id]) => ({ id, nome: getGroup(id).nome }));

  // ---------- Tópicos ----------
  const topicos: SocialTopic[] = [];

  for (const n of noticias) {
    topicos.push({
      tipo: 'noticia',
      refId: n.id,
      resumo: n.manchete,
    });
  }

  for (const r of game.activeReactions) {
    const g = getGroup(r.groupId);
    topicos.push({
      tipo: 'reacao',
      refId: r.groupId,
      resumo: `${g.nome} em mobilização há ${r.monthsActive} meses.`,
    });
  }

  if (crise) topicos.push({ tipo: 'crise', refId: 'crisisClimate', resumo: 'Clima de crise elevado no país.' });
  if (escandalo) topicos.push({ tipo: 'crise', refId: 'scandalExposure', resumo: 'Governo sob exposição a escândalo.' });
  if (militar) topicos.push({ tipo: 'crise', refId: 'militaryLoyalty', resumo: 'Mal-estar nos quartéis.' });

  for (const pp of playerPostsFromLastTurn) {
    topicos.push({
      tipo: 'player_post',
      refId: pp.id,
      resumo: `Post do presidente: "${truncate(pp.texto, 80)}"`,
    });
  }

  return {
    year: game.year,
    month: game.month,
    pais: {
      approval: game.nationalApproval,
      crise,
      escandalo,
      militar,
    },
    noticias: noticiasResumo,
    playerPosts: playerPostsResumo,
    gruposEmCrise,
    topicos,
    perfis,
    jogador: playerSeed,
    targetCount,
  };
}

// ============================================================
// HELPERS
// ============================================================

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
