/* ==== Fase 4 — minijogos de trabalho: mineração, madeira e pesca (base/06) ==== */
import { ITEM_DEFS } from "../data/itens.ts";
import { mapFloat } from "../map/caca.ts";
import { ensureInv, rollTier, TIERS } from "../items/inventario.ts";
import { econ, world, JANELAS } from "../core/state.ts";
import { tryAddToInv, sfx } from "../field/chao.ts";
import { pushEvent } from "../sim/eventos.ts";
import { snapToLand } from "../sim/animais.ts";
import { ensureHero, gainSkill, addHeroXp } from "../hero/nivel.ts";
import { updateEcon } from "../econ/economia.ts";
import { MG_DEFS } from "../data/minigames.ts";
import { profLv } from "../hero/proficiencias.ts";
import { resAdd } from "../expedicao/preparo.ts";
import { galhoAdd } from "../items/galho.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import type { Hero } from "../core/tipos.ts";

export function giveItem(h: Hero, key: string, tier: number) {
  const r = giveItemBase(h, key, tier);
  /* v5.9.13 */
  try {
    if (r && key !== "carne") mapFloat(h, "+1 " + ITEM_DEFS[key].name, key === "gema" ? "gem_rubi_1" : key);
  } catch (_) {}
  return r;
}
function giveItemBase(h: Hero, key: string, tier: number) {
  ensureInv(h);
  if (tryAddToInv(h.inv!, key, tier) || tryAddToInv(econ.stash, key, tier)) return true;
  pushEvent(h.name + ": sem espaço para " + ITEM_DEFS[key].name + ".");
  return false;
}

