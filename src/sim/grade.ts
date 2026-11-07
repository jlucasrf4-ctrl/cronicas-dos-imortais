/* ==== Fase 4 — grade espacial: percepção entre animais (base/01) ==== */
import { world, CACA } from "../core/state.ts";
import { GRID_CELL } from "../core/config.ts";
import { inArea } from "../map/caca.ts";
import type { GradeEspacial } from "../core/tipos.ts";

/* ---------------------------------------------------------------------
   5. SPATIAL GRID — percepção eficiente entre animais
--------------------------------------------------------------------- */
/** v7.7 — chave numérica da célula (antes um texto "cx,cy" montado a cada consulta: o que mais pesava no passo). */
const chave = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);
export function buildSpatialGrid() {
  const grid: GradeEspacial = new Map();
  for (const a of world.animals) {
    if (!a.alive) continue;
    const key = chave(Math.floor(a.x / GRID_CELL), Math.floor(a.y / GRID_CELL));
    const L = grid.get(key);
    if (L) L.push(a);
    else grid.set(key, [a]);
  }
  return grid;
}
export function queryNearby(grid: GradeEspacial, x: number, y: number, range: number) {
  const L = queryNearbyBase(grid, x, y, range);
  /* v5.9.11 */
  return CACA.HUNT_AREA ? L.filter(inArea) : L;
}
function queryNearbyBase(grid: GradeEspacial, x: number, y: number, range: number) {
  const out = [];
  const minCx = Math.floor((x - range) / GRID_CELL),
    maxCx = Math.floor((x + range) / GRID_CELL);
  const minCy = Math.floor((y - range) / GRID_CELL),
    maxCy = Math.floor((y + range) / GRID_CELL);
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const bucket = grid.get(chave(cx, cy));
      if (bucket) for (const a of bucket) out.push(a);
    }
  }
  return out;
}
