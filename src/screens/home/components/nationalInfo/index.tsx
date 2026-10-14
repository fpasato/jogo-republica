import { useGameStore } from '../../../../store/gameStore';
import styles from './styles.module.css';

type MetricSource = 'nationalIndicators' | 'macros' | 'stateIndicators';
type BetterWhen = 'up' | 'down' | 'neutral';

interface MetricDefinition {
  id: string;
  label: string;
  source: MetricSource;
  unit: 'percent' | 'percentagePoints' | 'billions' | 'dollar' | 'reais' | 'index' | 'rate';
  betterWhen: BetterWhen;
  state?: 'RJ' | 'SP';
}

const METRICS: MetricDefinition[] = [
  { id: 'idh',                label: 'IDH nacional',        source: 'nationalIndicators', unit: 'index',    betterWhen: 'up'   },
  { id: 'inflation',           label: 'Inflação',           source: 'macros',             unit: 'percent',  betterWhen: 'down' },
  { id: 'pib_nominal',         label: 'PIB nominal',        source: 'nationalIndicators', unit: 'billions', betterWhen: 'up'   },
  { id: 'divida_publica',      label: 'Dívida pública',     source: 'nationalIndicators', unit: 'billions', betterWhen: 'down' },
  { id: 'carga_tributaria',    label: 'Carga tributária',   source: 'nationalIndicators', unit: 'percent',  betterWhen: 'down' },
  { id: 'dollar',              label: 'Cotação do dólar',   source: 'macros',             unit: 'dollar',   betterWhen: 'down' },
  { id: 'salario_minimo',      label: 'Salário mínimo',     source: 'nationalIndicators', unit: 'reais',    betterWhen: 'up'   },
  { id: 'saldo_orcamentario',  label: 'Saldo orçamentário', source: 'nationalIndicators', unit: 'billions', betterWhen: 'up'   },
  { id: 'receitas_publicas',   label: 'Receitas públicas',  source: 'nationalIndicators', unit: 'billions', betterWhen: 'up'   },
  { id: 'gastos_publicos',     label: 'Gastos públicos',    source: 'nationalIndicators', unit: 'billions', betterWhen: 'neutral' },
  { id: 'homicidios',          label: 'Homicídios — RJ',    source: 'stateIndicators',   unit: 'rate',     betterWhen: 'down', state: 'RJ' },
  { id: 'homicidios',          label: 'Homicídios — SP',    source: 'stateIndicators',   unit: 'rate',     betterWhen: 'down', state: 'SP' },
];

function numberBR(value: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatValue(value: number | undefined, unit: MetricDefinition['unit']): string {
  if (value === undefined || !Number.isFinite(value)) return '—';

  switch (unit) {
    case 'percent': return `${numberBR(value)}%`;
    case 'percentagePoints': return `${numberBR(value)} p.p.`;
    case 'dollar': return `R$ ${numberBR(value, 2)}`;
    case 'reais': return `R$ ${numberBR(value, 0)}`;
    case 'index': return numberBR(value, 3);
    case 'rate': return `${numberBR(value)} por 100 mil hab.`;
    case 'billions':
      return Math.abs(value) >= 1000
        ? `R$ ${numberBR(value / 1000)} tri`
        : `R$ ${numberBR(value)} bi`;
  }
}

function formatDelta(value: number, unit: MetricDefinition['unit']): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const absolute = Math.abs(value);

  switch (unit) {
    case 'percent':
    case 'percentagePoints': return `${sign}${numberBR(absolute)} p.p.`;
    case 'dollar': return `${sign}R$ ${numberBR(absolute, 2)}`;
    case 'reais': return `${sign}R$ ${numberBR(absolute, 0)}`;
    case 'index': return `${sign}${numberBR(absolute, 3)}`;
    case 'rate': return `${sign}${numberBR(absolute)} por 100 mil hab.`;
    case 'billions':
      return absolute >= 1000
        ? `${sign}R$ ${numberBR(absolute / 1000)} tri`
        : `${sign}R$ ${numberBR(absolute)} bi`;
  }
}

function directionFor(delta: number, betterWhen: BetterWhen): 'good' | 'bad' | 'neutral' {
  if (delta === 0 || betterWhen === 'neutral') return 'neutral';
  const improved = betterWhen === 'up' ? delta > 0 : delta < 0;
  return improved ? 'good' : 'bad';
}

export function NationalInfo() {
  const game = useGameStore((state) => state.game);
  const previousMonth = game?.history.at(-1);

  return (
    <section className={styles.container} aria-label="Indicadores nacionais">
      {METRICS.map((metric) => {
        const value = metric.source === 'stateIndicators'
          ? metric.state ? game?.stateIndicators[metric.state]?.[metric.id] : undefined
          : game?.[metric.source]?.[metric.id];
        const previousValue = metric.source === 'stateIndicators'
          ? previousMonth?.states?.find((state) => state.id === metric.state)?.values[metric.id]
          : previousMonth?.[metric.source === 'nationalIndicators' ? 'national' : 'macros']?.[metric.id];
        const delta = value !== undefined && previousValue !== undefined
          ? value - previousValue
          : null;

        return (
          <article key={`${metric.state ?? metric.source}:${metric.id}`} className={styles.item}>
            <span
              className={styles.value}
              data-balance={metric.id === 'balanca_comercial'
                ? value === undefined || value === 0 ? 'zero' : value > 0 ? 'positive' : 'negative'
                : undefined}
            >
              {formatValue(value, metric.unit)}
            </span>
            <h3 className={styles.label}>{metric.label}</h3>
            <span
              className={styles.trend}
              data-direction={delta === null ? 'neutral' : directionFor(delta, metric.betterWhen)}
              title={delta === null ? 'Ainda não há mês anterior para comparar' : 'Variação em relação ao mês anterior'}
            >
              {delta === null ? 'Primeiro mês' : `${formatDelta(delta, metric.unit)} vs. mês anterior`}
            </span>
          </article>
        );
      })}
    </section>
  );
}
