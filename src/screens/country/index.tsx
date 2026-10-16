import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GROUPS } from '../../game/data/groups';
import { INDICATORS, type IndicatorCategory } from '../../game/data/indicators';
import type { StateId } from '../../game/data/states';
import type { BrazilMapState } from '../home/components/BrazilMap';
import { BrazilMap } from '../home/components/BrazilMap';
import { POLICY_CATALOG } from '../../game/data/policies';
import styles from './styles.module.css';

const CATEGORY_LABEL: Record<IndicatorCategory, string> = {
  economia: 'Economia', saude: 'Saúde', educacao: 'Educação', seguranca: 'Segurança',
  emprego: 'Emprego',
  infraestrutura: 'Infraestrutura', social: 'Social', ambiente: 'Meio ambiente', gestao: 'Gestão', politica: 'Política',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as IndicatorCategory[];

function formatNumber(value: number, unit: string): string {
  const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  if (unit.includes('%')) return `${formatted}%`;
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatDelta(value: number, unit: string): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value), unit)}`;
}

/**
 * Escala de aprovação em 6 faixas fixas:
 *
 *   0–30%  → vermelho
 *   31–40% → laranja
 *   41–50% → amarelado verde
 *   51–60% → amarelo esverdeado
 *   61–70% → verde
 *   71%+   → verde forte, claro e brilhante
 */
function approvalColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));

  if (p < 31)  return 'hsl(0 65% 42%)';    // vermelho
  if (p < 41)  return 'hsl(28 78% 52%)';   // laranja
  if (p < 51)  return 'hsl(72 68% 55%)';   // amarelado verde
  if (p < 61)  return 'hsl(92 62% 52%)';   // amarelo esverdeado
  if (p < 71)  return 'hsl(118 60% 50%)';  // verde
  return 'hsl(148 88% 62%)';               // verde forte, claro, brilhante
}

interface Props {
  selectedState: StateId | null;
  onSelectState: (id: StateId | null) => void;
  mapStates: BrazilMapState[];
  onProposePolicy?: (text: string) => void;
}

export function CountryScreen({ selectedState, onSelectState, mapStates, onProposePolicy }: Props) {
  const game = useGameStore((state) => state.game);
  const [activeCat, setActiveCat] = useState<IndicatorCategory>('economia');

  const stateValues = selectedState
    ? game?.stateIndicators[selectedState] ?? {}
    : game?.nationalIndicators ?? {};

  const previous = game?.history.at(-1);
  const previousValues = selectedState
    ? previous?.states?.find((state) => state.id === selectedState)?.values ?? {}
    : previous?.national ?? {};

  const monthLabel = game ? `Mês ${game.month}/${game.year}` : 'Mês atual';
  const previousLabel = previous ? `Mês ${previous.month}` : '—';

  /* ---------- Categorias com dados + contagem ---------- */

  const categoryStats = useMemo(() => {
    const counts = new Map<IndicatorCategory, number>();
    for (const [id, value] of Object.entries(stateValues)) {
      const def = INDICATORS[id];
      if (def && Number.isFinite(value)) {
        counts.set(def.category, (counts.get(def.category) ?? 0) + 1);
      }
    }
    return CATEGORY_ORDER
      .filter((cat) => counts.has(cat))
      .map((cat) => ({ id: cat, label: CATEGORY_LABEL[cat], count: counts.get(cat)! }));
  }, [stateValues]);

  useEffect(() => {
    if (categoryStats.length === 0) return;
    if (!categoryStats.some((c) => c.id === activeCat)) {
      setActiveCat(categoryStats[0].id);
    }
  }, [categoryStats, activeCat]);

  /* ---------- Linhas da categoria ativa ---------- */

  const rows = useMemo(() => {
    return Object.entries(stateValues).filter(([id, value]) => {
      const def = INDICATORS[id];
      return def && def.category === activeCat && Number.isFinite(value);
    });
  }, [stateValues, activeCat]);

  /* ---------- Grupos ordenados por aprovação ---------- */

  const sortedGroups = useMemo(() => {
    const list = GROUPS.map((group) => ({
      ...group,
      current: game?.groupApprovals[group.id],
      previous: previous?.groupApprovals[group.id],
    }));
    // Maior aprovação primeiro; sem dado vai para o fim.
    return list.sort((a, b) => (b.current ?? -1) - (a.current ?? -1));
  }, [game?.groupApprovals, previous?.groupApprovals]);

  /* ---------- Toggle do mapa ---------- */

  const handleSelect = (id: StateId) => {
    onSelectState(id === selectedState ? null : id);
  };

  const stateName = selectedState
    ? mapStates.find((state) => state.id === selectedState)?.name ?? selectedState
    : 'Brasil';

  return (
    <main className={styles.page}>
      <div className={styles.topGrid}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <span className={styles.marker} />
              <div>
                <p className={styles.eyebrow}>Visão territorial</p>
                <h1>Brasil</h1>
              </div>
            </div>
            <p className={styles.hint}>
              {selectedState ? 'Clique de novo para voltar' : 'Clique em um estado'}
            </p>
          </header>
          <div className={styles.mapBody}>
            <BrazilMap states={mapStates} selectedId={selectedState} onSelect={handleSelect} />
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <span className={styles.marker} data-tone={selectedState ? 'info' : 'accent'} />
              <div>
                <p className={styles.eyebrow}>
                  {selectedState ? 'Indicadores estaduais' : 'Indicadores nacionais'}
                </p>
                <h2>{stateName}</h2>
              </div>
            </div>
            <div className={styles.period}>
              <span className={styles.periodNow}>{monthLabel}</span>
              <span className={styles.periodPrev}>antes: {previousLabel}</span>
            </div>
          </header>

          <nav className={styles.tabs} role="tablist" aria-label="Categorias de indicadores">
            {categoryStats.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={cat.id === activeCat}
                className={styles.tab}
                data-active={cat.id === activeCat}
                onClick={() => setActiveCat(cat.id)}
              >
                <span>{cat.label}</span>
                <em>{cat.count}</em>
              </button>
            ))}
          </nav>

          <div className={styles.tableHead} aria-hidden="true">
            <span>Indicador</span>
            <span>Atual</span>
            <span>Anterior</span>
            <span>Δ</span>
          </div>

          <div className={styles.tableBody}>
            {rows.length === 0 ? (
              <p className={styles.empty}>Sem indicadores nesta categoria.</p>
            ) : (
              rows.map(([id, value]) => {
                const def = INDICATORS[id];
                const oldValue = previousValues[id];
                const delta = typeof oldValue === 'number' ? value - oldValue : null;
                const dir =
                  delta === null || delta === 0 || !def.direction || def.direction === 'neutral'
                    ? 'neutral'
                    : (def.direction === 'higher_is_better' ? delta > 0 : delta < 0)
                    ? 'good'
                    : 'bad';

                return (
                  <article className={styles.row} key={id} data-direction={dir}>
                    <span className={styles.rowName} title={def.name}>{def.name}</span>
                    <span className={styles.valueNow}>{formatNumber(value, def.unit)}</span>
                    <span className={styles.valuePrev}>
                      {oldValue === undefined ? '—' : formatNumber(oldValue, def.unit)}
                    </span>
                    <span className={styles.valueDelta} data-direction={dir}>
                      {delta === null ? '—' : formatDelta(delta, def.unit)}
                    </span>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      {!selectedState && ['saude', 'educacao', 'seguranca'].includes(activeCat) && (() => {
        const areaPolicies = POLICY_CATALOG.filter((policy) => policy.area === activeCat);
        const activeAreaPolicies = game?.activePolicies.filter((policy) => areaPolicies.some((entry) => entry.id === policy.catalogPolicyId)) ?? [];
        const areaBudgetId = activeCat === 'saude' ? 'orcamento_saude' : activeCat === 'educacao' ? 'orcamento_educacao' : null;
        const areaBudget = areaBudgetId ? game?.nationalIndicators[areaBudgetId] : undefined;
        const areaLabel = CATEGORY_LABEL[activeCat];
        return (
          <section className={styles.panel} aria-label={`Programas e orçamento de ${areaLabel}`}>
            <header className={styles.panelHeader}>
              <div className={styles.panelTitle}><span className={styles.marker} data-tone="amber" /><div><p className={styles.eyebrow}>Gestão de políticas</p><h2>{areaLabel}: orçamento, programas e projetos</h2></div></div>
              <span className={styles.groupNote}>{areaBudget === undefined ? 'Orçamento setorial sem indicador legado' : `Orçamento federal: R$ ${areaBudget.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi/ano`}</span>
            </header>
            <div className={styles.areaPolicyGrid}>
              {areaPolicies.map((catalog) => {
                const active = activeAreaPolicies.filter((policy) => policy.catalogPolicyId === catalog.id);
                return <article className={styles.areaPolicyCard} key={catalog.id}>
                  <div className={styles.areaPolicyHeading}><strong>{catalog.name}</strong><span>{catalog.kind === 'benefit' ? 'Programa' : 'Projeto'} · {catalog.reach}</span></div>
                  <p>{catalog.description}</p>
                  <small>{active.length ? `${active.length} medida(s) ativa(s)` : 'Sem medida ativa'} · {catalog.durationMonths === null ? 'permanente' : `${catalog.durationMonths} meses`} · custo base R$ {Math.abs(catalog.fiscalAnnualBi).toLocaleString('pt-BR')} bi/ano</small>
                  {active.map((policy) => <small key={policy.id}>Ativa há {policy.activeMonths} mês(es); {policy.terminationRequested ? 'encerramento solicitado' : policy.durationType === 'temporary' ? `${Math.max(0, policy.durationMonths - policy.activeMonths)} mês(es) restantes` : 'prazo indeterminado'}.</small>)}
                  {onProposePolicy && <div className={styles.areaPolicyActions}><button type="button" onClick={() => onProposePolicy(`Ampliar ${catalog.name}.`)}>Ampliar</button><button type="button" onClick={() => onProposePolicy(`Reduzir ${catalog.name}.`)}>Reduzir</button>{active.some((policy) => !policy.terminationRequested) && <button type="button" onClick={() => onProposePolicy(`Encerrar ${catalog.name}.`)}>Encerrar</button>}</div>}
                </article>;
              })}
              {activeCat === 'seguranca' && <article className={styles.areaPolicyCard}><div className={styles.areaPolicyHeading}><strong>Orçamento de Segurança</strong><span>Estimativa federal dos projetos catalogados</span></div><p>Custos anualizados dos projetos ativos de policiamento e investigação.</p><strong>R$ {Math.abs(activeAreaPolicies.reduce((sum, policy) => sum + Math.min(0, policy.fiscalAnnual), 0) / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi/ano em projetos ativos</strong></article>}
              {areaPolicies.length === 0 && <p className={styles.empty}>Nenhum programa cadastrado nesta área.</p>}
            </div>
          </section>
        );
      })()}

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <span className={styles.marker} data-tone="amber" />
            <div>
              <p className={styles.eyebrow}>Apoio ao governo</p>
              <h2>Grupos políticos</h2>
            </div>
          </div>
          <span className={styles.groupNote}>Ordenado por aprovação · Δ mensal</span>
        </header>

        <div className={styles.groupsGrid}>
          {sortedGroups.map((group, index) => {
            const delta =
              group.current !== undefined && group.previous !== undefined
                ? group.current - group.previous
                : null;
            const deltaDir =
              delta === null || delta === 0 ? 'neutral' : delta > 0 ? 'good' : 'bad';
            const pct =
              group.current !== undefined
                ? Math.max(0, Math.min(100, group.current))
                : 0;
            const color =
              group.current !== undefined
                ? approvalColor(group.current)
                : 'var(--text-subtle)';

            return (
              <article
                className={styles.groupRow}
                key={group.id}
                style={{ borderLeftColor: color }}
                data-rank={index}
              >
                <div className={styles.groupTop}>
                  <span className={styles.groupName}>{group.nome}</span>
                  <span className={styles.groupDelta} data-direction={deltaDir}>
                    {delta === null ? '—' : `${formatDelta(delta, '')} p.p.`}
                  </span>
                </div>
                <div className={styles.groupValueRow}>
                  <strong style={{ color }}>
                    {group.current === undefined ? '—' : `${group.current.toFixed(1)}%`}
                  </strong>
                </div>
                <div className={styles.groupBar} aria-hidden="true">
                  <span style={{ width: `${pct}%`, background: color }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
