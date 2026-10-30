// src/game/services/engine/turn.ts

import { getIndicator, INDICATORS_BY_ID } from '../../data/indicators';
import { syncMacroIndicators } from './macroSync';
import {
  runApprovalTurn, countIdleMonths, idleDrift, monthIndex,
  type IndicatorDeltas,
} from './approval';
import type { GameState } from './initialState';
import type { ActivePolicy } from '../../types/policy';
import { STATES, STATE_IDS, stateApprovalShift } from '../../data/states';

export interface TurnInput extends GameState {
  rawDeltas: { national: Record<string, number> };
}
export interface TurnSummary {
  lines: string[];
  topDeltas: Array<{ id: string; delta: number; category: string }>;
}
export interface TurnLog {
  policies: Array<{ policyId: string; name: string; applied: number; expired: boolean }>;
  macroSync: Array<{ macroId: string; from: number; to: number }>;
  approval: ReturnType<typeof runApprovalTurn>['log'];
}
export interface TurnOutput extends GameState {
  log: TurnLog;
  summary: TurnSummary;
}

// ============================================================
// Helpers
// ============================================================
const lerp = (base: number, value: number, base0: number, base1: number, delta: number) =>
  base + ((value - base0) / (base1 - base0)) * delta;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Indicadores de resultado têm inércia: orçamentos e políticas mudam primeiro,
 * e serviços/resultados sociais convergem ao longo de meses. Mantém tudo
 * determinístico e O(número de indicadores), sem simulação pesada.
 */
const INDICATOR_RESPONSE: Record<string, number> = {
  inflacao: 0.35, crescimento_pib: 0.28, desemprego: 0.2,
  taxa_pobreza: 0.12, extrema_pobreza: 0.1, gini: 0.08, idh: 0.035,
  esperanca_vida: 0.012, mortalidade_infantil: 0.08,
  ideb_anos_iniciais: 0.06, ideb_anos_finais: 0.05, ideb_ensino_medio: 0.045,
  homicidios: 0.2, roubo_por_100k: 0.2, esgoto_tratado: 0.035,
  acesso_agua_tratada: 0.025, rodovias_conservacao: 0.025,
  participacao_renovaveis: 0.04, produtividade: 0.06,
};

function blendWithPrevious(n: Record<string, number>, previous: Record<string, number>): void {
  for (const [id, response] of Object.entries(INDICATOR_RESPONSE)) {
    const before = previous[id];
    if (typeof before !== 'number' || !Number.isFinite(before) || typeof n[id] !== 'number') continue;
    n[id] = before + (n[id] - before) * response;
  }
}

