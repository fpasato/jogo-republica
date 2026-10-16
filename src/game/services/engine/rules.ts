import type {
  GameState,
  IndicatorId,
  SliderId,
} from '../../types/game';
import { INDICATORS } from '../../data/indicators';

/** PIB base em R$ bilhões (para derivar receitas e déficits) */
export const PIB_BASE = 5000;

/** Envelope de gastos = soma dos investimentos específicos (referência de coerência) */
const INVESTMENT_SLIDERS: SliderId[] = [
  'investimentosPublicos',
  'beneficiosSociais',
  'policiamento',
  'sistemaPrisional',
  'saude',
  'educacao',
  'salariosServidores',
];

/** Clamp helper */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Aproxima `current` em direção a `target` a uma taxa (0-1) */
function approach(current: number, target: number, rate: number): number {
  return current + (target - current) * rate;
}

// ─────────────────────────────────────────────────────────
// 1. FINANÇAS PÚBLICAS
// ─────────────────────────────────────────────────────────

export function computeFinances(state: GameState): Partial<Record<IndicatorId, number>> {
  const { sliders, activePolicies } = state;

  // Receita: impostos% × PIB + receitas de políticas ativas
  const policyRevenue = activePolicies
    .filter(p => p.status === 'active')
    .reduce((sum, p) => sum + (p.revenue ?? 0), 0);
  const receita = (sliders.impostos / 100) * PIB_BASE + policyRevenue;

  // Despesa: envelope + custos recorrentes externos (políticas)
  const policyRecurring = activePolicies
    .filter(p => p.status === 'active')
    .reduce((sum, p) => sum + (p.recurringCost ?? 0), 0);

  const investmentsSum = INVESTMENT_SLIDERS.reduce((s, id) => s + sliders[id], 0);
  const overshoot = Math.max(0, investmentsSum - sliders.gastosPublicos);

  const despesa = sliders.gastosPublicos + policyRecurring + overshoot;

  const saldo = receita - despesa;
  const resultadoFiscal = (saldo / PIB_BASE) * 100;

  // Dívida cresce com déficit (financiamento) e juros (Selic sobre a dívida)
  const prevDivida = state.indicators.dividaPublica;
  const juros = prevDivida * (sliders.selic / 100) / 12; // Selic anual convertida para o turno mensal
  const divida = Math.max(0, prevDivida + (-saldo) + juros);

  return {
    receitaPublica: receita,
    despesaPublica: despesa,
    saldoOrcamentario: saldo,
    dividaPublica: divida,
    resultadoFiscal,
  };
}

// ─────────────────────────────────────────────────────────
// 2. ECONOMIA
// ─────────────────────────────────────────────────────────

export function computeEconomy(
  state: GameState,
  finances: Partial<Record<IndicatorId, number>>,
): Partial<Record<IndicatorId, number>> {
  const { sliders, indicators } = state;

  const resultadoFiscal = finances.resultadoFiscal ?? indicators.resultadoFiscal;

  // Inflação: puxada por gastos, impostos, dólar, Selic (contração)
  const inflacaoAlvo =
    -4 +
    (sliders.gastosPublicos / PIB_BASE) * 6 +
    (sliders.impostos / 100) * 8 +
    Math.max(0, (indicators.dolar - 5)) * 0.4 -
    (sliders.selic - 8) * 0.35 +
    3; // base estrutural
  const inflacao = approach(indicators.inflacao, clamp(inflacaoAlvo, -2, 30), 0.15);

  // Dólar: Selic alta → atrai capital → dólar cai. Risco fiscal → dólar sobe
  const dolarAlvo =
    5 +
    -(sliders.selic - 10) * 0.15 +
    -resultadoFiscal * 0.15 +
    -(indicators.confiancaInstituicoes - 40) * 0.02;
  const dolar = approach(indicators.dolar, clamp(dolarAlvo, 2, 12), 0.12);

  // Crescimento do PIB: investimento público + privado -, juros -, impostos -
  const crescimentoAlvo =
    -1 +
    (sliders.investimentosPublicos / PIB_BASE) * 20 +
    (sliders.investimentosPublicos > 20 ? 1 : 0) -
    (sliders.selic - 10) * 0.15 -
    (sliders.impostos - 25) * 0.08 -
    (sliders.tarifasImportacao - 15) * 0.04;
  const crescimentoPib = approach(indicators.crescimentoPib, clamp(crescimentoAlvo, -6, 8), 0.1);

  // Desemprego: cai com crescimento, sobe com Selic alta
  const desempregoAlvo =
    8 -
    crescimentoPib * 0.6 +
    (sliders.selic - 10) * 0.15 +
    Math.max(0, (sliders.salarioMinimo - 1800) / 500) * 0.3;
  const desemprego = approach(indicators.desemprego, clamp(desempregoAlvo, 2, 25), 0.1);

  // Poder de compra: salário mínimo vs inflação
  const poderCompraAlvo =
    60 +
    (sliders.salarioMinimo - 1800) / 40 +
    (sliders.beneficiosSociais / 60) * 5 -
    (inflacao - 4) * 2;
  const poderCompra = approach(indicators.poderCompra, clamp(poderCompraAlvo, 0, 100), 0.1);

  const emprego = clamp(100 - desemprego * 2.5, 0, 100);

  return {
    inflacao,
    dolar,
    crescimentoPib,
    desemprego,
    poderCompra,
    emprego,
  };
}

