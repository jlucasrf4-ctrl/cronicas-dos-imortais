/* ==== Fase 4 — salvar e carregar: espaços no localStorage (base/18) ==== */
import { world, econ, camera, dungeon, TELAS, MEMO, SEL, OPT, JANELAS } from "../core/state.ts";
import { QUAD, quadOf, quadSetBounds } from "../map/quadrantes.ts";
import { WORLD_K } from "../map/vetorial.ts";
import { MV_VER } from "../ui/opcoes.ts";
import { CONFIG, SPAWN0 } from "../core/config.ts";
import { fmtClock, clamp } from "../core/util.ts";
import { mvToast } from "../ui/avisos.ts";
import { lsSet, lsGet } from "../core/storage.ts";
import { buildWaterGrid } from "../map/agua.ts";
import { seedVegetation } from "../sim/vegetacao.ts";
import { seedPopulation } from "../sim/animais.ts";
import { constrainCamera, applyCameraTransform, qValid, fitToScreen } from "../map/camera.ts";
import { updateHeroPanelUI, updateClockUI } from "../ui/painel.ts";
import { updateEcon } from "../econ/economia.ts";
import { sampleStats } from "../sim/motor.ts";
import { runeRebindItems } from "../runas/runas.ts";
import { limparAreaReservada } from "../map/recursos.ts";
import { migrarFormasA2 } from "../items/grade_a2.ts";
import { TS } from "../ui/titulo.ts";
import { normalizarAparenciaHeroi } from "../hero/nivel.ts";
import type { Econ, Ponto, SaveData, SaveMeta, World } from "../core/tipos.ts";

/* ---------- salvar / carregar ---------- */
export const SAVE_SLOTS = ["auto", "1", "2", "3"],
  SKEY = (s: string) => "cdi.save." + s,
  MKEY = (s: string) => "cdi.savemeta." + s;
export const WORLD_SAVE_KEYS: (keyof World)[] = [
  "qstore",
  "activeQ",
  "tick",
  "nextId",
  "events",
  "statsHistory",
  "spLog",
  "spTotals",
  "counters",
  "speedMult",
  "veg",
  "animals",
  "carcasses",
  "heroes",
  "wild",
  "nodes",
  "recursosCampo",
  "_br",
  "_wa",
  "_imm",
];
export function saveBlob() {
  const ents = new Set([
      ...world.animals,
      ...world.veg,
      ...world.heroes,
      ...world.carcasses,
      ...(world.wild || []),
      ...(world.nodes || []),
    ]),
    W: Partial<World> = {};
  for (const k of WORLD_SAVE_KEYS) if (world[k] !== undefined) (W as Record<keyof World, unknown>)[k] = world[k];
  W.qstore = Object.assign({}, QUAD.store);
  delete W.qstore[QUAD.active!];
  W.activeQ = QUAD.active;
  return JSON.stringify(
    {
      v: 1,
      K: WORLD_K,
      ver: MV_VER,
      at: Date.now(),
      world: W,
      econ,
      cam: { scale: camera.scale, tx: camera.tx, ty: camera.ty },
    } satisfies SaveData,
    function (k, v) {
      if (v instanceof Set || v instanceof Map || typeof v === "function") return undefined;
      if (v && typeof v === "object" && !Array.isArray(this) && ents.has(v)) return null; // referência a outro ser vira null (a IA reencontra)
      return v;
    },
  );
}
export function saveMeta(): SaveMeta {
  return {
    at: Date.now(),
    day: Math.floor(world.tick / CONFIG.DAY_MIN) + 1,
    time: fmtClock(world.tick),
    heroes: world.heroes.map((h) => h.name + " Nv." + (h.lvl || 1)),
    gold: econ.gold,
    ver: MV_VER,
  };
}
export function saveTo(slot: string, silent?: boolean) {
  if (dungeon.active) {
    mvToast("Não dá para salvar dentro da masmorra");
    return false;
  }
  const ok = lsSet(SKEY(slot), saveBlob()) && lsSet(MKEY(slot), saveMeta());
  if (ok) {
    if (!silent) mvToast("💾 Jogo salvo" + (slot === "auto" ? " (automático)" : " no espaço " + slot));
  } else mvToast("⚠ Não foi possível salvar (armazenamento do navegador cheio ou bloqueado)");
  return ok;
}

