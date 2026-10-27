import { INDICATORS, INDICATOR_IDS } from '../../data/indicators';
import { GROUPS } from '../../data/groups';
import { INSTRUMENTS } from '../../data/catalog';
import type {
  PolicyContext,
  QueryResult,
  ProfileContext,
} from '../../types/ai';

const GROUP_IDS = GROUPS.map((g) => g.id);

const CATEGORY_LABEL: Record<string, string> = {
  economia: 'Economia e finanças públicas',
  saude: 'Saúde',
  educacao: 'Educação',
  social: 'Social',
  seguranca: 'Segurança pública',
  energia: 'Energia',
  cultura: 'Cultura',
};

// ============================================================
// SYSTEM PROMPT (fonte única de verdade)
// ============================================================
//
// Todas as regras fixas do jogo vivem aqui. As fases (initial e
// analysis) compartilham o MESMO system prompt; só o user muda.
// Isso evita o problema de "duas regras conflitantes".

const SYSTEM_PROMPT = `Você é o analista político do jogo Presidente. Analise a proposta e devolva apenas JSON válido no formato solicitado. Não peça consultas. Seja conciso: no máximo 2 benefícios, 2 riscos e 3 efeitos de indicadores.

## REGRAS FIXAS

1. Responda SEMPRE com JSON válido. Nunca escreva texto antes ou depois do JSON.
2. Use SOMENTE os ids listados abaixo. Não invente ids, não invente valores.
3. Indicadores com escopo "estadual" são aplicados em todos os estados, a menos que "estados_alvo" seja informado.
4. A medida pode ter custo, economia ou ser neutra. A magnitude fiscal segue a escala abaixo.
5. Não calcule os efeitos finais — você ESTIMA, o motor do jogo valida e aplica.
6. Se faltar informação, faça uma estimativa conservadora e indique a incerteza em "riscos".

## ESCALA DE MAGNITUDE FISCAL

Impacto anual em reais:
- \`valor_anual_bi\`: estimativa numérica exata em R$ bilhões por ano (ex.: 300 para economia de R$ 300 bilhões/ano).
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

### Análise (formato final)

{
  "phase": "analysis",
  "analysis": {
    "interpretacao": "resumo em 1-2 frases do que a medida faz",
    "instrumento": "decreto" | "mp" | "projeto_lei" | "lei_complementar" | "pec",
    "motivo_instrumento": "por que esse instrumento é o adequado",
    "impacto_fiscal": {
      "tipo": "neutro" | "custo" | "economia",
      "magnitude": 0,
      "valor_anual_bi": 0,
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

## REGRAS OBRIGATÓRIAS PARA DELTAS EM "indicadores"

1. Todo valor em "indicadores" é a MUDANÇA (delta), nunca o valor final.
   Ex.: salário atual R$ 1.412 → proposta "aumentar para R$ 1.800" →
   salario_minimo: 388 (NÃO 1800).

2. Unidades dos indicadores (respeite a unidade do catálogo):
   - salario_minimo: delta em R$ (ex.: +50, +100, +200)
   - pib_nominal, divida_publica, receitas_publicas, gastos_publicos,
     saldo_orcamentario, balanca_comercial: delta em R$ bilhões
   - inflacao, desemprego, carga_tributaria, crescimento_pib, selic:
     delta em PONTOS PERCENTUAIS (ex.: -0.3, +1.2)
   - cotacao_dolar: delta em R$/US$ (ex.: +0.15, -0.30)
   - poder_compra, informalidade: delta na escala 0-100 (ex.: +2, -1.5)

3. Quando o usuário citar valor-alvo ABSOLUTO, calcule o delta subtraindo
   o valor atual (veja "Valores atuais dos indicadores" no contexto).
   Ex.: "salário para R$ 1.800" com atual 1412 → salario_minimo: 388.

4. Quando o usuário citar PERCENTUAL, aplique sobre o valor atual.
   Ex.: "aumentar salário em 10%" com atual 1412 → salario_minimo: 141.

5. Quando NÃO citar valor nem percentual, use faixa realista:
   - salario_minimo: +20 a +80
   - inflacao: -0.5 a +0.5 p.p.
   - pib_nominal: -50 a +100 (R$ bi)
   - divida_publica: -30 a +50 (R$ bi)
   - carga_tributaria: -0.5 a +0.5 p.p.

6. Mínimos absolutos aceitáveis (abaixo disso é RUÍDO, não medida):
   - salario_minimo: 20 reais
   - receitas_publicas, gastos_publicos: 5 R$ bi
   - NUNCA use 1 ou 2 para esses indicadores.

7. Se a proposta NÃO tem efeito claro sobre um indicador, OMITA-o em vez
   de retornar 0.

8. Se o instrumento for MP (medida provisória) ou lei, use
   implementationMonths ≥ 1 e effectRampUpMonths ≥ 2 por padrão, salvo se
   a proposta for explicitamente imediata.

## SEMÂNTICA DOS CAMPOS

- \`intensidade\`: reação política imediata, de 0 (nenhuma) a 3 (extrema).
- \`posicao_ideologica\`: escala de -3 (esquerda) a +3 (direita).
- \`grupos\`: deltas de aprovação; positivo aumenta, negativo reduz. Use ±1 (pequeno), ±3 (moderado), ±6 (grande); omita grupos sem reação.
- \`indicadores\`: deltas totais durante \`effectRampUpMonths\`; omita indicadores sem efeito claro.
- \`estados_alvo\`: informe somente para medida regional; ausente significa nacional.
- \`implementationMonths\`: 0–24 meses até começar; \`effectRampUpMonths\`: 0–36 meses até efeito pleno.
- \`durationType\`: \`permanent\` por padrão ou \`temporary\` com \`durationMonths\`.

## DIRETRIZES DE QUALIDADE

Para grupos, sempre dê sinal positivo (+4 a +10) ao grupo diretamente beneficiado e sinal negativo a quem paga o custo. Exemplo: aumento do salário mínimo beneficia trabalhadores; \`trabalhadores: -6\` está ERRADO. Medidas estruturais podem usar +6 a +12 no alvo e -4 a -8 em quem paga.

Seja proporcional à proposta. Para propostas vagas, escolha instrumento conservador e efeitos modestos. Use no máximo 2 benefícios, 2 riscos e 3 efeitos de indicadores; assessoria jurídica em uma frase técnica. Se houver conflito com medida ativa, cite em efeitos_colaterais.`;

