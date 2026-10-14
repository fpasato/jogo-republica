import { useEffect, useState } from 'react';
import type { StageResult, VotingOutcome, VoteValue } from '../../../../game/services/parliament/votingService';
import styles from './styles.module.css';

interface Props {
    /** Resultado já calculado: a tela só anima, não sorteia nada. Pode ser null enquanto calcula. */
    outcome: VotingOutcome | null;
    policyName?: string;
    onFinish: (outcome: VotingOutcome) => void | Promise<void>;
    error?: string | null;
    onCancel?: () => void;
}

const STAGE_LABEL: Record<string, string> = {
    camara: 'Câmara dos Deputados',
    senado: 'Senado Federal',
    stf: 'Supremo Tribunal Federal',
};

const VOTE_LABEL: Record<VoteValue, string> = {
    sim: 'A favor',
    nao: 'Contra',
    abstencao: 'Abstenção',
};

const HOLD_MS = 1200; // pausa depois de preencher uma casa, antes da próxima

export function VotingScreen({ outcome, policyName, onFinish, error, onCancel }: Props) {
    const [stageIndex, setStageIndex] = useState(0);
    const [revealed, setRevealed] = useState(0);
    const [done, setDone] = useState(false);

    const stages = outcome?.stages ?? [];
    const stagesCount = stages.length;
    const stage = stages[stageIndex];
    const total = stage?.votes.length ?? 0;

    // Animação: preenche os quadrados aos poucos, depois passa para a próxima casa
    useEffect(() => {
        // Ainda calculando: não faz nada (antes, isso marcava a votação como encerrada)
        if (!outcome || done) return;

        // Resultado sem nenhuma etapa
        if (!stage) {
            setDone(true);
            return;
        }

        if (revealed < total) {
            const stepSize = Math.max(1, Math.ceil(total / 100));
            const interval = total <= 20 ? 250 : 25;
            const t = setTimeout(() => setRevealed((r) => Math.min(total, r + stepSize)), interval);
            return () => clearTimeout(t);
        }

        const t = setTimeout(() => {
            if (stageIndex + 1 < stagesCount) {
                setStageIndex((i) => i + 1);
                setRevealed(0);
            } else {
                setDone(true);
            }
        }, HOLD_MS);
        return () => clearTimeout(t);
    }, [outcome, done, stage, stageIndex, stagesCount, revealed, total]);

    const skip = () => {
        if (!outcome) return;
        const lastIndex = stagesCount - 1;
        if (lastIndex < 0) {
            setDone(true);
            return;
        }
        setStageIndex(lastIndex);
        setRevealed(outcome.stages[lastIndex].votes.length);
        setDone(true);
    };

    const stageFinished = !!stage && revealed >= total;

    if (!outcome) {
        return (
            <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Votação">
                <div className={styles.modal}>
                    <header className={styles.header}>
                        <div>
                            <p className={styles.eyebrow}>Votação</p>
                            <h2 className={styles.title}>{policyName || 'Medida'}</h2>
                        </div>
                    </header>
                    {error ? (
                        <>
                            <p className={styles.muted}>{error}</p>
                            <button type="button" className={styles.continue} onClick={onCancel}>Voltar à proposta</button>
                        </>
                    ) : <p className={styles.muted}>Calculando votos...</p>}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Votação">
            <div className={styles.modal}>
                <header className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>Votação</p>
                        <h2 className={styles.title}>{policyName || 'Medida'}</h2>
                    </div>
                    {!done && (
                        <button type="button" className={styles.skip} onClick={skip}>
                            Pular animação
                        </button>
                    )}
                </header>

                {/* Etapas */}
                <ol className={styles.steps}>
                    {outcome.stages.map((s, i) => {
                        const finished = done || i < stageIndex || (i === stageIndex && stageFinished);
                        const status = finished ? (s.approved ? 'approved' : 'rejected') : i === stageIndex ? 'active' : 'pending';
                        return (
                            <li key={s.stage} className={styles.step} data-status={status}>
                                <span className={styles.stepLabel}>{STAGE_LABEL[s.stage]}</span>
                                <span className={styles.stepMark}>
                                    {status === 'approved' && '✓'}
                                    {status === 'rejected' && '✕'}
                                    {status === 'active' && '…'}
                                </span>
                            </li>
                        );
                    })}
                </ol>

                {/* Casa atual */}
                {stage && (
                    <section className={styles.chamber}>
                        <div className={styles.chamberHead}>
                            <h3>{STAGE_LABEL[stage.stage]}</h3>
                            <span className={styles.rule}>{stage.rule}</span>
                        </div>

                        <Squares stage={stage} revealed={revealed} voting={!stageFinished} />
                        <Tally stage={stage} revealed={revealed} />
                    </section>
                )}

                {/* Resultado final */}
                {done && (
                    <section className={styles.result} data-result={outcome.approved ? 'approved' : 'rejected'}>
                        <div className={styles.resultText}>
                            <h3>{outcome.approved ? 'Medida aprovada' : 'Medida rejeitada'}</h3>
                            <p className={styles.muted}>
                                {outcome.approved
                                    ? 'A medida entra em vigor.'
                                    : outcome.rejectedAt
                                    ? `Rejeitada em: ${STAGE_LABEL[outcome.rejectedAt]}.`
                                    : 'A medida foi rejeitada.'}
                            </p>

                            <ul className={styles.summary}>
                                {outcome.stages.map((s) => (
                                    <li key={s.stage} data-approved={s.approved}>
                                        <span className={styles.summaryName}>
                                            {s.approved ? '✓' : '✕'} {STAGE_LABEL[s.stage]}
                                        </span>
                                        <span className={styles.summaryCounts}>
                                            <b className={styles.yes}>{s.yes}</b> a favor ·{' '}
                                            <b className={styles.no}>{s.no}</b> contra ·{' '}
                                            <b className={styles.abstain}>{s.abstain}</b> abst.
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button type="button" className={styles.continue} onClick={() => { void onFinish(outcome); }}>
                            {outcome.approved ? 'Aplicar medida e avançar mês' : 'Voltar à criação de medida'}
                        </button>
                    </section>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Quadrados
// ---------------------------------------------------------------------------
function Squares({ stage, revealed, voting }: { stage: StageResult; revealed: number; voting: boolean }) {
    return (
        <div className={styles.squares} data-stage={stage.stage} data-voting={voting}>
            {stage.votes.map((v, i) => {
                const isRevealed = i < revealed;
                const who = v.party ? `${v.name} (${v.party})` : v.name;
                return (
                    <span
                        key={v.memberId ?? i}
                        className={styles.square}
                        data-vote={isRevealed ? v.vote : 'pending'}
                        title={isRevealed ? `${who} — ${VOTE_LABEL[v.vote]}` : undefined}
                    />
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Placar (acompanha a animação)
// ---------------------------------------------------------------------------
function Tally({ stage, revealed }: { stage: StageResult; revealed: number }) {
    let yes = 0;
    let no = 0;
    let abstain = 0;

    for (const v of stage.votes.slice(0, revealed)) {
        if (v.vote === 'sim') yes++;
        else if (v.vote === 'nao') no++;
        else abstain++;
    }

    return (
        <div className={styles.tally}>
            <div className={styles.tallyItem} data-vote="sim">
                <span>A favor</span>
                <strong>{yes}</strong>
            </div>
            <div className={styles.tallyItem} data-vote="nao">
                <span>Contra</span>
                <strong>{no}</strong>
            </div>
            <div className={styles.tallyItem} data-vote="abstencao">
                <span>Abstenção</span>
                <strong>{abstain}</strong>
            </div>
        </div>
    );
}
