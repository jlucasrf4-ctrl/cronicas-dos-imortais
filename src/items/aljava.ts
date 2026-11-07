/* ==== Fase 4 — flechas como item na aljava (v5.5, v6.6) ==== */
import { canPlace, rotShape, ensureInv, INV } from "./inventario.ts";
import { econ, dungeon } from "../core/state.ts";
import { moveItem, updateEcon } from "../econ/economia.ts";
import { QV_STACK } from "../data/recursos.ts";
import { qvInv, resCount, resSpend, arrowCap } from "../expedicao/preparo.ts";
import { mkItem } from "./equipamento.ts";
import { ISC, itemTakeH, arrowCraftRender, itemCnt } from "../intro/cena.ts";
import { sfx } from "../field/chao.ts";
import { gainSkill } from "../hero/nivel.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { itemMsg } from "../field/masmorra.ts";
import { invHeroNow } from "../ui/inventario.ts";
import type { GradeTela, Hero, InvGrid, Item } from "../core/tipos.ts";

export function isArrowIt(it: Item) {
  return !!(it && it.def && it.def.key === "flecha");
}
export function qvPlace(inv: InvGrid, b: Item) {
  let sh = b.shape;
  for (let r = 0; r < 2; r++) {
    for (let y = 0; y < inv.rows; y++)
      for (let x = 0; x < inv.cols; x++)
        if (canPlace(inv, sh, x, y, b)) {
          b.x = x;
          b.y = y;
          b.shape = sh;
          inv.items.push(b);
          return true;
        }
    sh = rotShape(sh);
  }
  return false;
}
function qvShapeFor(b: Item, n: number) {
  const vert = b.shape.length >= b.shape[0].length,
    w = n >= 2 ? 2 : 1;
  return vert
    ? Array.from({ length: 9 }, () => new Array(w).fill(1))
    : Array.from({ length: w }, () => new Array(9).fill(1));
}
function qvFit(inv: InvGrid, b: Item, n: number) {
  // ajusta a forma do pacote (2×9, ou 1×9 com 1 flecha); se não couber no lugar, tenta outro lugar
  const sh = qvShapeFor(b, n);
  if (sh.length === b.shape.length && sh[0].length === b.shape[0].length) return true;
  if (canPlace(inv, sh, b.x, b.y, b)) {
    b.shape = sh;
    return true;
  }
  const i = inv.items.indexOf(b);
  if (i < 0) return false;
  inv.items.splice(i, 1);
  const old = { x: b.x, y: b.y, shape: b.shape };
  b.shape = sh;
  if (qvPlace(inv, b)) return true;
  b.x = old.x;
  b.y = old.y;
  b.shape = old.shape;
  inv.items.push(b);
  return false;
}
function qvBounds(h: Hero, inv: InvGrid) {
  // aljava ficou mais fina: o que ficou fora da grade volta para dentro (ou vai para a mochila)
  for (const it of inv.items.slice()) {
    if (it.x + it.shape[0].length <= inv.cols && it.y + it.shape.length <= inv.rows && it.x >= 0 && it.y >= 0) continue;
    inv.items.splice(inv.items.indexOf(it), 1);
    if (isArrowIt(it)) continue; // o pacote é recriado pelo total de flechas
    let ok = false,
      sh = it.shape;
    for (let r = 0; r < 4 && !ok; r++) {
      for (let y = 0; y < inv.rows && !ok; y++)
        for (let x = 0; x < inv.cols && !ok; x++)
          if (canPlace(inv, sh, x, y, it)) {
            it.x = x;
            it.y = y;
            it.shape = sh;
            inv.items.push(it);
            ok = true;
          }
      sh = rotShape(sh);
    }
    if (!ok) {
      inv.items.push(it);
      if (!moveItem(it, inv, ensureInv(h))) moveItem(it, inv, econ.stash);
    }
  }
}
export function qvSync(h: Hero) {
  if (!h) return;
  const inv = qvInv(h),
    q = econ.quiver;
  qvBounds(h, inv);
  const B = inv.items.filter(isArrowIt);
  let tot = 0;
  for (const b of B) tot += b.n || 0;
  let diff = q.n - tot;
  if (diff < 0) {
    for (let i = B.length - 1; i >= 0 && diff < 0; i--) {
      const t = Math.min(B[i].n || 0, -diff);
      B[i].n! -= t;
      diff += t;
    }
  } else if (diff > 0) {
    for (const b of B) {
      const r = Math.min(QV_STACK - (b.n || 0), diff);
      if (r > 0 && qvFit(inv, b, (b.n || 0) + r)) {
        b.n = (b.n || 0) + r;
        diff -= r;
      }
      if (diff <= 0) break;
    }
    while (diff > 0) {
      const b = mkItem("flecha");
      b.n = Math.min(QV_STACK, diff);
      b.shape = qvShapeFor(b, b.n);
      if (!qvPlace(inv, b)) {
        q.n -= diff;
        econ.arrowStock = (econ.arrowStock || 0) + diff;
        break;
      }
      diff -= b.n;
    }
  }
  for (let i = inv.items.length - 1; i >= 0; i--)
    if (isArrowIt(inv.items[i]) && !(inv.items[i].n! > 0)) inv.items.splice(i, 1);
  for (const b of inv.items.slice()) if (isArrowIt(b)) qvFit(inv, b, b.n!);
}

