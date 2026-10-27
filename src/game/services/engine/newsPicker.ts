// src/game/services/engine/newsPicker.ts

import { NEWS_ARTICLES, type NewsArticle } from '../../data/newsArticles';
import { pickImage } from './newsImagePicker';
import type { Noticia } from '../../types/ai';

// ============================================================
// CONTEXTO PARA ESCOLHA DE NOTÍCIA
// ============================================================

export interface NewsPickerContext {
  /** Mês atual do jogo (1-12) */
  month: number;
  /** Ano atual do jogo */
  year: number;
  /** Aprovação nacional do governo (0-100) */
  nationalApproval: number;
  /** Valores dos indicadores e macros */
  indicators: Record<string, number>;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

/**
 * Escolhe uma notícia baseada no contexto do jogo.
 * Retorna uma notícia formatada para uso no componente NewsHome.
 */
export function pickNewsArticle(ctx: NewsPickerContext): Noticia {
  // Filtra artigos que atendem às condições
  const eligible = NEWS_ARTICLES.filter((article) =>
    matchesConditions(article, ctx),
  );

  // Se não houver artigos elegíveis, usa um genérico
  const selected = eligible.length > 0
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : NEWS_ARTICLES[0];

  // Converte para o formato Noticia
  return {
    id: `news_${ctx.year}_${ctx.month}_${selected.id}`,
    veiculo: selected.veiculo,
    manchete: selected.manchete,
    submanchete: selected.submanchete,
    corpo: selected.corpo,
    tom: selected.tom,
    imagem: pickImage(selected.imagemTema),
    importancia: 2,
    destaques: [],
  };
}

// ============================================================
// VERIFICAÇÃO DE CONDIÇÕES
// ============================================================

function matchesConditions(
  article: NewsArticle,
  ctx: NewsPickerContext,
): boolean {
  const { condicoes } = article;

  // Se não tem condições, sempre elegível
  if (!condicoes) return true;

  // Verifica aprovação
  if (condicoes.aprovacaoMin !== undefined) {
    if (ctx.nationalApproval < condicoes.aprovacaoMin) return false;
  }
  if (condicoes.aprovacaoMax !== undefined) {
    if (ctx.nationalApproval > condicoes.aprovacaoMax) return false;
  }

  // Verifica indicadores
  if (condicoes.indicadores) {
    for (const cond of condicoes.indicadores) {
      const value = ctx.indicators[cond.id];
      if (value === undefined) continue; // Indicador não disponível, ignora

      if (cond.operator === 'greater' && value <= cond.threshold) return false;
      if (cond.operator === 'less' && value >= cond.threshold) return false;
    }
  }

  return true;
}

// ============================================================
// FUNÇÃO PARA ESCOLHER MÚLTIPLAS NOTÍCIAS
// ============================================================

/**
 * Escolhe múltiplas notícias para um mês.
 * Útil se você quiser exibir mais de uma matéria.
 */
export function pickMultipleNewsArticles(
  ctx: NewsPickerContext,
  count: number,
): Noticia[] {
  const result: Noticia[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Filtra artigos não usados ainda
    const eligible = NEWS_ARTICLES.filter(
      (article) => !usedIds.has(article.id) && matchesConditions(article, ctx),
    );

    if (eligible.length === 0) break;

    const selected = eligible[Math.floor(Math.random() * eligible.length)];
    usedIds.add(selected.id);

    result.push({
      id: `news_${ctx.year}_${ctx.month}_${i}_${selected.id}`,
      veiculo: selected.veiculo,
      manchete: selected.manchete,
      submanchete: selected.submanchete,
      corpo: selected.corpo,
      tom: selected.tom,
      imagem: pickImage(selected.imagemTema),
      importancia: 2,
      destaques: [],
    });
  }

  return result;
}
