import { useGameStore } from '../../../../store/gameStore';
import { GROUPS } from '../../../../game/data/groups';
import styles from './styles.module.css';

export function NewsHome() {
  const media = useGameStore(s => s.lastMedia);
  const game = useGameStore(s => s.game);

  if (!game) return null;
  if (!media) return <p className={styles.empty}>Avance o mês para gerar notícias.</p>;

  return (
    <div className={styles.wrapper}>
      <section>
        <h3>Notícias</h3>
        <div className={styles.newsGrid}>
          {media.news.map(n => (
            <article key={n.id} className={`${styles.news} ${styles[n.tone]}`}>
              <header>
                <span className={styles.source}>{n.source}</span>
                <span className={styles.category}>{n.category}</span>
              </header>
              <h4>{n.title}</h4>
              <p>{n.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3>Redes sociais</h3>
        <div className={styles.posts}>
          {media.posts.map(p => (
            <article key={p.id} className={styles.post}>
              <header>
                <strong>{p.authorName}</strong>
                <span className={styles.handle}>{p.handle}</span>
                <span className={styles.groupTag}>{GROUPS[p.authorGroup].name}</span>
              </header>
              <p>{p.text}</p>
              <footer>
                <span>♥ {p.likes}</span>
                <span>↻ {p.reposts}</span>
                <span>💬 {p.replies}</span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3>Reações dos grupos</h3>
        <ul className={styles.reactions}>
          {media.reactions.map((r, i) => (
            <li key={i} className={r.intensity > 0 ? styles.positive : r.intensity < 0 ? styles.negative : ''}>
              <strong>{GROUPS[r.groupId].name}</strong>
              <h5>{r.headline}</h5>
              <p>{r.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}