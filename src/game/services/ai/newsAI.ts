// src/game/services/ai/newsAI.ts

import { chat, OllamaError, DEFAULT_MODEL } from './ollamaClient';
import { buildNewsContext, type NewsContextInput } from './newsContext';
import { buildNewsPrompt } from './newsPrompts';
import { extractJson } from './validation';
import { VEHICLE_BY_ID } from '../../data/newsVehicles';
import { MACRO_BY_ID } from '../../data/macroIndicators';
import { getIndicator } from '../../data/indicators';
import type {
  Noticia,
  NewsTone,
  NewsImportance,
  NewsHighlight,
  NewsTrigger,
} from '../../types/ai';
import type { NewsContext } from './newsContext';

// ============================================================
// CONFIG
// ============================================================

const RETRY_TEMPERATURES = [0.8, 0.4] as const;
const DEFAULT_COUNT = 2;
const MIN_COUNT = 2;
const MAX_COUNT = 2;

const DEFAULT_TIMEOUT_MS = 120_000;   // 2 minutos por tentativa

const VALID_TONES = new Set<NewsTone>(['positivo', 'neutro', 'negativo']);
const VALID_IMPORTANCE = new Set<NewsImportance>([1, 2, 3]);

// ============================================================
// RESULTADO
// ============================================================

export interface NewsAIOptions {
  model?: string;
  temperatures?: number[];
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  count?: number;
}

export interface NewsAIMetadata {
  attempts: number;
  usedFallback: boolean;
  totalDurationMs: number;
  promptTokens: number;
  responseTokens: number;
  lastError?: string;
}

export interface NewsAIResult {
  noticias: Noticia[];
  metadata: NewsAIMetadata;
}

// ============================================================
// API
// ============================================================

