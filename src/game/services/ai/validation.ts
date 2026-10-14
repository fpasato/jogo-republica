import { INSTRUMENTS, type InstrumentId } from '../../data/catalog';
import { INDICATORS } from '../../data/indicators';
import { GROUP_BY_ID } from '../../data/groups';
import { STATE_IDS, type StateId } from '../../data/states';
import { VALID_QUERY_TYPES } from '../../data/queryCatalog';
import type {
  AIInterpretation,
  AIQueryRequest,
  QueryRequest,
  FiscalMagnitude,
} from '../../types/ai';

// ============================================================
// CONSTANTES
// ============================================================

const VALID_INSTRUMENTS = new Set<string>(INSTRUMENTS.map((i) => i.id));

const VALID_LEGAL_RISK = new Set(['baixo', 'medio', 'alto']);
const VALID_FISCAL_TYPE = new Set(['neutro', 'custo', 'economia']);
const VALID_DURATION_TYPE = new Set(['permanent', 'temporary']);
const VALID_AREAS = new Set([
  'economia', 'saude', 'educacao', 'seguranca',
  'infraestrutura', 'social', 'ambiente', 'gestao', 'politica',
]);

/**
 * Indicadores que o motor controla sozinho via `impacto_fiscal`.
 * A IA não deve tentar mexer neles diretamente.
 */
const FISCAL_CONTROLLED = new Set([
  'receitas_publicas',
  'gastos_publicos',
  'saldo_orcamentario',
  'divida_publica',
  'carga_tributaria',
  'orcamento_saude',
  'orcamento_educacao',
  'investimentos_publicos',
  'investimento_infraestrutura',
]);

/** Limites de delta por indicador (por segurança). */
const GROUP_DELTA_CLAMP = 15;
const INDICATOR_DELTA_PCT_CLAMP = 0.40; // nunca mais que 40% do valor atual

// ============================================================
// TIPOS DE SAÍDA
// ============================================================

export type ParseResult =
  | { kind: 'query'; data: AIQueryRequest }
  | { kind: 'analysis'; data: AIInterpretation }
  | { kind: 'error'; error: string; raw: string };

export interface ValidationOptions {
  /** Texto original do jogador — usado pra correções contextuais. */
  proposalText?: string;
  /** Valor atual do indicador, usado pra clampar deltas. */
  currentValues?: Record<string, number>;
}

export interface ValidationResult {
  analysis: AIInterpretation;
  warnings: string[];
  rejected: string[];
}

// ============================================================
// 1. PARSE — extrai JSON da resposta crua
// ============================================================

/**
 * Extrai o primeiro objeto JSON válido da resposta.
 * Lida com:
 *   - ```json ... ```  (bloco markdown)
 *   - ``` ... ```       (sem linguagem)
 *   - texto antes/depois do JSON
 *   - JSON puro
 *   - <json>...</json>  (algumas variantes)
 */
export function extractJson(raw: string): unknown | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();

  // Tentativa 1: direto
  const direct = tryJson(text);
  if (direct !== null) return direct;

  // Tentativa 2: bloco markdown ```json ... ```
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (mdMatch) {
    const inner = tryJson(mdMatch[1].trim());
    if (inner !== null) return inner;
  }

  // Tentativa 3: <json>...</json>
  const tagMatch = text.match(/<json>\s*([\s\S]*?)<\/json>/i);
  if (tagMatch) {
    const inner = tryJson(tagMatch[1].trim());
    if (inner !== null) return inner;
  }

  // Tentativa 4: primeiro { até último }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = text.slice(firstBrace, lastBrace + 1);
    const inner = tryJson(slice);
    if (inner !== null) return inner;
  }

  // Respostas limitadas por num_predict podem terminar no meio do último campo.
  // Recupera propriedades completas e fecha os objetos, deixando defaults para o restante.
  const repaired = repairTruncatedJson(text);
  if (repaired !== null) return repaired;

  return null;
}

