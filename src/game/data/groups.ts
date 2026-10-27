// src/game/data/groups.ts
// 12 Grupos políticos, demográficos e de interesses econômicos

export interface GroupDef {
  id: string;
  nome: string;
  curto: string;
  categoria: 'politico' | 'demografico' | 'economico';
  descricao: string;
  peso: number; // Influência política base (0 a 100)
  combatividade: number;
  lean: number; // -1 (esquerda) a +1 (direita)
  initialApproval: number;
}

export const GROUPS: GroupDef[] = [
  // --- Grupos políticos e ideológicos ---
  {
    id: 'conservadores',
    nome: 'Conservadores',
    curto: 'conservadores',
    categoria: 'politico',
    descricao: 'Valorizam tradição, ordem social e continuidade de instituições. Reagem a políticas culturais, educacionais, tributárias e de segurança.',
    peso: 60,
    combatividade: 1.2,
    lean: 0.8,
    initialApproval: 46,
  },
  {
    id: 'progressistas',
    nome: 'Progressistas',
    curto: 'progressistas',
    categoria: 'politico',
    descricao: 'Priorizam mudanças sociais, direitos civis e redução de desigualdades. Reagem a políticas de assistência social, educação e cultura.',
    peso: 55,
    combatividade: 1.2,
    lean: -0.8,
    initialApproval: 54,
  },
  {
    id: 'liberais_economicos',
    nome: 'Liberais econômicos',
    curto: 'liberais',
    categoria: 'politico',
    descricao: 'Priorizam mercado, concorrência e menor intervenção estatal. Reagem especialmente a impostos, regulamentações, privatizações e gastos públicos.',
    peso: 65,
    combatividade: 1.4,
    lean: 0.9,
    initialApproval: 39,
  },
  {
    id: 'trabalhistas',
    nome: 'Trabalhistas e social-democratas',
    curto: 'trabalhistas',
    categoria: 'politico',
    descricao: 'Priorizam direitos trabalhistas, proteção social e serviços públicos. Reagem a salários, benefícios, impostos e investimentos sociais.',
    peso: 65,
    combatividade: 1.2,
    lean: -0.7,
    initialApproval: 56,
  },

  // --- Grupos demográficos e sociais ---
  {
    id: 'jovens',
    nome: 'Jovens',
    curto: 'jovens',
    categoria: 'demografico',
    descricao: 'Reagem a emprego, salário mínimo, educação, moradia, transporte e oportunidades profissionais.',
    peso: 50,
    combatividade: 1.2,
    lean: -0.2,
    initialApproval: 51,
  },
  {
    id: 'idosos',
    nome: 'Idosos',
    curto: 'idosos',
    categoria: 'demografico',
    descricao: 'Reagem a aposentadorias, inflação, saúde, medicamentos e custo de vida.',
    peso: 60,
    combatividade: 1.0,
    lean: 0.3,
    initialApproval: 47,
  },
  {
    id: 'religiosos',
    nome: 'Religiosos',
    curto: 'religiosos',
    categoria: 'demografico',
    descricao: 'Reagem a políticas relacionadas a valores morais, educação, assistência social e liberdade religiosa.',
    peso: 65,
    combatividade: 1.2,
    lean: 0.6,
    initialApproval: 44,
  },
  {
    id: 'baixa_renda',
    nome: 'População de baixa renda',
    curto: 'baixa renda',
    categoria: 'demografico',
    descricao: 'Reage a Bolsa Família, salário mínimo, inflação, desemprego, habitação e serviços públicos.',
    peso: 75,
    combatividade: 1.2,
    lean: -0.4,
    initialApproval: 58,
  },
  {
    id: 'classe_media',
    nome: 'Classe média',
    curto: 'classe média',
    categoria: 'demografico',
    descricao: 'Reage a imposto de renda, custo de vida, emprego, segurança, educação e saúde.',
    peso: 70,
    combatividade: 1.3,
    lean: 0.2,
    initialApproval: 42,
  },

  // --- Grupos de interesses econômicos ---
  {
    id: 'empresarios',
    nome: 'Empresários',
    curto: 'empresários',
    categoria: 'economico',
    descricao: 'Reagem a impostos empresariais, crédito, juros, regulamentação, salários e consumo.',
    peso: 75,
    combatividade: 1.4,
    lean: 0.8,
    initialApproval: 37,
  },
  {
    id: 'agronegocio',
    nome: 'Agronegócio',
    curto: 'agronegócio',
    categoria: 'economico',
    descricao: 'Reage a crédito rural, impostos, exportações, infraestrutura, energia e regulamentação ambiental.',
    peso: 70,
    combatividade: 1.3,
    lean: 0.7,
    initialApproval: 49,
  },
  {
    id: 'servidores_publicos',
    nome: 'Servidores públicos',
    curto: 'servidores públicos',
    categoria: 'economico',
    descricao: 'Reagem a salários, contratação, orçamento público, previdência e reformas administrativas.',
    peso: 60,
    combatividade: 1.3,
    lean: -0.5,
    initialApproval: 53,
  },
];

export const GROUPS_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<string, GroupDef>;

export function getGroup(id: string): GroupDef {
  const g = GROUPS_BY_ID[id];
  if (!g) {
    return {
      id,
      nome: id,
      curto: id,
      categoria: 'politico',
      descricao: '',
      peso: 50,
      combatividade: 1,
      lean: 0,
      initialApproval: 50,
    };
  }
  return g;
}