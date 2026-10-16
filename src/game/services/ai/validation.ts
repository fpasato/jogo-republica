import type { MeasureValidationResult, MeasureInterpretationRaw } from '../../types/ai';
import { SLIDER_IDS, SLIDERS } from '../../data/sliders';
import { INDICATOR_IDS } from '../../data/indicators';
import { INDICATORS } from '../../data/indicators';
import { GROUP_IDS } from '../../data/groups';
import { STATE_IDS, STATES } from '../../data/states';
import type { PolicyArea, PolicyType } from '../../types/policy';

const AREAS: PolicyArea[] = [
  'economia', 'saude', 'educacao', 'seguranca',
  'infraestrutura', 'social', 'meioAmbiente', 'gestao',
];
const TYPES: PolicyType[] = [
  'imposto', 'beneficio', 'corte', 'programa', 'investimento', 'regulacao',
];

const NUMBER_FIELDS = [
  'initialCost', 'recurringCost', 'savings', 'revenue', 'timeToEffect', 'confidence',
] as const;

/** Valida e normaliza a resposta bruta da IA */
export function validateMeasure(
  input: unknown,
  playerText?: string,
): MeasureValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['Resposta não é um objeto JSON'], warnings };
  }

  const raw = input as Record<string, unknown>;
  const out: Partial<MeasureInterpretationRaw> = {};
  const normalizedRequest = playerText?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const explicitlyMentionedStates = new Set(STATE_IDS.filter(id => {
    if (!normalizedRequest) return true;
    const name = STATES[id].name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normalizedRequest.includes(name) || new RegExp(`(^|[^a-z0-9])${id.toLowerCase()}([^a-z0-9]|$)`).test(normalizedRequest);
  }));

  // ── Strings obrigatórias ─────────────────────────────
  for (const field of ['name', 'description'] as const) {
    const v = raw[field];
    if (typeof v !== 'string' || !v.trim()) {
      errors.push(`Campo "${field}" ausente ou vazio`);
    } else {
      out[field] = v.trim();
    }
  }

  // ── Enums ────────────────────────────────────────────
  if (!AREAS.includes(raw.area as PolicyArea)) {
    errors.push(`Área inválida: ${String(raw.area)}. Use: ${AREAS.join(', ')}`);
  } else {
    out.area = raw.area as PolicyArea;
  }
  if (!TYPES.includes(raw.type as PolicyType)) {
    errors.push(`Tipo inválido: ${String(raw.type)}. Use: ${TYPES.join(', ')}`);
  } else {
    out.type = raw.type as PolicyType;
  }

  // ── Números ──────────────────────────────────────────
  for (const field of NUMBER_FIELDS) {
    const v = raw[field];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`Campo "${field}" deve ser número`);
    } else if (v < 0 && field !== 'confidence') {
      errors.push(`Campo "${field}" não pode ser negativo`);
    } else {
      (out as any)[field] = v;
    }
  }
  if (out.confidence != null && (out.confidence < 0 || out.confidence > 1)) {
    warnings.push(`confidence fora de [0,1]: ${out.confidence}`);
    out.confidence = Math.max(0, Math.min(1, out.confidence));
  }

  // ── indicatorEffects ─────────────────────────────────
  const effects = Array.isArray(raw.indicatorEffects) ? raw.indicatorEffects : [];
  out.indicatorEffects = [];
  const seenIndicators = new Set<string>();
  for (const e of effects) {
    if (typeof e !== 'object' || e === null) {
      warnings.push('indicatorEffects: item ignorado (não é objeto)');
      continue;
    }
    const ef = e as Record<string, unknown>;
    if (!INDICATOR_IDS.includes(ef.indicatorId as any)) {
      errors.push(`indicatorId inválido: ${String(ef.indicatorId)}`);
      continue;
    }
    if (seenIndicators.has(ef.indicatorId as string)) {
      errors.push(`Indicador repetido em indicatorEffects: ${String(ef.indicatorId)}`);
      continue;
    }
    seenIndicators.add(ef.indicatorId as string);
    if (typeof ef.target !== 'number' || !Number.isFinite(ef.target) || typeof ef.delayMonths !== 'number' || !Number.isFinite(ef.delayMonths) || typeof ef.rampMonths !== 'number' || !Number.isFinite(ef.rampMonths)) {
      errors.push(`Efeito de ${ef.indicatorId}: target, delayMonths e rampMonths devem ser números`);
      continue;
    }
    const definition = INDICATORS[ef.indicatorId as keyof typeof INDICATORS];
    const limit = definition.max - definition.min;
    const boundedTarget = Math.max(-limit, Math.min(limit, ef.target));
    if (boundedTarget !== ef.target) warnings.push(`Efeito de ${ef.indicatorId} limitado à faixa válida do indicador`);
    if (typeof ef.reason !== 'string' || !ef.reason.trim()) warnings.push(`Efeito de ${ef.indicatorId} sem justificativa`);
    out.indicatorEffects.push({
      indicatorId: ef.indicatorId as any,
      target: boundedTarget,
      delayMonths: Math.max(0, Math.floor(ef.delayMonths)),
      rampMonths: Math.max(1, Math.floor(ef.rampMonths)),
      reason: typeof ef.reason === 'string' ? ef.reason : '',
    });
  }

  // ── impactos estaduais diretos (opcional) ─────────────
  out.stateEffects = [];
  if (raw.stateEffects !== undefined && !Array.isArray(raw.stateEffects)) {
    errors.push('stateEffects deve ser uma lista de estados afetados diretamente');
  } else if (Array.isArray(raw.stateEffects)) {
    const seenStates = new Set<string>();
    for (const e of raw.stateEffects) {
      if (typeof e !== 'object' || e === null) continue;
      const ef = e as Record<string, unknown>;
      if (!STATE_IDS.includes(ef.stateId as any)) {
        errors.push(`stateId inválido: ${String(ef.stateId)}`);
        continue;
      }
      if (!explicitlyMentionedStates.has(ef.stateId as string)) {
        warnings.push(`Efeito estadual em ${ef.stateId} removido: o estado não foi especificado pelo jogador`);
        continue;
      }
      if (seenStates.has(ef.stateId as string)) {
        errors.push(`Estado repetido em stateEffects: ${String(ef.stateId)}`);
        continue;
      }
      seenStates.add(ef.stateId as string);
      if (typeof ef.target !== 'number' || !Number.isFinite(ef.target) || typeof ef.delayMonths !== 'number' || typeof ef.rampMonths !== 'number') {
        errors.push(`Efeito direto em ${ef.stateId}: target, delayMonths e rampMonths devem ser números`);
        continue;
      }
      out.stateEffects!.push({
        stateId: ef.stateId as string,
        target: Math.max(-100, Math.min(100, ef.target)),
        delayMonths: Math.max(0, Math.floor(ef.delayMonths)),
        rampMonths: Math.max(1, Math.floor(ef.rampMonths)),
        reason: typeof ef.reason === 'string' ? ef.reason : '',
      });
      if (Math.abs(ef.target) > 100) warnings.push(`Efeito estadual em ${ef.stateId} limitado a 100 pontos percentuais`);
      if (typeof ef.reason !== 'string' || !ef.reason.trim()) warnings.push(`Efeito estadual em ${ef.stateId} sem justificativa`);
    }
  }

  // ── groupReactions ───────────────────────────────────
  const reactions = Array.isArray(raw.groupReactions) ? raw.groupReactions : [];
  out.groupReactions = [];
  const seenGroups = new Set<string>();
  for (const r of reactions) {
    if (typeof r !== 'object' || r === null) continue;
    const rr = r as Record<string, unknown>;
    if (!GROUP_IDS.includes(rr.groupId as any)) {
      errors.push(`groupId inválido: ${String(rr.groupId)}`);
      continue;
    }
    if (seenGroups.has(rr.groupId as string)) {
      errors.push(`Grupo repetido em groupReactions: ${String(rr.groupId)}`);
      continue;
    }
    seenGroups.add(rr.groupId as string);
    if (typeof rr.intensity !== 'number') {
      errors.push(`Reação de ${rr.groupId}: intensity deve ser número`);
      continue;
    }
    out.groupReactions.push({
      groupId: rr.groupId as any,
      intensity: Math.max(-1, Math.min(1, rr.intensity)),
      reason: typeof rr.reason === 'string' ? rr.reason : '',
    });
    if (typeof rr.reason !== 'string' || !rr.reason.trim()) warnings.push(`Reação de ${rr.groupId} sem justificativa`);
  }
  if (out.groupReactions.length === 0) {
    errors.push('groupReactions deve indicar ao menos um grupo diretamente afetado');
  }

  // ── sliderChanges (opcional) ─────────────────────────
  if (Array.isArray(raw.sliderChanges) && raw.sliderChanges.length > 0) {
    out.sliderChanges = [];
    const seenSliders = new Set<string>();
    for (const s of raw.sliderChanges) {
      if (typeof s !== 'object' || s === null) continue;
      const ss = s as Record<string, unknown>;
      if (!SLIDER_IDS.includes(ss.sliderId as any)) {
        errors.push(`sliderId inválido: ${String(ss.sliderId)}`);
        continue;
      }
      if (seenSliders.has(ss.sliderId as string)) {
        errors.push(`Slider repetido em sliderChanges: ${String(ss.sliderId)}`);
        continue;
      }
      seenSliders.add(ss.sliderId as string);
      if (typeof ss.newValue !== 'number' || !Number.isFinite(ss.newValue)) {
        errors.push(`sliderChanges[${ss.sliderId}]: newValue deve ser número`);
        continue;
      }
      const slider = SLIDERS[ss.sliderId as keyof typeof SLIDERS];
      const boundedValue = Math.max(slider.min, Math.min(slider.max, ss.newValue));
      if (boundedValue !== ss.newValue) warnings.push(`Valor de ${ss.sliderId} limitado à faixa do controle`);
      out.sliderChanges!.push({
        sliderId: ss.sliderId as any,
        newValue: boundedValue,
        reason: typeof ss.reason === 'string' ? ss.reason : '',
      });
    }
  }

  // ── parameters (opcional) ────────────────────────────
  if (Array.isArray(raw.parameters) && raw.parameters.length > 0) {
    out.parameters = [];
    for (const p of raw.parameters) {
      if (typeof p !== 'object' || p === null) continue;
      const pp = p as Record<string, unknown>;
      if (typeof pp.key !== 'string' || typeof pp.label !== 'string') continue;
      if (typeof pp.value !== 'number' || !Number.isFinite(pp.value)) {
        errors.push(`Parâmetro ${pp.label}: value deve ser um número finito`);
        continue;
      }
      if (typeof pp.unit !== 'string' || !pp.unit.trim()) {
        errors.push(`Parâmetro ${pp.label}: unit é obrigatório`);
        continue;
      }
      out.parameters.push({
        key: pp.key,
        label: pp.label,
        value: pp.value,
        unit: pp.unit,
      });
    }
  }

  // ── duration ─────────────────────────────────────────
  if (raw.duration === 'permanente') {
    out.duration = 'permanente';
  } else if (typeof raw.duration === 'number' && raw.duration > 0) {
    out.duration = Math.floor(raw.duration);
  } else {
    errors.push('duration deve ser "permanente" ou número de meses > 0');
  }

  // ── position (opcional) ─────────────────────────────
  if (raw.position !== undefined) {
    if (typeof raw.position !== 'number' || Number.isNaN(raw.position)) {
      warnings.push('position inválida, será ignorada');
    } else if (raw.position < -3 || raw.position > 3) {
      warnings.push(`position fora de [-3,3]: ${raw.position}, será clampada`);
      out.position = Math.max(-3, Math.min(3, raw.position));
    } else {
      out.position = raw.position;
    }
  }
  // ── Regra de negócio ─────────────────────────────────
  const hasEffects = (out.indicatorEffects?.length ?? 0) > 0;
  const hasSliderChange = (out.sliderChanges?.length ?? 0) > 0;
  if (!hasEffects && !hasSliderChange) {
    errors.push('A medida precisa afetar pelo menos 1 indicador OU alterar 1 slider');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? (out as MeasureInterpretationRaw) : undefined,
  };
}
