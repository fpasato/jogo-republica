// src/game/services/ai/socialAI.ts

import { chat, OllamaError, DEFAULT_MODEL } from './ollamaClient';
import { buildSocialContext, type SocialContextInput } from './socialContext';
import { buildSocialPrompt } from './socialPrompts';
import { extractJson } from './validation';
import { computeStatsForProfile } from '../social/postStats';
import type {
  Post,
  PostTone,
  SocialAIOptions,
  SocialAIResult,
} from '../../types/ai';

// ============================================================
// CONFIG
// ============================================================

const RETRY_TEMPERATURES = [0.85, 0.55, 0.3] as const;
const DEFAULT_COUNT = 22;
const MIN_COUNT = 8;
const MAX_COUNT = 35;

const VALID_TONES = new Set<PostTone>(['apoio', 'critica', 'neutro', 'agressivo']);

const MIN_CHARS = 60;
const MAX_CHARS = 280;   // tolerância um pouco maior que o alvo ideal de 200

// ============================================================
// API
// ============================================================

export async function generateSocialFeed(
  input: SocialContextInput,
  options: SocialAIOptions = {},
): Promise<SocialAIResult> {
  const start = Date.now();
  const maxAttempts = options.maxAttempts ?? RETRY_TEMPERATURES.length;
  const temperatures = options.temperatures ?? [...RETRY_TEMPERATURES];
  const model = options.model ?? DEFAULT_MODEL;
  const count = clamp(options.count ?? DEFAULT_COUNT, MIN_COUNT, MAX_COUNT);

  const ctx = buildSocialContext({ ...input, targetCount: count });
  const payload = buildSocialPrompt(ctx);

  let promptTokens = 0;
  let responseTokens = 0;
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    if (options.signal?.aborted) break;
    attempts++;

    const temperature = temperatures[i] ?? 0.3;

    try {
      const res = await chat(
        [
          { role: 'system', content: payload.system },
          { role: 'user', content: payload.user },
        ],
        { model, temperature, timeoutMs: options.timeoutMs, signal: options.signal },
      );
      promptTokens += res.promptTokens ?? 0;
      responseTokens += res.responseTokens ?? 0;

      const parsed = parseSocialResponse(res.content, ctx);
      if (parsed && parsed.length >= MIN_COUNT / 2) {
        return {
          posts: parsed.slice(0, count),
          metadata: {
            attempts,
            usedFallback: false,
            totalDurationMs: Date.now() - start,
            promptTokens,
            responseTokens,
          },
        };
      }
    } catch (err) {
      if (err instanceof OllamaError && options.signal?.aborted) break;
      // tenta próxima
    }
  }

  return {
    posts: fallbackPosts(ctx, count),
    metadata: {
      attempts,
      usedFallback: true,
      totalDurationMs: Date.now() - start,
      promptTokens,
      responseTokens,
    },
  };
}

// ============================================================
// PARSE
// ============================================================

export function parseSocialResponse(
  raw: string,
  ctx: ReturnType<typeof buildSocialContext>,
): Post[] | null {
  const json = extractJson(raw);
  if (!json || typeof json !== 'object') return null;

  const obj = json as Record<string, unknown>;
  const list = obj.posts;
  if (!Array.isArray(list)) return null;

  const out: Post[] = [];
  const seenKey = new Set<string>();
  const validIds = new Set(ctx.perfis.map((p) => p.id));

  for (const item of list) {
    const post = validatePost(item, ctx, validIds, seenKey);
    if (post) out.push(post);
  }

  return out;
}

