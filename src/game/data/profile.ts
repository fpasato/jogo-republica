// src/game/data/profile.ts

export const SLIDER_MIN = -3;
export const SLIDER_MAX = 3;
export const SLIDER_BUDGET = 21;

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
    nome: 'Economia e Mercado',
    esquerda: 'Estatista / Desenvolvimentista',
    direita: 'Liberal / Pró-Mercado',
    afinidade: {
      liberais_economicos: 5,
      empresarios: 4,
      agronegocio: 3,
      classe_media: 2,
      trabalhistas: -4,
      servidores_publicos: -4,
      baixa_renda: -3,
    },
  },
  {
    id: 'costumes',
    nome: 'Costumes e Sociedade',
    esquerda: 'Progressista / Direitos Civis',
    direita: 'Conservador / Valores Tradicionais',
    afinidade: {
      conservadores: 5,
      religiosos: 5,
      idosos: 3,
      progressistas: -5,
      jovens: -3,
    },
  },
  {
    id: 'seguranca',
    nome: 'Segurança Pública',
    esquerda: 'Garantista / Direitos Humanos',
    direita: 'Linha-Dura / Punição Severa',
    afinidade: {
      conservadores: 4,
      religiosos: 3,
      classe_media: 3,
      progressistas: -4,
      jovens: -2,
    },
  },
  {
    id: 'ambiente',
    nome: 'Meio Ambiente e Clima',
    esquerda: 'Ambientalista / Transição Verde',
    direita: 'Produtivista / Exploração Agro-Mineral',
    afinidade: {
      progressistas: 4,
      jovens: 3,
      agronegocio: -5,
      empresarios: -3,
    },
  },
  {
    id: 'gasto_social',
    nome: 'Redistribuição e Gasto Social',
    esquerda: 'Austeridade / Teto de Gastos',
    direita: 'Expansão de Benefícios / Assistencialismo',
    afinidade: {
      baixa_renda: 5,
      trabalhistas: 4,
      servidores_publicos: 3,
      idosos: 3,
      jovens: 2,
      liberais_economicos: -5,
      empresarios: -3,
    },
  },
  {
    id: 'trabalho',
    nome: 'Relações de Trabalho',
    esquerda: 'Proteção Sindical e CLT',
    direita: 'Flexibilização e Desregulamentação',
    afinidade: {
      trabalhistas: -5,
      servidores_publicos: -3,
      baixa_renda: -4,
      empresarios: 5,
      liberais_economicos: 4,
      agronegocio: 3,
    },
  },
  {
    id: 'politica_externa',
    nome: 'Comércio e Relações Internacionais',
    esquerda: 'Soberanista / Sul Global e Mercosul',
    direita: 'Abertura de Mercados / Alinhamento Ocidental',
    afinidade: {
      agronegocio: 5,
      empresarios: 4,
      liberais_economicos: 4,
      progressistas: -2,
      trabalhistas: -2,
    },
  },
];