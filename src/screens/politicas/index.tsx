// src/screens/politicas/index.tsx

import { useState } from 'react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { useGameStore } from '../../store/gameStore';
import {
  INDICATORS,
  type IndicatorCategory,
  type IndicatorDef,
} from '../../game/data/indicators';
import { GROUPS } from '../../game/data/groups';
import { GROUP_SENSITIVITY } from '../../game/data/groupSensitivity';
import {
  AREA_TITULO,
  AREAS_NO_PAINEL,
  formatarValorIndicador,
  formatarDeltaIndicador,
  tomDaVariacao,
} from '../../utils/format';
import styles from './styles.module.css';

function calcularImpactoFiscal(ind: IndicatorDef, valorAtual: number, valorInicial: number) {
  const delta = valorAtual - valorInicial;
  if (Math.abs(delta) < 0.0001) return null;

  if (ind.id === 'iva') {
    const ivaDiff = delta / 26.5;
    const lafferFactor = 1 - Math.max(0, ivaDiff * 0.35);
    const bi = 1300 * ivaDiff * lafferFactor;
    return { tipo: bi > 0 ? 'arrecadacao' : 'perda', valorBi: Math.abs(bi), rotulo: bi > 0 ? `+R$ ${bi.toFixed(1)} bi/ano em arrecadação` : `-R$ ${Math.abs(bi).toFixed(1)} bi/ano em arrecadação` };
  }
  if (ind.id === 'imposto_renda') {
    const irDiff = delta / 27.5;
    const lafferFactor = 1 - Math.max(0, irDiff * 0.25);
    const bi = 550 * irDiff * lafferFactor;
    return { tipo: bi > 0 ? 'arrecadacao' : 'perda', valorBi: Math.abs(bi), rotulo: bi > 0 ? `+R$ ${bi.toFixed(1)} bi/ano em arrecadação` : `-R$ ${Math.abs(bi).toFixed(1)} bi/ano em arrecadação` };
  }
  if (ind.id === 'imposto_empresas') {
    const empDiff = delta / 34.0;
    const lafferFactor = 1 - Math.max(0, empDiff * 0.4);
    const bi = 600 * empDiff * lafferFactor;
    return { tipo: bi > 0 ? 'arrecadacao' : 'perda', valorBi: Math.abs(bi), rotulo: bi > 0 ? `+R$ ${bi.toFixed(1)} bi/ano em arrecadação` : `-R$ ${Math.abs(bi).toFixed(1)} bi/ano em arrecadação` };
  }

  if (ind.formatKind === 'currency_year') {
    const bi = delta / 1e9;
    return { tipo: bi > 0 ? 'custo' : 'economia', valorBi: Math.abs(bi), rotulo: bi > 0 ? `Custo de R$ ${bi.toFixed(1)} bi/ano` : `Economia de R$ ${Math.abs(bi).toFixed(1)} bi/ano` };
  }

  if (ind.id === 'salarios_saude') {
    const bi = (delta * 12 * 500e3) / 1e9;
    return { tipo: bi > 0 ? 'custo' : 'economia', valorBi: Math.abs(bi), rotulo: bi > 0 ? `Custo de R$ ${bi.toFixed(1)} bi/ano` : `Economia de R$ ${Math.abs(bi).toFixed(1)} bi/ano` };
  }
  if (ind.id === 'salarios_professores') {
    const bi = (delta * 12 * 400e3) / 1e9;
    return { tipo: bi > 0 ? 'custo' : 'economia', valorBi: Math.abs(bi), rotulo: bi > 0 ? `Custo de R$ ${bi.toFixed(1)} bi/ano` : `Economia de R$ ${Math.abs(bi).toFixed(1)} bi/ano` };
  }
  if (ind.id === 'bolsa_familia') {
    const bi = (delta * 12 * 21e6) / 1e9;
    return { tipo: bi > 0 ? 'custo' : 'economia', valorBi: Math.abs(bi), rotulo: bi > 0 ? `Custo de R$ ${bi.toFixed(1)} bi/ano` : `Economia de R$ ${Math.abs(bi).toFixed(1)} bi/ano` };
  }

  return null;
}

