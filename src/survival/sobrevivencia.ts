/* ==== Fase 4 — sobrevivência: peso, temperatura, ferimentos, comer (v5.9) ==== */
import { KG, SURV, WARM, FOOD, CARNE_BICHO, CARNE_CRUA_Q } from "../data/sobrevivencia.ts";
import { ensureEquip } from "../items/equipamento.ts";
import { EQ_SLOTS } from "../data/equipamento.ts";
import { ALT_K } from "../data/mapa.ts";
import { attrOf } from "../hero/atributos.ts";
import { world, dungeon } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { CPS } from "./acampamento.ts";
import { dfireNear } from "../field/fogueira.ts";
import { icoTag } from "../ui/icones.ts";
import { groundTake } from "../field/chao.ts";
import type { Hero, InvGrid, Item } from "../core/tipos.ts";

/* ---- peso (kg) ---- */
export function itemKg(it: Item) {
  const k = it.def.key;
  let w = KG[k];
  if (w == null) w = k.startsWith("runa_") ? 0.3 : k.startsWith("projeto_") ? 0.1 : 0.5;
  return w * (it.n || 1);
}
export function heroKg(h: Hero) {
  // equipado pesa metade (distribuído no corpo)
  if (!h) return 0;
  let t = 0;
  for (const inv of [h.inv, h.inv2]) if (inv) for (const it of inv.items) t += itemKg(it);
  const e = ensureEquip(h);
  for (const s of EQ_SLOTS) if (e[s.id]) t += itemKg(e[s.id]!) * 0.5;
  t = Math.round(t * 10) / 10;
  for (const k of ALT_K) if (e[k + "2"]) t += itemKg(e[k + "2"]!) * 0.5; // v5.9.03: a arma 2 também
  return Math.round(t * 10) / 10;
}
export function heroCap(h: Hero) {
  return Math.round((SURV.capBase + SURV.capFor * attrOf(h, "forca")) * 10) / 10;
}
export function loadK(h: Hero) {
  return heroKg(h) / heroCap(h);
}

/* ---- temperatura ---- */
export function ambientTemp(inDungeon: boolean) {
  const tod = ((typeof world !== "undefined" ? world.tick : 0) % CONFIG.DAY_MIN) / CONFIG.DAY_MIN,
    day = Math.floor((world.tick || 0) / CONFIG.DAY_MIN);
  const wx = Math.sin(day * 12.9898) * 4;
  return Math.round((14 + 9 * Math.sin((tod - 0.375) * 6.283) + wx - (inDungeon ? 2 : 0)) * 10) / 10;
}
function heroWarmth(h: Hero) {
  const e = ensureEquip(h);
  let w = 0;
  for (const s of EQ_SLOTS) if (e[s.id]) w += WARM[e[s.id]!.def.key] || 0;
  return w;
} // ~°C de proteção
export function coldStep(h: Hero, amb: number, dtMin: number, nearFire: boolean | null) {
  // h.cold 0..100 (frio acumulado)
  if (h.cold == null) h.cold = 0;
  const feel = amb + heroWarmth(h) + (nearFire ? 14 : 0);
  if (feel < 12) h.cold = Math.min(100, h.cold + (12 - feel) * 0.35 * dtMin);
  else h.cold = Math.max(0, h.cold - (feel - 11) * 0.5 * dtMin);
}
function coldTxt(c: number) {
  return c > 80 ? "congelando" : c > 50 ? "com frio" : c > 20 ? "fresco" : "confortável";
}
function hungerTxt(f: number) {
  return f > 85 ? "faminto!" : f > 60 ? "com fome" : f > 30 ? "satisfeito" : "bem alimentado";
}

/* ---- efeitos na masmorra ---- */
export function survMoveMult() {
  const d = dungeon,
    h = d.hero;
  if (!h || d.training || d.camp) return 1;
  const L = loadK(h);
  let m = L > 1.3 ? 0.6 : L > 1 ? 0.8 : 1;
  if ((h.cold || 0) > 80) m *= 0.85;
  return m;
}
export function survStamMult() {
  const d = dungeon,
    h = d.hero;
  if (!h || d.training) return 1;
  let m = 1;
  if ((h.hunger || 0) > 60) m *= 0.8;
  if ((h.cold || 0) > 50) m *= 0.75;
  if (loadK(h) > 1) m *= 0.7;
  return m;
}
export function survDmgMult() {
  const h = dungeon.active ? dungeon.hero : null;
  return h && !dungeon.training && (h.hunger || 0) > 60 ? 0.85 : 1;
}

