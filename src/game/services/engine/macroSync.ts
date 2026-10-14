import {
  MACRO_INDICATORS,
  MACRO_REFS,
  type MacroSyncContext,
} from '../../data/macroIndicators';
import type { StateId } from '../../data/states';

// ============================================================
// TIPOS
// ============================================================

export interface MacroSyncResult {
  macros: Record<string, number>;
  log: Array<{ macroId: string; from: number; to: number }>;
}

// ============================================================
// SYNC
// ============================================================

/**
 * Sincroniza os 10 macros a partir dos indicadores detalhados.
 * Standalone (scandalExposure, militaryLoyalty, crisisClimate) NÃO são tocados.
 *
 * Roda no fim do turno, depois da agregação nacional.
 */
export function syncMacroIndicators(
  macros: Record<string, number>,
  detailed: {
    national: Record<string, number>;
    stateIndicators: Record<StateId, Record<string, number>>;
  },
): MacroSyncResult {
  const out = { ...macros };
  const log: MacroSyncResult['log'] = [];

  const ctx: MacroSyncContext = {
    national: detailed.national,
    stateIndicators: detailed.stateIndicators,
    refs: MACRO_REFS,
  };

  for (const m of MACRO_INDICATORS) {
    if (m.source.kind === 'standalone') continue;

    const before = macros[m.id];
    const after =
      m.source.kind === 'detailed'
        ? detailed.national[m.source.indicatorId]
        : m.source.compute(ctx);

    if (after === undefined || !Number.isFinite(after)) continue;
    if (after === before) continue;

    out[m.id] = after;
    log.push({ macroId: m.id, from: before ?? NaN, to: after });
  }

  return { macros: out, log };
}