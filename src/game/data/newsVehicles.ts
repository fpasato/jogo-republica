// src/game/data/newsVehicles.ts

// ============================================================
// VEÍCULOS DE IMPRENSA
// ============================================================
// Cada veículo tem um viés editorial que a IA de notícia usa
// pra escolher qual publicar cada matéria e como escrever.

export type VehicleBias =
  | 'centro'
  | 'esquerda'
  | 'direita'
  | 'mercado'
  | 'popular'
  | 'progressista';

export interface NewsVehicle {
  id: string;
  nome: string;
  bias: VehicleBias;
  /** Estilo editorial — vai pro prompt da IA pra calibrar linguagem. */
  estilo: string;
}

export const NEWS_VEHICLES: NewsVehicle[] = [
  {
    id: 'correio_nacional',
    nome: 'O Correio Nacional',
    bias: 'centro',
    estilo: 'Sóbrio, factual, sem adjetivos. Usa dados e contexto.',
  },
  {
    id: 'gazeta_brasil',
    nome: 'Gazeta do Brasil',
    bias: 'direita',
    estilo: 'Crítico ao governo, foco em custo fiscal, carga tributária e segurança.',
  },
  {
    id: 'diario_cidadao',
    nome: 'Diário Cidadão',
    bias: 'esquerda',
    estilo: 'Foco em direitos sociais, desigualdade e impacto nas camadas populares.',
  },
  {
    id: 'jornal_economico',
    nome: 'Jornal Econômico',
    bias: 'mercado',
    estilo: 'Técnico, cita juros, câmbio, PIB, risco-país. Tom analítico.',
  },
  {
    id: 'voz_popular',
    nome: 'Voz Popular',
    bias: 'popular',
    estilo: 'Linguagem simples, foco no bolso do trabalhador e no dia a dia.',
  },
  {
    id: 'observador_progressista',
    nome: 'Observador Progressista',
    bias: 'progressista',
    estilo: 'Pautas de direitos humanos, meio ambiente e minorias.',
  },
];

export const VEHICLE_BY_ID: Record<string, NewsVehicle> = Object.fromEntries(
  NEWS_VEHICLES.map((v) => [v.id, v]),
);

export function getVehicle(id: string): NewsVehicle {
  return VEHICLE_BY_ID[id] ?? NEWS_VEHICLES[0];
}