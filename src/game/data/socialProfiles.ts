// src/game/data/socialProfiles.ts

import type { Ideology } from '../types/politics';
import type { NewsTheme } from './newsThemes';

// ============================================================
// TIPOS
// ============================================================

export type ProfileKind =
  | 'imprensa'
  | 'aliado'
  | 'opositor'
  | 'lider_social'
  | 'influenciador'
  | 'hater'
  | 'bot';

export type Temperamento = 'calmo' | 'agressivo' | 'irônico' | 'formal';

export interface Perfil {
  id: string;
  handle: string;
  nome: string;
  kind: ProfileKind;
  ideology: Ideology;
  temperamento: Temperamento;
  seguidores: number;
  ativo: boolean;
  /** Tema que o perfil costuma focar. Ausente = fala de tudo. */
  foco?: NewsTheme;
  /** Descrição curta da bio. */
  bio?: string;
  /** Só pra imprensa: id do veículo em newsVehicles.ts. */
  veiculo?: string;
  avatar?: string;
}

// ============================================================
// PERFIS INICIAIS
// ============================================================

export const SOCIAL_PROFILES: Perfil[] = [
  // ----------------------------------------------------------
  // IMPRENSA (5)
  // ----------------------------------------------------------
  {
    id: 'correio_nacional',
    handle: '@correio_nacional',
    nome: 'O Correio Nacional',
    kind: 'imprensa',
    ideology: 'centro',
    temperamento: 'formal',
    seguidores: 2_400_000,
    ativo: true,
    veiculo: 'correio_nacional',
    bio: 'Jornalismo independente desde 1952.',
  },
  {
    id: 'gazeta_brasil',
    handle: '@gazeta_brasil',
    nome: 'Gazeta do Brasil',
    kind: 'imprensa',
    ideology: 'direita',
    temperamento: 'formal',
    seguidores: 1_800_000,
    ativo: true,
    veiculo: 'gazeta_brasil',
    bio: 'Notícias com análise. Sem filtro.',
  },
  {
    id: 'diario_cidadao',
    handle: '@diario_cidadao',
    nome: 'Diário Cidadão',
    kind: 'imprensa',
    ideology: 'esquerda',
    temperamento: 'formal',
    seguidores: 1_200_000,
    ativo: true,
    veiculo: 'diario_cidadao',
    bio: 'Os direitos de quem trabalha.',
  },
  {
    id: 'jornal_economico',
    handle: '@jornal_economico',
    nome: 'Jornal Econômico',
    kind: 'imprensa',
    ideology: 'centro_direita',
    temperamento: 'formal',
    seguidores: 900_000,
    ativo: true,
    veiculo: 'jornal_economico',
    bio: 'Mercado, política monetária e risco-país.',
    foco: 'economy',
  },
  {
    id: 'voz_popular',
    handle: '@voz_popular',
    nome: 'Voz Popular',
    kind: 'imprensa',
    ideology: 'centro_esquerda',
    temperamento: 'formal',
    seguidores: 700_000,
    ativo: true,
    veiculo: 'voz_popular',
    bio: 'Notícias do povo, pro povo.',
  },

  // ----------------------------------------------------------
  // POLÍTICOS — ALIADOS (3)
  // ----------------------------------------------------------
  {
    id: 'dep_renata_lopes',
    handle: '@renatalopes',
    nome: 'Dep. Renata Lopes',
    kind: 'aliado',
    ideology: 'esquerda',
    temperamento: 'formal',
    seguidores: 420_000,
    ativo: true,
    bio: 'Deputada federal (PT-SP). Defesa dos trabalhadores.',
  },
  {
    id: 'sen_marcos_azevedo',
    handle: '@marcosazevedo_sen',
    nome: 'Sen. Marcos Azevedo',
    kind: 'aliado',
    ideology: 'centro_esquerda',
    temperamento: 'calmo',
    seguidores: 280_000,
    ativo: true,
    bio: 'Senador (PSB-PE). Foco em educação e saúde.',
    foco: 'education',
  },
  {
    id: 'dep_carla_mendes',
    handle: '@carlamendes',
    nome: 'Dep. Carla Mendes',
    kind: 'aliado',
    ideology: 'centro_esquerda',
    temperamento: 'calmo',
    seguidores: 190_000,
    ativo: true,
    bio: 'Deputada federal (REDE-AM). Meio ambiente e povos indígenas.',
    foco: 'environment',
  },

  // ----------------------------------------------------------
  // POLÍTICOS — OPOSITORES (3)
  // ----------------------------------------------------------
  {
    id: 'dep_bruno_tavares',
    handle: '@brunotavares',
    nome: 'Dep. Bruno Tavares',
    kind: 'opositor',
    ideology: 'direita',
    temperamento: 'agressivo',
    seguidores: 850_000,
    ativo: true,
    bio: 'Deputado federal (PL-RJ). Contra tudo que aumente imposto.',
  },
  {
    id: 'sen_helio_prado',
    handle: '@helioprado',
    nome: 'Sen. Hélio Prado',
    kind: 'opositor',
    ideology: 'centro_direita',
    temperamento: 'formal',
    seguidores: 340_000,
    ativo: true,
    bio: 'Senador (UNIÃO-GO). Responsabilidade fiscal acima de tudo.',
  },
  {
    id: 'dep_veronica_sa',
    handle: '@veronicasa',
    nome: 'Dep. Verônica Sá',
    kind: 'opositor',
    ideology: 'extrema_direita',
    temperamento: 'irônico',
    seguidores: 620_000,
    ativo: true,
    bio: 'Deputada federal (NOVO-SP). Menos Estado, mais liberdade.',
  },

  // ----------------------------------------------------------
  // FIGURAS PÚBLICAS (3)
  // ----------------------------------------------------------
  {
    id: 'youtuber_politico',
    handle: '@canal_nota10',
    nome: 'Canal Nota 10',
    kind: 'influenciador',
    ideology: 'direita',
    temperamento: 'irônico',
    seguidores: 1_400_000,
    ativo: true,
    bio: 'Política explicada em 5 minutos. Viralize o vídeo.',
  },
  {
    id: 'economista_renomado',
    handle: '@dr_eduardo_ferraz',
    nome: 'Dr. Eduardo Ferraz',
    kind: 'influenciador',
    ideology: 'centro_direita',
    temperamento: 'formal',
    seguidores: 480_000,
    ativo: true,
    bio: 'Economista-chefe. Análise sem paixão.',
    foco: 'economy',
  },
  {
    id: 'jurista_observador',
    handle: '@jurista_observa',
    nome: 'Prof. Antônio Vasconcelos',
    kind: 'influenciador',
    ideology: 'centro',
    temperamento: 'formal',
    seguidores: 210_000,
    ativo: true,
    bio: 'Constitucionalista. Comentando o que importa.',
  },

  // ----------------------------------------------------------
  // ATIVISTAS (3)
  // ----------------------------------------------------------
  {
    id: 'ativista_movimento_negro',
    handle: '@luanasouza',
    nome: 'Luana Souza',
    kind: 'lider_social',
    ideology: 'esquerda',
    temperamento: 'agressivo',
    seguidores: 560_000,
    ativo: true,
    bio: 'Coordenadora do Movimento Negro Unificado.',
  },
  {
    id: 'ativista_ambiental',
    handle: '@verde_marina',
    nome: 'Marina Verde',
    kind: 'lider_social',
    ideology: 'esquerda',
    temperamento: 'calmo',
    seguidores: 340_000,
    ativo: true,
    bio: 'Ativista climática. Amazônia é nossa.',
    foco: 'environment',
  },
  {
    id: 'ativista_trabalhista',
    handle: '@joao_cut',
    nome: 'João Batista',
    kind: 'lider_social',
    ideology: 'esquerda',
    temperamento: 'agressivo',
    seguidores: 480_000,
    ativo: true,
    bio: 'Presidente da CUT. Nenhum direito a menos.',
  },

  // ----------------------------------------------------------
  // HATERS (2)
  // ----------------------------------------------------------
  {
    id: 'hater_brasil_livre',
    handle: '@brasil_livre_2026',
    nome: 'Brasil Livre 🇧🇷',
    kind: 'hater',
    ideology: 'extrema_direita',
    temperamento: 'agressivo',
    seguidores: 42_000,
    ativo: true,
    bio: 'Patriota. Contra a imprensa comunista.',
  },
  {
    id: 'hater_progressista',
    handle: '@lula_te_ama_nao',
    nome: 'Esquerda Raiz',
    kind: 'hater',
    ideology: 'extrema_esquerda',
    temperamento: 'agressivo',
    seguidores: 28_000,
    ativo: true,
    bio: 'Sem meias palavras. O povo unido.',
  },

  // ----------------------------------------------------------
  // BOT (1)
  // ----------------------------------------------------------
  {
    id: 'bot_amplifica',
    handle: '@noticia_urgente_br',
    nome: 'Notícia Urgente BR',
    kind: 'bot',
    ideology: 'centro',
    temperamento: 'formal',
    seguidores: 15_000,
    ativo: true,
    bio: 'As últimas notícias do país. 24h por dia.',
  },
];