/* ---- ferimentos ---- */
export function hpCap() {
  const d = dungeon;
  return Math.max(1, d.hpMax - (d.wound || 0));
}
export function survTick(dt: number) {
  const d = dungeon,
    h = d.hero;
  if (!d.active || !h || d.dead) return;
  if (d.hp > hpCap()) d.hp = hpCap();
  if (d.camp) {
    // no acampamento: descanso perto do fogo
    const T = d.tile,
      warm = CPS.fire && Math.hypot(d.px - CPS.fire.x, d.py - CPS.fire.y) < T * 3.2;
    h.hunger = Math.min(100, (h.hunger || 0) + dt / 60);
    coldStep(h, ambientTemp(false), (dt / 60) * 4, warm);
    if (warm && (h.hunger || 0) <= 60 && d.wound! > 0) d.wound = Math.max(0, d.wound! - dt / 4);
  } else if (!d.training) {
    h.hunger = Math.min(100, (h.hunger || 0) + SURV.hungerDg * dt * ((h.cold || 0) > 50 ? 1.4 : 1));
    coldStep(h, ambientTemp(true), (dt / 60) * 4, !!dfireNear(d.tile * 2.8)); // na masmorra o tempo de frio corre ~4× (escala de minutos)
    if (h.hunger > 85) {
      d.hp = Math.max(1, d.hp - 0.25 * dt);
    }
    if ((h.cold || 0) > 80) {
      d.hp = Math.max(1, d.hp - 0.3 * dt);
    }
  }
  survHud();
}
function survHud() {
  const d = dungeon,
    h = d.hero;
  let el = document.getElementById("surv-hud");
  if (!el) {
    const hud = document.getElementById("dungeon-hp-wrap");
    if (!hud) return;
    el = document.createElement("div");
    el.id = "surv-hud";
    hud.after(el);
  }
  const bg = document.getElementById("dungeon-hp-bg");
  let wb = document.getElementById("dungeon-hp-wound");
  if (bg && !wb) {
    wb = document.createElement("div");
    wb.id = "dungeon-hp-wound";
    bg.appendChild(wb);
  }
  if (wb) wb.style.width = Math.max(0, Math.min(100, ((d.wound || 0) / d.hpMax) * 100)) + "%";
  if (d.training) {
    el.style.display = "none";
    return;
  }
  el.style.display = "";
  const f = Math.round(h!.hunger || 0),
    c = h!.cold || 0,
    amb = ambientTemp(true),
    kg = heroKg(h!),
    cap = heroCap(h!),
    L = kg / cap;
  const html =
    '<span class="sv ' +
    (f > 85 ? "bad" : f > 60 ? "warn" : "") +
    '" title="Fome: ' +
    hungerTxt(f) +
    ' (acima de 60: menos dano e fôlego; acima de 85: perde vida)">' +
    icoTag("ui_fome", "🍖", "hud") +
    " " +
    f +
    "%</span>" +
    '<span class="sv ' +
    (c > 80 ? "bad" : c > 50 ? "warn" : "") +
    '" title="Temperatura ' +
    amb +
    "°C · " +
    coldTxt(c) +
    ' (roupas esquentam; frio forte tira fôlego e vida)">🌡 ' +
    Math.round(amb) +
    "°C" +
    (c > 20 ? " · " + coldTxt(c) : "") +
    "</span>" +
    '<span class="sv ' +
    (L > 1.3 ? "bad" : L > 1 ? "warn" : "") +
    '" title="Peso da mochila e do equipamento (capacidade = 15 + 1,5 × Força). Acima de 100%: mais lento e menos fôlego">⚖ ' +
    kg +
    "/" +
    cap +
    " kg</span>" +
    ((d.wound || 0) > 0.5
      ? '<span class="sv wound" title="Ferimentos: a vida não volta além desse limite até tratar (erva, carne assada, descanso no acampamento)">🩹 −' +
        Math.round(d.wound!) +
        "</span>"
      : "");
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}

/* ---- comer ---- */
/* v7.7 — o que uma comida dá: FOOD × ponto/qualidade do item (1 + 15% por nível) × bicho (CARNE_BICHO) × qualidade
   da carne crua que foi assada (CARNE_CRUA_Q, Item.qc). Comer, a dica e o menu do item usam esta conta. */
export function valorComida(it: Item) {
  const F = FOOD[it.def.key];
  if (!F) return null;
  const m = (1 + (it.tier | 0) * 0.15) * (CARNE_BICHO[it.an || ""] || 1) * (CARNE_CRUA_Q[it.qc || 0] || 1);
  return { hunger: Math.round(F.hunger * m), wound: Math.round(F.wound * m), hp: Math.round(F.hp * m), raw: F.raw };
}
export function eatItem(h: Hero, it: Item, inv: InvGrid) {
  const F = valorComida(it);
  if (!F) return "";
  if ((it.n || 1) > 1) it.n!--;
  else inv.items.splice(inv.items.indexOf(it), 1);
  if (inv.ground) groundTake(it);
  h.hunger = Math.max(0, (h.hunger || 0) - F.hunger);
  let msg = "Comeu " + it.def.name.toLowerCase() + " (fome −" + F.hunger + (F.hp ? ", vida +" + F.hp : "") + ")";
  if (dungeon.active && dungeon.hero === h) {
    const d = dungeon;
    d.wound = Math.max(0, (d.wound || 0) - F.wound);
    d.hp = Math.min(hpCap(), d.hp + F.hp);
    if (F.raw && Math.random() < 0.25) {
      d.dazed = Math.max(d.dazed || 0, 3);
      msg += " — crua, deu enjoo!";
    }
  } else {
    h.wound = Math.max(0, (h.wound || 0) - F.wound);
    if (F.raw && Math.random() < 0.25) msg += " — crua, deu enjoo.";
  }
  return msg;
}
