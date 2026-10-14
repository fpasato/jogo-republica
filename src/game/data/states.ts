// ============================================================
// TIPOS
// ============================================================

export type Region =
  | 'Norte'
  | 'Nordeste'
  | 'Centro-Oeste'
  | 'Sudeste'
  | 'Sul';

export type StateId =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO'
  | 'MA' | 'MT' | 'MS' | 'MG' | 'PA' | 'PB' | 'PR' | 'PE' | 'PI'
  | 'RJ' | 'RN' | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';

export interface StateStructural {
  id: StateId;
  name: string;
  region: Region;
  /** População total residente (absoluta). */
  population: number;
  /** Fração da população economicamente ativa (0–1). */
  peaShare: number;
  /** Fração em idade escolar obrigatória (0–1). */
  studentShare: number;
  /** Fração de crianças 0–14 (0–1). */
  childShare: number;
  /** Fração de idosos 60+ (0–1). */
  elderlyShare: number;
  /** -1 = esquerda, 0 = centro, +1 = direita. */
  politicalInclination: number;
}

// ============================================================
// DADOS
// ============================================================
// População: estimativas IBGE 2024.
// peaShare / studentShare / childShare / elderlyShare: aproximações.
// politicalInclination: histórico eleitoral simplificado, escala -1..+1.

