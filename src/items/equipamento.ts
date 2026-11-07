/* ==== Fase 4 — equipamento: qualidade de uma peça (eqQ). Saiu de v4.5_forja ==== */
import { equiparBolsa, desequiparBolsa, migrarBolsas, ehBolsa } from "./mochilas.ts";
import { QUAL, EQ_SLOTS, EQ_DEFAULT } from "../data/equipamento.ts";
import { INV, canPlace, naoEntraNaBolsa, rotShape, ensureInv, bauFolga } from "./inventario.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { tierShape } from "./qualidade.ts";
import { monProf, armorRes, DMG } from "../field/dano.ts";
import { eqDurInit, eqPct, eqName, eqDurCol } from "./durabilidade.ts";
import { icoItemQ } from "../ui/icones.ts";
import { afText } from "../hero/atributos.ts";
import { prepAltRender, heroOf, equipTo } from "../ui/inventario.ts";
import { prep } from "../econ/economia.ts";
import { prepHero, renderPrep } from "../expedicao/preparo.ts";
import { dungeon, GL3 } from "../core/state.ts";
import { spawnDungeonToast, updateWeaponUI } from "../field/masmorra.ts";
import { groundTake } from "../field/chao.ts";
import { encaixeVazio } from "../ui/contornos.ts";
import { migrarCinto, prenderNoCinto } from "./cinto.ts";
import type { Equip, GradeTela, Hero, InvGrid, Item } from "../core/tipos.ts";

export function eqQ(it: Item) {
  return QUAL[it && it.q != null ? it.q : 1] || QUAL[1];
}

/* =====================================================================
   v4.3 — EQUIPAMENTO (vestir/tirar), RETRATO 3D NO PREPARO, MINÉRIOS
===================================================================== */
export function mkItem(key: string, tier?: number): Item {
  return { uid: ++INV.invUid, def: ITEM_DEFS[key], x: 0, y: 0, shape: tierShape(key, tier! | 0), tier: tier! | 0 };
}
export function ensureEquip(h: Hero): Equip {
  const e = ensureEquipBase(h);
  /* v5.9.04 */
  for (const k of ["maoD2", "maoE2", "costas2"]) {
    const it = e[k];
    if (it && it.def && ITEM_DEFS[it.def.key] && it.def !== ITEM_DEFS[it.def.key]) it.def = ITEM_DEFS[it.def.key];
  }
  return e;
}
function ensureEquipBase(h: Hero) {
  if (!h) return {};
  if (!h.equip) {
    h.equip = {};
    for (const s of EQ_SLOTS) h.equip[s.id] = mkItem(EQ_DEFAULT[s.id]);
  }
  migrarBolsas(h, mkItem); // v7.7: saves de antes dos encaixes ganham a mochila e a aljava equipadas
  migrarCinto(h); // v7.7: e um cinto comum (items/cinto.ts)
  for (const id of [...EQ_SLOTS.map((s) => s.id), "mochila", "aljava", "cinto"]) {
    const it = h.equip[id];
    if (it && it.def && ITEM_DEFS[it.def.key]) it.def = ITEM_DEFS[it.def.key];
  } // saves guardam cópia do def
  return h.equip;
}

export function heroEq(h: Hero) {
  const e = ensureEquip(h),
    o: Record<string, number> = {};
  for (const s of EQ_SLOTS) o[s.id] = e[s.id] ? 1 : 0;
  return o;
}
export function eqSig(h: Hero) {
  const e = heroEq(h);
  return EQ_SLOTS.map((s) => e[s.id]).join("");
}

