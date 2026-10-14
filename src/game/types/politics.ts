export type Ideology =
  | 'extrema_esquerda'
  | 'esquerda'
  | 'centro_esquerda'
  | 'centro'
  | 'centro_direita'
  | 'direita'
  | 'extrema_direita';

export interface Party {
  id: string;
  name: string;
  acronym: string;
  ideology: Ideology;
  deputies: number; // Total must be 513
  senators: number; // Total must be 81
  governmentAlignment: number; // 0 to 100 - base approval of the government
}

export interface Minister {
  id: string;
  name: string;
  ideology: Ideology;
  governmentAlignment: number; // 0 to 100
}

export interface PoliticsState {
  parties: Party[];
  stf: Minister[];
}

// ---------------------------------------------------------------------------
// Composição Inicial
// ---------------------------------------------------------------------------

export const initialParties: Party[] = [
  // ---------- Esquerda ----------
  {
    id: 'pt',
    name: 'Partido dos Trabalhadores',
    acronym: 'PT',
    ideology: 'esquerda',
    deputies: 70,
    senators: 9,
    governmentAlignment: 95,
  },
  {
    id: 'psol',
    name: 'Partido Socialismo e Liberdade',
    acronym: 'PSOL',
    ideology: 'esquerda',
    deputies: 14,
    senators: 0,
    governmentAlignment: 85,
  },
  {
    id: 'pcdo_b',
    name: 'Partido Comunista do Brasil',
    acronym: 'PCdoB',
    ideology: 'esquerda',
    deputies: 11,
    senators: 0,
    governmentAlignment: 90,
  },
  {
    id: 'psb',
    name: 'Partido Socialista Brasileiro',
    acronym: 'PSB',
    ideology: 'centro_esquerda',
    deputies: 15,
    senators: 4,
    governmentAlignment: 75,
  },
  {
    id: 'rede',
    name: 'Rede Sustentabilidade',
    acronym: 'REDE',
    ideology: 'centro_esquerda',
    deputies: 1,
    senators: 1,
    governmentAlignment: 70,
  },
  {
    id: 'pv',
    name: 'Partido Verde',
    acronym: 'PV',
    ideology: 'centro_esquerda',
    deputies: 7,
    senators: 0,
    governmentAlignment: 80,
  },

  // ---------- Centro ----------
  {
    id: 'mdb',
    name: 'Movimento Democrático Brasileiro',
    acronym: 'MDB',
    ideology: 'centro',
    deputies: 36,
    senators: 8,
    governmentAlignment: 65,
  },
  {
    id: 'psd',
    name: 'Partido Social Democrático',
    acronym: 'PSD',
    ideology: 'centro',
    deputies: 43,
    senators: 6, // era 5: o total de senadores somava 80
    governmentAlignment: 60,
  },
  {
    id: 'psdb',
    name: 'Partido da Social Democracia Brasileira',
    acronym: 'PSDB',
    ideology: 'centro',
    deputies: 11,
    senators: 2,
    governmentAlignment: 50,
  },
  {
    id: 'podemos',
    name: 'Podemos',
    acronym: 'PODE',
    ideology: 'centro',
    deputies: 27,
    senators: 2,
    governmentAlignment: 50,
  },
  {
    id: 'solidariedade',
    name: 'Solidariedade',
    acronym: 'SD',
    ideology: 'centro',
    deputies: 2,
    senators: 0,
    governmentAlignment: 60,
  },

  // ---------- Centro-direita / Direita ----------
  {
    id: 'uniao',
    name: 'União Brasil',
    acronym: 'UNIÃO',
    ideology: 'centro_direita',
    deputies: 46,
    senators: 5,
    governmentAlignment: 50,
  },
  {
    id: 'pp',
    name: 'Progressistas',
    acronym: 'PP',
    ideology: 'centro_direita',
    deputies: 41,
    senators: 6,
    governmentAlignment: 55,
  },
  {
    id: 'republicanos',
    name: 'Republicanos',
    acronym: 'REPUBLICANOS',
    ideology: 'centro_direita',
    deputies: 41,
    senators: 6,
    governmentAlignment: 45,
  },
  {
    id: 'novo',
    name: 'Partido Novo',
    acronym: 'NOVO',
    ideology: 'direita',
    deputies: 10,
    senators: 3,
    governmentAlignment: 15,
  },
  {
    id: 'pl',
    name: 'Partido Liberal',
    acronym: 'PL',
    ideology: 'direita',
    deputies: 121,
    senators: 28,
    governmentAlignment: 10,
  },
  {
    id: 'missao',
    name: 'Partido Missão',
    acronym: 'MISSÃO',
    ideology: 'direita',
    deputies: 1,
    senators: 0,
    governmentAlignment: 20,
  },

  // ---------- Outros ----------
  {
    id: 'avante',
    name: 'Avante',
    acronym: 'AVANTE',
    ideology: 'centro',
    deputies: 5,
    senators: 0,
    governmentAlignment: 60,
  },
  {
    id: 'prd',
    name: 'Partido Renovação Democrática',
    acronym: 'PRD',
    ideology: 'centro_direita',
    deputies: 5,
    senators: 0,
    governmentAlignment: 50,
  },
  {
    id: 'pdt',
    name: 'Partido Democrático Trabalhista',
    acronym: 'PDT',
    ideology: 'centro_esquerda',
    deputies: 6,
    senators: 1,
    governmentAlignment: 70,
  },
];

export const initialSTF: Minister[] = [
  { id: 'm1', name: 'Helena Nogueira', ideology: 'centro_esquerda', governmentAlignment: 65 },
  { id: 'm2', name: 'Alexandre de Campos', ideology: 'centro', governmentAlignment: 50 },
  { id: 'm3', name: 'Gilmar Bastos', ideology: 'centro_direita', governmentAlignment: 40 },
  { id: 'm4', name: 'Ricardo Lemos', ideology: 'esquerda', governmentAlignment: 85 },
  { id: 'm5', name: 'Roberto Barreto', ideology: 'centro', governmentAlignment: 55 },
  { id: 'm6', name: 'Cecília Meireles', ideology: 'centro_esquerda', governmentAlignment: 60 },
  { id: 'm7', name: 'Augusto Dias', ideology: 'direita', governmentAlignment: 25 },
  { id: 'm8', name: 'Carlos Nunes', ideology: 'centro_direita', governmentAlignment: 35 },
  { id: 'm9', name: 'André Silva', ideology: 'direita', governmentAlignment: 20 },
  { id: 'm10', name: 'Luiz Fonseca', ideology: 'centro', governmentAlignment: 45 },
  { id: 'm11', name: 'Edson Ferraz', ideology: 'esquerda', governmentAlignment: 75 },
];