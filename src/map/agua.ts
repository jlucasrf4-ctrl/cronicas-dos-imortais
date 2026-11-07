/* ==== Fase 4 — água do mapa: grade de células de água lida dos pixels (base/01) ==== */
import { CONFIG } from "../core/config.ts";
import { world, MEMO } from "../core/state.ts";
import { navBuild, NAV } from "./navegacao.ts";
import { MAPART, WORLD_K } from "./vetorial.ts";
import { foraDaMontanha, montanhaEm } from "./terreno.ts";
import { limparAreaReservada } from "./recursos.ts";

/* ---------------------------------------------------------------------
   3. WATER SYSTEM — lê os próprios pixels do mapa pra achar água de verdade
--------------------------------------------------------------------- */
export function buildWaterGrid(img: HTMLImageElement) {
  // água do quadrante ativo; usa o contorno vetorial do mapa (mesmo desenho da arte)
  const b = CONFIG.SIM_BOUNDS,
    step = world.waterGridStep,
    grid = new Set<string>(),
    points = [];
  const gx0 = Math.ceil(b.x / step) * step,
    gy0 = Math.ceil(b.y / step) * step,
    nx = Math.floor((b.x + b.w - gx0) / step) + 1,
    ny = Math.floor((b.y + b.h - gy0) / step) + 1;
  let land = null;
  if (typeof MAPART !== "undefined" && MAPART.coast) {
    const cv = document.createElement("canvas");
    cv.width = nx;
    cv.height = ny;
    const c = cv.getContext("2d", { willReadFrequently: true });
    c!.setTransform(1 / step, 0, 0, 1 / step, -gx0 / step + 0.5, -gy0 / step + 0.5);
    c!.fillStyle = "#fff";
    c!.fill(MAPART.coast, "evenodd");
    land = c!.getImageData(0, 0, nx, ny).data;
  } else {
    if (!MEMO._pngWater) {
      const off = document.createElement("canvas");
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const o = off.getContext("2d", { willReadFrequently: true });
      o!.drawImage(img, 0, 0);
      MEMO._pngWater = { d: o!.getImageData(0, 0, off.width, off.height).data, w: off.width, h: off.height };
    }
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const wx = gx0 + i * step,
        wy = gy0 + j * step;
      let isW;
      if (land) isW = land[(j * nx + i) * 4 + 3] < 128;
      else {
        const px = Math.min(MEMO._pngWater!.w - 1, Math.floor(wx / WORLD_K)),
          py = Math.min(MEMO._pngWater!.h - 1, Math.floor(wy / WORLD_K)),
          k = (py * MEMO._pngWater!.w + px) * 4;
        isW = MEMO._pngWater!.d[k + 2] - MEMO._pngWater!.d[k] > 12;
      }
      if (isW) {
        grid.add(wx + "," + wy);
        points.push({ x: wx, y: wy });
      }
    }
  world.waterGrid = grid;
  world.waterPoints = points;
  refazerNav(); /* v6.2 */
}
/** Refaz a grade de navegação (água e, v8.1, o paredão da montanha) e esquece as rotas guardadas. v8.1: também quando
 *  a densidade do mapa termina de carregar (map/vetorial.ts), que é o que diz onde está a montanha; e quem está no
 *  paredão (save de antes da montanha barrar) vai para o pé dela. */
export function refazerNav() {
  try {
    navBuild();
    for (const a of world.animals || []) {
      a.nav = null;
      a.ign = null;
      if (montanhaEm(a.x, a.y)) Object.assign(a, foraDaMontanha(a.x, a.y));
    }
    for (const h of world.heroes || []) {
      h.nav = null;
      if (h.state !== "indungeon" && montanhaEm(h.x, h.y)) Object.assign(h, foraDaMontanha(h.x, h.y));
    }
    limparAreaReservada(); // v8.1: árvores e pedras do mapa que tinham nascido no paredão
  } catch (e) {
    console.warn("nav", e);
    NAV.ready = false;
  }
}
export function isWaterCell(x: number, y: number) {
  // reescrita na v6.2
  if (!NAV.ready) {
    const st = world.waterGridStep;
    return world.waterGrid!.has(Math.round(x / st) * st + "," + Math.round(y / st) * st);
  }
  const i = Math.round((x - NAV.ox) / NAV.step),
    j = Math.round((y - NAV.oy) / NAV.step);
  if (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) return false;
  return NAV.blocked![j * NAV.w + i] === 1;
}

export function findNearestWater(x: number, y: number, maxDist: number) {
  let best = null,
    bestD = maxDist * maxDist;
  for (let i = 0; i < world.waterPoints.length; i++) {
    const p = world.waterPoints[i];
    const dx = p.x - x,
      dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = p;
    }
  }
  return best;
}