function repairTruncatedJson(text: string): unknown | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  const stack: string[] = [];
  const commas: Array<{ index: number; depth: number }> = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.pop() !== char) return null;
      if (stack.length === 0) return null; // An object closed cleanly; this is not a truncation.
    } else if (char === ',') {
      commas.push({ index: i, depth: stack.length });
    }
  }

  for (let i = commas.length - 1; i >= 0; i--) {
    const comma = commas[i];
    const closers = stack.slice(0, comma.depth).reverse().join('');
    const candidate = `${text.slice(start, comma.index)}${closers}`;
    const parsed = tryJson(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function tryJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

// ============================================================
// 2. PARSE PRINCIPAL
// ============================================================

export function parseResponse(raw: string): ParseResult {
  const parsed = extractJson(raw);
  if (parsed === null) {
    const preview = raw.replace(/\s+/g, ' ').trim().slice(0, 180);
    return {
      kind: 'error',
      error: `Resposta não contém JSON válido. Trecho recebido: “${preview || '(vazio)'}”`,
      raw,
    };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'error', error: 'JSON raiz não é um objeto.', raw };
  }

  const obj = parsed as Record<string, unknown>;
  const phase = obj.phase;

  // Aceita formato sem "phase" (compatibilidade): se tem "analysis", trata como analysis
  if (phase === 'query') {
    return parseQueryObject(obj, raw);
  }
  if (phase === 'analysis') {
    return parseAnalysisObject(obj, raw);
  }

  // Sem phase explícito
  if ('analysis' in obj) {
    return parseAnalysisObject({ phase: 'analysis', ...obj }, raw);
  }
  if ('queries' in obj) {
    return parseQueryObject({ phase: 'query', ...obj }, raw);
  }

  return {
    kind: 'error',
    error: 'Campo "phase" ausente ou inválido (esperado "query" ou "analysis").',
    raw,
  };
}

function parseQueryObject(
  obj: Record<string, unknown>,
  raw: string,
): ParseResult {
  const queries = obj.queries;
  if (!Array.isArray(queries)) {
    return { kind: 'error', error: '"queries" deve ser um array.', raw };
  }

  const validQueries: QueryRequest[] = [];
  for (const q of queries) {
    if (!q || typeof q !== 'object') continue;
    const type = (q as any).type;
    if (typeof type !== 'string') continue;
    if (!VALID_QUERY_TYPES.has(type)) continue;
    validQueries.push(q as QueryRequest);
  }

  return {
    kind: 'query',
    data: {
      phase: 'query',
      reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '',
      queries: validQueries,
    },
  };
}

function parseAnalysisObject(
  obj: Record<string, unknown>,
  raw: string,
): ParseResult {
  const analysis = obj.analysis;
  if (!analysis || typeof analysis !== 'object') {
    return { kind: 'error', error: 'Campo "analysis" ausente ou inválido.', raw };
  }
  return { kind: 'analysis', data: analysis as AIInterpretation };
}

// ============================================================
// 3. VALIDAÇÃO DA ANÁLISE
// ============================================================

export function validateAnalysis(
  raw: AIInterpretation,
  opts: ValidationOptions = {},
): ValidationResult {
  const warnings: string[] = [];
  const rejected: string[] = [];

  // Cópia rasa pra não mutar o original
  const out: AIInterpretation = { ...raw };

  // ---------- Campos obrigatórios de texto ----------
  out.interpretacao = cleanText(raw.interpretacao) || 'Medida sem descrição.';
  out.motivo_instrumento = cleanText(raw.motivo_instrumento) || '';

  // ---------- Instrumento ----------
  if (!raw.instrumento || !VALID_INSTRUMENTS.has(raw.instrumento)) {
    warnings.push(`Instrumento "${raw.instrumento}" inválido; usando "projeto_lei".`);
    out.instrumento = 'projeto_lei' as InstrumentId;
  }

  // ---------- Impacto fiscal ----------
  out.impacto_fiscal = {
    tipo: VALID_FISCAL_TYPE.has(raw.impacto_fiscal?.tipo)
      ? raw.impacto_fiscal.tipo
      : 'neutro',
    magnitude: clampMagnitude(raw.impacto_fiscal?.magnitude),
    nota: cleanText(raw.impacto_fiscal?.nota) || '',
  };

  // ---------- Intensidade ----------
  const intens = Number(raw.intensidade);
  if (!Number.isInteger(intens) || intens < 0 || intens > 3) {
    warnings.push(`Intensidade "${raw.intensidade}" fora de 0–3; usando 1.`);
    out.intensidade = 1;
  } else {
    out.intensidade = intens as 0 | 1 | 2 | 3;
  }

  // ---------- Posição ideológica ----------
  const pos = Number(raw.posicao_ideologica);
  if (!Number.isFinite(pos)) {
    out.posicao_ideologica = 0;
  } else {
    out.posicao_ideologica = Math.max(-3, Math.min(3, pos));
  }

  // ---------- Estados-alvo ----------
  if (Array.isArray(raw.estados_alvo) && raw.estados_alvo.length > 0) {
    const valid = raw.estados_alvo.filter((s) =>
      STATE_IDS.includes(s as StateId),
    );
    const invalid = raw.estados_alvo.filter(
      (s) => !STATE_IDS.includes(s as StateId),
    );
    if (invalid.length > 0) {
      warnings.push(`Estados inválidos removidos: ${invalid.join(', ')}.`);
    }
    out.estados_alvo = valid.length > 0 ? valid : undefined;
  } else {
    out.estados_alvo = undefined;
  }

  // ---------- Grupos ----------
  const { groups, groupWarnings } = validateGroups(raw.grupos);
  out.grupos = groups;
  warnings.push(...groupWarnings);

  // ---------- Indicadores ----------
  const { indicators, indicatorWarnings, indicatorRejected } =
    validateIndicators(raw.indicadores, {
      currentValues: opts.currentValues,
      hasEstadoAlvo: !!out.estados_alvo,
    });
  out.indicadores = indicators;
  warnings.push(...indicatorWarnings);
  rejected.push(...indicatorRejected);

  // ---------- Risco jurídico ----------
  if (!raw.risco_juridico || !VALID_LEGAL_RISK.has(raw.risco_juridico)) {
    warnings.push(`Risco jurídico "${raw.risco_juridico}" inválido; usando "baixo".`);
    out.risco_juridico = 'baixo';
  } else {
    out.risco_juridico = raw.risco_juridico;
  }

  out.assessoria_juridica = cleanText(raw.assessoria_juridica) || '';

  // ---------- Áreas ----------
  if (raw.area_principal && !VALID_AREAS.has(raw.area_principal)) {
    out.area_principal = undefined;
  }
  if (Array.isArray(raw.areas_secundarias)) {
    out.areas_secundarias = raw.areas_secundarias.filter((a) =>
      VALID_AREAS.has(a),
    );
  }

  // ---------- Duração ----------
  const impl = Number(raw.implementationMonths);
  out.implementationMonths =
    Number.isFinite(impl) && impl >= 0 ? Math.min(24, Math.round(impl)) : 0;

  const ramp = Number(raw.effectRampUpMonths);
  out.effectRampUpMonths =
    Number.isFinite(ramp) && ramp >= 0 ? Math.min(36, Math.round(ramp)) : 0;

  if (raw.durationType && !VALID_DURATION_TYPE.has(raw.durationType)) {
    out.durationType = 'permanent';
  }
  const dur = Number(raw.durationMonths);
  out.durationMonths =
    Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0;

  // ---------- Arrays de texto ----------
  out.beneficios = sanitizeStringArray(raw.beneficios);
  out.riscos = sanitizeStringArray(raw.riscos);
  out.efeitos_colaterais = sanitizeStringArray(raw.efeitos_colaterais);
  out.objetivo = cleanText(raw.objetivo);

  // ---------- Coerência fiscal ----------
  applyFiscalCoherence(out, warnings);

  return { analysis: out, warnings, rejected };
}

// ============================================================
// 4. VALIDAÇÃO DE GRUPOS
// ============================================================

function validateGroups(
  raw: Record<string, number> | undefined,
): { groups: Record<string, number>; groupWarnings: string[] } {
  const out: Record<string, number> = {};
  const groupWarnings: string[] = [];

  if (!raw || typeof raw !== 'object') return { groups: out, groupWarnings };

  for (const [id, val] of Object.entries(raw)) {
    if (!GROUP_BY_ID[id]) {
      groupWarnings.push(`Grupo desconhecido removido: "${id}".`);
      continue;
    }
    const n = Number(val);
    if (!Number.isFinite(n) || n === 0) continue;
    const clamped = Math.max(-GROUP_DELTA_CLAMP, Math.min(GROUP_DELTA_CLAMP, n));
    if (clamped !== n) {
      groupWarnings.push(`Grupo ${id}: delta ${n} clampado para ${clamped}.`);
    }
    out[id] = clamped;
  }

  return { groups: out, groupWarnings };
}

// ============================================================
// 5. VALIDAÇÃO DE INDICADORES
// ============================================================

interface ValidateIndicatorsOpts {
  currentValues?: Record<string, number>;
  hasEstadoAlvo: boolean;
}

function validateIndicators(
  raw: Record<string, number> | undefined,
  opts: ValidateIndicatorsOpts,
): {
  indicators: Record<string, number>;
  indicatorWarnings: string[];
  indicatorRejected: string[];
} {
  const out: Record<string, number> = {};
  const indicatorWarnings: string[] = [];
  const indicatorRejected: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { indicators: out, indicatorWarnings, indicatorRejected };
  }

  for (const [id, val] of Object.entries(raw)) {
    const ind = INDICATORS[id];

    // Indicador não existe
    if (!ind) {
      indicatorRejected.push(`Indicador desconhecido: "${id}".`);
      continue;
    }

    // Indicador fiscal controlado pelo motor
    if (FISCAL_CONTROLLED.has(id)) {
      indicatorRejected.push(
        `Indicador "${id}" é controlado pelo impacto fiscal — removido.`,
      );
      continue;
    }

    // Medida regional não pode mexer em indicador nacional puro
    if (opts.hasEstadoAlvo && ind.scope === 'national') {
      indicatorRejected.push(
        `Indicador "${id}" é nacional — ignorado em medida regional.`,
      );
      continue;
    }

    const n = Number(val);
    if (!Number.isFinite(n) || n === 0) continue;

    // Clamp por percentual do valor atual
    let clamped = n;
    const current = opts.currentValues?.[id];
    if (typeof current === 'number' && current !== 0) {
      const maxDelta = Math.abs(current) * INDICATOR_DELTA_PCT_CLAMP;
      if (Math.abs(n) > maxDelta) {
        clamped = Math.sign(n) * maxDelta;
        indicatorWarnings.push(
          `Indicador ${id}: delta ${n.toFixed(2)} excede limite (${maxDelta.toFixed(2)}); clampado.`,
        );
      }
    }

    // Respeita min/max do catálogo
    if (typeof current === 'number') {
      const next = current + clamped;
      if (next > ind.max) clamped = ind.max - current;
      if (next < ind.min) clamped = ind.min - current;
    }

    if (clamped === 0) continue;
    out[id] = clamped;
  }

  return { indicators: out, indicatorWarnings, indicatorRejected };
}

