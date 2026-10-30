import { FISCAL_MAGNITUDE_REAIS, INSTRUMENTS, INSTRUMENT_BY_ID, type InstrumentId } from '../../data/catalog';
import { INDICATORS_BY_ID } from '../../data/indicators';
import { GROUPS_BY_ID } from '../../data/groups';

import { VALID_QUERY_TYPES } from '../../data/queryCatalog';
import type {
  AIInterpretation,
  AIQueryRequest,
  NewPolicyIndicator,
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
  'receitas_governo',
  'despesas_governo',
  'receitas_publicas',
  'gastos_publicos',
  'saldo_orcamentario',
  'divida_publica',
  'divida_pib',
  'carga_tributaria',
  'orcamento_saude',
  'orcamento_educacao',
  'investimentos_publicos',
  'investimento_infraestrutura',
]);

const GROUP_DELTA_CLAMP = 15;

function parseExplicitCurrencyAmount(text: string): number | null {
  const numeric = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d+)?';
  const match = text.match(new RegExp(`R\\$\\s*(${numeric})|(${numeric})\\s*reais?`, 'i'));
  if (!match) return null;
  const parsedText = match[1] ?? match[2];
  const parsed = Number(parsedText.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

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
    'titulo',
    'interpretacao',
    'instrumento',
    'impacto_fiscal',
    'indicadores',
    'novosIndicadores',
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

  const proposalText = opts.proposalText?.trim() ?? '';
  out.titulo = cleanText(raw.titulo) || cleanText(raw.interpretacao) || proposalText.slice(0, 72) || 'Medida proposta';
  out.interpretacao = cleanText(raw.interpretacao)
    || proposalText.slice(0, 180) || 'Medida proposta pelo governo.';
  out.tipo_medida = classifyMeasureKind(proposalText);

  if (!raw.instrumento || !VALID_INSTRUMENTS.has(raw.instrumento)) {
    warnings.push(`Instrumento "${raw.instrumento}" inválido; usando "projeto_lei".`);
    out.instrumento = 'projeto_lei' as InstrumentId;
  }
  // O rito apresentado ao jogador sempre corresponde ao instrumento escolhido.
  out.motivo_instrumento = INSTRUMENT_BY_ID[out.instrumento].regra;

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
    nota: cleanText(raw.impacto_fiscal?.nota) || '',
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
  out.indicadores = reconcileExplicitIndicatorTargets(
    indicators,
    proposalText,
    warnings,
  );
  warnings.push(...indicatorWarnings);
  rejected.push(...indicatorRejected);

  const validCategories = new Set(['economia', 'saude', 'educacao', 'social', 'seguranca', 'energia', 'cultura']);
  const usedIds = new Set<string>();
  out.novosIndicadores = (Array.isArray(raw.novosIndicadores) ? raw.novosIndicadores : [])
    .slice(0, 5)
    .flatMap((candidate): NewPolicyIndicator[] => {
      if (!isRecord(candidate)) return [];
      const id = cleanText(candidate.id).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 48);
      const nome = cleanText(candidate.nome);
      const tipo = candidate.tipo === 'informativo' ? 'informativo' : 'slider';
      const categoria = inferFinancialCategory(opts.proposalText ?? '') ?? String(candidate.categoria ?? 'economia');
      if (!id || !nome || INDICATORS_BY_ID[id] || usedIds.has(id) || !validCategories.has(categoria)) return [];
      usedIds.add(id);
      const valorInicial = Number(candidate.valorInicial);
      const valorProposto = Number(candidate.valorProposto);
      const minimo = Number(candidate.minimo);
      const maximo = Number(candidate.maximo);
      const passo = Number(candidate.passo);
      const delta = Number(candidate.delta);
      const measureText = `${nome} ${cleanText(candidate.descricao)} ${opts.proposalText ?? ''}`;
      const normalizedMeasure = normalizeText(measureText);
      const isTax = /impost|tribut|aliquota|taxa/.test(normalizedMeasure);
      const directCashTransfer = parseExplicitCurrencyAmount(opts.proposalText ?? '') !== null &&
        /\bpor\s+(?:pessoa|aluno|fam[ií]lia|crian[cç]a)\b|benef[ií]cio monet[aá]rio|pagamento direto/i.test(measureText);
      const resolvedType = directCashTransfer ? 'slider' : tipo;
      if (resolvedType === 'informativo') return [{
        id, nome: nome.slice(0, 80), curto: cleanText(candidate.curto).slice(0, 36) || nome.slice(0, 36),
        categoria: categoria as 'economia' | 'saude' | 'educacao' | 'social' | 'seguranca' | 'energia' | 'cultura',
        tipo, unidade: cleanText(candidate.unidade).slice(0, 24), valorInicial: 0,
        fiscalAnnual: Number.isFinite(Number(candidate.fiscalAnnual)) ? Math.max(-100, Math.min(100, Number(candidate.fiscalAnnual))) * 1e9 : undefined,
        affects: isRecord(candidate.affects) ? Object.fromEntries(Object.entries(candidate.affects).filter(([key, value]) => INDICATORS_BY_ID[key] && Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)])) : undefined,
        descricao: cleanText(candidate.descricao).slice(0, 240),
      }];
      if (![valorInicial, valorProposto, minimo, maximo, passo, delta].every(Number.isFinite) || maximo <= minimo || passo <= 0 || valorProposto < minimo || valorProposto > maximo) return [];
      const sliderInitial = valorInicial;
      const sliderProposed = valorProposto;
      const sliderMin = minimo;
      const sliderMax = maximo;
      const sliderStep = passo;
      const sliderUnit = cleanText(candidate.unidade).slice(0, 24) || '%';
      const fiscalCap = sliderUnit.includes('R$') ? 0.5 : 100;
      const rawFiscalPerUnit = Number(candidate.fiscalAnnual);
      const isSpending = /benef[ií]c|programa|subs[ií]dio|transfer[eê]ncia|pagar/.test(normalizedMeasure);
      const reportedAnnualBi = Number(raw.impacto_fiscal?.valor_anual_bi);
      const inferredTaxFiscalPerUnit = isTax && Number.isFinite(reportedAnnualBi) && reportedAnnualBi > 0 && sliderProposed > sliderInitial
        ? reportedAnnualBi * 1e9 / (sliderProposed - sliderInitial)
        : undefined;
      const fiscalPerUnit = Number.isFinite(rawFiscalPerUnit)
        ? (isTax ? Math.abs(rawFiscalPerUnit) : isSpending ? -Math.abs(rawFiscalPerUnit) : rawFiscalPerUnit)
        : inferredTaxFiscalPerUnit;
      const affects = isRecord(candidate.affects)
        ? Object.fromEntries(Object.entries(candidate.affects).filter(([key, value]) => INDICATORS_BY_ID[key] && !FISCAL_CONTROLLED.has(key) && Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)]))
        : {};
      if (Object.keys(affects).length === 0) {
        const measureText = `${nome} ${cleanText(candidate.descricao)} ${opts.proposalText ?? ''}`.toLowerCase();
        if (/impost|tribut|al[ií]quota|taxa/.test(measureText)) {
          affects.inflacao = 0.08;
          affects.crescimento_pib = -0.1;
        } else if (/benef[ií]cio|renda|transfer[eê]ncia|assist[eê]ncia/.test(measureText) || categoria === 'social') {
          affects.taxa_pobreza = -0.4;
          affects.desigualdade_renda = -0.25;
        } else if (categoria === 'saude') {
          affects.qualidade_saude = 0.4;
        } else if (categoria === 'educacao') {
          affects.qualidade_educacao = 0.4;
        } else if (categoria === 'energia') {
          affects.participacao_renovaveis = 0.3;
        }
      }
      return [{
        id, nome: nome.slice(0, 80), curto: cleanText(candidate.curto).slice(0, 36) || nome.slice(0, 36),
        categoria: categoria as 'economia' | 'saude' | 'educacao' | 'social' | 'seguranca' | 'energia' | 'cultura',
        tipo: resolvedType, unidade: sliderUnit, valorInicial: sliderInitial,
        valorProposto: sliderProposed, minimo: sliderMin, maximo: sliderMax, passo: sliderStep, delta: sliderProposed - sliderInitial,
        fiscalAnnual: fiscalPerUnit !== undefined ? Math.max(-fiscalCap, Math.min(fiscalCap, fiscalPerUnit)) * 1e9 : undefined,
        affects,
        affectScale: /m[eê]s por|por pessoa|por aluno|por fam[ií]lia/.test(normalizeText(sliderUnit)) ? 100 : 1,
        descricao: cleanText(candidate.descricao).slice(0, 240),
      }];
    });

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
  out.objetivo = cleanText(raw.objetivo) || proposalText.slice(0, 180);

  const cardFiscalFlows = (out.novosIndicadores ?? [])
    .filter((indicator) => indicator.tipo === 'slider' && typeof indicator.fiscalAnnual === 'number' && indicator.fiscalAnnual !== 0)
    .map((indicator) => (indicator.fiscalAnnual ?? 0) * ((indicator.valorProposto ?? indicator.valorInicial) - indicator.valorInicial) / 1e9);
  const cardRevenueBi = cardFiscalFlows.reduce((sum, flow) => sum + Math.max(0, flow), 0);
  const cardCostBi = cardFiscalFlows.reduce((sum, flow) => sum + Math.max(0, -flow), 0);
  const cardFiscalAnnualBi = cardRevenueBi - cardCostBi;
  const hasCardFiscalEstimate = (out.novosIndicadores ?? []).some((indicator) =>
    indicator.tipo === 'slider' && typeof indicator.fiscalAnnual === 'number' && indicator.fiscalAnnual !== 0 &&
    (indicator.valorProposto ?? indicator.valorInicial) !== indicator.valorInicial,
  );
  if (hasCardFiscalEstimate) {
    const estimate = Math.abs(cardFiscalAnnualBi);
    const nearestMagnitude = Object.entries(FISCAL_MAGNITUDE_REAIS)
      .map(([magnitude, value]) => ({ magnitude: Number(magnitude), value: value / 1e9 }))
      .sort((a, b) => Math.abs(a.value - estimate) - Math.abs(b.value - estimate))[0]?.magnitude ?? 0;
    out.impacto_fiscal.tipo = cardFiscalAnnualBi > 0 ? 'economia' : cardFiscalAnnualBi < 0 ? 'custo' : 'neutro';
    out.impacto_fiscal.magnitude = nearestMagnitude as FiscalMagnitude;
    out.impacto_fiscal.valor_anual_bi = estimate;
    const positiveFlowLabel = out.tipo_medida === 'imposto' ? 'Arrecadação' : 'Economia de gastos';
    out.impacto_fiscal.nota = cardRevenueBi > 0 && cardCostBi > 0
      ? `${positiveFlowLabel}: R$ ${cardRevenueBi.toFixed(2)} bi/ano; custo: R$ ${cardCostBi.toFixed(2)} bi/ano; saldo líquido: R$ ${cardFiscalAnnualBi.toFixed(2)} bi/ano.`
      : cardFiscalAnnualBi > 0
        ? `${positiveFlowLabel} anual estimada pelos parâmetros do card: R$ ${estimate.toFixed(2)} bilhões.`
        : cardFiscalAnnualBi < 0
          ? `Custo anual estimado pelos parâmetros do card: R$ ${estimate.toFixed(2)} bilhões.`
          : 'Sem impacto fiscal calculado pelos parâmetros do card.';
    if (Math.abs((annualFiscal || 0) - estimate) > 1) warnings.push('A estimativa fiscal geral foi substituída pela soma calculada dos sliders da medida.');
  } else if (Math.abs((out.impacto_fiscal.valor_anual_bi ?? 0) - 150) < 0.001 && !/R\$\s*150\s*(bilh|bi\b)/i.test(opts.proposalText ?? '')) {
    out.impacto_fiscal.tipo = 'neutro';
    out.impacto_fiscal.magnitude = 0;
    out.impacto_fiscal.valor_anual_bi = 0;
    out.impacto_fiscal.nota = 'Estimativa fiscal indisponível: a análise não informou base de cálculo verificável.';
    warnings.push('Estimativa padrão de R$ 150 bilhões removida por falta de base de cálculo específica.');
  }

  applyFiscalCoherence(out, opts.proposalText ?? '', warnings);

  ensureFinancialControlCard(out, proposalText);
  enforceBudgetCutTradeoff(out, proposalText);

  if (warnings.length > 0) {
    out.warnings = warnings;
  }

  return { analysis: out, warnings, rejected };
}

