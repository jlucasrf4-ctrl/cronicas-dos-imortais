/* ==== Fase 4 — economia: preparo, bolsa, preços, carne, mover itens (base/05) ==== */
import { canPlace, rotShape, meatCountIn, ensureInv, rollTier, TIERS, takeN, bauFolga } from "../items/inventario.ts";
import { isArrowIt } from "../items/aljava.ts";
import { world, econ, CACA } from "../core/state.ts";
import { QUIVERS } from "../data/recursos.ts";
import { icoTag, icoItem } from "../ui/icones.ts";
import { refillQuiver, resTotal } from "../render/sprites.ts";
import { pushEvent } from "../sim/eventos.ts";
import { tryAddToInv } from "../field/chao.ts";
import { mapFloat } from "../map/caca.ts";
import { CONFIG } from "../core/config.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { GOLD_PER_VALUE, WALK_SPEED, ROAD_MULT, type Cidade } from "../data/economia.ts";
import { itemVal, itemSell } from "../items/qualidade.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { mnt } from "../creatures/tamandua.ts";
import { moveStep } from "../sim/animais.ts";
import { refreshInspectorIfOpen } from "../ui/janelas.ts";
import { esc } from "../core/util.ts";
import type { Custo, Hero, InvGrid, Item, Ponto, Viagem } from "../core/tipos.ts";

export function moveItem(it: Item, from: InvGrid, to: InvGrid) {
  if (isArrowIt(it) && !to.qv) return false;
  bauFolga(to); // v7.7: o baú infinito sempre tem lugar
  let sh = it.shape;
  for (let r = 0; r < 4; r++) {
    for (let y = 0; y < to.rows; y++)
      for (let x = 0; x < to.cols; x++)
        if (canPlace(to, sh, x, y)) {
          from.items.splice(from.items.indexOf(it), 1);
          it.x = x;
          it.y = y;
          it.shape = sh;
          to.items.push(it);
          return true;
        }
    sh = rotShape(sh);
  }
  return false;
}

/* ======================= v3.0: ECONOMIA, BAÚ, MERCADO ======================= */
export const prep = { open: false, heroId: null as string | null, launchId: null as string | null };
export const bag = { open: false, heroId: null as string | null };
export function meatInPack(h: Hero) {
  return meatCountIn(h.inv ? h.inv.items : []);
} // v6.6: conta as carnes dentro dos pacotes
export function meatTotal() {
  let m = 0;
  for (const h of world.heroes) m += h.loot.meat + meatInPack(h);
  for (const it of econ.stash.items) if (it.def.key === "carne") m += it.n || 1;
  return m;
}
export function usedMounts() {
  let h = 0,
    w = 0;
  for (const x of world.heroes)
    if (x.trip) {
      h += x.trip.horses;
      w += x.trip.wagon ? 1 : 0;
    }
  return { h, w };
}
export function updateEcon() {
  const u = usedMounts(),
    $ = (i: string) => document.getElementById(i);
  refillQuiver();
  $("e-arrows")!.textContent =
    econ.quiver.n + "/" + QUIVERS[econ.quiver.type] + (econ.arrowStock ? " (+" + econ.arrowStock + ")" : "");
  $("e-res")!.innerHTML =
    icoTag("ui_madeira", "🪵") +
    resTotal("wood") +
    " " +
    icoTag("ui_pedra", "🪨") +
    resTotal("stone") +
    " " +
    icoTag("pena", "🪶") +
    resTotal("feather") +
    " " +
    icoTag("penaag", "🦅") +
    resTotal("eagle");
  $("e-gold")!.textContent = String(econ.gold);
  $("e-meat")!.textContent = String(meatTotal());
  $("e-horses")!.textContent = econ.horses - u.h + "/" + econ.horses;
  $("e-wagons")!.textContent = econ.wagons - u.w + "/" + econ.wagons;
}

export function giveMeat(h: Hero, n: number, up?: number) {
  // carne caçada: vira item da mochila (2 casas cada); sem espaço -> Baú; sem espaço -> fica no contador
  /* v7.7 — a caça automática do mapa não faz mais abate limpo (era só ter faca na mochila): o abate limpo é a
     finalização com a faca no campo, com o bicho laçado ou caído (field/faca_corda.ts) */
  const an = CACA.MEAT_SRC; // v5.9.13 — de que bicho é a carne (para o texto no mapa)
  try {
    // v5.9.07 — MEAT_SRC vale só para esta caçada
    ensureInv(h);
    let left = 0;
    for (let i = 0; i < n; i++) {
      const tr = rollTier(false, up);
      if (tryAddToInv(h.inv!, "carne", tr) || tryAddToInv(econ.stash, "carne", tr)) continue;
      left++;
    }
    h.loot.meat += left;
    if (left)
      pushEvent(h.name + ": sem espaço pra " + left + " carne(s) — guardadas à parte (esvazie a mochila ou o Baú).");
  } finally {
    CACA.MEAT_SRC = null;
  }
  try {
    if (n > 0) mapFloat(h, "+" + n + " carne", "meat_" + (an || "lobo") + "_1");
  } catch (_) {} // v5.9.13 — "+N carne" sobe no mapa
}
export function settleMeat(h: Hero) {
  if (h.loot.meat > 0 && h.state === "idle") {
    const n = h.loot.meat;
    h.loot.meat = 0;
    giveMeat(h, n);
  }
}

