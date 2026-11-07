/* ==== Fase 4 ====
   inventário em grade: qualidades (TIERS, rollTier, valor base), formas (engordar, girar, contar casinhas), caber
   na grade (canPlace, com a regra da aljava), empilhar (stackTarget) e os pacotes 9/9 (v6.6: capacidade, forma,
   juntar, tirar N). Saiu de base/17 (v3.10), v5.9.01, v6.5 e v6.6 */
import { SUB } from "../data/itens.ts";
import { PACK_KEYS } from "../data/campo.ts";
import { BAU } from "../data/economia.ts";
import { dungeon, econ, world } from "../core/state.ts";
import { icoKeyOf, icoHas } from "../ui/icones.ts";
import { TOAST_ICO } from "../data/icones.ts";
import { LONG_W } from "../data/combate.ts";
import { placeIn } from "./equipamento.ts";
import type { GradeTela, Hero, InvGrid, Item } from "../core/tipos.ts";

export function shapeCells(sh: number[][]) {
  let n = 0;
  for (const r of sh) for (const v of r) n += v ? 1 : 0;
  return n;
}
/* pacotes 9/9: itens pequenos (pena, pedra…) empilham ocupando as casinhas livres do próprio quadrado 3×3 */
export function cellsOf(sh: number[][]) {
  let n = 0;
  for (const r of sh) for (const v of r) if (v) n++;
  return n;
}
/* forma do pacote usa a base de cada item (carne muda de forma por bicho) */
export function packShapeFor(it: Item, n: number) {
  // reescrita na v6.6
  const base = packBaseOf(it),
    want = Math.min(9, base + n - 1),
    core = it._core || it.shape,
    g = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
  let have = 0;
  core.forEach((row: number[], r: number) =>
    row.forEach((v: number, c: number) => {
      if (v && r < 3 && c < 3) {
        g[r][c] = 1;
        have++;
      }
    }),
  );
  for (let r = 0; r < 3 && have < want; r++)
    for (let c = 0; c < 3 && have < want; c++)
      if (!g[r][c]) {
        g[r][c] = 1;
        have++;
      }
  if (want <= base) return core.map((r: number[]) => r.slice());
  return g;
}
function packBaseOf(it: Item) {
  if (it._pb == null) it._pb = it.def.packBase || cellsOf(it._core || it.shape);
  return it._pb;
}
function packFits3(it: Item) {
  const sh = it._core || it.shape;
  return sh.length <= 3 && sh[0].length <= 3;
}
export function packCap(it: Item) {
  if (!PACK_KEYS.includes(it.def.key) || !packFits3(it)) return 1;
  return 1 + Math.max(0, 9 - packBaseOf(it));
}
function packSame(a: Item, b: Item) {
  return (
    a !== b &&
    a.def.key === b.def.key &&
    (a.tier | 0) === (b.tier | 0) &&
    (a.an || null) === (b.an || null) &&
    !a.def.slot
  );
}
/* ao ganhar carne/erva/folhama: junta no pacote igual que ainda tem casinha livre */
export function packMergeNew(inv: InvGrid, it: Item) {
  if (!inv || !it || !PACK_KEYS.includes(it.def.key) || inv.ground) return false;
  if (!it._core) it._core = it.shape.map((r: number[]) => r.slice());
  const i = inv.items.indexOf(it);
  if (i < 0) return false;
  inv.items.splice(i, 1);
  for (const o of inv.items) {
    if (!packSame(o, it) || (o.n || 1) >= packCap(o)) continue;
    if (!o._core) o._core = o.shape.map((r) => r.slice());
    const sh = packShapeFor(o, (o.n || 1) + 1);
    if (canPlace(inv, sh, o.x, o.y, o)) {
      o.n = (o.n || 1) + 1;
      o.shape = sh;
      return true;
    }
  }
  inv.items.push(it);
  return false;
}
/* quem consome tira 1 do pacote (não o pacote inteiro) */
export function meatCountIn(items: Item[]) {
  let n = 0;
  for (const i of items) if (i.def.key === "carne") n += i.n || 1;
  return n;
}
export function takeN(items: Item[], k: string, n: number) {
  for (let i = items.length - 1; i >= 0 && n > 0; i--) {
    const it = items[i];
    if (it.def.key !== k) continue;
    const c = it.n || 1,
      t = Math.min(c, n);
    if (c > t) it.n = c - t;
    else items.splice(i, 1);
    n -= t;
  }
  return n;
}
export const TIERS = [
  { id: "A", lab: "A", mult: 1, col: "#cdd6b8" },
  { id: "A+", lab: "A+", mult: 1.8, col: "#9fe3ff" },
  { id: "SS", lab: "SS", mult: 3.5, col: "#ffd24a" },
];
export function dilate(sh: number[][], ax: string | string[]) {
  // engorda a forma 1 casinha no eixo "x", "y" ou nos dois ("xy")
  const dx = ax.indexOf("x") >= 0 ? 1 : 0,
    dy = ax.indexOf("y") >= 0 ? 1 : 0,
    H = sh.length + 2 * dy,
    W = sh[0].length + 2 * dx,
    g = Array.from({ length: H }, () => new Array(W).fill(0));
  const v = (y: number, x: number) => (sh[y] && sh[y][x]) || 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sy = y - dy,
        sx = x - dx;
      g[y][x] =
        v(sy, sx) || (dx && (v(sy, sx - 1) || v(sy, sx + 1))) || (dy && (v(sy - 1, sx) || v(sy + 1, sx))) ? 1 : 0;
    }
  return g;
}
export function rollTier(boss: boolean | undefined, up?: number) {
  const r = Math.random() + (up || 0),
    a = boss ? 0.15 : 0.72,
    b = boss ? 0.75 : 0.95;
  return r < a ? 0 : r < b ? 1 : 2;
} // lobo comum: 72% A · 23% A+ · 5% SS · Alfa: 15% · 50% · 35%
export function itemValBase(it: Item) {
  return Math.round(it.def.val * TIERS[it.tier | 0].mult) * (it.n || 1);
}
export function stackTarget(inv: InvGrid, it: Item, gx: number, gy: number) {
  const r = stackTargetBase(inv, it, gx, gy);
  /* v6.6 */
  if (r || !PACK_KEYS.includes(it.def.key)) return r;
  return inv.items.find((o) => packSame(o, it) && o.x === gx && o.y === gy && (o.n || 1) < packCap(o)) || null;
}
function stackTargetBase(inv: InvGrid, it: Item, gx: number, gy: number) {
  if (!it.def.res) return null;
  return (
    inv.items.find(
      (o) => o !== it && o.def.key === it.def.key && o.x === gx && o.y === gy && (o.n || 1) < o.def.stack!,
    ) || null
  );
}
export function rotShape(sh: number[][]): number[][] {
  const h = sh.length,
    w = sh[0].length,
    o: number[][] = [];
  for (let r = 0; r < w; r++) {
    o.push([]);
    for (let c = 0; c < h; c++) o[r].push(sh[h - 1 - c][r]);
  }
  return o;
}
export function ensureInv(h: Hero): InvGrid {
  const v = h.inv || (h.inv = { cols: 24, rows: 15, items: [] });
  v.mochila = true; // v7.7: a grade de uma mochila de herói (mochila fechada não entra nela; items/mochilas.ts)
  return v;
}
/** v7.7 — o que não cabe na bolsa do cinto: outro recipiente (mochila, aljava, bolsa) ou o próprio cinto. */
export function naoEntraNaBolsa(it: Item) {
  return !!it.def && /^eq_(mochila|aljava|bolsa|cinto)$/.test(it.def.key);
}
export function canPlace(inv: InvGrid, sh: number[][], gx: number, gy: number, ign?: Item) {
  if (ign && ign.def && (ign.def.key === "eq_mochila" || ign.def.key === "eq_aljava") && (inv.mochila || inv.qv))
    return false; // v7.7: mochila/aljava não entra em mochila/aljava
  if (inv.bolsa && ign && naoEntraNaBolsa(ign)) return false; // v7.7: a bolsa do cinto (items/cinto.ts)
  if (ign && ign.def && ign.def.key === "flecha") {
    if (!inv.qv) return false;
  } // feixe de flechas: só dentro da aljava
  else if (inv.qv && (sh.length > SUB || sh[0].length > SUB)) return false; // aljava: outros itens só de até 1 casa (3×3) // aljava: só itens que cabem em 1 casa (3×3); as colunas da esquerda são das flechas
  for (let r = 0; r < sh.length; r++)
    for (let c = 0; c < sh[0].length; c++) {
      if (!sh[r][c]) continue;
      const x = gx + c,
        y = gy + r;
      if (x < 0 || y < 0 || x >= inv.cols || y >= inv.rows) return false;
      for (const it of inv.items) {
        if (it === ign) continue;
        const rr = y - it.y,
          cc = x - it.x;
        if (rr >= 0 && cc >= 0 && rr < it.shape.length && cc < it.shape[0].length && it.shape[rr][cc]) return false;
      }
    }
  return true;
}

