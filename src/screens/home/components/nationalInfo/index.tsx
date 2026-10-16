import { useGameStore } from '../../../../store/gameStore';
import { INDICATORS, INDICATORS_BY_CATEGORY } from '../../../../game/data/indicators';
import { GROUPS, GROUP_IDS } from '../../../../game/data/groups';
import styles from './styles.module.css';

const CATEGORY_LABEL: Record<string, string> = {
  economia: 'Economia',
  financas: 'Finanças públicas',
  seguranca: 'Segurança',
  saude: 'Saúde',
  educacao: 'Educação',
  saneamento: 'Saneamento',
  popularidade: 'Popularidade',
  social: 'Social',
};

export function NationalInfo() {
  const indicators = useGameStore(s => s.game?.indicators);
  const groups = useGameStore(s => s.game?.groups);
  const history = useGameStore(s => s.game?.history ?? []);

  if (!indicators || !groups) return null;
  const previous = history[history.length - 1]?.indicators;

  return (
    <div className={styles.wrapper}>
      {Object.entries(INDICATORS_BY_CATEGORY).map(([cat, ids]) => (
        <section key={cat}>
          <h3>{CATEGORY_LABEL[cat] ?? cat}</h3>
          <table>
            <tbody>
              {ids.map(id => {
                const def = INDICATORS[id];
                const value = indicators[id];
                const prev = previous?.[id];
                const delta = prev != null ? value - prev : 0;
                const improved = def.direction === 0 ? false
                  : def.direction === 1 ? delta > 0 : delta < 0;
                return (
                  <tr key={id}>
                    <td>{def.name}</td>
                    <td>
                      {value.toFixed(2)} {def.unit}
                    </td>
                    <td className={improved ? styles.up : delta !== 0 ? styles.down : ''}>
                      {delta !== 0 && `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <section>
        <h3>Apoio dos grupos sociais</h3>
        <table>
          <tbody>
            {GROUP_IDS.map(id => {
              const g = groups[id];
              return (
                <tr key={id}>
                  <td>{GROUPS[id].name}</td>
                  <td>{g.support.toFixed(1)}%</td>
                  <td className={g.lastChange > 0 ? styles.up : g.lastChange < 0 ? styles.down : ''}>
                    {g.lastChange !== 0 && `${g.lastChange > 0 ? '+' : ''}${g.lastChange.toFixed(1)}`}
                  </td>
                  <td>{g.trend === 'up' ? '↑' : g.trend === 'down' ? '↓' : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}