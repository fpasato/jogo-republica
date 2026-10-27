import type { GroupData } from './population';
import type { ActivePolicy, PolicyHistoryEntry } from './policy';
import type { Party, Minister } from './politics';

export interface NationalData {
  values: Record<string, number>;
}

export interface GameState {
  month: number;
  year: number;
  national: Record<string, number>;
  activePolicies: ActivePolicy[];
  policyHistory: PolicyHistoryEntry[];
  politics: {
    parties: Party[];
    stf: Minister[];
  };
}
