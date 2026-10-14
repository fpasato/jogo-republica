
import type { StateId} from './states';


// ============================================================
// TIPOS
// ============================================================

export interface MacroSyncContext {
  national: Record<string, number>;
  /** Valores estaduais — usado pelo composto de criminalidade se quiser regionalizar. */
  stateIndicators: Record<StateId, Record<string, number>>;
  /** Referências para normalização (valores iniciais). */
  refs: Record<string, number>;
}

export type MacroSource =
  | { kind: 'detailed'; indicatorId: string }
  | { kind: 'derived';  compute: (ctx: MacroSyncContext) => number }
  | { kind: 'standalone'; initial: number };

export interface MacroIndicator {
  id: string;
  nome: string;
  unidade: string;
  melhorQuando: 'subir' | 'cair';
  source: MacroSource;
}

// ============================================================
// REFERÊNCIAS (para os compostos)
// ============================================================
// Usadas só pelos derivados. Se um dia quiser regionalizar,
// pega do stateBaselines.

const REFS: Record<string, number> = {
  homicidios: 22,
  roubos: 400,
  furtos: 500,
};

// ============================================================
// CATÁLOGO DOS 10 MACROS
// ============================================================

export const MACRO_INDICATORS: MacroIndicator[] = [
  {
    id: 'unemployment', nome: 'Desemprego', unidade: 'p.p.', melhorQuando: 'cair',
    source: { kind: 'detailed', indicatorId: 'desemprego' },
  },
  {
    id: 'growth', nome: 'Crescimento', unidade: 'p.p.', melhorQuando: 'subir',
    source: { kind: 'detailed', indicatorId: 'crescimento_pib' },
  },
  {
    id: 'inflation', nome: 'Inflação', unidade: 'p.p.', melhorQuando: 'cair',
    source: { kind: 'detailed', indicatorId: 'inflacao' },
  },
  {
    id: 'selicRate', nome: 'Selic', unidade: 'p.p.', melhorQuando: 'cair',
    source: { kind: 'detailed', indicatorId: 'selic' },
  },
  {
    id: 'dollar', nome: 'Dólar', unidade: 'R$/US$', melhorQuando: 'cair',
    source: { kind: 'detailed', indicatorId: 'cotacao_dolar' },
  },
  {
    id: 'debt', nome: 'Dívida pública', unidade: '% do PIB', melhorQuando: 'cair',
    source: {
      kind: 'derived',
      compute: ({ national }) => {
        const divida = national.divida_publica ?? 0;
        const pib = national.pib_nominal ?? 1;
        return pib > 0 ? (divida / pib) * 100 : 0;
      },
    },
  },
  {
    id: 'criminality', nome: 'Criminalidade', unidade: '(de 100)', melhorQuando: 'cair',
    source: {
      kind: 'derived',
      compute: ({ national, refs }) =>
        100 * (
          (national.homicidios ?? 0) / (refs.homicidios ?? 1) * 0.5 +
          (national.roubos ?? 0)     / (refs.roubos ?? 1)     * 0.3 +
          (national.furtos ?? 0)     / (refs.furtos ?? 1)     * 0.2
        ) / 2,   // ÷2 normaliza pra ~50 no início
    },
  },
  {
    id: 'scandalExposure', nome: 'Exposição a escândalo', unidade: '(de 100)', melhorQuando: 'cair',
    source: { kind: 'standalone', initial: 10 },
  },
  {
    id: 'militaryLoyalty', nome: 'Lealdade do Exército', unidade: '(de 100)', melhorQuando: 'subir',
    source: { kind: 'standalone', initial: 70 },
  },
  {
    id: 'crisisClimate', nome: 'Clima de crise', unidade: '(de 100)', melhorQuando: 'cair',
    source: { kind: 'standalone', initial: 20 },
  },
];

export const MACRO_BY_ID: Record<string, MacroIndicator> = Object.fromEntries(
  MACRO_INDICATORS.map((m) => [m.id, m]),
);

export const MACRO_IDS = MACRO_INDICATORS.map((m) => m.id);

/** Os 3 macros que não têm fonte detalhada. */
export const STANDALONE_MACROS = new Set(
  MACRO_INDICATORS.filter((m) => m.source.kind === 'standalone').map((m) => m.id),
);

/** Mapa macro → id detalhado (só para os espelhos diretos). */
export const MACRO_TO_DETAILED: Record<string, string> = Object.fromEntries(
  MACRO_INDICATORS
    .filter((m) => m.source.kind === 'detailed')
    .map((m) => [m.id, (m.source as any).indicatorId]),
);

export function getMacro(id: string): MacroIndicator {
  const m = MACRO_BY_ID[id];
  if (!m) throw new Error(`Macro desconhecido: ${id}`);
  return m;
}

export function initialMacroValues(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of MACRO_INDICATORS) {
    if (m.source.kind === 'standalone') {
      out[m.id] = m.source.initial;
    }
  }
  return out;
}

export { REFS as MACRO_REFS };