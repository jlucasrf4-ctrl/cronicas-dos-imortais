/* ==== Fase 4 — janelas arrastáveis e a mochila do personagem (base/04) ==== */
import { INV, ensureInv } from "../items/inventario.ts";
import { bag, updateEcon, meatInPack, prep, tripSpeedNow, cityPrice, tripSpeed } from "../econ/economia.ts";
import { world, JANELAS, SEL } from "../core/state.ts";
import { renderInv, invValue } from "../field/chao.ts";
import { treePoints, ensureHero } from "../hero/nivel.ts";
import { pushEvent } from "../sim/eventos.ts";
import { closePrep, qvInv, qvTrim } from "../expedicao/preparo.ts";
import { closeChest } from "../econ/bau.ts";
import { CONFIG } from "../core/config.ts";
import { fmtClock, esc } from "../core/util.ts";
import { seedVegetation } from "../sim/vegetacao.ts";
import { seedPopulation, ageDaysOf, hungerTier } from "../sim/animais.ts";
import { sampleStats } from "../sim/motor.ts";
import { SPECIES, STATE_LABEL } from "../data/especies.ts";
import { coatInfo, pctLabel } from "../data/genetica.ts";
import { icoPortrait, icoItem } from "./icones.ts";
import { runeInspAnimal } from "../runas/runas.ts";
import { HERO_SPEED, HERO_STATE_LABEL } from "../data/herois.ts";
import { idLine, attrLine } from "./ficha.ts";
import { skillsLineHtml, openPlantInspector } from "./painel.ts";
import { mapHero } from "../map/controle.ts";
import { heroNaVila } from "../map/vila_musgo.ts";
import { vilaEntrar, vilaIr } from "../map/vila_cena.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { openWildInspector } from "../sim/fauna.ts";
import type { Animal, Hero } from "../core/tipos.ts";
import type { Cidade } from "../data/economia.ts";

export function closeBag() {
  bag.open = false;
  INV.invDrag = null;
  INV.invGrids = [];
  document.getElementById("bag-win")!.classList.remove("open");
  updateEcon();
}
export function renderBag() {
  const h = world.heroes.find((x) => x.id === bag.heroId);
  if (!bag.open) return;
  if (!h || h.state !== "idle") {
    closeBag();
    return;
  }
  document.getElementById("bag-title")!.textContent = "🎒 Mochila de " + h.name;
  renderInv();
  document.getElementById("bag-val")!.textContent =
    "Valor da mochila: " +
    invValue(h) +
    " 💰 · 🥩 " +
    meatInPack(h) +
    " carne(s) · arraste os itens entre as duas mochilas";
}

