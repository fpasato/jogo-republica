// src/game/services/ai/socialPrompts.ts

import type { SocialContext } from './socialContext';

// ============================================================
// SYSTEM
// ============================================================

const SYSTEM_PROMPT = `Você é o motor de uma rede social fictícia dentro de um jogo de simulação política brasileira. Sua tarefa é gerar posts de vários perfis (jornalistas, políticos, ativistas, haters, anônimos) sobre o que está acontecendo no país.

## REGRAS FIXAS

1. Responda SEMPRE com JSON válido. Nada antes, nada depois.
2. Escreva em português brasileiro, com gírias e informalidade quando couber.
3. Cada post tem entre **80 e 200 caracteres**. Nem mais, nem menos.
4. Use APENAS os ids de perfil fornecidos. Não invente perfis.
5. Use APENAS as notícias e tópicos fornecidos. Não invente fatos.
6. Cada post tem UM ângulo claro: apoiar, criticar, ironizar, informar.
7. Posts diferentes devem cobrir ângulos diferentes. Nada de 5 posts repetindo a mesma coisa.

## FORMATO DE SAÍDA

{
  "posts": [
    {
      "perfilId": "id_do_perfil",
      "texto": "conteúdo com 80-200 caracteres",
      "tom": "apoio" | "critica" | "neutro" | "agressivo",
      "dia": 14,
      "hora": 9,
      "minuto": 32,
      "respostaA": "id_de_outro_post_ou_omitir",
      "noticiaVinculada": "id_da_noticia_ou_omitir"
    }
  ]
}

## DISTRIBUIÇÃO DE DIAS E HORAS

- Posts espalhados pelos dias 1 a 28 do mês
- Horas entre 8h e 23h (redes sociais não postam de madrugada com frequência)
- Peso maior em 9h-11h e 18h-22h (horário de pico)
- Nunca dois posts do MESMO perfil no mesmo dia (a menos que seja uma thread)

## COMO ESCOLHER OS PERFIS

- **imprensa**: comenta notícias, tom editorial (seguir o viés do veículo)
- **aliado**: defende o governo, ataca oposição, tom ameno ou indignado
- **opositor**: ataca o governo, aponta falhas, tom firme ou irônico
- **lider_social**: foca no grupo que representa
- **influenciador**: tom viral, clickbait, opinião forte
- **hater**: xinga, provoca, sem filtro, exagera
- **bot**: posta manchete seca com link (sem opinião própria)

## TOM

- **apoio**: defende o governo ou medida
- **critica**: ataca o governo ou medida, mas sem agressividade
- **neutro**: informa sem tomar lado
- **agressivo**: xinga, ironiza pesado, provoca

## EXEMPLO

Contexto: notícia "Criminalidade sobe pelo 8º mês". Aprovação em 42.

{
  "posts": [
    {
      "perfilId": "gazeta_brasil",
      "texto": "Criminalidade sobe pelo oitavo mês consecutivo. Governo não apresenta plano. Leia a análise completa.",
      "tom": "critica",
      "dia": 3,
      "hora": 8,
      "minuto": 15,
      "noticiaVinculada": "news_2026_3_0_abc"
    },
    {
      "perfilId": "dep_bruno_tavares",
      "texto": "Parabéns ao governo que prometeu segurança e entregou isso. O povo nas ruas pagando a conta. Vergonha!",
      "tom": "agressivo",
      "dia": 4,
      "hora": 14,
      "minuto": 22
    },
    {
      "perfilId": "ativista_trabalhista",
      "texto": "Enquanto isso, o trabalhador sai de casa com medo. Segurança não é discurso, é política pública.",
      "tom": "critica",
      "dia": 5,
      "hora": 20,
      "minuto": 45
    },
    {
      "perfilId": "hater_brasil_livre",
      "texto": "Esse governo é uma piada kkkk ta tudo uma bosta e vocês defendendo. Acorda Brasil!",
      "tom": "agressivo",
      "dia": 6,
      "hora": 22,
      "minuto": 8
    }
  ]
}`;