// ============================================================
// GERADOR DA LISTA DE INDICADORES
// ============================================================

function groupIndicatorList(): string {
  const byCat: Record<string, string[]> = {};
  for (const ind of INDICATORS) {
    (byCat[ind.category] ??= []).push(`\`${ind.id}\` (${ind.nome})`);
  }
  return Object.entries(byCat)
    .map(([cat, items]) => `### ${CATEGORY_LABEL[cat] ?? cat}\n${items.join(', ')}`)
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
  const list = Object.entries(n.indicators)
    .slice(0, 15)
    .map(([id, val]) => `  - ${id}: ${fmt(val)}`)
    .join('\n');
  return [
    `Aprovação nacional: ${fmt(n.approval)} (${n.approvalTrend})`,
    `Principais indicadores nacionais:`,
    list,
  ].join('\n');
}

function formatStates(): string {
  return 'Abrangência nacional (política aplicada em todo o território).';
}

function formatGroups(ctx: PolicyContext): string {
  return ctx.groups
    .map((g) => `  - ${g.id} (${g.name}): influência ${g.weight}, aprovação ${fmt(g.approval)}%, alinhamento ${fmt(g.lean)}`)
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

/**
 * Bloco com os valores atuais dos indicadores — essencial para a IA
 * calcular deltas quando o jogador cita valores absolutos ou %.
 */
function formatCurrentIndicators(
  indicators: Record<string, number> | undefined,
): string {
  if (!indicators) return '  (nenhum disponível)';

  const RELEVANT = [
    'salario_minimo',
    'inflacao',
    'desemprego',
    'pib_nominal',
    'divida_publica',
    'carga_tributaria',
    'cotacao_dolar',
    'selic',
    'receitas_publicas',
    'gastos_publicos',
    'saldo_orcamentario',
    'balanca_comercial',
    'poder_compra',
    'investimentos_publicos',
  ] as const;

  const FISCAL_BI = new Set([
    'pib_nominal',
    'divida_publica',
    'receitas_publicas',
    'gastos_publicos',
    'saldo_orcamentario',
    'balanca_comercial',
    'investimentos_publicos',
  ]);

  const DECIMAL_2 = new Set([
    'salario_minimo',
    'cotacao_dolar',
    'selic',
  ]);

  const lines = RELEVANT.map((id) => {
    const v = indicators[id];
    if (v === undefined) return null;
    if (FISCAL_BI.has(id)) return `  ${id} = ${v.toFixed(0)} (R$ bi)`;
    if (DECIMAL_2.has(id)) return `  ${id} = ${v.toFixed(2)}`;
    return `  ${id} = ${v.toFixed(2)}`;
  }).filter(Boolean) as string[];

  return lines.length > 0 ? lines.join('\n') : '  (nenhum disponível)';
}

// ============================================================
// PROMPTS DE USUÁRIO
// ============================================================

/**
 * Prompt da análise + contexto da proposta.
 */
export function buildInitialPrompt(context: PolicyContext): string {
  const profile = context.profile ?? {
    playerName: 'Jogador',
    partyId: 'independente',
    partyAcronym: 'IND',
    govIdeology: 0,
    axes: { economia: 0, costumes: 0, seguranca: 0, ambiente: 0, gasto_social: 0 },
  };

  // Contexto compacto para não estourar o prompt
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
    '## Valores atuais dos indicadores nacionais',
    'Use estes valores para calcular deltas quando o jogador citar alvo absoluto ou percentual.',
    formatCurrentIndicators(compactContext.national.indicators),
    '',
    '## Estados',
    formatStates(),
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
    'Produza a análise final no formato { "phase": "analysis", "analysis": { ... } }.',
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
    '# VALORES ATUAIS DOS INDICADORES',
    '',
    'Use estes valores para calcular deltas quando o jogador citar alvo absoluto ou percentual.',
    formatCurrentIndicators(context.national.indicators),
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
// PAYLOADS (system + user)
// ============================================================
//
// Os builders compartilham as regras de delta do `SYSTEM_PROMPT`.

export interface PromptPayload {
  system: string;
  user: string;
}

export function buildInitialPayload(context: PolicyContext): PromptPayload {
  return {
    system: SYSTEM_PROMPT,
    user: buildInitialPrompt(context),
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
// SANITIZAÇÃO PÓS-IA
// ============================================================
//
// Rede de segurança: mesmo com o system prompt correto, alguns
// modelos locais insistem em devolver deltas absurdamente
// pequenos. Esta função corrige antes de enviar para o motor.

const MIN_SALARIO_DELTA = 20;         // R$
const MIN_FISCAL_DELTA_BI = 5;        // R$ bilhões
const ZERO_THRESHOLD = 0.001;

interface SanitizableAnalysis {
  indicadores?: Record<string, number>;
  warnings?: string[];
}

/**
 * Corrige deltas de indicadores abaixo do mínimo viável e remove
 * deltas irrelevantes (< 0.001). Deve ser chamada DEPOIS de parsear
 * o JSON da IA e ANTES de entregar para o store.
 *
 * @param analysis Análise (mutada in-place).
 * @returns Lista de avisos gerados (também anexada em `analysis.warnings`).
 */
export function sanitizeAnalysisDeltas(
  analysis: SanitizableAnalysis,
): string[] {
  const ind = analysis.indicadores ?? {};
  const warnings: string[] = [];

  // ---- Salário mínimo ----
  const sal = ind.salario_minimo;
  if (
    sal !== undefined &&
    sal !== 0 &&
    Math.abs(sal) < MIN_SALARIO_DELTA
  ) {
    const sign = Math.sign(sal);
    const novo = sign * MIN_SALARIO_DELTA;
    warnings.push(
      `salario_minimo ajustado de ${sal} para ${novo} (mínimo viável).`,
    );
    ind.salario_minimo = novo;
  }

  // ---- Receitas e gastos públicos ----
  for (const id of ['receitas_publicas', 'gastos_publicos'] as const) {
    const v = ind[id];
    if (v !== undefined && v !== 0 && Math.abs(v) < MIN_FISCAL_DELTA_BI) {
      const sign = Math.sign(v);
      const novo = sign * MIN_FISCAL_DELTA_BI;
      warnings.push(`${id} ajustado de ${v} para ${novo} (mínimo viável).`);
      ind[id] = novo;
    }
  }

  // ---- Remove ruído ----
  for (const k of Object.keys(ind)) {
    if (Math.abs(ind[k]) < ZERO_THRESHOLD) {
      delete ind[k];
    }
  }

  // ---- Persiste warnings na análise ----
  if (warnings.length > 0) {
    analysis.warnings = [...(analysis.warnings ?? []), ...warnings];
  }

  analysis.indicadores = ind;
  return warnings;
}

// ============================================================
// HELPERS DE FORMATAÇÃO
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