// ─────────────────────────────────────────────────────────
// 3. SAÚDE / EDUCAÇÃO / SEGURANÇA / SANEAMENTO
// ─────────────────────────────────────────────────────────

export function computeSaude(state: GameState): Partial<Record<IndicatorId, number>> {
  const { sliders, indicators } = state;
  const invest = sliders.saude / 500; // orçamento anual máximo de saúde

  const acessoAlvo = 40 + invest * 55;
  const qualidadeAlvo = 35 + invest * 55 + (indicators.acessoSaude - 60) * 0.2;

  return {
    acessoSaude: approach(indicators.acessoSaude, clamp(acessoAlvo, 0, 100), 0.08),
    qualidadeSaude: approach(indicators.qualidadeSaude, clamp(qualidadeAlvo, 0, 100), 0.07),
  };
}

export function computeEducacao(state: GameState): Partial<Record<IndicatorId, number>> {
  const { sliders, indicators } = state;
  const invest = sliders.educacao / 400;

  const acessoAlvo = 55 + invest * 40;
  const qualidadeAlvo = 30 + invest * 60 + (indicators.acessoEducacao - 70) * 0.2;

  return {
    acessoEducacao: approach(indicators.acessoEducacao, clamp(acessoAlvo, 0, 100), 0.07),
    qualidadeEducacao: approach(indicators.qualidadeEducacao, clamp(qualidadeAlvo, 0, 100), 0.05),
  };
}

export function computeSeguranca(
  state: GameState,
  economy: Partial<Record<IndicatorId, number>>,
): Partial<Record<IndicatorId, number>> {
  const { sliders, indicators } = state;
  const policia = sliders.policiamento / 100;
  const prisional = sliders.sistemaPrisional / 80;
  const desemprego = economy.desemprego ?? indicators.desemprego;

  const criminalidadeAlvo =
    75 -
    policia * 30 -
    prisional * 12 +
    (desemprego - 8) * 1.5 +
    (indicators.gini - 0.52) * 40;

  return {
    criminalidade: approach(indicators.criminalidade, clamp(criminalidadeAlvo, 0, 100), 0.08),
  };
}

export function computeSaneamento(state: GameState): Partial<Record<IndicatorId, number>> {
  const { sliders, indicators } = state;
  const invest = sliders.investimentosPublicos / 500; // fração vai p/ saneamento

  const aguaAlvo = 70 + invest * 30;
  const coletaAlvo = 40 + invest * 55;
  const tratamentoAlvo = 30 + invest * 65;

  return {
    aguaTratada: approach(indicators.aguaTratada, clamp(aguaAlvo, 0, 100), 0.04),
    coletaEsgoto: approach(indicators.coletaEsgoto, clamp(coletaAlvo, 0, 100), 0.04),
    tratamentoEsgoto: approach(indicators.tratamentoEsgoto, clamp(tratamentoAlvo, 0, 100), 0.04),
  };
}

// ─────────────────────────────────────────────────────────
// 4. INDICADORES SOCIAIS AGREGADOS
// ─────────────────────────────────────────────────────────

export function computeSociais(state: GameState): Partial<Record<IndicatorId, number>> {
  const { indicators } = state;

  const saudeMedia = (indicators.acessoSaude + indicators.qualidadeSaude) / 2;
  const educMedia = (indicators.acessoEducacao + indicators.qualidadeEducacao) / 2;
  const rendaProxy = indicators.poderCompra;

  const idhAlvo = (saudeMedia / 100 + educMedia / 100 + rendaProxy / 100) / 3;
  const giniAlvo =
    0.62 -
    (indicators.poderCompra - 60) * 0.003 -
    (indicators.desemprego < 8 ? 0.02 : 0);

  const confiancaAlvo =
    30 +
    (indicators.criminalidade < 50 ? 10 : 0) +
    (indicators.inflacao < 5 ? 8 : 0) +
    (indicators.desemprego < 8 ? 8 : 0);

  return {
    idh: approach(indicators.idh, clamp(idhAlvo, 0, 1), 0.03),
    gini: approach(indicators.gini, clamp(giniAlvo, 0.3, 0.7), 0.04),
    confiancaInstituicoes: approach(
      indicators.confiancaInstituicoes,
      clamp(confiancaAlvo, 0, 100),
      0.05,
    ),
  };
}

// ─────────────────────────────────────────────────────────
// 5. ORQUESTRADOR DAS REGRAS
// ─────────────────────────────────────────────────────────

export function applyRules(state: GameState): Record<IndicatorId, number> {
  const current = { ...state.indicators };

  const finances = computeFinances(state);
  Object.assign(current, finances);

  const economy = computeEconomy({ ...state, indicators: current }, finances);
  Object.assign(current, economy);

  Object.assign(current, computeSaude({ ...state, indicators: current }));
  Object.assign(current, computeEducacao({ ...state, indicators: current }));
  Object.assign(current, computeSeguranca({ ...state, indicators: current }, economy));
  Object.assign(current, computeSaneamento({ ...state, indicators: current }));
  Object.assign(current, computeSociais({ ...state, indicators: current }));

  // Aplica clamp global conforme definição de cada indicador
  (Object.keys(current) as IndicatorId[]).forEach(id => {
    const def = INDICATORS[id];
    current[id] = clamp(current[id], def.min, def.max);
  });

  return current;
}
