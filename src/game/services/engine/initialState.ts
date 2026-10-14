import { STATE_IDS, STATES, type StateId } from '../../data/states';
import { STATE_BASELINES, NATIONAL_SIDE_INITIAL } from '../../data/stateBaselines';
import {
  INDICATORS,
  INDICATOR_IDS,
  nationalIndependentIndicators,
  nationalDerivedIndicators,
} from '../../data/indicators';
import {
  MACRO_INDICATORS,
  MACRO_REFS,
  initialMacroValues,
  type MacroSyncContext,
} from '../../data/macroIndicators';
import { GROUPS } from '../../data/groups';
import { aggregateAll } from './aggregation';
import {
  computeGroupBaseline,
  computeNationalApproval,
  computeStateApprovals,
  clampApproval,
} from './approval';
import type { ProfileContext, ContextSnapshot } from '../../types/ai';
import type { ActivePolicy } from '../../types/policy';
import { PROFILE_AXES } from '../../data/profile';
import type { PendingEffect } from './rulesEngine';
import type { ActiveReaction } from './reactions';

// ============================================================
// TIPOS
// ============================================================

/**
 * Estado completo do jogo no início de um turno.
 * É a fonte única para o `runGameTurn`.
 */
export interface GameState {
  /** Mês atual (1-indexed). */
  year: number;    
  month: number; 

  profile: ProfileContext;

  // ─── Indicadores ───
  stateIndicators: Record<StateId, Record<string, number>>;
  nationalIndicators: Record<string, number>;
  macros: Record<string, number>;

  // ─── Aprovação ───
  groupApprovals: Record<string, number>;
  stateApprovals: Record<StateId, number>;
  nationalApproval: number;

  // ─── Medidas e reações ───
  activePolicies: ActivePolicy[];
  pendingEffects: PendingEffect[];
  activeReactions: ActiveReaction[];

  // ─── Histórico ───
  /** Medidas apresentadas, indexadas por mês único para o idle drift. */
  policyHistory: { monthIndex: number; id: string }[];
  /** Snapshots anteriores ao mês atual, ordem cronológica. */
  history: ContextSnapshot[];
}

export interface InitialStateOptions {
  /** Mês inicial (default: 1). */
  month?: number;
  /** Perfil do jogador. Se omitido, usa um perfil padrão centro-esquerda. */
  profile?: ProfileContext;
}

// ============================================================
// PERFIL PADRÃO
// ============================================================

/**
 * Perfil default pra testes e pra quando o jogador ainda não escolheu nada.
 * Não deve ser usado em produção — a UI sempre passa o perfil do jogador.
 */
export const DEFAULT_PROFILE: ProfileContext = {
  playerName: 'Jogador',
  partyId: 'psb',
  partyAcronym: 'PSB',
  govIdeology: -0.5,
  govIdeologyLabel: 'centro_esquerda',
  axes: {
    economia: -1,
    costumes: -1,
    seguranca: -1,
    ambiente: 1,
    gasto_social: 1,
  },
};

// ============================================================
// BUILDER PRINCIPAL
// ============================================================

/**
 * Cria o estado inicial completo do jogo.
 *
 * Ordem:
 *   1. Baselines estaduais (stateBaselines.ts)
 *   2. Indicadores nacionais independentes (do catálogo)
 *   3. Agregação dos derivados a partir dos estados
 *   4. Macros (espelhos + derivados + standalone)
 *   5. Aprovação dos grupos (via computeGroupBaseline)
 *   6. Aprovação nacional (grupos + estados)
 *   7. Aprovação por estado
 */
