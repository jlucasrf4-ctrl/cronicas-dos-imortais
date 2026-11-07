/* ==== Fase 4 — arte dos itens: gemas, pedras, materiais por estágio (v5.9.07) ==== */
import { GEMS, ST3, STONES, GEM_ST } from "../data/arte.ts";
import type { Item } from "../core/tipos.ts";

/* ==== v5.9.07 — arte nova: gemas com tipo/estágio/forma, materiais por estágio, carnes por animal,
   molduras em 5 estágios, fichas dos animais (retrato + variações) e botão "comprar todas as armas" ==== */
function rollGemType() {
  let r = Math.random() * Object.values(GEMS).reduce((a, g) => a + g.w, 0);
  for (const k in GEMS) {
    r -= GEMS[k].w;
    if (r <= 0) return k;
  }
  return "rubi";
}
export function gemStage(it: Item) {
  return it.stage || Math.min(5, 1 + (it.tier | 0));
}
export function gemDecor(it: Item) {
  if (!it || !it.def || it.def.key !== "gema") return it;
  if (!it.gem || !GEMS[it.gem]) it.gem = rollGemType();
  if (it.gv == null) it.gv = Math.random() < 0.3 ? 0 : 1 + Math.floor(Math.random() * 997);
  return it;
}
export function meatDecor(it: Item) {
  if (!it || !it.def) return it;
  const k = it.def.key;
  if ((k === "carne" || k === "carne_assada") && !it.an)
    it.an = ["lobo", "javali", "cervo", "coelho"][Math.floor(Math.random() * 4)];
  if (k === "peixe") it.an = "peixe";
  if (k === "carne_assada" && it.cv == null) it.cv = Math.floor(Math.random() * 4);
  return it;
}
export function matStage(it: Item) {
  return ST3[Math.min(2, it.tier | 0)];
}
function rollStone() {
  let r = Math.random() * Object.values(STONES).reduce((a, g) => a + g.w, 0);
  for (const k in STONES) {
    r -= STONES[k].w;
    if (r <= 0) return k;
  }
  return "jaspe";
}
export function stoneDecor(it: Item) {
  if (!it || !it.def) return it;
  if (it.def.key === "pedra_rara" && !STONES[it.st!]) it.st = rollStone();
  if (it.pv == null) it.pv = Math.floor(Math.random() * 997);
  return it;
}

export function gemName(it: Item) {
  gemDecor(it);
  const g = GEMS[it.gem!],
    s = gemStage(it);
  return g.n + " " + GEM_ST[s]![g.f];
}
export function itName(it: Item) {
  if (!it || !it.def) return "";
  const k = it.def.key;
  if (k === "gema") return gemName(it);
  if (k === "pedra_rara") {
    stoneDecor(it);
    return STONES[it.st!].n;
  }
  if (k === "carne" || k === "carne_assada") {
    meatDecor(it);
    const a = (
      { lobo: "Lobo", coelho: "Coelho", javali: "Javali", cervo: "Cervo", pato: "Pato", peixe: "Peixe" } as Record<
        string,
        string
      >
    )[it.an!];
    return it.def.name + (a ? " de " + a : "");
  }
  return it.def.name;
}
