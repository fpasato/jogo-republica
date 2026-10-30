import { useGameStore } from '../../store/gameStore';
import styles from './styles.module.css';
import { Header } from '../../components/header';

export function Medidas() {
  const game = useGameStore((state) => state.game);
  const lastTurnLog = useGameStore((state) => state.lastTurnLog);

  // Por enquanto, vamos mostrar as políticas ativas e log do último turno
  // Futuramente, podemos adicionar um histórico completo de votações
  const activePolicies = game?.activePolicies || [];
  const measureHistory = [...(game?.measureHistory ?? [])].reverse();
  const policyLog = lastTurnLog?.policies || [];

  return (
    <div className={styles.page}>
      <Header />


      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Políticas Ativas</h2>
        {activePolicies.length === 0 ? (
          <p className={styles.empty}>Nenhuma política ativa no momento.</p>
        ) : (
          <div className={styles.grid}>
            {activePolicies.map((policy) => (
              <article key={policy.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{policy.name}</h3>
                  <span className={styles.badge} data-type={policy.type}>
                    {policy.type}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.info}>
                    <span className={styles.label}>Tipo:</span>
                    <span className={styles.value}>{policy.measureKind || 'N/A'}</span>
                  </div>
                  <div className={styles.info}>
                    <span className={styles.label}>Meses ativos:</span>
                    <span className={styles.value}>{policy.activeMonths}</span>
                  </div>
                  <div className={styles.info}>
                    <span className={styles.label}>Duração:</span>
                    <span className={styles.value}>
                      {policy.durationType === 'permanent'
                        ? 'Permanente'
                        : `${policy.durationMonths} meses`}
                    </span>
                  </div>
                  <div className={styles.info}>
                    <span className={styles.label}>Impacto fiscal:</span>
                    <span className={styles.value}>
                      {policy.fiscalAnnual >= 0 ? '+' : ''}
                      {formatCurrency(policy.fiscalAnnual)}/ano
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico das medidas</h2>
        {measureHistory.length === 0 ? (
          <p className={styles.empty}>Nenhuma medida votada nesta partida.</p>
        ) : (
          <div className={styles.list}>
            {measureHistory.map((entry) => (
              <article key={entry.id} className={styles.listItem}>
                <div className={styles.listItemHeader}>
                  <span className={styles.listItemName}>{entry.name}</span>
                  <span className={styles.status} data-status={entry.status}>
                    {entry.status === 'rejected' ? 'Rejeitada' : entry.status === 'archived' ? 'Arquivada' : 'Aprovada'}
                  </span>
                </div>
                <div className={styles.listItemDetails}>
                  <span className={styles.detail}>{entry.type}</span>
                  <span className={styles.detail}>Mês {entry.month}</span>
                  <span className={styles.detail}>{entry.analysis.tipo_medida ?? 'Medida'}</span>
                </div>
                <p className={styles.historyText}>{entry.originalText}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico do Último Turno</h2>
        {policyLog.length === 0 ? (
          <p className={styles.empty}>Nenhuma alteração no último turno.</p>
        ) : (
          <div className={styles.list}>
            {policyLog.map((entry, index) => (
              <div key={index} className={styles.listItem}>
                <div className={styles.listItemHeader}>
                  <span className={styles.listItemName}>{entry.name}</span>
                  <span
                    className={styles.status}
                    data-status={entry.expired ? 'expired' : 'active'}
                  >
                    {entry.expired ? 'Expirada' : 'Ativa'}
                  </span>
                </div>
                <div className={styles.listItemDetails}>
                  <span className={styles.detail}>ID: {entry.policyId}</span>
                  <span className={styles.detail}>
                    Aplicada: {entry.applied} meses
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) {
    return `R$ ${(value / 1e9).toFixed(1)} bi`;
  }
  if (Math.abs(value) >= 1e6) {
    return `R$ ${(value / 1e6).toFixed(1)} mi`;
  }
  return `R$ ${value.toFixed(0)}`;
}