// ============================================================
// ÍNDICES
// ============================================================

export const PROFILE_BY_ID: Record<string, Perfil> = Object.fromEntries(
  SOCIAL_PROFILES.map((p) => [p.id, p]),
);

export const PROFILE_IDS = SOCIAL_PROFILES.map((p) => p.id);

export function getProfile(id: string): Perfil | undefined {
  return PROFILE_BY_ID[id];
}

export function profilesByKind(kind: ProfileKind): Perfil[] {
  return SOCIAL_PROFILES.filter((p) => p.kind === kind);
}

export function activeProfiles(): Perfil[] {
  return SOCIAL_PROFILES.filter((p) => p.ativo);
}

// ============================================================
// PERFIL DO JOGADOR
// ============================================================

/**
 * O jogador também é um perfil na rede. Não fica na lista fixa
 * porque depende do nome/partido que ele escolher no início.
 * Este helper gera o perfil dele.
 */
export interface PlayerProfile {
  id: 'player';
  handle: string;
  nome: string;
  kind: 'jogador';
  ideology: Ideology;
  temperamento: Temperamento;
  seguidores: number;
  ativo: true;
}

export function makePlayerProfile(opts: {
  nome: string;
  handle?: string;
  ideology: Ideology;
  seguidores?: number;
}): PlayerProfile {
  const handle =
    opts.handle ??
    '@' +
      opts.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 20);

  return {
    id: 'player',
    handle,
    nome: opts.nome,
    kind: 'jogador',
    ideology: opts.ideology,
    temperamento: 'formal',
    seguidores: opts.seguidores ?? 5_000_000,
    ativo: true,
  };
}