// ============================================================
// USER
// ============================================================

export interface SocialPromptPayload {
  system: string;
  user: string;
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function buildSocialPrompt(ctx: SocialContext): SocialPromptPayload {
  const lines: string[] = [];

  lines.push(`# DATA`);
  lines.push(`${MONTHS_PT[ctx.month - 1]} de ${ctx.year}`);
  lines.push(`Aprovação do governo: ${ctx.pais.approval.toFixed(1)}`);
  lines.push('');

  // ---------- Alertas ----------
  const alertas: string[] = [];
  if (ctx.pais.crise) alertas.push('CLIMA DE CRISE elevado');
  if (ctx.pais.escandalo) alertas.push('EXPOSIÇÃO A ESCÂNDALO alta');
  if (ctx.pais.militar) alertas.push('MAL-ESTAR nos quartéis');
  if (alertas.length > 0) {
    lines.push('## Alertas');
    for (const a of alertas) lines.push(`- ${a}`);
    lines.push('');
  }

  // ---------- Notícias ----------
  if (ctx.noticias.length > 0) {
    lines.push('## Notícias do mês (podem ser comentadas)');
    for (const n of ctx.noticias) {
      lines.push(`- [${n.id}] (${n.veiculo}, tom ${n.tom}) ${n.manchete}`);
    }
    lines.push('');
  }

  // ---------- Posts do jogador ----------
  if (ctx.playerPosts.length > 0) {
    lines.push('## Posts recentes do presidente (@' + ctx.jogador.handle + ')');
    for (const pp of ctx.playerPosts) {
      lines.push(`- [${pp.id}] (tom ${pp.tom}) "${pp.texto}"`);
    }
    lines.push('Alguns perfis DEVEM reagir a esses posts.');
    lines.push('');
  }

  // ---------- Grupos em crise ----------
  if (ctx.gruposEmCrise.length > 0) {
    lines.push('## Grupos insatisfeitos');
    for (const g of ctx.gruposEmCrise) lines.push(`- ${g.nome}`);
    lines.push('');
  }

  // ---------- Tópicos ----------
  lines.push('## Tópicos que DEVEM dominar o feed');
  for (const t of ctx.topicos) {
    lines.push(`- [${t.tipo}] ${t.resumo}`);
  }
  lines.push('');

  // ---------- Perfis ----------
  lines.push('## Perfis disponíveis (use os ids exatos)');
  for (const p of ctx.perfis) {
    const parts = [
      `- **${p.id}** (${p.handle}) — ${p.nome}`,
      `  tipo: ${p.kind}, ideologia: ${p.ideology}, temperamento: ${p.temperamento}`,
    ];
    if (p.foco) parts.push(`  foco: ${p.foco}`);
    if (p.bio) parts.push(`  bio: ${p.bio}`);
    lines.push(parts.join('\n'));
  }
  lines.push('');

  // ---------- Instrução ----------
  lines.push('# SUA TAREFA');
  lines.push('');
  lines.push(`Gere **${ctx.targetCount} posts** distribuídos pelos dias e horas do mês.`);
  lines.push('');
  lines.push('Regras de distribuição:');
  lines.push(`- Varie os perfis: pelo menos ${Math.min(8, Math.ceil(ctx.targetCount / 3))} perfis diferentes`);
  lines.push('- Distribua os posts pelos dias 1 a 28');
  lines.push('- Horas entre 8h e 23h');
  lines.push('- Se houver posts do presidente, 3 a 5 perfis devem reagir a eles');
  lines.push('- Se houver notícia importante, imprensa + 2 ou 3 políticos devem comentar');
  lines.push('');
  lines.push('Responda APENAS com JSON válido.');

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

export function getSocialSystemPrompt(): string {
  return SYSTEM_PROMPT;
}