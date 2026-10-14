import type { Chamber, Member } from '../persistence/db';
import { createMembersForSave, getMembers } from '../parliament/memberService';
import { initialParties } from '../../types/politics';
import { INSTRUMENT_BY_ID, quorumInfo, type Quorum } from '../../data/catalog';
import {
    CENTRAO,
    CENTRAO_FLOOR,
    CENTRAO_MIN_APPROVAL,
    IDEOLOGY_POS,
    baseAlignment,
} from '../politics/coalition';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type VoteValue = 'sim' | 'nao' | 'abstencao';

export interface MemberVote {
    memberId?: number;
    name: string;
    party: string | null; // sigla (null para ministros do STF)
    ideology: string;
    approval: number; // aprovação base do parlamentar (sem ajustes da votação)
    vote: VoteValue;
}

export interface StageResult {
    stage: Chamber;
    turno?: 1 | 2; // PEC vota em dois turnos por casa
    votes: MemberVote[];
    yes: number;
    no: number;
    abstain: number;
    approved: boolean;
    rule: string;
}

export interface VotingOutcome {
    approved: boolean;
    rejectedAt: Chamber | null;
    stages: StageResult[];
}

export interface VotingContext {
    /** Aprovação geral do governo (1 a 100), ex.: national.approval. */
    governmentApproval: number;
    /** Opcional: apelo da medida em pontos (ex.: -10 a +10). */
    measureAppeal?: number;
    /** Posição ideológica da medida (-3 esquerda .. +3 direita), vinda da IA. */
    policyPosition?: number;
    /** Partido do jogador: vota em bloco e quase não é afetado pela compatibilidade. */
    playerPartyId?: string | null;
    /** Bônus de negociação por partido (ver negotiationService). */
    negotiation?: Record<string, number>;
}

export type Rng = () => number;

// ---------------------------------------------------------------------------
// Ajuste de dificuldade (mexa aqui)
// ---------------------------------------------------------------------------
const CLIMATE_WEIGHT = 0.4; // aprovação do governo desloca todos os votos
const PARTY_SWING = 12; // humor de cada partido nesta votação (voto em bloco)
const COMPAT_WEIGHT = 4; // pontos por nível de proximidade ideológica com a medida (±12)
const PLAYER_PARTY_FLEX = 0.3; // o partido do governo reage pouco à compatibilidade
const CENTRAO_FLEX = 0.5; // o centrão reage à metade: negocia mais, é menos ideológico

const DEFAULT_CONTEXT: VotingContext = { governmentApproval: 50 };

// ---------------------------------------------------------------------------
// Regras por casa
// ---------------------------------------------------------------------------
interface ChamberRules {
    maxAbstention: number;
    bias: number;
}

