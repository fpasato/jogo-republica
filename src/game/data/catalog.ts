// src/game/data/catalog.ts
import type { Chamber } from '../services/persistence/db';
import { GROUPS, type GroupDef } from './groups';
import { INDICATORS, type IndicatorDef } from './indicators';

export type Quorum = 'simples' | 'absoluta' | 'tres_quintos';

export interface InstrumentStage {
  chamber: Chamber;
  turno?: 1 | 2;
  quorum: Quorum;
}

export type InstrumentId = 'decreto' | 'mp' | 'projeto_lei' | 'lei_complementar' | 'pec';

export interface Instrument {
  id: InstrumentId;
  label: string;
  nomeCompleto: string;
  regra: string;
  quandoUsar: string;
  vigoraAoAssinar: boolean;
  stages: InstrumentStage[];
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'decreto',
    label: 'Decreto',
    nomeCompleto: 'Decreto presidencial',
    regra: 'Decreto: vale ao ser assinado, mas o STF pode derrubá-lo se invadir competência do Legislativo.',
    quandoUsar: 'Regulamentar diretrizes ou organizar a administração federal. Não pode criar tributos.',
    vigoraAoAssinar: true,
    stages: [{ chamber: 'stf', quorum: 'absoluta' }],
  },
  {
    id: 'mp',
    label: 'MP',
    nomeCompleto: 'Medida Provisória',
    regra: 'Medida Provisória: vigora de imediato, mas precisa ser aprovada pelo Congresso por maioria simples.',
    quandoUsar: 'Assunto urgente e relevante com efeito imediato.',
    vigoraAoAssinar: true,
    stages: [
      { chamber: 'camara', quorum: 'simples' },
      { chamber: 'senado', quorum: 'simples' },
    ],
  },
  {
    id: 'projeto_lei',
    label: 'Projeto de Lei',
    nomeCompleto: 'Projeto de Lei ordinária',
    regra: 'Projeto de Lei: só vale após aprovado na Câmara e no Senado por maioria simples.',
    quandoUsar: 'Criar ou alterar programas, tributos comuns ou leis gerais.',
    vigoraAoAssinar: false,
    stages: [
      { chamber: 'camara', quorum: 'simples' },
      { chamber: 'senado', quorum: 'simples' },
    ],
  },
  {
    id: 'lei_complementar',
    label: 'Lei Complementar',
    nomeCompleto: 'Projeto de Lei Complementar',
    regra: 'Lei Complementar: precisa de maioria absoluta na Câmara (257) e no Senado (41).',
    quandoUsar: 'Reforma tributária, finanças públicas e regras estruturais do Estado.',
    vigoraAoAssinar: false,
    stages: [
      { chamber: 'camara', quorum: 'absoluta' },
      { chamber: 'senado', quorum: 'absoluta' },
    ],
  },
  {
    id: 'pec',
    label: 'PEC',
    nomeCompleto: 'Proposta de Emenda à Constituição',
    regra: 'Emenda Constitucional: precisa de 3/5 da Câmara (308) e do Senado (49), em dois turnos.',
    quandoUsar: 'Mudanças no texto da Constituição, previdência e regras constitucionais.',
    vigoraAoAssinar: false,
    stages: [
      { chamber: 'camara', turno: 1, quorum: 'tres_quintos' },
      { chamber: 'camara', turno: 2, quorum: 'tres_quintos' },
      { chamber: 'senado', turno: 1, quorum: 'tres_quintos' },
      { chamber: 'senado', turno: 2, quorum: 'tres_quintos' },
    ],
  },
];

export const INSTRUMENT_BY_ID = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i]),
) as Record<InstrumentId, Instrument>;

export function quorumInfo(quorum: Quorum, totalSeats: number): { label: string; seats: number | null } {
  switch (quorum) {
    case 'simples':
      return { label: 'maioria simples', seats: null };
    case 'absoluta':
      return { label: 'maioria absoluta', seats: Math.floor(totalSeats / 2) + 1 };
    case 'tres_quintos':
      return { label: '3/5', seats: Math.ceil((totalSeats * 3) / 5) };
  }
}

export const FISCAL_MAGNITUDE_REAIS: Record<number, number> = {
  0: 0,
  1: 1e9,
  2: 5e9,
  3: 15e9,
  4: 35e9,
  5: 70e9,
  6: 120e9,
  7: 200e9,
};

export { GROUPS, type GroupDef, INDICATORS, type IndicatorDef };