// estado do inventário em tela (eram let do legado: base/16, base/17 e o baú de base/05)
/** Peça sendo arrastada entre as grades (sx/sy: onde o ponteiro desceu; ox/oy: a casa da peça sob ele; gx/gy: onde cairia). */
interface ArrastoInv {
  sx: number;
  sy: number;
  moved: boolean;
  it: Item;
  from: GradeTela;
  over: GradeTela | null;
  shape: number[][];
  ox: number;
  oy: number;
  gx: number;
  gy: number;
  split?: Item; // parte separada de um monte (Shift)
}
interface EstadoInv {
  chestOpen: boolean;
  invUid: number;
  invDrag: ArrastoInv | null;
  invGrids: GradeTela[];
}
export const INV: EstadoInv = {
  chestOpen: false,
  invUid: 0,
  invDrag: null,
  invGrids: [],
};

/* ---------- acampamento: tutorial sempre na 1ª entrada; Sim/Não aparece por cima da mochila; janela de cozinhar fecha antes da conversa ---------- */
/* ---------- itens ---------- */
export function stoneToast(it: Item) {
  try {
    const d = dungeon,
      k = icoKeyOf(it);
    if (!d.active || !k || !icoHas(k)) return false;
    TOAST_ICO[k] = [k];
    d.toasts.push({ text: k, x: d.px, y: d.py - 26, color: "#ffb36a", life: 1.2, size: 26, icon: true });
    return true;
  } catch (_) {
    return false;
  }
}
export function packFix(inv: InvGrid) {
  // reescrita na v6.6
  if (!inv || !inv.items) return;
  for (const it of inv.items) {
    if (!PACK_KEYS.includes(it.def.key) || (INV.invDrag && INV.invDrag.it === it)) continue;
    if (!it._core) it._core = it.shape.map((r) => r.slice());
    if (!packFits3(it)) continue;
    const n = Math.min(it.n || 1, packCap(it)),
      sh = packShapeFor(it, n),
      cur = cellsOf(it.shape);
    if (cellsOf(sh) === cur && sh.length === it.shape.length) continue;
    if (cellsOf(sh) <= cur || canPlace(inv, sh, it.x, it.y, it)) {
      it.shape = sh;
      continue;
    }
    let done = false;
    for (let y = 0; y < inv.rows && !done; y++)
      for (let x = 0; x < inv.cols && !done; x++)
        if (canPlace(inv, sh, x, y, it)) {
          it.x = x;
          it.y = y;
          it.shape = sh;
          done = true;
        }
  }
}

