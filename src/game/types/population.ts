import { GROUPS } from '../data/catalog';

// Os grupos agora vivem SÓ em data/catalog.ts. Este arquivo apenas define o
// formato do estado e um valor neutro de fallback (o jogo real usa
// buildInitialGroups(perfil), em services/profileService.ts).
export type SocialGroup = string;

export interface GroupData {
    id: SocialGroup;
    name: string;
    approval: number;
}

export const initialGroups: GroupData[] = GROUPS.map((g) => ({ id: g.id, name: g.nome, approval: 50 }));