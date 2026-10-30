// src/game/data/newsArticles.ts

import type { NewsTheme } from './newsThemes';

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
    // === SARCÁSTICAS (para rir da desgraça alheia) ===
  {
    id: 'econ_005',
    veiculo: 'jornal_economico',
    tema: 'economy',
    manchete: 'Governo lança pacote de 47 medidas para resolver crise econômica',
    submanchete: 'Analistas aguardam o pacote de 48 medidas prometido para o mês que vem',
    corpo: 'O Ministério da Economia anunciou nesta quinta-feira um pacote com 47 medidas emergenciais para estimular o crescimento, gerar empregos e controlar a inflação. O anúncio foi feito em cerimônia de duas horas, com direito a vídeo institucional e plateia aplaudindo em pé.\n\nEspecialistas consultados apontam que 43 das medidas já haviam sido anunciadas em 2023, 2024 e 2025, mas "com nomes diferentes". O governo garante que agora "é diferente" e que o novo pacote será acompanhado de perto por um comitê que será criado para monitorar o comitê anterior.',
    tom: 'neutro',
    imagemTema: 'economy',
  },
  {
    id: 'econ_006',
    veiculo: 'gazeta_brasil',
    tema: 'economy',
    manchete: 'Dólar dispara, mas ministro garante: "é só uma flutuação passageira"',
    submanchete: 'Moeda sobe 12% no mês; governo estuda criar "grupo de trabalho" para entender por quê',
    corpo: 'O dólar fechou o dia em alta de mais 3%, acumulando valorização de 12% no mês. Em entrevista coletiva, o ministro da Economia classificou a movimentação como "flutuação passageira" e garantiu que "não há motivo para pânico".\n\nPerguntado sobre os motivos da alta, o ministro afirmou que o governo está "monitorando a situação com serenidade" e estuda a criação de um grupo de trabalho para "entender melhor o cenário internacional". Enquanto isso, importadores e consumidores seguem reajustando preços e orçamentos.',
    tom: 'negativo',
    imagemTema: 'economy',
  },
  {
    id: 'pol_003',
    veiculo: 'correio_nacional',
    tema: 'politics',
    manchete: 'Congresso cria CPI para investigar a CPI que investigava a CPI anterior',
    submanchete: 'Nova comissão terá 90 dias para apurar por que as outras não deram em nada',
    corpo: 'O Congresso Nacional aprovou nesta terça-feira a criação de uma nova Comissão Parlamentar de Inquérito para investigar o funcionamento da CPI que investigava a CPI instaurada em 2024. A nova comissão terá 90 dias para apresentar relatório sobre por que as anteriores não produziram resultados concretos.\n\nO relator da nova CPI já adiantou que pretende convocar os ex-relatores das comissões anteriores para "esclarecer o que deu errado". Parlamentares da base e da oposição comemoraram o acordo, que segundo eles "demonstra maturidade institucional" e "vontade política de investigar".',
    tom: 'neutro',
    imagemTema: 'politics',
  },
  {
    id: 'pol_004',
    veiculo: 'voz_popular',
    tema: 'politics',
    manchete: 'Ministro promete combater corrupção em discurso de 2h custeado por emenda secreta',
    submanchete: 'Evento teve buffet, palco importado e panfletos com o slogan "Transparência Já"',
    corpo: 'Em evento realizado em hotel de luxo da capital, o ministro da Transparência e Controle prometeu "tolerância zero com a corrupção" durante discurso de duas horas. O encontro, segundo a assessoria, foi custeado por uma emenda parlamentar de origem não revelada.\n\nO evento contou com buffet de R$ 480 por pessoa, palco importado e panfletos com o slogan "Transparência Já". Perguntado sobre a origem dos recursos, o ministro respondeu que "os detalhes serão divulgados em tempo oportuno" e que a prioridade é "o combate firme à corrupção".',
    tom: 'negativo',
    imagemTema: 'politics',
  },
  {
    id: 'health_003',
    veiculo: 'diario_cidadao',
    tema: 'health',
    manchete: 'SUS lança aplicativo para agendar consultas que não existem',
    submanchete: 'Novo app promete "modernizar o atendimento" enquanto fila de espera chega a 2 anos',
    corpo: 'O Ministério da Saúde lançou nesta semana um aplicativo que promete modernizar o agendamento de consultas no SUS. A ferramenta permite que o cidadão solicite atendimento pelo celular e acompanhe o status do pedido em tempo real.\n\nA inovação, no entanto, esbarra em um detalhe: não há médicos suficientes para atender a demanda. Usuários relatam que o app é rápido para agendar, mas a consulta aparece com prazo estimado de até dois anos. O ministério celebrou o "avanço digital" e prometeu um novo app para "gerenciar a ansiedade dos pacientes".',
    tom: 'negativo',
    imagemTema: 'health',
  },
  {
    id: 'edu_003',
    veiculo: 'correio_nacional',
    tema: 'education',
    manchete: 'Governo anuncia "revolução na educação" com cartilha de 4 páginas',
    submanchete: 'Material será distribuído em escolas e promete "transformar o aprendizado no Brasil"',
    corpo: 'O Ministério da Educação apresentou nesta quarta-feira o programa "Revolução na Educação", que consiste em uma cartilha de quatro páginas com dicas de estudo e um vídeo de trinta segundos para redes sociais. O investimento total foi de R$ 12 milhões.\n\nSegundo o ministro, a iniciativa vai "transformar o aprendizado no Brasil" e "colocar o país no topo dos rankings internacionais". Professores ouvidos pela reportagem apontam que faltam salas de aula, merenda e material didático básico em várias regiões do país, mas o ministério garantiu que a cartilha será "impressa em papel de alta qualidade".',
    tom: 'negativo',
    imagemTema: 'education',
  },
  {
    id: 'sec_003',
    veiculo: 'gazeta_brasil',
    tema: 'security',
    manchete: 'Secretário promete "tolerância zero" com criminalidade pela 12ª vez',
    submanchete: 'Anúncio foi feito após onda de assaltos; pasta não apresenta números de efetivo',
    corpo: 'Em coletiva de imprensa realizada nesta segunda-feira, o secretário de Segurança Pública anunciou mais uma vez a política de "tolerância zero" com a criminalidade. É a 12ª vez que o anúncio é feito desde o início do ano.\n\nPerguntado sobre o efetivo policial e os investimentos, o secretário afirmou que "os números serão divulgados no momento adequado" e que a prioridade é "o planejamento estratégico". Moradores das áreas mais afetadas relatam que a sensação de insegurança continua igual — mas agora com mais anúncios.',
    tom: 'negativo',
    imagemTema: 'security',
  },
  {
    id: 'soc_003',
    veiculo: 'voz_popular',
    tema: 'social',
    manchete: 'Programa social é rebatizado e "economiza" R$ 3 bi em publicidade',
    submanchete: 'Governo diz que mudança de nome "moderniza" o benefício e "facilita a comunicação"',
    corpo: 'O governo anunciou nesta quinta-feira o novo nome do principal programa de transferência de renda do país. A mudança, segundo o ministério, vai "modernizar a comunicação" e "aproximar o benefício da população". O custo da campanha publicitária de lançamento foi de R$ 3 bilhões.\n\nBeneficiários ouvidos pela reportagem afirmam que o valor recebido continua o mesmo. O governo explica que a "economia" está no fato de que o novo nome "é mais fácil de pronunciar" e que o investimento em marketing "se paga com a visibilidade". Entidades sociais pedem que os recursos sejam usados para ampliar o número de famílias atendidas.',
    tom: 'negativo',
    imagemTema: 'social',
  },
  {
    id: 'inf_003',
    veiculo: 'jornal_economico',
    tema: 'infrastructure',
    manchete: 'Obra é inaugurada três vezes para "render mais entregas ao governo"',
    submanchete: 'Mesma rodovia recebeu placas com nomes diferentes em cada cerimônia',
    corpo: 'A mesma rodovia foi inaugurada três vezes em menos de dois meses, sempre com solenidade oficial, corte de fita e discurso de autoridades. Em cada evento, a obra recebeu um nome diferente e foi apresentada como "entrega histórica" para a população.\n\nQuestionado, o governo afirmou que se trata de "etapas distintas do mesmo empreendimento" e que a divulgação é "transparente". Especialistas em comunicação avaliam que a estratégia "otimiza o alcance das entregas" e "maximiza o retorno político do investimento público".',
    tom: 'neutro',
    imagemTema: 'infrastructure',
  },
  {
    id: 'env_003',
    veiculo: 'observador_progressista',
    tema: 'environment',
    manchete: 'Governo descobre que árvores ajudam contra o calor e cria grupo de trabalho',
    submanchete: 'Estudo de R$ 8 milhões confirma o que a ciência já dizia há décadas',
    corpo: 'Após investimento de R$ 8 milhões em pesquisa, o governo federal concluiu que áreas arborizadas registram temperaturas menores do que regiões sem vegetação. O resultado foi apresentado em coletiva com direito a gráficos e projeções em 3D.\n\nCom base no estudo, o governo anunciou a criação de um grupo de trabalho para "elaborar diretrizes de arborização urbana" e um novo comitê para "acompanhar o grupo de trabalho". Ambientalistas lamentam que o valor gasto na pesquisa poderia ter sido usado para plantar árvores — mas reconhecem que o grupo de trabalho "deve produzir relatórios interessantes".',
    tom: 'neutro',
    imagemTema: 'environment',
  },
];

export const ARTICLE_BY_ID = Object.fromEntries(
  NEWS_ARTICLES.map((a) => [a.id, a]),
) as Record<string, NewsArticle>;
