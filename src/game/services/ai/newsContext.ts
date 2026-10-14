// src/game/services/ai/newsContext.ts

import { STATE_IDS, STATES } from '../../data/states';
import { getGroup } from '../../data/groups';
import { MACRO_BY_ID } from '../../data/macroIndicators';
import { NEWS_VEHICLES } from '../../data/newsVehicles';
import { pickImage } from '../engine/newsImagePicker';
import { analyzeTrends, type Trend } from '../engine/trends';
import { themeOf, type NewsTheme } from '../../data/newsThemes';
import type { NewsTrigger, ContextSnapshot } from '../../types/ai';
import type { TurnLog, TurnSummary } from '../engine/turn';

// ============================================================
// TIPOS
// ============================================================

export interface GameStateForNewsInput {
  year: number;
  month: number;
  macros: Record<string, number>;
  nationalIndicators: Record<string, number>;
  nationalApproval: number;
  groupApprovals: Record<string, number>;
  stateApprovals: Record<string, number>;
  activePolicies: Array<{
    id: string;
    name: string;
    type: string;
    activeMonths: number;
    fiscalAnnual: number;
    effects: Record<string, number | undefined>;
  }>;
  activeReactions: Array<{
    groupId: string;
    monthsActive: number;
  }>;
}

export interface NewsContextInput {
  game: GameStateForNewsInput;
  history: ContextSnapshot[];
  lastTurnLog: TurnLog;
  lastTurnSummary: TurnSummary;
}

export interface NewsContextTrigger extends NewsTrigger {
  /** Caminho da imagem sorteada. */
  imagem: string;
}

export interface NewsContext {
  year: number;
  month: number;
  /** Resumo do país. */
  country: {
    approval: number;
    macros: Array<{ id: string; label: string; value: number }>;
  };
  /** Grupos em crise (aprovação baixa). */
  gruposEmCrise: Array<{ id: string; nome: string; approval: number }>;
  /** Top 5 estados com aprovação mais baixa. */
  estadosCriticos: Array<{ id: string; nome: string; approval: number }>;
  /** Tendências detectadas (do trends.ts). */
  tendencias: Trend[];
  /** Gatilhos ordenados por impacto (2-4). */
  gatilhos: NewsContextTrigger[];
  /** Veículos disponíveis. */
  veiculos: typeof NEWS_VEHICLES;
}

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const MAX_NEWS = 4;

/** Acima disso, o macro é considerado "em crise". */
const CRISIS_THRESHOLD: Record<string, number> = {
  crisisClimate: 60,
  scandalExposure: 50,
};

/** Abaixo disso, o macro é considerado "crítico". */
const CRITICAL_LOW: Record<string, number> = {
  militaryLoyalty: 40,
};

/** Impacto fiscal (R$ bi/ano) acima do qual uma medida é "choque". */
const SHOCK_FISCAL_THRESHOLD = 100_000_000_000;  // 100 bi

// ============================================================
// API
// ============================================================

