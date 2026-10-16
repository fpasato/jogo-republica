import type { SocialPost, TemplateContext, PostTone } from './types';
import type { GroupId } from '../../types/game';
import { pick } from './rng';

/** Nomes fictícios por grupo (5 por grupo para variar) */
const HANDLES: Record<GroupId, Array<{ name: string; handle: string }>> = {
  empresarios: [
    { name: 'Carlos Menezes', handle: '@carlos.menezes' },
    { name: 'Rede Empresarial BR', handle: '@rede_empresarial' },
    { name: 'Instituto Livre Mercado', handle: '@ilivre' },
  ],
  trabalhadores: [
    { name: 'Sindicato Unificado', handle: '@sind_unificado' },
    { name: 'Maria da Fábrica', handle: '@maria_fabrica' },
    { name: 'Central dos Trabalhadores', handle: '@ctb_oficial' },
  ],
  mercadoFinanceiro: [
    { name: 'Análise & Cia', handle: '@analise_cia' },
    { name: 'Trader Realista', handle: '@trader_real' },
    { name: 'Mesa de Renda Fixa', handle: '@mesa_rf' },
  ],
  conservadores: [
    { name: 'Família Tradicional', handle: '@familia_trad' },
    { name: 'Padre Antônio', handle: '@padre_antonio' },
    { name: 'Movimento Ordem', handle: '@ordem_br' },
  ],
  progressistas: [
    { name: 'Coletivo Mudança', handle: '@coletivo_mudanca' },
    { name: 'Ana Progressista', handle: '@ana_prog' },
    { name: 'Rede Cidadã', handle: '@rede_cidada' },
  ],
  socialistas: [
    { name: 'Coletivo Popular', handle: '@coletivo_pop' },
    { name: 'Unidade da Esquerda', handle: '@unidade_esq' },
    { name: 'Jornal dos Trabalhadores', handle: '@jt_br' },
  ],
  servidoresPublicos: [
    { name: 'Sindicato dos Servidores', handle: '@sind_serv' },
    { name: 'João do Fisco', handle: '@joao_fisco' },
    { name: 'Rede Servidor Público', handle: '@servidor_rede' },
  ],
  agronegocio: [
    { name: 'Agro Forte', handle: '@agroforte' },
    { name: 'Produtor do Cerrado', handle: '@produtor_cerrado' },
    { name: 'Rural Brasil', handle: '@rural_br' },
  ],
  segurancaMilitar: [
    { name: 'Assoc. dos Militares', handle: '@militares_br' },
    { name: 'Delegado Souza', handle: '@delegado_souza' },
    { name: 'Oficiais em Alerta', handle: '@oficiais_alerta' },
  ],
  populacaoGeral: [
    { name: 'Dona Cida', handle: '@dona_cida' },
    { name: 'José Trabalhador', handle: '@jose_trab' },
    { name: 'Voz das Ruas', handle: '@voz_ruas' },
  ],
  beneficiarios: [
    { name: 'Ana Beneficiária', handle: '@ana_benef' },
    { name: 'Mães do Programa', handle: '@maes_programa' },
    { name: 'Rede de Beneficiários', handle: '@rede_benef' },
  ],
  aposentados: [
    { name: 'Sebastião Aposentado', handle: '@sebastiao_apos' },
    { name: 'Assoc. dos Aposentados', handle: '@aposentados_br' },
    { name: 'Marta Pensionista', handle: '@marta_pens' },
  ],
};

/** Frases por grupo + tom */
const POSTS: Record<GroupId, Partial<Record<PostTone, string[]>>> = {
  empresarios: {
    apoio: [
      'Finalmente uma agenda que entende o setor produtivo. Avançamos.',
      'Sem confiança, não há investimento. Hoje o cenário é outro.',
    ],
    critica: [
      'Mais imposto? Assim não dá pra gerar emprego.',
      'Burocracia e carga tributária sufocam quem produz.',
    ],
    neutro: [
      'Vamos aguardar os próximos números antes de avaliar.',
    ],
  },
  trabalhadores: {
    apoio: [
      'Salário mínimo digno é o mínimo. A luta continua.',
      'Emprego subindo é o que a população sente no bolso.',
    ],
    critica: [
      'O trabalhador paga a conta mais uma vez.',
      'Enquanto o governo comemora, a fila do emprego cresce.',
    ],
    neutro: ['Em observação. Cobrança nunca para.'],
  },
  mercadoFinanceiro: {
    apoio: ['Responsabilidade fiscal dá retorno. Mercado responde.'],
    critica: ['Sinal trocado na política econômica. Prêmio de risco sobe.'],
    neutro: ['Monitorando os próximos dados com atenção.'],
  },
  conservadores: {
    apoio: ['Família e ordem em primeiro lugar. Apoiamos.'],
    critica: ['Valores tradicionais estão em risco. Precisamos reagir.'],
    neutro: ['Acompanhando. Sempre vigilantes.'],
  },
  progressistas: {
    apoio: ['Direitos garantidos, país mais justo. Seguimos juntos.'],
    critica: ['Retrocesso social inaceitável. Não vamos aceitar.'],
    neutro: ['Debate é o caminho. Estamos atentos.'],
  },
  socialistas: {
    apoio: ['Mais Estado, menos desigualdade. É esse o caminho.'],
    critica: ['A favor do povo? Não é o que os números mostram.'],
    neutro: ['Luta segue. Não há trégua.'],
  },
  servidoresPublicos: {
    apoio: ['Serviço público valorizado é serviço público de qualidade.'],
    critica: ['Sucateamento não se resolve com discurso.'],
    neutro: ['Aguardando o que virá. Confiamos na categoria.'],
  },
  agronegocio: {
    apoio: ['Precisamos de segurança jurídica e câmbio justo. Temos isso hoje.'],
    critica: ['Custo Brasil nos estrangula. Agro responde com dados.'],
    neutro: ['Setor firme, olho no mercado externo.'],
  },
  segurancaMilitar: {
    apoio: ['Quem investe em segurança colhe tranquilidade.'],
    critica: ['Sem apoio, não há solução para o crime.'],
    neutro: ['A situação pede atenção constante.'],
  },
  populacaoGeral: {
    apoio: ['Pelo menos algo mudou. A gente sente.'],
    critica: ['No meu bairro nada melhorou.'],
    neutro: ['Povo espera. Continua esperando.'],
  },
  beneficiarios: {
    apoio: ['Esse benefício mudou a vida da minha família.'],
    critica: ['A gente fica preocupado com corte. Não pode.'],
    neutro: ['Esperança de dias melhores.'],
  },
  aposentados: {
    apoio: ['Aposentadoria digna é respeito ao trabalhador.'],
    critica: ['Preço subindo é aposentadoria encolhendo.'],
    neutro: ['Paciência. Não é o que esperávamos.'],
  },
};

