import type { State, StateId } from '../types/game';

/** População em milhões (aprox. 2023) — peso político calibrado por influência histórica */
export const STATES: Record<StateId, State> = {
  AC: { id: 'AC', name: 'Acre',               region: 'Norte',        population: 0.83, politicalWeight: 0.008, initialApproval: 50 },
  AL: { id: 'AL', name: 'Alagoas',            region: 'Nordeste',     population: 3.13, politicalWeight: 0.016, initialApproval: 55 },
  AP: { id: 'AP', name: 'Amapá',              region: 'Norte',        population: 0.77, politicalWeight: 0.008, initialApproval: 50 },
  AM: { id: 'AM', name: 'Amazonas',           region: 'Norte',        population: 4.27, politicalWeight: 0.020, initialApproval: 52 },
  BA: { id: 'BA', name: 'Bahia',              region: 'Nordeste',     population: 14.1, politicalWeight: 0.075, initialApproval: 55 },
  CE: { id: 'CE', name: 'Ceará',              region: 'Nordeste',     population: 9.24, politicalWeight: 0.048, initialApproval: 54 },
  DF: { id: 'DF', name: 'Distrito Federal',   region: 'Centro-Oeste', population: 2.82, politicalWeight: 0.025, initialApproval: 48 },
  ES: { id: 'ES', name: 'Espírito Santo',     region: 'Sudeste',      population: 3.83, politicalWeight: 0.022, initialApproval: 50 },
  GO: { id: 'GO', name: 'Goiás',              region: 'Centro-Oeste', population: 7.06, politicalWeight: 0.035, initialApproval: 52 },
  MA: { id: 'MA', name: 'Maranhão',           region: 'Nordeste',     population: 6.78, politicalWeight: 0.032, initialApproval: 56 },
  MT: { id: 'MT', name: 'Mato Grosso',        region: 'Centro-Oeste', population: 3.66, politicalWeight: 0.024, initialApproval: 51 },
  MS: { id: 'MS', name: 'Mato Grosso do Sul', region: 'Centro-Oeste', population: 2.76, politicalWeight: 0.018, initialApproval: 51 },
  MG: { id: 'MG', name: 'Minas Gerais',       region: 'Sudeste',      population: 20.5, politicalWeight: 0.105, initialApproval: 52 },
  PA: { id: 'PA', name: 'Pará',               region: 'Norte',        population: 8.12, politicalWeight: 0.042, initialApproval: 53 },
  PB: { id: 'PB', name: 'Paraíba',            region: 'Nordeste',     population: 3.97, politicalWeight: 0.020, initialApproval: 55 },
  PR: { id: 'PR', name: 'Paraná',             region: 'Sul',          population: 11.4, politicalWeight: 0.062, initialApproval: 49 },
  PE: { id: 'PE', name: 'Pernambuco',         region: 'Nordeste',     population: 9.05, politicalWeight: 0.048, initialApproval: 54 },
  PI: { id: 'PI', name: 'Piauí',              region: 'Nordeste',     population: 3.27, politicalWeight: 0.017, initialApproval: 55 },
  RJ: { id: 'RJ', name: 'Rio de Janeiro',     region: 'Sudeste',      population: 16.0, politicalWeight: 0.090, initialApproval: 47 },
  RN: { id: 'RN', name: 'Rio Grande do Norte',region: 'Nordeste',     population: 3.30, politicalWeight: 0.017, initialApproval: 53 },
  RS: { id: 'RS', name: 'Rio Grande do Sul',  region: 'Sul',          population: 10.9, politicalWeight: 0.060, initialApproval: 49 },
  RO: { id: 'RO', name: 'Rondônia',           region: 'Norte',        population: 1.58, politicalWeight: 0.011, initialApproval: 52 },
  RR: { id: 'RR', name: 'Roraima',            region: 'Norte',        population: 0.64, politicalWeight: 0.007, initialApproval: 50 },
  SC: { id: 'SC', name: 'Santa Catarina',     region: 'Sul',          population: 7.61, politicalWeight: 0.042, initialApproval: 49 },
  SP: { id: 'SP', name: 'São Paulo',          region: 'Sudeste',      population: 44.4, politicalWeight: 0.180, initialApproval: 48 },
  SE: { id: 'SE', name: 'Sergipe',            region: 'Nordeste',     population: 2.21, politicalWeight: 0.014, initialApproval: 54 },
  TO: { id: 'TO', name: 'Tocantins',          region: 'Norte',        population: 1.51, politicalWeight: 0.011, initialApproval: 51 },
};

export const STATE_IDS = Object.keys(STATES) as StateId[];

/** Peso total normalizado (soma = 1) */
export const STATE_WEIGHTS: Record<StateId, number> = (() => {
  const total = STATE_IDS.reduce((s, id) => s + STATES[id].politicalWeight, 0);
  return STATE_IDS.reduce((acc, id) => {
    acc[id] = STATES[id].politicalWeight / total;
    return acc;
  }, {} as Record<StateId, number>);
})();