export function buildInitialState(
  opts: InitialStateOptions = {},
): GameState {
  const month = opts.month ?? 1;
  const profile = opts.profile ?? DEFAULT_PROFILE;

  // ---------- 1. Estados ----------
  const stateIndicators = buildInitialStateIndicators();

  // ---------- 2. Nacional independente ----------
  const nationalIndicators = buildInitialNationalIndicators();

  // ---------- 3. Agrega derivados a partir dos estados ----------
  const derived = aggregateAll(stateIndicators);
  for (const [id, value] of Object.entries(derived)) {
    nationalIndicators[id] = value;
  }

  // ---------- 4. Macros ----------
  const macros = buildInitialMacros(nationalIndicators, stateIndicators);

  // ---------- 5. Grupos ----------
  const groupApprovals = buildInitialGroupApprovals(profile);

  // ---------- 6. Aprovação nacional ----------
  const stateApprovals = buildInitialStateApprovals(
    profile.govIdeology,
    groupApprovals,
    stateIndicators,
  );
  const nationalApproval = computeNationalApproval(
    groupApprovals,
    stateApprovals,
  );

  // ---------- 7. Estado vazio ----------
  return {
    year: 2026,
    month,
    profile,
    stateIndicators,
    nationalIndicators,
    macros,
    groupApprovals,
    stateApprovals,
    nationalApproval,
    activePolicies: [],
    pendingEffects: [],
    activeReactions: [],
    policyHistory: [],
    history: [],
  };
}

// ============================================================
// SUB-BUILDERS
// ============================================================

function buildInitialStateIndicators(): Record<StateId, Record<string, number>> {
  const out: Record<StateId, Record<string, number>> = {} as any;
  for (const sid of STATE_IDS) {
    out[sid] = { ...STATE_BASELINES[sid] };
  }
  return out;
}

function buildInitialNationalIndicators(): Record<string, number> {
  const out: Record<string, number> = {};

  // Independentes puros (initial do catálogo)
  for (const ind of nationalIndependentIndicators()) {
    if (ind.initial !== undefined) {
      out[ind.id] = ind.initial;
    }
  }

  // Lado federal dos "national_and_state"
  for (const [id, value] of Object.entries(NATIONAL_SIDE_INITIAL)) {
    if (INDICATORS[id]) {
      out[id] = value;
    }
  }

  // Os state_aggregated serão preenchidos pela agregação (passo 3 do builder)

  return out;
}

function buildInitialMacros(
  national: Record<string, number>,
  stateIndicators: Record<StateId, Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = { ...initialMacroValues() };

  const ctx: MacroSyncContext = {
    national,
    stateIndicators,
    refs: MACRO_REFS,
  };

  for (const m of MACRO_INDICATORS) {
    if (m.source.kind === 'standalone') continue; // já veio de initialMacroValues

    if (m.source.kind === 'detailed') {
      const v = national[m.source.indicatorId];
      if (typeof v === 'number') out[m.id] = v;
      continue;
    }

    // derived
    const v = m.source.compute(ctx);
    if (Number.isFinite(v)) out[m.id] = v;
  }

  return out;
}

function buildInitialGroupApprovals(
  profile: ProfileContext,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of GROUPS) {
    const axisAffinity = PROFILE_AXES.reduce((sum, axis) => {
      const value = profile.axes[axis.id as keyof ProfileContext['axes']] ?? 0;
      return sum + value * (axis.afinidade[g.id] ?? 0) / 3;
    }, 0);
    const baseline = computeGroupBaseline(g.id, profile.govIdeology, []);
    out[g.id] = clampApproval(baseline + axisAffinity);
  }
  return out;
}

function buildInitialStateApprovals(
  govIdeology: number,
  groupApprovals: Record<string, number>,
  stateIndicators: Record<StateId, Record<string, number>>,
): Record<StateId, number> {
  // Aprovação nacional "provisória" a partir dos grupos — só pra alimentar o shift
  const nationalFromGroups = computeNationalApproval(groupApprovals);
  return computeStateApprovals(nationalFromGroups, govIdeology, stateIndicators);
}

// ============================================================
// SNAPSHOT DO ESTADO
// ============================================================

/**
 * Cria um snapshot reduzido do estado atual.
 * Chamado no FIM do turno (após runGameTurn) pra alimentar o histórico do próximo.
 */
