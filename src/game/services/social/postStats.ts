// src/game/services/social/postStats.ts

import { PROFILE_BY_ID, type Perfil, type ProfileKind } from '../../data/socialProfiles';

// ============================================================
// TIPOS
// ============================================================

export interface PostStats {
  views: number;
  likes: number;
  reposts: number;
}

export interface ComputeStatsInput {
  /** Perfil do autor. Se for perfil fixo, passa o objeto direto. */
  autor: Perfil | {
    id: string;
    seguidores: number;
    kind: 'jogador';
  };
  /** É uma resposta a outro post? Resp. costumam ter menos alcance. */
  isReply?: boolean;
  /** Tem mídia (imagem)? Posts com mídia engajam mais. */
  hasMedia?: boolean;
  /** Se a análise marcou como viral. Multiplica tudo por 5. */
  viral?: boolean;
  /** Aprovação nacional do governo. Só usado pro jogador. */
  nationalApproval?: number;
}

// ============================================================
// CONSTANTES
// ============================================================

/**
 * Multiplicador base de views sobre seguidores.
 * Imprensa alcança mais que político, hater alcança pouco mas engaja muito.
 */
const VIEW_MULTIPLIER: Record<ProfileKind | 'jogador', number> = {
  imprensa: 1.8,
  aliado: 0.6,
  opositor: 0.7,
  lider_social: 0.8,
  influenciador: 1.3,
  hater: 0.4,
  bot: 0.2,
  jogador: 1.2,
};

/**
 * Taxa de likes sobre views.
 * Hater ganha like fácil (base engajada), imprensa ganha menos.
 */
const LIKE_RATE: Record<ProfileKind | 'jogador', number> = {
  imprensa: 0.02,
  aliado: 0.06,
  opositor: 0.07,
  lider_social: 0.09,
  influenciador: 0.08,
  hater: 0.14,
  bot: 0.01,
  jogador: 0.05,
};

/**
 * Taxa de reposts sobre views.
 * Influenciador e hater fazem mais repost. Imprensa quase não.
 */
const REPOST_RATE: Record<ProfileKind | 'jogador', number> = {
  imprensa: 0.005,
  aliado: 0.015,
  opositor: 0.02,
  lider_social: 0.025,
  influenciador: 0.03,
  hater: 0.04,
  bot: 0.002,
  jogador: 0.02,
};

/** Fator quando é resposta. Respostas alcançam menos. */
const REPLY_FACTOR = 0.35;

/** Fator quando tem mídia. Mídia engaja mais. */
const MEDIA_FACTOR = 1.25;

/** Fator quando viraliza. */
const VIRAL_FACTOR = 5;

/** Ruído aleatório aplicado nas views (±20%). */
const NOISE = 0.2;

// ============================================================
// API PRINCIPAL
// ============================================================

/**
 * Calcula views/likes/reposts de um post.
 *
 * Fórmula:
 *   views = seguidores × multiplier(kind) × (resposta? 0.35) × (mídia? 1.25) × (viral? 5) × ruído
 *   likes = views × likeRate(kind)
 *   reposts = views × repostRate(kind)
 *
 * Para o jogador, multiplier é ajustado pela aprovação nacional.
 */
export function computeStats(input: ComputeStatsInput): PostStats {
  const { autor, isReply, hasMedia, viral, nationalApproval } = input;

  const kind = autor.kind as ProfileKind | 'jogador';
  const seguidores = autor.seguidores;

  // ---------- Multiplicador base ----------
  let multiplier = VIEW_MULTIPLIER[kind] ?? 0.5;

  // Ajuste especial para o jogador: aprovação modula o alcance
  if (kind === 'jogador' && typeof nationalApproval === 'number') {
    // Aprovação 50 = 1.0× | Aprovação 100 = 1.5× | Aprovação 0 = 0.5×
    const approvalFactor = 0.5 + (nationalApproval / 100);
    multiplier *= approvalFactor;
  }

  // ---------- Fatores ----------
  let views = seguidores * multiplier;

  if (isReply) views *= REPLY_FACTOR;
  if (hasMedia) views *= MEDIA_FACTOR;
  if (viral) views *= VIRAL_FACTOR;

  // Ruído ±20%
  const noise = 1 + (Math.random() * 2 - 1) * NOISE;
  views = Math.max(10, Math.round(views * noise));

  // ---------- Likes e reposts ----------
  const likeRate = LIKE_RATE[kind] ?? 0.05;
  const repostRate = REPOST_RATE[kind] ?? 0.02;

  const likes = Math.max(0, Math.round(views * likeRate));
  const reposts = Math.max(0, Math.round(views * repostRate));

  return { views, likes, reposts };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Calcula stats para um post do jogador sem perfil completo.
 * O jogador não está em SOCIAL_PROFILES — passamos dados diretos.
 */
export function computeStatsForPlayer(
  seguidores: number,
  nationalApproval: number,
  opts: { isReply?: boolean; hasMedia?: boolean; viral?: boolean } = {},
): PostStats {
  return computeStats({
    autor: {
      id: 'player',
      seguidores,
      kind: 'jogador',
    },
    isReply: opts.isReply,
    hasMedia: opts.hasMedia,
    viral: opts.viral,
    nationalApproval,
  });
}

/**
 * Calcula stats para um post vindo de um perfil cadastrado.
 */
export function computeStatsForProfile(
  profileId: string,
  opts: { isReply?: boolean; hasMedia?: boolean; viral?: boolean } = {},
): PostStats | null {
  const perfil = PROFILE_BY_ID[profileId];
  if (!perfil) return null;
  return computeStats({
    autor: perfil,
    isReply: opts.isReply,
    hasMedia: opts.hasMedia,
    viral: opts.viral,
  });
}