// src/game/data/macroIndicators.ts
// Espelho resumido dos indicadores nacionais para notícias, eventos e IA

import { getIndicator } from './indicators';

export interface MacroIndicator {
  id: string;
  name: string;
  short: string;
  unit: string;
  initial: number;
}

export const MACRO_INDICATORS: MacroIndicator[] = [
  { id: 'inflacao', name: 'Inflação (IPCA)', short: 'Inflação', unit: '% a.a.', initial: 4.2 },
  { id: 'desemprego', name: 'Desemprego', short: 'Desemprego', unit: '%', initial: 7.3 },
  { id: 'crescimento_pib', name: 'Crescimento do PIB', short: 'Crescimento PIB', unit: '%', initial: 2.5 },
  { id: 'divida_publica', name: 'Dívida pública', short: 'Dívida', unit: 'R$', initial: 8900e9 },
  { id: 'taxa_selic', name: 'Taxa Selic', short: 'Selic', unit: '% a.a.', initial: 11.25 },
  { id: 'dolar', name: 'Cotação do Dólar', short: 'Dólar', unit: 'R$/US$', initial: 5.75 },
  { id: 'criminalidade', name: 'Criminalidade geral', short: 'Criminalidade', unit: '0–100', initial: 62 },
  { id: 'qualidade_vida', name: 'Qualidade de vida', short: 'Qualidade de vida', unit: '0–100', initial: 68 },
  { id: 'aprovacao_popular', name: 'Aprovação popular', short: 'Aprovação', unit: '%', initial: 50.0 },
];

export const MACRO_BY_ID = Object.fromEntries(
  MACRO_INDICATORS.map((m) => [m.id, m]),
) as Record<string, MacroIndicator>;

export function initialMacroValues(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of MACRO_INDICATORS) {
    const ind = getIndicator(m.id);
    out[m.id] = ind.initial;
  }
  return out;
}