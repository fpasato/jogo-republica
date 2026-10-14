// src/game/services/social/avatarPicker.ts

// ============================================================
// AVATARES DOS PERFIS
// ============================================================
// Indexa por nome de arquivo em build-time.
// assets/social/avatars/correio_nacional.png → perfil 'correio_nacional'

const allAvatars = import.meta.glob(
  '../../assets/social/avatars/*.{jpg,jpeg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

// ============================================================
// INDEXAÇÃO POR ID DE PERFIL
// ============================================================

function buildIndex(): Record<string, string> {
  const index: Record<string, string> = {};
  for (const [path, url] of Object.entries(allAvatars)) {
    const match = path.match(/\/([^/]+)\.(jpg|jpeg|png|webp)$/i);
    if (!match) continue;
    const id = match[1];
    index[id] = url;
  }
  return index;
}

const AVATAR_INDEX = buildIndex();
const PLACEHOLDER = AVATAR_INDEX['_placeholder'] ?? '';

// ============================================================
// API
// ============================================================

/**
 * Devolve o caminho do avatar de um perfil.
 * Se não existir, cai no placeholder. Se nem placeholder tiver, string vazia.
 */
export function avatarOf(profileId: string): string {
  return AVATAR_INDEX[profileId] ?? PLACEHOLDER;
}

export function placeholderAvatar(): string {
  return PLACEHOLDER;
}

/**
 * Diagnóstico. Roda no console pra ver quais avatares existem.
 */
export function debugAvatarIndex(): Record<string, string> {
  return { ...AVATAR_INDEX };
}