/* ---------- fazer flechas: SEGURE o botão e a barra sobe (lascar → encaixar → amarrar) ---------- */
export function arrowMakeOne() {
  const h = dungeon.hero,
    A = ISC.ac;
  const p = resCount(h!, "feather") > 0;
  itemTakeH(h!, "galho", 1);
  resSpend(h!, "stone", 1);
  if (p) resSpend(h!, "feather", 1);
  const n = p ? 3 : 2;
  econ.quiver.n += n;
  A!.made += n;
  sfx("perfect");
  gainSkill(h!, "arco", 2);
  updateEcon();
  arrowCraftRender(
    "✨ +" +
      n +
      " flechas! " +
      (itemCnt(h!, "galho") && resCount(h!, "stone") ? "Dá para fazer mais." : "Acabaram os materiais."),
  );
}

export function arrowsToBag(pack: Item, fromG: GradeTela, inv: InvGrid, sh?: number[][], gx?: number, gy?: number) {
  const h = invHeroNow();
  if (!h || !inv) return false;
  const n = Math.min(pack.n || 0, econ.quiver.n);
  if (n <= 0) return false;
  const b = {
    uid: ++INV.invUid,
    def: ITEM_DEFS.feixe_flechas,
    x: 0,
    y: 0,
    shape: (sh || pack.shape).map((r: number[]) => r.slice()),
    tier: 0,
    n,
  };
  let ok = false;
  if (gx != null && canPlace(inv, b.shape, gx, gy!, b)) {
    b.x = gx;
    b.y = gy!;
    ok = true;
  } else {
    let s = b.shape;
    for (let r = 0; r < 2 && !ok; r++) {
      for (let y = 0; y < inv.rows && !ok; y++)
        for (let x = 0; x < inv.cols && !ok; x++)
          if (canPlace(inv, s, x, y, b)) {
            b.x = x;
            b.y = y;
            b.shape = s;
            ok = true;
          }
      s = rotShape(s);
    }
  }
  if (!ok) {
    itemMsg("Sem espaço na mochila para o feixe de flechas.");
    return false;
  }
  inv.items.push(b);
  econ.quiver.n -= n;
  try {
    qvSync(h);
  } catch (_) {}
  itemMsg("🏹 " + n + " flecha(s) guardadas na mochila — recarregue a aljava para usar.");
  updateEcon();
  return true;
}
export function bundleReload(b: Item, inv: InvGrid) {
  const h = invHeroNow();
  if (!h) return;
  const room = Math.max(0, arrowCap(h) - econ.quiver.n),
    t = Math.min(room, b.n || 1);
  if (t <= 0) {
    itemMsg("A aljava está cheia.");
    return;
  }
  econ.quiver.n += t;
  b.n = (b.n || 1) - t;
  if (b.n <= 0) {
    const i = inv.items.indexOf(b);
    if (i >= 0) inv.items.splice(i, 1);
  }
  try {
    qvSync(h);
  } catch (_) {}
  sfx("ping");
  itemMsg("🏹 Aljava recarregada: +" + t + " flecha(s)" + (b.n > 0 ? " (sobraram " + b.n + " no feixe)" : ""));
  updateEcon();
}
