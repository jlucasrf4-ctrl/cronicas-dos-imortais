/* ==== Fase 4 — armaria: loja de flechas e aljavas, comprar todas as armas (base/07, v5.9.07) ==== */
import { ITEM_DEFS } from "../data/itens.ts";
import { GOLD_PER_VALUE } from "../data/economia.ts";
import { econ, dungeon, world } from "../core/state.ts";
import { ensureInv } from "../items/inventario.ts";
import { mkItem, placeIn } from "../items/equipamento.ts";
import { eqDurInit } from "../items/durabilidade.ts";
import { prepHero, renderPrep } from "../expedicao/preparo.ts";
import { updateEcon } from "./economia.ts";
import { sfx, addRing } from "../field/chao.ts";
import { QUIVERS, ARROW_STOCK_MAX, ARROW_PACKS, QUIVER_SHOP, QUIVER_ORDER, HERB_HEAL } from "../data/recursos.ts";
import { renderCraft } from "../render/sprites.ts";
import { ISC } from "../intro/cena.ts";
import { hpCap } from "../survival/sobrevivencia.ts";
import { spawnDungeonToast } from "../field/masmorra.ts";
import { rollCoat } from "../data/genetica.ts";
import { craftRapidoSecao } from "../field/craft_rapido.ts";

/* ==== botão: comprar todas as armas (expedição) ==== */
export function allWeaponKeys() {
  return Object.keys(ITEM_DEFS).filter((k) => {
    const d = ITEM_DEFS[k];
    return d && (d.slot === "maoD" || d.slot === "maoE" || d.slot === "costas") && !d.blueprint;
  });
}
export function allWeaponsPrice() {
  return allWeaponKeys().reduce((a, k) => a + Math.round((ITEM_DEFS[k].val || 10) * GOLD_PER_VALUE), 0);
}
export function buyAllWeapons() {
  const h = prepHero(),
    msg = document.getElementById("prep-msg");
  if (!h) return;
  const price = allWeaponsPrice();
  if (!econ.test && (econ.gold || 0) < price) {
    if (msg) msg.textContent = "Ouro insuficiente: o pacote custa " + price + "💰.";
    return;
  }
  const keys = allWeaponKeys(),
    inv = ensureInv(h);
  let bag = 0,
    chest = 0;
  const fail = [];
  for (const k of keys) {
    const it = mkItem(k);
    it.q = 1;
    eqDurInit(it);
    if (placeIn(inv, it)) bag++;
    else if (placeIn(econ.stash, it)) chest++;
    else fail.push(ITEM_DEFS[k].name);
  }
  if (!econ.test) econ.gold -= price;
  updateEcon();
  if (msg)
    msg.textContent =
      "⚔ Comprou " +
      (bag + chest) +
      " armas (Comum)" +
      (bag ? " · " + bag + " na mochila" : "") +
      (chest ? " · " + chest + " no baú (não couberam)" : "") +
      (fail.length ? " · sem espaço: " + fail.join(", ") : "") +
      ".";
  sfx("ping");
  renderPrep();
}

export function closeCraft() {
  document.getElementById("craft-modal")!.classList.remove("open");
  dungeon.craftOpen = false;
  updateEcon();
}