// ============================================================
// MOTOR ECONÔMICO PRINCIPAL
// ============================================================
export function recalculateEconomy(
  n: Record<string, number>,
  policies: ActivePolicy[] = [],
): void {
  // -------- Snapshot do turno anterior (para feedbacks defasados) --------
  const prevInflacao      = n.inflacao       ?? 4.2;
  const prevCrescimento   = n.crescimento_pib ?? 2.5;
  const prevProdutividade = n.produtividade  ?? 62;
  const prevDesmat        = (n.desmatamento_amazonia ?? 9000) + (n.desmatamento_cerrado ?? 7000);

  const salarioMinBase = 1518;
  const varSalMin = ((n.salario_minimo ?? salarioMinBase) - salarioMinBase) / salarioMinBase;
  const pibBase = 11200e9;
  const pibAtual = n.pib || pibBase;
  const pibRatio = pibAtual / pibBase;

  // ============================================================
  // FASE 1 — FISCAL (receitas + despesas + dívida)
  // ============================================================
  const ivaDiff = ((n.iva ?? 26.5) - 26.5) / 26.5;
  const irDiff  = ((n.imposto_renda ?? 27.5) - 27.5) / 27.5;
  const empDiff = ((n.imposto_empresas ?? 34) - 34) / 34;

  // Curva de Laffer: subir demais a alíquota reduz a base
  const lafferIva = 1 - Math.max(0, ivaDiff * 0.35);
  const lafferIr  = 1 - Math.max(0, irDiff  * 0.25);
  const lafferEmp = 1 - Math.max(0, empDiff * 0.40);

  // Eficiência da arrecadação depende de administração + digitalização
  const eficArrec = clamp(
    0.87 + (n.digitalizacao_servicos_pct ?? 65) / 100 * 0.08 +
    (n.indice_transparencia ?? 55) / 100 * 0.05,
    0.60, 1.00,
  );

  const recIva = (1300e9 + 1300e9 * ivaDiff * lafferIva) * pibRatio * eficArrec;
  const recIr  = (550e9  + 550e9  * irDiff  * lafferIr ) * pibRatio * eficArrec;
  const recEmp = (600e9  + 600e9  * empDiff * lafferEmp) * pibRatio * eficArrec;

  n.receitas_governo = Math.max(500e9, recIva + recIr + recEmp);

  // Despesas obrigatórias indexadas ao salário mínimo (previdência, BPC, etc.)
  // Receitas e despesas são fluxos anuais; calibra a base para o saldo inicial
  // do catálogo e não para um déficit artificial de centenas de bilhões.
  const despesasBase = 1390e9 * pibRatio + clamp(varSalMin * 650e9, -250e9, 250e9);

  const folhaSaude    = Math.max(0, ((n.salarios_saude ?? 6800) - 6800) * 12 * 500e3);
  const folhaEducacao = Math.max(0, ((n.salarios_professores ?? 4850) - 4850) * 12 * 400e3);
  const auxBolsa      = Math.max(0, ((n.bolsa_familia ?? 685) - 685) * 12 * 21e6);

  const orcDisc =
    (n.orcamento_saude                ?? 218e9) +
    (n.orcamento_educacao             ?? 175e9) +
    (n.orcamento_assistencia_social   ?? 168e9) + auxBolsa +
    (n.orcamento_seguranca            ?? 42e9) +
    (n.orcamento_prisional            ?? 12e9) +
    (n.orcamento_cultura              ?? 3.5e9) +
    (n.orcamento_meio_ambiente        ?? 4.2e9) +
    (n.orcamento_ciencia              ?? 12e9) +
    (n.orcamento_administracao        ?? 60e9) +
    (n.investimento_publico           ?? 85e9) +
    (n.investimento_energia           ?? 35e9) +
    (n.investimento_hospitais         ?? 24e9) +
    (n.investimento_escolas           ?? 22e9) +
    (n.investimento_habitacao         ?? 18e9) +
    (n.investimento_infraestrutura    ?? 55e9) +
    (n.investimento_saneamento        ?? 12e9) +
    (n.investimento_transportes       ?? 14e9) +
    (n.incentivos_culturais           ?? 4.2e9) +
    (n.incentivos_inovacao            ?? 8e9) +
    (n.subsidios_energia              ?? 22e9) +
    (n.fiscalizacao_ambiental         ?? 2.1e9) +
    (n.orcamento_combate_desmatamento ?? 1.2e9) +
    (n.investimento_pesquisa          ?? 6.5e9) +
    (n.orcamento_digitalizacao        ?? 3.5e9) +
    folhaSaude + folhaEducacao;

  n.despesas_governo  = Math.max(500e9, despesasBase + orcDisc);
  n.saldo_orcamentario = n.receitas_governo - n.despesas_governo;

  // Dívida: acumula déficit + juros (Selic sobre o estoque) − crescimento nominal (denominador)
  const selic = n.taxa_selic ?? 11.25;
  // Cada turno representa um mês, portanto converte fluxos e taxas anuais.
  const jurosDivida = (n.divida_publica ?? 8900e9) * (selic / 100 / 12);
  const dividaNova = (n.divida_publica ?? 8900e9)
    + (-n.saldo_orcamentario / 12)
    + jurosDivida
    - (n.pib || pibBase) * (Math.max(prevCrescimento, 0) / 100 / 12);
  n.divida_publica = clamp(dividaNova, 1000e9, 25000e9);
  n.divida_pib     = (n.divida_publica / (n.pib || pibBase)) * 100;

  // ============================================================
  // FASE 2 — SETORIAIS (cada área olha para suas entradas + cross-feeds do turno anterior)
  // ============================================================
  // Sanidade básica para encadear
  const orcSaude      = n.orcamento_saude ?? 218e9;
  const orcEduc       = n.orcamento_educacao ?? 175e9;
  const orcSegur      = n.orcamento_seguranca ?? 42e9;
  const efetivoPol    = n.efetivo_policial ?? 490000;
  const investEnergia = n.investimento_energia ?? 35e9;
  const investInfra   = n.investimento_infraestrutura ?? 55e9;
  const investSanea   = n.investimento_saneamento ?? 12e9;
  const investTransp  = n.investimento_transportes ?? 14e9;
  const orcAmbiente   = n.orcamento_meio_ambiente ?? 4.2e9;
  const fiscalAmb     = n.fiscalizacao_ambiental ?? 2.1e9;
  const combateDesmat = n.orcamento_combate_desmatamento ?? 1.2e9;
  const orcCT         = n.orcamento_ciencia ?? 12e9;
  const incentInov    = n.incentivos_inovacao ?? 8e9;
  const invPesquisa   = n.investimento_pesquisa ?? 6.5e9;
  const orcAdm        = n.orcamento_administracao ?? 60e9;
  const orcDigital    = n.orcamento_digitalizacao ?? 3.5e9;
  const orcCultura    = n.orcamento_cultura ?? 3.5e9;
  const incentCult    = n.incentivos_culturais ?? 4.2e9;

  // --- 2.1 ADMINISTRAÇÃO (roda cedo porque alimenta arrecadação, etc.) ---
  const digitalRatio = (orcDigital - 3.5e9) / 3.5e9;
  const admRatio     = (orcAdm - 60e9) / 60e9;

  n.digitalizacao_servicos_pct    = clamp(65 + digitalRatio * 20, 10, 100);
  n.indice_transparencia          = clamp(55 + digitalRatio * 15 - (prevInflacao - 4.2) * 0.5, 10, 100);
  n.indice_percepcao_corrupcao    = clamp(36 + digitalRatio * 10 - (prevInflacao - 4.2) * 0.3, 5, 95);
  n.tempo_abertura_empresa        = clamp(12 - digitalRatio * 4 - admRatio * 2, 1, 60);
  n.tempo_medio_licitacao         = clamp(180 - digitalRatio * 40 - admRatio * 20, 20, 400);
  n.servidores_por_mil            = clamp(9 + admRatio * 1.5, 3, 25);
  n.satisfacao_servicos_publicos  = clamp(42 + digitalRatio * 8 - (prevInflacao - 4.2) * 1.5, 10, 90);
  n.custo_administracao_pib       = clamp((orcAdm / (n.pib || pibBase)) * 100, 2, 20);
  // Eficiência de arrecadação depende do digital + transparência
  n.eficiencia_arrecadacao = clamp(
    87 + digitalRatio * 6 + (n.indice_transparencia - 55) * 0.1, 60, 100,
  );

  // --- 2.2 SAÚDE ---
  const gastoSaudeAtual = (orcSaude + (n.investimento_hospitais ?? 24e9));
  const gastoSaudePib   = (gastoSaudeAtual / (n.pib || pibBase)) * 100 + 3.5; // +privado (~3.5)
  n.gasto_saude_pib = clamp(gastoSaudePib, 3, 15);

  // mortalidade infantil depende de: gasto saúde, saneamento, vacinação, qualidade da água
  const esgotoTrat = n.esgoto_tratado ?? 55;
  const aguaTrat   = n.acesso_agua_tratada ?? 84;
  const vacinacao  = n.cobertura_vacinal ?? 88;
  n.mortalidade_infantil = clamp(
    18 - n.gasto_saude_pib * 0.55 - (esgotoTrat - 55) * 0.06
      - (aguaTrat - 84) * 0.05 - (vacinacao - 88) * 0.06,
    1, 50,
  );
  n.mortalidade_materna = clamp(
    90 - n.gasto_saude_pib * 3 - (esgotoTrat - 55) * 0.3, 5, 200,
  );
  n.esperanca_vida = clamp(
    72 + n.gasto_saude_pib * 0.55 + (esgotoTrat - 55) * 0.03
      - (n.qualidade_ar_pm25 ?? 14) * 0.02 - (n.mortalidade_infantil - 11.8) * 0.1,
    50, 90,
  );
  n.mortalidade_geral = clamp(6.5 - (n.esperanca_vida - 76.4) * 0.3, 3, 20);
  n.leitos_por_mil    = clamp(2.3 + ((n.investimento_hospitais ?? 24e9) / 24e9 - 1) * 0.4, 1, 6);
  n.medicos_por_mil   = clamp(
    2.8 + ((n.salarios_saude ?? 6800) / 6800 - 1) * 0.25 + (orcSaude / 218e9 - 1) * 0.3,
    0.5, 6,
  );
  n.tempo_espera_saude = clamp(
    42 - (orcSaude / 218e9 - 1) * 6 - ((n.investimento_hospitais ?? 24e9) / 24e9 - 1) * 10,
    1, 180,
  );
  n.fila_cirurgias = clamp(
    950000 - (orcSaude / 218e9 - 1) * 300000 - ((n.investimento_hospitais ?? 24e9) / 24e9 - 1) * 250000,
    100000, 5000000,
  );
  n.cobertura_atencao_basica = clamp(72 + (orcSaude / 218e9 - 1) * 10, 0, 100);
  n.cobertura_vacinal         = clamp(88 + (orcSaude / 218e9 - 1) * 4, 0, 100);
  n.disponibilidade_medicamentos = clamp(70 + (orcSaude / 218e9 - 1) * 12, 0, 100);
  n.satisfacao_sus = clamp(
    55 + (n.tempo_espera_saude - 42) * -0.4 + ((n.salarios_saude ?? 6800) / 6800 - 1) * 3,
    0, 100,
  );

  // --- 2.3 EDUCAÇÃO ---
  const orcEduRatio = orcEduc / 175e9 - 1;
  const salProfRatio = (n.salarios_professores ?? 4850) / 4850 - 1;
  const invEscRatio = (n.investimento_escolas ?? 22e9) / 22e9 - 1;

  n.ideb_anos_iniciais = clamp(5.8 + orcEduRatio * 0.8 + salProfRatio * 0.3, 1, 10);
  n.ideb_anos_finais   = clamp(5.0 + orcEduRatio * 0.7 + salProfRatio * 0.3, 1, 10);
  n.ideb_ensino_medio  = clamp(4.2 + orcEduRatio * 0.6 + salProfRatio * 0.25, 1, 10);
  n.pisa_matematica    = clamp(379 + (n.ideb_ensino_medio - 4.2) * 40, 300, 600);
  n.taxa_analfabetismo = clamp(5.4 - orcEduRatio * 0.7 - salProfRatio * 0.3, 0.5, 25);
  n.evasao_escolar     = clamp(7.1 - orcEduRatio * 1.5 - salProfRatio * 0.5, 0.5, 30);
  n.taxa_matricula_liquida = clamp(94 + orcEduRatio * 2, 50, 100);
  n.anos_estudo_medio = clamp(9.5 + orcEduRatio * 0.5, 3, 15);
  n.conclusao_ensino_medio = clamp(68 + orcEduRatio * 8 - (n.evasao_escolar - 7.1) * 2, 20, 100);
  n.formacao_tecnica_jovens = clamp(11 + invEscRatio * 3 + orcEduRatio * 2, 2, 40);
  n.inclusao_digital = clamp(65 + invEscRatio * 8, 0, 100);
  n.qualificacao_docente = clamp(78 + salProfRatio * 6 + orcEduRatio * 3, 20, 100);
  n.gasto_educacao_pib = clamp((orcEduc / (n.pib || pibBase)) * 100, 2, 12);

  // --- 2.4 SEGURANÇA E JUSTIÇA ---
  const segRatio = orcSegur / 42e9 - 1;
  const efetRatio = efetivoPol / 490000 - 1;
  const prisRatio = (n.orcamento_prisional ?? 12e9) / 12e9 - 1;
  // Feedback: desemprego juvenil do turno anterior puxa homicídios
  const desempJovem = n.desemprego_jovens ?? 18.5;
  n.homicidios = clamp(
    21.4 - segRatio * 4 - efetRatio * 5 + (desempJovem - 18.5) * 0.25
      - (n.ideb_ensino_medio - 4.2) * 0.8,
    2, 60,
  );
  n.roubos_por_100k = clamp(
    420 - segRatio * 50 - efetRatio * 60 + (desempJovem - 18.5) * 8, 50, 1500,
  );
  n.furtos_por_100k = clamp(
    550 - segRatio * 40 - efetRatio * 45, 100, 2000,
  );
  n.taxa_elucidacao = clamp(32 + segRatio * 6 + efetRatio * 6, 5, 90);
  n.letalidade_policial = clamp(
    3.2 + efetRatio * 1.5 - segRatio * 0.3, 0, 20,
  );
  n.tempo_resposta_emergencia = clamp(
    18 - segRatio * 3 - efetRatio * 3, 3, 45,
  );
  n.populacao_carceraria = clamp(
    830000 + (n.homicidios - 21.4) * 8000 + (n.roubos_por_100k - 420) * 500,
    100000, 1500000,
  );
  n.taxa_encarceramento = clamp(
    (n.populacao_carceraria / 210e6) * 100000, 50, 800,
  );
  n.presos_provisorios_pct = clamp(
    32 - (n.tempo_medio_processo - 30) * 0.5, 5, 70,
  );
  n.condicoes_prisionais = clamp(32 + prisRatio * 15, 0, 100);
  n.reincidencia_prisional = clamp(
    52 - (n.condicoes_prisionais - 32) * 0.6 - (n.ideb_ensino_medio - 4.2) * 3,
    10, 90,
  );
  n.confianca_seguranca = clamp(
    50 + (n.taxa_elucidacao - 32) * 0.5 - (n.homicidios - 21.4) * 0.6, 5, 90,
  );
  n.tempo_medio_processo = clamp(30 - (n.eficiencia_arrecadacao - 87) * 0.5, 6, 72);

  // --- 2.5 ENERGIA ---
  const energiaRatio = investEnergia / 35e9 - 1;
  const subsidioRatio = ((n.subsidios_energia ?? 22e9) / 22e9) - 1;
  const renovBase = n.participacao_renovaveis ?? 84.5;

  // Custo depende de: importação (dólar), subsidio, perda, renováveis
  n.custo_energia = clamp(
    0.88 + ((n.dolar ?? 5.75) - 5.75) * 0.04
       - subsidioRatio * 0.08 + (n.perda_distribuicao ?? 15) / 100 * 0.03
       - (renovBase - 84.5) * 0.005,
    0.2, 2.5,
  );
  n.reserva_capacidade = clamp(25 + energiaRatio * 10, 5, 60);
  n.participacao_renovaveis = clamp(
    84.5 + energiaRatio * 3 + (subsidioRatio > 0 ? subsidioRatio * 2 : subsidioRatio * 4),
    10, 100,
  );
  n.horas_sem_energia = clamp(12 - energiaRatio * 3 - (n.perda_distribuicao - 15) * 0.2, 1, 60);
  n.emissoes_energia = clamp(
    520 - (n.participacao_renovaveis - 84.5) * 8, 20, 800,
  );
  n.capacidade_geracao_gw = clamp(195 + energiaRatio * 20, 100, 500);
  n.acesso_energia = clamp(99.2 + energiaRatio * 0.5, 80, 100);
  n.perda_distribuicao = clamp(15 - energiaRatio * 2, 3, 30);
  n.consumo_per_capita_kwh = clamp(
    2450 + (n.pib_per_capita ?? 52500) / 52500 * 200, 800, 8000,
  );

  // --- 2.6 INFRAESTRUTURA ---
  const infraRatio = investInfra / 55e9 - 1;
  const saneaRatio = investSanea / 12e9 - 1;
  const transpRatio = investTransp / 14e9 - 1;

  n.rodovias_pavimentadas = clamp(13 + infraRatio * 1.5, 5, 80);
  n.rodovias_conservacao  = clamp(45 + infraRatio * 10, 10, 90);
  n.ferrovias_km          = clamp(30000 + infraRatio * 3000, 20000, 60000);
  n.portos_eficiencia     = clamp(8.5 - infraRatio * 2, 1, 20);
  n.esgoto_tratado        = clamp(55 + saneaRatio * 8, 10, 100);
  n.acesso_agua_tratada   = clamp(84 + saneaRatio * 3, 50, 100);
  n.tempo_deslocamento_medio = clamp(55 - transpRatio * 5, 15, 120);
  n.qualidade_transporte_publico = clamp(42 + transpRatio * 10, 5, 90);
  // Custo logístico cai com infra e conservação
  n.custo_logistico_pib = clamp(
    12.5 - (n.rodovias_conservacao - 45) * 0.05 - infraRatio * 1.5, 5, 25,
  );

  // --- 2.7 MEIO AMBIENTE ---
  const ambRatio = orcAmbiente / 4.2e9 - 1;
  const fiscRatio = fiscalAmb / 2.1e9 - 1;
  const desmCombateRatio = combateDesmat / 1.2e9 - 1;

  n.desmatamento_amazonia = clamp(
    9000 - fiscRatio * 2500 - desmCombateRatio * 2000 - (n.digitalizacao_servicos_pct - 65) * 20,
    1000, 30000,
  );
  n.desmatamento_cerrado = clamp(
    7000 - fiscRatio * 1500 - desmCombateRatio * 1200,
    1000, 20000,
  );
  n.emissao_co2 = clamp(
    (n.emissoes_energia ?? 430)
      + (n.desmatamento_amazonia + n.desmatamento_cerrado) * 0.07,
    200, 3000,
  );
  n.qualidade_ar_pm25 = clamp(
    14 - ambRatio * 2 + (n.desmatamento_amazonia - 9000) * 0.0005
       - (n.qualidade_transporte_publico - 42) * 0.05,
    3, 60,
  );
  n.qualidade_agua = clamp(56 + ambRatio * 6 + saneaRatio * 5, 10, 100);
  n.taxa_reciclagem = clamp(4.5 + ambRatio * 2, 1, 50);
  n.areas_protegidas = clamp(230 - desmCombateRatio * -5, 100, 300);
  n.especies_ameacadas = clamp(1200 + (n.desmatamento_amazonia - 9000) * 0.02, 200, 3000);
  n.indice_pegada_ecologica = clamp(
    2.9 - (n.participacao_renovaveis - 84.5) * 0.02 + (n.consumo_per_capita_kwh - 2450) / 3000, 1.5, 8,
  );

  // --- 2.8 C&T ---
  const ctRatio = orcCT / 12e9 - 1;
  const inovRatio = incentInov / 8e9 - 1;
  const pesqRatio = invPesquisa / 6.5e9 - 1;

  n.investimento_pd_pib = clamp(1.15 + ctRatio * 0.2 + inovRatio * 0.15 + pesqRatio * 0.1, 0.3, 4.5);
  n.patentes_ano = clamp(25000 + (n.investimento_pd_pib - 1.15) * 15000, 5000, 80000);
  n.publicacoes_ano = clamp(80000 + pesqRatio * 15000 + ctRatio * 10000, 20000, 200000);
  n.pesquisadores_por_mil = clamp(1.3 + pesqRatio * 0.4 + ctRatio * 0.2, 0.5, 8);
  n.empresas_inovadoras_pct = clamp(34 + inovRatio * 6 + ctRatio * 3, 5, 70);
  n.startups_ativas = clamp(13000 + inovRatio * 5000, 500, 80000);
  n.exportacao_tecnologia_pct = clamp(12 + (n.investimento_pd_pib - 1.15) * 6, 2, 40);
  n.banda_larga_pct = clamp(78 + (n.digitalizacao_servicos_pct - 65) * 0.4 + ctRatio * 2, 20, 100);

  // --- 2.9 CULTURA ---
  const cultRatio = orcCultura / 3.5e9 - 1;
  const incentCultRatio = incentCult / 4.2e9 - 1;

  n.acesso_cultura_pct = clamp(44 + cultRatio * 8 + incentCultRatio * 5, 5, 100);
  n.producao_audiovisual_ano = clamp(220 + incentCultRatio * 80, 50, 800);
  n.patrimonio_preservado_pct = clamp(48 + cultRatio * 6, 10, 100);
  n.empregos_culturais_num = clamp(850000 + incentCultRatio * 200000, 100000, 3000000);
  n.diversidade_cultural_pct = clamp(52 + incentCultRatio * 6, 10, 100);
  n.acervos_digitalizados_pct = clamp(50 + cultRatio * 6, 5, 100);
  n.economia_criativa_pib = clamp(2.6 + incentCultRatio * 0.4, 0.5, 8);
  n.participacao_cultural_pct = clamp(44 + cultRatio * 5 + incentCultRatio * 3, 5, 100);

  // ============================================================
  // FASE 3 — PRODUTIVIDADE (agrega saúde + educação + infra + C&T + energia)
  // ============================================================
  const prodSaude  = (n.esperanca_vida - 76.4) * 0.8 + (11.8 - n.mortalidade_infantil) * 0.5;
  const prodEduc   = (n.ideb_ensino_medio - 4.2) * 3 + (n.anos_estudo_medio - 9.5) * 0.8;
  const prodInfra  = (45 - n.custo_logistico_pib) * 0.5 + (n.rodovias_conservacao - 45) * 0.05;
  const prodCT     = (n.investimento_pd_pib - 1.15) * 4 + (n.pesquisadores_por_mil - 1.3) * 1.5;
  const prodEnerg  = (0.88 - n.custo_energia) * 15 - (n.horas_sem_energia - 12) * 0.3;

  n.produtividade = clamp(
    prevProdutividade + prodSaude + prodEduc + prodInfra + prodCT + prodEnerg,
    20, 250,
  );

  // ============================================================
  // FASE 4 — MACRO: câmbio, inflação, PIB, desemprego
  // ============================================================
  // Câmbio (dólar): depende de risco fiscal, juros e confiança
  const riscoFiscal = Math.max(0, -n.saldo_orcamentario / 1e12) * 0.8;
  const jurosDif = ((11.25 - selic) * 0.08);
  n.risco_pais = clamp(
    200 + (n.divida_pib - 79.5) * 6 + riscoFiscal * 100, 100, 2500,
  );
  n.dolar = clamp(
    5.75 + riscoFiscal + jurosDif + (n.risco_pais - 260) * 0.001,
    2.0, 12.0,
  );

  // Inflação: expectativas + Selic + fiscal + IVA + salário + energia + câmbio
  const selicEfeito    = (11.25 - selic) * 0.15;
  const fiscalEfeito   = n.saldo_orcamentario < 0
    ? (Math.abs(n.saldo_orcamentario) / 1e12) * 0.5
    : -0.15;
  const ivaRepasse     = ((n.iva ?? 26.5) - 26.5) * 0.18;
  const salarioInfl    = varSalMin * 0.35;
  const energiaInfl    = (n.custo_energia - 0.88) * 2.5;
  const cambioInfl     = (n.dolar - 5.75) * 0.5;
  const inercia        = (prevInflacao - 4.2) * 0.35;

  n.inflacao = clamp(
    4.2 + selicEfeito + fiscalEfeito + ivaRepasse + salarioInfl
        + energiaInfl + cambioInfl + inercia,
    0.5, 30,
  );

  // PIB crescimento: investimento + juros + carga + consumo + produtividade
  const investPubImpact = ((n.investimento_publico ?? 85e9) / 85e9 - 1) * 0.7;
  const jurosImpact     = -((selic - 11.25) * 0.18);
  const tributoImpact   = -(((n.iva ?? 26.5) + (n.imposto_empresas ?? 34) - 60.5) * 0.06);
  const consumoSalario  = varSalMin * 0.8;
  const produtImpact    = ((n.produtividade - prevProdutividade) / prevProdutividade) * 2.0;
  const energiaImpact   = -((n.custo_energia - 0.88) * 0.4);

  n.crescimento_pib = clamp(
    2.5 + investPubImpact + jurosImpact + tributoImpact + consumoSalario
        + produtImpact + energiaImpact,
    -10, 10,
  );

  n.pib = pibBase * (1 + (n.crescimento_pib / 100) / 12);
  n.pib_per_capita = n.pib / 210e6;

  // Desemprego (lei de Okun) + efeito do salário mínimo real
  n.desemprego = clamp(
    7.3 + (2.5 - n.crescimento_pib) * 0.3 + Math.max(0, varSalMin) * 1.2,
    2, 25,
  );
  n.desemprego_jovens = clamp(18.5 + (n.desemprego - 7.3) * 2, 5, 45);

  // Confiança do consumidor
  n.confianca_consumidor = clamp(
    55 + (n.crescimento_pib - 2.5) * 4 - (n.inflacao - 4.2) * 1.5 - (n.desemprego - 7.3) * 2,
    20, 90,
  );

  // Investimento privado / PIB: cai com juros, sobe com segurança, infra, confiança
  n.investimento_privado_pib = clamp(
    15.5 - (selic - 11.25) * 0.4 - (n.homicidios - 21.4) * 0.1
        - (n.custo_logistico_pib - 12.5) * 0.2 + (n.confianca_consumidor - 55) * 0.05,
    5, 30,
  );

  // Renda média real: salário mínimo real + PIB p.c. + inflação
  n.renda_media_real = clamp(
    2950 * (1 + varSalMin) * (1 - (n.inflacao - 4.2) * 0.02)
        + (n.pib_per_capita - 52500) / 52500 * 300,
    800, 6000,
  );

  // Carga tributária
  n.carga_tributaria_efetiva = clamp(
    32 + ((n.iva ?? 26.5) - 26.5) * 0.45 + ((n.imposto_renda ?? 27.5) - 27.5) * 0.25 +
    ((n.imposto_empresas ?? 34) - 34) * 0.20, 5, 60,
  );

  // ============================================================
  // FASE 5 — SOCIAL (pobreza, Gini, IDH) — feedback de tudo acima
  // ============================================================
  const bolsaRatio = ((n.bolsa_familia ?? 685) / 685) - 1;
  const assistRatio = ((n.orcamento_assistencia_social ?? 168e9) / 168e9) - 1;
  const habitRatio  = ((n.investimento_habitacao ?? 18e9) / 18e9) - 1;

  n.taxa_pobreza = clamp(
    24.2
      - bolsaRatio * 4
      - assistRatio * 2
      - varSalMin * 5
      + (n.desemprego - 7.3) * 0.9
      + (n.inflacao - 4.2) * 0.5
      - (n.renda_media_real - 2950) / 2950 * 3,
    2, 50,
  );
  n.extrema_pobreza = clamp(
    4.8 - bolsaRatio * 2.5 - assistRatio * 1.2 + (n.desemprego - 7.3) * 0.3,
    0.5, 20,
  );
  n.gini = clamp(
    51.8 - varSalMin * 2.5 - bolsaRatio * 3 + (n.desemprego - 7.3) * 0.3,
    20, 80,
  );
  n.renda_per_capita = clamp(
    1450 * (1 + varSalMin * 0.7) * (1 - (n.inflacao - 4.2) * 0.02),
    200, 4000,
  );
  n.taxa_informalidade = clamp(
    39 + (n.carga_tributaria_efetiva - 32) * 0.6 - (n.ideb_ensino_medio - 4.2) * 2,
    10, 70,
  );
  n.seguranca_alimentar = clamp(
    72 - (n.taxa_pobreza - 24.2) * 1.2 - (n.extrema_pobreza - 4.8) * 2 + bolsaRatio * 3,
    20, 100,
  );
  n.deficit_habitacional = clamp(
    5900000 - habitRatio * 400000 - (n.taxa_pobreza - 24.2) * 60000,
    100000, 8000000,
  );
  n.populacao_rua = clamp(
    280000 + (n.taxa_pobreza - 24.2) * 8000 - assistRatio * 20000,
    20000, 800000,
  );
  n.mobilidade_social_pct = clamp(
    34 + (n.ideb_ensino_medio - 4.2) * 4 - (n.gini - 51.8) * 0.2 + (n.taxa_informalidade < 39 ? 2 : -1),
    10, 70,
  );

  // IDH — composição dos três pilares (ONU)
  const idhRenda = clamp(0.55 + Math.log10(n.renda_per_capita / 500) * 0.15, 0.3, 1);
  const idhSaude = clamp((n.esperanca_vida - 50) / 35, 0.3, 1);
  const idhEduc = clamp((n.anos_estudo_medio / 15) * 0.7 + (n.taxa_matricula_liquida / 100) * 0.3, 0.3, 1);
  n.idh = clamp((idhRenda + idhSaude + idhEduc) / 3, 0.3, 1);

  // ============================================================
  // FASE 6 — POLÍTICAS CUSTOMIZADAS DA IA (aplicadas por último)
  // ============================================================
  let customRevenue = 0, customExpense = 0;
  const customEffects: Record<string, number> = {};
  for (const policy of policies) {
    for (const card of policy.newIndicators ?? []) {
      if (card.tipo !== 'slider') continue;
      const value = n[card.id] ?? card.valorInicial;
      const unitsFromBase = value - card.valorInicial;
      for (const [indicatorId, perUnit] of Object.entries(card.affects ?? {})) {
        if (['receitas_governo','despesas_governo','saldo_orcamentario'].includes(indicatorId)) continue;
        customEffects[indicatorId] =
          (customEffects[indicatorId] ?? 0) +
          (perUnit * unitsFromBase) / Math.max(1, card.affectScale ?? 1);
      }
      const fiscalPerUnit = Math.max(-100e9, Math.min(100e9, card.fiscalAnnual ?? 0));
      const f = fiscalPerUnit * unitsFromBase;
      const isSpendingCut = /\b(corte|cortar|reducao|reduzir|enxugar)\b/i.test(`${policy.name} ${card.nome} ${card.curto ?? ''}`) &&
        /\b(gastos?|despesas?|orcamento)\b/i.test(`${policy.name} ${card.nome} ${card.curto ?? ''}`);
      if (isSpendingCut && f > 0) customExpense -= Math.min(f, Math.max(0, n.despesas_governo - 500e9));
      else if (f > 0) customRevenue += f;
      else customExpense += Math.abs(f);
    }
  }
  n.receitas_governo += customRevenue;
  n.despesas_governo += customExpense;
  n.saldo_orcamentario = n.receitas_governo - n.despesas_governo;

  for (const [id, delta] of Object.entries(customEffects)) {
    if (['receitas_governo','despesas_governo','saldo_orcamentario'].includes(id)) continue;
    n[id] = (n[id] ?? 0) + delta;
  }

  // Políticas com efeitos declarados sobre calculados (reaplica sobre fórmula-base)
  for (const policy of policies) {
    const ramp = Math.max(1, policy.effectRampUpMonths ?? 1);
    const prog = Math.min(1, ((policy.activeMonths ?? 0) + 1) / ramp);
    for (const [id, delta] of Object.entries(policy.effects)) {
      if (INDICATORS_BY_ID[id]?.type !== 'calculated') continue;
      if (typeof delta !== 'number' || !Number.isFinite(delta)) continue;
      n[id] = (n[id] ?? INDICATORS_BY_ID[id].initial) + delta * prog;
    }
  }
}

