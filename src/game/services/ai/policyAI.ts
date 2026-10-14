import { buildContext } from './buildContext';
import {
  buildInitialPayload,
  buildAnalysisPayload,
  type PromptPayload,
} from './promptBuilder';
import { runQueries, type QueryState } from './queryService';
import { processResponse, fallbackAnalysis } from './validation';
import {
  chat,
  OllamaError,
  DEFAULT_MODEL,
  type ChatMessage,
} from './ollamaClient';
import type {
  AIInterpretation,
  ContextInput,
  PolicyContext,
  QueryResult,
} from '../../types/ai';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

/** Temperaturas em ordem decrescente entre tentativas. */
const RETRY_TEMPERATURES = [0.2] as const;

/** Máximo de rodadas de consulta antes de forçar análise. */
const DEFAULT_MAX_QUERY_ROUNDS = 0;
const POLICY_TIMEOUT_MS = 180_000;

// ============================================================
// TIPOS
// ============================================================

export interface PolicyAIOptions {
  model?: string;
  /** Sobrescreve as temperaturas padrão. */
  temperatures?: number[];
  /** Máximo de tentativas (default: 3). */
  maxAttempts?: number;
  /** Máximo de rodadas de consulta (default: 2). */
  maxQueryRounds?: number;
  /** Timeout por chamada ao Ollama (ms). */
  timeoutMs?: number;
  /** Limite de tokens gerados na análise. */
  numPredict?: number;
  /** Aborta tudo (ex.: usuário cancelou). */
  signal?: AbortSignal;
}

export interface PolicyAIMetadata {
  attempts: number;
  queryRounds: number;
  usedFallback: boolean;
  totalDurationMs: number;
  attemptLog: AttemptLogEntry[];
  promptTokens: number;
  responseTokens: number;
}

export interface AttemptLogEntry {
  attempt: number;
  temperature: number;
  outcome:
    | 'ok'
    | 'parse_error'
    | 'query_then_error'
    | 'network_error'
    | 'cancelled';
  error?: string;
  warnings: string[];
  rejected: string[];
  durationMs: number;
}

export interface PolicyAIResult {
  analysis: AIInterpretation;
  metadata: PolicyAIMetadata;
}

// ============================================================
// ENTRADA PÚBLICA
// ============================================================

/**
 * Analisa uma proposta do jogador.
 *
 * Fluxo:
 *   1. buildContext
 *   2. buildInitialPayload → Ollama
 *   3. processResponse
 *   4. Se query: runQueries → buildAnalysisPayload → Ollama (até N rodadas)
 *   5. Retry com temperatura decrescente em caso de falha estrutural
 *   6. Fallback se todas as tentativas falharem
 *
 * Nunca lança. Sempre devolve `PolicyAIResult`.
 */
