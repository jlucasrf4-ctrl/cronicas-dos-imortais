/** Refino local da transição do busto integral; não altera índices, pesos, UV ou anatomia fora das faixas. */
import type { Anim } from "../../src/render/gl/esqueleto.ts";

export interface HarmonizacaoBusto {
  contraste: number;
  fatorMin: number;
  fatorMax: number;
}
type Faixa = [number, number, number, number];
export interface SuavizacaoBusto {
  cinturaY: Faixa;
  bracoZ: Faixa;
  bracoY: Faixa;
  ciclos: number;
  lambda: number;
  mu: number;
  deslocamentoMax: number;
}

/** Reduz o contraste das sombras pintadas do corpo antigo, usando a referência do busto novo. */
export function harmonizarPeleInferior(
  A: Anim,
  mascara: ArrayLike<number>,
  referencia: number[],
  ajuste: HarmonizacaoBusto,
): Anim {
  const luminancias: number[] = [];
  const lum = (t: number) => 0.3 * A.C[t * 3] + 0.59 * A.C[t * 3 + 1] + 0.11 * A.C[t * 3 + 2];
  for (let t = 0; t < mascara.length; t++) if (mascara[t] === 1) luminancias.push(lum(t));
  const mediana = luminancias.sort((a, b) => a - b)[luminancias.length >> 1];
  if (!mediana) return A;
  const C = A.C.slice();
  for (let t = 0; t < mascara.length; t++)
    if (mascara[t] === 1) {
      const f = Math.max(ajuste.fatorMin, Math.min(ajuste.fatorMax, 1 + (lum(t) / mediana - 1) * ajuste.contraste));
      for (let e = 0; e < 3; e++) C[t * 3 + e] = Math.min(1, (referencia[e] / 255) * f);
    }
  return { ...A, C };
}

/** Taubin com pesos locais: duas passadas de sinais opostos evitam encolher cada transição. */
export function suavizarTransicoes(A: Anim, ajuste: SuavizacaoBusto): Anim {
  const viz = Array.from({ length: A.P.length / 3 }, () => new Set<number>());
  for (let t = 0; t < A.I.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = A.I[t + k],
        b = A.I[t + ((k + 1) % 3)];
      viz[a].add(b);
      viz[b].add(a);
    }
  const suave = (a: number, b: number, x: number) => {
    const f = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return f * f * (3 - 2 * f);
  };
  const faixa = (f: Faixa, x: number) => suave(f[0], f[1], x) * (1 - suave(f[2], f[3], x));
  const fator = Array.from(viz, (_, v) => {
    const y = A.P[v * 3 + 1],
      z = Math.abs(A.P[v * 3 + 2]);
    return Math.max(faixa(ajuste.cinturaY, y), faixa(ajuste.bracoZ, z) * faixa(ajuste.bracoY, y));
  });
  let P = A.P.slice();
  for (let i = 0; i < ajuste.ciclos; i++)
    for (const lambda of [ajuste.lambda, ajuste.mu]) {
      const Q = P.slice();
      for (let v = 0; v < viz.length; v++)
        if (fator[v] && viz[v].size)
          for (let e = 0; e < 3; e++) {
            let media = 0;
            for (const n of viz[v]) media += P[n * 3 + e];
            media /= viz[v].size;
            Q[v * 3 + e] = P[v * 3 + e] + (media - P[v * 3 + e]) * lambda * fator[v];
          }
      P = Q;
    }
  // O limite mede o deslocamento total, não somente o da última passada.
  for (let v = 0; v < viz.length; v++) {
    const d = Math.hypot(...[0, 1, 2].map((e) => P[v * 3 + e] - A.P[v * 3 + e]));
    if (d > ajuste.deslocamentoMax)
      for (let e = 0; e < 3; e++)
        P[v * 3 + e] = A.P[v * 3 + e] + ((P[v * 3 + e] - A.P[v * 3 + e]) * ajuste.deslocamentoMax) / d;
  }
  return { ...A, P };
}
