const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Estimativa de IDH para o jogo, baseada nos indicadores disponíveis. */
export function estimateStateIdh(metrics: Record<string, number>): number {
  const accessToHealth = clamp01((metrics.acesso_saude ?? 60) / 100);
  const infantSurvival = clamp01(1 - (metrics.mortalidade_infantil ?? 12) / 90);
  const health = (accessToHealth + infantSurvival) / 2;
  const education = clamp01(
    ((metrics.alfabetizacao ?? 93) * 0.55 + (metrics.conclusao_medio ?? 65) * 0.45) / 100,
  );
  const income = clamp01(Math.log(Math.max(500, metrics.renda_media ?? 2200)) / Math.log(30_000));

  return Math.cbrt(health * education * income);
}
