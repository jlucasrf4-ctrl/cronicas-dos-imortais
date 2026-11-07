/* ==== Fase 4 — animais do mapa: criação, população inicial e a IA de necessidades (base/01) ==== */
import { SPECIES, WILD_KEYS, HUNGER_TIERS, ACTIVITY_WINDOWS, type Especie } from "../data/especies.ts";
import { randomGenes, rollCoat, inheritGenes } from "../data/genetica.ts";
import { world, econ, CACA } from "../core/state.ts";
import { CONFIG, DEFLECT_ANGLES_DEG } from "../core/config.ts";
import { seedWild, boarSeed } from "./fauna.ts";
import { isWaterCell, findNearestWater } from "../map/agua.ts";
import { aguaEm, montanhaEm, terrenoPronto } from "../map/terreno.ts";
import {
  NAV,
  navIsHero,
  nearestLand,
  navIdx,
  navX,
  navY,
  losClear,
  getPath,
  NAV_PENDING,
  abandonGoal,
  navSkip,
  navShoreFor,
  fleeTarget,
  navFood,
} from "../map/navegacao.ts";
import { mnt, mountLv } from "../creatures/tamandua.ts";
import { MOUNT } from "../data/sobrevivencia.ts";
import { pushEvent } from "./eventos.ts";
import { queryNearby } from "./grade.ts";
import { HERO_SPEED } from "../data/herois.ts";
import { ambientTemp, coldStep, eatItem } from "../survival/sobrevivencia.ts";
import { campMeatStock, campTake } from "../survival/acampamento.ts";
import { HUNT_MAX_START } from "../data/mapa.ts";
import { huntTargets, nearestTarget, inArea } from "../map/caca.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { huntLabel } from "../render/sprites.ts";
import { tripStep } from "../econ/economia.ts";
import { runeHeroStep } from "../runas/runas.ts";
import { huntStep } from "../map/recursos.ts";
import { minijogoNaChegada } from "../map/selecao.ts";
import { SP_MEAT } from "../data/arte.ts";
import type { Andante, Animal, Carcaca, Genes, GradeEspacial, Hero, Planta, Repasse, Wild } from "../core/tipos.ts";

/* ---------------------------------------------------------------------
   6. ANIMAL — criação
--------------------------------------------------------------------- */
export function spawnAnimal(
  speciesKey: string,
  x: number,
  y: number,
  ageDay?: number,
  genes?: Genes,
  parentIds?: string[],
): Animal {
  const g = genes || randomGenes();
  if (g.coat == null) g.coat = rollCoat(speciesKey);
  const a: Animal = {
    id: speciesKey + "-" + String(world.nextId++).padStart(5, "0"),
    species: speciesKey,
    sex: Math.random() < 0.5 ? "M" : "F",
    birthTick: world.tick - (ageDay || 0) * CONFIG.DAY_MIN,
    x,
    y,
    dir: Math.random() * Math.PI * 2,
    vx: 0,
    vy: 0,
    genes: g,
    sizeMult: g.size.sizeMult,
    weightMult: g.size.weightMult,
    speedMult: g.speed.mult,
    strengthMult: g.strength.mult,
    parents: parentIds || null,
    hunger: 65 + Math.random() * 25,
    thirst: 15 + Math.random() * 20,
    energy: 70 + Math.random() * 25,
    health: 100,
    state: "idle",
    stateTimer: 0,
    target: null,
    targetEntity: null,
    reproCooldown: Math.random() * 500,
    starveTimer: 0,
    dehydrateTimer: 0,
    trail: [],
    alive: true,
    causeOfDeath: null,
  };
  world.animals.push(a);
  popMudou();
  return a;
}
/* v7.7 — as populações contadas uma vez e guardadas até algo mudar (era uma varredura de todos os bichos a cada
   chamada, e cada bicho pergunta ao decidir se pode procriar). Muda: outro passo, outra lista (troca de região), outro
   tamanho de lista, ou um nascimento/morte (popMudou: spawnAnimal, killAnimal, killWild). */
const POP = {
  tick: -1,
  animais: null as Animal[] | null,
  wild: null as Wild[] | null,
  nA: -1,
  nW: -1,
  ver: 0,
  verLida: -1,
  n: {} as Record<string, number>,
};
export function popMudou() {
  POP.ver++;
}
export function populationOf(speciesKey: string) {
  const W = world.wild || [];
  if (
    POP.tick !== world.tick ||
    POP.animais !== world.animals ||
    POP.wild !== W ||
    POP.nA !== world.animals.length ||
    POP.nW !== W.length ||
    POP.verLida !== POP.ver
  ) {
    POP.tick = world.tick;
    POP.animais = world.animals;
    POP.wild = W;
    POP.nA = world.animals.length;
    POP.nW = W.length;
    POP.verLida = POP.ver;
    const n: Record<string, number> = {};
    for (const w of W) if (w.alive) n["w:" + w.species] = (n["w:" + w.species] || 0) + 1;
    for (const a of world.animals) if (a.alive) n[a.species] = (n[a.species] || 0) + 1;
    POP.n = n;
  }
  return (WILD_KEYS.indexOf(speciesKey) >= 0 ? POP.n["w:" + speciesKey] : POP.n[speciesKey]) || 0;
}