export async function analyzePolicy(
  input: ContextInput,
  options: PolicyAIOptions = {},
): Promise<PolicyAIResult> {
  const start = Date.now();
  const maxAttempts = options.maxAttempts ?? 1;
  const temperatures = options.temperatures ?? [...RETRY_TEMPERATURES];
  const maxQueryRounds = options.maxQueryRounds ?? DEFAULT_MAX_QUERY_ROUNDS;
  const model = options.model ?? DEFAULT_MODEL;

  const attemptLog: AttemptLogEntry[] = [];
  let totalPromptTokens = 0;
  let totalResponseTokens = 0;
  let totalQueryRounds = 0;

  // Constrói contexto e estado de consulta UMA vez
  const context = buildContext(input);
  const queryState = contextToQueryState(input);
  const currentValues = { ...queryState.nationalIndicators, ...queryState.macros };

  let lastError = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const temperature = temperatures[attempt] ?? 0.1;
    const attemptStart = Date.now();

    // Cancelamento antes de começar a tentativa
    if (options.signal?.aborted) {
      attemptLog.push({
        attempt: attempt + 1,
        temperature,
        outcome: 'cancelled',
        error: 'Cancelado pelo caller.',
        warnings: [],
        rejected: [],
        durationMs: 0,
      });
      break;
    }

    try {
      const result = await runOneAttempt({
        context,
        queryState,
        currentValues,
        model,
        temperature,
        maxQueryRounds,
        timeoutMs: options.timeoutMs ?? POLICY_TIMEOUT_MS,
        numPredict: options.numPredict ?? 2000,
        numCtx: 8192,
        signal: options.signal,
      });

      if (result.kind !== 'success') {
        lastError = result.error;
        totalQueryRounds += result.kind === 'query_then_error' ? result.queryRounds : 0;
        attemptLog.push({
          attempt: attempt + 1,
          temperature,
          outcome: result.kind,
          error: result.error,
          warnings: [],
          rejected: [],
          durationMs: Date.now() - attemptStart,
        });
        continue;
      }

      totalPromptTokens += result.promptTokens;
      totalResponseTokens += result.responseTokens;
      totalQueryRounds += result.queryRounds;

      applyQualityMetrics(result.analysis, input.proposal);

      attemptLog.push({
          attempt: attempt + 1,
          temperature,
          outcome: 'ok',
          warnings: result.warnings,
          rejected: result.rejected,
          durationMs: Date.now() - attemptStart,
        });

      return {
          analysis: result.analysis,
          metadata: {
            attempts: attempt + 1,
            queryRounds: totalQueryRounds,
            usedFallback: false,
            totalDurationMs: Date.now() - start,
            attemptLog,
            promptTokens: totalPromptTokens,
            responseTokens: totalResponseTokens,
          },
      };

    } catch (err) {
      const isOllama = err instanceof OllamaError;
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;

      attemptLog.push({
        attempt: attempt + 1,
        temperature,
        outcome: isOllama ? 'network_error' : 'parse_error',
        error: msg,
        warnings: [],
        rejected: [],
        durationMs: Date.now() - attemptStart,
      });

      if (options.signal?.aborted) break;
    }
  }

  // ---------- Fallback ----------
  const analysis = fallbackAnalysis(
    input.proposal,
    lastError || 'todas as tentativas falharam',
  );

  return {
    analysis,
    metadata: {
      attempts: attemptLog.length,
      queryRounds: totalQueryRounds,
      usedFallback: true,
      totalDurationMs: Date.now() - start,
      attemptLog,
      promptTokens: totalPromptTokens,
      responseTokens: totalResponseTokens,
    },
  };
}

// ============================================================
// UMA TENTATIVA COMPLETA
// ============================================================

interface AttemptInput {
  context: PolicyContext;
  queryState: QueryState;
  currentValues: Record<string, number>;
  model: string;
  temperature: number;
  maxQueryRounds: number;
  timeoutMs?: number;
  numPredict?: number;
  numCtx?: number;
  signal?: AbortSignal;
}

type AttemptOutcome =
  | {
      kind: 'success';
      analysis: AIInterpretation;
      warnings: string[];
      rejected: string[];
      queryRounds: number;
      promptTokens: number;
      responseTokens: number;
    }
  | { kind: 'parse_error'; error: string; queryRounds: number }
  | { kind: 'query_then_error'; error: string; queryRounds: number };

