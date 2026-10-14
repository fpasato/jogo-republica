// ===========================================================================
// Dados do perfil do jogador (sliders e "DNA" ideológico dos grupos).
// Todos os ids de grupo aqui precisam existir em GROUPS (catalog.ts).
// ===========================================================================

export const SLIDER_MIN = -3;
export const SLIDER_MAX = 3;
/** Soma máxima dos módulos dos sliders: impede "tudo no máximo". */
export const SLIDER_BUDGET = 15;
/** Quanto a ideologia do partido desloca a aprovação inicial (pontos, no extremo). */
export const DNA_STRENGTH = 2.5;

export interface ProfileAxis {
    id: string;
    nome: string;
    esquerda: string; // rótulo do lado -3
    direita: string; // rótulo do lado +3
    /** Pontos de aprovação inicial por unidade do slider. */
    afinidade: Record<string, number>;
}

export const PROFILE_AXES: ProfileAxis[] = [
    {
        id: 'economia', nome: 'Economia', esquerda: 'Estatista', direita: 'Liberal',
        afinidade: {
            empresarios: 3, mercado_financeiro: 4, agronegocio: 2,
            servidores_publicos: -3, trabalhadores: -2, socialistas: -3, aposentados: -1,
        },
    },
    {
        id: 'costumes', nome: 'Costumes', esquerda: 'Progressista', direita: 'Conservador',
        afinidade: {
            religiosos: 4, conservadores: 4, militares: 2, policiais: 2,
            lgbtqia: -4, feministas: -3, progressistas: -4, movimento_negro: -2, artistas: -2, jovens: -1,
        },
    },
    {
        id: 'seguranca', nome: 'Segurança', esquerda: 'Garantista', direita: 'Linha dura',
        afinidade: {
            policiais: 4, militares: 3, conservadores: 2,
            movimento_negro: -3, progressistas: -2, povos_indigenas: -1,
        },
    },
    {
        id: 'ambiente', nome: 'Meio ambiente', esquerda: 'Desenvolvimentista', direita: 'Ambientalista',
        afinidade: {
            povos_indigenas: 4, ciencia: 2, jovens: 2, universitarios: 1, progressistas: 1,
            agronegocio: -4, empresarios: -1,
        },
    },
    {
        id: 'gasto_social', nome: 'Gasto social', esquerda: 'Austeridade', direita: 'Expansão',
        afinidade: {
            trabalhadores: 3, aposentados: 3, servidores_publicos: 1, jovens: 1,
            mercado_financeiro: -3, empresarios: -2,
        },
    },
];

export const GROUP_LEAN: Record<string, number> = {
    empresarios:          0.9,
    mercado_financeiro:   1.0,
    agronegocio:          0.7,
    conservadores:        0.8,
    religiosos:           0.6,
    militares:            0.5,
    policiais:            0.4,
    trabalhadores:       -0.7,
    jovens:              -0.3,
    progressistas:       -0.8,
    socialistas:         -0.9,
    servidores_publicos: -0.5,
    universitarios:      -0.4,
    ciencia:             -0.3,
    artistas:            -0.5,
    feministas:          -0.6,
    lgbtqia:             -0.6,
    movimento_negro:     -0.5,
    povos_indigenas:     -0.5,
    aposentados:         -0.3,
};