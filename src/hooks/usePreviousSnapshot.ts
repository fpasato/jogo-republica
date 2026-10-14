// src/hooks/usePreviousSnapshot.ts
// Retorna o snapshot do mês ANTERIOR (o penúltimo do histórico).
// O `GameState.history` já guarda os últimos N snapshots — não precisamos
// manter tracker paralelo.

import { useGameStore } from '../store/gameStore';
import type { ContextSnapshot } from '../game/types/ai';

export function usePreviousSnapshot(): ContextSnapshot | null {
  return useGameStore((s) => {
    const h = s.game?.history;
    if (!h || h.length < 1) return null;
    // history[N-1] é o snapshot do mês anterior (o atual ainda não foi empilhado)
    return h[h.length - 1];
  });
}

/** Meses disponíveis no histórico (máximo 6). */
export function useHistoryLength(): number {
  return useGameStore((s) => s.game?.history.length ?? 0);
}