export function armorRed(h: Hero) {
  // reescrita na v6.2
  const r = armorRes(h),
    mix = DMG.att ? monProf(DMG.att).mix : null;
  if (mix) return (mix[0] * r[0] + mix[1] * r[1] + mix[2] * r[2]) / 10000;
  return (r[0] + r[1] + r[2]) / 300;
}
export function placeIn(inv: InvGrid, it: Item) {
  if (ehBolsa(it) && (inv.mochila || inv.qv)) return false; // v7.7: mochila/aljava não entra em mochila/aljava
  if (inv.bolsa && naoEntraNaBolsa(it)) return false; // v7.7: nem mochila, aljava, cinto ou bolsa na bolsa do cinto
  bauFolga(inv); // v7.7: o baú infinito sempre tem lugar
  let sh = it.shape;
  for (let r = 0; r < 4; r++) {
    for (let y = 0; y < inv.rows; y++)
      for (let x = 0; x < inv.cols; x++)
        if (canPlace(inv, sh, x, y)) {
          it.x = x;
          it.y = y;
          it.shape = sh;
          inv.items.push(it);
          return true;
        }
    sh = rotShape(sh);
  }
  return false;
}
export function equipItem(h: Hero, it: Item, inv: InvGrid) {
  const slot = it.def.slot;
  if (!slot) return "Isso não é equipamento.";
  if (slot === "mochila" || slot === "aljava") return equiparBolsa(h, it, inv); // v7.7: a grade troca junto (items/mochilas.ts)
  const e = ensureEquip(h),
    old = e[slot],
    i = inv.items.indexOf(it);
  if (i < 0) return "";
  inv.items.splice(i, 1);
  e[slot] = it;
  if (old && !placeIn(inv, old)) {
    e[slot] = old;
    placeIn(inv, it) || inv.items.push(it);
    return "Sem espaço na mochila para guardar " + old.def.name + ".";
  }
  return "Equipou " + it.def.name + ".";
}
export function unequip(h: Hero, slot: string, inv: InvGrid) {
  if (slot === "mochila" || slot === "aljava") return desequiparBolsa(h, slot); // v7.7: vai para os alforjes, o chão ou o baú
  const e = ensureEquip(h),
    it = e[slot];
  if (!it) return "";
  if (!placeIn(inv, it)) return "Mochila cheia — libere espaço para tirar " + it.def.name + ".";
  e[slot] = null;
  return "Tirou " + it.def.name + ".";
}
export function renderEqSlots(h: Hero) {
  const e = ensureEquip(h);
  for (const el of document.querySelectorAll("#prep-modal .eq-slot[data-slot]")) {
    const s = EQ_SLOTS.find((q) => q.id === (el as HTMLElement).dataset.slot);
    if (!s) continue; // v7.7: o encaixe da mochila tem o desenho dele (prepAltRender)
    const it = e[s.id];
    if (it) eqDurInit(it);
    el.classList.toggle("empty", !it);
    const p = it ? eqPct(it) : 0;
    (el as HTMLElement).title = it
      ? eqName(it) +
        (afText(eqDurInit(it)) ? " [" + afText(it) + "]" : "") +
        " — " +
        it.dur +
        "/" +
        it.durMax +
        " de durabilidade · clique para tirar" +
        (it.def.armor ? " (−" + Math.round(it.def.armor * eqQ(it).stat * 100) + "% dano)" : "")
      : s.label + ": vazio — arraste um item da mochila para cá";
    el.innerHTML =
      (it ? icoItemQ(it) : encaixeVazio(s.id, s.icon)) +
      "<small>" +
      s.label +
      "</small>" +
      (it
        ? "<b class='eq-dur'><i style='width:" + Math.round(p * 100) + "%;background:" + eqDurCol(p) + "'></i></b>"
        : "");
    (el as HTMLElement).style.borderColor = it && it.q != null && it.q !== 1 ? eqQ(it).col : "";
  }
  /* v5.9.03 — segundo conjunto de armas no preparo */
  try {
    prepAltRender(h);
  } catch (e) {
    console.warn(e);
  }
}

