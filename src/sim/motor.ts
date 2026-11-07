/* ==== Fase 4 — motor da simulação: tick fixo e amostras de população (base/01) ==== */
import { ALL_KEYS } from "../data/especies.ts";
import { world, dungeon } from "../core/state.ts";
import { BICHOS } from "../map/mundo.ts";
import { CONFIG } from "../core/config.ts";
import { populationOf, decideAndAct, updateHero } from "./animais.ts";
import { updateVegetation } from "./vegetacao.ts";
import { buildSpatialGrid } from "./grade.ts";
import { updateWild, updateImmigration } from "./fauna.ts";
import { runeSimTick } from "../runas/runas.ts";
import { perigoTick } from "../map/perigo.ts";

export function sampleStats() {
  for (const key of ALL_KEYS) {
    const arr = world.statsHistory[key] || (world.statsHistory[key] = []);
    arr.push(populationOf(key));
    if (arr.length > CONFIG.MAX_STATS_SAMPLES) arr.shift();
  }
}

/* ---------------------------------------------------------------------
   10. SIMULATION ENGINE — tick fixo, independente do framerate
--------------------------------------------------------------------- */
export function simTick(dtMin: number) {
  /* v6.2 */
  world.navBudget = 40;
  world.tick += dtMin;

  updateVegetation(dtMin);

  const grid = buildSpatialGrid();
  for (let i = 0; i < world.animals.length; i++) {
    const a = world.animals[i];
    if (!a.alive || (dungeon.active && BICHOS.presos.has(a))) continue; // v8.0: no campo aberto, quem move é o campo
    decideAndAct(a, dtMin, grid);
    a.trail.push({ x: a.x, y: a.y });
    if (a.trail.length > 14) a.trail.shift();
  }

  for (const h of world.heroes) updateHero(h, dtMin, grid);
  perigoTick(); // v8.1: alguém do clã sozinho perto de uma Runa Selvagem (map/perigo.ts)
  updateWild(dtMin);
  runeSimTick(dtMin);
  updateImmigration(dtMin);
  for (let i = world.carcasses.length - 1; i >= 0; i--) {
    // carcaças apodrecem devagar e somem
    const c = world.carcasses[i];
    c.amount -= 0.006 * dtMin * (c.max / 60);
    if (c.amount <= 0.5 || world.tick - c.born > CONFIG.DAY_MIN * 1.5) {
      c.amount = 0;
      world.carcasses.splice(i, 1);
    }
  }

  // housekeeping: remove mortos antigos (mantém últimos ~2 dias pra não sumir de repente da tela, mas evita acumular infinito)
  if (world.animals.length > 420) {
    world.animals = world.animals.filter((a) => a.alive || world.tick - (a.deathTick || 0) < CONFIG.DAY_MIN * 2);
  }
  for (const a of world.animals) if (!a.alive && !a.deathTick) a.deathTick = world.tick;

  if (Math.floor(world.tick) % CONFIG.STATS_SAMPLE_EVERY_MIN < dtMin) sampleStats();
}
