// services/politics/coalition.ts

import type { Ideology, Party } from '../../types/politics';
import { initialParties } from '../../types/politics';

// ============================================================
// POSIÇÃO IDEOLÓGICA NUMÉRICA
// ============================================================
// -3 = extrema esquerda, +3 = extrema direita.

export const IDEOLOGY_POS: Record<Ideology, number> = {
  extrema_esquerda: -3,
  esquerda: -2,
  centro_esquerda: -1,
  centro: 0,
  centro_direita: 1,
  direita: 2,
  extrema_direita: 3,
};

export function ideologyPos(ideology: Ideology): number {
  return IDEOLOGY_POS[ideology] ?? 0;
}

// ============================================================
// CENTRÃO
// ============================================================
// Partidos flexíveis: não têm ideologia forte, negociam mais,
// tendem a apoiar qualquer governo que esteja razoavelmente bem.

export const CENTRAO: Set<string> = new Set([
  'mdb',
  'psd',
  'pp',
  'republicanos',
  'uniao',
  'solidariedade',
  'podemos',
  'avante',
  'prd',
]);

/** Apoio mínimo do centrão enquanto o governo não estiver afundado. */
export const CENTRAO_FLOOR = 45;

/** A partir desta aprovação nacional, o centrão mantém o piso. */
export const CENTRAO_MIN_APPROVAL = 35;

// ============================================================
// ALINHAMENTO BASE
// ============================================================
// Cada partido tem um alinhamento natural com o partido do jogador.
// Quanto mais próxima a ideologia, maior o alinhamento base.

/**
 * Alinhamento base de um partido ao governo do jogador.
 * Retorna um número 0–100 que serve como aprovação inicial dos
 * parlamentares daquele partido antes de qualquer ajuste contextual.
 *
 * Regras:
 *   - Mesmo partido: 90
 *   - Mesma ideologia: ~75
 *   - Um passo de distância: ~55
 *   - Dois passos: ~35
 *   - Três ou mais: ~20
 *   - Centrão: pelo menos CENTRAO_FLOOR
 */
export function baseAlignment(party: Party, player: Party): number {
  let base: number;

  if (party.id === player.id) {
    base = 90;
  } else {
    const dist = Math.abs(
      IDEOLOGY_POS[party.ideology] - IDEOLOGY_POS[player.ideology],
    );
    switch (dist) {
      case 0: base = 75; break;
      case 1: base = 55; break;
      case 2: base = 35; break;
      case 3: base = 25; break;
      case 4: base = 20; break;
      default: base = 15;
    }
  }

  // Centrão: piso razoável
  if (CENTRAO.has(party.id)) {
    base = Math.max(base, CENTRAO_FLOOR);
  }

  return base;
}

// ============================================================
// ATRAÇÃO DO PARTIDO DO JOGADOR
// ============================================================
// Partidos pequenos ganham um bônus: o jogador "puxa" mais apoio
// relativo de quem tem menos cadeiras.

export function playerPartyAttraction(player: Party): number {
  const seats = player.deputies + player.senators * 3; // Senado pesa mais
  // Partido grande: bônus baixo. Partido pequeno: bônus alto.
  // Escala 0–1.
  const normalized = Math.min(1, seats / 200);
  return 1 - normalized * 0.5;
}

// ============================================================
// HELPERS
// ============================================================

export function findParty(id: string): Party | undefined {
  return initialParties.find((p) => p.id === id);
}

export function partiesByIdeology(ideology: Ideology): Party[] {
  return initialParties.filter((p) => p.ideology === ideology);
}

export function isCentrao(partyId: string): boolean {
  return CENTRAO.has(partyId);
}

/**
 * Distância ideológica em passos (0–6) entre duas ideologias.
 */
export function ideologyDistance(a: Ideology, b: Ideology): number {
  return Math.abs(IDEOLOGY_POS[a] - IDEOLOGY_POS[b]);
}

/**
 * Compatibilidade -3..+3 convertida para o range de distância.
 * 0 = totalmente compatível, 6 = totalmente oposto.
 */
export function incompatibility(policyPos: number, partyIdeology: Ideology): number {
  return Math.abs(policyPos - IDEOLOGY_POS[partyIdeology]);
}