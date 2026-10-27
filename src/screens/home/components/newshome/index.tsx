import type { Noticia } from '../../../../game/types/ai';
import placeholderImage from '../../../../game/assets/news/_placeholder.png';
import styles from './styles.module.css';

interface NewsHomeProps {
  noticias: Noticia[];
  isLoading?: boolean;
  error?: string | null;
}

const TONE_LABEL = {
  positivo: 'Positiva',
  neutro: 'Neutra',
  negativo: 'Negativa',
} as const;

export function NewsHome({ noticias, isLoading = false, error }: NewsHomeProps) {
  return (
    <section className={styles.container} aria-labelledby="news-home-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Acompanhe o país</p>
          <h2 id="news-home-title">Jornal</h2>
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
    </section>
  );
}

export default NewsHome;
