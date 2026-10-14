import type { Chamber, Member } from '../persistence/db';
import { db } from '../persistence/db';
import { initialParties, initialSTF } from '../../types/politics';
import { baseAlignment } from '../politics/coalition';
// ---------------------------------------------------------------------------
// Geração de nomes
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
    'Adriana', 'Alberto', 'Alice', 'Amanda', 'Ana', 'André', 'Antônio', 'Beatriz',
    'Bruno', 'Camila', 'Carlos', 'Carolina', 'Cláudia', 'Daniel', 'Débora', 'Diego',
    'Eduardo', 'Elisa', 'Fábio', 'Felipe', 'Fernanda', 'Flávio', 'Gabriel', 'Gustavo',
    'Helena', 'Henrique', 'Igor', 'Isabela', 'Joana', 'João', 'José', 'Júlia',
    'Larissa', 'Leandro', 'Lucas', 'Luciana', 'Marcos', 'Maria', 'Mariana', 'Mateus',
    'Nelson', 'Patrícia', 'Paulo', 'Pedro', 'Rafael', 'Renata', 'Ricardo', 'Rodrigo',
    'Sandra', 'Sérgio', 'Tatiana', 'Thiago', 'Vanessa', 'Vinícius', 'Wagner', 'Zélia',
];

const LAST_NAMES = [
    'Almeida', 'Alves', 'Araújo', 'Azevedo', 'Barbosa', 'Barros', 'Batista', 'Cardoso',
    'Carvalho', 'Castro', 'Costa', 'Cunha', 'Dias', 'Duarte', 'Farias', 'Ferreira',
    'Freitas', 'Gomes', 'Guimarães', 'Lima', 'Lopes', 'Machado', 'Martins', 'Medeiros',
    'Melo', 'Monteiro', 'Moraes', 'Moreira', 'Nascimento', 'Neves', 'Nogueira', 'Oliveira',
    'Pereira', 'Ramos', 'Reis', 'Ribeiro', 'Rocha', 'Santos', 'Silva', 'Soares',
    'Souza', 'Teixeira', 'Torres', 'Vieira',
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function createNameGenerator(reserved: string[] = []) {
    const used = new Set<string>(reserved);

    return (): string => {
        for (let i = 0; i < 50; i++) {
            const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
            if (!used.has(name)) {
                used.add(name);
                return name;
            }
        }
        // Raro: esgotou as tentativas, garante unicidade com um sobrenome extra
        const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${pick(LAST_NAMES)}`;
        used.add(name);
        return name;
    };
}

// ---------------------------------------------------------------------------
// Aprovação individual
// ---------------------------------------------------------------------------
// Parte da aprovação base do partido e varia até ±30 pontos.
// A soma de dois sorteios deixa os valores mais perto do centro (distribuição triangular).
function randomApproval(base: number, maxSpread = 30): number {
    const spread = (Math.random() + Math.random() - 1) * maxSpread;
    return Math.round(clamp(base + spread, 0, 100));
}

// ---------------------------------------------------------------------------
// Construção dos parlamentares
// ---------------------------------------------------------------------------
/**
 * Se playerPartyId vier, o apoio de cada partido é calculado em função do partido
 * do jogador (núcleo disciplinado + distância ideológica). Sem ele, usa o
 * governmentAlignment fixo de initialParties (saves antigos).
 */
export function buildMembers(saveId: number, playerPartyId?: string | null): Member[] {
    const player = playerPartyId ? initialParties.find((p) => p.id === playerPartyId) : undefined;
    const alignmentOf = (party: (typeof initialParties)[number]) =>
        player ? baseAlignment(party, player) : party.governmentAlignment;
    const spreadOf = (party: (typeof initialParties)[number]) => (player && party.id === player.id ? 8 : 30);
    const members: Member[] = [];

    const ministerNames = initialSTF.map((m) => m.name);
    const newName = createNameGenerator(ministerNames);

    for (const party of initialParties) {
        for (let i = 0; i < party.deputies; i++) {
            members.push({
                saveId,
                chamber: 'camara',
                name: newName(),
                partyId: party.id,
                ideology: party.ideology,
                approval: randomApproval(alignmentOf(party), spreadOf(party)),
            });
        }

        for (let i = 0; i < party.senators; i++) {
            members.push({
                saveId,
                chamber: 'senado',
                name: newName(),
                partyId: party.id,
                ideology: party.ideology,
                approval: randomApproval(alignmentOf(party), spreadOf(party)),
            });
        }
    }

    for (const minister of initialSTF) {
        members.push({
            saveId,
            chamber: 'stf',
            name: minister.name,
            partyId: null,
            ideology: minister.ideology,
            approval: minister.governmentAlignment,
        });
    }

    return members;
}

// ---------------------------------------------------------------------------
// Banco de dados
// ---------------------------------------------------------------------------
const EXPECTED: Record<Chamber, number> = { camara: 513, senado: 81, stf: 11 };

/** Cria os parlamentares de um save novo. Não faz nada se já existirem. */
export async function createMembersForSave(saveId: number, playerPartyId?: string | null): Promise<void> {
    const existing = await db.members.where('saveId').equals(saveId).count();
    if (existing > 0) return;

    const members = buildMembers(saveId, playerPartyId);

    // Confere os totais para pegar erro nos dados dos partidos logo de cara
    for (const chamber of Object.keys(EXPECTED) as Chamber[]) {
        const count = members.filter((m) => m.chamber === chamber).length;
        if (count !== EXPECTED[chamber]) {
            console.warn(
                `[members] ${chamber}: esperado ${EXPECTED[chamber]}, gerado ${count}. Revise initialParties/initialSTF.`
            );
        }
    }

    await db.members.bulkAdd(members);
}

export async function getMembers(saveId: number, chamber: Chamber): Promise<Member[]> {
    return db.members.where('[saveId+chamber]').equals([saveId, chamber]).toArray();
}

/** Chame ao apagar um save, para não deixar parlamentares órfãos. */
export async function deleteMembersForSave(saveId: number): Promise<void> {
    await db.members.where('saveId').equals(saveId).delete();
}
