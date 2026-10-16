import type { NewsItem, NewsCategory, NewsTone, TemplateContext } from './types';
import type { IndicatorId } from '../../types/game';
import { INDICATORS } from '../../data/indicators';
import { pick } from './rng';

const SOURCES: Record<NewsCategory, string[]> = {
  economia:       ['Folha do Mercado', 'Jornal da Economia', 'Valor Nacional', 'Broadcast Financeiro'],
  politica:       ['Diário do Congresso', 'Correio Político', 'Gazeta Nacional', 'Painel Brasília'],
  social:         ['Agência Brasil Popular', 'O Cidadão', 'Rede Social Brasil', 'Jornal Comunitário'],
  seguranca:      ['Boletim Policial', 'Segurança Hoje', 'Diário da Ordem', 'Monitor Nacional'],
  saude:          ['Saúde em Foco', 'Boletim SUS', 'Ciência & Vida', 'Jornal da Medicina'],
  educacao:       ['Educação Hoje', 'Portal do Professor', 'Ciência & Escola', 'Diário Educar'],
  infraestrutura: ['Brasil em Obras', 'Logística Hoje', 'Diário Urbano', 'Jornal da Infraestrutura'],
  meioAmbiente:   ['Planeta Vivo', 'Ambiente Brasil', 'Eco Jornal', 'Alerta Verde'],
};

/** Mapeia indicador → categoria de notícia */
const INDICATOR_CATEGORY: Partial<Record<IndicatorId, NewsCategory>> = {
  inflacao: 'economia', desemprego: 'economia', crescimentoPib: 'economia',
  dolar: 'economia', poderCompra: 'economia', emprego: 'economia',
  receitaPublica: 'economia', despesaPublica: 'economia',
  saldoOrcamentario: 'economia', dividaPublica: 'economia', resultadoFiscal: 'economia',
  criminalidade: 'seguranca',
  acessoSaude: 'saude', qualidadeSaude: 'saude',
  acessoEducacao: 'educacao', qualidadeEducacao: 'educacao',
  aguaTratada: 'infraestrutura', coletaEsgoto: 'infraestrutura', tratamentoEsgoto: 'infraestrutura',
  aprovacao: 'politica',
  confiancaInstituicoes: 'politica',
  gini: 'social', idh: 'social',
};

