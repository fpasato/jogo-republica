import type { Chamber } from '../services/persistence/db';

export type Quorum = 'simples' | 'absoluta' | 'dois_tercos' | 'tres_quintos';

export interface QuorumInfo {
  seats: number | null;
  label: string;
}

export function quorumInfo(q: Quorum, total: number): QuorumInfo {
  switch (q) {
    case 'simples':
      return { seats: null, label: 'maioria simples' };
    case 'absoluta':
      return { seats: Math.floor(total / 2) + 1, label: 'maioria absoluta' };
    case 'dois_tercos':
      return { seats: Math.ceil((total * 2) / 3), label: 'dois terços' };
    case 'tres_quintos':
      return { seats: Math.ceil((total * 3) / 5), label: 'três quintos' };
  }
}

export interface InstrumentStage {
  chamber: Chamber;
  quorum: Quorum;
  turno?: 1 | 2;
}

export interface Instrument {
  id: string;
  label: string;
  stages: InstrumentStage[];
}

export const INSTRUMENT_BY_ID: Record<string, Instrument> = {
  projeto_lei: {
    id: 'projeto_lei',
    label: 'Projeto de Lei',
    stages: [
      { chamber: 'camara', quorum: 'simples' },
      { chamber: 'senado', quorum: 'simples' },
    ],
  },
  lei_complementar: {
    id: 'lei_complementar',
    label: 'Lei Complementar',
    stages: [
      { chamber: 'camara', quorum: 'absoluta' },
      { chamber: 'senado', quorum: 'absoluta' },
    ],
  },
  medida_provisoria: {
    id: 'medida_provisoria',
    label: 'Medida Provisória',
    stages: [
      { chamber: 'camara', quorum: 'simples' },
      { chamber: 'senado', quorum: 'simples' },
    ],
  },
  pec: {
    id: 'pec',
    label: 'Proposta de Emenda Constitucional',
    stages: [
      { chamber: 'camara', quorum: 'tres_quintos', turno: 1 },
      { chamber: 'camara', quorum: 'tres_quintos', turno: 2 },
      { chamber: 'senado', quorum: 'tres_quintos', turno: 1 },
      { chamber: 'senado', quorum: 'tres_quintos', turno: 2 },
    ],
  },
};