import { useMemo, useState } from 'react';
import { initialParties } from '../../game/types/politics';
import {
    PROFILE_AXES,
    SLIDER_BUDGET,
    SLIDER_MIN,
    SLIDER_MAX,
} from '../../game/data/profile';
import {
    buildInitialGroups,
    nationalApprovalFromGroups,
    playerProfileFromSliders,
    type PlayerProfile,
} from '../../game/services/politics/profileService';
import { GROUPS } from '../../game/data/groups';
import { partyDifficulty } from '../../game/services/parliament/votingService';
import styles from './styles.module.css';

const PARTIES = [...initialParties].sort((a, b) => b.deputies - a.deputies);

export function NewGameForm({
    onCreate,
    onCancel,
}: {
    onCreate: (profile: PlayerProfile) => void;
    onCancel: () => void;
}) {
    const [nome, setNome] = useState('');
    const [partyId, setPartyId] = useState('pt');
    const [sliders, setSliders] = useState<Record<string, number>>({});

    const used = PROFILE_AXES.reduce(
        (s, ax) => s + Math.abs(sliders[ax.id] ?? 0),
        0,
    );

    const setSlider = (id: string, value: number) => {
        const others = used - Math.abs(sliders[id] ?? 0);
        if (others + Math.abs(value) > SLIDER_BUDGET) return;
        setSliders((s) => ({ ...s, [id]: value }));
    };

    const profile: PlayerProfile = playerProfileFromSliders(nome.trim(), partyId, sliders);
    const groups = useMemo(
        () => buildInitialGroups(profile),
        [partyId, sliders], // eslint-disable-line react-hooks/exhaustive-deps
    );
    const approval = nationalApprovalFromGroups(groups);
    const sorted = Object.entries(groups)
        .map(([id, groupApproval]) => ({
            id,
            name: GROUPS.find((group) => group.id === id)?.nome ?? id,
            approval: groupApproval,
        }))
        .sort((a, b) => b.approval - a.approval);
    const party = initialParties.find((p) => p.id === partyId)!;
    const diff = partyDifficulty(partyId);

    return (
        <div className={styles.form}>
            <h2 className={styles.sectionTitle}>Criar perfil do governo</h2>

            <div className={styles.formSection}>
                <label htmlFor="gov-name" className={styles.sliderLabel}>
                    Nome do governo
                </label>
                <input
                    id="gov-name"
                    className={styles.input}
                    type="text"
                    placeholder="Ex: Governo da Reconstrução"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                />
            </div>

            <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Partido</h3>

                <div className={styles.partyGrid}>
                    {PARTIES.map((p) => {
                        const d = partyDifficulty(p.id);
                        const selected = p.id === partyId;

                        return (
                            <button
                                key={p.id}
                                type="button"
                                className={styles.partyCard}
                                data-selected={selected}
                                onClick={() => setPartyId(p.id)}
                            >
                                <div>
                                    <span className={styles.partyAcronym}>
                                        {p.acronym}
                                    </span>
                                    <span
                                        className={styles.partyDiff}
                                        data-difficulty={d.difficulty}
                                    >
                                        {d.label}
                                    </span>
                                </div>
                                <div className={styles.partyMeta}>
                                    {p.deputies} dep · {p.senators} sen
                                </div>
                            </button>
                        );
                    })}
                </div>

                <p className={styles.partyInfo}>
                    <strong>{party.name}</strong>: base própria de{' '}
                    {Math.round(diff.ownSeatsShare * 100)}% da Câmara. Numa medida
                    alinhada ao partido, espera-se cerca de{' '}
                    {Math.round(diff.camaraShare * 100)}% de votos favoráveis.
                    Dificuldade:{' '}
                    <span
                        className={styles.partyInfoDiff}
                        data-difficulty={diff.difficulty}
                    >
                        {diff.label}
                    </span>
                    .
                </p>
            </div>

            <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>
                    Perfil do governo
                    <span className={styles.budgetLabel}>
                        ({used}/{SLIDER_BUDGET} pontos usados)
                    </span>
                </h3>

                {PROFILE_AXES.map((ax) => (
                    <div key={ax.id} className={styles.sliderRow}>
                        <span className={`${styles.sliderLabel} ${styles.sliderLabelRight}`}>
                            {ax.esquerda}
                        </span>
                        <input
                            type="range"
                            className={styles.slider}
                            min={SLIDER_MIN}
                            max={SLIDER_MAX}
                            step={1}
                            value={sliders[ax.id] ?? 0}
                            onChange={(e) => setSlider(ax.id, Number(e.target.value))}
                            aria-label={ax.nome}
                        />
                        <span className={styles.sliderLabel}>{ax.direita}</span>
                    </div>
                ))}
            </div>

            <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Ponto de partida</h3>

                <div className={styles.approvalBox}>
                    <span className={styles.approvalLabel}>Aprovação geral</span>
                    <strong className={styles.approvalValue}>
                        {Math.round(approval)}
                    </strong>
                    <span className={styles.approvalUnit}>pts</span>
                </div>

                <div className={styles.groupsCols}>
                    <div className={styles.groupCol}>
                        <h4>Mais favoráveis</h4>
                        <ul className={styles.groupList}>
                            {sorted.slice(0, 4).map((g) => (
                                <li
                                    key={g.id}
                                    className={styles.groupRow}
                                    data-positive="true"
                                >
                                    <span>{g.name}</span>
                                    <span className={styles.groupValue}>
                                        {Math.round(g.approval)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={styles.groupCol}>
                        <h4>Mais contrários</h4>
                        <ul className={styles.groupList}>
                            {sorted
                                .slice(-4)
                                .reverse()
                                .map((g) => (
                                    <li
                                        key={g.id}
                                        className={styles.groupRow}
                                        data-positive="false"
                                    >
                                        <span>{g.name}</span>
                                        <span className={styles.groupValue}>
                                            {Math.round(g.approval)}
                                        </span>
                                    </li>
                                ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className={styles.formActions}>
                <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={onCancel}
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={!nome.trim()}
                    onClick={() => onCreate(profile)}
                >
                    Começar
                </button>
            </div>
        </div>
    );
}
