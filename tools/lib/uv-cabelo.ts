/* 2026-11-07 — triângulos de cabelo com a cor da pele na textura (o UV deles caiu na pele da folha ao reduzir a malha):
   na busto_15 aparecia um triângulo laranja no alto da nuca, no meio do cabelo escuro (captura do mantenedor de costas).
   Um triângulo marcado como cabelo (máscara 2) cuja cor na textura está perto da pele e longe do cabelo, cercado pelos
   três lados (por aresta) de cabelo com cor de cabelo, passa a usar o UV do vizinho mais parecido com o cabelo. Só o
   ponto isolado: nas cabeças raspadas o "cabelo" cor de pele em volta é de verdade. Usado por tools/gerar-aparencias.ts
   (ao gerar) e tools/corrigir-uv-cabelo.ts (nos dados já gerados). */

export interface Textura {
  data: Uint8Array | Buffer;
  w: number;
  h: number;
}

const dist = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Corrige no lugar os UVs (Uint16, 6 por triângulo, ÷65535) dos triângulos de cabelo com cor de pele.
 * `I`: índices (3 por triângulo); `mascara`: a parte de cada triângulo (2 = cabelo); `branco`: o (u, v) do pixel branco
 * (triângulos fora da textura). Devolve os triângulos corrigidos.
 */
export function corrigirUvCabelo(
  I: ArrayLike<number>,
  uv: Uint16Array,
  mascara: ArrayLike<number>,
  tex: Textura,
  refs: { pele: number[]; cabelo: number[] },
  branco?: number[],
): number[] {
  const nt = I.length / 3,
    cor = (t: number) => {
      const u = (uv[t * 6] + uv[t * 6 + 2] + uv[t * 6 + 4]) / 3 / 65535,
        v = (uv[t * 6 + 1] + uv[t * 6 + 3] + uv[t * 6 + 5]) / 3 / 65535,
        x = Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w))),
        y = Math.min(tex.h - 1, Math.max(0, Math.floor(v * tex.h))),
        o = (y * tex.w + x) * 3;
      return [tex.data[o], tex.data[o + 1], tex.data[o + 2]];
    },
    naTextura = (t: number) =>
      !branco || Math.abs(uv[t * 6] / 65535 - branco[0]) > 1e-4 || Math.abs(uv[t * 6 + 1] / 65535 - branco[1]) > 1e-4;
  // vizinhos por aresta
  const arestas = new Map<number, number[]>();
  for (let t = 0; t < nt; t++)
    for (let k = 0; k < 3; k++) {
      const a = I[t * 3 + k],
        b = I[t * 3 + ((k + 1) % 3)],
        chave = a < b ? a * 65536 + b : b * 65536 + a;
      (arestas.get(chave) ?? arestas.set(chave, []).get(chave)!).push(t);
    }
  const corrigidos: number[] = [];
  for (let t = 0; t < nt; t++) {
    if (mascara[t] !== 2 || !naTextura(t)) continue;
    const c = cor(t),
      dP = dist(c, refs.pele),
      dC = dist(c, refs.cabelo);
    if (!(dP < 45 && dC > 80 && dP < 0.5 * dC)) continue;
    let melhor = -1,
      menor = Infinity,
      cabelos = 0;
    for (let k = 0; k < 3; k++) {
      const a = I[t * 3 + k],
        b = I[t * 3 + ((k + 1) % 3)];
      for (const n of arestas.get(a < b ? a * 65536 + b : b * 65536 + a) ?? []) {
        if (n === t || mascara[n] !== 2 || !naTextura(n)) continue;
        const cn = cor(n),
          dn = dist(cn, refs.cabelo);
        if (dn >= dist(cn, refs.pele)) continue;
        cabelos++;
        if (dn < menor) {
          menor = dn;
          melhor = n;
        }
      }
    }
    if (cabelos < 3 || melhor < 0) continue;
    const u = Math.round((uv[melhor * 6] + uv[melhor * 6 + 2] + uv[melhor * 6 + 4]) / 3),
      v = Math.round((uv[melhor * 6 + 1] + uv[melhor * 6 + 3] + uv[melhor * 6 + 5]) / 3);
    for (let k = 0; k < 3; k++) {
      uv[t * 6 + k * 2] = u;
      uv[t * 6 + k * 2 + 1] = v;
    }
    corrigidos.push(t);
  }
  return corrigidos;
}
