// src/screens/pais/index.tsx

import { memo, useMemo, useState } from 'react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { useGameStore } from '../../store/gameStore';
import { INDICATORS, type IndicatorDef, type IndicatorCategory } from '../../game/data/indicators';
import { GROUPS } from '../../game/data/groups';
import {
  AREA_TITULO,
  AREAS_NO_PAINEL,
  formatarValorIndicador,
  formatarDeltaIndicador,
  tomDaVariacao,
} from '../../utils/format';
import styles from './styles.module.css';

type Game = NonNullable<ReturnType<typeof useGameStore.getState>['game']>;
type StatusFilter = 'todos' | 'alta' | 'baixa' | 'estavel';

/* ═══════════════════════════════════════════════════════════════
   PALETA — rank de aprovação
   ═══════════════════════════════════════════════════════════════ */

const GROUP_COLORS = [
  '#22c55e', '#4ade80', '#86efac', '#16a34a',
  '#facc15', '#fde047', '#fef08a', '#eab308',
  '#3b82f6', '#60a5fa', '#93c5fd', '#2563eb',
];

/* ═══════════════════════════════════════════════════════════════
   SPARKLINE — mini gráfico no card
   ═══════════════════════════════════════════════════════════════ */

interface SparklineProps {
  values: (number | undefined | null)[];
  stroke: string;
  width?: number;
  height?: number;
}

