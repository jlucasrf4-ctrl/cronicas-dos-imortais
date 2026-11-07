import { describe, expect, it } from "vitest";
import type { Anim } from "../../src/render/gl/esqueleto.ts";
import { harmonizarPeleInferior, suavizarTransicoes, type SuavizacaoBusto } from "../../tools/lib/refinar-busto.ts";

const ajuste: SuavizacaoBusto = {
  cinturaY: [24, 26.5, 30, 32],
  bracoZ: [5, 6.4, 8.2, 10],
  bracoY: [31, 33, 35.5, 37],
  ciclos: 10,
  lambda: 0.42,
  mu: -0.44,
  deslocamentoMax: 0.22,
};
function malha(): Anim {
  const P: number[] = [],
    I: number[] = [];
  const ys = [0, 12, 23, 25, 28, 31, 34, 36, 38, 42],
    zs = [-11, -9, -7, 0, 7, 9, 11];
  for (const [i, y] of ys.entries()) for (const [j, z] of zs.entries()) P.push((i + j) % 2 ? 0.4 : -0.4, y, z);
  for (let i = 0; i < ys.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const v = i * zs.length + j;
      I.push(v, v + 1, v + zs.length, v + 1, v + zs.length + 1, v + zs.length);
    }
  const nv = P.length / 3,
    ini = new Uint32Array(nv + 1);
  for (const v of I) ini[v + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const cantos = new Uint32Array(I.length),
    pos = ini.slice();
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  const identidade = Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return {
    P: Float32Array.from(P),
    I: Uint16Array.from(I),
    C: Float32Array.from({ length: I.length }, (_, i) => [0.8, 0.5, 0.3][i % 3] * (1 - (Math.floor(i / 3) % 3) * 0.15)),
    J: new Uint8Array(nv * 4),
    W: Float32Array.from({ length: nv * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
    UV: new Float32Array(I.length * 2),
    tex: "atlas",
    juntas: ["Root"],
    pais: [-1],
    repouso: new Float32Array(3),
    raiz: identidade,
    ibm: identidade,
    clips: {},
    ini,
    cantos,
  };
}
describe("refino local do busto integral", () => {
  it("preserva cabeça, cabelo e pernas e limita o deslocamento das transições", () => {
    const A = malha(),
      antes = A.P.slice(),
      R = suavizarTransicoes(A, ajuste);
    let alterados = 0;
    for (let v = 0; v < A.P.length / 3; v++) {
      const d = Math.hypot(...[0, 1, 2].map((e) => R.P[v * 3 + e] - A.P[v * 3 + e]));
      expect(d).toBeLessThanOrEqual(0.220001);
      if (d) alterados++;
      if (A.P[v * 3 + 1] > 37 || A.P[v * 3 + 1] < 24)
        expect(R.P.slice(v * 3, v * 3 + 3)).toEqual(A.P.slice(v * 3, v * 3 + 3));
    }
    expect(alterados).toBeGreaterThan(0);
    expect(A.P).toEqual(antes);
    for (const campo of ["I", "UV", "J", "W", "C", "ini", "cantos"] as const) expect(R[campo]).toBe(A[campo]);
  });
  it("harmoniza somente pele e preserva olhos, cabelo e detalhes", () => {
    const A = malha(),
      antes = A.C.slice();
    const mask = Uint8Array.from({ length: A.I.length / 3 }, (_, t) => t % 4),
      ref = [217, 126, 72];
    const R = harmonizarPeleInferior(A, mask, ref, { contraste: 0.22, fatorMin: 0.87, fatorMax: 1.1 });
    for (let t = 0; t < mask.length; t++)
      for (let e = 0; e < 3; e++) {
        if (mask[t] !== 1) expect(R.C[t * 3 + e]).toBe(A.C[t * 3 + e]);
        else expect(R.C[t * 3 + e]).toBeGreaterThanOrEqual((ref[e] / 255) * 0.87 - 1e-7);
      }
    expect(A.C).toEqual(antes);
    for (const campo of ["P", "I", "UV", "J", "W"] as const) expect(R[campo]).toBe(A[campo]);
  });
});
