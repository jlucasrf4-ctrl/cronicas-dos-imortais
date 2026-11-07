/* ==== Fase 4 — consultas das árvores num herói (rank do nó, valor, sinergia, estado). Saiu de base/01 (v3.8) ==== */
import { GENETICS } from "../data/nascimento.ts";
import { NODE_BY_ID, SYNERGIES } from "../data/arvores.ts";
import type { NODES } from "../data/arvores.ts";
import type { Hero } from "../core/tipos.ts";

export function nodeRank(h: Hero | null | undefined, id: string) {
  if (!h || !h.nodes || !h.nodes[id]) return 0;
  const G = GENETICS[h.gen];
  return G && G.fav.indexOf(id) >= 0 ? 2 : 1;
}
export function nv(h: Hero, id: string, def: number) {
  const r = nodeRank(h, id);
  return r ? NODE_BY_ID[id].v[r - 1] : def;
}
export function synOn(h: Hero, id: string) {
  const s = SYNERGIES.find((x) => x.id === id);
  return !!s && s.needs.every((n) => nodeRank(h, n) > 0);
}
export function nodeState(h: Hero, n: (typeof NODES)[number]) {
  // owned | open | locked | blocked
  if (h.nodes[n.id]) return "owned";
  if (n.only && n.only !== h.aff) return "blocked";
  if (n.req && !h.nodes[n.req]) return "locked";
  return "open";
}
