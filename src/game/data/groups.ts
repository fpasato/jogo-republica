import type { Group, GroupId } from '../types/game';

export const GROUPS: Record<GroupId, Group> = {
  empresarios: {
    id: 'empresarios',
    name: 'Empresários',
    baseSupport: 50,
    influence: 0.10,
    sliderSensitivity: {
      impostos: -0.9, salarioMinimo: -0.6, selic: -0.7,
      tarifasImportacao: -0.5, investimentosPublicos: 0.4,
      privatizacao: 0.8,
    },
    indicatorSensitivity: {
      crescimentoPib: 0.9, desemprego: -0.7, inflacao: -0.5,
      dividaPublica: -0.4,
    },
  },
  trabalhadores: {
    id: 'trabalhadores',
    name: 'Trabalhadores e sindicalistas',
    baseSupport: 50,
    influence: 0.14,
    sliderSensitivity: {
      salarioMinimo: 0.9, impostos: -0.4, beneficiosSociais: 0.7,
    },
    indicatorSensitivity: {
      desemprego: -0.8, inflacao: -0.6, poderCompra: 0.9,
      acessoSaude: 0.4, acessoEducacao: 0.4,
    },
  },
  mercadoFinanceiro: {
    id: 'mercadoFinanceiro',
    name: 'Mercado financeiro',
    baseSupport: 50,
    influence: 0.07,
    sliderSensitivity: {
      selic: 0.3, gastosPublicos: -0.7, privatizacao: 0.7,
    },
    indicatorSensitivity: {
      inflacao: -0.9, dividaPublica: -0.7, receitaPublica: 0.5,
      saldoOrcamentario: 0.8, crescimentoPib: 0.6, dolar: 0.4,
    },
  },
  conservadores: {
    id: 'conservadores',
    name: 'Conservadores e religiosos',
    baseSupport: 50,
    influence: 0.10,
    sliderSensitivity: {
      gastosPublicos: -0.5, beneficiosSociais: -0.4,
    },
    indicatorSensitivity: {
      criminalidade: -0.9, acessoEducacao: 0.4, qualidadeEducacao: 0.3,
      aprovacao: 0.5,
    },
  },
  progressistas: {
    id: 'progressistas',
    name: 'Progressistas',
    baseSupport: 50,
    influence: 0.09,
    sliderSensitivity: {
      beneficiosSociais: 0.8, salarioMinimo: 0.6,
      saude: 0.5, educacao: 0.5,
    },
    indicatorSensitivity: {
      criminalidade: -0.5, acessoSaude: 0.6, qualidadeSaude: 0.5,
      acessoEducacao: 0.5, qualidadeEducacao: 0.5, gini: -0.6,
    },
  },
  socialistas: {
    id: 'socialistas',
    name: 'Socialistas e comunistas',
    baseSupport: 50,
    influence: 0.06,
    sliderSensitivity: {
      impostos: 0.5, salarioMinimo: 0.9, beneficiosSociais: 0.9,
      gastosPublicos: 0.7, investimentosPublicos: 0.7, privatizacao: -0.9,
    },
    indicatorSensitivity: {
      poderCompra: 0.8, desemprego: -0.8, gini: -0.9,
    },
  },
  servidoresPublicos: {
    id: 'servidoresPublicos',
    name: 'Servidores públicos',
    baseSupport: 50,
    influence: 0.08,
    sliderSensitivity: {
      salariosServidores: 0.9, servidores: 0.7,
      gastosPublicos: 0.5, saude: 0.4, educacao: 0.4,
    },
    indicatorSensitivity: {
      aprovacao: 0.3,
    },
  },
  agronegocio: {
    id: 'agronegocio',
    name: 'Agronegócio e produtores rurais',
    baseSupport: 50,
    influence: 0.07,
    sliderSensitivity: {
      impostos: -0.7, selic: -0.7, tarifasImportacao: -0.6,
      investimentosPublicos: 0.4,
    },
    indicatorSensitivity: {
      dolar: 0.8, crescimentoPib: 0.6, inflacao: -0.4,
    },
  },
  segurancaMilitar: {
    id: 'segurancaMilitar',
    name: 'Segurança pública e militares',
    baseSupport: 50,
    influence: 0.08,
    sliderSensitivity: {
      policiamento: 0.9, sistemaPrisional: 0.7,
      salariosServidores: 0.5, gastosPublicos: 0.4,
    },
    indicatorSensitivity: {
      criminalidade: -0.9, aprovacao: 0.3,
    },
  },
  populacaoGeral: {
    id: 'populacaoGeral',
    name: 'População em geral',
    baseSupport: 50,
    influence: 0.15,
    sliderSensitivity: {
      impostos: -0.3, salarioMinimo: 0.4, beneficiosSociais: 0.5,
      saude: 0.5, educacao: 0.5, policiamento: 0.4,
    },
    indicatorSensitivity: {
      inflacao: -0.8, desemprego: -0.8, crescimentoPib: 0.6,
      poderCompra: 0.8, criminalidade: -0.7, acessoSaude: 0.5,
      qualidadeSaude: 0.5, acessoEducacao: 0.4, qualidadeEducacao: 0.4,
      aprovacao: 0.6,
    },
  },
  beneficiarios: {
    id: 'beneficiarios',
    name: 'Beneficiários de programas sociais',
    baseSupport: 50,
    influence: 0.06,
    sliderSensitivity: {
      beneficiosSociais: 0.95, salarioMinimo: 0.5,
    },
    indicatorSensitivity: {
      inflacao: -0.7, poderCompra: 0.9,
      acessoSaude: 0.5, acessoEducacao: 0.4,
    },
  },
  aposentados: {
    id: 'aposentados',
    name: 'Aposentados e pensionistas',
    baseSupport: 50,
    influence: 0.10,
    sliderSensitivity: {
      salarioMinimo: 0.9, beneficiosSociais: 0.6,
    },
    indicatorSensitivity: {
      inflacao: -0.9, poderCompra: 0.9, acessoSaude: 0.6,
      qualidadeSaude: 0.5,
    },
  },
};

export const GROUP_IDS = Object.keys(GROUPS) as GroupId[];