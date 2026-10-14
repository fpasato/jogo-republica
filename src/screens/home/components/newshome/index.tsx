import type { Noticia, Post } from '../../../../game/types/ai';
import placeholderImage from '../../../../game/assets/news/_placeholder.png';
import styles from './styles.module.css';

interface NewsHomeProps {
  noticias: Noticia[];
  posts?: Post[];
  isLoading?: boolean;
  error?: string | null;
}

const TONE_LABEL = {
  positivo: 'Positiva',
  neutro: 'Neutra',
  negativo: 'Negativa',
} as const;

export function NewsHome({ noticias, posts = [], isLoading = false, error }: NewsHomeProps) {
  return (
    <section className={styles.container} aria-labelledby="news-home-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Acompanhe o país</p>
          <h2 id="news-home-title">Jornal e redes</h2>
        </div>
        {isLoading && <span className={styles.status}>Atualizando…</span>}
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {noticias.length === 0 ? (
        <p className={styles.empty}>
          {isLoading ? 'As notícias do mês estão sendo preparadas.' : 'As notícias do próximo mês aparecerão aqui.'}
        </p>
      ) : (
        <div className={styles.newsList}>
          {noticias.map((noticia) => (
            <article className={styles.article} key={noticia.id}>
              <img
                className={styles.image}
                src={noticia.imagem || placeholderImage}
                alt=""
                loading="lazy"
                onError={(event) => {
                  if (event.currentTarget.dataset.fallback !== 'true') {
                    event.currentTarget.dataset.fallback = 'true';
                    event.currentTarget.src = placeholderImage;
                  }
                }}
              />
              <div className={styles.articleBody}>
                <div className={styles.meta}>
                  <span>{noticia.veiculo.replaceAll('_', ' ')}</span>
                  <span data-tone={noticia.tom}>{TONE_LABEL[noticia.tom]}</span>
                </div>
                <h3>{noticia.manchete}</h3>
                {noticia.submanchete && <p className={styles.subtitle}>{noticia.submanchete}</p>}
                <p className={styles.body}>{noticia.corpo}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {posts.length > 0 && (
        <section className={styles.social} aria-labelledby="social-feed-title">
          <h3 id="social-feed-title">Repercussão nas redes</h3>
          {posts.slice(0, 6).map((post) => (
            <article className={styles.post} key={post.id}>
              <p>{post.texto}</p>
              <span>{post.stats.likes.toLocaleString('pt-BR')} curtidas · {post.stats.reposts.toLocaleString('pt-BR')} compartilhamentos</span>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

export default NewsHome;
