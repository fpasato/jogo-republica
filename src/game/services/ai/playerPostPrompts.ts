// src/game/services/ai/playerPostPrompts.ts

import type { PlayerPostContext } from './playerPostContext';

// ============================================================
// SYSTEM
// ============================================================

const SYSTEM_PROMPT = `Você é o "analista social" do jogo. Sua tarefa é avaliar posts que o PRESIDENTE publicou na rede social no mês anterior, decidir o impacto e gerar reações de outros perfis.

## REGRAS FIXAS

1. Responda SEMPRE com JSON válido. Nada antes, nada depois.
2. Escreva em português brasileiro.
3. Cada resposta tem entre **80 e 200 caracteres**.
4. Use APENAS os ids de perfil fornecidos.
5. NÃO invente fatos. Baseie a análise no que o post realmente diz.
6. Seja REALISTA. A maioria dos posts NÃO vira notícia nem viraliza.

## FORMATO DE SAÍDA

{
  "analyses": [
    {
      "postId": "id_do_post_do_jogador",
      "viralizou": false,
      "virouNoticia": false,
      "mancheteNoticia": "só se virouNoticia for true",
      "reacaoSocial": -2,
      "scandalAdd": 0,
      "respostas": [
        {
          "perfilId": "id_do_perfil",
          "texto": "80-200 chars",
          "tom": "apoio" | "critica" | "neutro" | "agressivo"
        }
      ]
    }
  ]
}

## COMO DECIDIR

### viralizou
- Tom **agressivo** + alvo famoso: 60% chance
- Tom **oficial** com anúncio importante: 30%
- Tom **normal**: 10%
- Tom **resposta a hater**: 40% (guerra de narrativa)

### virouNoticia
- Tom **agressivo** com xingamento: 70%
- Tom **agressivo** sem xingamento: 40%
- Tom **oficial**: 15%
- Tom **normal**: 5%
- Resposta a hater: 30%

### reacaoSocial (-5 a +5)
- **Positivo**: anúncio que agrada (aumento de salário mínimo, programa social)
- **Negativo**: ataque, xingamento, provocação
- **Zero**: posts neutros, informativos
- Escala: ±1 leve, ±3 moderado, ±5 forte

### scandalAdd (0 a 5)
- Xingamento direto a pessoa pública: +2 a +4
- Ataque institucional: +2 a +3
- Tom polêmico em crise: +1 a +2
- Caso contrário: 0

### respostas
- 2 a 6 por post
- Misture apoiadores, opositores, haters
- Perfis aliados (alinhamento próximo de +1) defendem
- Perfis opositores (alinhamento próximo de -1) atacam
- Haters xingam de volta
- Imprensa cobra posicionamento
- NÃO use o mesmo perfil em mais de uma resposta no mesmo post

## EXEMPLO

Contexto: presidente escreveu "Esse deputado é um vagabundo que só pensa em si mesmo. O povo que se dane!" (tom agressivo). Aprovação em 42.

{
  "analyses": [{
    "postId": "player_post_2026_3_1",
    "viralizou": true,
    "virouNoticia": true,
    "mancheteNoticia": "Presidente xinga deputado nas redes sociais",
    "reacaoSocial": -4,
    "scandalAdd": 3,
    "respostas": [
      { "perfilId": "gazeta_brasil", "texto": "Presidente ataca deputado federal nas redes e ignora crise. Que exemplo é esse para o país?", "tom": "critica" },
      { "perfilId": "dep_bruno_tavares", "texto": "Isso é o presidente da República. Um cargo que deveria ser respeitado. Vergonha nacional.", "tom": "agressivo" },
      { "perfilId": "dep_renata_lopes", "texto": "Presidente está do lado do povo. Diferente de quem só defende banqueiro.", "tom": "apoio" },
      { "perfilId": "hater_brasil_livre", "texto": "Agora fala a verdade e vocês ficam com frescura. Hipocrisia total!", "tom": "agressivo" }
    ]
  }]
}`;

// ============================================================
// USER
// ============================================================

export interface PlayerPostPromptPayload {
  system: string;
  user: string;
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function buildPlayerPostPrompt(ctx: PlayerPostContext): PlayerPostPromptPayload {
  const lines: string[] = [];

  lines.push(`# DATA`);
  lines.push(`${MONTHS_PT[ctx.month - 1]} de ${ctx.year}`);
  lines.push('');

  // ---------- Contexto do jogador ----------
  lines.push('## Presidente');
  lines.push(`- Nome: ${ctx.jogador.nome}`);
  lines.push(`- Handle: ${ctx.jogador.handle}`);
  lines.push(`- Ideologia: ${ctx.jogador.ideology}`);
  lines.push(`- Aprovação nacional: ${ctx.jogador.approval.toFixed(1)}`);
  lines.push(`- Clima de crise: ${ctx.crisisClimate.toFixed(0)}/100`);
  lines.push(`- Exposição a escândalo: ${ctx.scandalExposure.toFixed(0)}/100`);
  lines.push('');

  // ---------- Notícias do mês ----------
  if (ctx.noticias.length > 0) {
    lines.push('## Notícias recentes');
    for (const n of ctx.noticias) {
      lines.push(`- [${n.id}] (${n.tom}) ${n.manchete}`);
    }
    lines.push('');
  }

  // ---------- Grupos ----------
  lines.push('## Grupos sociais (aprovação atual)');
  for (const g of ctx.gruposRelevantes) {
    lines.push(`- ${g.nome}: ${g.approval.toFixed(0)}`);
  }
  lines.push('');

  // ---------- Posts do jogador ----------
  lines.push('# POSTS DO PRESIDENTE PARA ANALISAR');
  lines.push('');
  for (const p of ctx.playerPosts) {
    lines.push(`## Post ${p.id}`);
    lines.push(`Tom: ${p.tom}`);
    lines.push(`Texto: "${p.texto}"`);
    if (p.respostaA && p.alvoNome) {
      lines.push(`É resposta a: ${p.alvoNome} (${p.alvoHandle})`);
    }
    lines.push('');
  }

  // ---------- Perfis disponíveis pra responder ----------
  lines.push('# PERFIS DISPONÍVEIS PARA RESPONDER');
  lines.push('(alinhamento: +1 = aliado, 0 = neutro, -1 = opositor)');
  for (const p of ctx.perfis) {
    const al = p.alinhamento.toFixed(2);
    lines.push(`- **${p.id}** (${p.handle}) — ${p.nome} [${p.kind}, ideologia ${p.ideology}, alinhamento ${al}]`);
  }
  lines.push('');

  // ---------- Instrução ----------
  lines.push('# SUA TAREFA');
  lines.push('');
  lines.push(`Analise cada um dos ${ctx.playerPosts.length} posts acima.`);
  lines.push('Seja realista: a MAIORIA dos posts não viraliza nem vira notícia.');
  lines.push('Gere 2 a 6 respostas por post.');
  lines.push('');
  lines.push('Responda APENAS com JSON válido.');

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

export function getPlayerPostSystemPrompt(): string {
  return SYSTEM_PROMPT;
}