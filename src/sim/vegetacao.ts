/* ==== Fase 4 — vegetação: semear, crescer e achar comida (base/01) ==== */
import { CONFIG } from "../core/config.ts";
import { rollPlantKind } from "../data/especies.ts";
import { world } from "../core/state.ts";
import { isWaterCell } from "../map/agua.ts";

/* ---------------------------------------------------------------------
   4. VEGETATION SYSTEM
--------------------------------------------------------------------- */
export function seedVegetation() {
  const b = CONFIG.SIM_BOUNDS;
  const sp = CONFIG.VEG_SPACING;
  const veg = [];
  for (let y = b.y; y < b.y + b.h; y += sp) {
    for (let x = b.x; x < b.x + b.w; x += sp) {
      const jx = x + (Math.random() - 0.5) * sp * 0.7;
      const jy = y + (Math.random() - 0.5) * sp * 0.7;
      if (isWaterCell(jx, jy)) continue;
      veg.push({ x: jx, y: jy, growth: 0.5 + Math.random() * 0.5, kind: rollPlantKind() });
    }
  }
  world.veg = veg;
}

export function findNearestFood(x: number, y: number, visionRange: number) {
  let best = null,
    bestD = visionRange * visionRange;
  for (let i = 0; i < world.veg.length; i++) {
    const p = world.veg[i];
    if (p.growth < 0.2) continue;
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

export function updateVegetation(dtMin: number) {
  const regrow = 0.0007 * dtMin; // v3.6: comida limitada (antes 0.0025 = comida infinita)
  for (let i = 0; i < world.veg.length; i++) {
    const p = world.veg[i];
    if (p.growth < 1) {
      p.growth = Math.min(1, p.growth + regrow * (1 - p.growth * 0.3));
    }
  }
}