// ============================================================
// EXECUÇÃO DO TURNO (mantido o esqueleto original)
// ============================================================
export function runGameTurn(input: TurnInput): TurnOutput {
  const currentMonthIdx = monthIndex(input.year, input.month);
  const nationalIndicators = { ...input.nationalIndicators };

  const policyLog: TurnLog['policies'] = [];
  const expiredPolicyIds = new Set<string>();

  for (const policy of input.activePolicies) {
    const active = policy.activeMonths ?? 0;
    const isExpired =
      policy.durationType === 'temporary' &&
      policy.durationMonths > 0 &&
      active >= policy.durationMonths;

    if (isExpired) {
      expiredPolicyIds.add(policy.id);
      policyLog.push({ policyId: policy.id, name: policy.name, applied: 0, expired: true });
      continue;
    }

    let appliedCount = 0;
    for (const [id, targetDelta] of Object.entries(policy.effects)) {
      if (!targetDelta || typeof targetDelta !== 'number') continue;
      if (INDICATORS_BY_ID[id]?.type === 'calculated') continue;
      const ramp = Math.max(1, policy.effectRampUpMonths ?? 1);
      if (active < ramp) {
        nationalIndicators[id] = (nationalIndicators[id] ?? 0) + targetDelta / ramp;
        appliedCount++;
      }
    }
    policyLog.push({ policyId: policy.id, name: policy.name, applied: appliedCount, expired: false });
  }

  if (input.rawDeltas?.national) {
    for (const [id, delta] of Object.entries(input.rawDeltas.national)) {
      nationalIndicators[id] = (nationalIndicators[id] ?? 0) + delta;
    }
  }

  recalculateEconomy(
    nationalIndicators,
    input.activePolicies.filter((p) => !expiredPolicyIds.has(p.id)),
  );

  // Aplica inércia somente a resultados calculados, preservando mudanças
  // graduais e evitando que cada fórmula force o país inteiro instantaneamente.
  blendWithPrevious(nationalIndicators, input.nationalIndicators);

  // Clampa aos limites do catálogo
  for (const [id, val] of Object.entries(nationalIndicators)) {
    const def = getIndicator(id);
    if (def) nationalIndicators[id] = clamp(val, def.min, def.max);
  }
  // Garante clamp também dos sliders customizados da IA
  for (const policy of input.activePolicies) {
    for (const ind of policy.newIndicators ?? []) {
      if (ind.tipo !== 'slider') continue;
      const v = nationalIndicators[ind.id] ?? ind.valorInicial;
      nationalIndicators[ind.id] = Math.max(ind.minimo ?? v, Math.min(ind.maximo ?? v, v));
    }
  }

  const macroSyncResult = syncMacroIndicators(input.macros, { national: nationalIndicators });

  const indicatorDeltas: IndicatorDeltas = {
    national: Object.fromEntries(
      Object.keys(nationalIndicators).map((id) => [
        id,
        nationalIndicators[id] - (input.nationalIndicators[id] ?? nationalIndicators[id]),
      ]),
    ),
  };

  const idleMonths = countIdleMonths(input.policyHistory, currentMonthIdx);
  const approvalResult = runApprovalTurn({
    groupApprovals: input.groupApprovals,
    previousNationalApproval: input.nationalApproval,
    govIdeology: input.profile.govIdeology,
    activePolicies: input.activePolicies,
    indicatorDeltas,
    idleDriftAmount: idleDrift(idleMonths),
  });

  const nationalApprovalChange = approvalResult.nationalApproval - input.nationalApproval;
  const stateApprovals = Object.fromEntries(
    STATE_IDS.map((id) => {
      const state = STATES[id];
      const shift = stateApprovalShift(state, input.profile.govIdeology);
      const prev = input.stateApprovals?.[id] ??
        Math.max(1, Math.min(100, input.nationalApproval + shift));
      return [id, Math.max(1, Math.min(100,
        prev + nationalApprovalChange * (nationalApprovalChange >= 0 ? 1.5 : 0.25)))];
    }),
  );

  nationalIndicators.aprovacao_popular = approvalResult.nationalApproval;

  const agedPolicies = input.activePolicies
    .filter((p) => !expiredPolicyIds.has(p.id))
    .map((p) => ({ ...p, activeMonths: (p.activeMonths ?? 0) + 1 }));

  const lines: string[] = [
    `Aprovação nacional: ${approvalResult.nationalApproval.toFixed(1)}%`,
    `PIB: R$ ${(nationalIndicators.pib / 1e12).toFixed(2)} tri (${nationalIndicators.crescimento_pib.toFixed(1)}%)`,
    `Inflação: ${nationalIndicators.inflacao.toFixed(1)}% | Desemprego: ${nationalIndicators.desemprego.toFixed(1)}%`,
    `Dívida/PIB: ${nationalIndicators.divida_pib.toFixed(1)}% | Saldo: R$ ${(nationalIndicators.saldo_orcamentario / 1e9).toFixed(0)} bi`,
    `IDH: ${nationalIndicators.idh.toFixed(3)} | Gini: ${nationalIndicators.gini.toFixed(1)} | Pobreza: ${nationalIndicators.taxa_pobreza.toFixed(1)}%`,
    `Esperança vida: ${nationalIndicators.esperanca_vida.toFixed(1)} anos | IDEB EM: ${nationalIndicators.ideb_ensino_medio.toFixed(2)} | Homicídios: ${nationalIndicators.homicidios.toFixed(1)}/100k`,
  ];

  const topDeltas: TurnSummary['topDeltas'] = [];
  for (const [id, d] of Object.entries(indicatorDeltas.national)) {
    if (Math.abs(d) > 0.05) {
      const def = getIndicator(id);
      topDeltas.push({ id, delta: d, category: def.category });
    }
  }

  return {
    ...input,
    year: input.month >= 12 ? input.year + 1 : input.year,
    month: input.month >= 12 ? 1 : input.month + 1,
    nationalIndicators,
    macros: macroSyncResult.macros,
    groupApprovals: approvalResult.approvals,
    nationalApproval: approvalResult.nationalApproval,
    stateApprovals,
    activePolicies: agedPolicies,
    log: {
      policies: policyLog,
      macroSync: macroSyncResult.log,
      approval: approvalResult.log,
    },
    summary: { lines, topDeltas },
  };
}
