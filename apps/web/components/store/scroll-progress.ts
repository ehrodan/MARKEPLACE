/**
 * Progresso de um trilho de scroll, em [0, 1].
 *
 * Isolado do React de propósito: é a única parte da abertura que pode errar em
 * silêncio, e errar aqui significa a logo desaparecer cedo demais (ou nunca),
 * que é a diferença entre conduzir a pessoa até o produto e escondê-lo dela.
 *
 * O trilho é mais alto que a viewport; dentro dele um palco fica `sticky`. O
 * curso útil é `trackHeight - viewportHeight`: enquanto ele corre, o palco está
 * colado no topo e é ele quem anima.
 */
export function trackProgress(trackTop: number, trackHeight: number, viewportHeight: number): number {
  const travel = trackHeight - viewportHeight;
  // Trilho menor ou igual à viewport: não há curso. Devolver 0 mantém a peça
  // inteira na tela em vez de dissolvê-la instantaneamente.
  if (travel <= 0) return 0;
  const scrolled = -trackTop;
  if (scrolled <= 0) return 0;
  if (scrolled >= travel) return 1;
  return scrolled / travel;
}

/**
 * Interpolação com corte: 0 antes de `start`, 1 depois de `end`.
 * Deixa cada elemento da abertura ter a SUA janela dentro do mesmo trilho —
 * a peça dissolve numa faixa, o texto em outra, e a loja entra numa terceira.
 */
export function phase(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0;
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / (end - start);
}