export function cityPrice(city: Cidade, key: string, tier?: number) {
  const day = Math.floor(world.tick / CONFIG.DAY_MIN);
  let hsh = 7;
  for (const ch of city.id + key + day) hsh = (hsh * 31 + ch.charCodeAt(0)) % 9973;
  return Math.max(
    1,
    Math.round(
      ITEM_DEFS[key].val * GOLD_PER_VALUE * (city.pay[key] || 1) * TIERS[tier! | 0].mult * (0.85 + (hsh % 31) / 100),
    ),
  );
}
function stashCount(k: string) {
  // reescrita na v6.6
  let n = 0;
  for (const i of econ.stash.items) if (i.def.key === k) n += i.n || 1;
  return n;
}
export function creationCost(): Custo {
  const n = world.heroes.length;
  if (econ.test) return { meat: 0, gold: 0, items: {} };
  if (n === 0) return { meat: 0, gold: 0, items: {} };
  if (n === 1) return { meat: 100, gold: 0, items: {} };
  return { meat: 1000, gold: 500, items: { reliquia: 1 } };
}
export function costText(c: Custo) {
  const p = [];
  if (c.meat) p.push(c.meat + " carne");
  if (c.gold) p.push(c.gold + " ouro");
  for (const k in c.items) p.push(c.items[k] + "x " + ITEM_DEFS[k].name);
  return p.length ? p.join(" + ") + " (carne e itens vêm do baú)" : "grátis";
}
export function canPay(c: Custo) {
  return meatTotal() >= c.meat && econ.gold >= c.gold && Object.keys(c.items).every((k) => stashCount(k) >= c.items[k]);
}
export function payCost(c: Custo) {
  econ.gold -= c.gold;
  let m = c.meat;
  for (const h of world.heroes) {
    const t = Math.min(h.loot.meat, m);
    h.loot.meat -= t;
    m -= t;
  }
  for (const h of world.heroes) {
    if (!h.inv) continue;
    m = takeN(h.inv.items, "carne", m);
  }
  const rm = (k: string, n: number) => {
    takeN(econ.stash.items, k, n);
  };
  rm("carne", m);
  for (const k in c.items) rm(k, c.items[k]);
  updateEcon();
}
export function tripSpeed(mode: string) {
  return WALK_SPEED * ROAD_MULT * (mode === "horse" ? 2.2 : mode === "wagon" ? 1.5 : 1);
}
function setLeg(t: Viagem, from: Ponto, to: Ponto) {
  t.from = { x: from.x, y: from.y };
  t.to = { x: to.x, y: to.y };
  t.total = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
}
export function startTrip(h: Hero, city: Cidade, mode: string) {
  const pack = ensureInv(h);
  const cargo = pack.items.splice(0);
  if (mode === "wagon") {
    const extra = econ.stash.items
      .slice()
      .sort((a, b) => itemVal(b) - itemVal(a))
      .slice(0, 12);
    for (const it of extra) {
      econ.stash.items.splice(econ.stash.items.indexOf(it), 1);
      cargo.push(it);
    }
  }
  h.trip = {
    city,
    cargo,
    mode,
    horses: mode === "horse" ? 1 : mode === "wagon" ? 2 : 0,
    wagon: mode === "wagon",
    speed: tripSpeed(mode),
    t: 0,
  };
  setLeg(h.trip, h, city);
  h.state = "marketgo";
  h.targetEntity = null;
  const min = h.trip.total! / h.trip.speed;
  pushEvent(
    h.name +
      " partiu para " +
      city.name +
      " com " +
      cargo.length +
      " item(ns) (~" +
      Math.round((min / 60) * 10) / 10 +
      "h de viagem).",
  );
  updateHeroPanelUI();
  /* v5.9.04 */
  {
    const m = mnt();
    if (m && m.with === h.id && h.trip) {
      const extra = econ.stash.items
        .slice()
        .sort((x, y) => itemVal(y) - itemVal(x))
        .slice(0, 8);
      for (const it of extra) {
        econ.stash.items.splice(econ.stash.items.indexOf(it), 1);
        h.trip.cargo.push(it);
      }
      if (extra.length) pushEvent("🐾 " + m.name + " levou +" + extra.length + " item(ns) do baú nos alforjes.");
    }
  }
}
export function tripSpeedNow(h: Hero) {
  return h.trip!.speed * (h.energy < 10 ? 0.6 : 1);
}
export function tripStep(h: Hero, dtMin: number) {
  const t = h.trip;
  if (!t) {
    h.state = "idle";
    return;
  }
  t.t += dtMin;
  if (h.state === "marketgo") {
    const d = moveStep(h, t.city.x, t.city.y, tripSpeedNow(h), dtMin, true);
    if (d < 14 || t.t > (t.total! / t.speed) * 1.8 + 300) arriveMarket(h);
  } else if (moveStep(h, h.camp.x, h.camp.y, tripSpeedNow(h), dtMin, true) < 16 || t.t > (t.total! / t.speed) * 4 + 600)
    finishTrip(h);
}
function finishTrip(h: Hero) {
  const t = h.trip;
  let lost = 0;
  if (t && t.cargo.length) {
    const src = { items: t.cargo } as InvGrid;
    for (const it of t.cargo.slice()) if (!moveItem(it, src, econ.stash) && !moveItem(it, src, ensureInv(h))) lost++;
  }
  h.x = h.camp.x;
  h.y = h.camp.y;
  h.state = "idle";
  h.trip = null;
  pushEvent(
    h.name +
      " voltou ao acampamento." +
      (t && t.gaveUp ? " A carga voltou pro baú." : "") +
      (lost ? " " + lost + " item(ns) se perderam." : ""),
  );
  updateHeroPanelUI();
}
export function giveUpTrip(h: Hero) {
  if (h.state === "marketgo" && h.trip) {
    const t = h.trip;
    setLeg(t, h, h.camp);
    t.t = 0;
    t.gaveUp = true;
    h.state = "marketback";
    pushEvent(h.name + " desistiu da viagem a " + t.city.name + " e está voltando ao acampamento.");
  } else if (h.state === "traveling" || h.state === "hunting") {
    h.state = "returning";
    h.targetEntity = null;
    pushEvent(h.name + " desistiu da caçada e está voltando ao acampamento.");
  } else return;
  updateHeroPanelUI();
  refreshInspectorIfOpen(true);
}
function arriveMarket(h: Hero) {
  const t = h.trip!,
    sold: Record<string, { n: number; g: number }> = {};
  let total = 0;
  for (const it of t.cargo) {
    const p = itemSell(t.city, it);
    total += p;
    const s = sold[it.def.key] || (sold[it.def.key] = { n: 0, g: 0 });
    s.n += it.n || 1;
    s.g += p;
  }
  econ.gold += total;
  t.cargo = [];
  t.t = 0;
  h.state = "marketback";
  setLeg(t, t.city, h.camp);
  pushEvent(h.name + " chegou em " + t.city.name + " e vendeu tudo por " + total + " ouro.");
  const res = { hero: h, city: t.city.name, sold, total };
  const n = document.createElement("div");
  n.className = "notif";
  n.innerHTML =
    "<span>" +
    icoTag("ui_mercado", "🏪") +
    " <b>" +
    esc(h.name) +
    "</b> chegou em " +
    t.city.name +
    " (+" +
    total +
    " 💰)</span>";
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = "Abrir";
  b.onclick = () => {
    showArrival(res);
    n.remove();
  };
  n.appendChild(b);
  document.getElementById("notif-stack")!.appendChild(n);
  setTimeout(() => n.remove(), 45000);
  updateHeroPanelUI();
}
function showArrival(r: { hero: Hero; city: string; sold: Record<string, { n: number; g: number }>; total: number }) {
  const rows =
    Object.keys(r.sold)
      .map(
        (k) =>
          "<div>" +
          icoItem(ITEM_DEFS[k]) +
          " " +
          ITEM_DEFS[k].name +
          " x" +
          r.sold[k].n +
          " — " +
          r.sold[k].g +
          " 💰</div>",
      )
      .join("") || "<div>Nada para vender.</div>";
  document.getElementById("arrive-body")!.innerHTML =
    "<h2>" +
    r.hero.name +
    " chegou em " +
    r.city +
    "</h2>" +
    rows +
    "<h3>Total recebido: " +
    r.total +
    " 💰</h3><div>Ouro agora: " +
    econ.gold +
    " · " +
    r.hero.name +
    " já está voltando ao acampamento.</div>";
  document.getElementById("arrive-modal")!.classList.add("open");
}
