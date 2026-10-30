import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './loading.module.css';

type LoadingVariant = 'analyze' | 'advance' | 'default';

interface LoadingProps {
  open: boolean;
  title?: string;
  phrases?: string[];
  intervalMs?: number;
  variant?: LoadingVariant;
}

const VARIANT_DEFAULTS: Record<
  LoadingVariant,
  { title: string; phrases: string[] }
> = {
  analyze: {
    title: 'Analisando proposta',
    phrases: [
      'Consultando o gabinete...',
      'Lendo o texto da medida...',
      'Identificando instrumento adequado...',
      'Calculando impacto orçamentário...',
      'Estimando reação dos grupos sociais...',
      'Verificando viabilidade jurídica...',
      'Redigindo parecer técnico...',
    ],
  },
  advance: {
    title: 'Fechando o mês',
    phrases: [
      'Aplicando medidas em vigor...',
      'Recalculando indicadores nacionais...',
      'Atualizando reações dos grupos...',
      'Consolidando dados econômicos...',
      'Preparando notícias do mês...',
      'Fechando o balanço mensal...',
    ],
  },
  default: {
    title: 'Carregando',
    phrases: [
      'Preparando o cenário...',
      'Consolidando informações...',
      'Organizando dados...',
      'Quase pronto...',
    ],
  },
};

export function Loading({
  open,
  title,
  phrases,
  intervalMs = 1800,
  variant = 'default',
}: LoadingProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const effectiveTitle = title ?? defaults.title;
  const effectivePhrases = useMemo(
    () => (phrases && phrases.length > 0 ? phrases : defaults.phrases),
    [phrases, defaults],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      return;
    }
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % effectivePhrases.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [open, effectivePhrases.length, intervalMs]);

  if (!open) return null;

  const safeIndex = index % effectivePhrases.length;
  const phrase = effectivePhrases[safeIndex];

  return createPortal(
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.panel} data-variant={variant}>
        <div className={styles.mark} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <h2 className={styles.title}>{effectiveTitle}</h2>

        <div className={styles.phraseWrap}>
          <p key={safeIndex} className={styles.phrase}>
            {phrase}
          </p>
        </div>

        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressBar} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default Loading;