// src/game/data/profile.ts

export const SLIDER_MIN = -3;
export const SLIDER_MAX = 3;
export const SLIDER_BUDGET = 15;

export interface ProfileAxis {
  id: string;
  nome: string;
  esquerda: string;
  direita: string;
  afinidade: Record<string, number>;
}

export const PROFILE_AXES: ProfileAxis[] = [
  {
    id: 'economia',
    nome: 'Economia',
    esquerda: 'Estatista',
    direita: 'Liberal',
    afinidade: {
      liberais_economicos: 4,
      empresarios: 3,
      agronegocio: 2,
      classe_media: 1,
      trabalhistas: -3,
      servidores_publicos: -3,
      baixa_renda: -2,
    },
  },
  {
    id: 'costumes',
    nome: 'Costumes',
    esquerda: 'Progressista',
    direita: 'Conservador',
    afinidade: {
      conservadores: 4,
      religiosos: 4,
      idosos: 2,
      progressistas: -4,
      jovens: -2,
    },
  },
  {
    id: 'seguranca',
    nome: 'Segurança',
    esquerda: 'Garantista',
    direita: 'Linha dura',
    afinidade: {
      conservadores: 3,
      religiosos: 2,
      classe_media: 2,
      progressistas: -3,
      jovens: -1,
    },
  },
  {
    id: 'ambiente',
    nome: 'Meio ambiente',
    esquerda: 'Desenvolvimentista',
    direita: 'Ambientalista',
    afinidade: {
      progressistas: 3,
      jovens: 2,
      agronegocio: -4,
      empresarios: -2,
    },
  },
  {
    id: 'gasto_social',
    nome: 'Gasto social',
    esquerda: 'Austeridade',
    direita: 'Expansão',
    afinidade: {
      baixa_renda: 4,
      trabalhistas: 3,
      servidores_publicos: 2,
      idosos: 2,
      jovens: 1,
      liberais_economicos: -4,
      empresarios: -2,
    },
  },
];