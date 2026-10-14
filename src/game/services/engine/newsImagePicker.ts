// src/game/services/engine/newsImagePicker.ts

import type { NewsTheme } from '../../data/newsThemes';

// ============================================================
// IMPORTS DE IMAGEM EM BUILD-TIME
// ============================================================
// O Vite varre todas as imagens dessas pastas em build-time.
// Cada chave é o caminho do arquivo; cada valor é a URL final.

// src/game/assets/news
const allImages = import.meta.glob(
  '../../assets/news/**/*.{jpg,jpeg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

// ============================================================
// INDEXAÇÃO POR TEMA
// ============================================================
// Ex: 'economy' → ['/assets/economy-01.jpg', '/assets/economy-02.jpg', ...]

const PLACEHOLDER_KEY = '_placeholder';

function buildIndex(): Record<NewsTheme | '_placeholder', string[]> {
  const index: Record<string, string[]> = {};

  for (const [path, url] of Object.entries(allImages)) {
    // Extrai a pasta do tema ou reconhece o placeholder, que fica na raiz.
    // Ex.: '../../assets/news/economy/1.jpg' → 'economy'
    // Ex.: '../../assets/news/_placeholder.png' → '_placeholder'
    const match = path.match(/\/news\/([^/]+)(?:\/|$)/);
    if (!match) continue;

    const folder = match[1].startsWith('_placeholder.')
      ? PLACEHOLDER_KEY
      : match[1];
    (index[folder] ??= []).push(url);
  }

  return index as Record<NewsTheme | '_placeholder', string[]>;
}

const IMAGE_INDEX = buildIndex();

// ============================================================
// API
// ============================================================

/**
 * Sorteia uma imagem pra um tema.
 * - Se o tema tiver imagens, sorteia uma delas.
 * - Se não tiver (ou o tema for inválido), devolve o placeholder.
 * - Se nem placeholder existir, devolve uma string vazia.
 */
export function pickImage(theme: NewsTheme): string {
  const pool = IMAGE_INDEX[theme];

  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return placeholder();
}

/**
 * Devolve o placeholder. Se ele também não existir, string vazia.
 */
export function placeholder(): string {
  const pool = IMAGE_INDEX[PLACEHOLDER_KEY];
  if (pool && pool.length > 0) return pool[0];
  return '';
}

/**
 * Diagnóstico — útil pra saber quais pastas têm imagens.
 * Roda no console do browser pra você conferir.
 */
export function debugImageIndex(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, arr] of Object.entries(IMAGE_INDEX)) {
    out[key] = arr.length;
  }
  return out;
}
