export interface IndicatorChain {
  from: string;
  to: string;
  factor: number;
  threshold: number;
}

export const INDICATOR_CHAINS: IndicatorChain[] = [
  // ---------- Salário mínimo ----------
  { from: 'salario_minimo', to: 'pobreza',         factor: -0.003,  threshold: 10 },
  { from: 'salario_minimo', to: 'pobreza_extrema', factor: -0.002,  threshold: 10 },
  { from: 'salario_minimo', to: 'poder_compra',    factor:  0.04,   threshold: 10 },
  { from: 'salario_minimo', to: 'informalidade',   factor:  0.0008, threshold: 20 },
  { from: 'salario_minimo', to: 'inflacao',        factor:  0.0012, threshold: 30 },
  { from: 'salario_minimo', to: 'desemprego',      factor:  0.0015, threshold: 30 },
  { from: 'salario_minimo', to: 'renda_media',     factor:  0.4,    threshold: 10 },

  // ---------- Desemprego ----------
  { from: 'desemprego', to: 'pobreza',          factor:  0.5,  threshold: 0.1 },
  { from: 'desemprego', to: 'renda_media',      factor: -25,   threshold: 0.1 },
  { from: 'desemprego', to: 'informalidade',    factor:  0.3,  threshold: 0.1 },
  { from: 'desemprego', to: 'desemprego_jovem', factor:  1.4,  threshold: 0.1 },

  // ---------- Inflação ----------
  { from: 'inflacao', to: 'poder_compra', factor: -1.2,  threshold: 0.2 },
  { from: 'inflacao', to: 'pobreza',      factor:  0.12, threshold: 0.2 },
  { from: 'inflacao', to: 'renda_media',  factor: 10,    threshold: 0.2 },

  // ---------- Renda média ----------
  { from: 'renda_media', to: 'pobreza',      factor: -0.008,  threshold: 15 },
  { from: 'renda_media', to: 'poder_compra', factor:  0.0025, threshold: 15 },
  { from: 'renda_media', to: 'gini',         factor: -0.000004, threshold: 50 },

  // ---------- Crescimento ----------
  { from: 'crescimento_pib', to: 'desemprego',       factor: -0.15,  threshold: 0.3 },
  { from: 'crescimento_pib', to: 'renda_media',      factor: 40,     threshold: 0.3 },
  { from: 'crescimento_pib', to: 'empregos_formais', factor: 80000,  threshold: 0.3 },
  { from: 'crescimento_pib', to: 'investimentos_privados', factor: 15, threshold: 0.3 },

  // ---------- Segurança ----------
  { from: 'homicidios', to: 'percepcao_seguranca', factor: -0.4,    threshold: 0.5 },

  // ---------- Educação ----------
  { from: 'alfabetizacao',         to: 'renda_media', factor: 12,   threshold: 0.3 },
  { from: 'conclusao_medio',       to: 'renda_media', factor: 8,    threshold: 0.3 },


  // ---------- Saúde ----------
  { from: 'acesso_saude',        to: 'mortalidade_infantil', factor: -0.3,    threshold: 1 },
  { from: 'cobertura_vacinacao', to: 'mortalidade_infantil', factor: -0.15,   threshold: 1 },


  // ---------- Saneamento ----------
  { from: 'acesso_agua',     to: 'mortalidade_infantil', factor: -0.15, threshold: 1 },
  { from: 'coleta_esgoto',   to: 'mortalidade_infantil', factor: -0.12, threshold: 1 },

  // ---------- Gini (desigualdade) ----------
  { from: 'gini', to: 'pobreza', factor: 25,     threshold: 0.005 },

];