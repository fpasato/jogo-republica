// services/politics/profileService.ts

import { GROUPS } from '../../data/groups';
import { PROFILE_AXES, SLIDER_BUDGET, type ProfileAxis } from '../../data/profile';
import {
  computeGroupBaseline,
  computeNationalApproval,
  clampApproval,
} from '../engine/approval';
import type { PlayerProfile, ProfileContext } from '../../types/ai';
export type { PlayerProfile } from '../../types/ai';
import { initialParties } from '../../types/politics';

// ============================================================
// PERFIL PADRÃO
// ============================================================

export const defaultProfile = (name = 'Jogador'): ProfileContext => ({
  playerName: name,
  partyId: 'psb',
  partyAcronym: 'PSB',
  govIdeology: -0.5,
  govIdeologyLabel: 'centro_esquerda',
  axes: {
    economia: -1,
    costumes: -1,
    seguranca: -1,
    ambiente: 1,
    gasto_social: 1,
  },
});

// ============================================================
// SLIDERS → EIXOS
// ============================================================

export interface SliderValues {
  economia: number;
  costumes: number;
  seguranca: number;
  ambiente: number;
  gasto_social: number;
}

/** Normaliza sliders respeitando o orçamento de pontos. */
export function normalizeSliders(input: Partial<SliderValues>): SliderValues {
  const out: SliderValues = {
    economia: input.economia ?? 0,
    costumes: input.costumes ?? 0,
    seguranca: input.seguranca ?? 0,
    ambiente: input.ambiente ?? 0,
    gasto_social: input.gasto_social ?? 0,
  };
  const total = Object.values(out).reduce((s, v) => s + Math.abs(v), 0);
  if (total <= SLIDER_BUDGET) return out;
  const scale = SLIDER_BUDGET / total;
  for (const k of Object.keys(out) as (keyof SliderValues)[]) {
    out[k] = Math.round(out[k] * scale);
  }
  return out;
}

// ============================================================
// IDEOLOGIA A PARTIR DOS EIXOS
// ============================================================

/**
 * Deriva `govIdeology` (-3..+3) dos eixos.
 * Peso maior no eixo econômico, que é o principal no jogo.
 */
export function computeGovIdeology(axes: SliderValues): number {
  const weights = {
    economia: 0.40,
    costumes: 0.20,
    seguranca: 0.15,
    ambiente: 0.10,
    gasto_social: 0.15,
  };
  let sum = 0;
  for (const k of Object.keys(weights) as (keyof SliderValues)[]) {
    sum += (axes[k] ?? 0) * weights[k];
  }
  // Sliders vão de -3..+3; resultado também -3..+3, mas com peso diluído.
  // Multiplicamos por ~1.6 pra dar alcance razoável.
  return Math.max(-3, Math.min(3, sum * 1.6));
}

/** Converte o perfil do formulário para o perfil usado pelo motor. */
export function profileToContext(profile: PlayerProfile): ProfileContext {
  const axes = normalizeSliders(profile.sliders);
  const ideology = computeGovIdeology(axes);
  const party = initialParties.find((item) => item.id === profile.partyId);
  return {
    playerName: profile.nome || 'Jogador',
    partyId: profile.partyId,
    partyAcronym: party?.acronym ?? profile.partyId.toUpperCase(),
    govIdeology: ideology,
    govIdeologyLabel: ideology < -0.5 ? 'centro_esquerda' : ideology > 0.5 ? 'centro_direita' : 'centro',
    axes,
  };
}

function axisAffinity(groupId: string, axes: SliderValues): number {
  return PROFILE_AXES.reduce((sum, axis: ProfileAxis) => {
    const affinity = axis.afinidade[groupId] ?? 0;
    return sum + (axes[axis.id as keyof SliderValues] * affinity) / 3;
  }, 0);
}

// ============================================================
// GRUPOS INICIAIS
// ============================================================

/**
 * Constrói `groupApprovals` a partir do perfil do jogador.
 * Usa `computeGroupBaseline` (mesmo do motor).
 *
 * Nota: não usamos mais o `GROUP_LEAN` do `profile.ts` diretamente —
 * cada `GroupDef` já carrega seu `lean` e `eixos`.
 */
export function buildInitialGroups(
  profile: ProfileContext | PlayerProfile,
): Record<string, number> {
  const context = 'axes' in profile ? profile : profileToContext(profile);
  const out: Record<string, number> = {};
  for (const g of GROUPS) {
    out[g.id] = clampApproval(computeGroupBaseline(g.id, context.govIdeology, []) + axisAffinity(g.id, context.axes));
  }
  return out;
}

// ============================================================
// APROVAÇÃO NACIONAL
// ============================================================

/** Reexporta — alguns lugares ainda importam daqui. */
export { computeNationalApproval as nationalApprovalFromGroups };

// ============================================================
// APROVAÇÃO NACIONAL A PARTIR DE GroupData[]
// ============================================================

/**
 * Compat com o formato antigo `GroupData[]`.
 * Converte pra `Record<string, number>` e delega.
 */
export function nationalApprovalFromGroupData(
  groups: Array<{ id: string; approval: number }>,
): number {
  const map: Record<string, number> = {};
  for (const g of groups) map[g.id] = g.approval;
  return computeNationalApproval(map);
}

export function playerProfileFromSliders(
  nome: string,
  partyId: string,
  sliders: Record<string, number>,
): PlayerProfile {
  return { nome, partyId, sliders: normalizeSliders(sliders as Partial<SliderValues>) };
}