export function snapshotFromState(state: GameState): ContextSnapshot {
  return {
    month: state.month,
    national: { ...state.nationalIndicators },
    macros: { ...state.macros },
    groupApprovals: { ...state.groupApprovals },
    nationalApproval: state.nationalApproval,
    states: STATE_IDS.map((id) => ({
      id,
      population: STATES[id].population,
      approval: state.stateApprovals[id] ?? state.nationalApproval,
      values: { ...state.stateIndicators[id] },
    })),
  };
}

// ============================================================
// VALIDAÇÃO
// ============================================================

export interface InitialStateValidation {
  ok: boolean;
  missing: {
    stateIndicators: Array<{ state: StateId; indicator: string }>;
    nationalIndicators: string[];
    macros: string[];
    groupApprovals: string[];
  };
  warnings: string[];
}

/**
 * Verifica se todos os indicadores esperados existem no estado inicial.
 * Útil em testes — garante que baselines cobrem 100% do catálogo.
 */
export function validateInitialState(state: GameState): InitialStateValidation {
  const missing: InitialStateValidation['missing'] = {
    stateIndicators: [],
    nationalIndicators: [],
    macros: [],
    groupApprovals: [],
  };
  const warnings: string[] = [];

  // Indicadores estaduais: cada indicador com escopo estadual
  // deve estar em cada estado.
  const stateScopedIds = INDICATOR_IDS.filter((id) => {
    const s = INDICATORS[id].scope;
    return s === 'state' || s === 'state_aggregated' || s === 'national_and_state';
  });

  for (const sid of STATE_IDS) {
    const values = state.stateIndicators[sid];
    for (const id of stateScopedIds) {
      if (typeof values[id] !== 'number') {
        missing.stateIndicators.push({ state: sid, indicator: id });
      }
    }
  }

  // Nacionais: independentes + agregados + lado federal
  for (const ind of nationalIndependentIndicators()) {
    if (typeof state.nationalIndicators[ind.id] !== 'number') {
      missing.nationalIndicators.push(ind.id);
    }
  }
  for (const ind of nationalDerivedIndicators()) {
    if (typeof state.nationalIndicators[ind.id] !== 'number') {
      missing.nationalIndicators.push(ind.id);
    }
  }
  for (const id of Object.keys(NATIONAL_SIDE_INITIAL)) {
    if (typeof state.nationalIndicators[id] !== 'number') {
      missing.nationalIndicators.push(id);
    }
  }

  // Macros
  for (const m of MACRO_INDICATORS) {
    if (typeof state.macros[m.id] !== 'number') {
      missing.macros.push(m.id);
    }
  }

  // Grupos
  for (const g of GROUPS) {
    if (typeof state.groupApprovals[g.id] !== 'number') {
      missing.groupApprovals.push(g.id);
    }
  }

  // Warnings de sanidade
  if (missing.stateIndicators.length > 0) {
    warnings.push(
      `${missing.stateIndicators.length} valores estaduais ausentes — baselines incompletos.`,
    );
  }
  if (missing.nationalIndicators.length > 0) {
    warnings.push(
      `${missing.nationalIndicators.length} indicadores nacionais ausentes.`,
    );
  }
  if (missing.macros.length > 0) {
    warnings.push(`${missing.macros.length} macros ausentes.`);
  }
  if (missing.groupApprovals.length > 0) {
    warnings.push(`${missing.groupApprovals.length} grupos sem aprovação.`);
  }

  // Sanidade numérica
  for (const sid of STATE_IDS) {
    const a = state.stateApprovals[sid];
    if (!Number.isFinite(a) || a < 1 || a > 100) {
      warnings.push(`Aprovação inválida em ${sid}: ${a}`);
    }
  }

  return {
    ok:
      missing.stateIndicators.length === 0 &&
      missing.nationalIndicators.length === 0 &&
      missing.macros.length === 0 &&
      missing.groupApprovals.length === 0,
    missing,
    warnings,
  };
}