export function buildNewsContext(input: NewsContextInput): NewsContext {
  const { game, history, lastTurnLog } = input;

  // ---------- Tendências ----------
  const tendencias = analyzeTrends(history).slice(0, 6);

  // ---------- Gatilhos ----------
  const duros: NewsTrigger[] = [];    // reação, crise, shock
  const tendenciasTrig: NewsTrigger[] = [];

  // 1. Reações ativas (agregadas, impacto MENOR)
  const reacoesPorTipo = new Map<string, { grupos: string[]; monthsActive: number }>();
  for (const r of game.activeReactions) {
    const g = getGroup(r.groupId);
    if (!g.reacao) continue;
    const key = g.reacao.titulo.slice(0, 40);
    const existing = reacoesPorTipo.get(key);
    if (existing) {
      existing.grupos.push(g.nome);
      existing.monthsActive = Math.max(existing.monthsActive, r.monthsActive);
    } else {
      reacoesPorTipo.set(key, { grupos: [g.nome], monthsActive: r.monthsActive });
    }
  }

  for (const [tipo, info] of reacoesPorTipo) {
    duros.push({
      kind: 'reaction',
      tema: 'politics',
      detalhe: `${info.grupos.join(', ')} em mobilização: ${tipo} (${info.monthsActive} ${info.monthsActive === 1 ? 'mês' : 'meses'}).`,
      impacto: 5,   // era 6+, agora 5 — fica atrás de random
      refId: info.grupos[0],
    });
  }

  // 2. Macro em crise (impacto 7, mas limitado a 1)
  const crisesEncontradas: NewsTrigger[] = [];
  for (const [macroId, threshold] of Object.entries(CRISIS_THRESHOLD)) {
    const v = game.macros[macroId];
    if (typeof v !== 'number' || v < threshold) continue;
    const def = MACRO_BY_ID[macroId];
    if (!def) continue;
    crisesEncontradas.push({
      kind: 'crisis',
      tema: themeOf(macroId),
      detalhe: `${def.nome} em ${v.toFixed(0)}/100. Governo sob pressão.`,
      impacto: 7,
      refId: macroId,
    });
  }
  for (const [macroId, threshold] of Object.entries(CRITICAL_LOW)) {
    const v = game.macros[macroId];
    if (typeof v !== 'number' || v > threshold) continue;
    const def = MACRO_BY_ID[macroId];
    if (!def) continue;
    crisesEncontradas.push({
      kind: 'crisis',
      tema: themeOf(macroId),
      detalhe: `${def.nome} em ${v.toFixed(0)}/100. Mal-estar institucional.`,
      impacto: 7,
      refId: macroId,
    });
  }
  // Só entra a crise mais forte
  if (crisesEncontradas.length > 0) {
    crisesEncontradas.sort((a, b) => b.impacto - a.impacto);
    duros.push(crisesEncontradas[0]);
  }

  // 3. Shock3 (impacto 8)
  for (const p of lastTurnLog.policies) {
    if (p.applied === 0 || p.expired) continue;
    const isShock = game.activePolicies.some(
      (ap) => ap.id === p.policyId && Math.abs(ap.fiscalAnnual) >= SHOCK_FISCAL_THRESHOLD,
    );
    if (isShock) {
      duros.push({
        kind: 'shock3',
        tema: 'politics',
        detalhe: `Medida estrutural em vigor: ${p.name}. Aplicando efeitos em ${p.applied} indicadores.`,
        impacto: 8,
        refId: p.policyId,
      });
    }
  }

  // 4. Tendências (impacto 6 se piorando, 7 se crítico)
  for (const t of tendencias.slice(0, 3)) {
    if (t.severity === 'estável' || t.severity === 'melhorando') continue;
    tendenciasTrig.push({
      kind: 'trend',
      tema: t.category,
      detalhe: `${t.label} ${t.direction} há ${t.months} meses. Variação acumulada: ${formatDelta(t.totalDelta)} ${t.unit}. Valor atual: ${formatNum(t.value)}.`,
      impacto: t.severity === 'crítico' ? 7 : 6,
      refId: t.indicatorId,
    });
  }

  // ---------- Seleção equilibrada ----------
  // Regra: sempre 1 duro/tendência + sempre 1 random.
  // Se não houver duro nem tendência, 2 random.

  const selecionados: NewsTrigger[] = [];

  // Escolhe o mais forte entre duros + tendências
  const prioritarios = [...duros, ...tendenciasTrig].sort((a, b) => b.impacto - a.impacto);
  if (prioritarios.length > 0) {
    selecionados.push(prioritarios[0]);
  }

  // Sempre 1 random (mesmo que seja o único)
  const randomPool = buildRandomPool(game);
  if (randomPool.length > 0) {
    const random = randomPool[Math.floor(Math.random() * randomPool.length)];
    selecionados.push(random);
  }

  // Se ainda falta (MAX 4), completa com mais duros
  const restantes = prioritarios.slice(1);
  while (selecionados.length < MAX_NEWS && restantes.length > 0) {
    selecionados.push(restantes.shift()!);
  }

  // Se AINDA falta (MAX 4), mais randoms
  while (selecionados.length < MAX_NEWS && randomPool.length > 0) {
    selecionados.push(randomPool.shift()!);
  }

  // Ordena final por impacto
  selecionados.sort((a, b) => b.impacto - a.impacto);

  // Sorteia imagem
  const gatilhos: NewsContextTrigger[] = selecionados.map((t) => ({
    ...t,
    imagem: pickImage(t.tema),
  }));

  // ---------- Contexto do país ----------
  const macroList = ['inflation', 'unemployment', 'growth', 'debt', 'dollar', 'selicRate', 'criminality', 'crisisClimate']
    .map((id) => {
      const v = game.macros[id];
      if (typeof v !== 'number') return null;
      const def = MACRO_BY_ID[id];
      return def ? { id, label: def.nome, value: v } : null;
    })
    .filter((x): x is { id: string; label: string; value: number } => x !== null);

  const gruposEmCrise = Object.entries(game.groupApprovals)
    .map(([id, approval]) => ({ id, nome: getGroup(id).nome, approval }))
    .filter((g) => g.approval < 35)
    .sort((a, b) => a.approval - b.approval)
    .slice(0, 5);

  const estadosCriticos = STATE_IDS
    .map((sid) => ({ id: sid, nome: STATES[sid].name, approval: game.stateApprovals[sid] ?? 50 }))
    .filter((s) => s.approval < 35)
    .sort((a, b) => a.approval - b.approval)
    .slice(0, 5);

  return {
    year: game.year,
    month: game.month,
    country: {
      approval: game.nationalApproval,
      macros: macroList,
    },
    gruposEmCrise,
    estadosCriticos,
    tendencias,
    gatilhos,
    veiculos: NEWS_VEHICLES,
  };
}