/* ---------------------------------------------------------------------
   7. INICIALIZAÇÃO DA POPULAÇÃO
--------------------------------------------------------------------- */
export function seedPopulation() {
  seedPopulationVez();
  seedPopulationVez();
} // v5.8: região 4× maior: o dobro de bichos
function seedPopulationVez() {
  seedWild();
  const b = CONFIG.SIM_BOUNDS;
  function randLand() {
    let x,
      y,
      tries = 0;
    do {
      x = b.x + Math.random() * b.w;
      y = b.y + Math.random() * b.h;
      tries++;
    } while ((isWaterCell(x, y) || montanhaEm(x, y)) && tries < 40); // v8.1: nem no paredão da montanha
    return { x, y };
  }
  for (let i = 0; i < 26; i++) {
    const p = randLand();
    spawnAnimal("rabbit", p.x, p.y, Math.random() * 6 + 1);
  }
  for (let i = 0; i < 12; i++) {
    const p = randLand();
    spawnAnimal("deer", p.x, p.y, Math.random() * 10 + 1);
  }
  for (let i = 0; i < 5; i++) {
    const p = randLand();
    spawnAnimal("wolf", p.x, p.y, Math.random() * 14 + 1);
  }
  boarSeed(); // v5.8
}

export function clampX(x: number) {
  const b = CONFIG.SIM_BOUNDS;
  return Math.max(b.x + 4, Math.min(b.x + b.w - 4, x));
}
export function clampY(y: number) {
  const b = CONFIG.SIM_BOUNDS;
  return Math.max(b.y + 4, Math.min(b.y + b.h - 4, y));
}

export function snapToLand(x: number, y: number) {
  if (!isWaterCell(x, y)) return { x, y };
  let tries = 0;
  while (tries < 24) {
    const ang = Math.random() * Math.PI * 2,
      d = 12 + Math.random() * 60;
    const nx = x + Math.cos(ang) * d,
      ny = y + Math.sin(ang) * d;
    if (!isWaterCell(nx, ny)) return { x: nx, y: ny };
    tries++;
  }
  return { x, y };
}

export function ageDaysOf(a: Animal) {
  return (world.tick - a.birthTick) / CONFIG.DAY_MIN;
}
export function hungerTier(h: number) {
  for (const t of HUNGER_TIERS) if (h >= t[0]) return t;
  return HUNGER_TIERS[4];
}
function energyMult(e: number) {
  return e >= 80 ? 1 : e >= 60 ? 0.92 : e >= 40 ? 0.8 : e >= 20 ? 0.6 : e >= 1 ? 0.38 : 0.2;
} // energia 0: ainda anda, muito devagar
function perfMult(a: Animal) {
  return hungerTier(a.hunger)[2] * energyMult(a.energy) * (a.health < 25 ? 0.8 : 1);
}
function effSpeed(a: Animal, key: "speedWalk" | "speedFlee" | "speedChase") {
  return SPECIES[a.species][key] * a.speedMult * perfMult(a);
}
export function effRadius(a: Animal) {
  return SPECIES[a.species].radius * a.sizeMult;
}
export function logSp(sp: string, type: string, cause?: string) {
  const T = world.spTotals[sp] || (world.spTotals[sp] = { births: 0, deaths: 0, immigrants: 0, causes: {} });
  if (type === "birth") T.births++;
  else {
    T.deaths++;
    if (cause) {
      const c = String(cause).replace(/^caçado por .*/, "caça (jogador)");
      T.causes[c] = (T.causes[c] || 0) + 1;
    }
  }
  world.spLog.push({
    t: world.tick,
    sp,
    type,
    cause: cause ? String(cause).replace(/^caçado por .*/, "caça (jogador)") : null,
  });
  if (world.spLog.length > 8000) world.spLog.splice(0, 3000);
}

