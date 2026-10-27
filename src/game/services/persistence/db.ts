// src/game/services/persistence/db.ts

import Dexie, { type EntityTable } from 'dexie';
import type { GameState } from '../engine/initialState';
import type { Ideology } from '../../types/politics';

export interface SaveGame {
  id?: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  month: number;
  game: GameState;
}

export interface MonthlyDigest {
  id?: number;
  saveId: number;
  month: number;
  national: Record<string, number>;
  macros: Record<string, number>;
  groupApprovals: Record<string, number>;
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

const db = new Dexie('PoliticalGameDB') as Dexie & {
  saves: EntityTable<SaveGame, 'id'>;
  monthlyHistory: EntityTable<MonthlyDigest, 'id'>;
  members: EntityTable<Member, 'id'>;
};

db.version(1).stores({
  saves: '++id, updatedAt, month',
  monthlyHistory: '++id, saveId, month',
});

db.version(2).stores({
  members: '++id, saveId, [saveId+chamber], partyId',
});

db.version(3).stores({}).upgrade(async (tx) => {
  await Promise.resolve(tx);
});

db.version(4)
  .stores({
    saves: '++id, updatedAt, month',
    monthlyHistory: '++id, saveId, month',
    members: '++id, saveId, [saveId+chamber], partyId',
  })
  .upgrade(async (tx) => {
    await tx.table('saves').clear();
    await tx.table('monthlyHistory').clear();
  });

db.version(5).stores({
  monthlyHistory: '++id, saveId, month, [saveId+month]',
});

db.version(6).stores({}).upgrade(async (tx) => {
  await tx.table('saves').clear();
  await tx.table('monthlyHistory').clear();
});

export { db };

export async function createSave(name: string, state: GameState): Promise<number> {
  const now = new Date().toISOString();
  return (await db.saves.add({
    name,
    createdAt: now,
    updatedAt: now,
    month: state.month,
    game: state,
  })) as number;
}

export async function loadSave(id: number): Promise<SaveGame | undefined> {
  return db.saves.get(id);
}

export async function saveGameState(id: number, state: GameState): Promise<void> {
  await db.saves.update(id, {
    updatedAt: new Date().toISOString(),
    month: state.month,
    game: state,
  });

  const existing = await db.monthlyHistory
    .where('[saveId+month]')
    .equals([id, state.month])
    .first();

  if (existing?.id) {
    await db.monthlyHistory.update(existing.id, {
      national: state.nationalIndicators,
      macros: state.macros,
      groupApprovals: state.groupApprovals,
      nationalApproval: state.nationalApproval,
    });
  } else {
    await db.monthlyHistory.add({
      saveId: id,
      month: state.month,
      national: state.nationalIndicators,
      macros: state.macros,
      groupApprovals: state.groupApprovals,
      nationalApproval: state.nationalApproval,
    });
  }
}

export class SaveManager {
  private saveId: number;

  constructor(saveId: number) {
    this.saveId = saveId;
  }

  async autoSave(state: GameState): Promise<void> {
    await saveGameState(this.saveId, state);
  }
}