async function runOneAttempt(input: AttemptInput): Promise<AttemptOutcome> {
  const {
    context,
    queryState,
    currentValues,
    model,
    temperature,
    maxQueryRounds,
    timeoutMs,
    numPredict,
    numCtx,
    signal,
  } = input;

  let promptTokens = 0;
  let responseTokens = 0;

  // ---------- Chamada 1: payload inicial ----------
  const initialPayload = buildInitialPayload(context);
  const promptChars = initialPayload.system.length + initialPayload.user.length;
  console.info('[policyAI] Tamanho do prompt', {
    systemChars: initialPayload.system.length,
    userChars: initialPayload.user.length,
    estimatedTokens: Math.round(promptChars / 4),
  });
  const first = await callOllama(initialPayload, {
    model,
    temperature,
    timeoutMs,
    numPredict,
    numCtx,
    signal,
  });
  promptTokens += first.promptTokens ?? 0;
  responseTokens += first.responseTokens ?? 0;

  const firstProc = processResponse(first.content, {
    proposalText: context.proposal,
    currentValues,
  });

  if (firstProc.kind === 'error') {
    return { kind: 'parse_error', error: firstProc.error, queryRounds: 0 };
  }

  // Já é análise? Termina.
  if (firstProc.kind === 'analysis' && firstProc.analysis) {
    return {
      kind: 'success',
      analysis: firstProc.analysis.analysis,
      warnings: firstProc.analysis.warnings,
      rejected: firstProc.analysis.rejected,
      queryRounds: 0,
      promptTokens,
      responseTokens,
    };
  }

  // É consulta — mas consultas estão desabilitadas?
  if (firstProc.kind === 'query' && maxQueryRounds <= 0) {
    return {
      kind: 'query_then_error',
      error: 'IA pediu consultas, mas consultas estão desabilitadas.',
      queryRounds: 0,
    };
  }

  // ---------- Loop de rodadas de consulta ----------
  const accumulatedWarnings: string[] = [];
  const accumulatedRejected: string[] = [];
  let currentQuery = firstProc.query;
  let queryRounds = 0;

  for (let round = 0; round < maxQueryRounds; round++) {
    if (!currentQuery) break;
    queryRounds++;

    const queryOutput = runQueries(currentQuery.queries, queryState);
    const results: QueryResult[] = queryOutput.results;

    // Adiciona warnings das consultas falhas
    for (const r of results) {
      if (!r.ok) accumulatedWarnings.push(`[query ${r.type}] ${r.error}`);
    }

    // ---------- Chamada seguinte: pede análise com base nas consultas ----------
    const payload = buildAnalysisPayload(context, results);
    const next = await callOllama(payload, {
      model,
      temperature,
      timeoutMs,
      numPredict,
      numCtx,
      signal,
    });
    promptTokens += next.promptTokens ?? 0;
    responseTokens += next.responseTokens ?? 0;

    const nextProc = processResponse(next.content, {
      proposalText: context.proposal,
      currentValues,
    });

    if (nextProc.kind === 'error') {
      return { kind: 'query_then_error', error: nextProc.error, queryRounds };
    }

    // Análise final
    if (nextProc.kind === 'analysis' && nextProc.analysis) {
      return {
        kind: 'success',
        analysis: nextProc.analysis.analysis,
        warnings: [...accumulatedWarnings, ...nextProc.analysis.warnings],
        rejected: [...accumulatedRejected, ...nextProc.analysis.rejected],
        queryRounds,
        promptTokens,
        responseTokens,
      };
    }

    // Ainda é consulta: continua se ainda há rodadas
    if (nextProc.kind === 'query' && nextProc.query) {
      if (round < maxQueryRounds - 1) {
        currentQuery = nextProc.query;
        continue;
      }
      return {
        kind: 'query_then_error',
        error: 'IA pediu consultas além do limite sem produzir análise final.',
        queryRounds,
      };
    }
  }

  return {
    kind: 'query_then_error',
    error: 'Fluxo de consulta não convergiu para análise.',
    queryRounds,
  };
}

// ============================================================
// CHAMADA AO OLLAMA
// ============================================================

interface CallOpts {
  model: string;
  temperature: number;
  timeoutMs?: number;
  numPredict?: number;
  numCtx?: number;
  signal?: AbortSignal;
}

async function callOllama(payload: PromptPayload, opts: CallOpts) {
  const messages: ChatMessage[] = [
    { role: 'system', content: payload.system },
    { role: 'user', content: payload.user },
  ];
  return chat(messages, {
    model: opts.model,
    temperature: opts.temperature,
    timeoutMs: opts.timeoutMs,
    numPredict: opts.numPredict,
    numCtx: opts.numCtx,
    signal: opts.signal,
  });
}

// ============================================================
// DERIVAÇÃO DE QUERY STATE
// ============================================================

function contextToQueryState(input: ContextInput): QueryState {
  return {
    month: input.month,
    stateIndicators: input.stateIndicators,
    nationalIndicators: input.nationalIndicators,
    macros: input.macros,
    groupApprovals: input.groupApprovals,
    stateApprovals: input.stateApprovals,
    activePolicies: input.activePolicies,
    history: input.history,
  };
}

// ============================================================
// MÉTRICAS DE QUALIDADE
// ============================================================

function applyQualityMetrics(
  analysis: AIInterpretation,
  proposal: string,
): void {
  const len = proposal.length;
  let quality = 0.4;
  if (len > 80) quality += 0.1;
  if (len > 200) quality += 0.1;
  if (len > 400) quality += 0.05;
  if (analysis.beneficios?.length) quality += 0.1;
  if (analysis.riscos?.length) quality += 0.1;
  if (analysis.objetivo) quality += 0.05;
  if (analysis.areas_secundarias?.length) quality += 0.05;
  if (analysis.efeitos_colaterais?.length) quality += 0.05;

  quality = Math.max(0, Math.min(1, quality));
  analysis._quality = quality;
  analysis._elaboration_bonus = quality >= 0.75;
  analysis._fallback = false;
}

// ============================================================
// HELPERS
// ============================================================

/** Cria um token de cancelamento para abortar a análise. */
export function createCancellationToken(): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}
