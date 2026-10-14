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
// Escala de cor por aprovação (vermelho → amarelo → verde)
// Intervalos de 10 pontos, cor "chapada" para leitura rápida no mapa.
// ---------------------------------------------------------------------------
type ApprovalStop = { min: number; color: string; label: string };

export const APPROVAL_STOPS: ApprovalStop[] = [
    { min: 0,  color: '#7f1d1d', label: '0–19% · Crítica' },
    { min: 20, color: '#b91c1c', label: '20–29% · Muito ruim' },
    { min: 30, color: '#dc2626', label: '30–39% · Ruim' },
    { min: 40, color: '#ea580c', label: '40–49% · Instável' },
    { min: 50, color: '#ca8a04', label: '50–59% · Neutra' },
    { min: 60, color: '#65a30d', label: '60–69% · Boa' },
    { min: 70, color: '#16a34a', label: '70–79% · Ótima' },
    { min: 80, color: '#15803d', label: '80–100% · Excelente' },
];

export function approvalColor(approval: number): string {
    // percorre de trás pra frente para pegar o maior "min" que ainda cabe
    for (let i = APPROVAL_STOPS.length - 1; i >= 0; i--) {
        if (approval >= APPROVAL_STOPS[i].min) return APPROVAL_STOPS[i].color;
    }
    return APPROVAL_STOPS[0].color;
}

const EMPTY_COLOR = '#101a27';

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
                        <div key={stop.min} className={styles.legendItem}>
                            <span
                                className={styles.legendSwatch}
                                style={{ background: stop.color }}
                            />
                            <span className={styles.legendLabel}>{stop.label}</span>
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