export function eqSlotClick(ev: MouseEvent) {
  const el = (ev.target as HTMLElement).closest<HTMLElement>(".eq-slot[data-slot]");
  if (!el || !prep.open) return;
  const h = prepHero();
  if (!h) return;
  const msg = unequip(h, el.dataset.slot!, ensureInv(h));
  if (msg) document.getElementById("prep-msg")!.textContent = msg;
  renderPrep();
}
export function eqDropAt(it: Item, gr: GradeTela, x: number, y: number) {
  // soltou um item arrastado em cima de um espaço de equipamento?
  /* v5.9.03 — espaços do boneco e das armas alternativas (mochila e preparo) */
  const el = document.elementFromPoint(x, y),
    sl = (el && el.closest && el.closest("[data-eqs],[data-alt]")) as HTMLElement;
  /* v7.7 — presilha do cinto, na preparação e na mochila do campo (items/cinto.ts) */
  const pr = (el && el.closest && el.closest("[data-presilha]")) as HTMLElement | null;
  if (pr && (prep.open || (dungeon.active && dungeon.invOpen))) {
    const h = heroOf();
    if (!h) return true;
    const msg = prenderNoCinto(h, it, +pr.dataset.presilha!, gr.inv);
    if (dungeon.active) spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
    else document.getElementById("prep-msg")!.textContent = msg;
    return true;
  }
  if (!sl) return eqDropAtBase(it, gr, x, y);
  const key = sl.dataset.eqs || sl.dataset.alt + "2",
    h = heroOf();
  if (!h) return eqDropAtBase(it, gr, x, y);
  const msg = equipTo(h, it, gr, key);
  if (dungeon.active) {
    spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
    GL3.heroKey = "";
    updateWeaponUI();
  } else {
    const m = document.getElementById("prep-msg");
    if (m) m.textContent = msg;
  }
  return true;
}
/* v5.8 — soltar em cima do equipamento na mochila da masmorra; no preparo, nos espaços da tela de preparo */
function eqDropAtBase(it: Item, gr: GradeTela, x: number, y: number) {
  if (prep.open) {
    // tela de preparo (o original v4.3)
    const el = document.elementFromPoint(x, y),
      sl = (el && el.closest && el.closest(".eq-slot[data-slot]")) as HTMLElement;
    if (!sl) return false;
    const h = prepHero()!,
      msg = document.getElementById("prep-msg")!;
    if (it.def.slot !== sl.dataset.slot) {
      msg.textContent = it.def.slot
        ? "Esse item vai em outro lugar (" +
          (EQ_SLOTS.find((q) => q.id === it.def.slot)?.label || it.def.name) + // v7.7: cinto, mochila, aljava
          ")."
        : "Isso não é equipamento.";
      return true;
    }
    msg.textContent = equipItem(h, it, gr.inv);
    return true;
  }
  if (!(dungeon.active && dungeon.invOpen)) return false;
  const el = document.elementFromPoint(x, y),
    sl = (el && el.closest && el.closest("[data-eqs]")) as HTMLElement;
  if (!sl) return false;
  if (it.def.slot !== sl.dataset.eqs) {
    spawnDungeonToast(
      it.def.slot ? "Vai em outro lugar" : "Isso não é equipamento",
      dungeon.px,
      dungeon.py - 50,
      "#ff9a9a",
      12,
    );
    return true;
  }
  if (gr.inv.ground) {
    groundTake(it);
    const i = gr.inv.items.indexOf(it);
    if (i >= 0) gr.inv.items.splice(i, 1);
    const inv = ensureInv(dungeon.hero!);
    inv.items.push(it);
    spawnDungeonToast(equipItem(dungeon.hero!, it, inv), dungeon.px, dungeon.py - 50, "#ffe08a", 12);
  } else spawnDungeonToast(equipItem(dungeon.hero!, it, gr.inv), dungeon.px, dungeon.py - 50, "#ffe08a", 12);
  GL3.heroKey = "";
  return true;
}
