// src/game/services/ai/groqClient.ts

const DEFAULT_BASE_URL = '/api/groq';

/** Modelo primário. Deve casar com o DEFAULT_MODEL de policyAI.ts. */
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

/** Fallback se o primário for rejeitado como descontinuado. */
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Modelos que a API da Groq rejeita com 400 "decommissioned".
 * Falhamos antes do fetch para não gastar uma chamada.
 *
 * Fontes: https://console.groq.com/docs/deprecations
 */
const KNOWN_DECOMMISSIONED = new Set<string>([
  'gemma2-9b-it',
  'gemma-7b-it',
  'mixtral-8x7b-32768',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'llama-3.1-70b-versatile',
  'llama-3.1-405b-reasoning',
]);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  top_p?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  baseUrl?: string;
  numPredict?: number;
  numCtx?: number;
}

export interface ChatResult {
  content: string;
  /** Modelo efetivamente usado (útil quando houve fallback). */
  model: string;
  promptTokens?: number;
  responseTokens?: number;
  durationMs: number;
}

export class GroqError extends Error {
  readonly cause?: unknown;
  readonly statusCode?: number;

  constructor(message: string, cause?: unknown, statusCode?: number) {
    super(message);
    this.name = 'GroqError';
    this.cause = cause;
    this.statusCode = statusCode;
  }
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  const requestedModel = options.model ?? DEFAULT_MODEL;
  const primaryModel = KNOWN_DECOMMISSIONED.has(requestedModel)
    ? FALLBACK_MODEL
    : requestedModel;

  if (primaryModel !== requestedModel) {
    // eslint-disable-next-line no-console
    console.warn(
      `[groqClient] Modelo "${requestedModel}" está descontinuado; usando "${primaryModel}".`,
    );
  }

  try {
    return await callOnce({ baseUrl, model: primaryModel, messages, options, timeoutMs, start });
  } catch (error) {
    const shouldRetry =
      error instanceof GroqError &&
      error.statusCode === 400 &&
      /decommissioned|no longer supported/i.test(error.message) &&
      primaryModel !== FALLBACK_MODEL &&
      !options.signal?.aborted;

    if (!shouldRetry) throw error;

    // eslint-disable-next-line no-console
    console.warn(
      `[groqClient] "${primaryModel}" rejeitado como descontinuado. Tentando "${FALLBACK_MODEL}"...`,
    );
    return callOnce({ baseUrl, model: FALLBACK_MODEL, messages, options, timeoutMs, start });
  }
}

interface CallOnceArgs {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  options: ChatOptions;
  timeoutMs: number;
  start: number;
}

async function callOnce({
  baseUrl,
  model,
  messages,
  options,
  timeoutMs,
  start,
}: CallOnceArgs): Promise<ChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();

  if (options.signal?.aborted) {
    clearTimeout(timer);
    throw new GroqError('Requisição cancelada antes de começar.');
  }

  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    // eslint-disable-next-line no-console
    console.debug(`[groqClient] POST ${baseUrl}/chat model="${model}"`);

    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p,
        // API atual da Groq: max_completion_tokens (max_tokens é legado).
        max_completion_tokens: options.numPredict ?? 512,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new GroqError(
        `Servidor Groq respondeu ${response.status}: ${details.slice(0, 300)}`,
        undefined,
        response.status,
      );
    }

    const data = await response.json();

    // Aceita dois formatos:
    //   1. Proxy custom:    { content, promptTokens, responseTokens }
    //   2. OpenAI-compat:   { choices[0].message.content, usage.{prompt_tokens, completion_tokens} }
    const content =
      (typeof data?.content === 'string' && data.content.trim()) ||
      (typeof data?.choices?.[0]?.message?.content === 'string' &&
        data.choices[0].message.content.trim()) ||
      '';

    if (!content) {
      throw new GroqError('A Groq retornou uma resposta vazia.');
    }

    return {
      content,
      model,
      promptTokens: data.promptTokens ?? data?.usage?.prompt_tokens,
      responseTokens: data.responseTokens ?? data?.usage?.completion_tokens,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    if (error instanceof GroqError) throw error;

    if ((error as Error)?.name === 'AbortError') {
      throw new GroqError(`Requisição cancelada ou excedeu ${timeoutMs}ms.`, error);
    }

    throw new GroqError('Não foi possível conectar ao servidor da Groq.', error);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function ping(): Promise<boolean> {
  try {
    const response = await fetch(`${DEFAULT_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
