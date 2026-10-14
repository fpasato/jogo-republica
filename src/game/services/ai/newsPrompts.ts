// src/game/services/ai/newsPrompts.ts

import type { NewsContext } from './newsContext';

// ============================================================
// SYSTEM
// ============================================================

const SYSTEM_PROMPT = `Você é jornalista de um jogo de política brasileira. Escreva notícias curtas em JSON.

## REGRAS
1. JSON válido sempre. Nada antes, nada depois.
2. Português brasileiro.
3. 2-3 parágrafos curtos por notícia.
4. Use APENAS números do contexto.
5. Nomes legíveis, sem ids técnicos.
6. CADA notícia trata de UM gatilho.
7. Varie os veículos: cada notícia escolhe um diferente.

## FORMATO
{
  "noticias": [
    {
      "manchete": "até 90 chars",
      "submanchete": "até 140 chars",
      "corpo": "parágrafos separados por \\n\\n",
      "tom": "positivo" | "neutro" | "negativo",
      "veiculo": "correio_nacional" | "gazeta_brasil" | "diario_cidadao" | "jornal_economico" | "voz_popular" | "observador_progressista",
      "importancia": 1 | 2 | 3,
      "destaques": [{ "id": "id", "label": "Nome", "value": 0, "delta": 0 }]
    }
  ]
}

## TOM POR VEÍCULO
- correio_nacional: neutro, factual
- gazeta_brasil: crítico, foco fiscal/segurança
- diario_cidadao: foco social e popular
- jornal_economico: técnico, cita números
- voz_popular: simples, direto ao bolso
- observador_progressista: direitos, meio ambiente

## EXEMPLO

Gatilho: "Criminalidade subiu há 8 meses. Variação +12,4. Valor atual 28.3"

{
  "noticias": [{
    "manchete": "Criminalidade sobe pelo oitavo mês seguido",
    "submanchete": "Índice preocupa autoridades e pressiona governo",
    "corpo": "A criminalidade subiu pelo oitavo mês consecutivo, atingindo 28,3 pontos. É o maior nível dos últimos anos.\\n\\nEspecialistas apontam falhas na política de segurança e cobram resposta do governo. O Planalto ainda não se pronunciou sobre o caso.",
    "tom": "negativo",
    "veiculo": "gazeta_brasil",
    "importancia": 2,
    "destaques": [{ "id": "criminality", "label": "Criminalidade", "value": 28.3, "delta": 12.4 }]
  }]
}`;

// ============================================================
// USER
// ============================================================

export interface NewsPromptPayload {
  system: string;
  user: string;
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function buildNewsPrompt(ctx: NewsContext, count: number): NewsPromptPayload {
  const lines: string[] = [];

  lines.push(`# DATA DO JOGO`);
  lines.push(`${MONTHS_PT[ctx.month - 1]} de ${ctx.year}`);
  lines.push('');

  // ---------- País ----------
  lines.push('## Situação do país');
  lines.push(`- Aprovação do governo: ${ctx.country.approval.toFixed(1)}`);
  for (const m of ctx.country.macros) {
    lines.push(`- ${m.label}: ${formatNum(m.value)}`);
  }
  lines.push('');

  // ---------- Grupos em crise ----------
  if (ctx.gruposEmCrise.length > 0) {
    lines.push('## Grupos insatisfeitos');
    for (const g of ctx.gruposEmCrise) {
      lines.push(`- ${g.nome}: aprovação ${g.approval.toFixed(0)}`);
    }
    lines.push('');
  }

  // ---------- Estados críticos ----------
  if (ctx.estadosCriticos.length > 0) {
    lines.push('## Estados com baixa aprovação');
    for (const e of ctx.estadosCriticos) {
      lines.push(`- ${e.nome}: ${e.approval.toFixed(0)}`);
    }
    lines.push('');
  }

  // ---------- Tendências ----------
  if (ctx.tendencias.length > 0) {
    lines.push('## Tendências detectadas');
    for (const t of ctx.tendencias) {
      lines.push(
        `- ${t.label} (${t.category}): ${t.direction} há ${t.months} meses. ` +
        `Δ ${formatDelta(t.totalDelta)} ${t.unit}, valor atual ${formatNum(t.value)}. ` +
        `Severidade: ${t.severity}.`,
      );
    }
    lines.push('');
  }

  // ---------- Gatilhos ----------
  lines.push('## GATILHOS DO MÊS (escreva sobre estes)');
  for (let i = 0; i < ctx.gatilhos.length; i++) {
    const g = ctx.gatilhos[i];
    lines.push(`### Gatilho ${i + 1} — ${g.kind} — tema: ${g.tema}`);
    lines.push(`Descrição: ${g.detalhe}`);
    lines.push(`Imagem disponível: sim (será anexada)`);
    if (g.refId) lines.push(`Ref: ${g.refId}`);
    lines.push('');
  }

  // ---------- Veículos ----------
  lines.push('## Veículos disponíveis');
  for (const v of ctx.veiculos) {
    lines.push(`- ${v.id} (${v.nome}) — ${v.bias}: ${v.estilo}`);
  }
  lines.push('');

  // ---------- Instrução final ----------
  lines.push('# SUA TAREFA');
  lines.push('');
  lines.push(`Escreva ${count} notícia(s), uma para cada um dos ${count} primeiros gatilhos acima.`);
  lines.push('Ordene por importância (maior primeiro).');
  lines.push('Responda APENAS com JSON válido.');

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

// ============================================================
// HELPERS
// ============================================================

function formatDelta(v: number): string {
  const s = v.toFixed(2).replace(/\.?0+$/, '');
  return v > 0 ? `+${s}` : s;
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)} mi`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)} mil`;
  return v.toFixed(2);
}

export function getNewsSystemPrompt(): string {
  return SYSTEM_PROMPT;
}