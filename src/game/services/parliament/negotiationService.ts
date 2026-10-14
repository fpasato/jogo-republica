// Negociação antes da votação: o jogador oferece algo a partidos específicos.
// Cada oferta sobe o apoio do partido (em pontos de probabilidade de "sim") e custa algo.

export interface Offer {
    id: string;
    label: string;
    descricao: string;
    bonus: number; // pontos de apoio no partido
    custoAprovacao: number; // pontos de aprovação nacional (desgaste por "toma lá dá cá")
    diluicao: number; // 0..1: fração do efeito da medida que é cortada (concessão no texto)
}

export const OFFERS: Offer[] = [
    { id: 'ministerio', label: 'Oferecer ministério', descricao: 'Apoio forte, mas a imprensa cobra.', bonus: 12, custoAprovacao: 2, diluicao: 0 },
    { id: 'emendas', label: 'Liberar emendas', descricao: 'Apoio médio, desgaste leve.', bonus: 7, custoAprovacao: 1, diluicao: 0 },
    { id: 'concessao', label: 'Concessão no texto', descricao: 'Apoio menor, sem custo de imagem, mas dilui a medida em 15%.', bonus: 5, custoAprovacao: 0, diluicao: 0.15 },
];

export const OFFER_BY_ID = Object.fromEntries(OFFERS.map((o) => [o.id, o])) as Record<string, Offer>;

const DIMINISHING = 0.7; // cada oferta extra ao mesmo partido rende 70% da anterior
const MAX_BONUS_PER_PARTY = 25;

/** offers: partyId -> lista de ids de oferta. Devolve o que a votação e a store precisam. */
export function resolveOffers(
    offers: Record<string, string[]>,
    playerPartyId?: string | null
): { negotiation: Record<string, number>; custoAprovacao: number; diluicao: number } {
    const negotiation: Record<string, number> = {};
    let custoAprovacao = 0;
    let diluicao = 0;

    for (const [partyId, ids] of Object.entries(offers)) {
        if (partyId === playerPartyId) continue; // o próprio partido não precisa ser comprado
        let bonus = 0;
        ids.forEach((id, k) => {
            const o = OFFER_BY_ID[id];
            if (!o) return;
            bonus += o.bonus * Math.pow(DIMINISHING, k);
            custoAprovacao += o.custoAprovacao;
            diluicao += o.diluicao;
        });
        negotiation[partyId] = Math.min(MAX_BONUS_PER_PARTY, bonus);
    }

    return { negotiation, custoAprovacao, diluicao: Math.min(0.5, diluicao) };
}