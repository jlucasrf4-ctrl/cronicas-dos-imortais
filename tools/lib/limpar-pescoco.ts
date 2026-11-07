/** Remove apenas fragmentos desconectados dentro da região de recorte calibrada para o corpo. */
import type { Anim } from "../../src/render/gl/esqueleto.ts";
import type { Encaixe } from "../../src/render/gl/aparencias.ts";
export interface LimpezaPescoco {
  abaixo: number;
  acima: number;
  raio: number;
  trisMax: number;
}
export function limparIlhasPescoco(A: Anim, tris: number[], e: Encaixe, ajuste: LimpezaPescoco) {
  const nv = A.P.length / 3,
    pai = Int32Array.from({ length: nv }, (_, i) => i);
  const raiz = (v: number): number => {
    let r = v;
    while (pai[r] !== r) r = pai[r];
    while (pai[v] !== v) {
      const n = pai[v];
      pai[v] = r;
      v = n;
    }
    return r;
  };
  // A mesma posição pode aparecer duas vezes por causa de uma costura de UV.
  const soldados = new Map<string, number>();
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      const v = A.I[t * 3 + k],
        chave = [0, 1, 2].map((d) => Math.round(A.P[v * 3 + d] * 1000)).join(",");
      const anterior = soldados.get(chave);
      if (anterior == null) soldados.set(chave, v);
      else pai[raiz(v)] = raiz(anterior);
    }
  for (const t of tris) for (let k = 1; k < 3; k++) pai[raiz(A.I[t * 3 + k])] = raiz(A.I[t * 3]);
  const grupos = new Map<number, number[]>();
  for (const t of tris) {
    const r = raiz(A.I[t * 3]);
    const g = grupos.get(r) ?? [];
    g.push(t);
    grupos.set(r, g);
  }
  const removidos = new Set<number>();
  for (const g of grupos.values()) {
    if (g.length > ajuste.trisMax) continue;
    const perto = g.every((t) =>
      [0, 1, 2].every((k) => {
        const v = A.I[t * 3 + k],
          x = A.P[v * 3],
          y = A.P[v * 3 + 1],
          z = A.P[v * 3 + 2];
        return (
          y >= e.queixo - ajuste.abaixo * e.u &&
          y <= e.queixo + ajuste.acima * e.u &&
          Math.abs(z - e.meio) <= ajuste.raio * e.u &&
          Math.abs(x) <= ajuste.raio * e.u
        );
      }),
    );
    if (perto) for (const t of g) removidos.add(t);
  }
  return { tris: tris.filter((t) => !removidos.has(t)), removidos: [...removidos] };
}
