/** Remove ilhas do recorte do busto; a malha conectada à cabeça permanece intacta. */
export interface LimpezaFragmentosCabeca {
  /** Altura máxima de todos os vértices da ilha, em medidas olhos→queixo (queixo = 0). */
  topoMax: number;
  trisMax: number;
}

/** P está em Int16×1000 nas medidas da cabeça. Não altera posições nem ordem das faces conservadas. */
export function limparFragmentosCabeca(P: ArrayLike<number>, I: ArrayLike<number>, ajuste: LimpezaFragmentosCabeca) {
  const pai = Int32Array.from({ length: P.length / 3 }, (_, v) => v);
  const raiz = (v: number): number => {
    while (pai[v] !== v) v = pai[v] = pai[pai[v]];
    return v;
  };
  // Uma costura de UV pode duplicar a posição: ela continua sendo a mesma superfície conectada.
  const solda = new Map<string, number>();
  for (let v = 0; v < pai.length; v++) {
    const chave = [0, 1, 2].map((e) => P[v * 3 + e]).join(","),
      anterior = solda.get(chave);
    if (anterior == null) solda.set(chave, v);
    else pai[raiz(v)] = raiz(anterior);
  }
  for (let t = 0; t < I.length; t += 3) {
    pai[raiz(I[t + 1])] = raiz(I[t]);
    pai[raiz(I[t + 2])] = raiz(I[t]);
  }
  const grupos = new Map<number, { tris: number[]; topo: number }>();
  for (let t = 0; t < I.length / 3; t++) {
    const r = raiz(I[t * 3]);
    let g = grupos.get(r);
    if (!g) grupos.set(r, (g = { tris: [], topo: -Infinity }));
    g.tris.push(t);
    for (let k = 0; k < 3; k++) g.topo = Math.max(g.topo, P[I[t * 3 + k] * 3 + 1] / 1000);
  }
  const maior = Math.max(0, ...[...grupos.values()].map((g) => g.tris.length));
  const removidos = new Set<number>();
  for (const g of grupos.values())
    if (g.tris.length !== maior && g.tris.length <= ajuste.trisMax && g.topo < Math.min(0, ajuste.topoMax)) {
      for (const t of g.tris) removidos.add(t);
    }
  return {
    tris: Array.from({ length: I.length / 3 }, (_, t) => t).filter((t) => !removidos.has(t)),
    removidos: [...removidos],
  };
}
