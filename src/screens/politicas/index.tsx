// src/screens/politicas/index.tsx

import { useState } from 'react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { useGameStore } from '../../store/gameStore';
import {
  INDICATORS,
  type IndicatorCategory,
} from '../../game/data/indicators';
import { GROUPS } from '../../game/data/groups';
import {
  AREA_TITULO,
  AREAS_NO_PAINEL,
  formatarValorIndicador,
  formatarDeltaIndicador,
  tomDaVariacao,
} from '../../utils/format';
import styles from './styles.module.css';

export function Politicas() {
  const game = useGameStore((state) => state.game);
  const previousMonth = game?.history.at(-1);
  const [activeTab, setActiveTab] = useState<IndicatorCategory | 'grupos'>('economia');

  if (!game) return null;

  const currentCategoryIndicators = INDICATORS.filter(
    (ind) => ind.category === activeTab,
  );

  return (
    <div className={styles.container}>
      <Header />
      <section className={styles.panel} aria-label="Painel de indicadores nacionais">
        <nav className={styles.tabs} aria-label="Navegação por áreas">
          {AREAS_NO_PAINEL.map((area) => (
            <button
              key={area}
              type="button"
              className={`${styles.tabBtn} ${activeTab === area ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(area)}
            >
              {AREA_TITULO[area]}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.tabBtn} ${styles.groupsTab} ${activeTab === 'grupos' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('grupos')}
          >
            👥 Grupos de Apoio ({GROUPS.length})
          </button>
        </nav>

        <div className={styles.panelContent}>
          {activeTab === 'grupos' ? (
            <div className={styles.groupsGrid}>
              {GROUPS.map((group) => {
                const approval = game.groupApprovals[group.id] ?? group.initialApproval ?? 50;
                const prevApproval = previousMonth?.groupApprovals?.[group.id];
                const delta = prevApproval !== undefined ? approval - prevApproval : null;

                return (
                  <article key={group.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupBadge} data-cat={group.categoria}>
                        {group.categoria}
                      </span>
                      <span className={styles.groupInfluence} title="Influência Política">
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
                              approval >= 60 ? '#10b981' : approval <= 40 ? '#ef4444' : '#f59e0b',
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
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)} p.p. vs. mês anterior
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.indicatorsGrid}>
              {currentCategoryIndicators.map((metric) => {
                const value = game.nationalIndicators[metric.id];
                const prevValue = previousMonth?.national?.[metric.id];
                const delta =
                  value !== undefined && prevValue !== undefined
                    ? value - prevValue
                    : null;
                const tom = tomDaVariacao(metric, delta);

                return (
                  <article key={metric.id} className={styles.item}>
                    <div className={styles.itemHeader}>
                      <span className={styles.typeTag} data-type={metric.type}>
                        {metric.type === 'slider' ? 'Slider editável' : 'Calculado'}
                      </span>
                      <span
                        className={styles.value}
                        data-balance={metric.id === 'saldo_orcamentario'
                          ? value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
                          : undefined}
                      >
                        {formatarValorIndicador(metric, value)}
                      </span>
                    </div>

                    <h3 className={styles.label}>{metric.nome}</h3>
                    <p className={styles.metricDesc}>{metric.descricao}</p>

                    <span
                      className={styles.trend}
                      data-direction={delta === null ? 'neutral' : tom}
                      title={delta === null ? 'Primeiro mês' : 'Variação vs. mês anterior'}
                    >
                      {delta === null
                        ? 'Início de mandato'
                        : `${formatarDeltaIndicador(metric, delta)} vs. mês anterior`}
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
