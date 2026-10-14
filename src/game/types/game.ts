import type { GroupData } from './population';
import type { ActivePolicy, PolicyHistoryEntry } from './policy';
import type { Party, Minister } from './politics';
import type { IndicatorValues } from '../data/indicators';

export type Region = 'norte' | 'nordeste' | 'centro-oeste' | 'sudeste' | 'sul';

export interface NationalData {
    // --- Campos legados (o gameStore e o economyService ainda usam) ---
    inflation: number;
    unemployment: number;
    growth: number;
    debt: number;
    budget: number;
    expenses: number;
    balance: number;
    approval: number;
    criminality: number;
    dollar: number;
    selicRate: number;
    illiteracy: number;
    gdp: number;

    /**
     * Indicadores nacionais do catálogo (escopo 'nacional'):
     * salário mínimo, balança comercial, custo da energia, apoio no
     * Congresso/Senado, confiança nas instituições, escândalo, etc.
     * Criado por buildNationalValues().
     */
    values: IndicatorValues;
}

export interface StateData {
    id: string;
    name: string;
    region: Region;
    population: number;
    approval: number;
    /** -1 esquerda · 0 centro · +1 direita */
    politicalLeaning: number;
    /** Indicadores estaduais do catálogo (escopo 'estadual'). */
    values: IndicatorValues;
}

export interface IndicatorSnapshot {
    month: number;
    national: IndicatorValues;
    states: { id: string; population: number; values: IndicatorValues }[];
}

export interface GameState {
    month: number;
    national: NationalData;
    states: StateData[];
    /** Últimos fechamentos mensais para calcular tendências sem perder saves. */
    indicatorHistory: IndicatorSnapshot[];
    groups: GroupData[];
    activePolicies: ActivePolicy[];
    policyHistory: PolicyHistoryEntry[];
    politics: {
        parties: Party[];
        stf: Minister[];
    };
}
