// src/game/services/ai/playerPostAI.ts

import { chat, OllamaError, DEFAULT_MODEL } from './ollamaClient';
import { buildPlayerPostContext, type PlayerPostContextInput } from './playerPostContext';
import { buildPlayerPostPrompt } from './playerPostPrompts';
import { extractJson } from './validation';
import type {
  PlayerPostAnalysis,
  PostTone,
  PlayerPostAIResult,
  PlayerPostAIOptions,
} from '../../types/ai';

// ============================================================
// CONFIG
// ============================================================

const RETRY_TEMPERATURES = [0.6, 0.35, 0.15] as const;
const MAX_RESPONSES = 6;
const MIN_TEXT_LEN = 40;
const MAX_TEXT_LEN = 280;

const VALID_TONES = new Set<PostTone>(['apoio', 'critica', 'neutro', 'agressivo']);

// ============================================================
// API
// ============================================================

export async function analyzePlayerPosts(
  input: PlayerPostContextInput,
  options: PlayerPostAIOptions = {},
): Promise<PlayerPostAIResult> {
  const start = Date.now();
  const maxAttempts = options.maxAttempts ?? RETRY_TEMPERATURES.length;
  const temperatures = options.temperatures ?? [...RETRY_TEMPERATURES];
  const model = options.model ?? DEFAULT_MODEL;

  if (input.playerPosts.length === 0) {
    return {
      analyses: [],
      metadata: {
        attempts: 0,
        usedFallback: false,
        totalDurationMs: 0,
        promptTokens: 0,
        responseTokens: 0,
      },
    };
  }

  const ctx = buildPlayerPostContext(input);
  const payload = buildPlayerPostPrompt(ctx);

  let promptTokens = 0;
  let responseTokens = 0;
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    if (options.signal?.aborted) break;
    attempts++;

    const temperature = temperatures[i] ?? 0.15;

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

      const parsed = parsePlayerPostResponse(res.content, ctx);
      if (parsed && parsed.length > 0) {
        return {
          analyses: parsed,
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
    }
  }

  // ---------- Fallback ----------
  return {
    analyses: fallbackAnalyses(ctx),
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

export function parsePlayerPostResponse(
  raw: string,
  ctx: ReturnType<typeof buildPlayerPostContext>,
): PlayerPostAnalysis[] | null {
  const json = extractJson(raw);
  if (!json || typeof json !== 'object') return null;

  const obj = json as Record<string, unknown>;
  const list = obj.analyses;
  if (!Array.isArray(list)) return null;

  const validPostIds = new Set(ctx.playerPosts.map((p) => p.id));
  const validProfileIds = new Set(ctx.perfis.map((p) => p.id));

  const out: PlayerPostAnalysis[] = [];
  for (const item of list) {
    const a = validateAnalysis(item, validPostIds, validProfileIds);
    if (a) out.push(a);
  }
  return out;
}

function validateAnalysis(
  item: unknown,
  validPostIds: Set<string>,
  validProfileIds: Set<string>,
): PlayerPostAnalysis | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;

  const postId = typeof o.postId === 'string' ? o.postId : null;
  if (!postId || !validPostIds.has(postId)) return null;

  const viralizou = o.viralizou === true;
  const virouNoticia = o.virouNoticia === true;

  const mancheteNoticiaRaw = typeof o.mancheteNoticia === 'string'
    ? o.mancheteNoticia.trim().slice(0, 120)
    : '';
  const mancheteNoticia = virouNoticia && mancheteNoticiaRaw
    ? mancheteNoticiaRaw
    : undefined;

  const reacaoSocial = clampNum(o.reacaoSocial, -5, 5, 0);
  const scandalAdd = clampNum(o.scandalAdd, 0, 5, 0);

  // ---------- Respostas ----------
  const respostasRaw = Array.isArray(o.respostas) ? o.respostas : [];
  const respostas: PlayerPostAnalysis['respostas'] = [];
  const usedPerfis = new Set<string>();

  for (const r of respostasRaw) {
    if (!r || typeof r !== 'object') continue;
    const ro = r as Record<string, unknown>;

    const perfilId = typeof ro.perfilId === 'string' ? ro.perfilId : null;
    if (!perfilId || !validProfileIds.has(perfilId)) continue;
    if (usedPerfis.has(perfilId)) continue;

    const texto = cleanText(ro.texto);
    if (!texto || texto.length < MIN_TEXT_LEN) continue;

    const tom: PostTone = VALID_TONES.has(ro.tom as PostTone)
      ? (ro.tom as PostTone)
      : 'neutro';

    usedPerfis.add(perfilId);
    respostas.push({ perfilId, texto, tom });

    if (respostas.length >= MAX_RESPONSES) break;
  }

  return {
    postId,
    viralizou,
    virouNoticia,
    mancheteNoticia,
    reacaoSocial,
    scandalAdd,
    respostas,
  };
}

function cleanText(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.trim().replace(/\s{2,}/g, ' ').slice(0, MAX_TEXT_LEN);
}

// ============================================================
// FALLBACK
// ============================================================

/**
 * Fallback determinístico: decide viralização e scandal
 * baseado no TOM do post (sem IA).
 */
function fallbackAnalyses(
  ctx: ReturnType<typeof buildPlayerPostContext>,
): PlayerPostAnalysis[] {
  const out: PlayerPostAnalysis[] = [];

  for (const p of ctx.playerPosts) {
    let viralizou = false;
    let virouNoticia = false;
    let reacaoSocial = 0;
    let scandalAdd = 0;

    switch (p.tom) {
      case 'agressivo':
        viralizou = Math.random() < 0.6;
        virouNoticia = Math.random() < 0.7;
        reacaoSocial = -2 - Math.floor(Math.random() * 3);
        scandalAdd = 2 + Math.floor(Math.random() * 3);
        break;
      case 'oficial':
        viralizou = Math.random() < 0.3;
        virouNoticia = Math.random() < 0.15;
        reacaoSocial = 1 + Math.floor(Math.random() * 2);
        scandalAdd = 0;
        break;
      case 'normal':
      default:
        viralizou = Math.random() < 0.1;
        virouNoticia = Math.random() < 0.05;
        reacaoSocial = 0;
        scandalAdd = 0;
        break;
    }

    out.push({
      postId: p.id,
      viralizou,
      virouNoticia,
      mancheteNoticia: virouNoticia
        ? `Presidente gera polêmica nas redes: "${truncate(p.texto, 60)}"`
        : undefined,
      reacaoSocial,
      scandalAdd,
      respostas: [],
    });
  }

  return out;
}

// ============================================================
// HELPERS
// ============================================================

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
