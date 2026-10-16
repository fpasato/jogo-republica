import type { GameState } from '../../types/game';
import type { NewsItem, SocialPost, NarrativeReaction } from './types';
import { makeRng } from './rng';
import { generateNews } from './newsTemplates';
import { generatePosts } from './postTemplates';
import { generateGroupReactions } from './groupReactions';

export interface TurnMedia {
  news: NewsItem[];
  posts: SocialPost[];
  reactions: NarrativeReaction[];
}

/**
 * Gera todo o conteúdo narrativo do turno a partir do estado atual
 * e do snapshot anterior. Não usa IA.
 */
export function generateTurnMedia(
  state: GameState,
  previousIndicators: Record<string, number>,
  previousSliders: Record<string, number>,
  activatedPolicyId?: string,
): TurnMedia {
  // Semente determinística por turno (reprodutível)
  const seed = state.turn * 2654435761;
  const rng = makeRng(seed);

  const policy = activatedPolicyId
    ? state.activePolicies.find(p => p.id === activatedPolicyId)
    : undefined;

  const ctx = {
    state,
    previousIndicators: previousIndicators as any,
    previousSliders,
    policy,
    rng,
  };

  return {
    news: generateNews(ctx, 6),
    posts: generatePosts(ctx, 5),
    reactions: generateGroupReactions(ctx, 4),
  };
}