// ============================================================
// RANDOM POOL
// ============================================================

interface RandomTemplate {
  tema: NewsTheme;
  detalhe: string;
  impacto: number;
}

const RANDOM_TEMPLATES: RandomTemplate[] = [
  // ---------- ECONOMIA ----------
  { tema: 'economy', detalhe: 'Leilão de petróleo arrecada valor acima do esperado.', impacto: 5 },
  { tema: 'economy', detalhe: 'Bolsa fecha em alta após dados de emprego nos EUA.', impacto: 4 },
  { tema: 'economy', detalhe: 'Agência de risco revisa perspectiva da dívida brasileira.', impacto: 6 },
  { tema: 'economy', detalhe: 'Governo anuncia pacote de crédito para pequenas empresas.', impacto: 5 },
  { tema: 'economy', detalhe: 'Exportações de soja batem recorde no trimestre.', impacto: 5 },
  { tema: 'economy', detalhe: 'Dólar recua com melhora no cenário externo.', impacto: 4 },
  { tema: 'economy', detalhe: 'Desemprego recua em 12 estados, diz IBGE.', impacto: 5 },
  { tema: 'economy', detalhe: 'Investimento estrangeiro cresce em setores de tecnologia.', impacto: 5 },

  // ---------- SEGURANÇA ----------
  { tema: 'security', detalhe: 'Operação integrada reduz roubos em capitais.', impacto: 5 },
  { tema: 'security', detalhe: 'Governo anuncia novo programa de segurança para escolas.', impacto: 5 },
  { tema: 'security', detalhe: 'Balanço aponta queda de homicídios em 4 estados.', impacto: 5 },
  { tema: 'security', detalhe: 'Polícia Federal desarticula esquema de contrabando.', impacto: 4 },
  { tema: 'security', detalhe: 'Concurso público abre 5 mil vagas para policiais.', impacto: 5 },

  // ---------- SAÚDE ----------
  { tema: 'health', detalhe: 'Campanha de vacinação atinge meta em metade dos estados.', impacto: 4 },
  { tema: 'health', detalhe: 'Ministério anuncia ampliação do programa de saúde da família.', impacto: 5 },
  { tema: 'health', detalhe: 'Novo hospital federal é inaugurado no Nordeste.', impacto: 5 },
  { tema: 'health', detalhe: 'SUS amplia atendimento em regiões remotas.', impacto: 4 },
  { tema: 'health', detalhe: 'Avanço em pesquisa nacional sobre vacinas é publicado.', impacto: 4 },

  // ---------- EDUCAÇÃO ----------
  { tema: 'education', detalhe: 'Enem tem maior número de inscritos em 5 anos.', impacto: 4 },
  { tema: 'education', detalhe: 'Universidades federais anunciam expansão de vagas.', impacto: 5 },
  { tema: 'education', detalhe: 'Programa de alfabetização é elogiado por relatório internacional.', impacto: 5 },
  { tema: 'education', detalhe: 'Brasileiros ganham medalhas em olimpíada de matemática.', impacto: 4 },

  // ---------- AMBIENTE ----------
  { tema: 'environment', detalhe: 'Brasil reduz emissões em setor industrial, diz relatório.', impacto: 4 },
  { tema: 'environment', detalhe: 'Nova área de proteção ambiental é criada na Amazônia.', impacto: 5 },
  { tema: 'environment', detalhe: 'Programa de energia solar bate recorde de instalações.', impacto: 4 },
  { tema: 'environment', detalhe: 'País assume compromisso climático em conferência internacional.', impacto: 5 },

  // ---------- SOCIAL ----------
  { tema: 'social', detalhe: 'IBGE mostra queda na pobreza extrema no último ano.', impacto: 5 },
  { tema: 'social', detalhe: 'Programa de renda básica atinge 2 milhões de famílias.', impacto: 5 },
  { tema: 'social', detalhe: 'Mutirão de documentação atende população em situação de rua.', impacto: 4 },
  { tema: 'social', detalhe: 'População indígena recebe apoio emergencial em 3 estados.', impacto: 4 },

  // ---------- INFRAESTRUTURA ----------
  { tema: 'infrastructure', detalhe: 'Nova rodovia federal é entregue no Centro-Oeste.', impacto: 5 },
  { tema: 'infrastructure', detalhe: 'Metrô de capital amplia linha e reduz tempo de viagem.', impacto: 5 },
  { tema: 'infrastructure', detalhe: 'Programa de saneamento chega a municípios do interior.', impacto: 5 },
  { tema: 'infrastructure', detalhe: 'Internet de alta velocidade chega a escolas rurais.', impacto: 4 },

  // ---------- POLÍTICA ----------
  { tema: 'politics', detalhe: 'Congresso aprova projeto de modernização administrativa.', impacto: 5 },
  { tema: 'politics', detalhe: 'STF decide caso de grande repercussão institucional.', impacto: 6 },
  { tema: 'politics', detalhe: 'Governo assina acordo de cooperação internacional.', impacto: 5 },
  { tema: 'politics', detalhe: 'Pesquisa aponta recuperação da popularidade do governo em 3 regiões.', impacto: 5 },
  { tema: 'politics', detalhe: 'Ministro participa de agenda oficial em país vizinho.', impacto: 3 },
  { tema: 'politics', detalhe: 'Comissão do Senado aprova projeto de lei por unanimidade.', impacto: 4 },
];

function buildRandomPool(_game: GameStateForNewsInput): NewsTrigger[] {
  // Sorteia 3 templates aleatórios pra ter opções
  const pool: NewsTrigger[] = [];
  const used = new Set<number>();
  while (pool.length < 3) {
    const idx = Math.floor(Math.random() * RANDOM_TEMPLATES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    const t = RANDOM_TEMPLATES[idx];
    pool.push({
      kind: 'random',
      tema: t.tema,
      detalhe: t.detalhe,
      impacto: t.impacto,
    });
  }
  return pool;
}

// ============================================================
// HELPERS
// ============================================================

function formatDelta(v: number): string {
  const s = v.toFixed(2).replace(/\.?0+$/, '');
  return v > 0 ? `+${s}` : s;
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)} mi`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)} mil`;
  return v.toFixed(2);
}