// ============================================================
// 6. COERÊNCIA FISCAL
// ============================================================

/**
 * Regras de coerência:
 *   - Se o impacto é custo, o texto não pode declarar que a medida
 *     "reduz a dívida" ou "aumenta o superávit" sem contrapartida.
 *   - Se o impacto é economia, não pode declarar o oposto.
 *
 * Ajustamos o texto de notas para não criar contradição direta
 * com os efeitos declarados.
 */
function applyFiscalCoherence(
  analysis: AIInterpretation,
  warnings: string[],
): void {
  const tipo = analysis.impacto_fiscal.tipo;
  const nota = analysis.impacto_fiscal.nota.toLowerCase();

  const saysReducesDebt = /reduz\w*\s+(a\s+)?d[íi]vida|melhora\s+(o\s+)?super[áa]vit|reduz\s+o\s+d[ée]ficit/.test(nota);
  const saysIncreasesDebt = /aumenta\s+(a\s+)?d[íi]vida|piora\s+(o\s+)?super[áa]vit|aumenta\s+o\s+d[ée]ficit/.test(nota);

  if (tipo === 'custo' && saysReducesDebt) {
    warnings.push(
      'Nota fiscal incoerente: declarado como custo, mas o texto sugere redução de dívida.',
    );
  }
  if (tipo === 'economia' && saysIncreasesDebt) {
    warnings.push(
      'Nota fiscal incoerente: declarado como economia, mas o texto sugere aumento de dívida.',
    );
  }

  // Se a IA declarou "neutro" mas a magnitude > 0, reclassifica para custo
  if (tipo === 'neutro' && analysis.impacto_fiscal.magnitude > 0) {
    analysis.impacto_fiscal.tipo = 'custo';
    warnings.push(
      'Tipo fiscal "neutro" com magnitude > 0; reclassificado como "custo".',
    );
  }

  // Se a IA declarou custo/economia mas magnitude = 0, reclassifica para neutro
  if (tipo !== 'neutro' && analysis.impacto_fiscal.magnitude === 0) {
    analysis.impacto_fiscal.tipo = 'neutro';
    warnings.push(
      'Magnitude 0; tipo fiscal reclassificado para "neutro".',
    );
  }
}

