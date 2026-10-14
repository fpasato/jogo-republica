import type { Chamber } from '../services/persistence/db';

// ===========================================================================
// CATÁLOGO: fonte única de verdade.
// O prompt da IA, a validação da resposta e os cálculos de efeito são todos
// gerados a partir daqui. Para criar um grupo, indicador ou instrumento novo,
// edite só este arquivo.
// ===========================================================================

// ---------------------------------------------------------------------------
// Instrumentos (o que a medida "vira")
// ---------------------------------------------------------------------------
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
        quandoUsar:
            'Regulamentar lei que já existe ou organizar a administração federal. NÃO pode criar direitos ou obrigações novos, criar tributo nem alterar leis.',
        vigoraAoAssinar: true,
        stages: [{ chamber: 'stf', quorum: 'absoluta' }],
    },
    {
        id: 'mp',
        label: 'MP',
        nomeCompleto: 'Medida Provisória',
        regra: 'Medida Provisória: vigora de imediato, mas precisa ser aprovada pelo Congresso por maioria simples.',
        quandoUsar:
            'Assunto urgente e relevante, com efeito imediato, que poderia ser tratado por lei comum. NÃO pode mudar a Constituição nem tratar de direito penal, direitos políticos ou nacionalidade.',
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
        regra: 'Projeto de Lei: só vale depois de aprovado na Câmara e no Senado por maioria simples.',
        quandoUsar:
            'Criar ou alterar leis comuns (benefícios, impostos, regras gerais) sem urgência extrema.',
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
        quandoUsar:
            'Temas que a Constituição reserva a lei complementar: sistema tributário nacional, finanças públicas, estatuto da magistratura, regras de organização de carreiras de Estado.',
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
        regra: 'Emenda Constitucional: precisa de 3/5 da Câmara (308) e do Senado (49), em dois turnos em cada casa.',
        quandoUsar:
            'Qualquer mudança no texto da Constituição: estrutura e poderes do STF, do Congresso ou da Presidência, direitos fundamentais, regras eleitorais constitucionais, teto de gastos.',
        vigoraAoAssinar: false,
        stages: [
            { chamber: 'camara', turno: 1, quorum: 'tres_quintos' },
            { chamber: 'camara', turno: 2, quorum: 'tres_quintos' },
            { chamber: 'senado', turno: 1, quorum: 'tres_quintos' },
            { chamber: 'senado', turno: 2, quorum: 'tres_quintos' },
        ],
    },
];

export const INSTRUMENT_BY_ID = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i])) as Record<
    InstrumentId,
    Instrument
>;

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

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------
export interface IndicatorDef {
    id: string;
    nome: string;
    curto: string;
    unidade: string;
    passo: number;
    melhorQuando: 'subir' | 'cair';
    ia: boolean;
}

export const INDICATORS: IndicatorDef[] = [
    { id: 'unemployment', nome: 'Desemprego', curto: 'desemprego', unidade: 'p.p.', passo: 0.3, melhorQuando: 'cair', ia: true },
    { id: 'growth', nome: 'Crescimento', curto: 'crescimento', unidade: 'p.p.', passo: 0.4, melhorQuando: 'subir', ia: true },
    { id: 'debt', nome: 'Dívida pública', curto: 'dívida pública', unidade: 'p.p. do PIB', passo: 1.5, melhorQuando: 'cair', ia: true },
    { id: 'inflation', nome: 'Inflação', curto: 'inflação', unidade: 'p.p.', passo: 0.3, melhorQuando: 'cair', ia: true },
    { id: 'criminality', nome: 'Criminalidade', curto: 'criminalidade', unidade: '(de 100)', passo: 5, melhorQuando: 'cair', ia: true },
    { id: 'dollar', nome: 'Dólar', curto: 'dólar', unidade: '%', passo: 3, melhorQuando: 'cair', ia: true },
    { id: 'selicRate', nome: 'Selic', curto: 'Selic', unidade: 'p.p.', passo: 0.5, melhorQuando: 'cair', ia: true },
    { id: 'scandalExposure', nome: 'Exposição a escândalo', curto: 'exposição a escândalo', unidade: '(de 100)', passo: 2, melhorQuando: 'cair', ia: true },
    { id: 'militaryLoyalty', nome: 'Lealdade do Exército', curto: 'lealdade do Exército', unidade: '(de 100)', passo: 3, melhorQuando: 'subir', ia: true },
    { id: 'crisisClimate', nome: 'Clima de crise', curto: 'clima de crise', unidade: '(de 100)', passo: 2, melhorQuando: 'cair', ia: false },
];