function obterGruposAfetados(indicatorId: string, delta: number) {
  const grupos: Array<{ id: string; nome: string; impacto: 'favoravel' | 'desfavoravel' | 'neutro'; intensidade: string }> = [];

  for (const [groupId, sensMap] of Object.entries(GROUP_SENSITIVITY)) {
    const sens = sensMap[indicatorId];
    if (sens !== undefined && sens !== 0) {
      const g = GROUPS.find((group) => group.id === groupId);
      if (!g) continue;

      const efeito = sens * delta;
      let impacto: 'favoravel' | 'desfavoravel' | 'neutro' = 'neutro';
      if (efeito > 0.05) impacto = 'favoravel';
      else if (efeito < -0.05) impacto = 'desfavoravel';

      if (impacto !== 'neutro') {
        grupos.push({
          id: g.id,
          nome: g.nome,
          impacto,
          intensidade: Math.abs(efeito) > 1.0 ? 'Forte' : 'Moderada',
        });
      }
    }
  }

  return grupos;
}

export function Politicas() {
  const game = useGameStore((state) => state.game);
  const applyIndicatorChange = useGameStore((state) => state.applyIndicatorChange);
  const lastError = useGameStore((state) => state.lastError);
  const previousMonth = game?.history.at(-1);
  const [activeTab, setActiveTab] = useState<IndicatorCategory | 'grupos'>('economia');
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  if (!game) return null;

  const currentMonthIdx = (game.year - 2026) * 12 + (game.month - 1);
  const hasUsedMonthlyChange = game.lastModifiedIndicatorMonth === currentMonthIdx;

  // ── Separa as duas listas por tipo ──
  const categoryIndicators = INDICATORS.filter(
    (ind) => ind.category === activeTab,
  );
  const calculatedList = categoryIndicators.filter((ind) => ind.type !== 'slider');
  const sliderList = categoryIndicators.filter((ind) => ind.type === 'slider');

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

  // ── Renderiza um card Calculado (read-only) ──
  const renderCalculatedCard = (metric: IndicatorDef) => {
    const value = game.nationalIndicators[metric.id] ?? metric.initial;
    const prevValue = previousMonth?.national?.[metric.id];
    const delta =
      value !== undefined && prevValue !== undefined ? value - prevValue : null;
    const tom = tomDaVariacao(metric, delta);

    return (
      <article
        key={metric.id}
        className={`${styles.item} ${styles.calculatedCard}`}
      >
        <div className={styles.itemHeader}>
          <span className={styles.typeTag} data-type={metric.type}>
            Calculado
          </span>
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
            ? 'Base inicial'
            : `${formatarDeltaIndicador(metric, delta)} vs. mês anterior`}
        </span>
      </article>
    );
  };

  // ── Renderiza um card Slider (editável) ──
  const renderSliderCard = (metric: IndicatorDef) => {
    const appliedValue = game.nationalIndicators[metric.id] ?? metric.initial;
    const currentDraft = draftValues[metric.id];
    const displayValue =
      currentDraft !== undefined ? currentDraft : appliedValue;

    const prevValue = previousMonth?.national?.[metric.id];
    const delta =
      appliedValue !== undefined && prevValue !== undefined
        ? appliedValue - prevValue
        : null;
    const tom = tomDaVariacao(metric, delta);

    const isDraftModified =
      currentDraft !== undefined &&
      Math.abs(currentDraft - appliedValue) > 0.0001;
    const fiscalImpact = calcularImpactoFiscal(metric, displayValue, appliedValue);
    const gruposAfetados = obterGruposAfetados(
      metric.id,
      displayValue - appliedValue,
    );

    return (
      <article
        key={metric.id}
        className={`${styles.item} ${styles.sliderCard}`}
      >
        <div className={styles.itemHeader}>
          <span className={styles.typeTag} data-type={metric.type}>
            Slider interativo
          </span>
          <span className={styles.value}>
            {formatarValorIndicador(metric, displayValue)}
          </span>
        </div>

        <h3 className={styles.label}>{metric.nome}</h3>
        <p className={styles.metricDesc}>{metric.descricao}</p>

        <div className={styles.sliderControlContainer}>
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
              title={
                hasUsedMonthlyChange
                  ? 'Você já alterou uma medida este mês.'
                  : !isDraftModified
                    ? 'Arraste o slider para alterar o valor antes de aplicar.'
                    : 'Aplicar esta alteração de política'
              }
              onClick={() =>
                handleApplyChange(metric.id, displayValue, metric.nome)
              }
            >
              {hasUsedMonthlyChange
                ? '🔒 Limite Mensal Atingido'
                : '✓ Aplicar Medida'}
            </button>
            {isDraftModified && (
              <button
                type="button"
                className={styles.cancelDraftBtn}
                onClick={() => handleResetDraft(metric.id)}
                title="Restaurar valor atual"
              >
                ✕ Cancelar
              </button>
            )}
          </div>
        </div>

        {fiscalImpact && (
          <div
            className={styles.fiscalImpactBadge}
            data-tipo={fiscalImpact.tipo}
          >
            <span className={styles.fiscalImpactDot} />
            <strong>{fiscalImpact.rotulo}</strong>
          </div>
        )}

        {gruposAfetados.length > 0 && (
          <div className={styles.affectedGroupsContainer}>
            <span className={styles.affectedTitle}>
              Reação dos Grupos (
              {isDraftModified ? 'Simulação da Medida' : 'Impacto vs. Base'}):
            </span>
            <div className={styles.groupChips}>
              {gruposAfetados.map((g) => (
                <span
                  key={g.id}
                  className={styles.groupChip}
                  data-impacto={g.impacto}
                  title={`${g.nome}: impacto ${g.impacto} (${g.intensidade})`}
                >
                  {g.impacto === 'favoravel' ? '▲' : '▼'} {g.nome}
                </span>
              ))}
            </div>
          </div>
        )}

        <span
          className={styles.trend}
          data-direction={delta === null ? 'neutral' : tom}
          title={delta === null ? 'Primeiro mês' : 'Variação vs. mês anterior'}
        >
          {delta === null
            ? 'Base inicial'
            : `${formatarDeltaIndicador(metric, delta)} vs. mês anterior`}
        </span>
      </article>
    );
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
              <strong>Limite de 1 alteração por mês.</strong> Ajuste o slider
              para pré-visualizar o impacto fiscal e as reações dos grupos antes
              de aplicar.
            </p>
          </div>
          <div className={styles.topBarRight}>
            <div
              className={styles.monthlyQuotaBadge}
              data-blocked={hasUsedMonthlyChange}
            >
              <span>Ação do Mês: </span>
              <strong>
                {hasUsedMonthlyChange
                  ? '⚠️ 1/1 Utilizada (Aguarde o próximo mês)'
                  : '✅ 0/1 Disponível'}
              </strong>
            </div>
            <div className={styles.quickFiscalBadge}>
              <span>Saldo Orçamentário Atual: </span>
              <strong
                data-positive={game.nationalIndicators.saldo_orcamentario >= 0}
              >
                R${' '}
                {(game.nationalIndicators.saldo_orcamentario / 1e9).toFixed(1)}{' '}
                bi/ano
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
                const prevApproval =
                  previousMonth?.groupApprovals?.[group.id];
                const delta =
                  prevApproval !== undefined
                    ? approval - prevApproval
                    : null;

                return (
                  <article key={group.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <span
                        className={styles.groupBadge}
                        data-cat={group.categoria}
                      >
                        {group.categoria}
                      </span>
                      <span
                        className={styles.groupInfluence}
                        title="Influência Política"
                      >
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
              {/* ═══════ BLOCO 1 — Indicadores Calculados ═══════ */}
              {calculatedList.length > 0 && (
                <section className={styles.block}>
                  <header className={styles.blockHeader}>
                    <div>
                      <h2 className={styles.blockTitle}>
                        Indicadores Calculados
                      </h2>
                      <p className={styles.blockSubtitle}>
                        Derivados das suas escolhas. Somente leitura.
                      </p>
                    </div>
                    <span className={styles.blockCount}>
                      {calculatedList.length}{' '}
                      {calculatedList.length === 1 ? 'item' : 'itens'}
                    </span>
                  </header>
                  <div className={styles.indicatorsGrid}>
                    {calculatedList.map(renderCalculatedCard)}
                  </div>
                </section>
              )}

              {/* ═══════ BLOCO 2 — Indicadores Interativos ═══════ */}
              {sliderList.length > 0 && (
                <section className={styles.block}>
                  <header className={styles.blockHeader}>
                    <div>
                      <h2 className={styles.blockTitle}>
                        Ajustes Interativos
                      </h2>
                      <p className={styles.blockSubtitle}>
                        Arraste o slider e aplique — limite de 1 por mês.
                      </p>
                    </div>
                    <span className={styles.blockCount}>
                      {sliderList.length}{' '}
                      {sliderList.length === 1 ? 'item' : 'itens'}
                    </span>
                  </header>
                  <div className={styles.indicatorsGrid}>
                    {sliderList.map(renderSliderCard)}
                  </div>
                </section>
              )}

              {calculatedList.length === 0 && sliderList.length === 0 && (
                <p className={styles.empty}>
                  Nenhum indicador nesta área.
                </p>
              )}
            </>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}