/* ---------------------------------------------------------------------
   9. IA — função de decisão (cascata de prioridade orientada a necessidades)
--------------------------------------------------------------------- */
function timeOfDayMin() {
  return world.tick % CONFIG.DAY_MIN;
}
// moveStep: anda em direção a (tx,ty). Se avoidWater=true, desvia de células de
// água tentando ângulos alternativos; se nenhum ângulo livre for encontrado
// (cercado de água), entra mesmo assim mas paga uma penalidade extra de energia
// (cansaço de atravessar a nado). avoidWater=false é usado quando o próprio
// alvo É a água (indo beber) — aí não faz sentido desviar do próprio destino.
export function moveStep(
  this: unknown,
  a: Andante,
  tx: number,
  ty: number,
  speed: number,
  dtMin: number,
  avoidWater: boolean,
  maxPath?: number,
) {
  /* v6.2 — moveStep com rota: linha reta se livre; senão segue os waypoints do A*. Devolve a distância RESTANTE pela rota (não “chega” do outro lado do rio). */
  if (!avoidWater || !NAV.ready || !a) return moveStepBase.apply(this, arguments as Repasse);
  try {
    const m = mnt();
    // v8.1: montada vai reto por qualquer terreno, menos pelo paredão da montanha (aí segue a rota)
    if (
      m &&
      m.with &&
      a.id === m.with &&
      a.camp &&
      a.state !== "idle" &&
      a.state !== "indungeon" &&
      !cruzaMontanha(a.x, a.y, tx, ty)
    )
      return moveStepBase.apply(this, arguments as Repasse);
  } catch (_) {}
  const dist = Math.hypot(tx - a.x, ty - a.y);
  if (dist < 0.001) return dist;
  const hero = navIsHero(a);
  a.navBlocked = false;
  if (isWaterCell(a.x, a.y)) {
    // dentro d'água: sai pela terra mais próxima
    const li = nearestLand(navIdx(a.x, a.y), 10, -1);
    if (li < 0 || hero) return moveStepBase.apply(this, arguments as Repasse);
    moveStepBase.call(this, a, navX(li), navY(li), speed, dtMin, false);
    a.nav = null;
    a.navActive = false;
    return dist;
  }
  if (losClear(a.x, a.y, tx, ty)) {
    a.navActive = false;
    return moveStepBase.call(this, a, tx, ty, speed, dtMin, avoidWater);
  }
  const lim =
    maxPath !== undefined
      ? maxPath
      : hero
        ? Infinity
        : a.species && SPECIES[a.species]
          ? SPECIES[a.species].visionRange * 3
          : Infinity;
  let p = getPath(a, tx, ty, lim);
  if (p && p !== NAV_PENDING && p.i < p.pts.length && !losClear(a.x, a.y, p.pts[p.i].x, p.pts[p.i].y)) {
    a.nav = null;
    p = getPath(a, tx, ty, lim);
  }
  if (p === NAV_PENDING) {
    a.navActive = false;
    return hero ? moveStepBase.apply(this, arguments as Repasse) : Math.max(dist, 40);
  }
  if (!p) {
    if (hero) return moveStepBase.apply(this, arguments as Repasse); // herói sem rota por terra (outra ilha): nada/atravessa como antes
    a.navBlocked = true;
    a.navActive = false;
    abandonGoal(a as Animal);
    return Infinity;
  } // herói já voltou acima
  if (!p.pts.length) {
    // v7.7: rota vazia (às vezes vinha assim e p.pts[p.i] quebrava a cada passo): vai em linha reta
    a.nav = null;
    return moveStepBase.apply(this, arguments as Repasse);
  }
  if (p.i >= p.pts.length) p.i = p.pts.length - 1;
  while (p.i < p.pts.length - 1 && Math.hypot(p.pts[p.i].x - a.x, p.pts[p.i].y - a.y) < 0.6) p.i++;
  const w = p.pts[p.i];
  moveStepBase.call(this, a, w.x, w.y, speed, dtMin, avoidWater);
  if (Math.hypot(w.x - a.x, w.y - a.y) < 0.6 && p.i < p.pts.length - 1) p.i++;
  a.navActive = true;
  let left = 0,
    cx = a.x,
    cy = a.y;
  for (let i = p.i; i < p.pts.length; i++) {
    left += Math.hypot(p.pts[i].x - cx, p.pts[i].y - cy);
    cx = p.pts[i].x;
    cy = p.pts[i].y;
  }
  if (p.i >= p.pts.length - 1 && left < 0.001) left = Math.hypot(tx - a.x, ty - a.y);
  return left;
}
/** v8.0 — água no ponto, fina: a grade da navegação (células grandes) ou o contorno exato da costa (map/terreno.ts,
    a mesma água que o mapa desenha e o campo usa): rio mais fino que uma célula sumia da grade e os bichos andavam
    por cima dele (mantenedor, 2026-10-24). */
function aguaFina(x: number, y: number) {
  return isWaterCell(x, y) || (terrenoPronto() && aguaEm(x, y));
}
/** v8.1 — o que barra o passo no mapa: água fina ou o paredão da montanha (map/terreno.ts). */
function barreiraFina(x: number, y: number) {
  return aguaFina(x, y) || montanhaEm(x, y);
}
/** v8.0 — nenhum ponto de água (v8.1: nem de paredão) no caminho reto de (x0, y0) a (x1, y1) (amostras a cada ~2
 *  unidades). */