export const INDICATOR_BY_ID = Object.fromEntries(INDICATORS.map((i) => [i.id, i])) as Record<string, IndicatorDef>;

// ---------------------------------------------------------------------------
// Grupos sociais e suas reações
// ---------------------------------------------------------------------------
export interface MonthlyEffects {
    grupos?: Record<string, number>;
    indicadores?: Record<string, number>;
}

export interface ReactionDef {
    titulo: string;
    efeito: string;
    mensal: MonthlyEffects;
}

export interface GroupDef {
    id: string;
    nome: string;
    curto: string;
    peso: number;
    combatividade?: number;
    reacao?: ReactionDef;
}

export const GROUPS: GroupDef[] = [
    {
        id: 'empresarios', nome: 'Empresários', curto: 'empresários', peso: 6,
        reacao: {
            titulo: 'cartas de entidades patronais e freio nos investimentos',
            efeito: 'Enquanto durar, o investimento esfria e o crescimento sofre.',
            mensal: { grupos: { empresarios: -1.5 }, indicadores: { growth: -0.1 } },
        },
    },
    {
        id: 'trabalhadores', nome: 'Trabalhadores e sindicalistas', curto: 'trabalhadores e sindicalistas', peso: 16, combatividade: 1.1,
        reacao: {
            titulo: 'greve geral e atos das centrais sindicais',
            efeito: 'Enquanto durar, a produção cai e a rua esquenta.',
            mensal: { grupos: { trabalhadores: -1.5 }, indicadores: { growth: -0.1, crisisClimate: 1.2 } },
        },
    },
    {
        id: 'conservadores', nome: 'Conservadores', curto: 'conservadores', peso: 9,
        reacao: {
            titulo: 'atos de rua e campanha nas redes',
            efeito: 'Enquanto durar, a oposição se mobiliza e a imagem do governo sofre.',
            mensal: { grupos: { conservadores: -1.5 }, indicadores: { scandalExposure: 0.8, crisisClimate: 0.6 } },
        },
    },
    {
        id: 'religiosos', nome: 'Religiosos e evangélicos', curto: 'religiosos e evangélicos', peso: 9,
        reacao: {
            titulo: 'mobilização em igrejas e pressão sobre parlamentares',
            efeito: 'Enquanto durar, a bancada religiosa endurece com o governo.',
            mensal: { grupos: { religiosos: -1.5, conservadores: -0.5 }, indicadores: { crisisClimate: 0.6 } },
        },
    },
    {
        id: 'progressistas', nome: 'Progressistas', curto: 'progressistas', peso: 9,
        reacao: {
            titulo: 'atos de rua e campanha nas redes',
            efeito: 'Enquanto durar, a base do governo se desgasta e a imagem sofre.',
            mensal: { grupos: { progressistas: -1.5 }, indicadores: { scandalExposure: 0.8 } },
        },
    },
    {
        id: 'socialistas', nome: 'Socialistas e comunistas', curto: 'socialistas e comunistas', peso: 2,
        reacao: {
            titulo: 'ocupações e atos de movimentos sociais',
            efeito: 'Enquanto durar, os movimentos sociais ocupam a pauta e o clima esquenta.',
            mensal: { grupos: { socialistas: -1.5 }, indicadores: { crisisClimate: 0.8 } },
        },
    },
    {
        id: 'mercado_financeiro', nome: 'Mercado financeiro', curto: 'mercado financeiro', peso: 3,
        reacao: {
            titulo: 'fuga de capitais e pressão sobre o dólar',
            efeito: 'Enquanto durar, o dólar sobe e o crédito encarece.',
            mensal: { grupos: { mercado_financeiro: -1.5 }, indicadores: { dollar: 1.5 } },
        },
    },
    {
        id: 'servidores_publicos', nome: 'Servidores públicos', curto: 'servidores públicos', peso: 6,
        reacao: {
            titulo: 'greve do funcionalismo e atos em Brasília',
            efeito: 'Enquanto durar, serviços públicos travam e o desgaste cresce.',
            mensal: { grupos: { servidores_publicos: -1.5 }, indicadores: { crisisClimate: 0.8, scandalExposure: 0.5 } },
        },
    },
    {
        id: 'agronegocio', nome: 'Agronegócio exportador', curto: 'agronegócio exportador', peso: 5,
        reacao: {
            titulo: 'pressão da bancada ruralista e tratoraço',
            efeito: 'Enquanto durar, a bancada ruralista endurece no Congresso.',
            mensal: { grupos: { agronegocio: -1.5 }, indicadores: { crisisClimate: 0.6 } },
        },
    },
    {
        id: 'jovens', nome: 'Jovens', curto: 'jovens', peso: 10,
        reacao: {
            titulo: 'protestos de rua e engajamento nas redes',
            efeito: 'Enquanto durar, a imagem do governo apanha entre os jovens e na internet.',
            mensal: { grupos: { jovens: -1.5 }, indicadores: { scandalExposure: 1 } },
        },
    },
    {
        id: 'aposentados', nome: 'Aposentados', curto: 'aposentados', peso: 8,
        reacao: {
            titulo: 'pressão de associações sobre o Congresso',
            efeito: 'Enquanto durar, parlamentares são cobrados e o desgaste aumenta.',
            mensal: { grupos: { aposentados: -1.5 }, indicadores: { crisisClimate: 0.5 } },
        },
    },
    {
        id: 'militares', nome: 'Militares', curto: 'militares', peso: 1.5,
        reacao: {
            titulo: 'notas de comandantes e mal-estar nos quartéis',
            efeito: 'Enquanto durar, a lealdade militar despenca.',
            mensal: { grupos: { militares: -2 }, indicadores: { militaryLoyalty: -3, crisisClimate: 1 } },
        },
    },
    {
        id: 'policiais', nome: 'Policiais e praças', curto: 'policiais e praças', peso: 3.5,
        reacao: {
            titulo: 'operação-padrão e ameaça de aquartelamento',
            efeito: 'Enquanto durar, mal-estar nos quartéis e a lealdade militar cai.',
            mensal: {
                grupos: { policiais: -2 },
                indicadores: { scandalExposure: 0.8, militaryLoyalty: -2.4, crisisClimate: 0.6 },
            },
        },
    },
    {
        id: 'universitarios', nome: 'Universitários', curto: 'universitários', peso: 4,
        reacao: {
            titulo: 'ocupação de reitorias e cartas de pesquisadores',
            efeito: 'Enquanto durar, ocupações viram manchete e o conflito no campo cresce.',
            mensal: { grupos: { universitarios: -1, ciencia: -1 }, indicadores: { scandalExposure: 1.4 } },
        },
    },
    {
        id: 'ciencia', nome: 'Ciência e universidade pública', curto: 'ciência e universidade pública', peso: 1.5,
        reacao: {
            titulo: 'cartas de pesquisadores e paralisação de laboratórios',
            efeito: 'Enquanto durar, a comunidade científica fica contra o governo.',
            mensal: { grupos: { ciencia: -1.4, universitarios: -0.5 }, indicadores: { scandalExposure: 0.8 } },
        },
    },
    {
        id: 'artistas', nome: 'Artistas e cultura', curto: 'artistas e cultura', peso: 1.5, combatividade: 1.05,
        reacao: {
            titulo: 'carta aberta de artistas e campanha nas redes',
            efeito: 'Enquanto durar, a imagem do governo apanha com os jovens e a internet, e a exposição sobe.',
            mensal: {
                grupos: { artistas: -1.6, jovens: -0.6, universitarios: -0.6 },
                indicadores: { scandalExposure: 1.6 },
            },
        },
    },
    {
        id: 'feministas', nome: 'Feministas', curto: 'feministas', peso: 2,
        reacao: {
            titulo: 'atos nacionais e campanha internacional',
            efeito: 'Enquanto durar, a pauta ganha as redes e a exposição sobe.',
            mensal: { grupos: { feministas: -1.5, progressistas: -0.4 }, indicadores: { scandalExposure: 1 } },
        },
    },
    {
        id: 'lgbtqia', nome: 'LGBTQIA+', curto: 'LGBTQIA+', peso: 2,
        reacao: {
            titulo: 'atos nacionais e campanha internacional',
            efeito: 'Enquanto durar, a pauta ganha as redes e a exposição sobe.',
            mensal: { grupos: { lgbtqia: -1.5, progressistas: -0.4 }, indicadores: { scandalExposure: 1 } },
        },
    },
    {
        id: 'movimento_negro', nome: 'Movimento negro', curto: 'movimento negro', peso: 6,
        reacao: {
            titulo: 'atos nacionais e mobilização de entidades',
            efeito: 'Enquanto durar, a pauta racial ganha as ruas e as redes e a exposição sobe.',
            mensal: { grupos: { movimento_negro: -1.5, progressistas: -0.4 }, indicadores: { scandalExposure: 1, crisisClimate: 0.5 } },
        },
    },
    {
        id: 'povos_indigenas', nome: 'Povos indígenas', curto: 'povos indígenas', peso: 1,
        reacao: {
            titulo: 'mobilização em Brasília e denúncia internacional',
            efeito: 'Enquanto durar, a pauta ganha repercussão internacional e a exposição sobe.',
            mensal: { grupos: { povos_indigenas: -1.5, progressistas: -0.3 }, indicadores: { scandalExposure: 1.2 } },
        },
    },
];

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<string, GroupDef>;

