// src/game/services/engine/turn.ts

import { getIndicator } from '../../data/indicators';
import { syncMacroIndicators } from './macroSync';
import {
  runApprovalTurn,
  countIdleMonths,
  idleDrift,
  monthIndex,
  type IndicatorDeltas,
} from './approval';
import type { GameState } from './initialState';

export interface TurnInput extends GameState {
  rawDeltas: {
    national: Record<string, number>;
  };
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
// SIMULAÇÃO FISCAL E ECONÔMICA DERIVADA
export function recalculateEconomy(n: Record<string, number>): void {
  // 1. Receitas do governo estimadas a partir de impostos e PIB
  // Base nominal do PIB: ~11.2T. Receita primária líquida federal: ~2.45T
  // Alíquotas base: IVA 26.5% (~1.3T), IR 27.5% (~550B), Empresas 34.0% (~600B)
  const pibBase = 11200e9;
  const pibAtual = n.pib || pibBase;
  const pibRatio = pibAtual / pibBase;

  // Elasticidade / Efeito Laffer: aumentar alíquotas excessivamente desestimula a base e gera perda de eficiência
  // Para pequenas variações é quase linear; para variações gigantescas (ex: IVA a 40%) o ganho arrefece.
  const ivaBase = 26.5;
  const ivaDiff = (n.iva - ivaBase) / ivaBase;
  const lafferIvaFactor = 1 - Math.max(0, ivaDiff * 0.35); // se imposto sobe muito, base de consumo diminui
  const recIva = (1300e9 + 1300e9 * ivaDiff * lafferIvaFactor) * pibRatio;

  const irBase = 27.5;
  const irDiff = (n.imposto_renda - irBase) / irBase;
  const lafferIrFactor = 1 - Math.max(0, irDiff * 0.25);
  const recIr = (550e9 + 550e9 * irDiff * lafferIrFactor) * pibRatio;

  const empBase = 34.0;
  const empDiff = (n.imposto_empresas - empBase) / empBase;
  const lafferEmpFactor = 1 - Math.max(0, empDiff * 0.4);
  const recEmpresas = (600e9 + 600e9 * empDiff * lafferEmpFactor) * pibRatio;

  n.receitas_governo = Math.max(500e9, recIva + recIr + recEmpresas);

  // 2. Despesas do governo: soma dos orçamentos e despesas obrigatórias
  // Base fixa (previdência INSS, pensões, custeio fixo, precatórios): ~1.77T
  const despesasBase = 1770e9 * pibRatio;

  // Salários (impacto na folha do funcionalismo federal/SUS/educação)
  const folhaSaude = Math.max(0, ((n.salarios_saude || 6800) - 6800) * 12 * 500e3); // componente federal
  const folhaEducacao = Math.max(0, ((n.salarios_professores || 5200) - 5200) * 12 * 400e3);
  const auxilioSocialExtra = Math.max(0, ((n.bolsa_familia || 685) - 685) * 12 * 21e6);

  const orcamentosDisc =
    (n.orcamento_saude || 218e9) +
    (n.orcamento_educacao || 175e9) +
    (n.orcamento_assistencia_social || 168e9) +
    auxilioSocialExtra +
    (n.orcamento_seguranca || 42e9) +
    (n.investimento_publico || 85e9) +
    (n.investimento_energia || 35e9) +
    (n.orcamento_cultura || 3.5e9) +
    folhaSaude +
    folhaEducacao;

  n.despesas_governo = Math.max(500e9, despesasBase + orcamentosDisc);

  // 3. Saldo orçamentário anualizado
  n.saldo_orcamentario = n.receitas_governo - n.despesas_governo;

  // 4. Inflação: afetada por Selic, déficit público, câmbio e impostos sobre consumo (IVA)
  const selicEfeito = ((11.25 - (n.taxa_selic || 11.25)) * 0.15);
  const fiscalEfeito = (n.saldo_orcamentario < 0 ? (Math.abs(n.saldo_orcamentario) / 1e12) * 0.5 : -0.15);
  const ivaRepasse = ((n.iva - 26.5) * 0.18); // repasse de preços ao consumidor
  n.inflacao = Math.max(0.5, Math.min(30, 4.2 + selicEfeito + fiscalEfeito + ivaRepasse));

  // 5. Crescimento do PIB: impulsionado por investimento e juros baixos, freado por carga tributária
  const investImpact = (((n.investimento_publico || 85e9) - 85e9) / 85e9) * 0.7;
  const jurosImpact = ((11.25 - (n.taxa_selic || 11.25)) * 0.18);
  const tributoImpact = (((n.iva + n.imposto_empresas) - 60.5) * -0.06);
  n.crescimento_pib = Math.max(-10, Math.min(10, 2.5 + investImpact + jurosImpact + tributoImpact));

  // 7. PIB nominal atualizado com crescimento
  n.pib = pibBase * (1 + (n.crescimento_pib / 100) / 12);

  // 8. Desemprego: inversamente correlacionado ao crescimento do PIB
  const desempregoImpact = (2.5 - n.crescimento_pib) * 0.3;
  n.desemprego = Math.max(3, Math.min(22, 7.3 + desempregoImpact));

  // 9. Dólar: influenciado por dívida/saldo e Selic
  const riscoFiscal = Math.max(0, -n.saldo_orcamentario / 1e12) * 0.8;
  const diferencialJuros = ((11.25 - (n.taxa_selic || 11.25)) * 0.08);
  n.dolar = Math.max(3.0, Math.min(10.0, 5.75 + riscoFiscal + diferencialJuros));

  // 10. Social e Qualidade de Vida
  const bolsaImpact = (((n.bolsa_familia || 685) - 685) / 685) * -4.0;
  n.taxa_pobreza = Math.max(5, Math.min(45, 24.2 + bolsaImpact + (n.desemprego - 7.3) * 0.8));
  n.extrema_pobreza = Math.max(1, Math.min(20, 4.8 + bolsaImpact * 0.6));
  n.qualidade_vida = Math.max(10, Math.min(95, 68 + (n.salario_minimo - 1518) / 300 - (n.taxa_pobreza - 24.2) * 0.5));

  // 11. Saúde
  const saudeInvImpact = (((n.orcamento_saude || 218e9) - 218e9) / 218e9) * 15;
  n.qualidade_saude = Math.max(10, Math.min(95, 58 + saudeInvImpact));
  n.acesso_saude = Math.max(10, Math.min(95, 64 + saudeInvImpact * 0.8));
  n.tempo_espera_saude = Math.max(5, Math.min(120, 42 - saudeInvImpact * 0.7));

  // 12. Educação
  const educInvImpact = (((n.orcamento_educacao || 175e9) - 175e9) / 175e9) * 12;
  n.qualidade_educacao = Math.max(10, Math.min(95, 54 + educInvImpact));
  n.acesso_educacao = Math.max(20, Math.min(98, 76 + educInvImpact * 0.5));
  n.evasao_escolar = Math.max(1, Math.min(25, 7.1 - educInvImpact * 0.3));

  // 13. Segurança
  const segurancaImpact = (((n.orcamento_seguranca || 42e9) - 42e9) / 42e9) * 10 + (((n.efetivo_policial || 490000) - 490000) / 490000) * 10;
  n.criminalidade = Math.max(10, Math.min(95, 62 - segurancaImpact));
  n.homicidios = Math.max(5, Math.min(50, 21.4 - segurancaImpact * 0.3));
  n.eficiencia_policial = Math.max(10, Math.min(95, 48 + segurancaImpact * 0.8));

  // 14. Energia
  const energiaInv = (((n.investimento_energia || 35e9) - 35e9) / 35e9) * 10;
  n.seguranca_energetica = Math.max(20, Math.min(98, 74 + energiaInv));
  n.custo_energia = Math.max(0.3, Math.min(2.0, 0.88 - (n.subsidios_energia - 22e9) / 22e9 * 0.1));

  // 15. Cultura
  const culturaImpact = (((n.orcamento_cultura || 3.5e9) - 3.5e9) / 3.5e9) * 15;
  n.producao_cultural = Math.max(10, Math.min(95, 58 + culturaImpact));
  n.acesso_cultura = Math.max(10, Math.min(95, 44 + culturaImpact * 0.8));
}

export function runGameTurn(input: TurnInput): TurnOutput {
  const currentMonthIdx = monthIndex(input.year, input.month);
  const nationalIndicators = { ...input.nationalIndicators };

  // 1. Aplica deltas das políticas ativas
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

    // Aplica parcela de efeito dos indicadores
    let appliedCount = 0;
    for (const [id, targetDelta] of Object.entries(policy.effects)) {
      if (!targetDelta || typeof targetDelta !== 'number') continue;
      const ramp = Math.max(1, policy.effectRampUpMonths ?? 1);
      const step = active;
      if (step < ramp) {
        const monthlyPortion = targetDelta / ramp;
        nationalIndicators[id] = (nationalIndicators[id] ?? 0) + monthlyPortion;
        appliedCount++;
      }
    }

    policyLog.push({ policyId: policy.id, name: policy.name, applied: appliedCount, expired: false });
  }

