// src/game/services/engine/macroSync.ts
import { MACRO_INDICATORS } from '../../data/macroIndicators';

export interface MacroSyncResult {
  macros: Record<string, number>;
  log: Array<{ macroId: string; from: number; to: number }>;
}

export function syncMacroIndicators(
  macros: Record<string, number>,
  detailed: { national: Record<string, number> },
): MacroSyncResult {
  const out = { ...macros };
  const log: MacroSyncResult['log'] = [];

  for (const m of MACRO_INDICATORS) {
    const before = macros[m.id];
    const after = detailed.national[m.id];

    if (after === undefined || !Number.isFinite(after)) continue;
    if (after === before) continue;

    out[m.id] = after;
    log.push({ macroId: m.id, from: before ?? NaN, to: after });
  }

  return { macros: out, log };
}