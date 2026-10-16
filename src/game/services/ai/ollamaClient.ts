const OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = 'llama3.1:8b';

export interface OllamaOptions {
  model?: string;
  temperature?: number;
  format?: 'json';
  signal?: AbortSignal;
}

export interface OllamaResponse {
  raw: string;
  parsed?: unknown;
  elapsedMs: number;
}

export async function callOllama(
  prompt: string,
  options: OllamaOptions = {},
): Promise<OllamaResponse> {
  const started = Date.now();

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      prompt,
      stream: false,
      format: options.format,
      options: {
        temperature: options.temperature ?? 0.3,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama falhou (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { response: string };
  const raw = data.response ?? '';

  let parsed: unknown = undefined;
  if (options.format === 'json') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // devolve cru; validação decide o que fazer
    }
  }

  return { raw, parsed, elapsedMs: Date.now() - started };
}