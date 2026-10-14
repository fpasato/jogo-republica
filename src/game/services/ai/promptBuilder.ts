import { INDICATORS, INDICATOR_IDS } from '../../data/indicators';
import { GROUP_IDS } from '../../data/groups';
import { INSTRUMENTS } from '../../data/catalog';
import { QUERY_MENU_TEXT } from '../../data/queryCatalog';
import type {
  PolicyContext,
  QueryResult,
  ProfileContext,
} from '../../types/ai';

const CATEGORY_LABEL: Record<string, string> = {
  economia: 'Economia',
  saude: 'Saúde',
  educacao: 'Educação',
  seguranca: 'Segurança',
  infraestrutura: 'Infraestrutura',
  social: 'Social',
  ambiente: 'Meio Ambiente',
  gestao: 'Gestão',
  politica: 'Política',
};

// ============================================================
// SYSTEM PROMPT (fixo — não muda entre turnos)
// ============================================================
//
// Este prompt é grande de propósito: é onde vivem TODAS as regras
// fixas do jogo. O prompt do usuário (mais abaixo) fica pequeno e
// focado no turno atual.

const SYSTEM_PROMPT = `Você é o analista político do jogo Presidente. Analise a proposta e devolva apenas JSON válido no formato solicitado. Não peça consultas. Seja conciso: no máximo 2 benefícios, 2 riscos e 3 efeitos de indicadores.

## REGRAS FIXAS

1. Responda SEMPRE com JSON válido. Nunca escreva texto antes ou depois do JSON.
2. Use SOMENTE os ids listados abaixo. Não invente ids, não invente valores.
3. Indicadores com escopo "estadual" são aplicados em todos os estados, a menos que "estados_alvo" seja informado.
4. A medida pode ter custo, economia ou ser neutra. A magnitude fiscal segue a escala abaixo.
5. Não calcule os efeitos finais — você ESTIMA, o motor do jogo valida e aplica.
6. Se não houver informação suficiente, use o formato de consulta (fase 1). Não invente.

## ESCALA DE MAGNITUDE FISCAL

Impacto anual em reais:
- 0 = R$ 0 (neutro, sem impacto fiscal)
- 1 = R$ 1 bilhão (micro — categoria, piloto)
- 2 = R$ 5 bilhões (pequeno — setor específico)
- 3 = R$ 15 bilhões (médio-baixo — nacional limitado)
- 4 = R$ 40 bilhões (médio — nacional, milhões de pessoas)
- 5 = R$ 100 bilhões (grande — estrutural)
- 6 = R$ 250 bilhões (gigante — reforma histórica)
- 7 = R$ 500 bilhões (colossal — reforma civilizatória)

## INSTRUMENTOS

${INSTRUMENTS.map((i) => `- ${i.id} (${i.label}): ${i.quandoUsar}`).join('\n')}

## INDICADORES DISPONÍVEIS

Agrupados por categoria. Formato: \`id\` (nome). Use exatamente o id no campo "indicadores".

${groupIndicatorList()}

## GRUPOS SOCIAIS DISPONÍVEIS

${GROUP_IDS.join(', ')}

Use exatamente esses ids no campo "grupos".

## FORMATO DE SAÍDA

### Fase 1 (consulta — use SOMENTE se faltar informação essencial)

Você pode pedir dados adicionais. Limite: 8 consultas por rodada, 2 rodadas máximas.

Consultas disponíveis:
${QUERY_MENU_TEXT.split('\n').slice(0, 8).join('\n')}

Se precisar consultar:
{
  "phase": "query",
  "reasoning": "por que preciso desses dados",
  "queries": [ { "type": "national_indicators", "ids": ["acesso_saude"] } ]
}

Se já tiver informação suficiente, pule direto para a fase 2.

### Fase 2 (análise — formato final)

{
  "phase": "analysis",
  "analysis": {
    "interpretacao": "resumo em 1-2 frases do que a medida faz",
    "instrumento": "decreto" | "mp" | "projeto_lei" | "lei_complementar" | "pec",
    "motivo_instrumento": "por que esse instrumento é o adequado",
    "impacto_fiscal": {
      "tipo": "neutro" | "custo" | "economia",
      "magnitude": 0,
      "nota": "explicação curta em reais"
    },
    "intensidade": 0,
    "posicao_ideologica": 0,
    "grupos": { "id_do_grupo": 0 },
    "indicadores": { "id_do_indicador": 0 },
    "estados_alvo": ["SP"],
    "risco_juridico": "baixo" | "medio" | "alto",
    "assessoria_juridica": "parecer curto",
    "objetivo": "objetivo declarado da medida",
    "beneficios": ["..."],
    "riscos": ["..."],
    "efeitos_colaterais": ["..."],
    "implementationMonths": 0,
    "effectRampUpMonths": 0,
    "durationType": "permanent",
    "durationMonths": 0,
    "area_principal": "saude",
    "areas_secundarias": ["educacao"]
  }
}

## SEMÂNTICA DOS CAMPOS

- **intensidade**: 0 (sem choque) a 3 (choque extremo). Mede reação política imediata.
  - 0 = passa sem abalar ninguém
  - 1 = alguns grupos sentem, mas o país segue calmo
  - 2 = quem perde sente no ato, clima político esquenta
  - 3 = medida extrema, país inteiro tensionado

- **posicao_ideologica**: -3 (extrema esquerda) a +3 (extrema direita).

- **grupos**: delta de aprovação de cada grupo afetado.
  - Positivo = grupo aprova mais
  - Negativo = grupo aprova menos
  - Escala: ±1 (pequeno), ±3 (moderado), ±6 (grande), ±10 (raro, medida histórica)
  - Grupos não listados = sem reação

- **indicadores**: delta TOTAL ao longo de \`effectRampUpMonths\`.
  - Positivo = indicador sobe, negativo = indicador cai
  - Escala: cerca de 5% a 20% do valor atual, dependendo da magnitude da medida
  - Ex: "reduzir homicídios" com magnitude 4 → homicidios: -3 (queda absoluta de 3 unidades)

- **estados_alvo**: liste apenas se a medida for regional. Ausente = nacional.

- **implementationMonths**: 0 (imediato) a 24. Tempo até começar a aplicar.
- **effectRampUpMonths**: 0 (aplica tudo de uma vez) a 36. Tempo até efeito pleno.
- **durationType**: "permanent" (padrão) ou "temporary" (com durationMonths).

## DIRETRIZES DE QUALIDADE

- Se a proposta for vaga, escolha o instrumento mais conservador e a menor magnitude.
- Se a proposta for ambiciosa e bem descrita, use magnitude e intensidade maiores.
- Se um grupo claramente se beneficia, dê +1 a +3. Se claramente se prejudica, dê -1 a -3.
- Evite deltas exagerados em indicadores que não foram o foco da medida.
- Se a medida conflita com política ativa, mencione em "efeitos_colaterais".
- "assessoria_juridica" deve ser uma frase curta, técnica.

## EXEMPLO

Proposta: "Aumentar o salário mínimo em 10% a partir do próximo mês"

{
  "phase": "analysis",
  "analysis": {
    "interpretacao": "Reajuste de 10% no salário mínimo, elevando de R$ 1.412 para R$ 1.553.",
    "instrumento": "projeto_lei",
    "motivo_instrumento": "Reajuste do mínimo exige lei ordinária; não é matéria de decreto nem de urgência constitucional.",
    "impacto_fiscal": {
      "tipo": "custo",
      "magnitude": 4,
      "nota": "Impacto anual estimado em ~R$ 40 bilhões (previdência + servidores + abono)."
    },
    "intensidade": 2,
    "posicao_ideologica": -2,
    "grupos": {
      "trabalhadores": 5,
      "aposentados": 3,
      "empresarios": -3,
      "mercado_financeiro": -2
    },
    "indicadores": {
      "salario_minimo": 141,
      "poder_compra": 3,
      "desemprego": 0.3,
      "inflacao": 0.4,
      "informalidade": 0.5
    },
    "risco_juridico": "baixo",
    "assessoria_juridica": "Reajuste está dentro da competência da União; sem risco constitucional relevante.",
    "objetivo": "Recuperar poder de compra dos trabalhadores",
    "beneficios": ["Aumento direto da renda", "Redução da pobreza"],
    "riscos": ["Pressão inflacionária", "Custo fiscal elevado"],
    "efeitos_colaterais": ["Possível aumento de informalidade"],
    "effectRampUpMonths": 3,
    "durationType": "permanent",
    "area_principal": "economia",
    "areas_secundarias": ["social"]
  }
}`;

