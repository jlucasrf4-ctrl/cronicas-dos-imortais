/* ==== Fase 4 — quadrantes: o mundo em grade 6×6, só um ativo (base/14) ==== */
import { CITIES } from "../data/economia.ts";
import { MAPART, maDens } from "./vetorial.ts";
import { TELAS, world, SEL, dungeon } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { buildWaterGrid } from "./agua.ts";
import { seedVegetation } from "../sim/vegetacao.ts";
import { seedPopulation } from "../sim/animais.ts";
import { sampleStats } from "../sim/motor.ts";
import { HUD } from "../ui/hud.ts";
import { mvToast } from "../ui/avisos.ts";
import { arqName } from "./vila_musgo.ts";
import { TS } from "../ui/titulo.ts";
import type { Animal, QuadranteSalvo, Wild } from "../core/tipos.ts";

/* =====================================================================
   QUADRANTES: o mundo é dividido numa grade 6x6. Só um quadrante tem o
   ecossistema rodando ("região ativa"); os outros ficam guardados
   (congelados) e voltam do jeito que estavam quando você volta.
===================================================================== */
export const QUAD = {
  cols: 3,
  rows: 3,
  w: 0,
  h: 0,
  active: null as string | null,
  store: {} as Record<string, QuadranteSalvo>,
  pend: null as string | null,
  pendT: 0,
  lockMsgT: 0,
};
const QUAD_COLS = "ABCDEF";
export function quadKey(i: number, j: number) {
  return i + "," + j;
}
export function quadOf(x: number, y: number) {
  return quadKey(
    Math.max(0, Math.min(QUAD.cols - 1, Math.floor(x / QUAD.w))),
    Math.max(0, Math.min(QUAD.rows - 1, Math.floor(y / QUAD.h))),
  );
}
export function quadRect(k: string | null) {
  if (!k) return null;
  const [i, j] = k.split(",").map(Number);
  return { x: i * QUAD.w, y: j * QUAD.h, w: QUAD.w, h: QUAD.h };
}
export function quadName(i: string | number, j?: number) {
  if (typeof i === "string") {
    const a = i.split(",").map(Number);
    i = a[0];
    j = a[1];
  }
  return QUAD_COLS[i] + (j! + 1);
}
export function quadRegion(k: string) {
  // nome da cidade/vila mais próxima do centro
  const r = quadRect(k)!,
    cx = r.x + r.w / 2,
    cy = r.y + r.h / 2;
  let best = null,
    bd = 1e18;
  for (const s of [...CITIES, ...MAPART.villages]) {
    const d = (s.x - cx) ** 2 + (s.y - cy) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best ? "perto de " + best.name : "";
}
function quadLandFrac(k: string) {
  const r = quadRect(k)!;
  let n = 0,
    l = 0;
  for (let x = r.x + 20; x < r.x + r.w; x += 40)
    for (let y = r.y + 20; y < r.y + r.h; y += 40) {
      n++;
      if (maDens(x, y)[2] > 10) l++;
    }
  return n ? l / n : 0;
}
export function quadInit() {
  QUAD.w = TELAS.worldW / QUAD.cols;
  QUAD.h = TELAS.worldH / QUAD.rows;
}
export function quadSetBounds(k: string) {
  const r = quadRect(k)!,
    b = CONFIG.SIM_BOUNDS;
  b.x = r.x + 6;
  b.y = r.y + 6;
  b.w = r.w - 12;
  b.h = r.h - 12;
  QUAD.active = k;
  world.activeQ = k;
}
function quadStash() {
  // guarda o ecossistema do quadrante ativo
  if (!QUAD.active) return;
  const strip = <T extends Animal | Wild>(arr: T[]) =>
    arr
      .filter((a) => a.alive !== false)
      .map((a) => {
        const o: T & Partial<Animal> = Object.assign({}, a);
        if (o.trail) o.trail = [];
        o.target = null;
        o.targetEntity = null;
        if ("carcass" in o) o.carcass = null;
        return o;
      });
  QUAD.store[QUAD.active] = {
    tick: world.tick,
    animals: strip(world.animals),
    carcasses: [],
    wild: strip(world.wild || []),
    nodes: (world.nodes || []).map((n) => Object.assign({}, n)),
    statsHistory: world.statsHistory,
    spLog: world.spLog,
    spTotals: world.spTotals,
  };
  world.qstore = QUAD.store;
}
export function quadActivate(k: string, why?: string) {
  if (!k || k === QUAD.active) return false;
  if (quadLandFrac(k) < 0.04) return false; // só mar: nada pra simular
  quadStash();
  quadSetBounds(k);
  buildWaterGrid(TELAS.mapImg);
  const st = QUAD.store[k];
  SEL.selectedAnimal = null;
  SEL.selectedPlant = null;
  SEL.commandMode = null;
  try {
    document.getElementById("inspector")!.classList.remove("open");
  } catch (e) {}
  if (st) {
    world.animals = st.animals;
    world.carcasses = [];
    world.wild = st.wild;
    world.nodes = st.nodes;
    world.statsHistory = st.statsHistory || {};
    world.spLog = st.spLog || [];
    world.spTotals = st.spTotals || {};
    seedVegetation();
    for (const p of world.veg) p.growth = Math.min(1, 0.6 + p.growth * 0.4);
  } else {
    world.carcasses = [];
    world.statsHistory = { rabbit: [], deer: [], wolf: [], fox: [], duck: [], eagle: [] };
    world.spLog = [];
    world.spTotals = {};
    seedVegetation();
    world.animals = [];
    seedPopulation();
  }
  sampleStats();
  SEL.renderEventFeedDirty = true;
  MAPART.dirty = true;
  HUD.mmBase = null;
  if (why !== "silent") mvToast("🗺 Região ativa: " + (arqName(k) || quadName(k)) + " " + quadRegion(k));
  return true;
}
function quadHeroLock() {
  // heróis caçando/indo caçar no quadrante ativo seguram a região
  for (const h of world.heroes)
    if ((h.state === "hunting" || h.state === "traveling") && h.task && quadOf(h.task.x, h.task.y) === QUAD.active)
      return h;
  return null;
}
export function quadTick(dt: number) {
  /* v7.7 — a região ativa segue os heróis, não mais a câmera: com a câmera livre (RTS) só olhar outro quadrante por
     1,2 s trocava o ecossistema e reconstruía água, rotas e plantas (~75 ms de travada). Agora troca quando um herói
     vai para lá (caçar/coletar ou andar), ou quando a heroína do mapa já está lá. */
  if (!QUAD.active || TS.open || dungeon.active || !TELAS.worldW) return;
  for (const h of world.heroes)
    if ((h.state === "traveling" || h.state === "hunting") && h.task) {
      const k = quadOf(h.task.x, h.task.y);
      if (k !== QUAD.active && !quadHeroLock()) {
        quadActivate(k);
        return;
      }
    }
  const alvo = quadAlvoAndando();
  if (!alvo || alvo === QUAD.active) {
    QUAD.pend = null;
    return;
  }
  if (QUAD.pend !== alvo) {
    QUAD.pend = alvo;
    QUAD.pendT = 0;
    return;
  }
  QUAD.pendT += dt;
  if (QUAD.pendT < 0.5) return;
  const lock = quadHeroLock();
  if (lock) {
    if (performance.now() - QUAD.lockMsgT > 8000) {
      QUAD.lockMsgT = performance.now();
      mvToast(
        "🔒 " + lock.name + " está caçando em " + quadName(QUAD.active) + " — a região ativa fica lá até ele voltar",
      );
    }
    return;
  }
  QUAD.pend = null;
  quadActivate(alvo);
}
/** v7.7 — o quadrante para onde um herói está passando a pé: fora da região ativa (depois de um load, por exemplo) ou
    encostado na borda dela (a simulação o segura lá dentro) com o destino do outro lado. null = nenhum. */
function quadAlvoAndando() {
  const b = CONFIG.SIM_BOUNDS;
  for (const h of world.heroes) {
    if (h.state === "indungeon") continue;
    const w = h.walkTo;
    if (h.state !== "walking" || !w || quadOf(w.x, w.y) === QUAD.active) continue;
    const aqui = quadOf(h.x, h.y);
    if (aqui !== QUAD.active) return aqui;
    const borda = Math.min(h.x - b.x, b.x + b.w - h.x, h.y - b.y, b.y + b.h - h.y);
    if (borda > 14) continue;
    const d = Math.hypot(w.x - h.x, w.y - h.y) || 1;
    return quadOf(h.x + ((w.x - h.x) / d) * 30, h.y + ((w.y - h.y) / d) * 30);
  }
  return null;
}
