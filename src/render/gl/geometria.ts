/* ==== Fase 4 ====
   geometria do renderizador WebGL: matrizes 4x4 (M4, coluna a coluna como o GL espera), icosaedro (ICO) e o limite
   de faces lisas (SMOOTH_COS). Saíram de base/11 (v3.12) e v4.6 */

/** Um ponto 3D [x, y, z] (M4.ap devolve um; dá para espalhar em M4.T(...p)). */
export type Vec3 = [number, number, number];
/** Matriz 4x4 em coluna: as de M4 são Float32Array; algumas montadas à mão são number[]. */
export type Mat4 = number[] | Float32Array;
export const M4 = {
  id() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  mul(a: Mat4, b: Mat4) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    return o;
  },
  T(x: number, y: number, z: number) {
    const m = M4.id();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  },
  S(x: number, y?: number, z?: number) {
    const m = M4.id();
    m[0] = x;
    m[5] = y == null ? x : y;
    m[10] = z == null ? x : z;
    return m;
  },
  RX(a: number) {
    const m = M4.id(),
      c = Math.cos(a),
      s = Math.sin(a);
    m[5] = c;
    m[6] = s;
    m[9] = -s;
    m[10] = c;
    return m;
  },
  RY(a: number) {
    const m = M4.id(),
      c = Math.cos(a),
      s = Math.sin(a);
    m[0] = c;
    m[2] = -s;
    m[8] = s;
    m[10] = c;
    return m;
  },
  RZ(a: number) {
    const m = M4.id(),
      c = Math.cos(a),
      s = Math.sin(a);
    m[0] = c;
    m[1] = s;
    m[4] = -s;
    m[5] = c;
    return m;
  },
  ch(...ms: Mat4[]) {
    return ms.reduce((a, b) => M4.mul(a, b));
  },
  ap(m: Mat4, x: number, y: number, z: number): Vec3 {
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
  },
  look(e: number[], t: number[], u: number[]) {
    let z = [e[0] - t[0], e[1] - t[1], e[2] - t[2]];
    let l = Math.hypot(...z);
    z = z.map((v) => v / l);
    let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]];
    l = Math.hypot(...x);
    x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]],
      d = (a: number[]) => a[0] * e[0] + a[1] * e[1] + a[2] * e[2],
      m = M4.id();
    m[0] = x[0];
    m[1] = y[0];
    m[2] = z[0];
    m[4] = x[1];
    m[5] = y[1];
    m[6] = z[1];
    m[8] = x[2];
    m[9] = y[2];
    m[10] = z[2];
    m[12] = -d(x);
    m[13] = -d(y);
    m[14] = -d(z);
    return m;
  },
  ortho(l: number, r: number, b: number, t: number, n: number, f: number) {
    const m = M4.id();
    m[0] = 2 / (r - l);
    m[5] = 2 / (t - b);
    m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l);
    m[13] = -(t + b) / (t - b);
    m[14] = -(f + n) / (f - n);
    return m;
  },
};
export const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2,
    v = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ].map((p) => {
      const l = Math.hypot(...p);
      return p.map((q) => q / l);
    });
  return {
    v,
    f: [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ],
  };
})();
export const SMOOTH_COS = 0.2; // faces com ângulo < ~78° entre si ficam lisas; quinas de caixa continuam retas

// estado da montagem de malhas (eram let do legado: semente de grnd, detalhe extra, borda do chão, id das peças fixas)
interface EstadoMalha {
  _gs: number;
  _icoBoost: number;
  FLOOR_B: { x0: number; x1: number; z0: number; z1: number; T: number } | null;
  _statUid: number;
}
export const MALHA: EstadoMalha = {
  _gs: 7,
  _icoBoost: 0,
  /* chão pintado: cor por vértice (manchas suaves, sem xadrez) */
  FLOOR_B: null,
  // cena estática marcada (para o cache de sombra)
  _statUid: 0,
};
