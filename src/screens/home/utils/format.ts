// ===========================================================================
// src/screens/home/utils/format.ts
// Helpers de UI: formatação pt-BR, tom da variação, BRL.
// Agregação de estados vive no motor (aggregateAll em services/engine/aggregation).
// ===========================================================================

import type { IndicatorDef, IndicatorCategory } from '../../game/data/indicators';

// ============================================================
// TOM
// ============================================================

export type Tom = 'good' | 'bad' | 'neutral';

// ============================================================
// ÁREAS
// ============================================================

export const AREA_TITULO: Record<IndicatorCategory, string> = {
  economia: 'Economia',
  saude: 'Saúde',
  educacao: 'Educação',
  seguranca: 'Segurança pública',
  infraestrutura: 'Infraestrutura e saneamento',
  social: 'Assistência social',
  ambiente: 'Meio ambiente e energia',
  gestao: 'Gestão pública',
  politica: 'Política',
};

/** Áreas exibidas no painel principal. "politica" fica fora: vem de outro lugar. */
export const AREAS_NO_PAINEL: IndicatorCategory[] = [
  'economia',
  'saude',
  'educacao',
  'seguranca',
  'infraestrutura',
  'social',
  'ambiente',
  'gestao',
];

// ============================================================
// NÚMEROS
// ============================================================

export function numero(v: number, casas: number): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function casasDecimais(def: IndicatorDef, v: number): number {
  if (def.max - def.min <= 1) return 2;
  const a = Math.abs(v);
  if (a >= 100) return 0;
  if (a >= 10) return 1;
  return 2;
}

export function formatarValor(def: IndicatorDef, v: number): string {
  if (!Number.isFinite(v)) return '—';
  const n = numero(v, casasDecimais(def, v));
  const u = def.unit;

  if (u.startsWith('%')) return `${n}%`;
  if (u.startsWith('R$ bilhões')) return `R$ ${n} bi`;
  if (u.startsWith('R$')) return `R$ ${n}`;
  if (u === '0–100') return n;
  return `${n} ${u}`;
}

/** "▲ 0,12" / "▼ 1,5" / "—". */
export function formatarDelta(delta: number, valorRef: number, unidade?: string): string {
  const casas = Math.abs(valorRef) >= 100 ? 1 : 2;
  if (Number(delta.toFixed(casas)) === 0) return '—';
  const sufixo = unidade?.startsWith('%') ? ' p.p.' : '';
  return `${delta > 0 ? '▲' : '▼'} ${numero(Math.abs(delta), casas)}${sufixo}`;
}

/** Subir é bom ou ruim? Depende da direção do indicador. */
export function tomDaVariacao(
  direction: 'higher_is_better' | 'lower_is_better' | 'neutral',
  delta: number,
): Tom {
  if (delta === 0 || direction === 'neutral') return 'neutral';
  const subiu = delta > 0;
  const bom = direction === 'higher_is_better' ? subiu : !subiu;
  return bom ? 'good' : 'bad';
}

// ============================================================
// BRL
// ============================================================

export function formatBRL(v: number, options?: { sinal?: boolean }): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);

  let unit = '';
  let divisor = 1;
  if (abs >= 1e12) { unit = ' tri'; divisor = 1e12; }
  else if (abs >= 1e9) { unit = ' bi'; divisor = 1e9; }
  else if (abs >= 1e6) { unit = ' mi'; divisor = 1e6; }
  else if (abs >= 1e3) { unit = ' mil'; divisor = 1e3; }

  const scaled = abs / divisor;
  const n = scaled.toLocaleString('pt-BR', {
    minimumFractionDigits: scaled >= 100 ? 0 : 1,
    maximumFractionDigits: scaled >= 100 ? 0 : 1,
  });

  const sinal = options?.sinal && v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sinal}R$ ${n}${unit}`;
}

// ============================================================
// CLASSIFICAÇÃO QUALITATIVA → TOM
// ============================================================

/**
 * Converte o rótulo gerado por `classifyById` num tom.
 * Útil pra colorir badges na UI sem recalcular faixas.
 */
export function tomDaClassificacao(label: string): Tom {
  const l = label.toLowerCase();
  if (l.startsWith('muito bom') || l === 'bom' || l === 'alto') return 'good';
  if (l.startsWith('muito ruim') || l === 'ruim' || l === 'baixo') return 'bad';
  return 'neutral';
}