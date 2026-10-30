// src/screens/politicas/index.tsx

import { useEffect, useState, type ReactNode } from 'react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { useGameStore } from '../../store/gameStore';
import {
  INDICATORS,
  INDICATORS_BY_ID,
  type IndicatorCategory,
  type IndicatorDef,
} from '../../game/data/indicators';
import { GROUPS } from '../../game/data/groups';
import { GROUP_SENSITIVITY } from '../../game/data/groupSensitivity';
import { recalculateEconomy } from '../../game/services/engine/turn';
import type { NewPolicyIndicator } from '../../game/types/ai';
import {
  AREA_TITULO,
  AREAS_NO_PAINEL,
  formatarValorIndicador,
  formatarDeltaIndicador,
  tomDaVariacao,
} from '../../utils/format';
import styles from './styles.module.css';

/* ═══════════ Posicionamento do popover ═══════════ */

function getPopoverStyle(rect: DOMRect): React.CSSProperties {
  const POPOVER_W = 360;
  const POPOVER_H_MAX = 520;
  const GAP = 10;
  const MARGIN = 12;
  const isMobile = window.innerWidth < 760;

  if (isMobile) {
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: `calc(100vw - ${MARGIN * 2}px)`,
      maxWidth: '440px',
      maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
    };
  }

  let left = rect.right + GAP;
  if (left + POPOVER_W > window.innerWidth - MARGIN) {
    left = rect.left - POPOVER_W - GAP;
  }
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - POPOVER_W - MARGIN));

  let top = rect.top;
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - POPOVER_H_MAX - MARGIN));

  return {
    position: 'fixed',
    left,
    top,
    width: POPOVER_W,
    maxHeight: POPOVER_H_MAX,
  };
}

interface PopoverState {
  id: string;
  type: 'slider' | 'policy-slider' | 'policy-info';
  title: string;
  metricId?: string;
  policyId?: string;
  rect: DOMRect;
}

