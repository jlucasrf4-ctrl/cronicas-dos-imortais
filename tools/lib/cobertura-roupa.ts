import type { Anim } from "../../src/render/gl/esqueleto.ts";
export function normaisVertice(P: ArrayLike<number>, I: ArrayLike<number>) {
  const N = new Float64Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3,
      b = I[t + 1] * 3,
      c = I[t + 2] * 3;
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]],
      w = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) N[v + k] += n[k];
  }
  for (let v = 0; v < N.length; v += 3) {
    const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1;
    for (let k = 0; k < 3; k++) N[v + k] /= l;
  }
  return N;
}

export function gradeTris(P: ArrayLike<number>, I: ArrayLike<number>, cel: number) {
  const m = new Map<string, number[]>();
  for (let t = 0; t < I.length / 3; t++) {
    const mn = [Infinity, Infinity, Infinity],
      mx = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 3; k++)
      for (let e = 0; e < 3; e++) {
        mn[e] = Math.min(mn[e], P[I[t * 3 + k] * 3 + e]);
        mx[e] = Math.max(mx[e], P[I[t * 3 + k] * 3 + e]);
      }
    for (let a = Math.floor(mn[0] / cel); a <= Math.floor(mx[0] / cel); a++)
      for (let b = Math.floor(mn[1] / cel); b <= Math.floor(mx[1] / cel); b++)
        for (let c = Math.floor(mn[2] / cel); c <= Math.floor(mx[2] / cel); c++) {
          const k = `${a},${b},${c}`,
            l = m.get(k) ?? [];
          l.push(t);
          m.set(k, l);
        }
  }
  return (o: number[], d: number[], ate: number) => {
    const vistos = new Set<number>();
    for (let s = 0; s <= ate; s += cel * 0.5) {
      const p = [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
      for (const t of m.get(`${Math.floor(p[0] / cel)},${Math.floor(p[1] / cel)},${Math.floor(p[2] / cel)}`) ?? []) {
        if (vistos.has(t)) continue;
        vistos.add(t);
        const a = I[t * 3] * 3,
          b = I[t * 3 + 1] * 3,
          c = I[t * 3 + 2] * 3;
        const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]],
          e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
        const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
        const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
        if (Math.abs(det) < 1e-12) continue;
        const f = 1 / det,
          sv = [o[0] - P[a], o[1] - P[a + 1], o[2] - P[a + 2]];
        const u = f * (sv[0] * h[0] + sv[1] * h[1] + sv[2] * h[2]);
        if (u < 0 || u > 1) continue;
        const q = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]];
        const w = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]);
        if (w < 0 || u + w > 1) continue;
        const dist = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
        if (dist > -cel * 0.2 && dist < ate) return true;
      }
    }
    return false;
  };
}

/** Cada peça é examinada sozinha na sua geometria final; não presume que o peitoral acompanha a calça. */
export function coberturaPorPeca(corpo: Anim, roupa: Anim, distancia: number, peFechado = false) {
  let minY = Infinity,
    maxY = -Infinity;
  for (const v of roupa.I) {
    minY = Math.min(minY, roupa.P[v * 3 + 1]);
    maxY = Math.max(maxY, roupa.P[v * 3 + 1]);
  }
  const N = normaisVertice(corpo.P, corpo.I),
    acerta = gradeTris(roupa.P, roupa.I, Math.max(0.25, distancia / 2));
  const braco = (v: number) => {
    let peso = 0;
    for (let k = 0; k < 4; k++) if (/Arm|Hand/.test(corpo.juntas[corpo.J[v * 4 + k]])) peso += corpo.W[v * 4 + k];
    return peso > 0.3;
  };
  const estaCoberto = (p: number[], n: number[], noBraco: boolean) => {
    if (p[1] < minY - distancia || p[1] > maxY) return false;
    if (peFechado && p[1] < maxY - 0.25) return true;
    if (acerta(p, n, distancia)) return true;
    if (noBraco) return false;
    return (
      acerta(
        p,
        n.map((x) => -x),
        distancia * 0.65,
      ) ||
      (Math.abs(n[0]) > 0.5 && acerta(p, [p[0] > 0 ? -1 : 1, 0, 0], distancia))
    );
  };
  const coberto = Uint8Array.from({ length: corpo.P.length / 3 }, (_, v) =>
    estaCoberto(Array.from(corpo.P.subarray(v * 3, v * 3 + 3)), Array.from(N.subarray(v * 3, v * 3 + 3)), braco(v))
      ? 1
      : 0,
  );
  const resultado: number[] = [];
  for (let t = 0; t < corpo.I.length / 3; t++) {
    const ids = [0, 1, 2].map((k) => corpo.I[t * 3 + k]);
    if (!ids.every((v) => coberto[v])) continue;
    // Os três cantos podem cercar a cava ou o decote. Confere também as bordas e o centro da face.
    const amostras = [
      [0.5, 0.5, 0],
      [0, 0.5, 0.5],
      [0.5, 0, 0.5],
      [1 / 3, 1 / 3, 1 / 3],
    ];
    const dentro = amostras.every((ws) => {
      const p = [0, 1, 2].map((e) => ids.reduce((s, v, k) => s + corpo.P[v * 3 + e] * ws[k], 0));
      const n = [0, 1, 2].map((e) => ids.reduce((s, v, k) => s + N[v * 3 + e] * ws[k], 0)),
        l = Math.hypot(...n) || 1;
      return estaCoberto(
        p,
        n.map((x) => x / l),
        ids.some(braco),
      );
    });
    if (!dentro) continue;
    for (const v of ids) for (let e = 0; e < 3; e++) resultado.push(Math.round(corpo.P[v * 3 + e] * 64));
  }
  return Buffer.from(Int16Array.from(resultado).buffer).toString("base64");
}
