// src/screens/pais/index.tsx

import { useState } from 'react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { useGameStore } from '../../store/gameStore';
import { INDICATORS, type IndicatorDef } from '../../game/data/indicators';
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
type GroupDef = (typeof GROUPS)[number];

/* ═══════════════════════════════════════════════════════════════
   LINE CHART — SVG puro, sem dependência
   ═══════════════════════════════════════════════════════════════ */

interface LineChartProps {
  values: (number | undefined | null)[];
  width?: number;
  height?: number;
  /** Cor da linha (default: verde) */
  stroke?: string;
  /** Rótulo de cada ponto no tooltip */
  tooltip?: (value: number | undefined | null, index: number) => string;
  /** Formata o rótulo do eixo Y */
  yFormatter?: (value: number) => string;
  /** Escala fixa de Y (ex: 0..100 para aprovação). Se omitido, auto. */
  yMin?: number;
  yMax?: number;
  /** Mostra a linha horizontal no zero */
  showZeroLine?: boolean;
  /** Unidade do ponto atual */
  currentLabel?: string;
}

function LineChart({
  values,
  width = 720,
  height = 260,
  stroke = 'var(--green-500)',
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

  // escala
  const xAt = (i: number) =>
    values.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (values.length - 1)) * innerW;
  const yAt = (v: number) =>
    PAD.top + innerH - ((v - lo) / span) * innerH;

  // pontos válidos
  const points = values
    .map((v, i) =>
      typeof v === 'number' && Number.isFinite(v)
        ? { x: xAt(i), y: yAt(v), v, i }
        : null,
    )
    .filter((p): p is { x: number; y: number; v: number; i: number } => p !== null);

  // caminho da linha
  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  // área preenchida (gradiente)
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(
          PAD.top + innerH
        ).toFixed(2)} L ${points[0].x.toFixed(2)} ${(
          PAD.top + innerH
        ).toFixed(2)} Z`
      : '';

  // ticks do eixo Y (5 linhas)
  const yTicks = Array.from({ length: 5 }, (_, i) => lo + (span / 4) * i);

  // ticks do eixo X (máx 8 labels pra não lotar)
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

      {/* grade horizontal */}
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

      {/* linha do zero (opcional) */}
      {showZeroLine && lo < 0 && hi > 0 && (
        <line
          x1={PAD.left}
          x2={PAD.left + innerW}
          y1={yAt(0)}
          y2={yAt(0)}
          className={styles.chartZeroLine}
        />
      )}

      {/* área preenchida */}
      {areaPath && (
        <path d={areaPath} fill="url(#lc-fill)" />
      )}

      {/* linha */}
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

      {/* pontos */}
      {points.map((p) => (
        <g key={p.i} className={styles.chartPointGroup}>
          <circle
            cx={p.x}
            cy={p.y}
            r={8}
            className={styles.chartPointHit}
          >
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

      {/* ponto atual (destaque) */}
      {last && (
        <>
          <circle
            cx={last.x}
            cy={last.y}
            r={6}
            className={styles.chartPointPulse}
            style={{ stroke }}
          />
          <circle cx={last.x} cy={last.y} r={4} className={styles.chartPointLast} style={{ fill: stroke }} />
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

      {/* labels eixo X */}
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
   PÁGINA
   ═══════════════════════════════════════════════════════════════ */

export function Pais() {
  const game = useGameStore((state) => state.game);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!game) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedId(null);
  };

  const listItems =
    activeTab === 'grupos'
      ? GROUPS.map((g) => ({ type: 'group' as const, item: g }))
      : activeTab === 'overview'
        ? INDICATORS.map((m) => ({ type: 'indicator' as const, item: m }))
        : INDICATORS.filter((m) => m.category === activeTab).map((m) => ({
            type: 'indicator' as const,
            item: m,
          }));

  const selectedGroup =
    activeTab === 'grupos' && selectedId
      ? GROUPS.find((g) => g.id === selectedId) ?? null
      : null;

  const selectedIndicator =
    activeTab !== 'grupos' && selectedId
      ? INDICATORS.find((m) => m.id === selectedId) ?? null
      : null;

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
            Visão Geral
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

        <div className={styles.split}>
          <aside className={styles.listPane} aria-label="Atributos">
            {listItems.map((entry) => {
              if (entry.type === 'group') {
                const g = entry.item;
                const approval = game.groupApprovals[g.id] ?? g.initialApproval ?? 50;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={styles.listItem}
                    data-selected={selectedId === g.id}
                    onClick={() => setSelectedId(g.id)}
                  >
                    <div className={styles.listItemHeader}>
                      <span className={styles.listItemName}>{g.nome}</span>
                      <span className={styles.listItemValue}>
                        {approval.toFixed(1)}%
                      </span>
                    </div>
                    <div className={styles.listItemMeta}>
                      <span className={styles.listItemBadge} data-cat={g.categoria}>
                        {g.categoria}
                      </span>
                      <span className={styles.listItemSub}>Influência: {g.peso}</span>
                    </div>
                  </button>
                );
              }

              const m = entry.item;
              const value = game.nationalIndicators[m.id];
              const prevValue = game.history.at(-1)?.national?.[m.id];
              const delta =
                value !== undefined && prevValue !== undefined
                  ? value - prevValue
                  : null;
              const tom = tomDaVariacao(m, delta);

              return (
                <button
                  key={m.id}
                  type="button"
                  className={styles.listItem}
                  data-selected={selectedId === m.id}
                  onClick={() => setSelectedId(m.id)}
                >
                  <div className={styles.listItemHeader}>
                    <span className={styles.listItemName}>{m.nome}</span>
                    <span className={styles.listItemValue}>
                      {formatarValorIndicador(m, value)}
                    </span>
                  </div>
                  <div className={styles.listItemMeta}>
                    <span className={styles.listItemSub}>
                      {AREA_TITULO[m.category] ?? m.category}
                    </span>
                    {delta !== null && (
                      <span className={styles.listItemDelta} data-direction={tom}>
                        {formatarDeltaIndicador(m, delta)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </aside>

          <section className={styles.detailPane} aria-live="polite">
            {selectedGroup ? (
              <GroupDetail group={selectedGroup} game={game} />
            ) : selectedIndicator ? (
              <IndicatorDetail metric={selectedIndicator} game={game} />
            ) : (
              <div className={styles.emptyDetail}>
                <span className={styles.emptyDetailIcon} aria-hidden>
                  ◂
                </span>
                <p>Selecione um atributo à esquerda para ver o histórico.</p>
              </div>
            )}
          </section>
        </div>
      </section>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL — Indicador
   ═══════════════════════════════════════════════════════════════ */

function IndicatorDetail({ metric, game }: { metric: IndicatorDef; game: Game }) {
  const current = game.nationalIndicators[metric.id];
  const historyValues = game.history.map((h) => h.national?.[metric.id]);
  const fullHistory: (number | undefined)[] = [...historyValues, current];

  const prevValue = game.history.at(-1)?.national?.[metric.id];
  const delta =
    current !== undefined && prevValue !== undefined ? current - prevValue : null;
  const tom = tomDaVariacao(metric, delta);

  const isBudget = metric.id === 'saldo_orcamentario';

  return (
    <>
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderMain}>
          <h3 className={styles.detailTitle}>{metric.nome}</h3>
          <p className={styles.detailDesc}>{metric.descricao}</p>
        </div>
        <div className={styles.detailValueBox}>
          <span className={styles.detailValueNumber}>
            {formatarValorIndicador(metric, current)}
          </span>
          {delta !== null && (
            <span className={styles.detailDelta} data-direction={tom}>
              {formatarDeltaIndicador(metric, delta)} vs. mês anterior
            </span>
          )}
        </div>
      </header>

      <div className={styles.section}>
        <h4 className={styles.subheading}>Histórico</h4>
        <div className={styles.chartWrap}>
          <LineChart
            values={fullHistory}
            stroke={isBudget ? 'var(--yellow-500)' : 'var(--green-500)'}
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

      <div className={styles.section}>
        <h4 className={styles.subheading}>Tabela de histórico</h4>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Valor</th>
              <th>Variação</th>
            </tr>
          </thead>
          <tbody>
            {fullHistory.map((val, i) => {
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
                      <span className={styles.tableDelta} data-direction={diffTom}>
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
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL — Grupo
   ═══════════════════════════════════════════════════════════════ */

function GroupDetail({ group, game }: { group: GroupDef; game: Game }) {
  const approval = game.groupApprovals[group.id] ?? group.initialApproval ?? 50;
  const historyValues = game.history.map(
    (h) => h.groupApprovals?.[group.id] ?? approval,
  );
  const fullHistory: number[] = [...historyValues, approval];

  const prev = fullHistory.length > 1 ? fullHistory[fullHistory.length - 2] : null;
  const delta = prev !== null ? approval - prev : null;

  return (
    <>
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderMain}>
          <h3 className={styles.detailTitle}>{group.nome}</h3>
          <p className={styles.detailDesc}>{group.descricao}</p>
          <div className={styles.detailBadgeRow}>
            <span className={styles.listItemBadge} data-cat={group.categoria}>
              {group.categoria}
            </span>
            <span className={styles.detailInfluence}>Influência: {group.peso}</span>
          </div>
        </div>
        <div className={styles.detailValueBox}>
          <span className={styles.detailValueNumber}>{approval.toFixed(1)}%</span>
          {delta !== null && Math.abs(delta) >= 0.05 && (
            <span
              className={styles.detailDelta}
              data-direction={delta > 0 ? 'good' : 'bad'}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} p.p.
            </span>
          )}
        </div>
      </header>

      <div className={styles.section}>
        <h4 className={styles.subheading}>Histórico de aprovação</h4>
        <div className={styles.chartWrap}>
          <LineChart
            values={fullHistory}
            stroke="var(--green-500)"
            yMin={0}
            yMax={100}
            tooltip={(v) =>
              v !== undefined && v !== null
                ? `${v.toFixed(1)}% de aprovação`
                : 'Sem dado'
            }
            yFormatter={(v) => `${v.toFixed(0)}%`}
            currentLabel={`${approval.toFixed(1)}%`}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.subheading}>Tabela de histórico</h4>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Aprovação</th>
              <th>Variação</th>
            </tr>
          </thead>
          <tbody>
            {fullHistory.map((val, i) => {
              const p = i > 0 ? fullHistory[i - 1] : null;
              const d = p !== null ? val - p : null;
              return (
                <tr key={i}>
                  <td className={styles.tableMonth}>Mês {i + 1}</td>
                  <td className={styles.tableValue}>{val.toFixed(1)}%</td>
                  <td>
                    {d !== null ? (
                      <span
                        className={styles.tableDelta}
                        data-direction={
                          d > 0.05 ? 'good' : d < -0.05 ? 'bad' : 'neutral'
                        }
                      >
                        {d > 0 ? '+' : ''}
                        {d.toFixed(1)} p.p.
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
      </div>
    </>
  );
}