import { FISCAL_MAGNITUDE_REAIS, INSTRUMENTS, type InstrumentId } from '../../data/catalog';
import { INDICATORS_BY_ID } from '../../data/indicators';
import { GROUPS_BY_ID } from '../../data/groups';

import { VALID_QUERY_TYPES } from '../../data/queryCatalog';
import type {
  AIInterpretation,
  AIQueryRequest,
  QueryRequest,
  FiscalMagnitude,
} from '../../types/ai';

const VALID_INSTRUMENTS = new Set<string>(INSTRUMENTS.map((i) => i.id));

const VALID_LEGAL_RISK = new Set(['baixo', 'medio', 'alto']);
const VALID_FISCAL_TYPE = new Set(['neutro', 'custo', 'economia']);
const VALID_DURATION_TYPE = new Set(['permanent', 'temporary']);
const VALID_AREAS = new Set([
  'economia', 'saude', 'educacao', 'seguranca',
  'infraestrutura', 'social', 'ambiente', 'gestao', 'politica',
]);

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

const GROUP_DELTA_CLAMP = 15;
const INDICATOR_DELTA_PCT_CLAMP = 0.40;

const INDICATOR_DELTA_MIN: Record<string, number> = {
  salario_minimo: 20,
  receitas_publicas: 5,
  gastos_publicos: 5,
};

export type ParseResult =
  | { kind: 'query'; data: AIQueryRequest }
  | { kind: 'analysis'; data: AIInterpretation }
  | { kind: 'error'; error: string; raw: string };

export interface ValidationOptions {
  proposalText?: string;
  currentValues?: Record<string, number>;
}

export interface ValidationResult {
  analysis: AIInterpretation;
  warnings: string[];
  rejected: string[];
}

export function extractJson(raw: string): unknown | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();

  const direct = tryJson(text);
  if (direct !== null) return direct;

  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (mdMatch) {
    const inner = tryJson(mdMatch[1].trim());
    if (inner !== null) return inner;
  }

  const tagMatch = text.match(/<json>\s*([\s\S]*?)<\/json>/i);
  if (tagMatch) {
    const inner = tryJson(tagMatch[1].trim());
    if (inner !== null) return inner;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = text.slice(firstBrace, lastBrace + 1);
    const inner = tryJson(slice);
    if (inner !== null) return inner;
  }

  const repaired = repairTruncatedJson(text);
  if (repaired !== null) return repaired;

  return null;
}

