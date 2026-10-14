import type { StateId } from '../../data/states';
import { STATE_IDS } from '../../data/states';
import { GROUPS, getGroup } from '../../data/groups';
import { getIndicator } from '../../data/indicators';
import { STANDALONE_MACROS } from '../../data/macroIndicators';

// ============================================================
// TIPOS
// ============================================================

export interface ActiveReaction {
  groupId: string;
  monthsActive: number;
}

export interface ReactionsInput {
  /** Aprovação atual de cada grupo (start of turn). */
  groupApprovals: Record<string, number>;
  /** Reações já ativas no turno anterior. */
  active: ActiveReaction[];
  /** Valores atuais para aplicar percentuais (dollar, etc.). */
  nationalIndicators: Record<string, number>;
}

export interface ReactionsOutput {
  /** Deltas a aplicar nos indicadores estaduais. */
  stateDeltas: Record<StateId, Record<string, number>>;
  /** Deltas a aplicar nos indicadores nacionais. */
  nationalDeltas: Record<string, number>;
  /** Deltas a aplicar na aprovação dos próprios grupos. */
  groupApprovalDeltas: Record<string, number>;
  /** Reações que continuam ativas. */
  remaining: ActiveReaction[];
  /** Reações novas neste turno. */
  started: ActiveReaction[];
  /** Reações encerradas neste turno. */
  ended: ActiveReaction[];
  log: Array<{ groupId: string; kind: 'start' | 'end' | 'apply'; detail: string }>;
}

// ============================================================
// MAPEAMENTO DE CHAVES
// ============================================================
// As reações do catálogo usam ids macro (`growth`, `dollar`). Traduzimos
// para o detalhado quando aplicável. Macros standalone são mantidos.

const KEY_TRANSLATION: Record<string, string> = {
  growth: 'crescimento_pib',
  unemployment: 'desemprego',
  inflation: 'inflacao',
  selicRate: 'selic',
  debt: 'divida_publica',
  // criminality é composto — ignorado em reações
  // dollar tratado à parte (percentual → absoluto)
};

/** Margem de histerese pra encerrar reação (aprovação precisa subir acima disso). */
const END_MARGIN = 8;

// ============================================================
// CÁLCULO
// ============================================================

export function computeReactions(input: ReactionsInput): ReactionsOutput {
  const stateDeltas: Record<StateId, Record<string, number>> = Object.fromEntries(
    STATE_IDS.map((id) => [id, {}]),
  ) as Record<StateId, Record<string, number>>;
  const nationalDeltas: Record<string, number> = {};
  const groupApprovalDeltas: Record<string, number> = {};
  const log: ReactionsOutput['log'] = [];

  const activeMap = new Map(input.active.map((r) => [r.groupId, r]));
  const remaining: ActiveReaction[] = [];
  const started: ActiveReaction[] = [];
  const ended: ActiveReaction[] = [];

  // ---------- 1. Encerra reações cuja aprovação recuperou ----------
  for (const r of input.active) {
    const g = getGroup(r.groupId);
    const approval = input.groupApprovals[r.groupId] ?? 50;
    if (approval > g.limiarReacao + END_MARGIN) {
      ended.push(r);
      activeMap.delete(r.groupId);
      log.push({ groupId: r.groupId, kind: 'end', detail: 'aprovação recuperada' });
    }
  }

  // ---------- 2. Inicia reações novas ----------
  for (const g of GROUPS) {
    if (!g.reacao) continue;
    if (activeMap.has(g.id)) continue;              // já ativa
    if (ended.find((r) => r.groupId === g.id)) continue; // acabou de sair

    const approval = input.groupApprovals[g.id] ?? 50;
    if (approval < g.limiarReacao) {
      const r: ActiveReaction = { groupId: g.id, monthsActive: 0 };
      activeMap.set(g.id, r);
      started.push(r);
      log.push({ groupId: g.id, kind: 'start', detail: g.reacao.titulo });
    }
  }

  // ---------- 3. Aplica efeitos de todas as ativas ----------
  for (const r of activeMap.values()) {
    const g = getGroup(r.groupId);
    if (!g.reacao) continue;

    const combat = g.combatividade ?? 1;

    // 3a. Efeitos nos indicadores
    for (const [rawKey, amount] of Object.entries(g.reacao.mensal.indicadores ?? {})) {
      // Caso especial: `dollar` no catálogo é percentual
      if (rawKey === 'dollar') {
        const current = input.nationalIndicators.cotacao_dolar ?? 5;
        const delta = (amount / 100) * current;
        nationalDeltas.cotacao_dolar = (nationalDeltas.cotacao_dolar ?? 0) + delta;
        continue;
      }

      // Macros standalone: escreve direto no nacional
      if (STANDALONE_MACROS.has(rawKey)) {
        nationalDeltas[rawKey] = (nationalDeltas[rawKey] ?? 0) + amount * combat;
        continue;
      }

      // Traduz para id detalhado se aplicável
      const detailedId = KEY_TRANSLATION[rawKey] ?? rawKey;
      const ind = getIndicator(detailedId);

      // Aplica onde o indicador vive
      if (ind.scope === 'national') {
        nationalDeltas[detailedId] = (nationalDeltas[detailedId] ?? 0) + amount * combat;
      } else if (
        ind.scope === 'state_aggregated' ||
        ind.scope === 'state' ||
        ind.scope === 'national_and_state'
      ) {
        // Aplica em todos os estados (reação nacional)
        for (const sid of STATE_IDS) {
          stateDeltas[sid][detailedId] =
            (stateDeltas[sid][detailedId] ?? 0) + amount * combat;
        }
        // Se também é nacional_and_state, aplica no lado federal também
        if (ind.scope === 'national_and_state') {
          nationalDeltas[detailedId] = (nationalDeltas[detailedId] ?? 0) + amount * combat;
        }
      }
    }

    // 3b. Efeitos na aprovação de outros grupos
    for (const [otherId, amount] of Object.entries(g.reacao.mensal.grupos ?? {})) {
      groupApprovalDeltas[otherId] =
        (groupApprovalDeltas[otherId] ?? 0) + amount * combat;
    }

    // 3c. Mantém ativa e incrementa contador
    const updated: ActiveReaction = { ...r, monthsActive: r.monthsActive + 1 };
    remaining.push(updated);
    log.push({
      groupId: r.groupId,
      kind: 'apply',
      detail: `mês ${updated.monthsActive + 1}: ${g.reacao.titulo}`,
    });
  }

  return {
    stateDeltas,
    nationalDeltas,
    groupApprovalDeltas,
    remaining,
    started,
    ended,
    log,
  };
}