export function Politicas() {
  const game = useGameStore((state) => state.game);
  const updateNewPolicyIndicator = useGameStore((state) => state.updateNewPolicyIndicator);
  const applyIndicatorChange = useGameStore((state) => state.applyIndicatorChange);
  const lastError = useGameStore((state) => state.lastError);
  const previousMonth = game?.history.at(-1);
  const [activeTab, setActiveTab] = useState<IndicatorCategory | 'grupos'>('economia');
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // Click fora do popover fecha
  useEffect(() => {
    if (!popover) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-popover="true"]')) return;
      if (target.closest('[data-popover-trigger="true"]')) return;
      setPopover(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  // Fecha ao rolar/redimensionar, MAS ignora scroll dentro do popover
  useEffect(() => {
    if (!popover) return;
    const close = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-popover="true"]')) {
        return;
      }
      setPopover(null);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [popover]);

  // Esc fecha
  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [popover]);

  if (!game) return null;

  const currentMonthIdx = (game.year - 2026) * 12 + (game.month - 1);
  const hasUsedMonthlyChange = game.lastModifiedIndicatorMonth === currentMonthIdx;

  const categoryIndicators = INDICATORS.filter(
    (ind) => ind.category === activeTab,
  );
  const calculatedList = categoryIndicators.filter((ind) => ind.type !== 'slider');
  const sliderList = categoryIndicators.filter((ind) => ind.type === 'slider');
  const policyCards = (game.activePolicies ?? []).flatMap((policy) =>
    (policy.newIndicators ?? []).map((indicator) => ({ policy, indicator })),
  );
  const newPolicySliders = policyCards.filter(({ indicator }) => indicator.categoria === activeTab && indicator.tipo === 'slider');
  const newPolicyInfo = policyCards.filter(({ indicator }) => indicator.categoria === activeTab && indicator.tipo === 'informativo');

  const openPopover = (
    id: string,
    type: PopoverState['type'],
    title: string,
    el: HTMLElement,
    extras?: { metricId?: string; policyId?: string },
  ) => {
    if (popover?.id === id) {
      setPopover(null);
      return;
    }
    setPopover({
      id,
      type,
      title,
      rect: el.getBoundingClientRect(),
      ...extras,
    });
  };

  const getPolicyEffects = (policy: typeof game.activePolicies[number]) => {
    const effects: Record<string, number> = {};
    for (const [id, delta] of Object.entries(policy.effects)) {
      if (INDICATORS_BY_ID[id] && typeof delta === 'number' && Number.isFinite(delta)) effects[id] = (effects[id] ?? 0) + delta;
    }
    let cardFiscal = 0;
    let hasCardFiscal = false;
    for (const indicator of policy.newIndicators ?? []) {
      if (indicator.tipo !== 'slider') continue;
      const value = game.nationalIndicators[indicator.id] ?? indicator.valorInicial;
      const delta = value - indicator.valorInicial;
      for (const [id, perUnit] of Object.entries(indicator.affects ?? {})) {
        if (INDICATORS_BY_ID[id]) effects[id] = (effects[id] ?? 0) + perUnit * delta / Math.max(1, indicator.affectScale ?? 1);
      }
      if (typeof indicator.fiscalAnnual === 'number' && indicator.fiscalAnnual !== 0) {
        hasCardFiscal = true;
        cardFiscal += indicator.fiscalAnnual * delta;
      }
    }
    const fiscalAnnual = hasCardFiscal ? cardFiscal : policy.fiscalAnnual;
    const description = `${policy.name} ${(policy.newIndicators ?? []).map((item) => `${item.nome} ${item.descricao}`).join(' ')}`.toLowerCase();
    const isTax = policy.measureKind === 'imposto' || /impost|tribut|al[ií]quota|arrecada/.test(description);
    const hasFiscalEstimate = hasCardFiscal || Math.abs(policy.fiscalAnnual) > 0;
    if (hasFiscalEstimate && fiscalAnnual !== 0) {
      if (fiscalAnnual < 0) {
        effects.despesas_governo = (effects.despesas_governo ?? 0) + Math.abs(fiscalAnnual);
        effects.saldo_orcamentario = (effects.saldo_orcamentario ?? 0) + fiscalAnnual;
      } else if (isTax) {
        effects.receitas_governo = (effects.receitas_governo ?? 0) + fiscalAnnual;
        effects.saldo_orcamentario = (effects.saldo_orcamentario ?? 0) + fiscalAnnual;
      } else {
        effects.despesas_governo = (effects.despesas_governo ?? 0) - fiscalAnnual;
        effects.saldo_orcamentario = (effects.saldo_orcamentario ?? 0) + fiscalAnnual;
      }
    }
    return { effects, fiscalAnnual, hasFiscalEstimate, isTax };
  };

  const getPolicyGroups = (policy: typeof game.activePolicies[number], effects: Record<string, number>) => {
    const groupImpacts = new Map<string, { impact: number; direct: boolean }>();
    for (const [groupId, impact] of Object.entries(policy.groupReactions)) {
      if (impact) groupImpacts.set(groupId, { impact, direct: true });
    }
    for (const [groupId, sensitivities] of Object.entries(GROUP_SENSITIVITY)) {
      const derivedImpact = Object.entries(effects).reduce((sum, [indicatorId, delta]) => {
        const sensitivity = sensitivities[indicatorId] ?? 0;
        const definition = INDICATORS_BY_ID[indicatorId];
        if (!sensitivity || !definition) return sum;
        const normalizedDelta = definition.formatKind === 'percent' || definition.formatKind === 'score'
          ? delta
          : (delta / (Math.abs(definition.initial) || 1)) * 12;
        return sum + sensitivity * normalizedDelta;
      }, 0);
      if (Math.abs(derivedImpact) <= 0.05) continue;
      if (!groupImpacts.has(groupId)) groupImpacts.set(groupId, { impact: derivedImpact, direct: false });
    }
    return [...groupImpacts.entries()]
      .map(([id, value]) => ({ id, group: GROUPS.find((item) => item.id === id), ...value, impact: Math.max(-15, Math.min(15, value.impact)) }))
      .filter((item) => item.group)
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  };

  const renderPolicyImpactDetails = (policy: typeof game.activePolicies[number]): ReactNode => {
    const { effects, fiscalAnnual, hasFiscalEstimate, isTax } = getPolicyEffects(policy);
    const affectedIndicators = Object.entries(effects)
      .filter(([id, delta]) => INDICATORS_BY_ID[id] && Math.abs(delta) > 0.0001)
      .map(([id, delta]) => ({ definition: INDICATORS_BY_ID[id], delta }))
      .sort((a, b) => a.definition.nome.localeCompare(b.definition.nome, 'pt-BR'));
    const affectedGroups = getPolicyGroups(policy, effects);
    const annualDefinition = INDICATORS_BY_ID.receitas_governo;
    const fiscalValue = annualDefinition
      ? formatarValorIndicador(annualDefinition, Math.abs(fiscalAnnual))
      : `R$ ${(Math.abs(fiscalAnnual) / 1e9).toFixed(1)} bi`;
    const fiscalLabel = !hasFiscalEstimate || fiscalAnnual === 0
      ? 'Sem estimativa quantificada'
      : fiscalAnnual < 0
        ? (isTax ? 'Renúncia de receita' : 'Custo no orçamento')
        : isTax ? 'Arrecadação' : 'Economia no orçamento';
    const hasFiscal = hasFiscalEstimate && fiscalAnnual !== 0;

    return (
      <div className={styles.impactSection}>
        <div className={styles.impactBlock}>
          <span className={styles.impactTitle}>Impacto Fiscal</span>
          <div className={styles.impactFiscal}>
            {hasFiscal ? (
              <>
                <strong
                  className={styles.impactFiscalValue}
                  data-positive={fiscalAnnual >= 0}
                >
                  {fiscalValue}/ano
                </strong>
                <span className={styles.impactFiscalLabel}>{fiscalLabel}</span>
              </>
            ) : (
              <span className={styles.impactFiscalLabel}>{fiscalLabel}</span>
            )}
          </div>
        </div>

        <div className={styles.impactBlock}>
          <span className={styles.impactTitle}>Atributos Afetados</span>
          {affectedIndicators.length > 0 ? (
            <div className={styles.impactList}>
              {affectedIndicators.map(({ definition, delta }) => (
                <div
                  key={definition.id}
                  className={styles.impactRow}
                  data-impacto={delta >= 0 ? 'favoravel' : 'desfavoravel'}
                >
                  <strong className={styles.impactValue}>
                    {formatarDeltaIndicador(definition, delta)}
                  </strong>
                  <span className={styles.impactName}>{definition.nome}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.impactEmpty}>Nenhum atributo afetado.</p>
          )}
        </div>

        <div className={styles.impactBlock}>
          <span className={styles.impactTitle}>Grupos Afetados</span>
          {affectedGroups.length > 0 ? (
            <div className={styles.impactList}>
              {affectedGroups.map(({ id, group, impact }) => (
                <div
                  key={id}
                  className={styles.impactRow}
                  data-impacto={impact >= 0 ? 'favoravel' : 'desfavoravel'}
                >
                  <strong className={styles.impactValue}>
                    {impact >= 0 ? '▲' : '▼'} {impact > 0 ? '+' : ''}{impact.toFixed(1)} pts
                  </strong>
                  <span className={styles.impactName}>{group!.nome}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.impactEmpty}>Nenhum grupo afetado.</p>
          )}
        </div>
      </div>
    );
  };

  const handleSliderDraftChange = (indicatorId: string, val: number) => {
    setDraftValues((prev) => ({ ...prev, [indicatorId]: val }));
  };

  const handleApplyChange = (indicatorId: string, val: number, indNome: string) => {
    if (hasUsedMonthlyChange) return;
    const success = applyIndicatorChange(indicatorId, val);
    if (success) {
      setActionSuccessMessage(`Medida aplicada com sucesso: "${indNome}" foi alterada neste mês.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
      setDraftValues((prev) => {
        const copy = { ...prev };
        delete copy[indicatorId];
        return copy;
      });
    }
  };

  const handleResetDraft = (indicatorId: string) => {
    setDraftValues((prev) => {
      const copy = { ...prev };
      delete copy[indicatorId];
      return copy;
    });
  };

  const getCalculatedScenario = (indicatorId: string, value: number) => {
    const values = { ...game.nationalIndicators, [indicatorId]: value };
    recalculateEconomy(values, game.activePolicies);
    return values;
  };

  const getSliderImpactSummary = (metric: IndicatorDef, value: number) => {
    const reference = getCalculatedScenario(metric.id, metric.initial);
    const applied = getCalculatedScenario(metric.id, value);
    const step = metric.step || 1;
    const probeValue = value + step <= metric.max ? value + step : Math.max(metric.min, value - step);
    const probe = getCalculatedScenario(metric.id, probeValue);
    const calculated = INDICATORS.filter((indicator) => indicator.type === 'calculated');
    const effects = calculated.map((definition) => ({
      definition,
      delta: (applied[definition.id] ?? definition.initial) - (reference[definition.id] ?? definition.initial),
      nextStepDelta: (probe[definition.id] ?? definition.initial) - (applied[definition.id] ?? definition.initial),
      value: applied[definition.id] ?? definition.initial,
    })).filter(({ delta, nextStepDelta }) => Math.abs(delta) > 0.0001 || Math.abs(nextStepDelta) > 0.0001);

    const groupDeltas: Record<string, number> = {};
    const addGroupEffects = (indicatorDeltas: Record<string, number>) => {
      for (const [groupId, sensitivities] of Object.entries(GROUP_SENSITIVITY)) {
        for (const [indicatorId, delta] of Object.entries(indicatorDeltas)) {
          const sensitivity = sensitivities[indicatorId] ?? 0;
          const definition = INDICATORS_BY_ID[indicatorId];
          if (!sensitivity || !definition) continue;
          const normalized = definition.formatKind === 'percent' || definition.formatKind === 'score'
            ? delta
            : (delta / (Math.abs(definition.initial) || 1)) * 12;
          groupDeltas[groupId] = (groupDeltas[groupId] ?? 0) + sensitivity * normalized;
        }
      }
    };
    const appliedDeltas = Object.fromEntries(calculated.map(({ id }) => [id, (applied[id] ?? 0) - (reference[id] ?? 0)]));
    appliedDeltas[metric.id] = value - metric.initial;
    addGroupEffects(appliedDeltas);
    const groups = Object.entries(groupDeltas)
      .filter(([, impact]) => Math.abs(impact) > 0.01)
      .map(([id, impact]) => ({ id, group: GROUPS.find((candidate) => candidate.id === id), impact }))
      .filter((item) => item.group)
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    const annualIds = ['receitas_governo', 'despesas_governo', 'saldo_orcamentario'];
    const financial = annualIds.map((id) => ({
      definition: INDICATORS_BY_ID[id],
      delta: (applied[id] ?? 0) - (reference[id] ?? 0),
      value: applied[id] ?? 0,
    })).filter((item) => item.definition && Math.abs(item.delta) > 0.0001);

    return { effects, groups, financial, probeValue };
  };

  const renderSliderImpactSummary = (metric: IndicatorDef, value: number, isPreview: boolean): ReactNode => {
    const { effects, groups, financial, probeValue } = getSliderImpactSummary(metric, value);
    return (
      <div className={styles.impactSection}>
        <div className={styles.impactBlock}>
          <span className={styles.impactTitle}>
            {isPreview ? 'Efeitos Previstos' : 'Efeitos Aplicados'}
          </span>
          <p className={styles.impactEmpty}>
            vs. base {formatarValorIndicador(metric, metric.initial)}. Próximo: {formatarValorIndicador(metric, probeValue)}.
          </p>
        </div>

        <div className={styles.impactBlock}>
          <span className={styles.impactTitle}>Atributos Calculados</span>
          {effects.length > 0 ? (
            <div className={styles.impactList}>
              {effects.map(({ definition, delta, nextStepDelta }) => {
                const useDelta = Math.abs(delta) > 0.0001;
                const displayed = useDelta ? delta : nextStepDelta;
                return (
                  <div
                    key={definition.id}
                    className={styles.impactRow}
                    data-impacto={displayed > 0.0001 ? 'favoravel' : displayed < -0.0001 ? 'desfavoravel' : 'neutro'}
                  >
                    <strong className={styles.impactValue}>
                      {formatarDeltaIndicador(definition, displayed)}
                    </strong>
                    <span className={styles.impactName}>
                      {definition.nome}
                      {!useDelta && <span className={styles.impactHint}> (próximo)</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.impactEmpty}>Nenhum atributo calculado muda.</p>
          )}
        </div>

        {financial.length > 0 && (
          <div className={styles.impactBlock}>
            <span className={styles.impactTitle}>Impacto Fiscal Anual</span>
            <div className={styles.impactList}>
              {financial.map(({ definition, delta }) => (
                <div
                  key={definition!.id}
                  className={styles.impactRow}
                  data-impacto={delta > 0 ? 'favoravel' : delta < 0 ? 'desfavoravel' : 'neutro'}
                >
                  <strong className={styles.impactValue}>
                    {formatarDeltaIndicador(definition!, delta)}
                  </strong>
                  <span className={styles.impactName}>
                    {definition!.id === 'receitas_governo' ? 'Arrecadação' : definition!.id === 'despesas_governo' ? 'Gasto público' : 'Saldo fiscal'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.impactBlock}>
          <span className={styles.impactTitle}>Grupos Afetados</span>
          {groups.length > 0 ? (
            <div className={styles.impactList}>
              {groups.map(({ id, group, impact }) => (
                <div
                  key={id}
                  className={styles.impactRow}
                  data-impacto={impact >= 0 ? 'favoravel' : 'desfavoravel'}
                >
                  <strong className={styles.impactValue}>
                    {impact >= 0 ? '▲' : '▼'} {impact > 0 ? '+' : ''}{impact.toFixed(1)}
                  </strong>
                  <span className={styles.impactName}>{group!.nome}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.impactEmpty}>Nenhum grupo afetado.</p>
          )}
        </div>
      </div>
    );
  };

  // ── Card Calculado (compacto, valor grande) ──
  const renderCalculatedCard = (metric: IndicatorDef) => {
    const value = game.nationalIndicators[metric.id] ?? metric.initial;
    const prevValue = previousMonth?.national?.[metric.id];
    const delta =
      value !== undefined && prevValue !== undefined ? value - prevValue : null;
    const tom = tomDaVariacao(metric, delta);
    const formatted = formatarValorIndicador(metric, value);

    return (
      <article
        key={metric.id}
        className={`${styles.item} ${styles.calculatedCard}`}
      >
        <span
          className={styles.value}
          data-balance={
            metric.id === 'saldo_orcamentario'
              ? value > 0
                ? 'positive'
                : value < 0
                  ? 'negative'
                  : 'neutral'
              : undefined
          }
          title={`${metric.nome}: ${formatted} — ${metric.descricao}`}
        >
          {formatted}
        </span>
        <h3 className={styles.label}>{metric.nome}</h3>
        <span
          className={styles.trend}
          data-direction={delta === null ? 'neutral' : tom}
        >
          {delta === null
            ? 'Base inicial'
            : `${formatarDeltaIndicador(metric, delta)} vs. mês anterior`}
        </span>
      </article>
    );
  };

  // ── Card Slider (popover ao clicar) ──
  const renderSliderCard = (metric: IndicatorDef) => {
    const cardId = `slider:${metric.id}`;
    const isActive = popover?.id === cardId;

    const appliedValue = game.nationalIndicators[metric.id] ?? metric.initial;
    const currentDraft = draftValues[metric.id];
    const displayValue = currentDraft !== undefined ? currentDraft : appliedValue;

    const prevValue = previousMonth?.national?.[metric.id];
    const delta =
      appliedValue !== undefined && prevValue !== undefined
        ? appliedValue - prevValue
        : null;
    const tom = tomDaVariacao(metric, delta);

    const isDraftModified =
      currentDraft !== undefined &&
      Math.abs(currentDraft - appliedValue) > 0.0001;

    return (
      <article
        key={metric.id}
        className={`${styles.item} ${styles.sliderCard}`}
        data-popover-trigger="true"
        data-active={isActive ? 'true' : undefined}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, input, a, label')) return;
          openPopover(
            cardId,
            'slider',
            metric.nome,
            e.currentTarget as HTMLElement,
            { metricId: metric.id },
          );
        }}
      >
        <div className={styles.itemHeader}>
          <span className={styles.typeTag} data-type={metric.type}>
            Slider
          </span>
          <span className={styles.value}>
            {formatarValorIndicador(metric, displayValue)}
          </span>
        </div>

        <h3 className={styles.label}>{metric.nome}</h3>
        <p className={styles.metricDesc}>{metric.descricao}</p>

        <div
          className={styles.sliderControlContainer}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.sliderHeaderRow}>
            <span className={styles.sliderMin}>
              {formatarValorIndicador(metric, metric.min)}
            </span>
            <span className={styles.sliderCurrentValue}>
              {formatarValorIndicador(metric, displayValue)}
              {isDraftModified && (
                <span className={styles.draftIndicator}> (prévia)</span>
              )}
            </span>
            <span className={styles.sliderMax}>
              {formatarValorIndicador(metric, metric.max)}
            </span>
          </div>
          <input
            type="range"
            className={styles.sliderInput}
            min={metric.min}
            max={metric.max}
            step={metric.step || 1}
            value={displayValue}
            disabled={hasUsedMonthlyChange}
            onChange={(e) =>
              handleSliderDraftChange(metric.id, Number(e.target.value))
            }
          />

          <div className={styles.cardActionsRow}>
            <button
              type="button"
              className={styles.applyBtn}
              disabled={hasUsedMonthlyChange || !isDraftModified}
              onClick={() =>
                handleApplyChange(metric.id, displayValue, metric.nome)
              }
            >
              {hasUsedMonthlyChange ? '🔒 Limite' : '✓ Aplicar'}
            </button>
            {isDraftModified && (
              <button
                type="button"
                className={styles.cancelDraftBtn}
                onClick={() => handleResetDraft(metric.id)}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <span
          className={styles.trend}
          data-direction={delta === null ? 'neutral' : tom}
        >
          {delta === null
            ? 'Base inicial'
            : `${formatarDeltaIndicador(metric, delta)} vs. mês anterior`}
        </span>

        <span className={styles.popoverHint} aria-hidden="true">
          ⓘ Clique para ver impacto
        </span>
      </article>
    );
  };

  // ── Slider de proposta ──
  const renderNewPolicySlider = (
    indicator: NewPolicyIndicator,
    policy: typeof game.activePolicies[number],
  ) => {
    const cardId = `policy-slider:${policy.id}:${indicator.id}`;
    const isActive = popover?.id === cardId;

    const currentValue = game.nationalIndicators[indicator.id] ?? indicator.valorInicial;
    const draft = draftValues[indicator.id];
    const value = draft ?? currentValue;
    const modified = Math.abs(value - currentValue) > 0.0001;

    return (
      <article
        key={cardId}
        className={`${styles.item} ${styles.policyCard}`}
        data-popover-trigger="true"
        data-active={isActive ? 'true' : undefined}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, input, a, label')) return;
          openPopover(
            cardId,
            'policy-slider',
            indicator.nome,
            e.currentTarget as HTMLElement,
            { policyId: policy.id },
          );
        }}
      >
        <div className={styles.itemHeader}>
          <span className={styles.typeTag}>
            {policy.measureKind === 'imposto' ? 'Imposto' : policy.measureKind === 'beneficio' ? 'Benefício' : policy.measureKind === 'programa' ? 'Programa' : 'Medida'}
          </span>
          <span className={styles.value}>{value} {indicator.unidade}</span>
        </div>
        <h3 className={styles.label}>{indicator.nome}</h3>
        <p className={styles.metricDesc}>{indicator.descricao}</p>

        <div
          className={styles.sliderControlContainer}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.sliderHeaderRow}>
            <span className={styles.sliderMin}>{indicator.minimo} {indicator.unidade}</span>
            <span className={styles.sliderCurrentValue}>{value} {indicator.unidade}</span>
            <span className={styles.sliderMax}>{indicator.maximo} {indicator.unidade}</span>
          </div>
          <input
            type="range"
            className={styles.sliderInput}
            min={indicator.minimo}
            max={indicator.maximo}
            step={indicator.passo}
            value={value}
            disabled={hasUsedMonthlyChange}
            onChange={(event) => handleSliderDraftChange(indicator.id, Number(event.target.value))}
          />
          <div className={styles.cardActionsRow}>
            <button
              type="button"
              className={styles.applyBtn}
              disabled={hasUsedMonthlyChange || !modified}
              onClick={() => {
                if (updateNewPolicyIndicator(indicator.id, value)) {
                  setDraftValues((prev) => {
                    const next = { ...prev };
                    delete next[indicator.id];
                    return next;
                  });
                  setActionSuccessMessage(`${indicator.nome} foi atualizado.`);
                }
              }}
            >
              {hasUsedMonthlyChange ? 'Limite' : 'Aplicar'}
            </button>
            {modified && (
              <button
                type="button"
                className={styles.cancelDraftBtn}
                onClick={() => handleResetDraft(indicator.id)}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <span className={styles.popoverHint} aria-hidden="true">
          ⓘ Clique para ver impacto
        </span>
      </article>
    );
  };

  // ── Proposta qualitativa ──
  const renderNewPolicyInfo = (
    indicator: NewPolicyIndicator,
    policy: typeof game.activePolicies[number],
  ) => {
    const cardId = `policy-info:${policy.id}:${indicator.id}`;
    const isActive = popover?.id === cardId;

    return (
      <article
        key={cardId}
        className={`${styles.item} ${styles.policyCard}`}
        data-popover-trigger="true"
        data-active={isActive ? 'true' : undefined}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, input, a, label')) return;
          openPopover(
            cardId,
            'policy-info',
            indicator.nome,
            e.currentTarget as HTMLElement,
            { policyId: policy.id },
          );
        }}
      >
        <div className={styles.itemHeader}>
          <span className={styles.typeTag}>
            {policy.measureKind === 'imposto' ? 'Imposto' : policy.measureKind === 'beneficio' ? 'Benefício' : policy.measureKind === 'programa' ? 'Programa' : 'Medida'}
          </span>
          <span className={styles.value}>{policy.name}</span>
        </div>
        <h3 className={styles.label}>{indicator.nome}</h3>
        <p className={styles.metricDesc}>{indicator.descricao}</p>

        <span className={styles.popoverHint} aria-hidden="true">
          ⓘ Clique para ver impacto
        </span>
      </article>
    );
  };

  // ── Conteúdo do popover ──
  const renderPopoverContent = (): ReactNode => {
    if (!popover) return null;
    if (popover.type === 'slider' && popover.metricId) {
      const metric = INDICATORS.find((m) => m.id === popover.metricId);
      if (!metric) return null;
      const appliedValue = game.nationalIndicators[metric.id] ?? metric.initial;
      const currentDraft = draftValues[metric.id];
      const displayValue = currentDraft !== undefined ? currentDraft : appliedValue;
      const isDraftModified =
        currentDraft !== undefined &&
        Math.abs(currentDraft - appliedValue) > 0.0001;
      return renderSliderImpactSummary(metric, displayValue, isDraftModified);
    }
    if (
      (popover.type === 'policy-slider' || popover.type === 'policy-info') &&
      popover.policyId
    ) {
      const policy = game.activePolicies?.find((p) => p.id === popover.policyId);
      if (!policy) return null;
      return renderPolicyImpactDetails(policy);
    }
    return null;
  };

  return (
    <div className={styles.container}>
      <Header />
      <section className={styles.panel} aria-label="Painel de indicadores nacionais">
        <header className={styles.panelTopBar}>
          <div>
            <h1 className={styles.panelMainTitle}>
              Gestão de Políticas e Atributos Nacionais
            </h1>
            <p className={styles.panelSubtitle}>
              Ajuste alíquotas, orçamentos e diretrizes do governo.{' '}
              <strong>Limite de 1 alteração por mês.</strong> Clique em um card
              interativo para ver o impacto.
            </p>
          </div>
          <div className={styles.topBarRight}>
            <div
              className={styles.monthlyQuotaBadge}
              data-blocked={hasUsedMonthlyChange}
            >
              <span>Ação do Mês</span>
              <strong>
                {hasUsedMonthlyChange ? '1/1 Usada' : '0/1 Disponível'}
              </strong>
            </div>
            <div className={styles.quickFiscalBadge}>
              <span>Saldo Orçamentário</span>
              <strong
                data-positive={game.nationalIndicators.saldo_orcamentario >= 0}
              >
                R$ {(game.nationalIndicators.saldo_orcamentario / 1e9).toFixed(1)} bi/ano
              </strong>
            </div>
          </div>
        </header>

        {actionSuccessMessage && (
          <div className={styles.successNotice}>
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {lastError && (
          <div className={styles.errorNotice}>
            <span>{lastError}</span>
          </div>
        )}

        <nav className={styles.tabs} aria-label="Navegação por áreas">
          {AREAS_NO_PAINEL.map((area) => (
            <button
              key={area}
              type="button"
              className={`${styles.tabBtn} ${activeTab === area ? styles.activeTab : ''}`}
              onClick={() => {
                setActiveTab(area);
                setPopover(null);
              }}
            >
              {AREA_TITULO[area]}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.tabBtn} ${styles.groupsTab} ${activeTab === 'grupos' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('grupos');
              setPopover(null);
            }}
          >
            👥 Grupos Sociais ({GROUPS.length})
          </button>
        </nav>

        <div className={styles.panelContent}>
          {activeTab === 'grupos' ? (
            <div className={styles.groupsGrid}>
              {GROUPS.map((group) => {
                const approval =
                  game.groupApprovals[group.id] ??
                  group.initialApproval ??
                  50;
                const prevApproval = previousMonth?.groupApprovals?.[group.id];
                const delta =
                  prevApproval !== undefined ? approval - prevApproval : null;

                return (
                  <article key={group.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupBadge} data-cat={group.categoria}>
                        {group.categoria}
                      </span>
                      <span className={styles.groupInfluence}>
                        Influência: {group.peso}
                      </span>
                    </div>
                    <h3 className={styles.groupTitle}>{group.nome}</h3>
                    <p className={styles.groupDesc}>{group.descricao}</p>
                    <div className={styles.groupApprovalRow}>
                      <div className={styles.approvalBarWrapper}>
                        <div
                          className={styles.approvalBarFill}
                          style={{
                            width: `${Math.min(100, Math.max(0, approval))}%`,
                            backgroundColor:
                              approval >= 60
                                ? '#10b981'
                                : approval <= 40
                                  ? '#ef4444'
                                  : '#f59e0b',
                          }}
                        />
                      </div>
                      <span className={styles.approvalValue}>
                        {approval.toFixed(1)}%
                      </span>
                    </div>
                    {delta !== null && Math.abs(delta) > 0.05 && (
                      <span
                        className={styles.trend}
                        data-direction={delta > 0 ? 'good' : 'bad'}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta.toFixed(1)} p.p. vs. mês anterior
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <>
              {calculatedList.length > 0 && (
                <section className={styles.block} data-block="calculated">
                  <header className={styles.blockHeader}>
                    <div>
                      <h2 className={styles.blockTitle}>Indicadores Calculados</h2>
                      <p className={styles.blockSubtitle}>Derivados das suas escolhas. Somente leitura.</p>
                    </div>
                    <span className={styles.blockCount}>
                      {calculatedList.length} {calculatedList.length === 1 ? 'item' : 'itens'}
                    </span>
                  </header>
                  <div className={styles.indicatorsGrid}>
                    {calculatedList.map(renderCalculatedCard)}
                  </div>
                </section>
              )}

              {sliderList.length > 0 && (
                <section className={styles.block} data-block="sliders">
                  <header className={styles.blockHeader}>
                    <div>
                      <h2 className={styles.blockTitle}>Ajustes Interativos</h2>
                      <p className={styles.blockSubtitle}>Arraste o slider e aplique — limite de 1 por mês.</p>
                    </div>
                    <span className={styles.blockCount}>
                      {sliderList.length} {sliderList.length === 1 ? 'item' : 'itens'}
                    </span>
                  </header>
                  <div className={styles.indicatorsGrid}>
                    {sliderList.map(renderSliderCard)}
                  </div>
                </section>
              )}

              {(newPolicySliders.length > 0 || newPolicyInfo.length > 0) && (
                <section className={styles.block} data-block="policies">
                  <header className={styles.blockHeader}>
                    <div>
                      <h2 className={styles.blockTitle}>Suas Propostas</h2>
                      <p className={styles.blockSubtitle}>Medidas que você adicionou nesta partida.</p>
                    </div>
                    <span className={styles.blockCount}>
                      {newPolicySliders.length + newPolicyInfo.length}{' '}
                      {newPolicySliders.length + newPolicyInfo.length === 1 ? 'item' : 'itens'}
                    </span>
                  </header>
                  <div className={styles.indicatorsGrid}>
                    {newPolicySliders.map(({ indicator, policy }) =>
                      renderNewPolicySlider(indicator, policy),
                    )}
                    {newPolicyInfo.map(({ indicator, policy }) =>
                      renderNewPolicyInfo(indicator, policy),
                    )}
                  </div>
                </section>
              )}

              {calculatedList.length === 0 &&
                sliderList.length === 0 &&
                newPolicySliders.length === 0 &&
                newPolicyInfo.length === 0 && (
                  <p className={styles.empty}>Nenhum indicador nesta área.</p>
                )}
            </>
          )}
        </div>
      </section>

      {/* Popover lateral — fecha ao clicar fora */}
      {popover && (
        <>
          <div
            className={styles.popoverBackdrop}
            data-popover="true"
            onClick={() => setPopover(null)}
          />
          <div
            className={styles.popover}
            data-popover="true"
            style={getPopoverStyle(popover.rect)}
            role="dialog"
            aria-label={`Impacto de ${popover.title}`}
          >
            <header className={styles.popoverHeader}>
              <span className={styles.popoverTitle}>{popover.title}</span>
              <button
                type="button"
                className={styles.popoverClose}
                onClick={() => setPopover(null)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </header>
            <div className={styles.popoverBody}>{renderPopoverContent()}</div>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}