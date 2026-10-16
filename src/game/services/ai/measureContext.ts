import type { GameState, SliderId, GroupId } from '../../types/game';
import { SLIDERS } from '../../data/sliders';
import { GROUPS } from '../../data/groups';

/**
 * Monta o contexto que vai no prompt do Ollama.
 * Só o essencial: estado atual + definições que a IA pode referenciar.
 */
const SLIDER_TERMS: Record<SliderId, string[]> = {
  impostos: ['imposto', 'tribut', 'irpf', 'irpj', 'icms', 'iss', 'cbs', 'ibs', 'arrecad'],
  salarioMinimo: ['salario minimo', 'salario-mínimo', 'piso salarial'],
  selic: ['selic', 'juros', 'taxa basica'],
  tarifasImportacao: ['tarifa de importacao', 'tarifas de importacao', 'importacao'],
  gastosPublicos: ['gastos publicos', 'despesa publica', 'limite de gastos', 'corte de gastos', 'orcamento total'],
  investimentosPublicos: ['investimento publico', 'infraestrutura', 'saneamento', 'estrada', 'moradia', 'obras publicas'],
  beneficiosSociais: ['beneficio social', 'transferencia de renda', 'bolsa familia', 'assistencia social'],
  policiamento: ['policiamento', 'policia', 'policial', 'seguranca publica'],
  sistemaPrisional: ['prisional', 'presidio', 'sistema prisional'],
  saude: ['saude', 'sus', 'hospital', 'medico', 'leito', 'vacina'],
  educacao: ['educacao', 'escola', 'professor', 'creche', 'alfabetizacao'],
  servidores: ['servidor publico', 'servidores publicos', 'quadro de servidores'],
  salariosServidores: ['salario dos servidores', 'folha salarial', 'remuneracao dos servidores'],
  privatizacao: ['privatizacao', 'empresa estatal', 'estatais'],
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function buildMeasureContext(state: GameState, proposalText: string): string {
  const query = normalize(proposalText);
  const relevantSliders = (Object.keys(SLIDERS) as SliderId[])
    .filter(id => SLIDER_TERMS[id].some(term => query.includes(normalize(term))));
  const sliders = relevantSliders
    .map(id => {
      const def = SLIDERS[id];
      const value = state.sliders[id];
      return `- ${id} (${def.name}, ${def.unit}, faixa ${def.min}–${def.max}): valor atual ${value}`;
    })
    .join('\n');

  const groups = (Object.keys(GROUPS) as GroupId[])
    .map(id => {
      const g = GROUPS[id];
      const support = state.groups[id].support.toFixed(1);
      return `- ${id} (${g.name}): apoio atual ${support}`;
    })
    .join('\n');

  return [
    `TURNO ATUAL: ${state.turn} (mês)`,
    '',
    'SLIDERS CONTROLADOS PELO JOGADOR RELEVANTES PARA ESTA PROPOSTA:',
    sliders || '(nenhum controle existente identificado; use parâmetros próprios somente se necessários)',
    '',
    'GRUPOS SOCIAIS:',
    groups,
  ].join('\n');
}