/** Templates por tom + categoria (frases curtas com {indicador}, {valor}) */
const HEADLINES: Record<NewsCategory, Record<NewsTone, string[]>> = {
  economia: {
    positiva: ['Economia dá sinais de recuperação', 'Mercado reage bem aos números'],
    negativa: ['Economia preocupa analistas', 'Indicadores econômicos pioram'],
    neutra:   ['Economia em movimento', 'Mercado aguarda próximos dados'],
    critica:  ['Especialistas criticam condução econômica', 'Governo é cobrado por resultados'],
    alarmante:['Crise econômica se aprofunda', 'Alerta: economia em risco'],
  },
  politica: {
    positiva: ['Governo ganha fôlego político', 'Aprovação sobe e anima base'],
    negativa: ['Desgaste político cresce', 'Base aliada demonstra insatisfação'],
    neutra:   ['Cenário político em disputa', 'Congresso debate agenda do mês'],
    critica:  ['Oposição pressiona governo', 'Críticas se intensificam no Parlamento'],
    alarmante:['Crise política se agrava', 'Instabilidade preocupa instituições'],
  },
  social: {
    positiva: ['População percebe melhoras', 'Programas sociais avançam'],
    negativa: ['Desigualdade preocupa', 'População sente aperto'],
    neutra:   ['Debate social em pauta', 'Sociedade discute prioridades'],
    critica:  ['Movimentos cobram respostas', 'Cobrança por políticas sociais cresce'],
    alarmante:['Tensão social aumenta', 'Protestos ganham força'],
  },
  seguranca: {
    positiva: ['Segurança melhora em regiões críticas', 'Ações policiais dão resultado'],
    negativa: ['Violência preocupa moradores', 'Índices de criminalidade sobem'],
    neutra:   ['Segurança pública em pauta', 'Debate sobre crime ganha espaço'],
    critica:  ['Especialistas cobram políticas efetivas', 'Governo é criticado na segurança'],
    alarmante:['Onda de violência preocupa', 'Situação da segurança é crítica'],
  },
  saude: {
    positiva: ['Saúde avança com novos investimentos', 'Atendimento melhora em regiões'],
    negativa: ['Sistema de saúde sob pressão', 'Filas e espera preocupam'],
    neutra:   ['Saúde em debate', 'Gestores discutem prioridades'],
    critica:  ['Profissionais cobram condições', 'Críticas ao atendimento crescem'],
    alarmante:['Saúde entra em colapso em regiões', 'Alerta sanitário emitido'],
  },
  educacao: {
    positiva: ['Educação avança em indicadores', 'Escolas recebem reforço'],
    negativa: ['Educação preocupa especialistas', 'Aprendizado cai'],
    neutra:   ['Educação em pauta', 'Debate sobre qualidade avança'],
    critica:  ['Professores cobram valorização', 'Críticas ao ensino crescem'],
    alarmante:['Crise na educação se aprofunda', 'Alerta educacional é emitido'],
  },
  infraestrutura: {
    positiva: ['Obras avançam em ritmo', 'Saneamento melhora em regiões'],
    negativa: ['Infraestrutura deficiente preocupa', 'Obras atrasam'],
    neutra:   ['Infraestrutura em debate', 'Projetos em discussão'],
    critica:  ['População cobra investimentos', 'Críticas à gestão urbana crescem'],
    alarmante:['Colapso na infraestrutura', 'Falta de água e esgoto preocupa'],
  },
  meioAmbiente: {
    positiva: ['Meio ambiente avança em metas', 'Desmatamento reduz'],
    negativa: ['Ambientalistas alertam', 'Indicadores ambientais pioram'],
    neutra:   ['Meio ambiente em pauta', 'Debate climático em alta'],
    critica:  ['Críticas à política ambiental', 'ONGs cobram ação'],
    alarmante:['Emergência ambiental declarada', 'Risco climático se agrava'],
  },
};

const BODIES: Record<NewsTone, string[]> = {
  positiva: [
    'Segundo dados do último levantamento, o governo conseguiu avanços importantes em {area}. Analistas apontam que a tendência pode continuar se o cenário se mantiver.',
    'A melhora em {area} vem chamando atenção. Setores produtivos e a população percebem a diferença, o que pode refletir na avaliação do governo.',
  ],
  negativa: [
    'O desempenho em {area} preocupa. Especialistas apontam que, sem ajustes, a situação pode se deteriorar nos próximos meses.',
    'Os números mais recentes de {area} mostram piora. A população já sente os efeitos no dia a dia.',
  ],
  neutra: [
    'O cenário de {area} segue em observação. Analistas aguardam os próximos dados para avaliar tendências.',
    'Em {area}, o governo mantém sua agenda. O debate deve ganhar força nas próximas semanas.',
  ],
  critica: [
    'A condução do governo em {area} é alvo de críticas. Oposição e especialistas cobram mudanças de rota.',
    'Questionamentos sobre {area} ganham força. A pressão sobre o governo deve aumentar.',
  ],
  alarmante: [
    'A situação em {area} é crítica. Especialistas alertam para riscos estruturais se nada for feito.',
    'Alerta máximo em {area}. A população e os mercados acompanham com preocupação.',
  ],
};

/** Detecta variação por indicador e decide se vira notícia */
function detectChanges(ctx: TemplateContext): Array<{
  indicatorId: IndicatorId;
  delta: number;
  pctDelta: number;
}> {
  const changes: Array<{ indicatorId: IndicatorId; delta: number; pctDelta: number }> = [];
  const current = ctx.state.indicators;

  for (const id of Object.keys(current) as IndicatorId[]) {
    const prev = ctx.previousIndicators[id];
    if (prev == null) continue;
    const delta = current[id] - prev;
    const def = INDICATORS[id];
    const range = def.max - def.min || 1;
    const pctDelta = delta / range;
    if (Math.abs(pctDelta) < 0.005) continue;   // <0.5% da faixa: ignora
    changes.push({ indicatorId: id, delta, pctDelta });
  }

  return changes;
}