/* ---- v3.6: ARMARIA (loja de flechas e aljavas) ---- */
export function pay(p: number) {
  if (econ.test) return true;
  if (econ.gold < p) return false;
  econ.gold -= p;
  return true;
}
export function renderShop() {
  const $ = (i: string) => document.getElementById(i),
    q = econ.quiver,
    tot = q.n + econ.arrowStock!;
  $("sh-gold")!.textContent = econ.test ? "🧪 Modo teste: tudo grátis" : "💰 " + econ.gold + " ouro";
  $("sh-info")!.textContent =
    "Aljava " +
    q.type +
    ": 🏹 " +
    q.n +
    "/" +
    QUIVERS[q.type] +
    " · reserva: " +
    econ.arrowStock +
    " · total " +
    tot +
    "/" +
    (QUIVERS[q.type] + ARROW_STOCK_MAX);
  $("sh-arrows")!.innerHTML = ARROW_PACKS.map(
    (p, i) =>
      '<button class="btn" data-pack="' +
      i +
      '"' +
      ((!econ.test && econ.gold < p[1]) || tot + p[0] > QUIVERS[q.type] + ARROW_STOCK_MAX ? " disabled" : "") +
      ">🏹 +" +
      p[0] +
      " flechas — " +
      (econ.test ? "grátis" : p[1] + "💰") +
      "</button>",
  ).join(" ");
  $("sh-quivers")!.innerHTML = QUIVER_SHOP.map((s, i) => {
    const own = QUIVER_ORDER.indexOf(q.type) >= QUIVER_ORDER.indexOf(s.type),
      lock = !own && QUIVER_ORDER.indexOf(s.type) > QUIVER_ORDER.indexOf(q.type) + 1;
    return (
      '<button class="btn" data-quiver="' +
      i +
      '"' +
      (own || lock || (!econ.test && econ.gold < s.price) ? " disabled" : "") +
      ">🎒 " +
      s.label +
      " — " +
      (own ? "já tem" : econ.test ? "grátis" : s.price + "💰") +
      (lock ? " (compre a anterior)" : "") +
      "</button>"
    );
  }).join(" ");
}
export function openCraft() {
  const $ = (i: string) => document.getElementById(i);
  $("craft-msg")!.textContent = "";
  renderCraft();
  craftRapidoSecao(); // v8.1: escolher a receita do segurar C
  $("craft-modal")!.classList.add("open");
  if (dungeon.active) {
    dungeon.craftOpen = true;
    dungeon.charging = false;
    dungeon.charge = 0;
    dungeon.guard = false;
  }
}
export function healHerb() {
  if (ISC.on && ISC.ph === "herb") ISC.herbTry = 1; // v6.1 — cena inicial
  /* v5.9 — a erva também fecha ferimentos (e funciona com a vida cheia se houver ferimento)
     v7.7 — o ferimento fecha sempre que uma erva é gasta. Antes, contava as casas de erva na mochila antes e depois:
     com ervas empilhadas (2+ na mesma casa) o número de casas não mudava e o ferimento nunca fechava; com a vida no
     teto (vida máxima menos o ferimento), a erva era gasta e não curava nada. */
  const d = dungeon;
  if (usarErva()) {
    d.wound = Math.max(0, (d.wound || 0) - 10);
    if ((d.debilitadoN || 0) > 0 || (d.debilitadoT || 0) > 0) {
      d.debilitadoN = Math.max(0, (d.debilitadoN || 0) - 1);
      d.debilitadoT = 0;
      if ((d.gstam || 0) >= 25) d.exaustaoArmada = false;
      spawnDungeonToast("Erva aliviou o debilitamento", d.px, d.py - 34, "#b7e8c0", 12);
    }
  }
}
/** Gasta uma erva da mochila e começa a regeneração; false se não deu (sem erva, vida cheia, espera, mochila aberta). */
function usarErva() {
  const d = dungeon;
  if (!d.active || d.dead || d.invOpen || d.herbCd! > 0) return false;
  const inv = ensureInv(d.hero!),
    it = inv.items.find((i) => i.def.key === "erva");
  if (!it) {
    spawnDungeonToast("Sem ervas na mochila", d.px, d.py - 26, "#c9b88a");
    return false;
  }
  const aliviaDebilitamento = (d.debilitadoN || 0) > 0 || (d.debilitadoT || 0) > 0;
  if (d.hp >= hpCap() && !(d.wound! > 0.5) && !aliviaDebilitamento) {
    spawnDungeonToast("Vida cheia", d.px, d.py - 26, "#c9b88a");
    return false;
  }
  if ((it.n || 1) > 1) it.n!--;
  else inv.items.splice(inv.items.indexOf(it), 1);
  d.herbCd = 1.5;
  const total = HERB_HEAL[0] + Math.floor(Math.random() * (HERB_HEAL[1] - HERB_HEAL[0] + 1)); // cura total fixa por erva, aplicada aos poucos
  d.hotLeft = (d.hotLeft || 0) + total;
  d.hotT = d.hotT || 0;
  spawnDungeonToast("🌿 regenerando " + total, d.px, d.py - 30, "#9fe08a");
  addRing(d.px, d.py, "#9fe08a", 30, 0.4, 3);
  return true;
}
/* correção: a pelagem do tamanduá tinha o mesmo nome da função de pelagem dos bichos (todos nasciam iguais) */
export function coatFix() {
  try {
    if (!world) return;
    for (const a of world.animals || [])
      if (a.genes && typeof a.genes.coat !== "number") a.genes.coat = rollCoat(a.species);
    for (const w of world.wild || []) if (typeof w.coat !== "number") w.coat = rollCoat(w.species);
  } catch (_) {}
}