export function slotMeta(slot: string) {
  return lsGet(MKEY(slot));
}
export function latestSlot() {
  let best = null,
    bt = 0;
  for (const s of SAVE_SLOTS) {
    const m = slotMeta(s);
    if (m && m.at > bt && lsGet(SKEY(s))) {
      bt = m.at;
      best = s;
    }
  }
  return best;
}
export function applySave(data: SaveData) {
  if (!data || !data.world || !Array.isArray(data.world.animals)) throw new Error("arquivo de save inválido");
  if (dungeon.active) {
    dungeon.active = false;
    document.getElementById("dungeon-view")!.classList.remove("open");
  }
  const oldK = data.K || 1;
  if (oldK !== WORLD_K) {
    // save do mundo antigo (menor): leva os heróis para a escala nova e recria a natureza
    const f = WORLD_K / oldK,
      sc = (o: Ponto) => {
        if (o && typeof o.x === "number") {
          o.x *= f;
          o.y *= f;
        }
      };
    for (const h of data.world.heroes || []) {
      sc(h);
      sc(h.camp);
      if (h.task) sc(h.task);
      h.trail = [];
      h.localTarget = null;
      h.targetEntity = null;
      if (h.trip) {
        h.trip = null;
        h.state = "idle";
      }
      if (h.state === "traveling" || h.state === "hunting" || h.state === "returning") {
        h.state = "idle";
        h.task = null;
        h.x = h.camp.x;
        h.y = h.camp.y;
      }
    }
    for (const k of ["animals", "veg", "carcasses", "wild", "nodes", "qstore", "activeQ"] as const)
      delete data.world[k];
    data.world.statsHistory = { rabbit: [], deer: [], wolf: [], fox: [], duck: [], eagle: [] };
    data.cam = null;
  }
  for (const k of WORLD_SAVE_KEYS)
    if (data.world[k] !== undefined) (world as Record<keyof World, unknown>)[k] = data.world[k];
  for (const h of world.heroes) normalizarAparenciaHeroi(h);
  QUAD.store = world.qstore || {};
  if (world.qver !== 3) {
    QUAD.store = {};
    world.qver = 3;
  }
  world.qstore = QUAD.store;
  {
    const h0 = world.heroes[0],
      key =
        qValid(data.world.activeQ!) ||
        (h0 ? quadOf(h0.camp.x, h0.camp.y) : quadOf(SPAWN0.x * WORLD_K, SPAWN0.y * WORLD_K));
    QUAD.active = null;
    quadSetBounds(key);
    buildWaterGrid(TELAS.mapImg);
    if (!data.world.runes) world.runes = [];
    if (!data.world.animals) {
      world.carcasses = [];
      seedVegetation();
      world.animals = [];
      seedPopulation();
    }
    if (!data.cam) setTimeout(fitToScreen, 30);
  }
  world.fastForwardTarget = 0;
  world.paused = false;
  for (const a of world.animals) {
    if (a.targetEntity === undefined) a.targetEntity = null;
    if (!a.trail) a.trail = [];
  }
  for (const h of world.heroes) {
    if (!h.trail) h.trail = [];
    if (h.state === "dungeon" || h.state === "expedition") h.state = "idle";
  }
  limparAreaReservada(); // v8.1: pedras e árvores que nasceram em cima do acampamento ou da vila
  const e0 = JSON.parse(JSON.stringify(MEMO.ECON0));
  for (const k of Object.keys(econ) as (keyof Econ)[])
    if (!(k in data.econ)) (econ as Record<keyof Econ, unknown>)[k] = e0[k];
  Object.assign(econ, data.econ);
  SEL.selectedAnimal = null;
  SEL.selectedPlant = null;
  SEL.selectedHero = null;
  SEL.selectedCity = null;
  SEL.commandMode = null;
  document.getElementById("inspector")!.classList.remove("open");
  document.getElementById("command-hint")!.style.display = "none";
  if (data.cam && TELAS.worldW) {
    camera.scale = clamp(data.cam.scale, camera.minScale, camera.maxScale);
    camera.tx = data.cam.tx;
    camera.ty = data.cam.ty;
    constrainCamera();
    applyCameraTransform();
  }
  SEL.renderEventFeedDirty = true;
  try {
    runeRebindItems();
    econ.stash.infinito = true; // v7.7: baú infinito (items/bau_infinito.ts); saves antigos chegam sem a marca
    const aoBau = migrarFormasA2(); // v7.7: formas da grade A2 (items/grade_a2.ts)
    if (aoBau) mvToast("Mochila rearrumada (formas novas): " + aoBau + " item(ns) foram para o baú.");
    updateHeroPanelUI();
    updateEcon();
    sampleStats();
    updateClockUI();
  } catch (e) {
    console.warn(e);
  }
}
export function loadFrom(slot: string) {
  const raw = (() => {
    try {
      return localStorage.getItem(SKEY(slot));
    } catch (e) {
      return null;
    }
  })();
  if (!raw) {
    mvToast("Esse espaço está vazio");
    return false;
  }
  try {
    applySave(JSON.parse(raw));
    mvToast("📜 Jogo carregado — Dia " + (Math.floor(world.tick / CONFIG.DAY_MIN) + 1));
    return true;
  } catch (e) {
    console.warn(e);
    mvToast("⚠ Não foi possível carregar esse save");
    return false;
  }
}
export function exportSave(slot: string | null) {
  const raw = slot
    ? (() => {
        try {
          return localStorage.getItem(SKEY(slot));
        } catch (e) {
          return null;
        }
      })()
    : saveBlob();
  if (!raw) return;
  const m = slot ? slotMeta(slot) : saveMeta(),
    a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  a.download = "cronicas_dos_imortais_dia" + ((m && m.day) || 1) + ".json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
export function importSave(after: (ok?: boolean) => void) {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = () => {
    const f = inp.files![0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        applySave(JSON.parse(r.result as string));
        mvToast("📜 Save importado");
        if (after) after(true);
      } catch (e) {
        mvToast("⚠ Arquivo inválido");
      }
    };
    r.readAsText(f);
  };
  inp.click();
}
export function autosaveTick(dt: number) {
  if (!OPT.autosave || TS.open || dungeon.active || !world.heroes.length) return;
  JANELAS._autoT += dt;
  if (JANELAS._autoT > 180) {
    JANELAS._autoT = 0;
    saveTo("auto", true);
    mvToast("💾 Salvo automaticamente");
  }
}