// ============================================================
// 7. HELPERS
// ============================================================

function clampMagnitude(m: unknown): FiscalMagnitude {
  const n = Number(m);
  if (!Number.isFinite(n)) return 0;
  const i = Math.round(n);
  if (i < 0) return 0;
  if (i > 7) return 7;
  return i as FiscalMagnitude;
}

function cleanText(s: unknown): string {
  if (typeof s !== 'string') return '';
  let out = s.trim();

  // Remove números monetários exatos (a IA inventa valores)
  // Ex.: "R$ 1.412,00", "R$ 40 bilhões"  →   mantém só o qualitativo
  out = out.replace(/R\$\s?[\d.,]+(?:\s?(?:mil|milh[õo]es|bilh[õo]es|trilh[õo]es))?/gi, 'R$ [valor]');

  // Colapsa espaços duplos
  out = out.replace(/\s{2,}/g, ' ');

  return out;
}

function sanitizeStringArray(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const cleaned = arr
    .map((s) => (typeof s === 'string' ? cleanText(s) : ''))
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

// ============================================================
// 8. ENTRADA DE ALTO NÍVEL
// ============================================================

export interface ProcessedResponse {
  kind: 'query' | 'analysis';
  query?: AIQueryRequest;
  analysis?: ValidationResult;
  warnings: string[];
  rejected: string[];
}

/**
 * Combina parse + validate. É o ponto de entrada que o `policyAI.ts` usa.
 */
export function processResponse(
  raw: string,
  opts: ValidationOptions = {},
): ProcessedResponse | { kind: 'error'; error: string; raw: string } {
  const parsed = parseResponse(raw);
  if (parsed.kind === 'error') return parsed;

  if (parsed.kind === 'query') {
    return {
      kind: 'query',
      query: parsed.data,
      warnings: [],
      rejected: [],
    };
  }

  const validated = validateAnalysis(parsed.data, opts);
  return {
    kind: 'analysis',
    analysis: validated,
    warnings: validated.warnings,
    rejected: validated.rejected,
  };
}

// ============================================================
// 9. FALLBACK / DEFAULTS
// ============================================================

/**
 * Cria uma análise mínima quando a IA falha completamente.
 * Não inventa efeitos — só preenche o mínimo pra UI não quebrar.
 */
export function fallbackAnalysis(
  proposalText: string,
  reason: string,
): AIInterpretation {
  return {
    interpretacao: `Análise indisponível. Motivo: ${reason}`,
    instrumento: 'projeto_lei',
    motivo_instrumento: 'Não foi possível classificar automaticamente.',
    impacto_fiscal: {
      tipo: 'neutro',
      magnitude: 0,
      nota: 'Sem estimativa fiscal.',
    },
    intensidade: 0,
    posicao_ideologica: 0,
    grupos: {},
    indicadores: {},
    risco_juridico: 'baixo',
    assessoria_juridica: '',
    objetivo: proposalText.slice(0, 200),
    _fallback: true,
  };
}