/** Classifica um indicador como melhora/piora segundo `direction` */
function isImprovement(id: IndicatorId, delta: number): boolean {
  const dir = INDICATORS[id].direction;
  if (dir === 0) return false;
  return dir === 1 ? delta > 0 : delta < 0;
}

function toneFromDelta(id: IndicatorId, delta: number, pctDelta: number): NewsTone {
  const abs = Math.abs(pctDelta);
  const improved = isImprovement(id, delta);
  if (abs > 0.05) return improved ? 'positiva' : 'alarmante';
  if (abs > 0.02) return improved ? 'positiva' : 'critica';
  if (abs > 0.005) return improved ? 'positiva' : 'negativa';
  return 'neutra';
}

function fillBody(template: string, area: string): string {
  return template.replace('{area}', area);
}

/**
 * Gera notícias a partir de mudanças reais dos indicadores e políticas ativas.
 */
export function generateNews(ctx: TemplateContext, count = 6): NewsItem[] {
  const news: NewsItem[] = [];
  const changes = detectChanges(ctx);
  const rng = ctx.rng;

  // 1. Notícia por política ativada neste turno
  if (ctx.policy && ctx.policy.status === 'active' && ctx.policy.activatedAtTurn === ctx.state.turn) {
    const area = mapAreaToCategory(ctx.policy.area);
    news.push({
      id: `policy_${ctx.policy.id}_${ctx.state.turn}`,
      turn: ctx.state.turn,
      category: area,
      tone: 'neutra',
      title: `Governo lança: ${ctx.policy.name}`,
      body: ctx.policy.description,
      source: pick(SOURCES[area], rng),
      imageSeed: area,
      relatedIndicators: ctx.policy.indicatorEffects.map(e => e.indicatorId),
      relatedPolicyId: ctx.policy.id,
    });
  }

  // 2. Notícias por indicadores que mais mudaram
  const ranked = [...changes].sort((a, b) => Math.abs(b.pctDelta) - Math.abs(a.pctDelta));
  const top = ranked.slice(0, count);

  for (const { indicatorId, delta, pctDelta } of top) {
    const def = INDICATORS[indicatorId];
    const category = INDICATOR_CATEGORY[indicatorId] ?? 'politica';
    const tone = toneFromDelta(indicatorId, delta, pctDelta);
    const headline = pick(HEADLINES[category][tone], rng);
    const body = fillBody(pick(BODIES[tone], rng), def.name.toLowerCase());

    news.push({
      id: `ind_${indicatorId}_${ctx.state.turn}`,
      turn: ctx.state.turn,
      category,
      tone,
      title: headline,
      body: `${body} (${def.name}: ${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${def.unit})`,
      source: pick(SOURCES[category], rng),
      imageSeed: category,
      relatedIndicators: [indicatorId],
    });
  }

  // 3. Se não houve mudança relevante, gera 1 notícia neutra de contexto
  if (news.length === 0) {
    const category: NewsCategory = 'politica';
    const tone: NewsTone = 'neutra';
    news.push({
      id: `ctx_${ctx.state.turn}`,
      turn: ctx.state.turn,
      category,
      tone,
      title: pick(HEADLINES[category][tone], rng),
      body: 'O governo segue sua agenda enquanto analistas observam os próximos movimentos.',
      source: pick(SOURCES[category], rng),
      imageSeed: category,
      relatedIndicators: [],
    });
  }

  return news.slice(0, count);
}

function mapAreaToCategory(area: string): NewsCategory {
  switch (area) {
    case 'economia':       return 'economia';
    case 'saude':          return 'saude';
    case 'educacao':       return 'educacao';
    case 'seguranca':      return 'seguranca';
    case 'infraestrutura': return 'infraestrutura';
    case 'social':         return 'social';
    case 'meioAmbiente':   return 'meioAmbiente';
    default:               return 'politica';
  }
}