export async function generateNews(
  input: NewsContextInput,
  options: NewsAIOptions = {},
): Promise<NewsAIResult> {
  const start = Date.now();
  const maxAttempts = options.maxAttempts ?? RETRY_TEMPERATURES.length;
  const temperatures = options.temperatures ?? [...RETRY_TEMPERATURES];
  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const ctx = buildNewsContext(input);
  const count = clamp(options.count ?? DEFAULT_COUNT, MIN_COUNT, MAX_COUNT);

  const payload = buildNewsPrompt(ctx, count);

  console.log('[newsAI] Iniciando análise');
  console.log('[newsAI] System prompt:', payload.system.length, 'chars');
  console.log('[newsAI] User prompt:', payload.user.length, 'chars');
  console.log('[newsAI] Gatilhos:', ctx.gatilhos.length);

  let promptTokens = 0;
  let responseTokens = 0;
  let attempts = 0;
  let lastError: unknown = null;

  for (let i = 0; i < maxAttempts; i++) {
    if (options.signal?.aborted) break;
    attempts++;

    const temperature = temperatures[i] ?? 0.4;

    try {
      console.log(`[newsAI] Tentativa ${i + 1}/${maxAttempts} (temp ${temperature}, timeout ${timeoutMs}ms)`);

      const res = await chat(
        [
          { role: 'system', content: payload.system },
          { role: 'user', content: payload.user },
        ],
        { model, temperature, timeoutMs, signal: options.signal },
      );

      promptTokens += res.promptTokens ?? 0;
      responseTokens += res.responseTokens ?? 0;

      console.log(`[newsAI] Resposta em ${res.durationMs}ms (${res.responseTokens ?? '?'} tokens)`);
      console.log('[newsAI] Primeiros 400 chars:', res.content.slice(0, 400));

      const parsed = parseNewsResponse(res.content, ctx);
      console.log('[newsAI] Parse:', parsed ? `${parsed.length} notícia(s)` : 'FALHOU');

      if (parsed && parsed.length > 0) {
        return {
          noticias: parsed.slice(0, count),
          metadata: {
            attempts,
            usedFallback: false,
            totalDurationMs: Date.now() - start,
            promptTokens,
            responseTokens,
          },
        };
      }

      // Parse falhou — tenta próxima temperatura
      lastError = new Error('Resposta veio, mas o JSON não foi parseado.');
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[newsAI] Tentativa ${i + 1} falhou:`, msg);

      if (err instanceof OllamaError && options.signal?.aborted) break;
    }
  }

  const lastErrorMsg = lastError instanceof Error
    ? lastError.message
    : lastError ? String(lastError) : 'sem erro registrado';

  console.warn('[newsAI] FALLBACK acionado. Último erro:', lastErrorMsg);

  return {
    noticias: fallbackNews(ctx, count),
    metadata: {
      attempts,
      usedFallback: true,
      totalDurationMs: Date.now() - start,
      promptTokens,
      responseTokens,
      lastError: lastErrorMsg,
    },
  };
}

// ============================================================
// PARSE
// ============================================================

export function parseNewsResponse(
  raw: string,
  ctx: NewsContext,
): Noticia[] | null {
  const json = extractJson(raw);
  if (!json || typeof json !== 'object') return null;

  const obj = json as Record<string, unknown>;
  const list = obj.noticias;
  if (!Array.isArray(list)) return null;

  const out: Noticia[] = [];
  for (let i = 0; i < list.length; i++) {
    const gatilho = ctx.gatilhos[i] ?? ctx.gatilhos[0];
    const n = validateNewsItem(list[i], ctx, gatilho, i);
    if (n) out.push(n);
  }
  return out;
}

function validateNewsItem(
  item: unknown,
  ctx: NewsContext,
  gatilho: NewsContext['gatilhos'][number],
  index: number,
): Noticia | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;

  const manchete = cleanString(o.manchete, 120);
  if (!manchete) return null;

  const corpo = cleanString(o.corpo, 1500);
  if (!corpo) return null;

  const tom: NewsTone = VALID_TONES.has(o.tom as NewsTone)
    ? (o.tom as NewsTone)
    : 'neutro';

  const importancia: NewsImportance = VALID_IMPORTANCE.has(o.importancia as NewsImportance)
    ? (o.importancia as NewsImportance)
    : 2;

  const veiculoRaw = typeof o.veiculo === 'string' ? o.veiculo : 'correio_nacional';
  const veiculo = VEHICLE_BY_ID[veiculoRaw] ? veiculoRaw : 'correio_nacional';

  const submanchete = cleanString(o.submanchete, 180);
  const destaques = parseHighlights(o.destaques);

  const id = `news_${ctx.year}_${ctx.month}_${index}_${Date.now().toString(36)}`;

  return {
    id,
    mes: ctx.month,
    manchete,
    submanchete: submanchete || undefined,
    corpo,
    veiculo,
    tema: gatilho.tema,
    tom,
    importancia,
    imagem: gatilho.imagem,
    destaques,
    gatilho: stripImagem(gatilho),
  };
}

function stripImagem(g: NewsContext['gatilhos'][number]): NewsTrigger {
  return {
    kind: g.kind,
    tema: g.tema,
    detalhe: g.detalhe,
    impacto: g.impacto,
    refId: g.refId,
  };
}

function parseHighlights(raw: unknown): NewsHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: NewsHighlight[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const o = h as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : null;
    if (!id) continue;
    const label = resolveLabel(id, o.label);
    const value = typeof o.value === 'number' ? o.value : 0;
    const delta = typeof o.delta === 'number' ? o.delta : undefined;
    out.push({ id, label, value, delta });
  }
  return out.slice(0, 4);
}

function resolveLabel(id: string, fallback: unknown): string {
  const macro = MACRO_BY_ID[id];
  if (macro) return macro.nome;
  try {
    return getIndicator(id).name;
  } catch {
    return typeof fallback === 'string' ? fallback : id;
  }
}

function cleanString(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, maxLen);
}

// ============================================================
// FALLBACK
// ============================================================

function fallbackNews(ctx: NewsContext, count: number): Noticia[] {
  const out: Noticia[] = [];

  const veiculoDeTom = (tom: string) => {
    if (tom === 'negativo') return 'gazeta_brasil';
    if (tom === 'positivo') return 'diario_cidadao';
    return 'correio_nacional';
  };

  for (let i = 0; i < Math.min(count, ctx.gatilhos.length); i++) {
    const g = ctx.gatilhos[i];
    const tom = g.kind === 'crisis' || g.kind === 'reaction' ? 'negativo' : 'neutro';

    out.push({
      id: `news_fb_${ctx.year}_${ctx.month}_${i}_${Date.now().toString(36)}`,
      mes: ctx.month,
      manchete: makeManchete(g),
      submanchete: makeSubmanchete(g),
      corpo: makeCorpo(g),
      veiculo: veiculoDeTom(tom),
      tema: g.tema,
      tom,
      importancia: g.impacto >= 8 ? 3 : g.impacto >= 5 ? 2 : 1,
      imagem: g.imagem,
      destaques: [],
      gatilho: stripImagem(g),
    });
  }
  return out;
}

function makeManchete(g: NewsContext['gatilhos'][number]): string {
  const d = g.detalhe;
  switch (g.kind) {
    case 'reaction':
      return truncate(`${d.split(':')[0]} entra em mobilização nacional`, 90);
    case 'crisis':
      return truncate(`Crise se aprofunda: ${d.split('.')[0]}`, 90);
    case 'trend':
      return truncate(d.split('.')[0], 90);
    case 'shock3':
      return truncate(`Governo assina medida de grande impacto`, 90);
    default:
      return truncate(d, 90);
  }
}

function makeSubmanchete(g: NewsContext['gatilhos'][number]): string {
  switch (g.kind) {
    case 'reaction': return 'Movimento ganha força e preocupa o Planalto';
    case 'crisis': return 'Especialistas apontam deterioração do cenário';
    case 'trend': return 'Sequência preocupa autoridades e mercado';
    case 'shock3': return 'Medida deve alterar estrutura do setor';
    default: return 'Entenda o que está em jogo';
  }
}

function makeCorpo(g: NewsContext['gatilhos'][number]): string {
  const p1 = g.detalhe;
  const p2 = pickSegundoParagrafo(g);
  const p3 = pickTerceiroParagrafo(g);
  return [p1, p2, p3].filter(Boolean).join('\n\n');
}

function pickSegundoParagrafo(g: NewsContext['gatilhos'][number]): string {
  const pool: Record<string, string[]> = {
    reaction: [
      'A mobilização deve pressionar o Congresso nas próximas semanas. Lideranças do movimento prometem ampliar as ações se não houver resposta do governo.',
      'Entidades ligadas ao grupo já se manifestaram publicamente. O Planalto monitora a situação com atenção.',
    ],
    crisis: [
      'O cenário exige resposta rápida do governo. Aliados reconhecem que a situação pode se agravar se não houver gesto concreto.',
      'A oposição já se movimenta para explorar o momento politicamente. O governo tenta conter os danos.',
    ],
    trend: [
      'Os números apontam uma tendência que se consolida mês a mês. Especialistas divergem sobre as causas e as soluções.',
      'A série histórica preocupa analistas, que veem sinais de que a situação pode piorar antes de estabilizar.',
    ],
    shock3: [
      'A medida deve alterar o funcionamento do setor nos próximos meses. O impacto será sentido em toda a cadeia.',
      'O governo defende a decisão como necessária. Críticos apontam riscos e pedem cautela.',
    ],
    random: [
      'O episódio repercutiu nas redes sociais e entre autoridades. Acompanhe os desdobramentos.',
      'Autoridades se pronunciaram ao longo do dia. Novas informações devem surgir nas próximas horas.',
    ],
  };
  const opts = pool[g.kind] ?? pool.random;
  return opts[Math.floor(Math.random() * opts.length)];
}

function pickTerceiroParagrafo(g: NewsContext['gatilhos'][number]): string {
  if (g.kind === 'crisis' && g.impacto >= 8) {
    return 'A situação é considerada crítica por analistas ouvidos pela reportagem. O governo ainda avalia os próximos passos.';
  }
  if (g.kind === 'reaction' && g.impacto >= 8) {
    return 'O clima é de tensão em Brasília. Reuniões emergenciais foram convocadas ao longo do dia.';
  }
  return '';
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}