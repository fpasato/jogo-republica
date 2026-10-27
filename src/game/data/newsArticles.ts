// src/game/data/newsArticles.ts

import type { NewsTheme } from './newsThemes';
import { NEWS_VEHICLES } from './newsVehicles';

// ============================================================
// ARTIGOS DE NOTÍCIA PRÉ-DEFINIDOS
// ============================================================

export interface NewsArticle {
  id: string;
  /** Veículo de imprensa que publica a matéria */
  veiculo: string;
  /** Tema da notícia (economy, security, health, etc.) */
  tema: NewsTheme;
  /** Manchete principal (até 90 caracteres) */
  manchete: string;
  /** Submanchete (até 140 caracteres) */
  submanchete: string;
  /** Corpo da notícia (2-3 parágrafos separados por \n\n) */
  corpo: string;
  /** Tom da notícia */
  tom: 'positivo' | 'neutro' | 'negativo';
  /** Pasta de imagens para associar (será usado pelo imagePicker) */
  imagemTema: NewsTheme;
  /** Condições para exibir esta notícia (opcional) */
  condicoes?: {
    /** Indicadores que devem estar altos/baixos */
    indicadores?: Array<{
      id: string;
      threshold: number;
      operator: 'greater' | 'less';
    }>;
    /** Mínimo de aprovação nacional */
    aprovacaoMin?: number;
    /** Máximo de aprovação nacional */
    aprovacaoMax?: number;
  };
}

