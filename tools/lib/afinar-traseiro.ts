/** Reduz suavemente a projeção traseira na região do quadril. As malhas usam +Z como frente. */
export function afinarTraseiro(P: { length: number; [i: number]: number }, fator: number) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    x0 = Math.min(x0, P[i]);
    x1 = Math.max(x1, P[i]);
    y0 = Math.min(y0, P[i + 1]);
    y1 = Math.max(y1, P[i + 1]);
  }
  const altura = y1 - y0 || 1,
    meiaLargura = (x1 - x0) / 2 || 1,
    suave = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
  for (let i = 0; i < P.length; i += 3) {
    const y = (P[i + 1] - y0) / altura,
      x = Math.abs(P[i]) / meiaLargura,
      vertical = suave(0.34, 0.47, y) * (1 - suave(0.62, 0.75, y)),
      centro = 1 - suave(0.72, 1, x);
    if (P[i + 2] < 0) P[i + 2] *= 1 - (1 - fator) * vertical * centro;
  }
}
