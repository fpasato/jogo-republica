import { PROFILE_AXES, GROUP_LEAN } from './profile';

// ============================================================
// TIPOS
// ============================================================

export interface MonthlyEffects {
  grupos?: Record<string, number>;
  indicadores?: Record<string, number>;
}

export interface ReactionDef {
  titulo: string;
  efeito: string;
  mensal: MonthlyEffects;
}

export interface GroupEixos {
  economia: number;
  costumes: number;
  seguranca: number;
  ambiente: number;
  gasto_social: number;
}

export interface GroupDef {
  id: string;
  nome: string;
  curto: string;
  peso: number;
  combatividade: number;
  /** Lean geral -1..+1 (do GROUP_LEAN). */
  lean: number;
  /** Afinidade normalizada por eixo, -1..+1 (do PROFILE_AXES). */
  eixos: GroupEixos;
  /** Aprovação abaixo da qual a reação dispara. Default 35. */
  limiarReacao: number;
  reacao?: ReactionDef;
}

// ============================================================
// NORMALIZAÇÃO DE AFINIDADE
// ============================================================
// PROFILE_AXES.afinidade vai de -4 a +4 por grupo. Normalizamos
// para -1..+1 dividindo por 4. Assim `eixos` tem a mesma escala
// de `lean` e é mais fácil de multiplicar no motor.

const AFFINITY_MAX = 4;

function buildEixos(groupId: string): GroupEixos {
  const out: GroupEixos = {
    economia: 0, costumes: 0, seguranca: 0, ambiente: 0, gasto_social: 0,
  };
  for (const axis of PROFILE_AXES) {
    const raw = axis.afinidade[groupId] ?? 0;
    const normalized = raw / AFFINITY_MAX;
    if (axis.id === 'gasto_social') out.gasto_social = normalized;
    else if (axis.id === 'economia') out.economia = normalized;
    else if (axis.id === 'costumes') out.costumes = normalized;
    else if (axis.id === 'seguranca') out.seguranca = normalized;
    else if (axis.id === 'ambiente') out.ambiente = normalized;
  }
  return out;
}

// ============================================================
// DEFINIÇÃO BRUTA (idêntica ao catalog.ts atual)
// ============================================================
// Mantido intencionalmente próximo do original para facilitar diff.

type RawGroup = {
  id: string;
  nome: string;
  curto: string;
  peso: number;
  combatividade?: number;
  reacao?: ReactionDef;
};

const RAW: RawGroup[] = [
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

// ============================================================
// BUILD FINAL
// ============================================================

const DEFAULT_LIMIAR = 35;

export const GROUPS: GroupDef[] = RAW.map((g) => ({
  id: g.id,
  nome: g.nome,
  curto: g.curto,
  peso: g.peso,
  combatividade: g.combatividade ?? 1,
  lean: GROUP_LEAN[g.id] ?? 0,
  eixos: buildEixos(g.id),
  limiarReacao: DEFAULT_LIMIAR,
  reacao: g.reacao,
}));

export const GROUP_BY_ID: Record<string, GroupDef> = Object.fromEntries(
  GROUPS.map((g) => [g.id, g]),
);

export const GROUP_IDS = GROUPS.map((g) => g.id);

export function getGroup(id: string): GroupDef {
  const g = GROUP_BY_ID[id];
  if (!g) throw new Error(`Grupo desconhecido: ${id}`);
  return g;
}

export function hasGroup(id: string): boolean {
  return id in GROUP_BY_ID;
}

/**
 * Aprovação nacional ponderada pelos pesos dos grupos.
 * Substitui o antigo nationalApprovalFromGroups do profileService.
 */
export function nationalApprovalFromGroups(
  groupApprovals: Record<string, number>,
): number {
  let num = 0, den = 0;
  for (const g of GROUPS) {
    const v = groupApprovals[g.id];
    if (v === undefined) continue;
    num += v * g.peso;
    den += g.peso;
  }
  return den === 0 ? 50 : num / den;
}