  // 2. Aplica deltas brutos passados no input
  if (input.rawDeltas?.national) {
    for (const [id, delta] of Object.entries(input.rawDeltas.national)) {
      nationalIndicators[id] = (nationalIndicators[id] ?? 0) + delta;
    }
  }

  // 3. Recalcula a simulação de economia e indicadores
  recalculateEconomy(nationalIndicators);

  // Clampa todos os valores aos limites do catálogo
  for (const [id, val] of Object.entries(nationalIndicators)) {
    const def = getIndicator(id);
    if (def) {
      nationalIndicators[id] = Math.max(def.min, Math.min(def.max, val));
    }
  }

  // 4. Sincroniza Macros
  const macroSyncResult = syncMacroIndicators(input.macros, { national: nationalIndicators });

  // 5. Calcula aprovação dos grupos
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

  nationalIndicators.aprovacao_popular = approvalResult.nationalApproval;

  // 6. Atualiza ciclo das políticas ativas
  const agedPolicies = input.activePolicies
    .filter((p) => !expiredPolicyIds.has(p.id))
    .map((p) => ({ ...p, activeMonths: (p.activeMonths ?? 0) + 1 }));

  // 7. Constrói sumário
  const lines: string[] = [
    `Aprovação nacional: ${approvalResult.nationalApproval.toFixed(1)}%`,
    `PIB: R$ ${(nationalIndicators.pib / 1e12).toFixed(2)} tri (Crescimento: ${nationalIndicators.crescimento_pib.toFixed(1)}%)`,
    `Inflação: ${nationalIndicators.inflacao.toFixed(1)}% | Desemprego: ${nationalIndicators.desemprego.toFixed(1)}%`,
  ];

  const topDeltas: TurnSummary['topDeltas'] = [];
  for (const [id, d] of Object.entries(indicatorDeltas.national)) {
    if (Math.abs(d) > 0.05) {
      const def = getIndicator(id);
      topDeltas.push({ id, delta: d, category: def.category });
    }
  }

  const summary: TurnSummary = { lines, topDeltas };

  return {
    ...input,
    year: input.month >= 12 ? input.year + 1 : input.year,
    month: input.month >= 12 ? 1 : input.month + 1,
    nationalIndicators,
    macros: macroSyncResult.macros,
    groupApprovals: approvalResult.approvals,
    nationalApproval: approvalResult.nationalApproval,
    activePolicies: agedPolicies,
    log: {
      policies: policyLog,
      macroSync: macroSyncResult.log,
      approval: approvalResult.log,
    },
    summary,
  };
}
