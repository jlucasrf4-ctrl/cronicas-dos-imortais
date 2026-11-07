/* ==== Fase 4 — durabilidade de armas e armaduras (v4.5) ==== */
import { DUR_K } from "../data/campo.ts";
import { afRoll } from "../hero/atributos.ts";
import { EQ_BASE } from "../data/equipamento.ts";
import { eqQ, ensureEquip } from "./equipamento.ts";
import { itName } from "./arte.ts";
import { plateMult } from "../field/dano.ts";
import { dungeon, econ } from "../core/state.ts";
import { spawnDungeonToast, switchWeapon } from "../field/masmorra.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { tryAddItem, sfx, shakeScreen } from "../field/chao.ts";
import { tryAddQuiver } from "../expedicao/preparo.ts";
import { pushEvent } from "../sim/eventos.ts";
import { forgeKnows } from "../forja/forja.ts";
import type { Hero, Item, Repasse } from "../core/tipos.ts";

export function eqDurInit(it: Item) {
  const r = eqDurInitBase2(it);
  /* v6.5 */
  try {
    if (it && it.def && it.def.slot && it.durMax && !it._dk) {
      it._dk = 1;
      it.durMax = Math.round(it.durMax * DUR_K);
      it.dur = Math.min(it.durMax, Math.round(it.dur! * DUR_K));
      it._w25 = 0;
    }
  } catch (_) {}
  return r;
}
// etapa de eqDurInit: v5.0
function eqDurInitBase2(it: Item) {
  eqDurInitBase(it);
  if (it && it.def && it.def.slot && it.af === undefined) it.af = afRoll(it);
  return it;
}
// etapa de eqDurInit: original
function eqDurInitBase(it: Item) {
  if (!it || !it.def.slot) return it;
  if (it.q == null) it.q = it.tier ? Math.min(3, 1 + it.tier) : 1;
  if (it.durMax == null) {
    const B = EQ_BASE[it.def.key];
    it.durMax = Math.round((B ? B.dur : 80) * eqQ(it).dur);
    it.dur = it.durMax;
  }
  return it;
}
export function eqPct(it: Item) {
  eqDurInit(it);
  return it && it.durMax ? Math.max(0, it.dur! / it.durMax) : 1;
}

/* ---- durabilidade ---- */
export function eqName(it: Item) {
  /* v5.9.07 */
  if (it && it.def && !it.def.slot) return itName(it);
  return it.def.name + (it.def.slot && it.q != null && it.q !== 1 ? " (" + eqQ(it).n + ")" : "");
}
export function eqDurCol(p: number) {
  return p > 0.5 ? "#7dd36a" : p > 0.25 ? "#e8c34a" : "#ff6a4a";
}

/* ---- durabilidade ---- */
// etapa de eqDurInit: original
export function eqWeaponMult(h: Hero) {
  const it = ensureEquip(h).maoD;
  return it ? (it.def.dmg || 1) * eqQ(it).stat : 0.45;
}
export function eqBowMult(h: Hero) {
  const it = ensureEquip(h).costas;
  return it ? (it.def.dmg || 1) * eqQ(it).stat : 1;
}
export function eqBlockMult(this: unknown, h: Hero) {
  /* v6.2 */
  return eqBlockMultBase.apply(this, arguments as Repasse) * plateMult(h);
}
// etapa de eqBlockMult: original
function eqBlockMultBase(h: Hero) {
  const it = ensureEquip(h).maoE;
  return it ? (it.def.block || 1) / eqQ(it).stat : 1;
}
export function eqWear(slot: string, amt: number) {
  const d = dungeon,
    h = d.hero;
  if (!d.active || !h || econ.noWear) return;
  const e = ensureEquip(h),
    it = e[slot];
  if (!it) return;
  eqDurInit(it);
  it.dur = Math.max(0, it.dur! - amt);
  const p = it.dur / it.durMax!;
  if (p <= 0.25 && !it._w25 && it.dur > 0) {
    it._w25 = 1;
    spawnDungeonToast("⚠ " + eqName(it) + " está gasto (" + Math.round(p * 100) + "%)", d.px, d.py - 52, "#e8c34a", 12);
  }
  if (it.dur <= 0) eqBreak(h, slot);
}
export function eqWearArmor() {
  const e = ensureEquip(dungeon.hero!),
    W = (
      [
        ["peito", 3],
        ["cabeca", 2],
        ["pernas", 1.5],
        ["pes", 1],
      ] as [string, number][]
    ).filter((w) => e[w[0]]);
  if (!W.length) return;
  let r = Math.random() * W.reduce((a, w) => a + w[1], 0);
  for (const w of W) {
    r -= w[1];
    if (r <= 0) {
      eqWear(w[0], 1);
      return;
    }
  }
}
function eqBreak(h: Hero, slot: string) {
  const e = ensureEquip(h),
    it = e[slot];
  if (!it) return;
  e[slot] = null;
  const d = dungeon,
    B = EQ_BASE[it.def.key];
  let scrap = "";
  if (B) {
    const main = Object.keys(B.mat)[0];
    if (Math.random() < 0.6 && ITEM_DEFS[main]) {
      if (tryAddItem(h, main) || tryAddQuiver(h, main)) scrap = " · sobrou 1 " + ITEM_DEFS[main].name.toLowerCase();
    }
  }
  if (d.active && d.hero === h) {
    spawnDungeonToast("💥 " + eqName(it) + " QUEBROU!" + scrap, d.px, d.py - 58, "#ff7a5a", 14);
    shakeScreen(0.2, 4);
    sfx("guardbreak");
    if (slot === "maoE") d.guard = false;
    if (slot === "costas" && d.weapon === "bow") switchWeapon();
  }
  pushEvent(
    "💥 " +
      h.name +
      ": " +
      eqName(it) +
      " quebrou." +
      (forgeKnows(it.def.key) ? " Dá para forjar outro na Forja." : " O acampamento ainda não sabe forjar esse item."),
  );
}