// ============================================================
// GERADOR DA LISTA DE INDICADORES
// ============================================================

function groupIndicatorList(): string {
  const byCat: Record<string, string[]> = {};
  for (const id of INDICATOR_IDS) {
    const ind = INDICATORS[id];
    (byCat[ind.category] ??= []).push(`\`${id}\` (${ind.name})`);
  }
  return Object.entries(byCat)
    .map(([cat, items]) => `### ${CATEGORY_LABEL[cat] ?? cat}\n${items.slice(0, 18).join(', ')}`)
    .join('\n\n');
}

// ============================================================
// FORMATADORES DE CONTEXTO
// ============================================================

function formatProfile(p: ProfileContext): string {
  const axes = p.axes;
  return [
    `Jogador: ${p.playerName} (${p.partyAcronym})`,
    `Ideologia geral: ${p.govIdeology.toFixed(1)}${p.govIdeologyLabel ? ` (${p.govIdeologyLabel})` : ''}`,
    `Eixos: economia=${axes.economia}, costumes=${axes.costumes}, segurança=${axes.seguranca}, ambiente=${axes.ambiente}, gasto_social=${axes.gasto_social}`,
  ].join('\n');
}

function formatNational(ctx: PolicyContext): string {
  const n = ctx.national;
  const macro = n.macro
    .map((m) => `  - ${m.id} (${m.label}): ${fmt(m.value)} ${m.unit} [${m.classification}, ${m.trend}${m.recentDelta ? `, Δ ${fmt(m.recentDelta)}` : ''}]`)
    .join('\n');
  const fiscal = n.fiscal
    .map((f) => `  - ${f.id} (${f.label}): ${fmt(f.value)} ${f.unit} [${f.classification}, ${f.trend}]`)
    .join('\n');
  return [
    `Aprovação nacional: ${fmt(n.approval)} (${n.approvalTrend})`,
    `Macros:`,
    macro,
    `Fiscal:`,
    fiscal,
  ].join('\n');
}

