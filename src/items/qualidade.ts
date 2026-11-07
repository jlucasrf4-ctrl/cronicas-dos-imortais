/* ==== Fase 4 — qualidade dos itens (A / A+ / SS): forma, valor, venda (base/17) ==== */
import { CACA, dungeon } from "../core/state.ts";
import { ITEM_DEFS, SUB } from "../data/itens.ts";
import { dilate, TIERS, itemValBase, INV } from "./inventario.ts";
import { meatShape } from "../map/caca.ts";
import { lootInfo } from "../field/masmorra.ts";
import { stoneDecor, gemDecor, gemStage } from "./arte.ts";
import { STONES, GEMS } from "../data/arte.ts";
import { isArrowIt } from "./aljava.ts";
import { dropToGround, groundTake } from "../field/chao.ts";
import { moveItem, cityPrice } from "../econ/economia.ts";
import type { GradeTela, Item, LootChao } from "../core/tipos.ts";
import type { Cidade } from "../data/economia.ts";

/* ===== v3.10: QUALIDADE DOS ITENS (A / A+ / SS) — vale mais e ocupa formas diferentes ===== */
export function tierShape(key: string, t: number) {
  /* v5.9.11 */
  if (key === "carne") return meatShape(CACA.MEAT_SRC || "lobo", t);
  const def = ITEM_DEFS[key];
  t = t | 0;
  const sh = def.shape!.map((r) => r.slice());
  if (!t || (sh.length <= SUB && sh[0].length <= SUB)) return sh; // itens que cabem na aljava mantêm o tamanho e só ganham valor
  return dilate(sh, t === 1 ? "x" : "xy"); // A+ fica mais larga, SS mais larga e mais alta
}
export function lootName(l: LootChao) {
  const d = lootInfo(l);
  return d.name + (l.tier ? " " + TIERS[l.tier].lab : "");
}

export function itemVal(it: Item) {
  const v = itemValBase(it);
  /* v5.9.07 */
  if (it && it.def && it.def.key === "pedra_rara") {
    stoneDecor(it);
    return Math.round(v * STONES[it.st!].v);
  }
  if (it && it.def && it.def.key === "gema") {
    gemDecor(it);
    const s = gemStage(it);
    return Math.round(v * GEMS[it.gem!].val * (1 + Math.max(0, s - 1 - (it.tier | 0)) * 0.35));
  }
  return v;
}
export function quickMove(it: Item, gr: GradeTela) {
  const ok = quickMoveBase(it, gr);
  /* v5.9.03 — ---- itens da aljava voltam para a mochila ou para o chão ---- */
  if (!ok && gr.inv.qv && !isArrowIt(it) && dungeon.active && dungeon.invOpen) {
    dropToGround(it, gr.inv);
    return true;
  }
  return ok;
}
function quickMoveBase(it: Item, gr: GradeTela) {
  // Ctrl+clique: manda o item (ou a pilha) para a outra mochila
  for (const o of INV.invGrids) {
    if (o.el === gr.el || o.inv.ground) continue;
    if (it.def.res) {
      for (const t of o.inv.items) {
        if (t !== it && t.def.key === it.def.key && (t.n || 1) < t.def.stack! && (it.n || 1) > 0) {
          const q = Math.min(t.def.stack! - (t.n || 1), it.n || 1);
          t.n = (t.n || 1) + q;
          it.n = (it.n || 1) - q;
        }
      }
      if ((it.n || 1) <= 0) {
        gr.inv.items.splice(gr.inv.items.indexOf(it), 1);
        return true;
      }
    }
    if (moveItem(it, gr.inv, o.inv)) {
      if (gr.inv.ground) groundTake(it);
      return true;
    }
  }
  return false;
}

export function itemSell(city: Cidade, it: Item) {
  return cityPrice(city, it.def.key, it.tier) * (it.n || 1);
}
