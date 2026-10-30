import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { db, type SaveGame } from '../../game/services/persistence/db';
import { deleteMembersForSave } from '../../game/services/parliament/memberService';
import type { PlayerProfile } from '../../game/services/politics/profileService';
import { NewGameForm } from './NewGameForm';
import { VolumeControl } from '../../components/BackgroundAudio';
import styles from './styles.module.css';

type SaveWithDiff = SaveGame & {
    prevInflation?: number;
    prevGrowth?: number;
    prevApproval?: number;
    prevUnemployment?: number;
};

export function Menu({ onStartGame }: { onStartGame?: () => void }) {
    const [saves, setSaves] = useState<SaveWithDiff[]>([]);
    const [creating, setCreating] = useState(false);

    const loadGame = useGameStore((s) => s.loadGame);
    const createNewGame = useGameStore((s) => s.createNewGame);

    useEffect(() => {
        loadSaves();
    }, []);

    const loadSaves = async () => {
        const allSaves = await db.saves.orderBy('updatedAt').reverse().toArray();

        const savesWithDiff = await Promise.all(
            allSaves.map(async (save): Promise<SaveWithDiff> => {
                if (save.id && save.month > 1 && save.game) {
                    const prev = await db.monthlyHistory
                        .where({ saveId: save.id, month: save.month - 1 })
                        .first();

                    if (prev) {
                        return {
                            ...save,
                            prevInflation:
                                (save.game?.macros?.inflation ?? 0) - (prev.macros.inflation ?? 0),
                            prevGrowth:
                                (save.game?.macros?.growth ?? 0) - (prev.macros.growth ?? 0),
                            prevApproval:
                                (save.game?.nationalApproval ?? 0) - prev.nationalApproval,
                            prevUnemployment:
                                (save.game?.macros?.unemployment ?? 0) - (prev.macros.unemployment ?? 0),
                        };
                    }
                }
                return save;
            }),
        );

        setSaves(savesWithDiff);
    };

    const handleCreateNew = async (profile: PlayerProfile) => {
        await createNewGame(profile);
        onStartGame?.();
    };

    const handleLoad = async (id: number) => {
        await loadGame(id);
        onStartGame?.();
    };

    const handleDelete = async (id: number) => {
        await db.saves.delete(id);
        await db.monthlyHistory.where({ saveId: id }).delete();
        await deleteMembersForSave(id);
        loadSaves();
    };

    return (
        <div className={styles.page}>
            <header className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Menu Principal</h1>
                <VolumeControl />
            </header>

            {creating ? (
                <NewGameForm
                    onCreate={handleCreateNew}
                    onCancel={() => setCreating(false)}
                />
            ) : (
                <section className={styles.newGameCard}>
                    <div>
                        <h2 className={styles.sectionTitle}>Nova Partida</h2>
                        <p className={styles.hint}>
                            Escolha um partido e um perfil de governo para começar.
                        </p>
                    </div>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => setCreating(true)}
                    >
                        Criar perfil e começar
                    </button>
                </section>
            )}

            <section>
                <h2 className={styles.sectionTitle}>Partidas Salvas</h2>

                {saves.length === 0 ? (
                    <p className={styles.empty}>Nenhuma partida encontrada.</p>
                ) : (
                    <div className={styles.savesList}>
                        {saves.map((save) => (
                            <article key={save.id} className={styles.saveCard}>
                                <div className={styles.saveInfo}>
                                    <header className={styles.saveHeader}>
                                        <h3 className={styles.saveName}>
                                            {typeof save.name === 'string'
                                                ? save.name
                                                : (save.name as any)?.nome || 'Sem nome'}
                                        </h3>
                                        <span className={styles.saveMonth}>
                                            Mês {save.month}
                                        </span>
                                    </header>

                                    <p className={styles.saveMeta}>
                                        Partido: {save.game?.profile?.partyAcronym || 'N/A'} · Último acesso:{' '}
                                        {new Date(save.updatedAt).toLocaleString('pt-BR')}
                                    </p>

                                    <div className={styles.statsGrid}>
                                        <Stat
                                            label="Aprovação"
                                            value={`${Math.round(save.game?.nationalApproval ?? 0)} pts`}
                                            diff={save.prevApproval}
                                            unit="pts"
                                        />
                                        <Stat
                                            label="Inflação"
                                            value={`${(save.game?.macros?.inflation ?? 0).toFixed(1)}%`}
                                            diff={save.prevInflation}
                                        />
                                        <Stat
                                            label="Desemprego"
                                            value={`${(save.game?.macros?.unemployment ?? 0).toFixed(1)}%`}
                                            diff={save.prevUnemployment}
                                        />
                                        <Stat
                                            label="Crescimento"
                                            value={`${(save.game?.macros?.growth ?? 0).toFixed(1)}%`}
                                            diff={save.prevGrowth}
                                        />
                                    </div>
                                </div>

                                <div className={styles.saveActions}>
                                    <button
                                        type="button"
                                        className={`${styles.btn} ${styles.btnPrimary}`}
                                        onClick={() => handleLoad(save.id!)}
                                    >
                                        Continuar
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.btn} ${styles.btnDanger}`}
                                        onClick={() => handleDelete(save.id!)}
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function Stat({
    label,
    value,
    diff,
    unit = 'p.p.',
}: {
    label: string;
    value: string;
    diff?: number;
    unit?: string;
}) {
    const hasDiff = diff !== undefined && Math.abs(diff) >= 0.01;
    const sign = hasDiff && diff! > 0 ? '+' : '';

    return (
        <div className={styles.stat}>
            <span className={styles.statLabel}>{label}</span>
            <span className={styles.statValue}>{value}</span>
            {hasDiff && (
                <span
                    className={styles.statDiff}
                    data-positive={diff! > 0}
                >
                    {sign}
                    {diff!.toFixed(1)} {unit}
                </span>
            )}
        </div>
    );
}