function formatStates(ctx: PolicyContext): string {
  const highlighted = ctx.states.filter((s) => s.highlighted);
  const others = ctx.states.filter((s) => !s.highlighted);

  const lines: string[] = [];

  if (highlighted.length > 0) {
    lines.push('Estados MENCIONADOS na proposta:');
    for (const s of highlighted) {
      lines.push(
        `  - ${s.id} ${s.name} (${s.region}): pop ${fmtBig(s.population)}, aprovação ${fmt(s.approval)}, inclinação ${fmt(s.politicalInclination)}`,
      );
    }
  }

  lines.push('Outros estados (resumo):');
  const compact = others
    .map((s) => `${s.id}(${s.region.slice(0, 3)}, ap=${fmt(s.approval, 0)})`)
    .join(' ');
  lines.push(`  ${compact}`);

  return lines.join('\n');
}

function formatGroups(ctx: PolicyContext): string {
  return ctx.groups
    .map((g) => {
      const extra: string[] = [];
      if (g.combativeness && g.combativeness !== 1) extra.push(`comb=${g.combativeness}`);
      if (g.reaction?.active) extra.push(`EM REAÇÃO há ${g.reaction.monthsActive}m`);
      const suffix = extra.length ? ` [${extra.join(', ')}]` : '';
      return `  - ${g.id} (${g.name}): peso ${g.weight}, aprovação ${fmt(g.approval)}, lean ${fmt(g.lean)}${suffix}`;
    })
    .join('\n');
}

