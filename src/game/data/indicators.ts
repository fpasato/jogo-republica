import type { Indicator, IndicatorId } from '../types/game';

export const INDICATORS: Record<IndicatorId, Indicator> = {
  // ── Economia ───────────────────────────────────────────
  inflacao: {
    id: 'inflacao', name: 'Inflação', unit: '%',
    min: -5, max: 40, defaultValue: 4.5,
    category: 'economia', direction: -1,
    description: 'Variação anual de preços.',
  },
  desemprego: {
    id: 'desemprego', name: 'Desemprego', unit: '%',
    min: 0, max: 30, defaultValue: 8,
    category: 'economia', direction: -1,
    description: 'Taxa de desocupação.',
  },
  crescimentoPib: {
    id: 'crescimentoPib', name: 'Crescimento do PIB', unit: '%',
    min: -8, max: 12, defaultValue: 2,
    category: 'economia', direction: 1,
    description: 'Variação anual do PIB.',
  },
  dolar: {
    id: 'dolar', name: 'Cotação do dólar', unit: 'R$',
    min: 1, max: 15, defaultValue: 5,
    category: 'economia', direction: 0,
    description: 'Preço do dólar em reais.',
  },
  poderCompra: {
    id: 'poderCompra', name: 'Poder de compra', unit: '0–100',
    min: 0, max: 100, defaultValue: 65,
    category: 'economia', direction: 1,
    description: 'Capacidade de consumo da população.',
  },
  emprego: {
    id: 'emprego', name: 'Emprego', unit: '0–100',
    min: 0, max: 100, defaultValue: 65,
    category: 'economia', direction: 1,
    description: 'Índice agregado de emprego.',
  },

  // ── Finanças públicas ──────────────────────────────────
  receitaPublica: {
    id: 'receitaPublica', name: 'Receita pública', unit: 'R$ bi/ano',
    min: 0, max: 3000, defaultValue: 1250,
    category: 'financas', direction: 1,
    description: 'Arrecadação total do governo.',
  },
  despesaPublica: {
    id: 'despesaPublica', name: 'Despesa pública', unit: 'R$ bi/ano',
    min: 0, max: 3000, defaultValue: 1200,
    category: 'financas', direction: -1,
    description: 'Gasto total do governo.',
  },
  saldoOrcamentario: {
    id: 'saldoOrcamentario', name: 'Saldo orçamentário', unit: 'R$ bi/ano',
    min: -2000, max: 2000, defaultValue: 50,
    category: 'financas', direction: 1,
    description: 'Receita − despesa.',
  },
  dividaPublica: {
    id: 'dividaPublica', name: 'Dívida pública', unit: 'R$ bi',
    min: 0, max: 30000, defaultValue: 3600,
    category: 'financas', direction: -1,
    description: 'Estoque total da dívida.',
  },
  resultadoFiscal: {
    id: 'resultadoFiscal', name: 'Resultado fiscal', unit: '% do PIB',
    min: -40, max: 30, defaultValue: 1,
    category: 'financas', direction: 1,
    description: 'Saldo primário como % do PIB.',
  },

  // ── Segurança ──────────────────────────────────────────
  criminalidade: {
    id: 'criminalidade', name: 'Criminalidade', unit: '0–100',
    min: 0, max: 100, defaultValue: 60,
    category: 'seguranca', direction: -1,
    description: 'Índice agregado de crimes.',
  },

  // ── Saúde ──────────────────────────────────────────────
  acessoSaude: {
    id: 'acessoSaude', name: 'Acesso à saúde', unit: '0–100',
    min: 0, max: 100, defaultValue: 60,
    category: 'saude', direction: 1,
    description: 'Facilidade de acesso aos serviços.',
  },
  qualidadeSaude: {
    id: 'qualidadeSaude', name: 'Qualidade do atendimento', unit: '0–100',
    min: 0, max: 100, defaultValue: 55,
    category: 'saude', direction: 1,
    description: 'Qualidade percebida e efetiva.',
  },

  // ── Educação ───────────────────────────────────────────
  acessoEducacao: {
    id: 'acessoEducacao', name: 'Acesso à educação', unit: '0–100',
    min: 0, max: 100, defaultValue: 70,
    category: 'educacao', direction: 1,
    description: 'Cobertura do sistema educacional.',
  },
  qualidadeEducacao: {
    id: 'qualidadeEducacao', name: 'Qualidade do ensino', unit: '0–100',
    min: 0, max: 100, defaultValue: 50,
    category: 'educacao', direction: 1,
    description: 'Aprendizado efetivo.',
  },

  // ── Saneamento ─────────────────────────────────────────
  aguaTratada: {
    id: 'aguaTratada', name: 'Acesso à água tratada', unit: '%',
    min: 0, max: 100, defaultValue: 85,
    category: 'saneamento', direction: 1,
    description: '% da população com água tratada.',
  },
  coletaEsgoto: {
    id: 'coletaEsgoto', name: 'Coleta de esgoto', unit: '%',
    min: 0, max: 100, defaultValue: 60,
    category: 'saneamento', direction: 1,
    description: '% da população com coleta.',
  },
  tratamentoEsgoto: {
    id: 'tratamentoEsgoto', name: 'Tratamento de esgoto', unit: '%',
    min: 0, max: 100, defaultValue: 45,
    category: 'saneamento', direction: 1,
    description: '% do esgoto coletado tratado.',
  },

  // ── Popularidade ───────────────────────────────────────
  aprovacao: {
    id: 'aprovacao', name: 'Aprovação do governo', unit: '%',
    min: 0, max: 100, defaultValue: 50,
    category: 'popularidade', direction: 1,
    description: 'Aprovação agregada (calculada).',
  },

  // ── Sociais ────────────────────────────────────────────
  idh: {
    id: 'idh', name: 'IDH simulado', unit: '0–1',
    min: 0, max: 1, defaultValue: 0.75,
    category: 'social', direction: 1,
    description: 'Índice de desenvolvimento humano.',
  },
  gini: {
    id: 'gini', name: 'Desigualdade (Gini)', unit: '0–1',
    min: 0, max: 1, defaultValue: 0.52,
    category: 'social', direction: -1,
    description: 'Quanto maior, mais desigual.',
  },
  confiancaInstituicoes: {
    id: 'confiancaInstituicoes', name: 'Confiança nas instituições', unit: '0–100',
    min: 0, max: 100, defaultValue: 40,
    category: 'social', direction: 1,
    description: 'Confiança em instituições públicas.',
  },
};

export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[];

/** Agrupamento por categoria para UI */
export const INDICATORS_BY_CATEGORY = INDICATOR_IDS.reduce(
  (acc, id) => {
    const cat = INDICATORS[id].category;
    (acc[cat] ??= []).push(id);
    return acc;
  },
  {} as Record<string, IndicatorId[]>,
);