/* ---------- armas longas: corrige o tamanho de itens antigos ---------- */
export function fixLongShapes() {
  if (typeof INV.invDrag !== "undefined" && INV.invDrag) return;
  const invs = [econ.stash];
  for (const h of world.heroes || []) {
    if (h.inv) invs.push(h.inv);
    if (h.inv2) invs.push(h.inv2);
    const e = h.equip;
    if (e)
      for (const k in e) {
        const it = e[k];
        if (it && LONG_W.includes(it.def.key) && shapeCells(it.shape || []) < shapeCells(it.def.shape!))
          it.shape = it.def.shape!.map((r) => r.slice());
      }
  }
  for (const inv of invs)
    for (const it of inv.items.slice()) {
      if (!LONG_W.includes(it.def.key) || shapeCells(it.shape) >= shapeCells(it.def.shape!)) continue;
      const i = inv.items.indexOf(it),
        old = { x: it.x, y: it.y, shape: it.shape };
      inv.items.splice(i, 1);
      it.shape = it.def.shape!.map((r) => r.slice());
      if (!placeIn(inv, it)) {
        Object.assign(it, old);
        inv.items.splice(i, 0, it);
      }
    }
}

/** v7.7 — baú infinito (items/bau_infinito.ts): a grade sempre termina com BAU.folga fileiras livres, então quem
    procura lugar nela (placeIn, tryAddToInv, moveItem, lugarMaisPerto) sempre acha. Nas outras grades não faz nada. */
export function bauFolga(inv: InvGrid) {
  if (!inv || !inv.infinito) return;
  let fundo = 0;
  for (const it of inv.items) fundo = Math.max(fundo, (it.y | 0) + (it.shape ? it.shape.length : 1));
  inv.rows = Math.max(BAU.linhasMin, fundo + BAU.folga);
}
/** v7.7 — a casa livre mais perto de (gx, gy) para `sh` (girando de 90 em 90 se preciso), ou null sem lugar. Usado ao
    soltar um item onde ele não cabe exatamente: em vez de recusar havendo espaço, ele vai para o lugar livre mais perto. */
export function lugarMaisPerto(inv: InvGrid, sh: number[][], gx: number, gy: number, ign?: Item) {
  bauFolga(inv);
  let melhor: { x: number; y: number; shape: number[][] } | null = null,
    md = Infinity,
    s = sh;
  for (let r = 0; r < 4; r++) {
    for (let y = 0; y + s.length <= inv.rows; y++)
      for (let x = 0; x + s[0].length <= inv.cols; x++) {
        const dd = Math.hypot(x - gx, y - gy) + r * 0.01;
        if (dd < md && canPlace(inv, s, x, y, ign)) {
          md = dd;
          melhor = { x, y, shape: s };
        }
      }
    s = rotShape(s);
  }
  return melhor;
}