function formatActivePolicies(ctx: PolicyContext): string {
  if (ctx.activePolicies.length === 0) return '  (nenhuma medida em vigor)';
  return ctx.activePolicies
    .map((p) => {
      const parts = [
        `${p.name} [${p.type}]`,
        `status=${p.status}`,
        `ativo há ${p.activeMonths}m`,
      ];
      if (p.monthsToFullEffect > 0) parts.push(`efeito pleno em ${p.monthsToFullEffect}m`);
      if (p.monthsToExpire !== undefined) parts.push(`expira em ${p.monthsToExpire}m`);
      if (p.affectedIndicators.length)
        parts.push(`ind: ${p.affectedIndicators.join(',')}`);
      if (p.affectedGroups.length)
        parts.push(
          `grupos: ${p.affectedGroups.map((g) => `${g.id}${g.delta >= 0 ? '+' : ''}${g.delta}`).join(',')}`,
        );
      parts.push(`fiscal: ${fmtBig(p.fiscalAnnual)}/ano`);
      return `  - ${parts.join(' | ')}`;
    })
    .join('\n');
}

function formatCrises(ctx: PolicyContext): string {
  if (ctx.activeCrises.length === 0) return '  (nenhuma)';
  return ctx.activeCrises
    .map((c) => `  - [${c.severity}] ${c.kind}: ${c.description}`)
    .join('\n');
}

// ============================================================
// PROMPTS DE USUÁRIO
// ============================================================

/**
 * Prompt da fase 1 — contexto inicial + proposta.
 * A IA decide se consulta ou analisa direto.
 */
export function buildInitialPrompt(context: PolicyContext): string {
  const profile = context.profile ?? {
    playerName: 'Jogador',
    partyId: 'independente',
    partyAcronym: 'IND',
    govIdeology: 0,
    axes: { economia: 0, costumes: 0, seguranca: 0, ambiente: 0, gasto_social: 0 },
  };
  const compactContext: PolicyContext = {
    ...context,
    national: {
      ...context.national,
      macro: context.national.macro.slice(0, 6),
      fiscal: context.national.fiscal.slice(0, 4),
    },
    states: context.states.filter((state) => state.highlighted).slice(0, 6),
    groups: context.groups.slice(0, 8),
    activePolicies: context.activePolicies.slice(0, 8),
    history: { ...context.history, indicators: {}, groupApprovals: {}, nationalApproval: [] },
  };
  return [
    '# CONTEXTO ATUAL',
    '',
    '## Perfil do jogador',
    formatProfile(profile),
    '',
    '## Situação nacional',
    formatNational(compactContext),
    '',
    '## Estados',
    compactContext.states.length ? formatStates(compactContext) : 'Use abrangência nacional, salvo se a proposta citar um estado.',
    '',
    '## Grupos sociais',
    formatGroups(compactContext),
    '',
    '## Medidas em vigor',
    formatActivePolicies(compactContext),
    '',
    '## Crises e reações ativas',
    formatCrises(compactContext),
    '',
    '## Histórico recente',
    'Sem série histórica detalhada nesta etapa.',
    '',
    '# PROPOSTA DO JOGADOR',
    '',
    `"${context.proposal}"`,
    '',
    '# SUA VEZ',
    '',
    'Se faltar informação essencial, responda com { "phase": "query", ... }.',
    'Se já tiver o suficiente, responda com { "phase": "analysis", "analysis": { ... } }.',
    '',
    'Responda APENAS com JSON válido. Nada antes, nada depois.',
  ].join('\n');
}

