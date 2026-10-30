import type { IndicatorDef, IndicatorCategory } from '../game/data/indicators';

export type Tom = 'good' | 'bad' | 'neutral';

export const AREA_TITULO: Record<IndicatorCategory, string> = {
  economia: 'Economia e finanças públicas',
  saude: 'Saúde',
  educacao: 'Educação',
  social: 'Social',
  seguranca: 'Segurança pública',
  energia: 'Energia',
  cultura: 'Cultura',
};

export const AREAS_NO_PAINEL: IndicatorCategory[] = [
  'economia',
  'saude',
  'educacao',
  'social',
  'seguranca',
  'energia',
  'cultura',
];

export function numero(v: number, casas: number): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Formata valor monetário grande abreviando (tri / bi / mi). */
function moedaGrande(abs: number, sinal = ''): string {
  if (abs >= 1e12) return `${sinal}R$ ${numero(abs / 1e12, 2)} tri`;
  if (abs >= 1e9) return `${sinal}R$ ${numero(abs / 1e9, 1)} bi`;
  if (abs >= 1e6) return `${sinal}R$ ${numero(abs / 1e6, 0)} mi`;
  return `${sinal}R$ ${numero(abs, 0)}`;
}

/** Detecta se a unidade indica valor monetário (ex: 'R$', 'R$/hab/ano'). */
function unidadeMonetaria(unidade: string | undefined): { eh: boolean; sufixo: string } {
  const u = unidade ?? '';
  if (!/R\$/.test(u)) return { eh: false, sufixo: '' };
  const sufixo = u.replace(/^R\$\s*/, '').trim();
  return { eh: true, sufixo };
}

export function formatarValorIndicador(def: IndicatorDef, valor: number | undefined): string {
  if (valor === undefined || !Number.isFinite(valor)) return '—';

  switch (def.formatKind) {
    case 'percent':
      return `${numero(valor, 1)}%`;
    case 'currency_month':
      return `R$ ${numero(valor, 0)}/mês`;
    case 'currency_year': {
      const sign = valor < 0 ? '−' : '';
      return moedaGrande(Math.abs(valor), sign);
    }
    case 'currency_unit':
      return `R$ ${numero(valor, 2)}`;
    case 'score':
      return `${numero(valor, 0)} pts`;
    case 'days':
      return `${numero(valor, 0)} dias`;
    case 'per_thousand':
      return `${numero(valor, 1)} /1.000`;
    case 'per_hundred_thousand':
      return `${numero(valor, 1)} /100 mil hab.`;
    case 'count':
      return `${numero(valor, 0)}`;
    default: {
      const { eh, sufixo } = unidadeMonetaria(def.unidade);
      if (eh) {
        const sign = valor < 0 ? '−' : '';
        const formatted = moedaGrande(Math.abs(valor), sign);
        return sufixo ? `${formatted}${sufixo}` : formatted;
      }
      return `${numero(valor, 1)} ${def.unidade ?? ''}`.trim();
    }
  }
}

export function formatarDeltaIndicador(def: IndicatorDef, delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return '—';
  if (Math.abs(delta) < 0.001) return 'estável';

  const sinal = delta > 0 ? '+' : '−';
  const abs = Math.abs(delta);

  switch (def.formatKind) {
    case 'percent':
      if (abs < 0.05) return 'estável';
      return `${sinal}${numero(abs, 1)} p.p.`;
    case 'currency_year':
      return moedaGrande(abs, sinal);
    case 'currency_month':
      return `${sinal}R$ ${numero(abs, 0)}`;
    case 'currency_unit':
      return `${sinal}R$ ${numero(abs, 2)}`;
    case 'score':
      return `${sinal}${numero(abs, 1)} pts`;
    default: {
      const { eh, sufixo } = unidadeMonetaria(def.unidade);
      if (eh) {
        const formatted = moedaGrande(abs, sinal);
        return sufixo ? `${formatted}${sufixo}` : formatted;
      }
      return `${sinal}${numero(abs, 1)} ${def.unidade ?? ''}`.trim();
    }
  }
}

export function tomDaVariacao(def: IndicatorDef, delta: number | null): Tom {
  if (delta === null || Math.abs(delta) < 0.001 || def.direction === 'neutral') {
    return 'neutral';
  }
  const melhorou = def.direction === 'higher_is_better' ? delta > 0 : delta < 0;
  return melhorou ? 'good' : 'bad';
}