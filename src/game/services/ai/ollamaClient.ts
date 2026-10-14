// ============================================================
// CLIENTE HTTP DO OLLAMA
// ============================================================
// Wrapper minimalista em cima do /api/chat do Ollama.
// Não faz retry, não faz parsing — só transporta mensagens e devolve texto.

const ENV_BASE_URL =
  typeof import.meta !== 'undefined' &&
  (import.meta as any).env?.VITE_OLLAMA_URL;

const ENV_MODEL =
  typeof import.meta !== 'undefined' &&
  (import.meta as any).env?.VITE_OLLAMA_MODEL;

export const DEFAULT_BASE_URL = ENV_BASE_URL ?? 'http://localhost:11434';
export const DEFAULT_MODEL = ENV_MODEL ?? 'qwen3.5:4b';
// Modelos locais podem levar mais de 30 segundos para analisar o contexto do jogo.
export const DEFAULT_TIMEOUT_MS = 90_000;

export async function checkOllama(): Promise<void> {
  const baseUrl = DEFAULT_BASE_URL.replace(/\/+$/, '');
  let response: Response; 
  try {
    response = await fetch(`${baseUrl}/api/tags`);
  } catch (error) {
    throw new OllamaError(`Não foi possível acessar ${baseUrl}. Confirme que o Ollama está ativo e permite acesso do navegador (CORS).`, error);
  }
  if (!response.ok) throw new OllamaError(`Ollama respondeu ${response.status} ao consultar os modelos.`);
  const data = await response.json().catch(() => null) as { models?: { name?: string }[] } | null;
  const models = data?.models ?? [];
  if (!models.some((model) => model.name === DEFAULT_MODEL || model.name?.startsWith(`${DEFAULT_MODEL}:`))) {
    throw new OllamaError(`O modelo ${DEFAULT_MODEL} não está instalado no Ollama.`);
  }
}

// ============================================================
// TIPOS
// ============================================================

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
  promptTokens?: number;
  responseTokens?: number;
  durationMs: number;
}

export class OllamaError extends Error {
  readonly cause?: unknown;
  readonly statusCode?: number;

  constructor(message: string, cause?: unknown, statusCode?: number) {
    super(message);
    this.name = 'OllamaError';
    this.cause = cause;
    this.statusCode = statusCode;
  }
}

// ============================================================
// CHAMADA PRINCIPAL
// ============================================================

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();
  const requestUrl = `${baseUrl.replace(/\/+$/, '')}/api/chat`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const abortFromCaller = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      throw new OllamaError('Requisição cancelada antes de começar.');
    }
    options.signal.addEventListener('abort', abortFromCaller, { once: true });
  }

  const body = {
    model,
    messages,
    stream: false,
    // Modelos com canal de raciocínio podem gastar o limite inteiro sem preencher content.
    think: false,
    format: 'json',
    options: {
      temperature: options.temperature ?? 0.7,
      num_ctx: options.numCtx ?? 8192,
      num_predict: options.numPredict ?? 512,
      repeat_penalty: 1.05,
      ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
    if ((err as any)?.name === 'AbortError') {
      throw new OllamaError(`Ollama não respondeu em ${timeoutMs}ms.`, err);
    }
    throw new OllamaError(
      `Não foi possível conectar em ${baseUrl}. Verifique o endereço, se o Ollama está rodando e se o navegador tem permissão de acesso (CORS).`,
      err,
    );
  }

  if (!res.ok) {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
    const text = await res.text().catch(() => '');
    throw new OllamaError(
      `Ollama respondeu ${res.status}: ${text.slice(0, 200)}`,
      undefined,
      res.status,
    );
  }

  const json = await res.json().catch((err) => {
    throw new OllamaError('Resposta do Ollama não é JSON válido.', err);
  }).finally(() => {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  });

  const content = typeof json?.message?.content === 'string'
    ? json.message.content.trim()
    : typeof json?.response === 'string'
      ? json.response.trim()
      : '';
  if (!content) {
    const reason = typeof json?.done_reason === 'string' ? ` Motivo informado: ${json.done_reason}.` : '';
    const generated = Number(json?.eval_count);
    const tokenInfo = Number.isFinite(generated) ? ` Tokens gerados: ${generated}.` : '';
    const thinkingInfo = typeof json?.message?.thinking === 'string' && json.message.thinking.length > 0
      ? ' O modelo retornou raciocínio, mas não uma resposta final.'
      : '';
    throw new OllamaError(
      `Ollama respondeu sem texto final.${reason}${tokenInfo}${thinkingInfo} Confirme se o modelo é compatível com /api/chat e JSON.`,
    );
  }

  return {
    content,
    promptTokens: json.prompt_eval_count,
    responseTokens: json.eval_count,
    durationMs: Date.now() - start,
  };
}

/**
 * Verifica se o servidor do Ollama está acessível.
 * Útil para checar antes de iniciar a partida.
 */
export async function ping(baseUrl = DEFAULT_BASE_URL): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