/**
 * Prompt da fase 2 — inclui os resultados das consultas da IA.
 * Nesta fase, a IA DEVE produzir análise final.
 */
export function buildAnalysisPrompt(
  context: PolicyContext,
  queries: QueryResult[],
): string {
  const queryBlock = queries.length === 0
    ? '  (nenhuma consulta realizada)'
    : queries
        .map((q) => {
          if (q.ok) {
            return `### ✓ ${q.type}\n${JSON.stringify(q.data, null, 2)}`;
          }
          const sug = q.suggestions?.length
            ? `\n  Sugestões: ${q.suggestions.join(', ')}`
            : '';
          return `### ✗ ${q.type}\n  Erro: ${q.error}${sug}`;
        })
        .join('\n\n');

  return [
    '# RESULTADOS DAS CONSULTAS',
    '',
    queryBlock,
    '',
    '# PROPOSTA (recapitulação)',
    '',
    `"${context.proposal}"`,
    '',
    '# SUA VEZ',
    '',
    'Produza a análise final no formato:',
    '{ "phase": "analysis", "analysis": { ... } }',
    '',
    'Não peça mais consultas. Responda APENAS com JSON válido.',
  ].join('\n');
}

// ============================================================
// EXPORTAÇÃO DE PROMPTS COMPLETOS
// ============================================================

export interface PromptPayload {
  system: string;
  user: string;
}

export function buildInitialPayload(context: PolicyContext): PromptPayload {
  return {
    system: [
      'Analista político do jogo Presidente. Responda somente JSON, sem markdown nem consultas.',
      `Instrumentos permitidos: ${INSTRUMENTS.map((i) => i.id).join(', ')}.`,
      `IDs de indicadores: ${INDICATOR_IDS.join(', ')}. IDs de grupos: ${GROUP_IDS.join(', ')}.`,
      'Formato obrigatório: {"phase":"analysis","analysis":{"interpretacao":"1-2 frases","instrumento":"id","motivo_instrumento":"curto","impacto_fiscal":{"tipo":"neutro|custo|economia","magnitude":0,"nota":"curta"},"intensidade":1,"posicao_ideologica":0,"grupos":{},"indicadores":{},"estados_alvo":[],"risco_juridico":"baixo|medio|alto","assessoria_juridica":"curta","objetivo":"curto","beneficios":[],"riscos":[],"efeitos_colaterais":[],"implementationMonths":0,"effectRampUpMonths":0,"durationType":"permanent","durationMonths":0,"area_principal":"categoria","areas_secundarias":[]}}',
      'Use poucos efeitos relevantes e deltas moderados. Magnitude fiscal 0-7. Áreas válidas: economia, saude, educacao, seguranca, infraestrutura, social, ambiente, gestao, politica. No máximo 2 itens em cada lista.',
    ].join('\n'),
    user: [
      `Mês ${context.month}; aprovação ${context.national.approval.toFixed(0)}%.`,
      `Macros: ${context.national.macro.slice(0, 5).map((m) => `${m.id}=${m.value.toFixed(1)}`).join(', ')}.`,
      `Perfil: ${context.profile.playerName}, partido ${context.profile.partyAcronym}, ideologia ${context.profile.govIdeology}.`,
      `Crises: ${context.activeCrises.slice(0, 3).map((c) => c.description).join(' | ') || 'nenhuma'}.`,
      `Proposta: ${context.proposal}`,
    ].join('\n'),
  };
}

export function buildAnalysisPayload(
  context: PolicyContext,
  queries: QueryResult[],
): PromptPayload {
  return {
    system: SYSTEM_PROMPT,
    user: buildAnalysisPrompt(context, queries),
  };
}

/** Retorna só o system prompt — útil pra testes e inspeção. */
export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

// ============================================================
// HELPERS
// ============================================================

function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals).replace(/\.?0+$/, '');
}

function fmtBig(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(1)} tri`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)} bi`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(0)} mi`;
  return `${n.toFixed(0)}`;
}