function Sparkline({ values, stroke, width = 120, height = 28 }: SparklineProps) {
  const numeric = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (numeric.length < 2) return null;

  const lo = Math.min(...numeric);
  const hi = Math.max(...numeric);
  const span = hi - lo || 1;
  const PAD = 2;

  const xAt = (i: number) => (i / (values.length - 1)) * width;
  const yAt = (v: number) =>
    PAD + (height - PAD * 2) - ((v - lo) / span) * (height - PAD * 2);

  const points = values
    .map((v, i) =>
      typeof v === 'number' && Number.isFinite(v)
        ? `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`
        : null,
    )
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LINE CHART — detalhe
   ═══════════════════════════════════════════════════════════════ */

interface LineChartProps {
  values: (number | undefined | null)[];
  width?: number;
  height?: number;
  stroke?: string;
  tooltip?: (value: number | undefined | null, index: number) => string;
  yFormatter?: (value: number) => string;
  yMin?: number;
  yMax?: number;
  showZeroLine?: boolean;
  currentLabel?: string;
}

function LineChart({
  values,
  width = 720,
  height = 220,
  stroke = 'var(--green-500, #22c55e)',
  tooltip,
  yFormatter = (v) => v.toFixed(1),
  yMin,
  yMax,
  showZeroLine = false,
  currentLabel,
}: LineChartProps) {
  const PAD = { top: 24, right: 20, bottom: 32, left: 52 };
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const numeric = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (numeric.length === 0) {
    return (
      <div className={styles.chartEmpty} style={{ height }}>
        Sem dados suficientes para o gráfico.
      </div>
    );
  }

  const dataMin = Math.min(...numeric);
  const dataMax = Math.max(...numeric);
  const lo = yMin !== undefined ? yMin : Math.min(dataMin, showZeroLine ? 0 : dataMin);
  const hi = yMax !== undefined ? yMax : Math.max(dataMax, showZeroLine ? 0 : dataMax);
  const span = hi - lo || 1;

  const xAt = (i: number) =>
    values.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (values.length - 1)) * innerW;
  const yAt = (v: number) => PAD.top + innerH - ((v - lo) / span) * innerH;

  const points = values
    .map((v, i) =>
      typeof v === 'number' && Number.isFinite(v)
        ? { x: xAt(i), y: yAt(v), v, i }
        : null,
    )
    .filter((p): p is { x: number; y: number; v: number; i: number } => p !== null);

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(
          PAD.top + innerH
        ).toFixed(2)} L ${points[0].x.toFixed(2)} ${(
          PAD.top + innerH
        ).toFixed(2)} Z`
      : '';

  const yTicks = Array.from({ length: 5 }, (_, i) => lo + (span / 4) * i);
  const xStep = Math.max(1, Math.ceil(values.length / 8));
  const xTicks = values
    .map((_, i) => i)
    .filter((i) => i === 0 || i === values.length - 1 || i % xStep === 0);

  const last = points[points.length - 1];

  return (
    <svg
      className={styles.lineChart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Gráfico de histórico"
    >
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => {
        const y = yAt(t);
        return (
          <g key={`y-${i}`}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y}
              y2={y}
              className={styles.chartGrid}
            />
            <text x={PAD.left - 8} y={y + 3} className={styles.chartYLabel}>
              {yFormatter(t)}
            </text>
          </g>
        );
      })}

      {showZeroLine && lo < 0 && hi > 0 && (
        <line
          x1={PAD.left}
          x2={PAD.left + innerW}
          y1={yAt(0)}
          y2={yAt(0)}
          className={styles.chartZeroLine}
        />
      )}

      {areaPath && <path d={areaPath} fill="url(#lc-fill)" />}

      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={styles.chartLine}
        />
      )}

      {points.map((p) => (
        <g key={p.i} className={styles.chartPointGroup}>
          <circle cx={p.x} cy={p.y} r={8} className={styles.chartPointHit}>
            <title>
              {tooltip ? tooltip(p.v, p.i) : `Mês ${p.i + 1}: ${yFormatter(p.v)}`}
            </title>
          </circle>
          <circle
            cx={p.x}
            cy={p.y}
            r={3}
            className={styles.chartPoint}
            style={{ stroke }}
          />
        </g>
      ))}

      {last && (
        <>
          <circle
            cx={last.x}
            cy={last.y}
            r={6}
            className={styles.chartPointPulse}
            style={{ stroke }}
          />
          <circle
            cx={last.x}
            cy={last.y}
            r={4}
            className={styles.chartPointLast}
            style={{ fill: stroke }}
          />
          {currentLabel && (
            <text
              x={last.x}
              y={last.y - 14}
              textAnchor="middle"
              className={styles.chartCurrentLabel}
            >
              {currentLabel}
            </text>
          )}
        </>
      )}

      {xTicks.map((i) => (
        <text
          key={`x-${i}`}
          x={xAt(i)}
          y={PAD.top + innerH + 20}
          textAnchor="middle"
          className={styles.chartXLabel}
        >
          M{i + 1}
        </text>
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MULTI LINE CHART — grupos
   ═══════════════════════════════════════════════════════════════ */

interface Series {
  id: string;
  name: string;
  color: string;
  values: number[];
  currentValue: number;
  rank: number;
}

function MultiLineChart({
  series,
  hoveredId = null,
  width = 900,
  height = 220,
  yMin = 0,
  yMax = 100,
  yFormatter = (v) => `${v.toFixed(0)}%`,
}: {
  series: Series[];
  hoveredId?: string | null;
  width?: number;
  height?: number;
  yMin?: number;
  yMax?: number;
  yFormatter?: (v: number) => string;
}) {
  const PAD = { top: 20, right: 24, bottom: 36, left: 52 };
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const span = yMax - yMin || 1;
  const maxLen = Math.max(...series.map((s) => s.values.length), 1);

  const xAt = (i: number) =>
    maxLen === 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (maxLen - 1)) * innerW;
  const yAt = (v: number) => PAD.top + innerH - ((v - yMin) / span) * innerH;

  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + (span / 5) * i);
  const xStep = Math.max(1, Math.ceil(maxLen / 10));
  const xTicks = Array.from({ length: maxLen }, (_, i) => i).filter(
    (i) => i === 0 || i === maxLen - 1 || i % xStep === 0,
  );

  const anyHovered = hoveredId !== null;
  const isDimmed = (id: string) => anyHovered && hoveredId !== id;
  const isHighlighted = (id: string) => anyHovered && hoveredId === id;

  return (
    <svg
      className={styles.multiChart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Evolução da aprovação por grupo social"
    >
      {yTicks.map((t, i) => (
        <g key={`y-${i}`}>
          <line
            x1={PAD.left}
            x2={PAD.left + innerW}
            y1={yAt(t)}
            y2={yAt(t)}
            className={styles.chartGrid}
          />
          <text
            x={PAD.left - 10}
            y={yAt(t) + 3}
            className={styles.chartYLabel}
          >
            {yFormatter(t)}
          </text>
        </g>
      ))}

      {xTicks.map((i) => (
        <text
          key={`x-${i}`}
          x={xAt(i)}
          y={PAD.top + innerH + 20}
          textAnchor="middle"
          className={styles.chartXLabel}
        >
          M{i + 1}
        </text>
      ))}

      {series.map((s) => {
        const points = s.values
          .map((v, i) =>
            typeof v === 'number' && Number.isFinite(v)
              ? { x: xAt(i), y: yAt(v), v, i }
              : null,
          )
          .filter(
            (p): p is { x: number; y: number; v: number; i: number } => p !== null,
          );

        if (points.length === 0) return null;

        const path = points
          .map(
            (p, idx) =>
              `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
          )
          .join(' ');

        const last = points[points.length - 1];
        const dimmed = isDimmed(s.id);
        const highlighted = isHighlighted(s.id);

        return (
          <g
            key={s.id}
            className={styles.multiLineGroup}
            data-dimmed={dimmed ? 'true' : undefined}
            data-highlighted={highlighted ? 'true' : undefined}
            style={{ '--line-color': s.color } as React.CSSProperties}
          >
            <path
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={highlighted ? 2.5 : 1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={styles.multiLinePath}
            >
              <title>{s.name}</title>
            </path>

            <circle
              cx={last.x}
              cy={last.y}
              r={highlighted ? 4.5 : 3}
              fill={s.color}
              stroke={highlighted ? '#ffffff' : 'transparent'}
              strokeWidth={1.5}
              className={styles.multiLinePoint}
            >
              <title>
                {`${s.name} · Mês ${last.i + 1}: ${last.v.toFixed(1)}%`}
              </title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INDICATOR CARD — compacto, memoizado
   ═══════════════════════════════════════════════════════════════ */

interface IndicatorCardProps {
  metric: IndicatorDef;
  value: number | undefined;
  prevValue: number | undefined;
  history: (number | undefined)[];
  onClick: (metric: IndicatorDef) => void;
}

const IndicatorCard = memo(function IndicatorCard({
  metric,
  value,
  prevValue,
  history,
  onClick,
}: IndicatorCardProps) {
  const delta =
    value !== undefined && prevValue !== undefined ? value - prevValue : null;
  const tom = tomDaVariacao(metric, delta);
  const formatted = formatarValorIndicador(metric, value);

  const isBudget = metric.id === 'saldo_orcamentario';
  const sparkColor =
    tom === 'good'
      ? 'var(--green-400, #4ade80)'
      : tom === 'bad'
        ? 'var(--red-400, #f87171)'
        : isBudget
          ? 'var(--yellow-400, #fde047)'
          : 'var(--blue-400, #60a5fa)';

  return (
    <button
      type="button"
      className={styles.indicatorCard}
      onClick={() => onClick(metric)}
      data-tone={tom}
    >
      <span className={styles.indicatorCardValue}>{formatted}</span>
      <span className={styles.indicatorCardName}>{metric.nome}</span>
      <span className={styles.indicatorCardDelta} data-direction={tom}>
        {delta === null ? 'Base inicial' : formatarDeltaIndicador(metric, delta)}
      </span>
      <Sparkline values={history} stroke={sparkColor} />
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   INDICATOR DRAWER — painel lateral com detalhes
   ═══════════════════════════════════════════════════════════════ */

const HISTORY_LIMIT = 12;

function IndicatorDrawer({
  metric,
  game,
  onClose,
}: {
  metric: IndicatorDef;
  game: Game;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const current = game.nationalIndicators[metric.id];
  const historyValues = game.history.map((h) => h.national?.[metric.id]);
  const fullHistory: (number | undefined)[] = [...historyValues, current];

  const prevValue = game.history.at(-1)?.national?.[metric.id];
  const delta =
    current !== undefined && prevValue !== undefined ? current - prevValue : null;
  const tom = tomDaVariacao(metric, delta);

  const isBudget = metric.id === 'saldo_orcamentario';

  const rows = fullHistory.map((val, i) => ({ val, i }));
  const visibleRows = showAll ? rows : rows.slice(-HISTORY_LIMIT);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-label={`Detalhes de ${metric.nome}`}
      >
        <header className={styles.drawerHeader}>
          <div className={styles.drawerHeaderMain}>
            <span className={styles.drawerCategory}>
              {AREA_TITULO[metric.category] ?? metric.category}
            </span>
            <h2 className={styles.drawerTitle}>{metric.nome}</h2>
          </div>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <div className={styles.drawerBody}>
          <div className={styles.drawerValueBlock}>
            <span className={styles.drawerValue}>
              {formatarValorIndicador(metric, current)}
            </span>
            {delta !== null && (
              <span className={styles.drawerDelta} data-direction={tom}>
                {formatarDeltaIndicador(metric, delta)} vs. mês anterior
              </span>
            )}
          </div>

          <p className={styles.drawerDesc}>{metric.descricao}</p>

          <div className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>Histórico</h3>
            <div className={styles.chartWrap}>
              <LineChart
                values={fullHistory}
                stroke={
                  isBudget
                    ? 'var(--yellow-500, #facc15)'
                    : 'var(--green-500, #22c55e)'
                }
                tooltip={(v) =>
                  v !== undefined && v !== null
                    ? formatarValorIndicador(metric, v)
                    : 'Sem dado'
                }
                yFormatter={(v) =>
                  Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(1)
                }
                showZeroLine={isBudget}
                currentLabel={
                  current !== undefined
                    ? formatarValorIndicador(metric, current)
                    : undefined
                }
              />
            </div>
          </div>

          <div className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>
              Tabela de histórico
              {!showAll && hiddenCount > 0 && (
                <span className={styles.drawerSectionHint}>
                  últimos {HISTORY_LIMIT} de {rows.length}
                </span>
              )}
            </h3>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Valor</th>
                  <th>Variação</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ val, i }) => {
                  const prev = i > 0 ? fullHistory[i - 1] : null;
                  const diff =
                    val !== undefined &&
                    val !== null &&
                    prev !== undefined &&
                    prev !== null
                      ? val - prev
                      : null;
                  const diffTom =
                    diff !== null ? tomDaVariacao(metric, diff) : 'neutral';

                  return (
                    <tr key={i}>
                      <td className={styles.tableMonth}>Mês {i + 1}</td>
                      <td className={styles.tableValue}>
                        {val !== undefined && val !== null
                          ? formatarValorIndicador(metric, val)
                          : '—'}
                      </td>
                      <td>
                        {diff !== null ? (
                          <span
                            className={styles.tableDelta}
                            data-direction={diffTom}
                          >
                            {formatarDeltaIndicador(metric, diff)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!showAll && hiddenCount > 0 && (
              <button
                type="button"
                className={styles.showMoreBtn}
                onClick={() => setShowAll(true)}
              >
                Ver todos os {rows.length} meses
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GROUPS VIEW
   ═══════════════════════════════════════════════════════════════ */

function GroupsView({ game }: { game: Game }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const rawSeries = GROUPS.map((g) => {
    const approval = game.groupApprovals[g.id] ?? g.initialApproval ?? 50;
    const history = game.history.map(
      (h) => h.groupApprovals?.[g.id] ?? approval,
    );
    return {
      id: g.id,
      name: g.nome,
      values: [...history, approval],
      currentValue: approval,
    };
  });

  const sorted = [...rawSeries].sort((a, b) => b.currentValue - a.currentValue);

  const series: Series[] = sorted.map((s, idx) => ({
    ...s,
    rank: idx + 1,
    color: GROUP_COLORS[idx % GROUP_COLORS.length],
  }));

  return (
    <div className={styles.groupsView}>
      <header className={styles.groupsHeader}>
        <div>
          <h2 className={styles.groupsTitle}>Evolução por Grupo</h2>
          <p className={styles.groupsSubtitle}>
            Ordenado do mais aprovado ao menos aprovado.
          </p>
        </div>
        <span className={styles.groupsCount}>{GROUPS.length} grupos</span>
      </header>

      <div className={styles.groupsBody}>
        <aside className={styles.groupsLegend} aria-label="Legenda">
          {series.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.legendItem}
              data-hovered={hovered === s.id}
              data-top={s.rank <= 4 ? 'true' : undefined}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(s.id)}
              onBlur={() => setHovered(null)}
            >
              <span className={styles.legendRank}>{s.rank}</span>
              <span
                className={styles.legendSwatch}
                style={{ background: s.color }}
              />
              <span className={styles.legendName}>{s.name}</span>
              <span className={styles.legendValue} style={{ color: s.color }}>
                {s.currentValue.toFixed(1)}%
              </span>
            </button>
          ))}
        </aside>

        <div className={styles.multiChartWrap}>
          <MultiLineChart series={series} hoveredId={hovered} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA
   ═══════════════════════════════════════════════════════════════ */

export function Pais() {
  const game = useGameStore((state) => state.game);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const selectedMetric =
    selectedMetricId !== null
      ? INDICATORS.find((m) => m.id === selectedMetricId) ?? null
      : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      activeTab === 'overview'
        ? INDICATORS
        : INDICATORS.filter((m) => m.category === activeTab);

    return base.filter((m) => {
      if (q && !m.nome.toLowerCase().includes(q)) return false;

      if (statusFilter === 'todos') return true;
      const value = game?.nationalIndicators[m.id];
      const prev = game?.history.at(-1)?.national?.[m.id];
      if (value === undefined || prev === undefined) return false;
      const delta = value - prev;
      if (Math.abs(delta) < 0.001) return statusFilter === 'estavel';
      const tom = tomDaVariacao(m, delta);
      if (statusFilter === 'alta') return tom === 'good';
      if (statusFilter === 'baixa') return tom === 'bad';
      return false;
    });
  }, [activeTab, query, statusFilter, game]);

  const grouped = useMemo(() => {
    if (activeTab !== 'overview') return null;
    const map = new Map<IndicatorCategory, IndicatorDef[]>();
    for (const m of filtered) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return map;
  }, [filtered, activeTab]);

  if (!game) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedMetricId(null);
    setQuery('');
    setStatusFilter('todos');
  };

  const handleCardClick = (metric: IndicatorDef) => {
    setSelectedMetricId(metric.id);
  };

  const historyFor = (metricId: string): (number | undefined)[] => {
    const historic = game.history.map((h) => h.national?.[metricId]);
    return [...historic, game.nationalIndicators[metricId]];
  };

  const renderCard = (metric: IndicatorDef) => (
    <IndicatorCard
      key={metric.id}
      metric={metric}
      value={game.nationalIndicators[metric.id]}
      prevValue={game.history.at(-1)?.national?.[metric.id]}
      history={historyFor(metric.id)}
      onClick={handleCardClick}
    />
  );

  const isGroupsTab = activeTab === 'grupos';
  const showToolbar = !isGroupsTab;

  return (
    <div className={styles.container}>
      <Header />
      <section className={styles.panel} aria-label="Estatísticas do país">
        <nav className={styles.tabs} aria-label="Navegação por áreas">
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('overview')}
          >
            Todos
          </button>
          {AREAS_NO_PAINEL.map((area) => (
            <button
              key={area}
              type="button"
              className={`${styles.tabBtn} ${activeTab === area ? styles.activeTab : ''}`}
              onClick={() => handleTabChange(area)}
            >
              {AREA_TITULO[area]}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.tabBtn} ${styles.groupsTab} ${activeTab === 'grupos' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('grupos')}
          >
            👥 Grupos
          </button>
        </nav>

        {showToolbar && (
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon} aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                className={styles.searchInput}
                placeholder={`Buscar entre ${INDICATORS.length} atributos...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setQuery('')}
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>
            <div className={styles.filterPills} role="tablist" aria-label="Filtro por status">
              {(
                [
                  ['todos', 'Todos'],
                  ['alta', 'Em alta'],
                  ['baixa', 'Em baixa'],
                  ['estavel', 'Estáveis'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={styles.filterPill}
                  data-active={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className={styles.resultCount}>
              {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
            </span>
          </div>
        )}

        <div className={styles.panelContent}>
          {isGroupsTab ? (
            <GroupsView game={game} />
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhum atributo corresponde ao filtro.</p>
              <button
                type="button"
                className={styles.emptyReset}
                onClick={() => {
                  setQuery('');
                  setStatusFilter('todos');
                }}
              >
                Limpar filtros
              </button>
            </div>
          ) : grouped ? (
            Array.from(grouped.entries()).map(([cat, items]) => (
              <section key={cat} className={styles.groupSection}>
                <header className={styles.groupSectionHeader}>
                  <h2 className={styles.groupSectionTitle}>
                    {AREA_TITULO[cat] ?? cat}
                  </h2>
                  <span className={styles.groupSectionCount}>
                    {items.length}
                  </span>
                </header>
                <div className={styles.cardsGrid}>
                  {items.map(renderCard)}
                </div>
              </section>
            ))
          ) : (
            <div className={styles.cardsGrid}>
              {filtered.map(renderCard)}
            </div>
          )}
        </div>
      </section>

      {selectedMetric && (
        <IndicatorDrawer
          metric={selectedMetric}
          game={game}
          onClose={() => setSelectedMetricId(null)}
        />
      )}

      <Footer />
    </div>
  );
}