export const STATES: Record<StateId, StateStructural> = {
  // ---------- NORTE ----------
  AC: { id: 'AC', name: 'Acre',              region: 'Norte',        population:   830_018, peaShare: 0.58, studentShare: 0.24, childShare: 0.30, elderlyShare: 0.10, politicalInclination:  0.10 },
  AP: { id: 'AP', name: 'Amapá',             region: 'Norte',        population:   733_759, peaShare: 0.58, studentShare: 0.25, childShare: 0.31, elderlyShare: 0.09, politicalInclination:  0.00 },
  AM: { id: 'AM', name: 'Amazonas',          region: 'Norte',        population: 3_941_613, peaShare: 0.58, studentShare: 0.25, childShare: 0.31, elderlyShare: 0.09, politicalInclination: -0.20 },
  PA: { id: 'PA', name: 'Pará',              region: 'Norte',        population: 8_121_025, peaShare: 0.57, studentShare: 0.25, childShare: 0.31, elderlyShare: 0.10, politicalInclination:  0.10 },
  RO: { id: 'RO', name: 'Rondônia',          region: 'Norte',        population: 1_581_196, peaShare: 0.60, studentShare: 0.24, childShare: 0.28, elderlyShare: 0.11, politicalInclination:  0.40 },
  RR: { id: 'RR', name: 'Roraima',           region: 'Norte',        population:   636_303, peaShare: 0.58, studentShare: 0.26, childShare: 0.32, elderlyShare: 0.08, politicalInclination:  0.20 },
  TO: { id: 'TO', name: 'Tocantins',         region: 'Norte',        population: 1_511_459, peaShare: 0.60, studentShare: 0.24, childShare: 0.28, elderlyShare: 0.11, politicalInclination:  0.30 },

  // ---------- NORDESTE ----------
  AL: { id: 'AL', name: 'Alagoas',           region: 'Nordeste',     population: 3_127_511, peaShare: 0.55, studentShare: 0.27, childShare: 0.33, elderlyShare: 0.11, politicalInclination: -0.30 },
  BA: { id: 'BA', name: 'Bahia',             region: 'Nordeste',     population: 14_141_626, peaShare: 0.56, studentShare: 0.26, childShare: 0.32, elderlyShare: 0.12, politicalInclination: -0.50 },
  CE: { id: 'CE', name: 'Ceará',             region: 'Nordeste',     population: 8_794_957, peaShare: 0.56, studentShare: 0.26, childShare: 0.32, elderlyShare: 0.12, politicalInclination: -0.40 },
  MA: { id: 'MA', name: 'Maranhão',          region: 'Nordeste',     population: 6_776_699, peaShare: 0.54, studentShare: 0.28, childShare: 0.34, elderlyShare: 0.10, politicalInclination: -0.40 },
  PB: { id: 'PB', name: 'Paraíba',           region: 'Nordeste',     population: 3_974_495, peaShare: 0.55, studentShare: 0.27, childShare: 0.33, elderlyShare: 0.12, politicalInclination: -0.30 },
  PE: { id: 'PE', name: 'Pernambuco',        region: 'Nordeste',     population: 9_058_931, peaShare: 0.56, studentShare: 0.26, childShare: 0.32, elderlyShare: 0.12, politicalInclination: -0.40 },
  PI: { id: 'PI', name: 'Piauí',             region: 'Nordeste',     population: 3_271_199, peaShare: 0.54, studentShare: 0.28, childShare: 0.34, elderlyShare: 0.11, politicalInclination: -0.30 },
  RN: { id: 'RN', name: 'Rio Grande do Norte', region: 'Nordeste',   population: 3_303_953, peaShare: 0.56, studentShare: 0.26, childShare: 0.32, elderlyShare: 0.12, politicalInclination: -0.20 },
  SE: { id: 'SE', name: 'Sergipe',           region: 'Nordeste',     population: 2_210_062, peaShare: 0.56, studentShare: 0.27, childShare: 0.33, elderlyShare: 0.11, politicalInclination: -0.20 },

  // ---------- CENTRO-OESTE ----------
  DF: { id: 'DF', name: 'Distrito Federal',  region: 'Centro-Oeste', population: 2_817_381, peaShare: 0.64, studentShare: 0.22, childShare: 0.26, elderlyShare: 0.12, politicalInclination: -0.10 },
  GO: { id: 'GO', name: 'Goiás',             region: 'Centro-Oeste', population: 7_056_495, peaShare: 0.61, studentShare: 0.24, childShare: 0.28, elderlyShare: 0.12, politicalInclination:  0.30 },
  MT: { id: 'MT', name: 'Mato Grosso',       region: 'Centro-Oeste', population: 3_658_649, peaShare: 0.63, studentShare: 0.24, childShare: 0.29, elderlyShare: 0.10, politicalInclination:  0.50 },
  MS: { id: 'MS', name: 'Mato Grosso do Sul',region: 'Centro-Oeste', population: 2_757_013, peaShare: 0.62, studentShare: 0.24, childShare: 0.28, elderlyShare: 0.12, politicalInclination:  0.40 },

  // ---------- SUDESTE ----------
  ES: { id: 'ES', name: 'Espírito Santo',    region: 'Sudeste',      population: 3_833_712, peaShare: 0.61, studentShare: 0.23, childShare: 0.27, elderlyShare: 0.13, politicalInclination:  0.00 },
  MG: { id: 'MG', name: 'Minas Gerais',      region: 'Sudeste',      population: 20_538_718, peaShare: 0.61, studentShare: 0.23, childShare: 0.26, elderlyShare: 0.15, politicalInclination:  0.10 },
  RJ: { id: 'RJ', name: 'Rio de Janeiro',    region: 'Sudeste',      population: 16_054_041, peaShare: 0.61, studentShare: 0.23, childShare: 0.26, elderlyShare: 0.16, politicalInclination: -0.20 },
  SP: { id: 'SP', name: 'São Paulo',         region: 'Sudeste',      population: 44_411_238, peaShare: 0.63, studentShare: 0.23, childShare: 0.26, elderlyShare: 0.15, politicalInclination:  0.20 },

  // ---------- SUL ----------
  PR: { id: 'PR', name: 'Paraná',            region: 'Sul',          population: 11_444_380, peaShare: 0.62, studentShare: 0.23, childShare: 0.26, elderlyShare: 0.14, politicalInclination:  0.30 },
  RS: { id: 'RS', name: 'Rio Grande do Sul', region: 'Sul',          population: 10_882_965, peaShare: 0.62, studentShare: 0.22, childShare: 0.25, elderlyShare: 0.16, politicalInclination:  0.00 },
  SC: { id: 'SC', name: 'Santa Catarina',    region: 'Sul',          population: 7_610_361, peaShare: 0.63, studentShare: 0.23, childShare: 0.25, elderlyShare: 0.14, politicalInclination:  0.40 },
};

export const STATE_IDS = Object.keys(STATES) as StateId[];
export const REGIONS: Region[] = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

export function statesByRegion(region: Region): StateStructural[] {
  return STATE_IDS.map((id) => STATES[id]).filter((s) => s.region === region);
}

export function totalPopulation(): number {
  return STATE_IDS.reduce((acc, id) => acc + STATES[id].population, 0);
}

export function regionPopulation(region: Region): number {
  return statesByRegion(region).reduce((acc, s) => acc + s.population, 0);
}