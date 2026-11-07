/* ==== Fase 4 — nós de recurso do mapa: árvores e pedras (base/07) ==== */
import { MEMO, TELAS, world, econ, CACA } from "../core/state.ts";
import { WORLD_K } from "./vetorial.ts";
import { CONFIG, SPAWN0 } from "../core/config.ts";
import { isWaterCell } from "./agua.ts";
import { AREA_RESERVADA, ROCK_ZONES, TREE_WOOD } from "../data/recursos.ts";
import { musgoCity } from "./vila_musgo.ts";
import { galhoAdd } from "../items/galho.ts";
import { pushEvent } from "../sim/eventos.ts";
import { resAdd } from "../expedicao/preparo.ts";
import { updateEcon, giveMeat, meatInPack } from "../econ/economia.ts";
import { profLv } from "../hero/proficiencias.ts";
import { tryAddItem, tryAddToInv } from "../field/chao.ts";
import { rollTier } from "../items/inventario.ts";
import { mapFloat } from "./caca.ts";
import { HERO_VISION, HERO_SPEED } from "../data/herois.ts";
import { moveStep, wanderHeroLocal, killAnimal, snapToLand } from "../sim/animais.ts";
import { clamp } from "../core/util.ts";
import { gainSkill } from "../hero/nivel.ts";
import { fishStep, fishSpot, askWork, workVerb } from "../minijogos/trabalho.ts";
import { queryNearby } from "../sim/grade.ts";
import { killWild } from "../sim/fauna.ts";
import { huntLabel } from "../render/sprites.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { runePickAt, runeSend } from "../runas/runas.ts";
import { CACADA } from "../data/mapa.ts";
import { cacadaAchou } from "./cacada.ts";
import type { Animal, GradeEspacial, Hero, NoRecurso, Wild } from "../core/tipos.ts";

/* ---- nós de recurso (árvores e pedras) ---- */
function mapPixels() {
  if (MEMO._mapPix) return MEMO._mapPix;
  const c = document.createElement("canvas");
  c.width = TELAS.mapImg.naturalWidth;
  c.height = TELAS.mapImg.naturalHeight;
  const x = c.getContext("2d", { willReadFrequently: true });
  x!.drawImage(TELAS.mapImg, 0, 0);
  MEMO._mapPix = x!.getImageData(0, 0, c.width, c.height);
  return MEMO._mapPix;
}
function mapLum(px: number, py: number) {
  // média 7x7: [r,g,b] (lê o mapa original, então converte da escala do mundo)
  px = Math.round(px / WORLD_K);
  py = Math.round(py / WORLD_K);
  const im = mapPixels();
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let y = py - 3; y <= py + 3; y++)
    for (let x = px - 3; x <= px + 3; x++) {
      if (x < 0 || y < 0 || x >= im.width || y >= im.height) continue;
      const i = (y * im.width + x) * 4;
      r += im.data[i];
      g += im.data[i + 1];
      b += im.data[i + 2];
      n++;
    }
  return [r / n, g / n, b / n];
}
export function rndIn(z: number[]) {
  const a = Math.random() * 6.283,
    r = Math.sqrt(Math.random()) * z[2] * WORLD_K;
  return { x: z[0] * WORLD_K + Math.cos(a) * r, y: z[1] * WORLD_K + Math.sin(a) * r };
}
/** v8.1 — perto do acampamento ou da vila (AREA_RESERVADA): ali não nasce recurso do mapa. */
function areaReservada(x: number, y: number) {
  const camps = world.heroes.length
    ? world.heroes.map((h) => h.camp)
    : [{ x: SPAWN0.x * WORLD_K, y: SPAWN0.y * WORLD_K }];
  if (camps.some((c) => c && Math.hypot(c.x - x, c.y - y) < AREA_RESERVADA.acampamento)) return true;
  const v = musgoCity();
  return !!v && Math.hypot(v.x - x, v.y - y) < AREA_RESERVADA.vila;
}
/** v8.1 — tira os recursos que nasceram na área reservada (saves de antes da regra). */
export function limparAreaReservada() {
  if (world.nodes?.some((n) => areaReservada(n.x, n.y)))
    world.nodes = world.nodes.filter((n) => !areaReservada(n.x, n.y));
}
function addNode(kind: string, x: number, y: number, size: string) {
  const n = { kind, size, x, y, alive: true, readyAt: 0, id: kind + "-" + world.nextId++ };
  world.nodes!.push(n);
  return n;
}
export function seedNodes() {
  world.nodes = [];
  const b = CONFIG.SIM_BOUNDS;
  let tries = 0;
  while (world.nodes.filter((n) => n.kind === "tree").length < 70 && tries++ < 4000) {
    const x = Math.floor(b.x + Math.random() * b.w),
      y = Math.floor(b.y + Math.random() * b.h);
    if (isWaterCell(x, y) || areaReservada(x, y)) continue;
    const [r, g, bl] = mapLum(x, y),
      lum = (r + g + bl) / 3;
    if (!(g > r + 4 && g > bl + 14 && lum < 92)) continue;
    if (world.nodes.some((o) => Math.hypot(o.x - x, o.y - y) < 16)) continue;
    addNode("tree", x, y, lum < 62 ? "large" : lum < 78 ? "medium" : "small");
  }
  for (let i = 0; i < 55; i++) addRock();
}
export function addRock() {
  for (let t = 0; t < 40; t++) {
    let p;
    if (Math.random() < 0.65) p = rndIn(ROCK_ZONES[Math.floor(Math.random() * ROCK_ZONES.length)]);
    else {
      const w = world.waterPoints[Math.floor(Math.random() * world.waterPoints.length)];
      if (!w) continue;
      p = { x: w.x + (Math.random() - 0.5) * 22, y: w.y + (Math.random() - 0.5) * 22 };
    }
    const b = CONFIG.SIM_BOUNDS;
    if (
      p.x < b.x ||
      p.y < b.y ||
      p.x > b.x + b.w ||
      p.y > b.y + b.h ||
      isWaterCell(p.x, p.y) ||
      areaReservada(p.x, p.y)
    )
      continue;
    return addNode("rock", p.x, p.y, "rock");
  }
}