function repairTruncatedJson(text: string): unknown | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastCommaIndex = -1;
  let lastCommaDepth = -1;

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
    } else if (char === ',') {
      lastCommaIndex = i;
      lastCommaDepth = stack.length;
    }
  }

  let base = text.slice(start).trimEnd();
  if (inString) base += '"';
  const repaired = tryJson(`${base}${[...stack].reverse().join('')}`);
  if (repaired !== null) return repaired;

  if (lastCommaIndex > start) {
    const fallback = text.slice(start, lastCommaIndex).trimEnd();
    const closers = stack.slice(0, lastCommaDepth).reverse().join('');
    const parsed = tryJson(`${fallback}${closers}`);
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

  if (phase === 'query') {
    return parseQueryObject(obj, raw);
  }
  if (phase === 'analysis') {
    return isRecord(obj.analysis)
      ? parseAnalysisObject(obj, raw)
      : hasAnalysisFields(obj)
        ? parseAnalysisObject({ phase: 'analysis', analysis: obj }, raw)
        : parseAnalysisObject(obj, raw);
  }

  if (isRecord(obj.analysis)) {
    return parseAnalysisObject({ ...obj, phase: 'analysis' }, raw);
  }

  // Alguns modelos seguem o schema interno, mas omitem o envelope
  // { phase: "analysis", analysis: {...} }. Aceita o objeto direto
  // somente quando ele contém campos característicos da análise.
  if (hasAnalysisFields(obj)) {
    return parseAnalysisObject({ phase: 'analysis', analysis: obj }, raw);
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
  if (!isRecord(analysis)) {
    const keys = Object.keys(obj).filter((key) => key !== 'phase').slice(0, 12);
    const detail = keys.length ? ` Campos recebidos: ${keys.join(', ')}.` : '';
    const preview = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
    return { kind: 'error', error: `Campo "analysis" ausente ou inválido.${detail} Resposta: ${preview}`, raw };
  }
  return { kind: 'analysis', data: analysis as unknown as AIInterpretation };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasAnalysisFields(obj: Record<string, unknown>): boolean {
  return [
    'interpretacao',
    'instrumento',
    'impacto_fiscal',
    'indicadores',
    'grupos',
    'risco_juridico',
  ].some((key) => key in obj);
}

export function validateAnalysis(
  raw: AIInterpretation,
  opts: ValidationOptions = {},
): ValidationResult {
  const warnings: string[] = [];
  const rejected: string[] = [];

  const out: AIInterpretation = { ...raw };

  out.interpretacao = cleanText(raw.interpretacao) || 'Medida sem descrição.';
  out.motivo_instrumento = cleanText(raw.motivo_instrumento) || '';

  if (!raw.instrumento || !VALID_INSTRUMENTS.has(raw.instrumento)) {
    warnings.push(`Instrumento "${raw.instrumento}" inválido; usando "projeto_lei".`);
    out.instrumento = 'projeto_lei' as InstrumentId;
  }

  const fiscalMagnitude = clampMagnitude(raw.impacto_fiscal?.magnitude);
  const annualFiscal = Number(raw.impacto_fiscal?.valor_anual_bi);
  out.impacto_fiscal = {
    tipo: VALID_FISCAL_TYPE.has(raw.impacto_fiscal?.tipo)
      ? raw.impacto_fiscal.tipo
      : 'neutro',
    magnitude: fiscalMagnitude,
    valor_anual_bi: Number.isFinite(annualFiscal) && annualFiscal >= 0 && (annualFiscal > 0 || fiscalMagnitude === 0)
      ? Math.min(5000, annualFiscal)
      : (FISCAL_MAGNITUDE_REAIS[fiscalMagnitude] ?? 0) / 1e9,
    nota: cleanText(raw.impacto_fiscal?.nota, true) || '',
  };

  const intens = Number(raw.intensidade);
  if (!Number.isInteger(intens) || intens < 0 || intens > 3) {
    warnings.push(`Intensidade "${raw.intensidade}" fora de 0–3; usando 1.`);
    out.intensidade = 1;
  } else {
    out.intensidade = intens as 0 | 1 | 2 | 3;
  }

  const pos = Number(raw.posicao_ideologica);
  if (!Number.isFinite(pos)) {
    out.posicao_ideologica = 0;
  } else {
    out.posicao_ideologica = Math.max(-3, Math.min(3, pos));
  }

  const { groups, groupWarnings } = validateGroups(raw.grupos);
  out.grupos = enforceGroupTradeoffs(groups, opts.proposalText ?? '', raw.impacto_fiscal?.magnitude, warnings);
  warnings.push(...groupWarnings);

  const { indicators, indicatorWarnings, indicatorRejected } =
    validateIndicators(raw.indicadores, {
      currentValues: opts.currentValues,
    });
  out.indicadores = indicators;
  warnings.push(...indicatorWarnings);
  rejected.push(...indicatorRejected);

  if (!raw.risco_juridico || !VALID_LEGAL_RISK.has(raw.risco_juridico)) {
    warnings.push(`Risco jurídico "${raw.risco_juridico}" inválido; usando "baixo".`);
    out.risco_juridico = 'baixo';
  } else {
    out.risco_juridico = raw.risco_juridico;
  }

  out.assessoria_juridica = cleanText(raw.assessoria_juridica) || '';

  if (raw.area_principal && !VALID_AREAS.has(raw.area_principal)) {
    out.area_principal = undefined;
  }
  if (Array.isArray(raw.areas_secundarias)) {
    out.areas_secundarias = raw.areas_secundarias.filter((a) =>
      VALID_AREAS.has(a),
    );
  }

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

  out.beneficios = sanitizeStringArray(raw.beneficios);
  out.riscos = sanitizeStringArray(raw.riscos);
  out.efeitos_colaterais = sanitizeStringArray(raw.efeitos_colaterais);
  out.objetivo = cleanText(raw.objetivo);

  applyFiscalCoherence(out, warnings);

  if (warnings.length > 0) {
    out.warnings = warnings;
  }

  return { analysis: out, warnings, rejected };
}

function validateGroups(
  raw: Record<string, number> | undefined,
): { groups: Record<string, number>; groupWarnings: string[] } {
  const out: Record<string, number> = {};
  const groupWarnings: string[] = [];

  if (!raw || typeof raw !== 'object') return { groups: out, groupWarnings };

  for (const [id, val] of Object.entries(raw)) {
    if (!GROUPS_BY_ID[id]) {
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

interface ValidateIndicatorsOpts {
  currentValues?: Record<string, number>;
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
    const ind = INDICATORS_BY_ID[id];

    if (!ind) {
      indicatorRejected.push(`Indicador desconhecido: "${id}".`);
      continue;
    }

    if (FISCAL_CONTROLLED.has(id)) {
      indicatorRejected.push(
        `Indicador "${id}" é controlado pelo impacto fiscal — removido.`,
      );
      continue;
    }

    const n = Number(val);
    if (!Number.isFinite(n) || n === 0) continue;

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

    const minAbs = INDICATOR_DELTA_MIN[id];
    if (minAbs !== undefined && clamped !== 0 && Math.abs(clamped) < minAbs) {
      const sign = Math.sign(clamped);
      const antes = clamped;
      clamped = sign * minAbs;
      indicatorWarnings.push(
        `Indicador ${id}: delta ${antes} ajustado para o mínimo viável (${clamped}).`,
      );
    }

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

  const annualBi = analysis.impacto_fiscal.valor_anual_bi ?? 0;
  if (tipo === 'neutro' && (analysis.impacto_fiscal.magnitude > 0 || annualBi > 0)) {
    analysis.impacto_fiscal.tipo = 'custo';
    warnings.push(
      'Tipo fiscal "neutro" com magnitude > 0; reclassificado como "custo".',
    );
  }

  if (tipo !== 'neutro' && analysis.impacto_fiscal.magnitude === 0 && annualBi === 0) {
    analysis.impacto_fiscal.tipo = 'neutro';
    warnings.push(
      'Magnitude 0; tipo fiscal reclassificado para "neutro".',
    );
  }
}

function clampMagnitude(m: unknown): FiscalMagnitude {
  const n = Number(m);
  if (!Number.isFinite(n)) return 0;
  const i = Math.round(n);
  if (i < 0) return 0;
  if (i > 7) return 7;
  return i as FiscalMagnitude;
}

function cleanText(s: unknown, redactCurrency = false): string {
  if (typeof s !== 'string') return '';
  let out = s.trim();

  if (redactCurrency) {
    out = out.replace(/R\$\s?[\d.,]+(?:\s?(?:mil|milh[õo]es|bilh[õo]es|trilh[õo]es))?/gi, 'R$ [valor]');
  }

  out = out.replace(/\s{2,}/g, ' ');

  return out;
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function enforceGroupTradeoffs(
  input: Record<string, number>,
  proposal: string,
  fiscalMagnitude: unknown,
  warnings: string[],
): Record<string, number> {
  const groups = { ...input };
  const text = normalizeText(proposal);
  const beneficiaries = new Set<string>();

  if (/salario minimo|piso salarial|reajuste salarial|aumento salarial|direitos trabalhistas|beneficio previdenciario|aposentador|seguro desemprego/.test(text)) {
    beneficiaries.add('trabalhadores');
    if (/previd|aposent|salario minimo/.test(text)) beneficiaries.add('aposentados');
  }
  if (/emprego|contratacao|qualificacao profissional/.test(text)) {
    beneficiaries.add('trabalhadores');
    beneficiaries.add('jovens');
  }
  if (/bolsa|transferencia de renda|renda basica|combate a pobreza/.test(text)) {
    beneficiaries.add('trabalhadores');
    beneficiaries.add('aposentados');
    beneficiaries.add('jovens');
  }
  if (/reducao de impostos? para empresas|desoneracao|credito para empresas|subsidio ao agronegocio/.test(text)) {
    beneficiaries.add('empresarios');
    beneficiaries.add('agronegocio');
  }
  if (/investimento em universidades|universidades publicas|pesquisa cientifica|bolsa de pesquisa/.test(text)) {
    beneficiaries.add('universitarios');
    beneficiaries.add('ciencia');
  }

  for (const id of beneficiaries) {
    if (groups[id] !== undefined && groups[id] < 0) {
      groups[id] = Math.abs(groups[id]);
      warnings.push(`Sinal de ${id} invertido: a proposta indica benefício direto ao grupo.`);
    }
  }

  const positives = Object.entries(groups).filter(([, delta]) => delta > 0);
  const hasNegative = Object.values(groups).some((delta) => delta < 0);
  const magnitude = Number(fiscalMagnitude);
  if (!Number.isFinite(magnitude) || magnitude < 4 || positives.length < 2 || hasNegative) return groups;

  const payers = /salario|piso|trabalh|previd|bolsa|renda|beneficio|gasto|despesa|subsidio/.test(text)
    ? ['empresarios', 'mercado_financeiro']
    : /imposto|tribut|desoner|empresa|agronegocio/.test(text)
      ? ['mercado_financeiro', 'servidores_publicos']
      : ['empresarios', 'mercado_financeiro'];
  for (const [id, delta] of positives) groups[id] = delta * 0.7;
  const payer = payers.find((id) => !(id in groups)) ?? payers[0];
  groups[payer] = -4;
  warnings.push(`Trade-off fiscal aplicado: deltas positivos reduzidos em 30% e ${payer} recebeu delta -4.`);
  return groups;
}

function sanitizeStringArray(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const cleaned = arr
    .map((s) => (typeof s === 'string' ? cleanText(s) : ''))
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

export interface ProcessedResponse {
  kind: 'query' | 'analysis';
  query?: AIQueryRequest;
  analysis?: ValidationResult;
  warnings: string[];
  rejected: string[];
}

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