/** Frases específicas de reação a políticas aprovadas */
const POLICY_TAILS: Record<GroupId, { positive: string; negative: string }> = {
  empresarios:       { positive: 'Iniciativa na direção certa.',     negative: 'Vamos revisar investimentos.' },
  trabalhadores:     { positive: 'Vitória dos trabalhadores.',       negative: 'Não vamos aceitar retrocesso.' },
  mercadoFinanceiro: { positive: 'Sinal positivo para o mercado.',   negative: 'Risco-país aumenta.' },
  conservadores:     { positive: 'Coerente com nossos valores.',     negative: 'Contrário ao que defendemos.' },
  progressistas:     { positive: 'Avanço social importante.',        negative: 'Faltou sensibilidade social.' },
  socialistas:       { positive: 'Passo na direção certa.',          negative: 'Mais alinhado ao mercado.' },
  servidoresPublicos:{ positive: 'Categoria reconhecida.',           negative: 'Desvalorização é inaceitável.' },
  agronegocio:       { positive: 'Setor ganha previsibilidade.',     negative: 'Custo aumenta, produção sofre.' },
  segurancaMilitar:  { positive: 'Reforça quem está na ponta.',      negative: 'Recursos insuficientes.' },
  populacaoGeral:    { positive: 'A gente sente a diferença.',       negative: 'Nossa vida não mudou.' },
  beneficiarios:     { positive: 'Respira alívio.',                  negative: 'Fica o medo do corte.' },
  aposentados:       { positive: 'Reconhecimento merecido.',         negative: 'Difícil manter as contas.' },
};

function supportToTone(support: number, lastChange: number): PostTone {
  if (lastChange > 0.8) return 'apoio';
  if (lastChange < -0.8) return 'critica';
  if (support > 65) return 'apoio';
  if (support < 35) return 'critica';
  return 'neutro';
}

/**
 * Gera 3–6 posts por turno, priorizando grupos que mais mudaram e
 * criando posts específicos para a política ativada (se houver).
 */
export function generatePosts(ctx: TemplateContext, count = 5): SocialPost[] {
  const rng = ctx.rng;
  const posts: SocialPost[] = [];
  const { groups } = ctx.state;

  // Ordena grupos por magnitude da mudança
  const rankedGroups = (Object.keys(groups) as GroupId[])
    .map(id => ({ id, change: groups[id].lastChange, support: groups[id].support }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const candidates = rankedGroups.slice(0, 6);

  for (const { id, change, support } of candidates) {
    if (posts.length >= count) break;
    const identity = pick(HANDLES[id], rng);
    const tone = supportToTone(support, change);

    let text = pick(POSTS[id][tone] ?? POSTS[id].neutro ?? ['…'], rng);

    // Se há política ativada, adiciona uma cauda contextual
    if (ctx.policy && ctx.policy.status === 'active' && ctx.policy.activatedAtTurn === ctx.state.turn) {
      const reaction = ctx.policy.groupReactions.find(r => r.groupId === id);
      const tail = POLICY_TAILS[id];
      if (reaction) {
        text += ' ' + (reaction.intensity >= 0 ? tail.positive : tail.negative);
      }
    }

    posts.push({
      id: `post_${id}_${ctx.state.turn}_${posts.length}`,
      turn: ctx.state.turn,
      authorGroup: id,
      authorName: identity.name,
      handle: identity.handle,
      tone,
      text,
      likes: Math.floor(rng() * 900 + 50),
      reposts: Math.floor(rng() * 200 + 10),
      replies: Math.floor(rng() * 120 + 5),
      avatarSeed: id,
      relatedPolicyId:
        ctx.policy && ctx.policy.activatedAtTurn === ctx.state.turn ? ctx.policy.id : undefined,
    });
  }

  return posts;
}