const RULES: Record<Chamber, ChamberRules> = {
    camara: { maxAbstention: 0.2, bias: 0 },
    senado: { maxAbstention: 0.15, bias: 6 }, // Senado mais conciliador
    stf: { maxAbstention: 0.05, bias: 0 },
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function ruleText(quorum: Quorum, total: number): string {
    const q = quorumInfo(quorum, total);
    return q.seats === null ? `${q.label[0].toUpperCase()}${q.label.slice(1)} (Sim > Não)` : `${q.label[0].toUpperCase()}${q.label.slice(1)} (${q.seats} de ${total})`;
}

function passes(quorum: Quorum, yes: number, no: number, total: number): boolean {
    const q = quorumInfo(quorum, total);
    return q.seats === null ? yes > no : yes >= q.seats;
}

// ---------------------------------------------------------------------------
// Apoio individual (mesma conta para votar, projetar e rotular dificuldade)
// ---------------------------------------------------------------------------
type Voter = Pick<Member, 'approval' | 'partyId' | 'ideology'>;

export function memberSupport(m: Voter, ctx: VotingContext, bias: number, swing: number): number {
    const partyId = m.partyId;
    const isPlayer = !!partyId && partyId === ctx.playerPartyId;

    let base = m.approval;
    // Centrão: piso de apoio enquanto o governo não estiver afundado
    if (partyId && CENTRAO.has(partyId) && ctx.governmentApproval >= CENTRAO_MIN_APPROVAL) {
        base = Math.max(base, CENTRAO_FLOOR);
    }

    let compat = 0;
    if (partyId && ctx.policyPosition !== undefined) {
        const diff = Math.abs(ctx.policyPosition - IDEOLOGY_POS[m.ideology]); // 0..6
        const flex = isPlayer ? PLAYER_PARTY_FLEX : CENTRAO.has(partyId) ? CENTRAO_FLEX : 1;
        compat = (3 - diff) * COMPAT_WEIGHT * flex;
    }

    const climate = (ctx.governmentApproval - 50) * CLIMATE_WEIGHT + (ctx.measureAppeal ?? 0) + bias;
    const negotiated = partyId ? ctx.negotiation?.[partyId] ?? 0 : 0;

    return clamp(base + climate + compat + negotiated + swing, 0, 100);
}

export function decideVote(approval: number, maxAbstention: number, rng: Rng = Math.random): VoteValue {
    const undecided = 1 - Math.abs(approval - 50) / 50;
    if (rng() < maxAbstention * undecided) return 'abstencao';
    return rng() < approval / 100 ? 'sim' : 'nao';
}

// ---------------------------------------------------------------------------
// Votação de uma casa
// ---------------------------------------------------------------------------
const PARTY_ACRONYMS = new Map(initialParties.map((p) => [p.id, p.acronym]));

export function voteChamber(
    stage: Chamber,
    members: Member[],
    ctx: VotingContext = DEFAULT_CONTEXT,
    rng: Rng = Math.random,
    quorum: Quorum = 'simples',
    turno?: 1 | 2
): StageResult {
    const rules = RULES[stage];

    const swings = new Map<string, number>();
    const swingOf = (partyId: string | null): number => {
        if (!partyId) return 0;
        let s = swings.get(partyId);
        if (s === undefined) {
            const amp = partyId === ctx.playerPartyId ? PARTY_SWING * 0.3 : PARTY_SWING;
            s = (rng() + rng() - 1) * amp;
            swings.set(partyId, s);
        }
        return s;
    };

    const votes: MemberVote[] = members.map((m) => ({
        memberId: m.id,
        name: m.name,
        party: m.partyId ? PARTY_ACRONYMS.get(m.partyId) ?? m.partyId.toUpperCase() : null,
        ideology: m.ideology,
        approval: m.approval,
        vote: decideVote(memberSupport(m, ctx, rules.bias, swingOf(m.partyId)), rules.maxAbstention, rng),
    }));

    const yes = votes.filter((v) => v.vote === 'sim').length;
    const no = votes.filter((v) => v.vote === 'nao').length;

    return {
        stage,
        turno,
        votes,
        yes,
        no,
        abstain: votes.length - yes - no,
        approved: passes(quorum, yes, no, votes.length),
        rule: ruleText(quorum, votes.length),
    };
}

// ---------------------------------------------------------------------------
// Pipeline completo (agora segue os estágios e quóruns do catálogo)
// ---------------------------------------------------------------------------
export function simulateVoting(
    instrumentId: string,
    membersByChamber: Record<Chamber, Member[]>,
    ctx: VotingContext = DEFAULT_CONTEXT,
    rng: Rng = Math.random
): VotingOutcome {
    const instrument = INSTRUMENT_BY_ID[instrumentId as keyof typeof INSTRUMENT_BY_ID] ?? INSTRUMENT_BY_ID.projeto_lei;
    const stages: StageResult[] = [];

    for (const st of instrument.stages) {
        const result = voteChamber(st.chamber, membersByChamber[st.chamber], ctx, rng, st.quorum, st.turno);
        stages.push(result);
        if (!result.approved) return { approved: false, rejectedAt: st.chamber, stages };
    }

    return { approved: true, rejectedAt: null, stages };
}

export async function runVoting(
    saveId: number,
    instrumentId: string,
    ctx: VotingContext = DEFAULT_CONTEXT
): Promise<VotingOutcome> {
    await createMembersForSave(saveId, ctx.playerPartyId);

    const [camara, senado, stf] = await Promise.all([
        getMembers(saveId, 'camara'),
        getMembers(saveId, 'senado'),
        getMembers(saveId, 'stf'),
    ]);

    return simulateVoting(instrumentId, { camara, senado, stf }, ctx);
}

// ---------------------------------------------------------------------------
// Projeção (sem sorteio): é o que a tela de negociação mostra antes de votar
// ---------------------------------------------------------------------------
export type Verdict = 'favoravel' | 'apertado' | 'dificil';

export interface StageProjection {
    chamber: Chamber;
    turno?: 1 | 2;
    expectedYes: number;
    expectedNo: number;
    total: number;
    needed: number | null; // votos "sim" exigidos (null = mais sim que não)
    verdict: Verdict;
}

export function projectSupport(
    membersByChamber: Record<Chamber, Voter[]>,
    instrumentId: string,
    ctx: VotingContext = DEFAULT_CONTEXT
): StageProjection[] {
    const instrument = INSTRUMENT_BY_ID[instrumentId as keyof typeof INSTRUMENT_BY_ID] ?? INSTRUMENT_BY_ID.projeto_lei;

    return instrument.stages.map((st) => {
        const members = membersByChamber[st.chamber];
        const rules = RULES[st.chamber];
        let yes = 0;
        let no = 0;
        for (const m of members) {
            const p = memberSupport(m, ctx, rules.bias, 0) / 100;
            const undecided = 1 - Math.abs(p * 100 - 50) / 50;
            const vote = 1 - rules.maxAbstention * undecided;
            yes += vote * p;
            no += vote * (1 - p);
        }
        const total = members.length;
        const q = quorumInfo(st.quorum, total);
        const margin = q.seats === null ? yes - no : yes - q.seats;
        const verdict: Verdict = margin > total * 0.06 ? 'favoravel' : margin > -total * 0.06 ? 'apertado' : 'dificil';
        return { chamber: st.chamber, turno: st.turno, expectedYes: Math.round(yes), expectedNo: Math.round(no), total, needed: q.seats, verdict };
    });
}

// ---------------------------------------------------------------------------
// Dificuldade do partido (mesma conta da votação, sobre a composição inicial)
// ---------------------------------------------------------------------------
export type Difficulty = 'facil' | 'media' | 'dificil' | 'extrema';

export interface PartyDifficulty {
    difficulty: Difficulty;
    label: string;
    camaraShare: number; // 0..1: fração esperada de "sim" na Câmara numa medida da própria linha do partido
    ownSeatsShare: number; // 0..1: cadeiras próprias na Câmara
}

const LABELS: Record<Difficulty, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil', extrema: 'Extrema' };
export const DIFFICULTY_THRESHOLDS = { facil: 0.5, media: 0.44, dificil: 0.38 };

const cache = new Map<string, PartyDifficulty>();

export function partyDifficulty(partyId: string): PartyDifficulty {
    const hit = cache.get(partyId);
    if (hit) return hit;

    const player = initialParties.find((p) => p.id === partyId) ?? initialParties[0];
    const camara: Voter[] = [];
    for (const p of initialParties) {
        const approval = baseAlignment(p, player);
        for (let i = 0; i < p.deputies; i++) camara.push({ approval, partyId: p.id, ideology: p.ideology });
    }

    const [stage] = projectSupport(
        { camara, senado: [], stf: [] },
        'projeto_lei',
        { governmentApproval: 50, policyPosition: IDEOLOGY_POS[player.ideology], playerPartyId: player.id }
    );
    const share = stage.expectedYes / stage.total;
    const t = DIFFICULTY_THRESHOLDS;
    const difficulty: Difficulty = share >= t.facil ? 'facil' : share >= t.media ? 'media' : share >= t.dificil ? 'dificil' : 'extrema';

    const result = { difficulty, label: LABELS[difficulty], camaraShare: share, ownSeatsShare: player.deputies / 513 };
    cache.set(partyId, result);
    return result;
}