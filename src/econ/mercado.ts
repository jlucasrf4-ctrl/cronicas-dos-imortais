/* ==== Fase 4 — mercado e bolsas (base/05) ==== */
import { usedMounts, tripSpeed } from "./economia.ts";
import { econ, world, JANELAS } from "../core/state.ts";
import { icoTag } from "../ui/icones.ts";
import { HORSE_PRICE, WAGON_PRICE, CITIES, BAG_LV } from "../data/economia.ts";
import { fillHeroSelect } from "./bau.ts";
import { ensureInv } from "../items/inventario.ts";
import { ITEM_DEFS, SUB } from "../data/itens.ts";
import { itemSell } from "../items/qualidade.ts";
import { esc } from "../core/util.ts";
import { QUIVER_ORDER, QUIVER_SHOP } from "../data/recursos.ts";
import type { Hero } from "../core/tipos.ts";

/* ---- mercado ---- */
export function renderMarket() {
  const u = usedMounts(),
    fh = econ.horses - u.h,
    fw = econ.wagons - u.w;
  document.getElementById("mk-gold")!.textContent = "💰 " + econ.gold + " ouro";
  const bh = document.getElementById("buy-horse") as HTMLButtonElement,
    bw = document.getElementById("buy-wagon") as HTMLButtonElement;
  bh.innerHTML = icoTag("ui_cavalo", "🐴") + " Cavalo — " + (econ.test ? "grátis" : HORSE_PRICE);
  bh.disabled = !econ.test && econ.gold < HORSE_PRICE;
  bw.innerHTML = icoTag("ui_carroca", "🛒") + " Carroça — " + (econ.test ? "grátis" : WAGON_PRICE);
  bw.disabled = !econ.test && econ.gold < WAGON_PRICE;
  fillHeroSelect("mk-hero");
  const h = world.heroes.find((x) => x.id === (document.getElementById("mk-hero") as HTMLInputElement).value);
  const modes = [
    ["foot", "A pé", true],
    ["horse", "Cavalo (livres: " + fh + ")", fh >= 1],
    ["wagon", "Carroça (precisa de 2 cavalos livres: " + fh + ")", fh >= 2 && fw >= 1],
  ];
  if (!modes.find((m) => m[0] === JANELAS.mkMode && m[2])) JANELAS.mkMode = "foot";
  document.getElementById("mk-mode")!.innerHTML = modes
    .map(
      (m) =>
        '<label><input type="radio" name="mkm" value="' +
        m[0] +
        '"' +
        (m[0] === JANELAS.mkMode ? " checked" : "") +
        (m[2] ? "" : " disabled") +
        "> " +
        m[1] +
        "</label>",
    )
    .join(" ");
  renderBags();
  const box = document.getElementById("mk-cities");
  box!.innerHTML = "";
  if (!JANELAS.mkCity) JANELAS.mkCity = CITIES[0].id;
  for (const c of CITIES) {
    const est = h ? ensureInv(h).items.reduce((a, it) => a + itemSell(c, it), 0) : 0;
    const hrs = h ? Math.round((Math.hypot(c.x - h.x, c.y - h.y) / tripSpeed(JANELAS.mkMode) / 60) * 10) / 10 : 0;
    const best = Object.keys(c.pay)
      .map((k) => ITEM_DEFS[k].emoji)
      .join("");
    const d = document.createElement("div");
    d.className = "city-opt" + (c.id === JANELAS.mkCity ? " sel" : "");
    d.dataset.city = c.id;
    d.innerHTML =
      "<b>" +
      c.name +
      "</b><span>paga bem: " +
      best +
      "</span><span style='margin-left:auto'>~" +
      hrs +
      "h · mochila vale ~" +
      est +
      "💰</span>";
    box!.appendChild(d);
  }
}
export function bagApply(h: Hero) {
  const b = BAG_LV[h.bagLv! | 0],
    inv = ensureInv(h);
  inv.cols = b[1] * SUB;
  inv.rows = b[2] * SUB;
}
export function renderBags() {
  const box = document.getElementById("mk-bags");
  if (!box) return;
  const h = world.heroes.find((x) => x.id === (document.getElementById("mk-hero") as HTMLInputElement).value),
    free = econ.test;
  const btn = (attr: string, label: string, price: number) =>
    '<button class="btn" ' +
    attr +
    (!free && econ.gold < price ? " disabled" : "") +
    ">" +
    label +
    " — " +
    (free ? "grátis" : price + "💰") +
    "</button>";
  let out = "";
  if (h) {
    const lv = h.bagLv! | 0,
      nx = BAG_LV[lv + 1];
    out +=
      "<div style='width:100%'>Mochila de <b>" +
      esc(h.name) +
      "</b>: " +
      BAG_LV[lv][0] +
      " (" +
      BAG_LV[lv][1] +
      "×" +
      BAG_LV[lv][2] +
      ")</div>" +
      (nx
        ? btn('data-bag="1"', "🎒 " + nx[0] + " " + nx[1] + "×" + nx[2], nx[3])
        : "<span>Mochila no tamanho máximo.</span>");
  } else out += "<div style='width:100%'>Escolha um personagem livre para comprar mochila.</div>";
  const qi = QUIVER_ORDER.indexOf(econ.quiver.type),
    nq = QUIVER_SHOP.find((q) => QUIVER_ORDER.indexOf(q.type) === qi + 1);
  out += nq
    ? btn('data-mkq="' + QUIVER_SHOP.indexOf(nq) + '"', "🏹 " + nq.label, nq.price)
    : "<span>Aljava no tamanho máximo.</span>";
  out += "<span>📦 Baú do acampamento: sem limite.</span>"; // v7.7: baú infinito (items/bau_infinito.ts)
  box.innerHTML = out;
}
export function openMarket(heroId?: string) {
  document.getElementById("market-modal")!.classList.add("open");
  if (heroId) {
    fillHeroSelect("mk-hero", heroId);
    (document.getElementById("mk-hero") as HTMLInputElement).value = heroId;
  }
  document.getElementById("mk-msg")!.textContent = "";
  renderMarket();
}
