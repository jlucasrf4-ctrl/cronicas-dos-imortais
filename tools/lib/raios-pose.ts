/* 2026-11-06 — raios curtos contra uma malha deformada (posições por canto, 9 números por triângulo, como
   deformarMalha devolve): a grade de triângulos e a distância até a primeira face ao longo do raio. Usado por
   tools/diagnosticar-vazamentos.ts e tools/cobrir-pele.ts (pele × roupa nas poses). */

/** Grade de triângulos (posições por canto) para os raios curtos. */
export function grade(p: Float32Array, cel: number) {
  const g = new Map<string, number[]>(),
    nt = p.length / 9;
  for (let t = 0; t < nt; t++) {
    let x0 = Infinity,
      y0 = Infinity,
      z0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity,
      z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const o = t * 9 + k * 3;
      x0 = Math.min(x0, p[o]);
      x1 = Math.max(x1, p[o]);
      y0 = Math.min(y0, p[o + 1]);
      y1 = Math.max(y1, p[o + 1]);
      z0 = Math.min(z0, p[o + 2]);
      z1 = Math.max(z1, p[o + 2]);
    }
    for (let i = Math.floor(x0 / cel); i <= Math.floor(x1 / cel); i++)
      for (let j = Math.floor(y0 / cel); j <= Math.floor(y1 / cel); j++)
        for (let k = Math.floor(z0 / cel); k <= Math.floor(z1 / cel); k++) {
          const key = i + "," + j + "," + k;
          let l = g.get(key);
          if (!l) g.set(key, (l = []));
          l.push(t);
        }
  }
  return g;
}

/** Distância até a primeira face ao longo do raio (o, d), até `max`; Infinity se nada. */
export function raio(
  p: Float32Array,
  g: Map<string, number[]>,
  cel: number,
  o: ArrayLike<number>,
  d: ArrayLike<number>,
  max: number,
) {
  const vistos = new Set<number>();
  let melhor = Infinity;
  for (let s = 0; s <= max + 1e-6; s += cel * 0.5) {
    const key =
      Math.floor((o[0] + d[0] * s) / cel) +
      "," +
      Math.floor((o[1] + d[1] * s) / cel) +
      "," +
      Math.floor((o[2] + d[2] * s) / cel);
    for (const t of g.get(key) ?? []) {
      if (vistos.has(t)) continue;
      vistos.add(t);
      const a = t * 9,
        e1x = p[a + 3] - p[a],
        e1y = p[a + 4] - p[a + 1],
        e1z = p[a + 5] - p[a + 2],
        e2x = p[a + 6] - p[a],
        e2y = p[a + 7] - p[a + 1],
        e2z = p[a + 8] - p[a + 2],
        hx = d[1] * e2z - d[2] * e2y,
        hy = d[2] * e2x - d[0] * e2z,
        hz = d[0] * e2y - d[1] * e2x,
        det = e1x * hx + e1y * hy + e1z * hz;
      if (Math.abs(det) < 1e-9) continue;
      const f = 1 / det,
        sx = o[0] - p[a],
        sy = o[1] - p[a + 1],
        sz = o[2] - p[a + 2],
        u = f * (sx * hx + sy * hy + sz * hz);
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y,
        qy = sz * e1x - sx * e1z,
        qz = sx * e1y - sy * e1x,
        v = f * (d[0] * qx + d[1] * qy + d[2] * qz);
      if (v < 0 || u + v > 1) continue;
      const dist = f * (e2x * qx + e2y * qy + e2z * qz);
      if (dist > 1e-4 && dist < melhor && dist <= max) melhor = dist;
    }
  }
  return melhor;
}