function classifyMeasureKind(proposal: string): AIInterpretation['tipo_medida'] {
  const text = normalizeText(proposal);
  if (/\b(imposto|tributo|tributacao|aliquota|taxa sobre|cobranca tributaria)\b/.test(text)) return 'imposto';
  if (/\b(transferencia de renda|bolsa familia|auxilio financeiro|beneficio monetario|beneficio previdenciario|beneficios sociais|pagamento direto|renda basica|subsidio individual)\b/.test(text)) return 'beneficio';
  if (/\b(programa|plano|projeto governamental|politica publica)\b/.test(text) || /oferecer cursos|ampliar o acesso|financiar servicos/.test(text)) return 'programa';
  return 'medida';
}

/** Ensures a numeric target in the proposal has the correct signed delta. */
function reconcileExplicitIndicatorTargets(
  indicators: Record<string, number>,
  proposal: string,
  warnings: string[],
): Record<string, number> {
  const result = { ...indicators };
  const text = normalizeText(proposal);
  const targetPattern = /\b(reduzir|diminuir|baixar|aumentar|elevar|subir)\s+(.{1,80}?)\s+de\s+(-?\d+(?:[.,]\d+)?)\s*%?\s+para\s+(-?\d+(?:[.,]\d+)?)\s*%?/g;

  for (const match of text.matchAll(targetPattern)) {
    // Preserve prepositions inside indicator names (e.g. "taxa de pobreza").
    // Only remove an article at the beginning of the descriptor.
    const descriptor = match[2]
      .replace(/^\s*(?:a|o|as|os|um|uma)\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const from = Number(match[3].replace(',', '.'));
    const to = Number(match[4].replace(',', '.'));
    if (!descriptor || !Number.isFinite(from) || !Number.isFinite(to)) continue;

    const candidates = Object.entries(INDICATORS_BY_ID)
      .filter(([, definition]) => definition.type === 'calculated')
      .flatMap(([id, definition]) => {
        const labels = [id.replace(/_/g, ' '), definition.nome, definition.curto]
          .map((label) => normalizeText(label))
          .filter((label) => label.length >= 4);
        const matchedLength = labels.filter((label) => descriptor.includes(label) || label.includes(descriptor))
          .sort((a, b) => b.length - a.length)[0]?.length;
        return matchedLength ? [{ id, matchedLength }] : [];
      })
      .sort((a, b) => b.matchedLength - a.matchedLength);
    const target = candidates[0];
    if (!target || (candidates[1]?.matchedLength === target.matchedLength && candidates[1]?.id !== target.id)) continue;

    const delta = Math.round((to - from) * 1e6) / 1e6;
    if (result[target.id] === delta) continue;
    warnings.push(`Delta de ${target.id} corrigido para corresponder à meta explícita (${from} → ${to}).`);
    result[target.id] = delta;
  }

  return result;
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
  proposalText: string,
  warnings: string[],
): void {
  let tipo = analysis.impacto_fiscal.tipo;
  const nota = normalizeText(analysis.impacto_fiscal.nota);
  const proposal = normalizeText(proposalText);
  const annualBi = analysis.impacto_fiscal.valor_anual_bi ?? 0;

  const taxMeasure = /\b(imposto|tributo|tributacao|aliquota|taxa sobre|cobranca tributaria)\b/.test(proposal);
  const taxRelief = /\b(reduzir|cortar|isentar|desonerar|extinguir)\b.{0,40}\b(imposto|tributo|tributacao|aliquota|taxa|contribuicao)\b|\b(imposto|tributo|aliquota|taxa|contribuicao)\b.{0,40}\b(reduzir|cortar|isentar|desonerar|extinguir)\b/.test(proposal);
  const spendingMeasure = /\b(beneficio|programa|subsidio|transferencia|conceder|pagar|gasto|despesa|orcamento|verba)\b/.test(proposal);
  const spendingCut = isEfficiencySavingProposal(proposal) ||
    /\b(cortar|reduzir|diminuir)\b.{0,35}\b(gastos?|despesas?|orcamento|verbas?)\b|\b(gastos?|despesas?|orcamento|verbas?)\b.{0,35}\b(cortar|reduzir|diminuir)\b|\b(encerrar|extinguir|eliminar)\b.{0,35}\b(programas?|beneficios?|subsidios?|transferencias)\b/.test(proposal);

  if (taxMeasure && !taxRelief && annualBi > 0 && tipo !== 'economia') {
    tipo = 'economia';
    analysis.impacto_fiscal.tipo = tipo;
    warnings.push('Impacto fiscal reclassificado como arrecadação: a proposta cria ou aumenta um tributo.');
  } else if (taxMeasure && taxRelief && annualBi > 0 && tipo !== 'custo') {
    tipo = 'custo';
    analysis.impacto_fiscal.tipo = tipo;
    warnings.push('Impacto fiscal reclassificado como renúncia de receita: a proposta reduz ou isenta um tributo.');
  } else if (annualBi > 0 && spendingMeasure && !spendingCut && tipo !== 'custo') {
    tipo = 'custo';
    analysis.impacto_fiscal.tipo = tipo;
    warnings.push('Impacto fiscal reclassificado como custo: a proposta cria ou amplia benefício/programa.');
  } else if (annualBi > 0 && spendingMeasure && spendingCut && tipo !== 'economia') {
    tipo = 'economia';
    analysis.impacto_fiscal.tipo = tipo;
    warnings.push('Impacto fiscal reclassificado como economia: a proposta reduz ou encerra benefício/programa.');
  }

  const noteContradictsType = (tipo === 'economia' && /custo|despesa|gasto adicional/.test(nota))
    || (tipo === 'custo' && /arrecada|receita adicional|aumenta a receita/.test(nota));
  const noteAmountMatch = nota.match(/R\$\s*([\d.,]+)\s*(tri(?:lh[õo]es?)?|bi(?:lh[õo]es?)?|mi(?:lh[õo]es?)?)/i);
  let noteAmountBi: number | null = null;
  if (noteAmountMatch) {
    const amount = Number(noteAmountMatch[1].replace(/\./g, '').replace(',', '.'));
    const unit = noteAmountMatch[2].toLowerCase();
    if (Number.isFinite(amount)) noteAmountBi = unit.startsWith('tri') ? amount * 1000 : unit.startsWith('mi') ? amount / 1000 : amount;
  }
  const noteAmountDiffers = noteAmountBi !== null && Math.abs(noteAmountBi - annualBi) > Math.max(1, annualBi * 0.1);
  if ((noteContradictsType || noteAmountDiffers) && annualBi > 0) {
    analysis.impacto_fiscal.nota = tipo === 'economia'
      ? taxMeasure && !taxRelief
        ? `Arrecadação estimada de R$ ${annualBi} bilhões por ano.`
        : `Economia de gastos estimada em R$ ${annualBi} bilhões por ano.`
      : `Custo estimado de R$ ${annualBi} bilhões por ano.`;
  }

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

export function inferFinancialCategory(text: string): NewPolicyIndicator['categoria'] | null {
  const t = normalizeText(text);
  if (/desempreg|contrat.{0,24}trabalh|encargo trabalhista|incentivo fiscal/.test(t)) return 'economia';
  if (/energia|eletric|renovavel|solar|eolic|emiss|carbono|clima|desmat|ambient/.test(t)) return 'energia';
  if (/saude|sus|hospital|medic|vacina|doenca|leito/.test(t)) return 'saude';
  if (/escol|alun|professor|educa|estud|creche/.test(t)) return 'educacao';
  if (/polic|crime|prisao|seguranca|violencia/.test(t)) return 'seguranca';
  if (/famil|benef|renda|pobre|moradia|habitac|assistencia|social/.test(t)) return 'social';
  if (/cultur|museu|arte|patrimonio|cinema|teatro/.test(t)) return 'cultura';
  if (/fiscal|empresa|empreg|desempreg|contrat|encargo|reembols|tribut|impost|arrecad|orcamento|gasto|despesa/.test(t)) return 'economia';
  return null;
}

export function ensureFinancialControlCard(analysis: AIInterpretation, proposal: string): void {
  if (analysis.novosIndicadores?.some((indicator) =>
    indicator.tipo === 'slider' && indicator.fiscalAnnual &&
    (indicator.valorProposto ?? indicator.valorInicial) !== indicator.valorInicial,
  )) return;

  const normalized = normalizeText(proposal);
  const annualBi = Math.max(0, analysis.impacto_fiscal.valor_anual_bi ?? 0);
  const isTaxMeasure = analysis.tipo_medida === 'imposto' || /impost|tribut|aliquota|arrecad/.test(normalized);
  const isBudgetMeasure = /programa|orcamento|verba|gasto|despesa|receita|investimento|beneficio|subsidio|transferencia/.test(normalized);
  const isSavingsMeasure = /economia|reduz.{0,50}gastos?|reduz.{0,50}despesas?|redundant|desperdicio|duplicad|duplicidade/.test(normalized);
  const hasFinancialIntent = isTaxMeasure || isBudgetMeasure;
  if (!hasFinancialIntent) return;

  const explicitRate = normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const rate = explicitRate ? Number(explicitRate[1].replace(',', '.')) : null;
  const useRateControl = isTaxMeasure && rate !== null && rate > 0 && rate <= 100;
  const amount = useRateControl ? rate! : annualBi;
  const unit = useRateControl ? '%' : 'R$ bi/ano';
  const fiscalSign = isSavingsMeasure || analysis.impacto_fiscal.tipo === 'economia' ? 1
    : analysis.impacto_fiscal.tipo === 'custo' ? -1
      : isBudgetMeasure ? -1 : 0;
  const categoria = inferFinancialCategory(proposal) ?? 'economia';
  const name = useRateControl
    ? `Alíquota — ${analysis.titulo || 'novo tributo'}`
    : isTaxMeasure ? `Arrecadação — ${analysis.titulo || 'novo tributo'}`
      : isSavingsMeasure ? `Economia — ${analysis.titulo || 'redução de gastos'}`
        : `Orçamento — ${analysis.titulo || 'programa'}`;
  const slider: NewPolicyIndicator = {
    id: `controle_fiscal_${Math.random().toString(36).slice(2, 9)}`,
    nome: name.slice(0, 80),
    curto: useRateControl ? 'Alíquota do imposto' : isTaxMeasure ? 'Arrecadação' : isSavingsMeasure ? 'Economia orçamentária' : 'Orçamento',
    categoria,
    tipo: 'slider',
    unidade: unit,
    valorInicial: 0,
    valorProposto: amount,
    minimo: 0,
    maximo: useRateControl ? Math.max(10, Math.ceil(amount * 2)) : Math.max(10, Math.ceil(amount * 2)),
    passo: useRateControl ? 0.5 : amount < 1 ? 0.01 : 1,
    delta: amount,
    fiscalAnnual: useRateControl && rate
      ? (annualBi > 0 ? fiscalSign * (annualBi * 1e9) / rate : 0)
      : fiscalSign * 1e9,
    affects: {},
    affectScale: 1,
    descricao: useRateControl
      ? 'Alíquota tributária ajustável; arrecadação conforme a base estimada.'
      : isTaxMeasure
        ? 'Arrecadação anual estimada do tributo; ajuste o valor fiscal.'
        : isSavingsMeasure
          ? 'Economia anual estimada; ajuste o valor conforme a implementação.'
          : 'Orçamento anual ajustável para financiar a medida.',
  };
  analysis.novosIndicadores = [...(analysis.novosIndicadores ?? []), slider];
}

/** A broad spending cut improves the budget, but can reduce public investment. */
function enforceBudgetCutTradeoff(analysis: AIInterpretation, proposal: string): void {
  const text = normalizeText(`${proposal} ${analysis.titulo ?? ''}`);
  if (isEfficiencySavingProposal(text)) {
    if ((analysis.impacto_fiscal.valor_anual_bi ?? 0) > 0) analysis.impacto_fiscal.tipo = 'economia';
    return;
  }
  if (/sem\s+(?:cortar|reduzir|cortes?)\b/.test(text)) return;
  if (!/\b(corte|cortar|corta|reduzir|reducao|diminuir|enxugar)\b/.test(text) ||
      !/\b(gasto|gastos|despesa|despesas|orcamento)\b/.test(text)) return;

  const card = analysis.novosIndicadores?.find((indicator) => indicator.tipo === 'slider');
  if (card) {
    // Positive fiscalAnnual represents savings from a cut. The turn engine
    // routes this to lower expenses, not higher tax receipts.
    card.fiscalAnnual = Math.abs(card.fiscalAnnual ?? 1e9);
    card.nome = `Economia — ${analysis.titulo || 'Corte de gastos públicos'}`.slice(0, 80);
    card.curto = 'Economia orçamentária';
    card.descricao = 'Redução anual de despesas; cortes amplos também podem reduzir investimentos públicos.';
    card.affects = { ...(card.affects ?? {}), investimento_publico: -0.08e9 };
  }

  analysis.impacto_fiscal.tipo = 'economia';
  analysis.grupos = { ...(analysis.grupos ?? {}), servidores_publicos: Math.min(-3, analysis.grupos?.servidores_publicos ?? -3) };
}

function isEfficiencySavingProposal(normalizedText: string): boolean {
  return /eficiencia|redundant|redundanc|desperdicio|duplicad|duplicidade|eliminacao de duplic|integrar sistemas|servicos compartilhados/.test(normalizedText);
}

function enforceGroupTradeoffs(
  input: Record<string, number>,
  proposal: string,
  fiscalMagnitude: unknown,
  warnings: string[],
): Record<string, number> {
  const groups = { ...input };
  const text = normalizeText(proposal);

  if (!isEfficiencySavingProposal(text) && !/sem\s+(?:cortar|reduzir|cortes?)\b/.test(text) &&
      /\b(corte|cortar|corta|reduzir|reducao|diminuir|enxugar)\b/.test(text) &&
      /\b(gasto|gastos|despesa|despesas|orcamento)\b/.test(text)) {
    groups.servidores_publicos = Math.min(-3, groups.servidores_publicos ?? -3);
  }
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