export const NEWS_ARTICLES: NewsArticle[] = [
  // === ECONOMIA ===
  {
    id: 'econ_001',
    veiculo: 'jornal_economico',
    tema: 'economy',
    manchete: 'PIB cresce 2,3% no terceiro trimestre',
    submanchete: 'Economia mostra sinais de recuperação após período de estagnação',
    corpo: 'O Produto Interno Bruto brasileiro cresceu 2,3% no terceiro trimestre deste ano, superando as expectativas dos analistas de mercado.\n\nO impulso veio principalmente do setor de serviços e da indústria de transformação, que responderam por 70% do crescimento. O governo celebrou o resultado como evidência de que as políticas econômicas estão surtindo efeito.',
    tom: 'positivo',
    imagemTema: 'economy',
    condicoes: {
      indicadores: [{ id: 'growth', threshold: 2, operator: 'greater' }],
    },
  },
  {
    id: 'econ_002',
    veiculo: 'jornal_economico',
    tema: 'economy',
    manchete: 'Inflação fecha o mês em 4,5%',
    submanchete: 'Índice preocupa economistas e pode pressionar o Banco Central',
    corpo: 'A inflação acumulada nos últimos 12 meses fechou em 4,5%, acima da meta estipulada pelo Banco Central. O aumento foi puxado principalmente pelos alimentos e energia.\n\nEconomistas alertam que o cenário pode levar a um aumento na taxa Selic nas próximas reuniões do Comitê de Política Monetária. O governo afirma que medidas de controle de preços já estão sendo implementadas.',
    tom: 'negativo',
    imagemTema: 'economy',
    condicoes: {
      indicadores: [{ id: 'inflation', threshold: 4, operator: 'greater' }],
    },
  },
  {
    id: 'econ_003',
    veiculo: 'voz_popular',
    tema: 'economy',
    manchete: 'Desemprego cai para 7,8%',
    submanchete: 'Trabalhadores comemoram geração de vagas no comércio e serviços',
    corpo: 'A taxa de desemprego no Brasil caiu para 7,8%, o menor nível dos últimos três anos. O setor de comércio e serviços foi o principal responsável pela geração de novas vagas.\n\nNas ruas, trabalhadores celebram a oportunidade de retorno ao mercado de trabalho. Sindicatos, porém, ressaltam que ainda há milhões de brasileiros fora da força de trabalho ou na informalidade.',
    tom: 'positivo',
    imagemTema: 'economy',
    condicoes: {
      indicadores: [{ id: 'unemployment', threshold: 8, operator: 'less' }],
    },
  },
  {
    id: 'econ_004',
    veiculo: 'gazeta_brasil',
    tema: 'economy',
    manchete: 'Dólar ultrapassa R$ 5,50',
    submanchete: 'Moeda americana atinge maior valor do ano, impactando importações',
    corpo: 'O dólar comercial ultrapassou a marca de R$ 5,50 nesta terça-feira, o maior valor registrado em 2026. A alta é atribuída à instabilidade nos mercados internacionais e à preocupação com as contas públicas.\n\nO valor impacta diretamente o preço de produtos importados e pode pressionar a inflação nos próximos meses. O governo afirma que está monitorando a situação e tomará medidas se necessário.',
    tom: 'negativo',
    imagemTema: 'economy',
    condicoes: {
      indicadores: [{ id: 'dollar', threshold: 5.3, operator: 'greater' }],
    },
  },

  // === SEGURANÇA ===
  {
    id: 'sec_001',
    veiculo: 'gazeta_brasil',
    tema: 'security',
    manchete: 'Criminalidade recua em São Paulo',
    submanchete: 'Índices de homicídios caem 15% no estado',
    corpo: 'Os índices de criminalidade em São Paulo registraram queda de 15% no último trimestre, com redução significativa nos casos de homicídio e roubo. A secretaria de segurança atribui o resultado ao aumento das rondas policiais e à integração entre forças de segurança.\n\nEspecialistas em segurança pública elogiam a iniciativa, mas ressaltam que é necessário manter o investimento para sustentar os resultados a longo prazo.',
    tom: 'positivo',
    imagemTema: 'security',
    condicoes: {
      indicadores: [{ id: 'criminality', threshold: 25, operator: 'less' }],
    },
  },
  {
    id: 'sec_002',
    veiculo: 'correio_nacional',
    tema: 'security',
    manchete: 'Ondas de assaltos preocupam moradores',
    submanchete: 'Regiões metropolitanas registram aumento de crimes patrimoniais',
    corpo: 'As regiões metropolitanas das principais capitais do país registraram aumento de 20% nos casos de assalto e roubo nos últimos meses. Moradores relatam insegurança e pedem mais policiamento.\n\nAs autoridades de segurança pública reconhecem o problema e anunciam reforço nas rondas e investimento em tecnologia de monitoramento. O governo federal promete apoio aos estados com recursos e equipamentos.',
    tom: 'negativo',
    imagemTema: 'security',
    condicoes: {
      indicadores: [{ id: 'criminality', threshold: 30, operator: 'greater' }],
    },
  },

  // === SAÚDE ===
  {
    id: 'health_001',
    veiculo: 'diario_cidadao',
    tema: 'health',
    manchete: 'Novo hospital é inaugurado no Nordeste',
    submanchete: 'Unidade vai atender mais de 200 mil pessoas da região',
    corpo: 'O governo inaugurou nesta semana um novo hospital de alta complexidade no interior do Nordeste. A unidade, que contou com investimento federal de R$ 150 milhões, vai atender mais de 200 mil pessoas da região.\n\nA estrutura conta com 150 leitos, UTI completa e centro cirúrgico moderno. Moradores comemoram a chegada do serviço, que antes exigia deslocamento de centenas de quilômetros para atendimento especializado.',
    tom: 'positivo',
    imagemTema: 'health',
  },
  {
    id: 'health_002',
    veiculo: 'correio_nacional',
    tema: 'health',
    manchete: 'SUS enfrenta falta de medicamentos',
    submanchete: 'Falta de insumos atinge estados de todas as regiões',
    corpo: 'O Sistema Único de Saúde (SUS) enfrenta crise de abastecimento de medicamentos básicos em estados de todas as regiões do país. Hospitais públicos relatam dificuldades para adquirir antibiódicos, analgésicos e outros insumos essenciais.\n\nO Ministério da Saúde atribui o problema a atrasos em licitações e ao aumento internacional no preço de fármacos. O governo afirma que está tomando medidas emergenciais para regularizar o fornecimento.',
    tom: 'negativo',
    imagemTema: 'health',
  },

  // === EDUCAÇÃO ===
  {
    id: 'edu_001',
    veiculo: 'diario_cidadao',
    tema: 'education',
    manchete: 'Escolas técnicas recebem novo investimento',
    submanchete: 'Governo anuncia R$ 500 milhões para profissionalizantes',
    corpo: 'O governo federal anunciou investimento de R$ 500 milhões para modernizar e expandir as escolas técnicas de todo o país. O recurso será aplicado em laboratórios, equipamentos e contratação de professores especializados.\n\nA medida visa ampliar o acesso à formação profissional e reduzir o déficit de mão de obra qualificada em setores como indústria, tecnologia e agropecuária. Sindicatos e entidades educacionais elogiaram a iniciativa.',
    tom: 'positivo',
    imagemTema: 'education',
  },
  {
    id: 'edu_002',
    veiculo: 'correio_nacional',
    tema: 'education',
    manchete: 'Atraso em pagamentos de professores',
    submanchete: 'Redes estaduais enfrentam dificuldades financeiras',
    corpo: 'Redes estaduais de ensino de pelo menos cinco estados enfrentam atrasos no pagamento de salários de professores e funcionários. A situação gera protestos e ameaça de greve em várias capitais.\n\nGovernadores atribuem o problema à queda na arrecadação e ao aumento de despesas obrigatórias. O Ministério da Educação afirma que está em contato com os estados para buscar soluções e garantir o funcionamento das aulas.',
    tom: 'negativo',
    imagemTema: 'education',
  },

  // === POLÍTICA ===
  {
    id: 'pol_001',
    veiculo: 'correio_nacional',
    tema: 'politics',
    manchete: 'Congresso aprova reforma tributária',
    submanchete: 'Mudança no sistema de impostos é considerada histórica',
    corpo: 'O Congresso Nacional aprovou a reforma tributária que simplifica o sistema de impostos no Brasil. A nova unificação dos tributos deve entrar em vigor gradualmente nos próximos quatro anos.\n\nEspecialistas consideram a medida um marco histórico para a modernização do sistema brasileiro, embora ressaltem que os impactos práticos dependerão da regulamentação detalhada de cada aspecto da reforma. O governo comemorou a aprovação como vitória da governança.',
    tom: 'positivo',
    imagemTema: 'politics',
  },
  {
    id: 'pol_002',
    veiculo: 'gazeta_brasil',
    tema: 'politics',
    manchete: 'Escândalo envolve ministros',
    submanchete: 'Denúncias de corrupção abalam credibilidade do governo',
    corpo: 'Denúncias de corrupção envolvendo três ministros do governo abalaram a credibilidade da administração. As acusações incluem superfaturamento de contratos e tráfico de influência.\n\nA oposição pediu abertura de inquéritos e afastamento dos acusados. O governo afirma que vai colaborar com as investigações e que qualquer envolvido será punido se comprovada a irregularidade. O caso gerou protestos em várias capitais.',
    tom: 'negativo',
    imagemTema: 'politics',
    condicoes: {
      indicadores: [{ id: 'scandalExposure', threshold: 50, operator: 'greater' }],
    },
  },

  // === MEIO AMBIENTE ===
  {
    id: 'env_001',
    veiculo: 'observador_progressista',
    tema: 'environment',
    manchete: 'Desmatamento na Amazônia recua',
    submanchete: 'Índices de 2026 são os menores da década',
    corpo: 'O desmatamento na Amazônia Legal registrou queda de 30% em relação ao ano anterior, atingindo o menor índice da última década. O resultado é atribuído ao aumento da fiscalização e à criação de novas áreas protegidas.\n\nOrganizações ambientais celebram o avanço, mas ressaltam que ainda é necessário manter a pressão para garantir a tendência de queda. O governo afirmou que a proteção da floresta é prioridade de sua agenda ambiental.',
    tom: 'positivo',
    imagemTema: 'environment',
  },
  {
    id: 'env_002',
    veiculo: 'correio_nacional',
    tema: 'environment',
    manchete: 'Vazamento de óleo atinge litoral',
    submanchete: 'Manchas são detectadas em praias do Nordeste',
    corpo: 'Vazamento de óleo atingiu praias de vários estados do Nordeste, gerando preocupação com o impacto ambiental e econômico. As autoridades ainda não identificaram a origem do material, que já causou mortes de animais marinhos.\n\nAgências ambientais estão em campo para conter a propagação e iniciar a limpeza. O governo decretou estado de emergência nos municípios afetados e promete investigação rigorosa para responsabilizar os responsáveis.',
    tom: 'negativo',
    imagemTema: 'environment',
  },

  // === SOCIAL ===
  {
    id: 'soc_001',
    veiculo: 'diario_cidadao',
    tema: 'social',
    manchete: 'Programa social amplia benefícios',
    submanchete: 'Mais 2 milhões de famílias serão atendidas',
    corpo: 'O governo federal anunciou a ampliação do programa de transferência de renda, que passará a atender mais 2 milhões de famílias a partir do próximo mês. O aumento no orçamento foi aprovado pelo Congresso após negociação com a base aliada.\n\nEntidades sociais elogiaram a medida, que deve reduzir a pobreza extrema em regiões mais vulneráveis. O governo ressalta que o programa é essencial para garantir dignidade às famílias em situação de risco.',
    tom: 'positivo',
    imagemTema: 'social',
  },
  {
    id: 'soc_002',
    veiculo: 'voz_popular',
    tema: 'social',
    manchete: 'Moradores ocupam terrenos',
    submanchete: 'Movimento reivindica moradia em capitais',
    corpo: 'Moradores sem-teto ocuparam terrenos em várias capitais do país em protesto pela falta de moradia. Os movimentos reivindicam aceleração na entrega de unidades do programa habitacional.\n\nA prefeitura e o governo federal negociam com os grupos para evitar conflitos. As autoridades afirmam que há unidades em construção, mas reconhecem que a demanda supera a capacidade atual de entrega.',
    tom: 'negativo',
    imagemTema: 'social',
  },

  // === INFRAESTRUTURA ===
  {
    id: 'inf_001',
    veiculo: 'correio_nacional',
    tema: 'infrastructure',
    manchete: 'Nova rodovia é inaugurada',
    submanchete: 'Obra de R$ 2 bilhões conecta Norte ao Centro-Oeste',
    corpo: 'O governo inaugurou uma nova rodovia que conecta a região Norte ao Centro-Oeste, reduzindo em mais de 400 quilômetros a distância entre importantes polos econômicos. A obra custou R$ 2 bilhões e levou três anos para ser concluída.\n\nEspecialistas em logística afirmam que a via deve reduzir custos de transporte e estimular o comércio entre as regiões. O governo destacou a obra como exemplo de investimento em infraestrutura essencial para o desenvolvimento.',
    tom: 'positivo',
    imagemTema: 'infrastructure',
  },
  {
    id: 'inf_002',
    veiculo: 'jornal_economico',
    tema: 'infrastructure',
    manchete: 'Aeroportos enfrentam congestionamento',
    submanchete: 'Falta de investimentos gera atrasos em voos',
    corpo: 'Os principais aeroportos do país enfrentam congestionamento e recordes de atrasos de voos devido à falta de investimentos em infraestrutura e pessoal. A situação piorou no período de férias e feriados.\n\nA Infraero e a ANAC reconhecem o problema e anunciam planos de expansão e modernização. Especialistas alertam que o setor de turismo e negócios pode ser prejudicado se a situação não for resolvida rapidamente.',
    tom: 'negativo',
    imagemTema: 'infrastructure',
  },
];

export const ARTICLE_BY_ID = Object.fromEntries(
  NEWS_ARTICLES.map((a) => [a.id, a]),
) as Record<string, NewsArticle>;
