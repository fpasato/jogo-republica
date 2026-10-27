import { useRef, useState } from 'react';
import { geoIdentity, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import brazil from '../../../../assets/brasil-estados.json';
import type { StateStructural, StateId } from '../../../../game/data/states';
import rewind from '@turf/rewind';
import styles from './styles.module.css';

// Código IBGE -> sigla
const codeToUF: Record<string, string> = {
    '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
    '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
    '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
    '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
    '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
    '52': 'GO', '53': 'DF',
};

const WIDTH = 600;
const HEIGHT = 600;
const TOOLTIP_OFFSET = 16;
const TOOLTIP_MAX_W = 240;

const geo = rewind(brazil as unknown as FeatureCollection, { reverse: true }) as FeatureCollection;
const projection = geoIdentity().reflectY(true).fitSize([WIDTH, HEIGHT], geo);
const pathGenerator = geoPath(projection);

// ---------------------------------------------------------------------------
// Escala de cor por aprovação
// Vermelho forte → claro | amarelo forte → claro | VERDE CLARO (55+) → neon
// Acima de 55% vira verde claro, e vai ficando mais forte/brilhante.
// ---------------------------------------------------------------------------
type ApprovalStop = { min: number; color: string; label: string };

export const APPROVAL_STOPS: ApprovalStop[] = [
    { min: 0,  color: '#991b1b', label: '0–9% · Crítica' },       // vermelho forte
    { min: 10, color: '#dc2626', label: '10–19% · Muito ruim' },  // vermelho vivo
    { min: 20, color: '#f87171', label: '20–29% · Ruim' },        // vermelho claro
    { min: 30, color: '#fee2e2', label: '30–39% · Instável' },    // vermelho quase branco

    { min: 40, color: '#ca8a04', label: '40–49% · Frágil' },      // amarelo forte
    { min: 50, color: '#facc15', label: '50–54% · Neutra' },      // amarelo vivo

    { min: 55, color: '#bbf7d0', label: '55–64% · Verde claro' }, // ⭐ verde clarinho
    { min: 65, color: '#4ade80', label: '65–74% · Boa' },         // verde vivo
    { min: 75, color: '#22c55e', label: '75–84% · Ótima' },       // verde forte
    { min: 85, color: '#16a34a', label: '85–94% · Excelente' },   // verde muito forte
    { min: 95, color: '#00e676', label: '95–100% · Plena' },      // verde neon (brilhante)
];

export function approvalColor(approval: number): string {
    for (let i = APPROVAL_STOPS.length - 1; i >= 0; i--) {
        if (approval >= APPROVAL_STOPS[i].min) return APPROVAL_STOPS[i].color;
    }
    return APPROVAL_STOPS[0].color;
}

const EMPTY_COLOR = '#141414';

export type BrazilMapState = StateStructural & { approval: number };

interface Props {
    states: BrazilMapState[];
    selectedId: StateId | null;
    onSelect: (id: StateId) => void;
    onHover?: (id: StateId | null) => void;
    showLegend?: boolean;
}

export function BrazilMap({
    states,
    selectedId,
    onSelect,
    onHover,
    showLegend = true,
}: Props) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [hoverUf, setHoverUf] = useState<string | null>(null);
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    const stateById = new Map(states.map((state) => [state.id, state]));
    const hoveredState = hoverUf ? stateById.get(hoverUf as StateId) : null;

    const updatePos = (clientX: number, clientY: number) => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const clampedX = Math.min(Math.max(x, 8), rect.width - TOOLTIP_MAX_W - 8);
        const clampedY = Math.min(Math.max(y, 8), rect.height - 140);

        setPos({ x: clampedX, y: clampedY });
    };

    const handleEnter = (uf: StateId, e: React.MouseEvent<SVGPathElement>) => {
        setHoverUf(uf);
        updatePos(e.clientX, e.clientY);
        onHover?.(uf);
    };

    const handleMove = (e: React.MouseEvent<SVGPathElement>) => {
        if (!hoverUf) return;
        updatePos(e.clientX, e.clientY);
    };

    const handleLeave = () => {
        setHoverUf(null);
        setPos(null);
        onHover?.(null);
    };

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <div className={styles.glow} aria-hidden />

            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className={styles.svg}
                onMouseLeave={handleLeave}
            >
                {geo.features.map((feature, i) => {
                    const code = String(feature.properties?.codarea);
                    const uf = codeToUF[code] as StateId | undefined;
                    const data = uf ? stateById.get(uf) : undefined;
                    const isSelected = !!uf && uf === selectedId;
                    const isHovered = !!uf && hoverUf === uf;
                    const isExtreme = !!data && (data.approval < 10 || data.approval >= 95);

                    return (
                        <path
                            key={code || i}
                            d={pathGenerator(feature) ?? ''}
                            fill={data ? approvalColor(data.approval) : EMPTY_COLOR}
                            className={[
                                styles.path,
                                isSelected ? styles.selected : '',
                                isHovered ? styles.hovered : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            data-empty={!data ? 'true' : undefined}
                            data-extreme={isExtreme ? 'true' : undefined}
                            onMouseEnter={(e) => uf && handleEnter(uf, e)}
                            onMouseMove={handleMove}
                            onClick={() => uf && onSelect(uf)}
                        />
                    );
                })}
            </svg>

            {showLegend && (
                <div className={styles.legend} aria-label="Escala de aprovação">
                    {APPROVAL_STOPS.map((stop) => (
                        <div
                            key={stop.min}
                            className={styles.legendItem}
                            title={stop.label}
                        >
                            <span
                                className={styles.legendSwatch}
                                style={{ background: stop.color }}
                            />
                            <span className={styles.legendLabel}>{stop.min}%</span>
                        </div>
                    ))}
                </div>
            )}

            {hoveredState && pos && (
                <div
                    className={styles.tooltip}
                    style={{
                        left: pos.x + TOOLTIP_OFFSET,
                        top: pos.y + TOOLTIP_OFFSET,
                        width: TOOLTIP_MAX_W,
                    }}
                >
                    <strong>{hoveredState.name}</strong>
                    <div>
                        <span>Região</span>
                        <span>{hoveredState.region}</span>
                    </div>
                    <div>
                        <span>População</span>
                        <span>{(hoveredState.population / 1_000_000).toFixed(1)} mi</span>
                    </div>
                    <div>
                        <span>Aprovação</span>
                        <span
                            className={styles.approvalValue}
                            style={{ color: approvalColor(hoveredState.approval) }}
                        >
                            {hoveredState.approval.toFixed(1)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}