import { GROUPS } from '../data/groups';

export type SocialGroup = string;

export interface GroupData {
  id: SocialGroup;
  name: string;
  approval: number;
  influence: number;
}

export const initialGroups: GroupData[] = GROUPS.map((g) => ({
  id: g.id,
  name: g.nome,
  approval: g.initialApproval,
  influence: g.peso,
}));