function caminhoSeco(x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  for (let i = 1; i <= n; i++) if (barreiraFina(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}
/** v8.1 — o caminho reto passa pelo paredão da montanha (amostras a cada ~4 unidades). */
function cruzaMontanha(x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
  for (let i = 1; i <= n; i++) if (montanhaEm(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return true;
  return false;
}
// etapa de moveStep: original + v5.9.04
function moveStepBase(a: Andante, tx: number, ty: number, speed: number, dtMin: number, avoidWater: boolean) {
  /* v5.9.04 — ---------- mapa: viagens mais rápidas, todo terreno e carga extra ---------- */
  {
    const m = mnt();
    if (m && m.with && a && a.id === m.with && a.camp && a.state !== "idle" && a.state !== "indungeon") {
      const md = a.trip && a.trip.mode;
      if (md !== "horse" && md !== "wagon") speed *= MOUNT.spd[mountLv(m) - 1];
      avoidWater = false;
    }
  }
  const dx0 = tx - a.x,
    dy0 = ty - a.y;
  const distToTarget = Math.hypot(dx0, dy0);
  if (distToTarget < 0.001) return distToTarget;
  const step = Math.min(speed * dtMin, distToTarget);
  const baseAngle = Math.atan2(dy0, dx0);

  if (avoidWater) {
    let placed = false;
    const naAgua = barreiraFina(a.x, a.y); // v8.1: ou no paredão (save antigo): sai por onde der
    for (const offDeg of DEFLECT_ANGLES_DEG) {
      const ang = baseAngle + (offDeg * Math.PI) / 180;
      const nx = clampX(a.x + Math.cos(ang) * step);
      const ny = clampY(a.y + Math.sin(ang) * step);
      // v8.0: o caminho inteiro do passo, não só onde ele para (correndo, um passo pulava um rio fino por cima)
      if (naAgua ? !barreiraFina(nx, ny) : caminhoSeco(a.x, a.y, nx, ny)) {
        a.x = nx;
        a.y = ny;
        a.dir = ang;
        placed = true;
        break;
      }
    }
    // v8.1: a heroína atravessa água para outra ilha, mas montanha não (contorna: mantenedor 2026-11-06)
    const reto = { x: a.x + Math.cos(baseAngle) * step, y: a.y + Math.sin(baseAngle) * step };
    if (!placed && (naAgua || (navIsHero(a) && !montanhaEm(reto.x, reto.y)))) {
      // já dentro d'água (ou a heroína, que atravessa para outra ilha como antes): nada para frente, cansando extra
      a.x = clampX(a.x + Math.cos(baseAngle) * step);
      a.y = clampY(a.y + Math.sin(baseAngle) * step);
      a.dir = baseAngle;
      a.energy = Math.max(0, a.energy - 0.55 * dtMin);
    } else if (!placed) a.dir = baseAngle; // v8.0: na margem, sem saída seca: espera (antes entrava na água)
  } else {
    a.x = clampX(a.x + Math.cos(baseAngle) * step);
    a.y = clampY(a.y + Math.sin(baseAngle) * step);
    a.dir = baseAngle;
  }
  return distToTarget;
}
function clampToBounds(a: Animal) {
  const b = CONFIG.SIM_BOUNDS;
  if (a.x < b.x + 4) a.x = b.x + 4;
  if (a.x > b.x + b.w - 4) a.x = b.x + b.w - 4;
  if (a.y < b.y + 4) a.y = b.y + 4;
  if (a.y > b.y + b.h - 4) a.y = b.y + b.h - 4;
}
function drainE(a: Animal, k: number, dt: number) {
  a.energy = Math.max(0, a.energy - k * a.weightMult * dt);
}
function restAct(a: Animal, sp: Especie, dt: number) {
  a.state = "resting";
  a.energy = Math.min(100, a.energy + sp.energyRegenRest * dt);
  a.health = Math.min(100, a.health + 0.02 * dt);
}
function stopEat(a: Animal) {
  a.state = "idle";
  a.target = null;
  a.targetEntity = null;
}
function findCarcass(a: Animal, range: number) {
  let best = null,
    bd = range;
  for (const c of world.carcasses) {
    if (c.amount <= 0 || navSkip(a, c)) continue;
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
function doEat(a: Animal, sp: Especie, dt: number) {
  const t = a.targetEntity as Carcaca | (Planta & { amount?: undefined }) | null;
  if (!t) {
    stopEat(a);
    return;
  } // comendo: carcaça ou planta
  a.dir = Math.atan2(t.y - a.y, t.x - a.x);
  if (t.amount !== undefined) {
    // carcaça: consumida aos poucos
    if (t.amount <= 0) {
      stopEat(a);
      return;
    }
    const bite = Math.min(t.amount, 1.3 * dt);
    t.amount -= bite;
    a.hunger = Math.min(100, a.hunger + bite);
  } else {
    // planta
    if (t.growth < 0.08) {
      stopEat(a);
      return;
    }
    t.growth -= Math.min(t.growth, 0.012 * dt);
    a.hunger = Math.min(100, a.hunger + sp.eatRate * dt * 0.12);
  }
  a.energy = Math.min(100, a.energy + 0.12 * dt); // comer também descansa
  if (a.hunger >= 92) stopEat(a);
}
function doThirst(a: Animal, sp: Especie, dt: number, rng: number) {
  if (a.thirst <= 55) return false;
  const w0 = NAV.ready ? navShoreFor(a, rng) : null,
    w = w0 ? { x: w0.sx, y: w0.sy } : findNearestWater(a.x, a.y, rng);
  if (!w) return false;
  a._thirstSpot = w0;
  const d = moveStep(a, w.x, w.y, effSpeed(a, "speedWalk"), dt, !!w0);
  drainE(a, sp.energyDrainWalk, dt);
  if (d < CONFIG.INTERACT_RADIUS + 8) {
    a.state = "drinking";
    a.thirst = Math.max(0, a.thirst - sp.drinkRate * dt * 0.25);
  } else a.state = "seekWater";
  clampToBounds(a);
  return true;
}
function findMate(a: Animal, nearby: Animal[], maxD: number): [Animal, number] | null {
  let mate = null,
    md = maxD;
  for (const o of nearby) {
    if (o === a || !o.alive || o.species !== a.species || o.sex === a.sex || navSkip(a, o)) continue;
    if (ageDaysOf(o) < SPECIES[o.species].matureAgeDay || o.reproCooldown > 0) continue;
    const d = Math.hypot(o.x - a.x, o.y - a.y);
    if (d < md) {
      md = d;
      mate = o;
    }
  }
  return mate ? [mate, md] : null;
}
export function decideAndAct(a: Animal, dtMin: number, grid: GradeEspacial) {
  const sp = SPECIES[a.species],
    dt = dtMin,
    herb = sp.diet === "herbivore";
  // ---- necessidades: Fome 0-100 (100 = bem alimentado) ----
  a.hunger = Math.max(0, a.hunger - sp.hungerRate * dt);
  a.thirst = Math.min(100, a.thirst + sp.thirstRate * dt);
  if (a.hunger <= 0)
    a.health -= 0.05 * dt; // fome extrema machuca
  else if (a.hunger >= 60 && a.thirst < 70) a.health = Math.min(100, a.health + 0.015 * dt);
  if (a.thirst >= 100) a.health -= 0.04 * dt;
  if (a.health <= 0) {
    killAnimal(a, a.hunger <= 0 ? "fome" : "sede");
    return;
  }
  const ageDay = ageDaysOf(a);
  if (ageDay > sp.maxAgeDay) {
    const over = (ageDay - sp.maxAgeDay) / 4;
    if (Math.random() < 0.0009 * dt * (1 + over * 3)) {
      killAnimal(a, "velhice");
      return;
    }
  }
  if (a.reproCooldown > 0) a.reproCooldown = Math.max(0, a.reproCooldown - dt);
  const active = ACTIVITY_WINDOWS[sp.activity](timeOfDayMin());
  const nearby = queryNearby(grid, a.x, a.y, sp.visionRange);
  const crit = a.hunger < 22,
    hurt = a.health < 55,
    weak = a.health < 30;

  if (herb) {
    // 1. predador à vista: sobrevivência acima de tudo (ferido percebe/foge de mais longe)
    let threat = null,
      threatD = sp.dangerRange * (hurt ? 1.35 : 1) * (weak ? 1.3 : 1);
    for (const o of nearby) {
      if (!o.alive || !sp.fleeFrom!.includes(o.species)) continue;
      const d = Math.hypot(o.x - a.x, o.y - a.y);
      if (d < threatD) {
        threatD = d;
        threat = o;
      }
    }
    if (threat) {
      if (a.state !== "fleeing") a.fleeJitter = (Math.random() - 0.5) * 2.0;
      a.state = "fleeing";
      a.targetEntity = null;
      const ang = Math.atan2(a.y - threat.y, a.x - threat.x) + a.fleeJitter!;
      a.target = fleeTarget(a, threat) || {
        x: clampX(a.x + Math.cos(ang) * 120),
        y: clampY(a.y + Math.sin(ang) * 120),
      };
      moveStep(a, a.target.x, a.target.y, effSpeed(a, "speedFlee"), dt, true);
      drainE(a, sp.energyDrainFlee!, dt);
      clampToBounds(a);
      return;
    }
    // 2. comendo: continua até saciar (visível: animação de mordida)
    if (a.state === "eating" && a.targetEntity) {
      doEat(a, sp, dt);
      return;
    }
    // 3. exausto (e não faminto): para e recupera
    if (a.energy < 12 && !crit) {
      restAct(a, sp, dt);
      return;
    }
    // 4. fome: procura alimento (faminto = prioridade, raio maior; pouca energia = só o que está perto)
    if (a.hunger < 58) {
      if (a.state !== "seekFood" || !a.targetEntity || (a.targetEntity as Planta).growth < 0.08) {
        const food = navFood(a, sp.visionRange * (crit ? 1.3 : a.energy < 25 ? 0.5 : 1));
        if (food) {
          a.state = "seekFood";
          a.target = food;
          a.targetEntity = food;
        } else {
          a.targetEntity = null;
          a.target = null;
          wander(a, sp, dt);
          return;
        }
      }
      const t = a.targetEntity;
      const d = moveStep(a, t.x, t.y, effSpeed(a, "speedWalk"), dt, true);
      drainE(a, sp.energyDrainWalk, dt);
      if (d < CONFIG.INTERACT_RADIUS) a.state = "eating";
      clampToBounds(a);
      return;
    }
    if (doThirst(a, sp, dt, sp.visionRange * 2.2)) return;
    if (a.energy < 35 || (!active && a.hunger >= 60 && a.thirst < 60)) {
      restAct(a, sp, dt);
      if (a.energy > 85) a.state = "idle";
      return;
    }
    if (
      ageDay >= sp.matureAgeDay &&
      a.reproCooldown <= 0 &&
      a.hunger >= 60 &&
      a.thirst < sp.mateThirstMax! &&
      a.health >= 60 &&
      populationOf(a.species) < sp.carryingCapacity
    ) {
      const m = findMate(a, nearby, 60);
      if (m) {
        if (m[1] < CONFIG.INTERACT_RADIUS + 10) tryReproduce(a, m[0]);
        else {
          a.state = "wander";
          moveStep(a, m[0].x, m[0].y, effSpeed(a, "speedWalk"), dt, true);
          clampToBounds(a);
          return;
        }
      }
    }
    wander(a, sp, dt);
    return;
  }

  // =========== PREDADOR ===========
  if (a.state === "eating" && a.targetEntity) {
    doEat(a, sp, dt);
    return;
  }
  if (a.state === "hunting" && a.targetEntity && (a.targetEntity as Animal).alive) {
    const prey = a.targetEntity as Animal; // caçando: o alvo é a presa
    const d = moveStep(a, prey.x, prey.y, effSpeed(a, "speedChase"), dt, true);
    drainE(a, sp.energyDrainChase!, dt);
    if (d < effRadius(prey) + sp.attackRadius!) {
      const catchChance =
        0.35 +
        (a.energy - 40) / 200 -
        (effSpeed(prey, "speedFlee") - effSpeed(a, "speedChase") > 0 ? 0.1 : 0) +
        (a.strengthMult - 1) * 0.4 -
        (prey.strengthMult - 1) * 0.35;
      if (Math.random() < Math.max(0.08, Math.min(0.6, catchChance))) {
        const lbl = SPECIES[prey.species].label.toLowerCase();
        const carc = killAnimal(prey, "predação");
        world.counters.hunts++;
        pushEvent("Um lobo (" + a.id + ") abateu um(a) " + lbl + " — a carcaça ficou no mapa.");
        a.state = "seekFood";
        a.targetEntity = carc;
        a.target = null; // vai comer o que abateu
      } else {
        pushEvent("Uma caçada falhou: " + a.id + " perdeu a presa.");
        a.state = "resting";
        a.target = null;
        a.targetEntity = null;
      }
      clampToBounds(a);
      return;
    }
    if (d > sp.giveUpDistance! || a.energy < (crit ? 5 : 15)) stopEat(a);
    clampToBounds(a);
    return;
  }
  if (weak && !crit) {
    restAct(a, sp, dt);
    return;
  } // vida baixa: evita confronto, busca segurança
  // carniça primeiro (gasta menos energia que caçar); depois caça
  if (a.hunger < 70) {
    const c =
      a.state === "seekFood" && a.targetEntity && (a.targetEntity as Carcaca).amount > 0
        ? a.targetEntity
        : findCarcass(a, sp.visionRange * 1.4);
    if (c) {
      a.targetEntity = c;
      a.state = "seekFood";
      const d = moveStep(a, c.x, c.y, effSpeed(a, "speedWalk") * 1.3, dt, true);
      drainE(a, sp.energyDrainWalk, dt);
      if (d < CONFIG.INTERACT_RADIUS) a.state = "eating";
      clampToBounds(a);
      return;
    }
  }
  if (a.hunger < 50 && (!weak || crit) && a.energy >= (crit ? 10 : 20)) {
    let prey = null,
      pd = Infinity;
    for (const o of nearby) {
      if (!o.alive || !sp.preySpecies.includes(o.species) || navSkip(a, o)) continue;
      const d = Math.hypot(o.x - a.x, o.y - a.y);
      if (d >= sp.visionRange) continue;
      const score = d / (SPECIES[o.species].meatValue || 40); // prefere presa que "rende" mais pela distância
      if (score < pd) {
        pd = score;
        prey = o;
      }
    }
    if (prey) {
      a.state = "hunting";
      a.targetEntity = prey;
      world.counters.hunts++;
      pushEvent("Um lobo (" + a.id + ") iniciou uma perseguição.");
      return;
    }
  }
  if (doThirst(a, sp, dt, sp.visionRange * 2)) return;
  if (a.energy < 35 || (!active && a.hunger >= 55 && a.thirst < 55)) {
    restAct(a, sp, dt);
    if (a.energy > 85) a.state = "idle";
    return;
  }
  if (
    ageDay >= sp.matureAgeDay &&
    a.reproCooldown <= 0 &&
    a.hunger >= 60 &&
    a.health >= 60 &&
    populationOf(a.species) < sp.carryingCapacity
  ) {
    const m = findMate(a, nearby, 90);
    if (m) {
      if (m[1] < CONFIG.INTERACT_RADIUS + 10) tryReproduce(a, m[0]);
      else {
        moveStep(a, m[0].x, m[0].y, effSpeed(a, "speedWalk"), dt, true);
        a.state = "wander";
        clampToBounds(a);
        return;
      }
    }
  }
  wander(a, sp, dt);
}
function wander(a: Animal, sp: Especie, dtMin: number) {
  a.state = "wander";
  if (!a.target || Math.hypot(a.target.x - a.x, a.target.y - a.y) < 6 || Math.random() < 0.003) {
    const b = CONFIG.SIM_BOUNDS;
    const margin = 14;
    let tx!: number,
      ty!: number,
      ok = false,
      tries = 0; // o laço roda ao menos uma vez
    while (tries < 10 && !ok) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 90;
      tx = a.x + Math.cos(ang) * dist;
      ty = a.y + Math.sin(ang) * dist;
      tries++;
      if (
        tx > b.x + margin &&
        tx < b.x + b.w - margin &&
        ty > b.y + margin &&
        ty < b.y + b.h - margin &&
        !isWaterCell(tx, ty)
      ) {
        ok = true;
      }
    }
    if (!ok) {
      // não achou um ponto livre nas tentativas: puxa suavemente de volta
      // para perto do centro da região, em vez de grudar na borda (o que
      // antes criava um "ímã" que acumulava bichos nos cantos do mapa).
      const cx = b.x + b.w / 2,
        cy = b.y + b.h / 2;
      tx = a.x + (cx - a.x) * 0.35;
      ty = a.y + (cy - a.y) * 0.35;
    }
    a.target = { x: tx, y: ty };
  }
  moveStep(a, a.target.x, a.target.y, effSpeed(a, "speedWalk") * 0.55, dtMin, true);
  a.energy = Math.max(0, a.energy - sp.energyDrainWalk * a.weightMult * 0.5 * dtMin);
  clampToBounds(a);
}
export function wanderHeroLocal(h: Hero, dtMin: number) {
  // reescrita na v5.9.11
  const R = (h.task && h.task.r) || 75;
  if (!h.localTarget || Math.hypot(h.localTarget.x - h.x, h.localTarget.y - h.y) < 6 || Math.random() < 0.02) {
    const ang = Math.random() * Math.PI * 2,
      dist = Math.min(R * 0.85, 12 + Math.random() * R * 0.8);
    h.localTarget = { x: clampX(h.task!.x + Math.cos(ang) * dist), y: clampY(h.task!.y + Math.sin(ang) * dist) };
  }
  moveStep(h, h.localTarget.x, h.localTarget.y, HERO_SPEED * 0.5, dtMin, true);
}
function heroVitals(h: Hero, dtMin: number) {
  if (h.energy == null) h.energy = 100;
  if (h.hunger == null) h.hunger = 0;
  const mv =
    h.state === "traveling" ||
    h.state === "hunting" ||
    h.state === "returning" ||
    h.state === "marketgo" ||
    h.state === "marketback";
  const mode = h.trip ? h.trip.mode : "foot";
  if (mv) {
    h.hunger = Math.min(100, h.hunger + 0.06 * dtMin);
    h.energy = Math.max(
      0,
      h.energy - 0.05 * dtMin * (mode === "horse" ? 0.5 : mode === "wagon" ? 0.6 : 1) * (h.hunger > 80 ? 1.6 : 1),
    );
  } else {
    h.hunger = Math.max(0, h.hunger - 0.08 * dtMin);
    h.energy = Math.min(100, h.energy + 0.1 * dtMin);
  }
  /* v5.9 — frio, fome e ferimentos (no acampamento come e descansa) */
  if (h.state === "indungeon") return;
  const atCamp = h.state === "idle",
    amb = ambientTemp(false);
  coldStep(h, amb, dtMin, atCamp);
  if (atCamp) {
    h.hunger = Math.min(100, (h.hunger || 0) + 0.1 * dtMin); // a fome volta: o descanso não alimenta sozinho
    if ((h.hunger || 0) > 45) {
      const src = [h.inv, econ.stash].filter(Boolean);
      let ate = false;
      for (const inv of src) {
        const it = inv!.items.find((i) => i.def.key === "carne_assada");
        if (it) {
          eatItem(h, it, inv!);
          ate = true;
          break;
        }
      }
      if (!ate && campMeatStock() > 0 && (h.hunger || 0) > 60) {
        campTake("meat", 1);
        h.hunger = Math.max(0, h.hunger - 18);
      }
    }
    h.wound = Math.max(0, (h.wound || 0) - dtMin / ((h.hunger || 0) > 60 ? 18 : 6));
    if (h.hp != null) h.hp = Math.min(h.hpMax - (h.wound || 0), h.hp + dtMin * 0.5);
  } else if ((h.hunger || 0) > 90 && h.hp != null) h.hp = Math.max(1, h.hp - dtMin * 0.05);
}
export function updateHero(this: unknown, h: Hero, dtMin: number, _grid: GradeEspacial) {
  /* v5.9.13 — a área anda junto: perseguindo um bicho ela acompanha; sem nada na área, ela vai para o rastro mais próximo (dentro do limite) */
  const T = h.task!,
    on =
      T &&
      T.r &&
      h.state === "hunting" &&
      T.targetSpecies !== "fish" &&
      T.targetSpecies !== "runa" &&
      T.targetSpecies !== "none";
  const lim = (x: number, y: number) => {
    if (T.ox == null) return { x, y };
    const d = Math.hypot(x - T.ox, y - T.oy!),
      m = HUNT_MAX_START + T.r! * 0.5;
    return d <= m ? { x, y } : { x: T.ox + ((x - T.ox) * m) / d, y: T.oy! + ((y - T.oy!) * m) / d };
  };
  if (on) {
    const tg = h.targetEntity,
      ref = tg && tg.alive !== false ? tg : h,
      dd = Math.hypot(ref.x - T.x, ref.y - T.y),
      keep = T.r! * (tg ? 0.7 : 0.6);
    if (dd > keep) {
      const k = (dd - keep) / dd,
        p = lim(T.x + (ref.x - T.x) * k, T.y + (ref.y - T.y) * k);
      T.x = p.x;
      T.y = p.y;
    }
  }
  updateHeroBase2.apply(this, arguments as Repasse);
  /* v5.9.13 — a área anda junto: perseguindo um bicho ela acompanha; sem nada na área, ela vai para o rastro mais próximo (dentro do limite) */
  if (on && h.state === "hunting" && h.task === T) {
    if (!h.targetEntity) T.idle = (T.idle || 0) + dtMin;
    else T.idle = 0;
    if (T.idle > 25) {
      T.idle = 0;
      const inA = huntTargets(T.targetSpecies).some((o) => Math.hypot(o.x - T.x, o.y - T.y) < T.r!);
      if (!inA) {
        const t = nearestTarget(T.targetSpecies, T.x, T.y, HUNT_MAX_START + T.r!);
        if (t) {
          const p = lim(t.x, t.y);
          T.x = p.x;
          T.y = p.y;
          h.localTarget = null;
          T.moves = (T.moves || 0) + 1;
          if (T.moves <= 3) pushEvent("🐾 " + h.name + " achou rastro e moveu a área de caça.");
        }
      }
    }
  }
}
// etapa de updateHero: v5.9.11
function updateHeroBase2(this: unknown, h: Hero, dtMin: number, _grid: GradeEspacial) {
  if (h.state === "walking") {
    const s = h.state;
    h.state = "traveling";
    heroVitals(h, dtMin);
    h.state = s;
    h.trail.push({ x: h.x, y: h.y });
    if (h.trail.length > 16) h.trail.shift();
    const w = h.walkTo;
    if (!w) {
      h.state = "field";
      return;
    }
    const d = moveStep(h, w.x, w.y, HERO_SPEED, dtMin, true);
    if (d < 5) {
      h.state = "field";
      h.walkTo = null;
      pushEvent(
        "🚶 " + h.name + " chegou. Clique com o botão direito num bicho, árvore, pedra ou na água para trabalhar ali.",
      );
      updateHeroPanelUI();
    }
    return;
  }
  if (h.state === "field") {
    heroVitals(h, dtMin);
    return;
  }
  if (h.state === "hunting" && h.task && !h.task.warned && h.task.killsDone === 0 && h.task.targetSpecies !== "fish") {
    if (!h.targetEntity) h.task.noT = (h.task.noT || 0) + dtMin;
    if (h.task.noT! > 90) {
      h.task.warned = true;
      pushEvent(
        "🔎 " +
          h.name +
          " não está achando " +
          huntLabel(h.task.targetSpecies) +
          " nesta área. Tente andar para outro lugar (perto de água para patos, de mata para madeira).",
      );
    }
  }
  const T = h.task,
    area =
      T && T.r && h.state === "hunting" && T.targetSpecies !== "fish" && T.targetSpecies !== "runa"
        ? { x: T.x, y: T.y, r: T.r }
        : null;
  let nodes0 = null,
    wild0 = null;
  if (area) {
    CACA.HUNT_AREA = area;
    nodes0 = world.nodes;
    world.nodes = nodes0!.filter(inArea);
    wild0 = world.wild;
    world.wild = wild0!.filter(inArea);
  }
  try {
    updateHeroBase.apply(this, arguments as Repasse);
  } finally {
    if (area) {
      CACA.HUNT_AREA = null;
      if (nodes0) world.nodes = nodes0;
      if (wild0) {
        const add = world.wild!.filter((o) => !wild0.includes(o));
        world.wild = wild0.concat(add);
      }
    }
  }
  if (T && T.r && h.state === "hunting") {
    const dd = Math.hypot(h.x - T.x, h.y - T.y);
    if (dd > T.r + 15) {
      h.targetEntity = null;
      h.localTarget = { x: T.x, y: T.y };
    }
  }
  if (h.state === "returning" && T && T.field && !T.back) {
    h.state = "field";
    h.task = null;
    h.targetEntity = null;
    pushEvent(
      h.name +
        " terminou (" +
        huntLabel(T.targetSpecies) +
        ", " +
        T.killsDone +
        " resultado(s)) e ficou em campo. 🎯 caçar de novo, 🚶 andar ou ⛺ voltar.",
    );
    updateHeroPanelUI();
  }
}
// etapa de updateHero: original
function updateHeroBase(h: Hero, dtMin: number, grid: GradeEspacial) {
  if (h.state === "indungeon") return; // jogador está controlando ele ativamente na masmorra agora
  heroVitals(h, dtMin);

  h.trail.push({ x: h.x, y: h.y });
  if (h.trail.length > 16) h.trail.shift();

  if (h.state === "marketgo" || h.state === "marketback") {
    tripStep(h, dtMin);
    return;
  }
  if (h.state === "idle" || !h.task) return;
  if (h.task.targetSpecies === "runa" && (h.state === "traveling" || h.state === "hunting")) {
    runeHeroStep(h, dtMin);
    return;
  }

  if (h.state === "traveling") {
    const d = moveStep(h, h.task.x, h.task.y, HERO_SPEED, dtMin, true);
    if (d < 22) {
      h.state = "hunting";
      h.huntTimer = 0;
      if (h.task.mg) minijogoNaChegada(h); // v7.7: comando do mapa — o minijogo abre na chegada
    }
    return;
  }

  if (h.state === "hunting") {
    huntStep(h, dtMin, grid);
    return;
  }

  if (h.state === "returning") {
    const d = moveStep(h, h.camp.x, h.camp.y, HERO_SPEED, dtMin, true);
    if (d < 16) {
      pushEvent(h.name + " voltou ao acampamento (" + h.task.killsDone + " resultado(s)).");
      h.state = "idle";
      h.task = null;
    }
  }
}
function tryReproduce(a: Animal, mate: Animal) {
  const sp = SPECIES[a.species];
  const [minL, maxL] = sp.litterSize;
  const room = Math.max(0, 1 - populationOf(a.species) / sp.carryingCapacity);
  const n = Math.max(
    room > 0.06 ? 1 : 0,
    Math.round((minL + Math.floor(Math.random() * (maxL - minL + 1))) * (0.3 + 1.1 * room)),
  );
  for (let i = 0; i < n; i++) {
    const jx = clampX(a.x + (Math.random() - 0.5) * 14);
    const jy = clampY(a.y + (Math.random() - 0.5) * 14);
    spawnAnimal(a.species, jx, jy, 0, inheritGenes(a, mate), [a.id, mate.id]);
    world.counters.births++;
    logSp(a.species, "birth");
  }
  a.reproCooldown = sp.reproCooldownDay * CONFIG.DAY_MIN;
  mate.reproCooldown = sp.reproCooldownDay * CONFIG.DAY_MIN;
  pushEvent(
    (n > 1
      ? "Nasceram " + n + " " + SPECIES[a.species].label.toLowerCase() + "s"
      : "Nasceu um " + SPECIES[a.species].label.toLowerCase()) + ".",
  );
}
export function killAnimal(a: Animal, cause: string) {
  /* v5.9.07 — criação: marca a origem da carne */
  if (a && a.species && SP_MEAT[a.species]) CACA.MEAT_SRC = SP_MEAT[a.species];
  if (!a.alive) return null;
  a.alive = false;
  popMudou();
  a.health = 0;
  const _sp = SPECIES[a.species],
    _amt = (_sp.meatValue || 40) * a.weightMult;
  const carc = {
    x: a.x,
    y: a.y,
    species: a.species,
    color: _sp.color,
    amount: _amt,
    max: _amt,
    born: world.tick,
    dir: a.dir,
    r: effRadius(a),
  };
  world.carcasses.push(carc);
  a.carcass = carc;
  a.causeOfDeath = cause;
  world.counters.deaths++;
  logSp(a.species, "death", cause);
  pushEvent((SPECIES[a.species] ? SPECIES[a.species].label : a.species) + " (" + a.id + ") morreu — " + cause + ".");
  return carc;
}
