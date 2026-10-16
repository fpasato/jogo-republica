import type { NarrativeReaction, TemplateContext } from './types';
import type { GroupId } from '../../types/game';
import { GROUPS } from '../../data/groups';

const POSITIVE_HEADLINES = [
  '{grupo} aprova medidas do governo',
  '{grupo} demonstra apoio após decisão',
  'Base do governo celebra avanço com {grupo}',
];

const NEGATIVE_HEADLINES = [
  '{grupo} critica decisão do governo',
  'Insatisfação cresce entre {grupo}',
  '{grupo} manifesta preocupação com o rumo',
];

const NEUTRAL_HEADLINES = [
  '{grupo} em compasso de espera',
  '{grupo} acompanha próximos passos do governo',
  'Sem euforia: {grupo} mantém cautela',
];

const POSITIVE_SUMMARY =
  'A recepção foi favorável. Lideranças do grupo apontaram coerência com suas demandas e sinalizaram apoio nas próximas votações.';
const NEGATIVE_SUMMARY =
  'A recepção foi negativa. Lideranças criticaram a decisão e sinalizaram mobilização nos próximos dias.';
const NEUTRAL_SUMMARY =
  'Sem grande entusiasmo nem rejeição. O grupo mantém posição de observação enquanto avalia desdobramentos.';

/**
 * Devolve reações narrativas para os grupos com maior variação de apoio no turno.
 * Inclui a reação direta da política ativada, se houver.
 */
export function generateGroupReactions(
  ctx: TemplateContext,
  topN = 4,
): NarrativeReaction[] {
  const reactions: NarrativeReaction[] = [];
  const { groups } = ctx.state;

  // Reação direta da política ativada
  if (ctx.policy && ctx.policy.activatedAtTurn === ctx.state.turn) {
    for (const r of ctx.policy.groupReactions) {
      const positive = r.intensity >= 0;
      const headline = (positive ? POSITIVE_HEADLINES[0] : NEGATIVE_HEADLINES[0])
        .replace('{grupo}', GROUPS[r.groupId].name);
      reactions.push({
        groupId: r.groupId,
        headline,
        summary: r.reason
          ? `${r.reason}. ${positive ? POSITIVE_SUMMARY : NEGATIVE_SUMMARY}`
          : positive ? POSITIVE_SUMMARY : NEGATIVE_SUMMARY,
        intensity: r.intensity,
      });
    }
  }

  // Complementa com grupos que mais mudaram no turno
  const already = new Set(reactions.map(r => r.groupId));
  const ranked = (Object.keys(groups) as GroupId[])
    .filter(id => !already.has(id))
    .map(id => ({ id, change: groups[id].lastChange }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, topN);

  for (const { id, change } of ranked) {
    if (Math.abs(change) < 0.4) continue;
    const positive = change > 0;
    const pool = positive ? POSITIVE_HEADLINES : change < -0.4 ? NEGATIVE_HEADLINES : NEUTRAL_HEADLINES;
    const idx = Math.floor(ctx.rng() * pool.length);
    const headline = pool[idx].replace('{grupo}', GROUPS[id].name);
    reactions.push({
      groupId: id,
      headline,
      summary: positive ? POSITIVE_SUMMARY : change < -0.4 ? NEGATIVE_SUMMARY : NEUTRAL_SUMMARY,
      intensity: change > 0 ? 1 : change < -0.4 ? -1 : 0,
    });
  }

  return reactions;
}