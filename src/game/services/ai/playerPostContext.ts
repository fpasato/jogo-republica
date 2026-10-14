// src/game/services/ai/playerPostContext.ts

import { PROFILE_BY_ID, SOCIAL_PROFILES } from '../../data/socialProfiles';
import { getGroup } from '../../data/groups';
import type { Noticia, Post, PlayerPost } from '../../types/ai';
import type { GameStateForNews } from '../../types/ai';

// ============================================================
// TIPOS
// ============================================================

export interface PlayerPostContextInput {
  game: GameStateForNews;
  playerPosts: PlayerPost[];
  noticias: Noticia[];
  recentPosts: Post[];
  playerSeed: {
    nome: string;
    handle: string;
    ideology: string;
  };
}

export interface PlayerPostResumo {
  id: string;
  texto: string;
  tom: string;
  /** Se é resposta a outro post. */
  respostaA?: string;
  /** Se resposta, quem foi o alvo. */
  alvoNome?: string;
  alvoHandle?: string;
  /** Stats atuais (ainda zerados quando a análise começa). */
  seguidores: number;
}

export interface PlayerPostContext {
  year: number;
  month: number;
  jogador: {
    nome: string;
    handle: string;
    ideology: string;
    approval: number;
  };
  playerPosts: PlayerPostResumo[];
  noticias: Array<{ id: string; manchete: string; tom: string; tema: string }>;
  gruposRelevantes: Array<{ id: string; nome: string; approval: number }>;
  /** Perfis disponíveis pra responder. */
  perfis: Array<{
    id: string;
    handle: string;
    nome: string;
    kind: string;
    ideology: string;
    temperamento: string;
    /** Alinhamento com o jogador: -1 (oposto) a +1 (mesmo). */
    alinhamento: number;
  }>;
  crisisClimate: number;
  scandalExposure: number;
}

// ============================================================
// IDEOLOGIA NUMÉRICA
// ============================================================
// Não importamos de coalition.ts pra evitar dependência cruzada.
// Mapa local só pra calcular alinhamento.

const IDEOLOGY_POS: Record<string, number> = {
  extrema_esquerda: -3,
  esquerda: -2,
  centro_esquerda: -1,
  centro: 0,
  centro_direita: 1,
  direita: 2,
  extrema_direita: 3,
};

function alignmentOf(playerIdeology: string, perfilIdeology: string): number {
  const a = IDEOLOGY_POS[playerIdeology] ?? 0;
  const b = IDEOLOGY_POS[perfilIdeology] ?? 0;
  const dist = Math.abs(a - b);      // 0..6
  return 1 - dist / 3;               // 1 = aliado, 0 = neutro, -1 = oposto
}

// ============================================================
// API
// ============================================================

export function buildPlayerPostContext(
  input: PlayerPostContextInput,
): PlayerPostContext {
  const { game, playerPosts, noticias, recentPosts, playerSeed } = input;

  // ---------- Posts do jogador ----------
  const postsResumo: PlayerPostResumo[] = playerPosts.map((p) => {
    let alvoNome: string | undefined;
    let alvoHandle: string | undefined;

    if (p.respostaA) {
      const alvo = recentPosts.find((rp) => rp.id === p.respostaA);
      if (alvo) {
        const perfilAlvo = PROFILE_BY_ID[alvo.autorId];
        if (perfilAlvo) {
          alvoNome = perfilAlvo.nome;
          alvoHandle = perfilAlvo.handle;
        }
      }
    }

    return {
      id: p.id,
      texto: p.texto,
      tom: p.tom,
      respostaA: p.respostaA,
      alvoNome,
      alvoHandle,
      seguidores: 5_000_000,
    };
  });

  // ---------- Notícias ----------
  const noticiasResumo = noticias.map((n) => ({
    id: n.id,
    manchete: n.manchete,
    tom: n.tom,
    tema: n.tema,
  }));

  // ---------- Grupos relevantes ----------
  const gruposRelevantes = Object.entries(game.groupApprovals)
    .map(([id, approval]) => ({ id, nome: getGroup(id).nome, approval }))
    .sort((a, b) => a.approval - b.approval)
    .slice(0, 8);

  // ---------- Perfis ----------
  const perfis = SOCIAL_PROFILES
    .filter((p) => p.ativo && p.kind !== 'bot')   // bots não respondem
    .map((p) => ({
      id: p.id,
      handle: p.handle,
      nome: p.nome,
      kind: p.kind,
      ideology: p.ideology,
      temperamento: p.temperamento,
      alinhamento: alignmentOf(playerSeed.ideology, p.ideology),
    }));

  return {
    year: game.year,
    month: game.month,
    jogador: {
      nome: playerSeed.nome,
      handle: playerSeed.handle,
      ideology: playerSeed.ideology,
      approval: game.nationalApproval,
    },
    playerPosts: postsResumo,
    noticias: noticiasResumo,
    gruposRelevantes,
    perfis,
    crisisClimate: game.macros.crisisClimate ?? 20,
    scandalExposure: game.macros.scandalExposure ?? 10,
  };
}
