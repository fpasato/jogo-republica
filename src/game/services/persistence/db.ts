import Dexie, { type EntityTable } from 'dexie';
import type { GameState } from '../../types/game';
import type { Ideology } from '../../types/politics';
import type { StateId } from '../../types/game';

// ============================================================
// TIPOS
// ============================================================

export interface SaveGame {
  id?: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  turn: number;
  game: GameState;
}

/**
 * Digest mensal — versão leve do estado gravada a cada turno.
 * Guarda indicadores, sliders, grupos e aprovação dos estados.
 */
export interface MonthlyDigest {
  id?: number;
  saveId: number;
  turn: number;
  indicators: Record<string, number>;
  sliders: Record<string, number>;
  groups: Record<string, number>;
  states: Record<StateId, number>;
  approval: number;
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

// Versões antigas — mantidas para quem já tem DB criado.
db.version(1).stores({
  saves: '++id, updatedAt, month',
  monthlyHistory: '++id, saveId, month',
});
db.version(2).stores({
  members: '++id, saveId, [saveId+chamber], partyId',
});
db.version(3).stores({}).upgrade(async tx => { await Promise.resolve(tx); });
db.version(4)
  .stores({
    saves: '++id, updatedAt, month',
    monthlyHistory: '++id, saveId, month',
    members: '++id, saveId, [saveId+chamber], partyId',
  })
  .upgrade(async tx => {
    await tx.table('saves').clear();
    await tx.table('monthlyHistory').clear();
  });

// v6: novo motor (turn + digest reformulado). Wipa saves e histórico,
// mantém members.
db.version(6)
  .stores({
    saves: '++id, updatedAt, turn',
    monthlyHistory: '++id, saveId, turn, [saveId+turn]',
    members: '++id, saveId, [saveId+chamber], partyId',
  })
  .upgrade(async tx => {
    await tx.table('saves').clear();
    await tx.table('monthlyHistory').clear();
  });

// ============================================================
// SAVE / LOAD
// ============================================================

export async function createSave(name: string, game: GameState): Promise<number> {
  const now = new Date().toISOString();
  return db.transaction('rw', db.saves, db.monthlyHistory, async () => {
    const saveId = await db.saves.add({
      name,
      createdAt: now,
      updatedAt: now,
      turn: game.turn,
      game,
    });
    await writeMonthlyDigest(saveId as number, game);
    return saveId as number;
  });
}

export async function updateSave(saveId: number, game: GameState): Promise<void> {
  await db.saves.update(saveId, {
    updatedAt: new Date().toISOString(),
    turn: game.turn,
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
  await db.transaction('rw', db.saves, db.monthlyHistory, db.members, async () => {
    await db.saves.delete(saveId);
    await db.monthlyHistory.where('saveId').equals(saveId).delete();
    await db.members.where('saveId').equals(saveId).delete();
  });
}

// ============================================================
// DIGEST MENSAL
// ============================================================

export async function appendMonthlyDigest(
  saveId: number,
  digest: Omit<MonthlyDigest, 'id' | 'saveId'>,
): Promise<void> {
  const existing = await db.monthlyHistory
    .where('[saveId+turn]')
    .equals([saveId, digest.turn])
    .first();
  if (existing?.id !== undefined) {
    await db.monthlyHistory.update(existing.id, { ...digest, saveId });
  } else {
    await db.monthlyHistory.add({ ...digest, saveId });
  }
}

async function writeMonthlyDigest(saveId: number, game: GameState): Promise<void> {
  await appendMonthlyDigest(saveId, {
    turn: game.turn,
    indicators: { ...game.indicators },
    sliders: { ...game.sliders },
    groups: Object.fromEntries(
      Object.entries(game.groups).map(([id, g]) => [id, g.support]),
    ),
    states: Object.fromEntries(
      Object.entries(game.states).map(([id, s]) => [id, s.approval]),
    ) as Record<StateId, number>,
    approval: game.indicators.aprovacao,
  });
}

export async function loadMonthlyHistory(saveId: number): Promise<MonthlyDigest[]> {
  return db.monthlyHistory.where('saveId').equals(saveId).sortBy('turn');
}

export { db };