function validatePost(
  item: unknown,
  ctx: ReturnType<typeof buildSocialContext>,
  validIds: Set<string>,
  seenKey: Set<string>,
): Post | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;

  const perfilId = typeof o.perfilId === 'string' ? o.perfilId : null;
  if (!perfilId || !validIds.has(perfilId)) return null;

  const texto = cleanText(o.texto, MAX_CHARS);
  if (!texto || texto.length < MIN_CHARS) return null;

  const tom: PostTone = VALID_TONES.has(o.tom as PostTone)
    ? (o.tom as PostTone)
    : 'neutro';

  const dia = clampInt(o.dia, 1, 28, randomDay());
  const hora = clampInt(o.hora, 8, 23, randomHour());
  const minuto = clampInt(o.minuto, 0, 59, Math.floor(Math.random() * 60));

  // Evita duplicatas do mesmo perfil no mesmo dia
  const key = `${perfilId}_${dia}`;
  if (seenKey.has(key)) return null;
  seenKey.add(key);

  const respostaA = typeof o.respostaA === 'string' ? o.respostaA : undefined;
  const noticiaVinculada = typeof o.noticiaVinculada === 'string'
    ? o.noticiaVinculada
    : undefined;

  const stats = computeStatsForProfile(perfilId, {
    isReply: !!respostaA,
  }) ?? { views: 0, likes: 0, reposts: 0 };

  const id = `post_${ctx.year}_${ctx.month}_${perfilId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    mes: ctx.month,
    dia,
    hora,
    minuto,
    autorId: perfilId,
    texto,
    tom,
    respostaA,
    noticiaVinculada,
    stats,
    geradoPor: 'ia',
  };
}

function cleanText(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().replace(/\s{2,}/g, ' ').slice(0, maxLen);
}

// ============================================================
// FALLBACK
// ============================================================

const FALLBACK_TEMPLATES: Record<string, string[]> = {
  imprensa: ['Leia a análise completa no link.', 'Entenda o que está em jogo.'],
  aliado: ['O governo segue trabalhando pelo Brasil.', 'Avançamos, apesar da oposição.'],
  opositor: ['Mais uma promessa não cumprida.', 'O país merece coisa melhor.'],
  lider_social: ['A luta continua, e não vamos recuar.', 'Nossos direitos não se negociam.'],
  influenciador: ['Isso ninguém tá falando, mas devia.', 'Thread importante sobre o que rolou.'],
  hater: ['kkkkk esse governo é uma piada', 'Acorda Brasil, tá tudo uma vergonha!'],
  bot: ['URGENTE: nova atualização sobre o cenário político.', 'Última hora: veja o que mudou.'],
};

function fallbackPosts(
  ctx: ReturnType<typeof buildSocialContext>,
  count: number,
): Post[] {
  const out: Post[] = [];
  const used = new Set<string>();

  const perfis = ctx.perfis.slice(0, Math.min(8, ctx.perfis.length));

  let i = 0;
  while (out.length < count && i < count * 3) {
    i++;
    const perfil = perfis[Math.floor(Math.random() * perfis.length)];
    const dia = randomDay();
    const key = `${perfil.id}_${dia}`;
    if (used.has(key)) continue;
    used.add(key);

    const templates = FALLBACK_TEMPLATES[perfil.kind] ?? ['...'];
    const texto = templates[Math.floor(Math.random() * templates.length)];
    if (texto.length < MIN_CHARS) continue;

    const stats = computeStatsForProfile(perfil.id) ?? { views: 0, likes: 0, reposts: 0 };

    out.push({
      id: `post_fb_${ctx.year}_${ctx.month}_${i}_${Date.now().toString(36)}`,
      mes: ctx.month,
      dia,
      hora: randomHour(),
      minuto: Math.floor(Math.random() * 60),
      autorId: perfil.id,
      texto,
      tom: 'neutro',
      stats,
      geradoPor: 'template',
    });
  }

  return out;
}

// ============================================================
// HELPERS
// ============================================================

function randomDay(): number {
  return 1 + Math.floor(Math.random() * 28);
}

function randomHour(): number {
  // Peso maior em 9h-11h e 18h-22h
  const r = Math.random();
  if (r < 0.3) return 9 + Math.floor(Math.random() * 3);   // 9-11
  if (r < 0.7) return 18 + Math.floor(Math.random() * 5);  // 18-22
  return 8 + Math.floor(Math.random() * 16);               // 8-23
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? Math.round(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
