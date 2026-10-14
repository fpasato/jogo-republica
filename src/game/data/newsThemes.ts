// src/game/data/newsThemes.ts

import { INDICATORS } from './indicators';
import type { IndicatorCategory } from './indicators';

// ============================================================
// TEMAS DE NOTÍCIA
// ============================================================
// São 8 temas. Cada um tem uma pasta em assets/news/.

export type NewsTheme =
  | 'economy'
  | 'security'
  | 'health'
  | 'education'
  | 'politics'
  | 'environment'
  | 'social'
  | 'infrastructure';

export const ALL_NEWS_THEMES: NewsTheme[] = [
  'economy',
  'security',
  'health',
  'education',
  'politics',
  'environment',
  'social',
  'infrastructure',
];

// ============================================================
// CATEGORIA DO CATÁLOGO → TEMA DE NOTÍCIA
// ============================================================
// O catálogo tem 9 categorias. Notícia só tem 8.
// "gestao" (gestão pública) vira "politics" porque na prática
// é notícia política.

const CATEGORY_TO_THEME: Record<IndicatorCategory, NewsTheme> = {
  economia: 'economy',
  saude: 'health',
  educacao: 'education',
  seguranca: 'security',
  infraestrutura: 'infrastructure',
  social: 'social',
  ambiente: 'environment',
  gestao: 'politics',
  politica: 'politics',
};

// ============================================================
// MACROS → TEMA
// ============================================================
// Os 10 macros do catalog.ts não estão em indicators.ts.
// Precisamos mapear manualmente.

const MACRO_TO_THEME: Record<string, NewsTheme> = {
  unemployment: 'economy',
  growth: 'economy',
  inflation: 'economy',
  debt: 'economy',
  dollar: 'economy',
  selicRate: 'economy',
  criminality: 'security',
  scandalExposure: 'politics',
  militaryLoyalty: 'politics',
  crisisClimate: 'politics',
};

// ============================================================
// API
// ============================================================

/**
 * Descobre o tema de notícia de um indicador.
 * Aceita tanto ids de indicadores detalhados (homicidios, inflacao)
 * quanto ids de macros (unemployment, inflation).
 * Retorna 'politics' como fallback se o id for desconhecido.
 */
export function themeOf(indicatorId: string): NewsTheme {
  // Tenta macro primeiro (são poucos)
  const macro = MACRO_TO_THEME[indicatorId];
  if (macro) return macro;

  // Tenta indicador detalhado
  const ind = INDICATORS[indicatorId];
  if (ind) return CATEGORY_TO_THEME[ind.category];

  return 'politics';
}

/**
 * Rótulo em português para exibir na UI.
 */
export const THEME_LABEL: Record<NewsTheme, string> = {
  economy: 'Economia',
  security: 'Segurança',
  health: 'Saúde',
  education: 'Educação',
  politics: 'Política',
  environment: 'Meio ambiente',
  social: 'Social',
  infrastructure: 'Infraestrutura',
};

/**
 * Caminho da pasta de imagens de cada tema.
 * Usado pelo picker (que a gente vai criar no passo 3).
 */
export const THEME_FOLDER: Record<NewsTheme, string> = {
  economy: 'economy',
  security: 'security',
  health: 'health',
  education: 'education',
  politics: 'politics',
  environment: 'environment',
  social: 'social',
  infrastructure: 'infrastructure',
};