export function nodeReady(n: NoRecurso) {
  return world.tick >= n.readyAt;
}

export function collectNode(h: Hero, n: NoRecurso) {
  /* v5.9.13 (antes) */
  const w0 = (h.loot && h.loot.wood) || 0;
  if (n.kind === "tree") {
    const r = TREE_WOOD[n.size],
      amt = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
    h.loot.wood += amt;
    galhoAdd(h, Math.ceil(amt / 2));
    n.readyAt = world.tick + 2 * CONFIG.DAY_MIN;
    h.task!.killsDone++;
    pushEvent(
      h.name +
        " coletou " +
        amt +
        " lenha e " +
        Math.ceil(amt / 2) +
        " galho(s) de uma árvore " +
        ({ small: "pequena", medium: "média", large: "grande" } as Record<string, string>)[n.size] +
        " (a árvore continua de pé e volta a dar galhos em 2 dias).",
    );
  } else {
    const amt = 1 + (Math.random() < 0.4 ? 1 : 0);
    resAdd(h, "stone", amt);
    n.readyAt = Infinity;
    h.task!.killsDone++;
    pushEvent(h.name + " coletou " + amt + " pedra(s) do chão.");
  }
  updateEcon();
  /* v5.9.11 */
  try {
    if (n && n.kind === "rock") {
      const lv = profLv(h, "coletor"),
        roll = Math.random();
      if (roll < 0.05 + lv * 0.004) {
        if (tryAddItem(h, "prata", 0) || tryAddToInv(econ.stash, "prata", 0))
          pushEvent("⛏ " + h.name + " achou Minério de Prata!");
      } else if (roll < 0.22 + lv * 0.01) {
        if (tryAddItem(h, "ferro", Math.random() < 0.15 ? 1 : 0) || tryAddToInv(econ.stash, "ferro", 0))
          pushEvent("⛏ " + h.name + " achou Minério de Ferro.");
      }
      if (Math.random() < 0.015 + lv * 0.001) {
        const tr = rollTier(false);
        if (tryAddItem(h, "gema", tr) || tryAddToInv(econ.stash, "gema", tr))
          pushEvent("💎 " + h.name + " achou uma gema na mineração!");
      }
    }
  } catch (_) {}
  /* v5.9.13 (depois) */
  try {
    const dw = ((h.loot && h.loot.wood) || 0) - w0;
    if (dw > 0) mapFloat(h, "+" + dw + " lenha · +" + Math.ceil(dw / 2) + " galho", "galho");
  } catch (_) {}
}
function gatherStep(h: Hero, dt: number) {
  const kind = h.task!.targetSpecies;
  let n = h.targetEntity as NoRecurso | null; // na coleta o alvo é sempre um nó
  if (!n || n.kind !== kind || !nodeReady(n)) {
    let best = null,
      bd = HERO_VISION * 1.5;
    for (const o of world.nodes!) {
      if (o.kind !== kind || !nodeReady(o)) continue;
      const d = Math.hypot(o.x - h.x, o.y - h.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    h.targetEntity = n = best;
    h.gatherT = 0;
  }
  if (n) {
    const d = moveStep(h, n.x, n.y, HERO_SPEED * 1.1, dt, true);
    if (d < 9) {
      h.gatherT = (h.gatherT || 0) + dt;
      if (h.gatherT >= 15) {
        collectNode(h, n);
        h.targetEntity = null;
        h.gatherT = 0;
      }
    }
  } else wanderHeroLocal(h, dt);
}
export function huntStep(h: Hero, dtMin: number, grid: GradeEspacial) {
  h.huntTimer += dtMin;
  const tg = h.task!.targetSpecies;
  if (tg === "tree" || tg === "rock") gatherStep(h, dtMin);
  else if (tg === "fish") fishStep(h, dtMin);
  else {
    const wildT = tg === "duck" || tg === "eagle" || tg === "fox"; // os de world.wild
    if (!h.targetEntity || !h.targetEntity.alive) {
      let best = null,
        bestD = HERO_VISION * (wildT ? 1.3 : 1);
      for (const o of (wildT ? world.wild : queryNearby(grid, h.x, h.y, HERO_VISION))!) {
        if (
          !o.alive ||
          o.species !== tg ||
          (tg === "eagle" && o.state !== "perch") ||
          (tg === "duck" && o.state === "fly")
        )
          continue;
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      h.targetEntity = best;
    }
    const t = h.targetEntity as Animal | Wild | null; // na caça o alvo é sempre um bicho
    if (t && t.alive && !(wildT && (t.state === "fly" || (tg === "eagle" && t.state !== "perch")))) {
      const d = moveStep(h, t.x, t.y, HERO_SPEED * 1.15, dtMin, true);
      // v7.7: a primeira presa alcançada vira caçada no campo (map/cacada.ts; as espécies de CACADA.especies)
      if (d < 18 && !cacadaAchou(h, t)) {
        const lv = (h.skills.arco && h.skills.arco.level) || 0,
          mult = ({ deer: 0.6, eagle: 0.45, duck: 1.4, fox: 0.7 } as Record<string, number>)[tg] || 1;
        if (Math.random() < clamp(0.035 + lv * 0.013 + h.attrs.forca * 0.003, 0.02, 0.4) * mult) {
          if (wildT) {
            killWild(t as Wild, "caçado por " + h.name);
            if (tg === "fox") {
              // v8.0: a raposa é caçada pela pele
              tryAddItem(h, "pele", 0);
              pushEvent(h.name + " caçou uma raposa (+1 pele).");
            } else if (tg === "duck") {
              const f = 1 + (Math.random() < 0.5 ? 1 : 0);
              resAdd(h, "feather", f);
              CACA.MEAT_SRC = "pato";
              giveMeat(h, 1);
              pushEvent(h.name + " caçou um pato (+" + f + " pena, +1 carne).");
            } else {
              const f = 1 + (Math.random() < 0.3 ? 1 : 0);
              resAdd(h, "eagle", f);
              CACA.MEAT_SRC = "pato";
              giveMeat(h, 2, 0.1);
              pushEvent(h.name + " abateu uma águia (+" + f + " pena de águia, +2 carne).");
            }
            gainSkill(h, "arco", tg === "eagle" ? 10 : 5);
          } else {
            const isDeer = tg === "deer",
              isBoar = tg === "boar",
              isWolf = tg === "wolf",
              meat = isDeer
                ? 5 + (Math.random() < 0.5 ? 1 : 0)
                : isBoar || isWolf
                  ? 4 + (Math.random() < 0.5 ? 1 : 0)
                  : 1 + (Math.random() < 0.5 ? 1 : 0);
            const meatF = h.task!.fraca ? Math.max(1, Math.round(meat * CACADA.fracasso)) : meat; // v7.7: a presa fugiu
            killAnimal(t as Animal, "caçado por " + h.name);
            giveMeat(h, meatF, isDeer ? 0.06 : 0);
            gainSkill(h, "arco", isDeer ? 8 : 4);
            pushEvent(
              h.name +
                " caçou " +
                (isDeer ? "um cervo" : isBoar ? "um javali" : isWolf ? "um lobo" : "um coelho") +
                " em campo (+" +
                meatF +
                " carne, na mochila: " +
                meatInPack(h) +
                ").",
            );
          }
          h.task!.killsDone++;
          h.targetEntity = null;
          updateEcon();
        } else gainSkill(h, "arco", 0.6);
      }
    } else wanderHeroLocal(h, dtMin);
  }
  if (h.huntTimer > (h.task!.maxMin || 700)) {
    pushEvent(h.name + " terminou o tempo (" + huntLabel(tg) + ") e está voltando.");
    h.state = "returning";
    h.targetEntity = null;
  }
}
export function dispatchHero(kind: string, x: number, y: number) {
  if (kind === "runa") {
    const r = runePickAt(x, y);
    if (r) runeSend(r);
    return;
  }
  const h = world.heroes.find((o) => o.state === "idle");
  if (!h) {
    pushEvent("Nenhum personagem livre no acampamento.");
    return;
  }
  h.huntSpecies = kind;
  const p = kind === "fish" ? fishSpot(x, y) : snapToLand(x, y);
  if (!p) {
    pushEvent("Escolha um ponto perto da água para pescar.");
    return;
  }
  askWork(h, kind, () => {
    if (h.state !== "idle") return;
    h.task = { x: p.x, y: p.y, targetSpecies: kind, killsWanted: 99999, killsDone: 0, maxMin: (h.huntHours || 6) * 60 };
    h.state = "traveling";
    h.targetEntity = null;
    pushEvent(h.name + " foi " + workVerb(kind) + huntLabel(kind) + " por " + (h.huntHours || 6) + "h.");
    updateHeroPanelUI();
  });
}
