import type { GameState, IndicatorId } from '../../types/game';
import type { PolicyMeasure } from '../../types/policy';

export type {
  NewsCategory, NewsTone, NewsItem,
  PostTone, SocialPost, NarrativeReaction, TurnMedia,
} from '../../types/game';

export interface TemplateContext {
  state: GameState;
  previousIndicators: Record<IndicatorId, number>;
  previousSliders: Record<string, number>;
  policy?: PolicyMeasure;
  rng: () => number;
}