// ---------------------------------------------------------------------------
// Constantes de equilíbrio
// ---------------------------------------------------------------------------

/** Pontos de aprovação por nível da IA: nível 3 = 10 pontos no ato. */
export const GROUP_STEP = 10 / 3;

/** Clima de crise gerado por nível de choque. */
export const CRISIS_PER_SHOCK = 2;


export const SHOCK_LEVELS = [
    { nivel: 0, titulo: 'Sem choque', descricao: 'A medida passa sem abalar ninguém de imediato.' },
    { nivel: 1, titulo: 'Choque leve', descricao: 'Alguns grupos sentem no ato, mas o país segue calmo.' },
    { nivel: 2, titulo: 'Choque forte', descricao: 'Quem perde sente no ato e o clima político esquenta.' },
    { nivel: 3, titulo: 'Choque extremo', descricao: 'Medida extrema: quem perde sente no ato, e o país inteiro fica tenso.' },
] as const;

/**
 * Impacto fiscal anual EM REAIS por magnitude 0 a 7.
 *
 *   0 = R$ 0        → neutro
 *   1 = R$ 1 bi     → micro       (categoria, artigo, piloto)
 *   2 = R$ 5 bi     → pequeno     (setor específico, 1 estado)
 *   3 = R$ 15 bi    → médio-baixo (nacional, alcance limitado)
 *   4 = R$ 40 bi    → médio       (nacional, milhões de pessoas)
 *   5 = R$ 100 bi   → grande      (estrutural · R$ 1 tri / 10 anos)
 *   6 = R$ 250 bi   → gigante     (reforma histórica · R$ 2,5 tri / 10 anos)
 *   7 = R$ 500 bi   → colossal    (reforma civilizatória · R$ 5 tri / 10 anos)
 */
export const FISCAL_MAGNITUDE_REAIS: [
    number, number, number, number,
    number, number, number, number,
] = [
    0,
    1e9,
    5e9,
    15e9,
    40e9,
    100e9,
    250e9,
    500e9,
];