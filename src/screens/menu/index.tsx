import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { SaveGame } from '../../game/services/persistence/db';
import { NewGameForm } from './NewGameForm';
import styles from './styles.module.css';

export function Menu() {
  const [saves, setSaves] = useState<SaveGame[]>([]);
  const [creating, setCreating] = useState(false);
  const listSaves = useGameStore(state => state.listSaves);
  const loadGame = useGameStore(state => state.loadGame);
  const deleteGame = useGameStore(state => state.deleteSave);

  useEffect(() => { void listSaves().then(setSaves); }, [listSaves]);

  const handleDelete = async (id: number) => {
    await deleteGame(id);
    void listSaves().then(setSaves);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Menu principal</h1>
      </header>

      <section className={styles.newGameCard}>
        <div>
          <h2 className={styles.sectionTitle}>Nova partida</h2>
          <p className={styles.hint}>Escolha seu nome e partido para começar.</p>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setCreating(true)}>
          Criar partida
        </button>
      </section>

      <section className={styles.savesSection}>
        <h2 className={styles.sectionTitle}>Partidas salvas</h2>
        {saves.length === 0 ? (
          <p className={styles.empty}>Nenhuma partida encontrada.</p>
        ) : (
          <div className={styles.savesList}>
            {saves.map(save => (
              <article key={save.id} className={styles.saveCard}>
                <div className={styles.saveInfo}>
                  <header className={styles.saveHeader}>
                    <h3 className={styles.saveName}>{save.name}</h3>
                    <span className={styles.saveMonth}>Turno {save.turn}</span>
                  </header>
                  <p className={styles.saveMeta}>Último acesso: {new Date(save.updatedAt).toLocaleString('pt-BR')}</p>
                  <div className={styles.statsGrid}>
                    <Stat label="Aprovação" value={`${save.game.indicators.aprovacao.toFixed(1)}%`} />
                    <Stat label="Inflação" value={`${save.game.indicators.inflacao.toFixed(1)}%`} />
                    <Stat label="Desemprego" value={`${save.game.indicators.desemprego.toFixed(1)}%`} />
                    <Stat label="Medidas em vigor" value={`${save.game.activePolicies.filter(policy => policy.status === 'active').length}`} />
                  </div>
                </div>
                <div className={styles.saveActions}>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void loadGame(save.id!)}>Continuar</button>
                  <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => void handleDelete(save.id!)}>Excluir</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {creating && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Criar partida">
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <NewGameForm onCreated={() => setCreating(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className={styles.stat}><span className={styles.statLabel}>{label}</span><span className={styles.statValue}>{value}</span></div>;
}
