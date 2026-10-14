import Dexie, { type EntityTable } from 'dexie';
import type { GameState } from '../engine/initialState';
import type { Ideology } from '../../types/politics';
import type { StateId } from '../../data/states';

// ============================================================
// TIPOS
// ============================================================

export interface SaveGame {
  id?: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  month: number;
  /** Estado completo do jogo (novo formato). */
  game: GameState;
}

/**
 * Digest mensal — versão leve do estado, gravada a cada turno.
 * Serve para gráficos, replay e histórico longo. Guarda todos os indicadores,
 * macros e aprovações nacionais e estaduais em cada mês.
 */
export interface MonthlyDigest {
  id?: number;
  saveId: number;
  month: number;
  national: Record<string, number>;
  /** Valores de todos os indicadores estaduais no fechamento do mês. */
  stateIndicators: Record<StateId, Record<string, number>>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
  stateApprovals: Record<StateId, number>;
  nationalApproval: number;
}

export type Chamber = 'camara' | 'senado' | 'stf';

export interface Member {
  id?: number;
  saveId: number;
  chamber: Chamber;
  name: string;
  partyId: string | null;
  ideology: Ideology;
  approval: number;
}

// ============================================================
// DB
// ============================================================

const db = new Dexie('PoliticalGameDB') as Dexie & {
  saves: EntityTable<SaveGame, 'id'>;
  monthlyHistory: EntityTable<MonthlyDigest, 'id'>;
  members: EntityTable<Member, 'id'>;
};

// ------------------------------------------------------------
// v1–v3: legado (mantidas para quem já tem DB criado)
// ------------------------------------------------------------

db.version(1).stores({
  saves: '++id, updatedAt, month',
  monthlyHistory: '++id, saveId, month',
});

db.version(2).stores({
  members: '++id, saveId, [saveId+chamber], partyId',
});

db.version(3).stores({}).upgrade(async (tx) => {
  // Legado: renomeava grupos antigos no `state.groups`.
  // Não faz mais sentido com o novo formato — mantido só para
  // preservar a cadeia de versões do Dexie.
  await Promise.resolve(tx);
});

// ------------------------------------------------------------
// v4: reescrita do motor.
// `GameState` mudou completamente de formato. Saves antigos
// são incompatíveis. Wipamos `saves` e `monthlyHistory`,
// mantemos `members` (não dependem do formato).
// ------------------------------------------------------------

db.version(4)
  .stores({
    saves: '++id, updatedAt, month',
    monthlyHistory: '++id, saveId, month',
    members: '++id, saveId, [saveId+chamber], partyId',
  })
  .upgrade(async (tx) => {
    await tx.table('saves').clear();
    await tx.table('monthlyHistory').clear();
    // `members` fica — pode ser reutilizado.
  });

// v5: índice composto para localizar e atualizar o digest do mês sem duplicá-lo.
db.version(5).stores({
  saves: '++id, updatedAt, month',
  monthlyHistory: '++id, saveId, month, [saveId+month]',
  members: '++id, saveId, [saveId+chamber], partyId',
});

// ============================================================
// SAVE / LOAD
// ============================================================

export async function createSave(
  name: string,
  game: GameState,
): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.transaction('rw', db.saves, db.monthlyHistory, async () => {
    const saveId = await db.saves.add({
      name,
      createdAt: now,
      updatedAt: now,
      month: game.month,
      game,
    });
    await writeMonthlyDigest(saveId as number, game);
    return saveId;
  });
  return id as number;
}

export async function updateSave(
  saveId: number,
  game: GameState,
): Promise<void> {
  await db.saves.update(saveId, {
    updatedAt: new Date().toISOString(),
    month: game.month,
    game,
  });
}

export async function loadSave(saveId: number): Promise<SaveGame | undefined> {
  return db.saves.get(saveId);
}

export async function listSaves(): Promise<SaveGame[]> {
  return db.saves.orderBy('updatedAt').reverse().toArray();
}

export async function deleteSave(saveId: number): Promise<void> {
  await db.transaction(
    'rw',
    db.saves,
    db.monthlyHistory,
    db.members,
    async () => {
      await db.saves.delete(saveId);
      await db.monthlyHistory.where('saveId').equals(saveId).delete();
      await db.members.where('saveId').equals(saveId).delete();
    },
  );
}

// ============================================================
// DIGEST MENSAL
// ============================================================

export async function appendMonthlyDigest(
  saveId: number,
  digest: Omit<MonthlyDigest, 'id' | 'saveId'>,
): Promise<void> {
  const existing = await db.monthlyHistory
    .where('[saveId+month]')
    .equals([saveId, digest.month])
    .first();
  if (existing?.id !== undefined) {
    await db.monthlyHistory.update(existing.id, { ...digest, saveId });
  } else {
    await db.monthlyHistory.add({ ...digest, saveId });
  }
}

async function writeMonthlyDigest(saveId: number, game: GameState): Promise<void> {
  await appendMonthlyDigest(saveId, {
    month: game.month,
    national: { ...game.nationalIndicators },
    stateIndicators: Object.fromEntries(
      Object.entries(game.stateIndicators).map(([id, values]) => [id, { ...values }]),
    ) as GameState['stateIndicators'],
    macros: { ...game.macros },
    groupApprovals: { ...game.groupApprovals },
    stateApprovals: { ...game.stateApprovals },
    nationalApproval: game.nationalApproval,
  });
}

export async function loadMonthlyHistory(
  saveId: number,
): Promise<MonthlyDigest[]> {
  return db.monthlyHistory.where('saveId').equals(saveId).sortBy('month');
}

// ============================================================
// SAVE MANAGER
// ============================================================
// Encapsula o auto-save. O store cria um SaveManager quando
// um jogo começa e chama `.persist(game)` a cada turno.
//
// Faz duas coisas:
//   1. Atualiza o registro em `saves` (estado completo).
//   2. Se o mês mudou desde a última gravação, adiciona um digest
//      em `monthlyHistory`, incluindo valores estaduais para séries históricas.

export class SaveManager {
  private saveId: number;
  private inflight: Promise<void> | null = null;

  constructor(saveId: number) {
    this.saveId = saveId;
  }

  get id(): number {
    return this.saveId;
  }

  /**
   * Persiste o estado e seu digest mensal atomicamente. Serializa chamadas.
   */
  persist(game: GameState): Promise<void> {
    const next = (this.inflight ?? Promise.resolve()).then(() =>
      this.doPersist(game),
    );
    this.inflight = next.catch(() => {});
    return next;
  }

  private async doPersist(game: GameState): Promise<void> {
    try {
      await db.transaction('rw', db.saves, db.monthlyHistory, async () => {
        await db.saves.update(this.saveId, {
          updatedAt: new Date().toISOString(),
          month: game.month,
          game,
        });
        await writeMonthlyDigest(this.saveId, game);
      });
    } catch (err) {
      console.error('[SaveManager] falha ao persistir:', err);
      throw err;
    }
  }
}

// ============================================================
// MIGRAÇÃO DE SNAPSHOT LEGADO
// ============================================================
// Se algum código antigo ainda chama `migrateGroups`, mantemos
// uma versão neutra aqui pra não quebrar. Não usa catálogo novo.

export function migrateGroups(
  old: { id: string; approval: number }[] = [],
): { id: string; name: string; approval: number }[] {
  // Não há mais renomes de grupo — o catálogo novo já é a fonte.
  // Só devolvemos o que veio, clampado.
  return old.map((g) => ({
    id: g.id,
    name: g.id,
    approval: Math.max(1, Math.min(100, Number(g.approval) || 50)),
  }));
}

export { db };