/* ===== v3.10: MINIGAMES (mineração, coleta de madeira, pesca) — opcionais: jogue você mesmo ou mande o personagem fazer sozinho ===== */
/** "foi " + workVerb(k) + huntLabel(k). v7.7: cortar (madeira), quebrar (pedras); antes "coletar"/"fazer". */
export function workVerb(k: string) {
  return k === "tree"
    ? "cortar "
    : k === "rock"
      ? "quebrar "
      : k === "fish"
        ? "pescar "
        : k === "runa"
          ? "absorver "
          : "caçar ";
}
export function fishSpot(x: number, y: number) {
  let best = null,
    bd = 1e9;
  for (const w of world.waterPoints) {
    const d = Math.hypot(w.x - x, w.y - y);
    if (d < bd) {
      bd = d;
      best = w;
    }
  }
  return best && bd < 70 ? snapToLand(best.x, best.y) : null;
}
export function fishStep(h: Hero, dtMin: number) {
  // pesca automática: espera, e de tempos em tempos fisga um peixe (a qualidade varia)
  h.fishT = (h.fishT || 0) + dtMin;
  if (h.fishT >= 25) {
    h.fishT = 0;
    if (Math.random() < 0.4 + ensureHero(h).attrs.destreza * 0.012) {
      const tr = rollTier(false, 0.04);
      if (giveItem(h, "peixe", tr)) {
        h.task!.killsDone++;
        pushEvent(h.name + " pescou um peixe" + (tr ? " " + TIERS[tr].lab : "") + ".");
        updateEcon();
      }
    }
  }
}
export function askWork(h: Hero, kind: string, auto: () => void) {
  if (!MG_DEFS[kind]) {
    auto();
    return;
  }
  const d = MG_DEFS[kind],
    cd = Math.max(0, (h.mgUntil || 0) - world.tick),
    $ = (i: string) => document.getElementById(i);
  $("wm-title")!.textContent = d.title + " — " + h.name;
  $("wm-sub")!.textContent = "Como você quer fazer isso?";
  ($("wm-play") as HTMLButtonElement).disabled = cd > 0;
  $("wm-note")!.textContent =
    cd > 0
      ? h.name +
        " ainda está descansando do último minigame (" +
        Math.ceil(cd) +
        " min de jogo). Você pode mandar fazer sozinho."
      : "Minigame: resultado na hora, melhor que o automático se você for bem. Automático: ele vai e volta sozinho, como antes (serve para vários personagens ao mesmo tempo).";
  JANELAS.wmCb = { h, kind, auto };
  $("wm-modal")!.classList.add("open");
}
export function wmClose() {
  document.getElementById("wm-modal")!.classList.remove("open");
}
export function startMinigame(h: Hero, kind: string) {
  const d = MG_DEFS[kind],
    $ = (i: string) => document.getElementById(i);
  ensureHero(h);
  const w = Math.min(0.34, d.zone + Math.max(0, h.attrs[d.attr]! - 5) * 0.007);
  JANELAS.mg = {
    h,
    kind,
    d,
    r: 0,
    pts: 0,
    perf: 0,
    pos: 0,
    dir: 1,
    w,
    c: 0,
    on: true,
    last: performance.now(),
    log: [],
  };
  mgNewZone();
  $("mg-title")!.textContent = d.title + " — " + h.name;
  $("mg-log")!.innerHTML = "";
  $("mg-hit")!.textContent = "Parar! (Espaço)";
  $("mg-hit")!.dataset.done = "";
  $("mg-modal")!.classList.add("open");
  mgInfo();
  requestAnimationFrame(mgLoop);
  /* v5.9.05 — ---- coletor ---- */
  if (JANELAS.mg && JANELAS.mg.h === h) {
    const lv = profLv(h, "coletor");
    JANELAS.mg.w = Math.min(0.44, JANELAS.mg.w * (1 + 0.045 * lv));
    mgNewZone();
  }
}
function mgNewZone() {
  JANELAS.mg!.c = JANELAS.mg!.w / 2 + 0.04 + Math.random() * (1 - JANELAS.mg!.w - 0.08);
  const z = document.getElementById("mg-zone")!;
  z.style.left = (JANELAS.mg!.c - JANELAS.mg!.w / 2) * 100 + "%";
  z.style.width = JANELAS.mg!.w * 100 + "%";
}
function mgInfo() {
  document.getElementById("mg-info")!.innerHTML =
    "<small>" +
    JANELAS.mg!.d.tip +
    "</small><div>Tentativa <b>" +
    Math.min(JANELAS.mg!.r + 1, JANELAS.mg!.d.rounds) +
    "/" +
    JANELAS.mg!.d.rounds +
    "</b> · pontos <b>" +
    JANELAS.mg!.pts +
    "</b> · perfeitos <b>" +
    JANELAS.mg!.perf +
    "</b></div>";
}
function mgLoop(now: number) {
  if (!JANELAS.mg || !JANELAS.mg.on) return;
  const dt = Math.min(0.05, (now - JANELAS.mg.last) / 1000);
  JANELAS.mg.last = now;
  JANELAS.mg.pos += JANELAS.mg.dir * dt * JANELAS.mg.d.speed * (1 + JANELAS.mg.r * 0.14);
  if (JANELAS.mg.pos >= 1) {
    JANELAS.mg.pos = 1;
    JANELAS.mg.dir = -1;
  } else if (JANELAS.mg.pos <= 0) {
    JANELAS.mg.pos = 0;
    JANELAS.mg.dir = 1;
  }
  document.getElementById("mg-mark")!.style.left = JANELAS.mg.pos * 100 + "%";
  requestAnimationFrame(mgLoop);
}
export function mgHit() {
  if (!JANELAS.mg) return;
  if (!JANELAS.mg.on) {
    mgClose();
    return;
  }
  const dist = Math.abs(JANELAS.mg.pos - JANELAS.mg.c),
    half = JANELAS.mg.w / 2,
    q = dist <= half * 0.35 ? 2 : dist <= half ? 1 : 0;
  JANELAS.mg.pts += q === 2 ? 3 : q === 1 ? 2 : 0;
  if (q === 2) JANELAS.mg.perf++;
  const lg = document.getElementById("mg-log")!;
  lg.innerHTML +=
    '<span style="color:' +
    (q === 2 ? "#e0a800" : q === 1 ? "#2f6a2a" : "#a33") +
    ';margin-right:8px">' +
    (q === 2 ? "★ perfeito" : q === 1 ? "✔ bom" : "✖ errou") +
    "</span>";
  sfx(q ? "ping" : "fail");
  JANELAS.mg.r++;
  if (JANELAS.mg.r >= JANELAS.mg.d.rounds) {
    JANELAS.mg.on = false;
    mgFinish();
    return;
  }
  mgNewZone();
  mgInfo();
}
export function mgFinish() {
  /* v5.9.05 */
  const h = JANELAS.mg && JANELAS.mg.h,
    k = JANELAS.mg && JANELAS.mg.kind,
    perf = JANELAS.mg ? JANELAS.mg.perf : 0,
    pts = JANELAS.mg ? JANELAS.mg.pts : 0;
  mgFinishBase();
  /* v5.9.05 */
  if (h) {
    gainSkill(h, "coletor", 3 + perf + Math.floor(pts / 3));
    const lv = profLv(h, "coletor");
    if (Math.random() < lv * 0.04) {
      let t = "";
      if (k === "rock") {
        resAdd(h, "stone", 1);
        t = "+1 🪨";
      } else if (k === "tree") {
        h.loot = h.loot || {};
        h.loot.wood = (h.loot.wood || 0) + 2;
        t = "+2 🪵";
      } else if (giveItem(h, "peixe", 0)) t = "+1 🐟";
      if (t) {
        pushEvent("🪵 Coletor: " + h.name + " achou um pouco a mais (" + t + ").");
        const i = document.getElementById("mg-info");
        if (i) i.innerHTML += "<div>Coletor Nv." + lv + ": " + t + " extra</div>";
      }
    }
  }
}
function mgFinishBase() {
  const h = JANELAS.mg!.h,
    k = JANELAS.mg!.kind,
    pts = JANELAS.mg!.pts,
    perf = JANELAS.mg!.perf;
  let txt: string;
  if (k === "rock") {
    const n = 1 + Math.floor(pts / 3);
    resAdd(h, "stone", n);
    txt = "🪨 " + n + " pedra(s)";
    if (perf >= 3 && giveItem(h, "lingote", perf >= 5 ? 2 : 1)) txt += " · 🪙 Lingote " + TIERS[perf >= 5 ? 2 : 1].lab;
    if (perf >= 5 && giveItem(h, "gema", 2)) txt += " · 💎 Gema SS";
  } else if (k === "tree") {
    const n = 1 + pts,
      g = Math.ceil(n / 2);
    h.loot.wood = (h.loot.wood || 0) + n;
    galhoAdd(h, g);
    txt = "🔥 " + n + " lenha · 🪵 " + g + " galho(s)";
  } else {
    const n = Math.floor(pts / 4);
    const got = [];
    for (let i = 0; i < n; i++) {
      const tr = rollTier(false, perf * 0.08);
      if (giveItem(h, "peixe", tr)) got.push("🐟 Peixe " + TIERS[tr].lab);
    }
    txt = got.length ? got.join(" · ") : "nenhum peixe dessa vez";
  }
  addHeroXp(h, 2 + pts * 0.5);
  h.mgUntil = world.tick + 60;
  pushEvent(h.name + " jogou " + JANELAS.mg!.d.title + " (" + pts + " pts, " + perf + " perfeitos): " + txt + ".");
  document.getElementById("mg-info")!.innerHTML =
    "<b>Resultado: " + pts + " pontos · " + perf + " perfeitos</b><div>Ganhou: " + txt + "</div>";
  document.getElementById("mg-hit")!.textContent = "Fechar";
  updateEcon();
  updateHeroPanelUI();
}
export function mgClose() {
  document.getElementById("mg-modal")!.classList.remove("open");
  JANELAS.mg = null;
}