/* ===== v3.9: janelas arrastáveis/fecháveis, mochila do personagem e clique no personagem ===== */
function heroInspBtns(act: HTMLElement, h: Hero) {
  const idle = h.state === "idle",
    pts = treePoints(h),
    sig = (idle ? 1 : 0) + "|" + h.lvl + "|" + pts + "|" + meatInPack(h);
  let x = act.querySelector<HTMLElement>(".hx");
  if (!x) {
    x = document.createElement("div");
    x.className = "hx";
    act.appendChild(x);
  }
  if (x.dataset.sig === sig) return;
  x.dataset.sig = sig;
  x.innerHTML =
    '<button class="btn" data-act="isheet">📜 Ficha · Nv.' +
    h.lvl +
    (pts > 0 ? " ●" + pts : "") +
    '</button><button class="btn" data-act="ibag"' +
    (idle ? "" : ' disabled title="Só no acampamento"') +
    ">🎒 Mochila" +
    (idle ? " · 🥩 " + meatInPack(h) : "") +
    "</button>";
}
export function openBag(id: string) {
  const h = world.heroes.find((x) => x.id === id);
  if (!h) return;
  ensureHero(h);
  if (h.state !== "idle") {
    pushEvent(h.name + " está fora do acampamento: a mochila foi com ele.");
    return;
  }
  if (prep.open) closePrep();
  if (INV.chestOpen) closeChest();
  bag.open = true;
  bag.heroId = id;
  ensureInv(h);
  qvTrim(h);
  INV.invDrag = null;
  INV.invGrids = [
    { el: document.getElementById("bag-pack")!, inv: h.inv! },
    { el: document.getElementById("bag-qv")!, inv: qvInv(h), discard: true },
  ];
  document.getElementById("bag-win")!.classList.add("open");
  const w = document.getElementById("bag-win")!;
  if (!w.dataset.placed) {
    w.dataset.placed = "1";
    winPlace(w, Math.max(10, innerWidth / 2 - 190), 80);
  }
  winFront(w);
  renderBag();
}
export const WIN_KEY = "cdi.win.v1";
const WINS = [
  { id: "heroes", sel: "#hero-panel", label: "👥 Personagens", handle: "h2" },
  { id: "pop", sel: "#stats-panel", label: "📊 População", handle: "h2" },
  { id: "events", sel: "#event-feed", label: "📜 Eventos", handle: ".ef-head" },
  { id: "controls", sel: "#controls", label: "🎛 Controles", handle: "h2" },
  { id: "bag", sel: "#bag-win", label: "🎒 Mochila", handle: ".win-bar", nodock: true, onClose: () => closeBag() },
  { id: "inspector", sel: "#inspector", label: "🔎 Detalhes", handle: "#insp-drag", nodock: true, moved: true },
];
function winSave() {
  try {
    localStorage.setItem(WIN_KEY, JSON.stringify(JANELAS.winSt));
  } catch (e) {}
}
function winFront(el: HTMLElement) {
  JANELAS.winZ = Math.min(29, JANELAS.winZ + 1);
  el.style.zIndex = String(JANELAS.winZ);
}
function winPlace(el: HTMLElement, x: number, y: number, cfg?: (typeof WINS)[number]) {
  const w = el.offsetWidth || 200;
  x = Math.max(0, Math.min(innerWidth - Math.min(w, 80), x));
  y = Math.max(0, Math.min(innerHeight - 40, y));
  el.style.position = "fixed";
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.margin = "0";
  if (cfg && cfg.moved) el.classList.add("moved");
}
function winSetHidden(cfg: (typeof WINS)[number], hide: boolean) {
  const el = document.querySelector(cfg.sel);
  if (!el) return;
  el.classList.toggle("win-hidden", hide);
  (JANELAS.winSt[cfg.id] = JANELAS.winSt[cfg.id] || {}).hidden = hide;
  winSave();
  winDock();
}
export function winDock() {
  let d = document.getElementById("win-dock");
  if (!d) {
    d = document.createElement("div");
    d.id = "win-dock";
    document.getElementById("app")!.appendChild(d);
    d.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.show) {
        const c = WINS.find((w) => w.id === b.dataset.show);
        winSetHidden(c!, false);
      }
      if (b.dataset.reset) {
        JANELAS.winSt = {};
        winSave();
        location.reload();
      }
    });
  }
  const hid = WINS.filter((c) => !c.nodock && JANELAS.winSt[c.id] && JANELAS.winSt[c.id].hidden),
    moved = Object.keys(JANELAS.winSt).some((k) => JANELAS.winSt[k] && JANELAS.winSt[k].x != null);
  d.innerHTML =
    hid.map((c) => '<button class="btn" data-show="' + c.id + '">' + c.label + "</button>").join("") +
    (moved || hid.length ? '<button class="btn" data-reset="1" title="Restaurar o layout original">⟲</button>' : "");
  d.style.display = hid.length || moved ? "flex" : "none";
}
export function winInit() {
  // v8.1 (mantenedor: "muita informação e pouco controle"): população, eventos e controles começam fechados, na barra
  // de janelas (a velocidade já está no alto, #hud-speed); o mapa fica com o painel do clã
  for (const id of ["pop", "events", "controls"]) if (!JANELAS.winSt[id]) JANELAS.winSt[id] = { hidden: true };
  for (const cfg of WINS) {
    const el = document.querySelector<HTMLElement>(cfg.sel);
    if (!el) continue;
    const handle = (el.querySelector(cfg.handle) || (cfg.handle === ".win-bar" ? null : el)) as HTMLElement;
    if (!handle) continue;
    handle.classList.add("win-handle");
    if (!cfg.nodock || cfg.onClose) {
      const x = document.createElement("button");
      x.className = "win-x";
      x.textContent = "✕";
      x.title = "Fechar (reabre na barra de janelas)";
      handle.appendChild(x);
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        if (cfg.onClose) {
          cfg.onClose();
          el.classList.remove("open");
        } else winSetHidden(cfg, true);
      });
    }
    let off: { dx: number; dy: number } | null = null;
    handle.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button,select,input,a")) return;
      const r = el.getBoundingClientRect();
      off = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      winFront(el);
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
    });
    handle.addEventListener("pointermove", (e) => {
      if (!off) return;
      winPlace(el, e.clientX - off.dx, e.clientY - off.dy, cfg);
    });
    const end = () => {
      if (!off) return;
      off = null;
      const r = el.getBoundingClientRect();
      (JANELAS.winSt[cfg.id] = JANELAS.winSt[cfg.id] || {}).x = Math.round(r.left);
      JANELAS.winSt[cfg.id].y = Math.round(r.top);
      winSave();
      winDock();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    el.addEventListener("pointerdown", () => winFront(el), true);
    const st = JANELAS.winSt[cfg.id];
    if (st && st.x != null) winPlace(el, st.x, st.y!, cfg);
    if (st && st.hidden) el.classList.add("win-hidden");
  }
  window.addEventListener("resize", () => {
    for (const cfg of WINS) {
      const st = JANELAS.winSt[cfg.id],
        el = document.querySelector<HTMLElement>(cfg.sel);
      if (st && st.x != null && el) winPlace(el, st.x, st.y!, cfg);
    }
  });
  winDock();
}
export function openFullLog() {
  const body = document.getElementById("log-modal-body")!;
  const all = world.events.slice().reverse();
  body.innerHTML = all.length
    ? all
        .map(
          (e) =>
            '<div class="log-line"><span class="t">Dia ' +
            (Math.floor(e.tick / CONFIG.DAY_MIN) + 1) +
            " · " +
            fmtClock(e.tick) +
            "</span>" +
            e.text +
            "</div>",
        )
        .join("")
    : '<div class="log-line">Nenhum evento registrado ainda.</div>';
  document.getElementById("log-modal")!.classList.add("open");
}
export function closeFullLog() {
  document.getElementById("log-modal")!.classList.remove("open");
}
function totalPopulation() {
  let n = 0;
  for (const a of world.animals) if (a.alive) n++;
  return n;
}
export function checkExtinction() {
  const banner = document.getElementById("extinction-banner")!;
  if (totalPopulation() === 0 && world.animals.length > 0) {
    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }
}
export function resetWorld() {
  world.animals = [];
  world.carcasses = [];
  world.veg = [];
  world.runes = [];
  world._rnT = 0;
  world.tick = 0;
  world.events = [];
  world.statsHistory = { rabbit: [], deer: [], wolf: [], fox: [], duck: [], eagle: [] };
  world.spLog = [];
  world.spTotals = {};
  world._imm = 0;
  world._br = {};
  world.counters = { births: 0, deaths: 0, hunts: 0 };
  world.nextId = 1;
  world.fastForwardTarget = 0;
  SEL.selectedAnimal = null;
  SEL.selectedPlant = null;
  SEL.selectedHero = null;
  SEL.selectedCity = null;
  document.getElementById("inspector")!.classList.remove("open");
  document.getElementById("extinction-banner")!.style.display = "none";
  SEL.renderEventFeedDirty = true;

  seedVegetation();
  seedPopulation();
  SEL.commandMode = null;
  document.getElementById("command-hint")!.style.display = "none";
  sampleStats();
  pushEvent("O mundo foi reiniciado.");
}
export function openInspector(a: Animal) {
  SEL.selectedWild = null;
  SEL.selectedHero = null;
  SEL.selectedCity = null;
  clearInspExtras();
  SEL.selectedPlant = null;
  SEL.selectedAnimal = a;
  document.getElementById("insp-animal-stats")!.style.display = "block";
  document.getElementById("insp-plant-info")!.style.display = "none";
  const sp = SPECIES[a.species];
  document.getElementById("insp-tag")!.textContent = sp.label.toUpperCase();
  document.getElementById("insp-tag")!.style.background = sp.color;
  document.getElementById("insp-tag")!.style.color = "#1c140b";
  const _cf = coatInfo(a.species, a.genes.coat)!;
  document.getElementById("insp-name")!.textContent = _cf.name + (_cf.rare ? " ✦" : "");
  icoPortrait(a.species, a.sex, a.genes.coat);
  if (a.runic) runeInspAnimal(a);
  document.getElementById("insp-id")!.textContent =
    a.id + " · " + (a.sex === "M" ? "macho" : "fêmea") + " · " + ageDaysOf(a).toFixed(1) + " dias de idade";
  document.getElementById("v-hunger")!.textContent = Math.round(a.hunger) + " · " + hungerTier(a.hunger)[1];
  document.getElementById("b-hunger")!.style.width = a.hunger + "%";
  document.getElementById("v-thirst")!.textContent = Math.round(a.thirst) + "%";
  document.getElementById("b-thirst")!.style.width = a.thirst + "%";
  document.getElementById("v-energy")!.textContent = Math.round(a.energy) + "%" + (a.energy < 1 ? " · exausto" : "");
  document.getElementById("b-energy")!.style.width = a.energy + "%";
  document.getElementById("v-health")!.textContent = Math.round(a.health) + "%";
  document.getElementById("b-health")!.style.width = a.health + "%";
  document.getElementById("insp-state")!.textContent = "Estado: " + (STATE_LABEL[a.state] || a.state);
  document.getElementById("insp-meta")!.textContent =
    "Posição: (" + Math.round(a.x) + ", " + Math.round(a.y) + ")  ·  Território: Floresta Central";

  const g = a.genes;
  document.getElementById("insp-traits")!.innerHTML =
    '<div class="trait-title">CLASSIFICAÇÃO (pela aparência)</div>' +
    '<div class="trait-row"><span class="tname">' +
    _cf.name +
    '</span><span class="teffect" style="font-weight:400">' +
    _cf.desc +
    (_cf.rare ? " · pelagem rara" : "") +
    "</span></div>" +
    '<div class="trait-title">CARACTERÍSTICAS (genéticas)</div>' +
    '<div class="trait-row"><span class="tname">Porte</span><span class="teffect">' +
    g.size.name +
    " (" +
    pctLabel(g.size.weightMult) +
    " peso)</span></div>" +
    '<div class="trait-row"><span class="tname">Velocidade</span><span class="teffect">' +
    g.speed.name +
    " (" +
    pctLabel(g.speed.mult) +
    ")</span></div>" +
    '<div class="trait-row"><span class="tname">Força</span><span class="teffect">' +
    g.strength.name +
    " (" +
    pctLabel(g.strength.mult) +
    ")</span></div>" +
    '<div class="trait-row"><span class="tname">Marca</span><span class="teffect" style="font-weight:400;font-style:italic;">' +
    g.flavor.name +
    "</span></div>";

  document.getElementById("inspector")!.classList.add("open");
}
export function clearInspExtras() {
  const a = document.getElementById("insp-actions")!;
  a.innerHTML = "";
  a.dataset.sig = "";
  (document.getElementById("v-thirst")!.closest(".stat-bar-wrap") as HTMLElement).style.display = "";
  (document.getElementById("b-growth")!.closest(".stat-bar-wrap") as HTMLElement).style.display = "";
  document.getElementById("insp-meta-plant")!.style.whiteSpace = "";
}
function heroTripInfo(h: Hero) {
  const camp = "Acampamento";
  if (h.trip) {
    const t = h.trip,
      rem = Math.hypot(t.to!.x - h.x, t.to!.y - h.y);
    return {
      origin: h.state === "marketgo" ? camp : t.gaveUp ? "Ponto onde desistiu" : t.city.name,
      dest: h.state === "marketgo" ? t.city.name : camp,
      pct: Math.max(0, Math.min(100, (1 - rem / t.total!) * 100)),
      rem,
      eta: rem / tripSpeedNow(h),
      mode: t.mode,
      cargo: t.cargo.length,
    };
  }
  if (h.task) {
    const going = h.state === "traveling",
      a = going ? h.camp : h.task,
      b = going ? h.task : h.camp;
    const tot = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      rem = Math.hypot(b.x - h.x, b.y - h.y);
    return {
      origin: going ? camp : "Região de caça",
      dest: going ? "Região de caça" : camp,
      pct: h.state === "hunting" ? 100 : Math.max(0, Math.min(100, (1 - rem / tot) * 100)),
      rem: h.state === "hunting" ? 0 : rem,
      eta: h.state === "hunting" ? 0 : rem / HERO_SPEED,
      mode: "foot",
      cargo: 0,
    };
  }
  return null;
}
export function openHeroInspector(h: Hero, _soft?: boolean) {
  SEL.selectedWild = null;
  SEL.selectedHero = h;
  SEL.selectedAnimal = null;
  SEL.selectedPlant = null;
  SEL.selectedCity = null;
  const $ = (i: string) => document.getElementById(i)!;
  $("insp-animal-stats").style.display = "block";
  $("insp-plant-info").style.display = "none";
  ($("v-thirst").closest(".stat-bar-wrap") as HTMLElement).style.display = "none";
  $("insp-tag").textContent = "PERSONAGEM";
  $("insp-tag").style.background = h.color;
  $("insp-tag").style.color = "#1c140b";
  $("insp-name").textContent = h.name;
  icoPortrait(null);
  $("insp-id").textContent = idLine(h) + " · " + attrLine(h);
  const hunger = h.hunger || 0,
    en = h.energy == null ? 100 : h.energy,
    hpP = Math.max(0, Math.min(100, (h.hp / h.hpMax) * 100));
  $("v-hunger").textContent = Math.round(hunger) + "%" + (hunger > 80 ? " · faminto" : "");
  $("b-hunger").style.width = hunger + "%";
  $("v-energy").textContent = Math.round(en) + "%" + (en < 10 ? " · exausto (viaja mais devagar)" : "");
  $("b-energy").style.width = en + "%";
  $("v-health").textContent = Math.round(h.hp) + " / " + h.hpMax;
  $("b-health").style.width = hpP + "%";
  const info = heroTripInfo(h),
    modeTxt: Record<string, string> = { foot: "a pé", horse: "a cavalo", wagon: "de carroça" };
  $("insp-state").textContent = "Estado: " + HERO_STATE_LABEL[h.state] + (info ? " · " + modeTxt[info.mode] : "");
  $("insp-meta").textContent = info
    ? "Origem: " +
      info.origin +
      "  ·  Destino: " +
      info.dest +
      "  ·  Progresso: " +
      Math.round(info.pct) +
      "%  ·  Faltam " +
      Math.round(info.rem) +
      " u (~" +
      Math.round((info.eta / 60) * 10) / 10 +
      "h)" +
      (info.cargo ? "  ·  Carga: " + info.cargo + " item(ns)" : "")
    : "Posição: (" + Math.round(h.x) + ", " + Math.round(h.y) + ")";
  $("insp-traits").innerHTML =
    '<div class="trait-title">PERÍCIAS</div><div class="trait-row">' + skillsLineHtml(h) + "</div>";
  const act = $("insp-actions"),
    can = h.state === "marketgo" || h.state === "traveling" || h.state === "hunting",
    sig = h.state + (can ? "1" : "0");
  if (act.dataset.sig !== sig) {
    act.dataset.sig = sig;
    act.innerHTML = can
      ? '<button class="btn" data-act="giveup">✋ Desistir da viagem</button>'
      : '<span class="no-skill" style="color:var(--ink-soft)">' +
        (h.state === "marketback" || h.state === "returning" ? "Já está voltando ao acampamento." : "") +
        "</span>";
  }
  heroInspBtns(act, h);
  $("inspector").classList.add("open");
}
export function openCityInspector(c: Cidade) {
  const r = openCityInspectorBase(c);
  /* v7.5 — ---------- inspetor da cidade: botões da Vila Musgo ---------- */
  try {
    if (!c || c.id !== "musgo") return r;
    const act = document.getElementById("insp-actions")!,
      h = heroNaVila();
    const mk = (t: string, fn: () => void) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = t;
      b.onclick = (e) => {
        e.stopPropagation();
        fn();
      };
      act.appendChild(b);
    };
    // v8.0: a vila andável (map/vila_cena.ts): entrar nela; o empório, o bote e o resto ficam lá dentro
    if (h)
      mk("🏘 Entrar na vila", () => {
        document.getElementById("inspector")!.classList.remove("open");
        vilaEntrar(h);
      });
    else
      mk("🚶 Ir até a vila", () => {
        const H = mapHero();
        if (!H) return;
        document.getElementById("inspector")!.classList.remove("open");
        vilaIr(H);
      });
  } catch (e) {
    console.warn(e);
  }
}
function openCityInspectorBase(c: Cidade) {
  SEL.selectedWild = null;
  SEL.selectedCity = c;
  SEL.selectedHero = null;
  SEL.selectedAnimal = null;
  SEL.selectedPlant = null;
  const $ = (i: string) => document.getElementById(i)!;
  $("insp-animal-stats").style.display = "none";
  $("insp-plant-info").style.display = "block";
  ($("b-growth").closest(".stat-bar-wrap") as HTMLElement).style.display = "none";
  $("insp-tag").textContent = "CIDADE";
  $("insp-tag").style.background = "#e0b35f";
  $("insp-tag").style.color = "#1c140b";
  $("insp-name").textContent = c.name;
  $("insp-id").textContent = c.region + " · Nível " + c.level;
  $("insp-desc").textContent = c.desc;
  const camp = world.heroes[0]
    ? world.heroes[0].camp
    : { x: CONFIG.SIM_BOUNDS.x + 50, y: CONFIG.SIM_BOUNDS.y + CONFIG.SIM_BOUNDS.h - 50 };
  const dd = Math.hypot(c.x - camp.x, c.y - camp.y),
    hrs = (sp: number) => Math.round((dd / sp / 60) * 10) / 10 + "h";
  const prices = Object.keys(c.pay)
    .map((k) => icoItem(ITEM_DEFS[k]) + " " + ITEM_DEFS[k].name + ": " + cityPrice(c, k) + "💰")
    .join("<br>");
  const going = world.heroes
    .filter((h) => h.trip && h.trip.city === c && h.state === "marketgo")
    .map((h) => esc(h.name));
  $("insp-meta-plant").innerHTML =
    "<b>População:</b> " +
    c.pop.toLocaleString("pt-BR") +
    "<br><b>Recursos:</b> " +
    c.res +
    "<br><b>Distância do acampamento:</b> " +
    Math.round(dd) +
    " u (a pé " +
    hrs(tripSpeed("foot")) +
    " · cavalo " +
    hrs(tripSpeed("horse")) +
    " · carroça " +
    hrs(tripSpeed("wagon")) +
    ")" +
    "<br><b>Compra hoje:</b><br>" +
    prices +
    (going.length ? "<br><b>A caminho:</b> " + going.join(", ") : "");
  const act = $("insp-actions");
  act.dataset.sig = "city";
  act.innerHTML = '<button class="btn" data-act="sendhere">💰 Enviar personagem pra cá</button>';
  $("inspector").classList.add("open");
}
export function refreshInspectorIfOpen(_force?: boolean) {
  const open = document.getElementById("inspector")!.classList.contains("open");
  if (!open) return;
  if (SEL.selectedHero) {
    openHeroInspector(SEL.selectedHero, true);
    return;
  }
  if (SEL.selectedCity) {
    return;
  }
  if (SEL.selectedWild) {
    if (SEL.selectedWild.alive) {
      SEL.infoTarget = { kind: SEL.selectedWild.species, x: SEL.selectedWild.x, y: SEL.selectedWild.y };
      openWildInspector(SEL.selectedWild);
    } else document.getElementById("insp-state")!.textContent = "Estado: morto";
    return;
  }
  if (SEL.selectedAnimal && SEL.selectedAnimal.alive) {
    openInspector(SEL.selectedAnimal);
  } else if (SEL.selectedAnimal && !SEL.selectedAnimal.alive) {
    document.getElementById("insp-state")!.textContent = "Estado: morto (" + SEL.selectedAnimal.causeOfDeath + ")";
  } else if (SEL.selectedPlant) {
    openPlantInspector(SEL.selectedPlant);
  }
}
