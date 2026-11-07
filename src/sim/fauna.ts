/* ==== Fase 4 — fauna selvagem do mapa: patos, águias, raposas, javalis e a migração (base/07, v5.8) ==== */
import { world, TELAS, SEL, dungeon } from "../core/state.ts";
import { BICHOS } from "../map/mundo.ts";
import { rollCoat, coatInfo } from "../data/genetica.ts";
import { CONFIG } from "../core/config.ts";
import { seedNodes, rndIn, nodeReady, addRock, limparAreaReservada } from "../map/recursos.ts";
import { isWaterCell } from "../map/agua.ts";
import { spawnAnimal, logSp, killAnimal, populationOf, hungerTier, popMudou } from "./animais.ts";
import { pushEvent } from "./eventos.ts";
import { WILD_BREED, WILD_CAP, ALL_KEYS, SPECIES, WILD_INFO, WSTATE } from "../data/especies.ts";
import { ROCK_ZONES, TREE_WOOD } from "../data/recursos.ts";
import { visCenters, visK, farDot, naVista } from "../render/desempenho.ts";
import { fitSz, drawSprite } from "../render/sprites.ts";
import { layers } from "../map/render.ts";
import { icoPortrait } from "../ui/icones.ts";
import { clearInspExtras } from "../ui/janelas.ts";
import type { Animal, Carcaca, NoRecurso, Ponto, Repasse, Wild } from "../core/tipos.ts";

export function addWild(species: string, x: number, y: number, extra: Partial<Wild>) {
  const w = Object.assign(
    {
      species,
      id: species + "-" + world.nextId++,
      sex: Math.random() < 0.5 ? "M" : "F",
      x,
      y,
      dir: 0,
      alive: true,
      state: "idle",
      t: 0,
      hunger: 20 + Math.random() * 30,
      thirst: 15 + Math.random() * 30,
      energy: 60 + Math.random() * 40,
      hp: 100,
      coat: rollCoat(species),
    },
    extra,
  );
  w.vr = Math.floor(Math.random() * 8);
  world.wild!.push(w);
  return w;
}
function randWaterPoint(near?: Wild, rmin?: number, rmax?: number) {
  const b = CONFIG.SIM_BOUNDS;
  let best = null;
  for (let i = 0; i < 40; i++) {
    const p = world.waterPoints[Math.floor(Math.random() * world.waterPoints.length)];
    if (!p || p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) continue;
    if (near) {
      const d = Math.hypot(p.x - near.x, p.y - near.y);
      if (d < rmin! || d > rmax!) continue;
    }
    best = p;
    break;
  }
  return best;
}
export function seedWild() {
  world.wild = [];
  seedNodes();
  for (let g = 0; g < 4; g++) spawnFlock();
  for (let i = 0; i < 3; i++) {
    const b = CONFIG.SIM_BOUNDS;
    addWild("eagle", b.x + Math.random() * b.w, b.y + Math.random() * b.h, { state: "patrol", wp: null });
  }
  for (let i = 0; i < 4; i++) spawnFox();
}
function spawnFlock() {
  const p = randWaterPoint();
  if (!p) return;
  const f = world.nextId++,
    n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++)
    addWild("duck", p.x + (Math.random() - 0.5) * 16, p.y + (Math.random() - 0.5) * 16, {
      flock: f,
      home: { x: p.x, y: p.y },
    });
}
function spawnFox() {
  const trees = world.nodes!.filter((n) => n.kind === "tree");
  const t = trees[Math.floor(Math.random() * trees.length)];
  if (t) addWild("fox", t.x + 8, t.y + 8, { state: "prowl", home: { x: t.x, y: t.y } });
}
function immigrationSpot() {
  const b = CONFIG.SIM_BOUNDS;
  for (let t = 0; t < 40; t++) {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) {
      x = b.x + 6;
      y = b.y + Math.random() * b.h;
    } else if (side === 1) {
      x = b.x + b.w - 6;
      y = b.y + Math.random() * b.h;
    } else if (side === 2) {
      y = b.y + 6;
      x = b.x + Math.random() * b.w;
    } else {
      y = b.y + b.h - 6;
      x = b.x + Math.random() * b.w;
    }
    if (!isWaterCell(x, y)) return { x, y };
  }
  return { x: b.x + 10, y: b.y + 10 };
}
export function boarSeed() {
  if (typeof world === "undefined" || !world.animals) return;
  if (world.animals.some((a) => a.species === "boar")) return;
  for (let i = 0; i < 7; i++) {
    const p = immigrationSpot();
    spawnAnimal("boar", p.x, p.y, Math.random() * 8 + 1);
  }
}

/* ---- fauna selvagem: patos, águias e raposas (módulo independente) ---- */
function stepTo(w: Wild, tx: number, ty: number, sp: number, dt: number, land?: boolean) {
  const dx = tx - w.x,
    dy = ty - w.y,
    d = Math.hypot(dx, dy);
  if (d < 0.01) return 0;
  const st = Math.min(sp * dt, d),
    nx = w.x + (dx / d) * st,
    ny = w.y + (dy / d) * st;
  if (land && isWaterCell(nx, ny)) return d; // raposa não atravessa água
  w.x = nx;
  w.y = ny;
  w.dir = Math.atan2(dy, dx);
  return d - st;
}
function heroNear(x: number, y: number, r: number) {
  for (const h of world.heroes) if (h.state !== "indungeon" && Math.hypot(h.x - x, h.y - y) < r) return h;
  return null;
}
export function killWild(w: Wild, cause: string) {
  if (!w.alive) return;
  w.alive = false;
  popMudou();
  w.dead = world.tick;
  logSp(w.species, "death", cause);
  pushEvent((w.species === "duck" ? "Pato" : w.species === "eagle" ? "Águia" : "Raposa") + " — " + cause + ".");
}
function scareFlock(w: Wild, _away?: Ponto) {
  const p = randWaterPoint(w, 60, 190) || { x: w.x + 80, y: w.y };
  for (const o of world.wild!)
    if (o.alive && o.species === "duck" && o.flock === w.flock) {
      o.state = "fly";
      o.home = { x: p.x + (Math.random() - 0.5) * 14, y: p.y + (Math.random() - 0.5) * 14 };
    }
}
function scrapCarcass(c: Carcaca) {
  if (c) {
    c.amount = c.max * 0.12;
  }
} // a raposa/águia comeu quase tudo
function wildBreeding(dt: number) {
  world._br = world._br || {};
  for (const sp in WILD_BREED) {
    const cfg = WILD_BREED[sp];
    world._br[sp] = (world._br[sp] || 0) + dt;
    if (world._br[sp] < cfg.every) continue;
    world._br[sp] = 0;
    const list = world.wild!.filter((o) => o.alive && o.species === sp);
    if (list.length < 2 || list.length >= WILD_CAP[sp]) continue;
    const fed = list.filter((o) => o.hunger < cfg.hungerMax);
    if (fed.length < 2 || Math.random() > cfg.chance) continue;
    const par = fed[Math.floor(Math.random() * fed.length)],
      n = cfg.n[0] + Math.floor(Math.random() * (cfg.n[1] - cfg.n[0] + 1));
    for (let i = 0; i < n && list.length + i < WILD_CAP[sp]; i++) {
      let kid;
      if (sp === "duck")
        kid = addWild("duck", par.x + (Math.random() - 0.5) * 8, par.y + (Math.random() - 0.5) * 8, {
          flock: par.flock,
          home: par.home,
        });
      else if (sp === "fox") kid = addWild("fox", par.x + 6, par.y + 6, { state: "prowl", home: par.home });
      else kid = addWild("eagle", par.x, par.y, { state: "patrol", wp: null });
      kid.coat = Math.random() < 0.75 ? par.coat : rollCoat(sp);
      kid.hunger = 20;
      logSp(sp, "birth");
    }
    pushEvent(
      {
        duck: "Nasceram patinhos numa lagoa.",
        fox: "Nasceu uma raposa na mata.",
        eagle: "Uma águia jovem deixou o ninho.",
      }[sp]!,
    );
  }
}
export function updateWild(dt: number) {
  if (!world.wild) return;
  const prey = (x: number, y: number, r: number) => {
    let b = null,
      bd = r;
    for (const a of world.animals)
      if (a.alive && a.species === "rabbit") {
        const d = Math.hypot(a.x - x, a.y - y);
        if (d < bd) {
          bd = d;
          b = a;
        }
      }
    return b;
  };
  const duckNear = (w: Wild, r: number) =>
    world.wild!.find(
      (o) => o.alive && o.species === "duck" && o.state === "idle" && Math.hypot(o.x - w.x, o.y - w.y) < r,
    );
  // fome extrema machuca; barriga cheia cura devagar
  const starve = (w: Wild) => {
    if (w.hunger >= 100) {
      w.hp -= 0.05 * dt;
      if (w.hp <= 0) {
        killWild(w, "fome");
        return true;
      }
    } else if (w.hp < 100) w.hp = Math.min(100, w.hp + 0.02 * dt);
    return false;
  };
  for (let i = world.wild.length - 1; i >= 0; i--) {
    const w = world.wild[i];
    if (!w.alive) {
      if (world.tick - w.dead! > 60) world.wild.splice(i, 1);
      continue;
    }
    if (dungeon.active && BICHOS.presos.has(w)) continue; // v8.1: no campo aberto, quem move a raposa é o campo
    w.t -= dt;
    if (w.cool! > 0) w.cool! -= dt;
    {
      const mvg =
        w.state === "fly" || w.state === "chase" || w.state === "flee" || w.state === "patrol" || w.state === "dive";
      w.energy = Math.max(0, Math.min(100, (w.energy == null ? 80 : w.energy) + (mvg ? -0.05 : 0.03) * dt));
      w.thirst = Math.max(0, Math.min(100, (w.thirst == null ? 25 : w.thirst) + 0.012 * dt));
      if (w.thirst > 40 && isWaterCell(w.x, w.y)) w.thirst = Math.max(0, w.thirst - 0.5 * dt);
    }
    if (w.species === "duck") {
      w.hunger = Math.max(5, Math.min(60, w.hunger + (w.state === "fly" ? 0.04 : -0.012) * dt));
      if (w.state === "fly") {
        if (stepTo(w, w.home!.x, w.home!.y, 22, dt) < 3) {
          w.state = "idle";
          w.t = 20;
        }
      } else {
        const sc =
          (heroNear(w.x, w.y, 30) && Math.random() < 0.06) ||
          world.wild.find(
            (o) => o.alive && o.species === "fox" && o.state === "chase" && Math.hypot(o.x - w.x, o.y - w.y) < 45,
          );
        if (sc) {
          scareFlock(w);
          continue;
        }
        if (w.t <= 0) {
          w.t = 30 + Math.random() * 60;
          w.tgt = { x: w.home!.x + (Math.random() - 0.5) * 36, y: w.home!.y + (Math.random() - 0.5) * 36 };
        }
        if (w.tgt) stepTo(w, w.tgt.x, w.tgt.y, 1.6, dt);
      }
    } else if (w.species === "eagle") {
      w.hunger += 0.03 * dt;
      const b = CONFIG.SIM_BOUNDS;
      if (starve(w)) continue;
      if (w.state === "patrol") {
        if (!w.wp || Math.hypot(w.wp.x - w.x, w.wp.y - w.y) < 8) {
          if (Math.random() < 0.3) {
            const ns = world.nodes!.filter((n) => Math.hypot(n.x - w.x, n.y - w.y) < 120);
            const n = ns[Math.floor(Math.random() * ns.length)];
            if (n) {
              w.state = "perch";
              w.wp = { x: n.x, y: n.y - 4 };
              w.t = 80 + Math.random() * 120;
              w.landing = true;
              continue;
            }
          }
          w.wp =
            Math.random() < 0.5
              ? rndIn(ROCK_ZONES[Math.floor(Math.random() * ROCK_ZONES.length)])
              : { x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h };
        }
        stepTo(w, w.wp.x, w.wp.y, 9, dt);
        if (w.hunger > 40 && !(w.cool! > 0)) {
          const p = prey(w.x, w.y, 85) || duckNear(w, 70);
          if (p) {
            w.state = "dive";
            w.prey = p;
          }
        }
      } else if (w.state === "dive") {
        const p = w.prey;
        if (!p || !p.alive) {
          w.state = "patrol";
          w.wp = null;
          continue;
        }
        if (stepTo(w, p.x, p.y, 34, dt) < 5) {
          const ok = Math.random() < (p.species === "rabbit" ? 0.5 : 0.6); // a presa pode escapar
          if (ok) {
            if (p.species === "rabbit") scrapCarcass(killAnimal(p as Animal, "pego por uma águia")!);
            else killWild(p as Wild, "pego por uma águia");
            w.hunger = Math.max(0, w.hunger - 55);
          } else w.cool = 150;
          w.state = "perch";
          w.t = ok ? 70 : 40;
          w.landing = false;
          w.wp = null;
        }
      } else if (w.state === "perch") {
        if (w.landing && w.wp && stepTo(w, w.wp.x, w.wp.y, 9, dt) < 2) w.landing = false;
        if (w.t <= 0) {
          w.state = "patrol";
          w.wp = null;
        }
      }
    } else if (w.species === "fox") {
      w.hunger += 0.04 * dt;
      if (starve(w)) continue;
      const h = heroNear(w.x, w.y, 45),
        wolf = world.animals.find((a) => a.alive && a.species === "wolf" && Math.hypot(a.x - w.x, a.y - w.y) < 60);
      if (h || wolf) {
        const o = h || wolf;
        w.state = "flee";
        w.t = 20;
        w.fx = w.x + (w.x - o!.x) * 3;
        w.fy = w.y + (w.y - o!.y) * 3;
      }
      if (w.state === "flee") {
        stepTo(w, w.fx!, w.fy!, 12, dt, true);
        if (w.t <= 0) w.state = "prowl";
      } else if (w.state === "prowl") {
        if (w.t <= 0) {
          w.t = 40 + Math.random() * 60;
          w.tgt = { x: w.home!.x + (Math.random() - 0.5) * 80, y: w.home!.y + (Math.random() - 0.5) * 80 };
        }
        if (w.tgt) stepTo(w, w.tgt.x, w.tgt.y, 3, dt, true);
        if (w.hunger > 30) w.hunger = Math.max(0, w.hunger - 0.022 * dt); // onívora: frutos, insetos e ovos seguram a fome
        if (w.hunger > 42 && !(w.cool! > 0)) {
          const p = prey(w.x, w.y, 95) || duckNear(w, 60);
          if (p) {
            w.state = "chase";
            w.prey = p;
            w.t = 70;
          }
        }
      } else if (w.state === "chase") {
        const p = w.prey;
        if (!p || !p.alive || w.t <= 0) {
          w.state = "prowl";
          w.t = 0;
          continue;
        }
        if (p.state === "fly") {
          w.state = "prowl";
          w.t = 0;
          continue;
        }
        if (stepTo(w, p.x, p.y, 11, dt, true) < 5) {
          if (Math.random() < 0.5) {
            if (p.species === "rabbit") scrapCarcass(killAnimal(p as Animal, "pego por uma raposa")!);
            else killWild(p as Wild, "pego por uma raposa");
            w.hunger = Math.max(0, w.hunger - 50);
            w.state = "eat";
            w.t = 40;
          } else {
            w.cool = 100;
            w.state = "prowl";
            w.t = 0;
          } // a presa escapou
        }
      } else if (w.state === "eat") {
        if (w.t <= 0) {
          w.state = "prowl";
          w.t = 0;
        }
      }
    }
  }
  wildBreeding(dt);
  // manutenção das pedras do chão
  world._wa = (world._wa || 0) + dt;
  if (world._wa >= 240) {
    world._wa = 0;
    if (world.nodes!.filter((n) => n.kind === "rock" && nodeReady(n)).length < 45) addRock();
    world.nodes = world.nodes!.filter((n) => n.readyAt !== Infinity);
    limparAreaReservada(); // v8.1: também ao trocar de quadrante
  }
}

/* ---- retorno de espécies: migração (mesmo extinta, tem chance de voltar) ---- */
interface Imigracao {
  low: number;
  group: number[];
  pZero: number;
  pLow: number;
  msg: string;
  needs?: () => boolean;
}
export const IMMIGRATION: Record<string, Imigracao> = {
  rabbit: { low: 6, group: [3, 5], pZero: 0.09, pLow: 0.03, msg: "🐇 Um bando de coelhos migrou para a floresta." },
  deer: { low: 4, group: [2, 3], pZero: 0.06, pLow: 0.02, msg: "🦌 Uma pequena manada de cervos entrou na região." },
  wolf: {
    low: 2,
    group: [2, 2],
    pZero: 0.05,
    pLow: 0.012,
    needs: () => populationOf("deer") + populationOf("rabbit") >= 14,
    msg: "🐺 Uma alcateia errante chegou ao território.",
  },
  fox: {
    low: 2,
    group: [1, 2],
    pZero: 0.07,
    pLow: 0.02,
    needs: () => populationOf("rabbit") + populationOf("duck") >= 8,
    msg: "🦊 Uma raposa chegou à floresta.",
  },
  duck: { low: 6, group: [4, 6], pZero: 0.1, pLow: 0.04, msg: "🦆 Um bando de patos pousou numa lagoa." },
  eagle: {
    low: 1,
    group: [1, 1],
    pZero: 0.06,
    pLow: 0.02,
    needs: () => populationOf("rabbit") + populationOf("duck") >= 10,
    msg: "🦅 Uma águia chegou patrulhando a região.",
  },
};
export function updateImmigration(dtMin: number) {
  world._imm = (world._imm || 0) + dtMin;
  if (world._imm < 60) return;
  world._imm -= 60;
  for (const sp of ALL_KEYS) {
    const cfg = IMMIGRATION[sp],
      pop = populationOf(sp);
    const p = pop === 0 ? cfg.pZero : pop < cfg.low ? cfg.pLow : 0;
    if (!p || (cfg.needs && !cfg.needs()) || Math.random() >= p) continue;
    const n = cfg.group[0] + Math.floor(Math.random() * (cfg.group[1] - cfg.group[0] + 1));
    if (sp === "duck") spawnFlock();
    else if (sp === "fox") {
      for (let i = 0; i < n; i++) spawnFox();
    } else if (sp === "eagle") {
      const s = immigrationSpot();
      addWild("eagle", s.x, s.y, { state: "patrol", wp: null });
    } else {
      const s = immigrationSpot();
      for (let i = 0; i < n; i++) {
        const a = spawnAnimal(
          sp,
          s.x + (Math.random() - 0.5) * 14,
          s.y + (Math.random() - 0.5) * 14,
          SPECIES[sp].matureAgeDay + 0.5 + Math.random() * 3,
        );
        a.sex = i % 2 === 0 ? "M" : "F";
        a.reproCooldown = 0;
      }
    }
    (world.spTotals[sp] || (world.spTotals[sp] = { births: 0, deaths: 0, immigrants: 0, causes: {} })).immigrants += n;
    pushEvent(cfg.msg);
  }
}
export function drawWild(this: unknown) {
  /* v6.6 */
  const all = world.wild || [],
    C = visCenters();
  if (!C.length) return drawWildBase.apply(this, arguments as Repasse);
  const near: Wild[] = [],
    far: Wild[] = [];
  for (const w of all) if (naVista(w.x, w.y, 40)) (visK(w.x, w.y, C) > 0 ? near : far).push(w); // v7.7: só os da tela
  world.wild = near;
  try {
    drawWildBase.apply(this, arguments as Repasse);
  } finally {
    world.wild = all;
  }
  for (const w of far) if (w.alive) farDot(w.x, w.y, "#d9c48a");
}
// etapa de drawWild: original
function drawWildBase() {
  const now = performance.now();
  for (const w of world.wild!) {
    if (!w.alive || !naVista(w.x, w.y, 40)) continue;
    const v = w.coat,
      flying = w.state === "fly" || (w.species === "eagle" && w.state !== "perch");
    let sz = { duck: 16, fox: 19, eagle: 26 }[w.species],
      y = w.y,
      rowO = null;
    if (w.species === "duck") {
      y += Math.sin(now / (flying ? 55 : 380) + w.vr!) * (flying ? 1.6 : 0.5);
      if (flying) sz = 19;
    }
    if (w.species === "eagle") {
      rowO = w.state === "perch" ? 11 : 10;
      if (w.state === "perch") sz = 19;
      else {
        sz = 28 + Math.sin(now / 160 + w.vr!) * 2.2;
        y += Math.sin(now / 500 + w.vr!) * 1.5;
      }
    }
    if (w.species === "fox")
      y +=
        Math.sin(now / (w.state === "chase" || w.state === "flee" ? 80 : 400) + w.vr!) *
        (w.state === "eat" ? 0.2 : 0.8);
    sz = fitSz(sz!);
    TELAS.ctx.save();
    TELAS.ctx.globalAlpha = flying ? 0.22 : 0.28;
    TELAS.ctx.fillStyle = "#000";
    TELAS.ctx.beginPath();
    TELAS.ctx.ellipse(w.x + (flying ? 5 : 0), w.y + sz * (flying ? 0.7 : 0.38), sz * 0.36, sz * 0.13, 0, 0, 7);
    TELAS.ctx.fill();
    TELAS.ctx.restore();
    drawSprite(w.species, w.sex, v, w.x, y - (flying ? 4 : 0), sz, 1, rowO);
    if (w.state === "dive") {
      TELAS.ctx.beginPath();
      TELAS.ctx.strokeStyle = "#ff6b6b";
      TELAS.ctx.lineWidth = 1.2;
      TELAS.ctx.arc(w.x, w.y, sz * 0.7, 0, 7);
      TELAS.ctx.stroke();
    }
  }
}
export function drawNodes() {
  if (!world.nodes || layers.flora === false) return;
  for (const n of world.nodes) {
    if (!naVista(n.x, n.y)) continue; // v7.7
    const ready = nodeReady(n);
    if (n.readyAt === Infinity) continue;
    TELAS.ctx.save();
    TELAS.ctx.globalAlpha = ready ? 0.95 : 0.35;
    if (n.kind === "tree") {
      const k = { small: 0.8, medium: 1, large: 1.25 }[n.size]!;
      TELAS.ctx.fillStyle = "#4a3320";
      TELAS.ctx.fillRect(n.x - 0.9 * k, n.y, 1.8 * k, 3.2 * k);
      TELAS.ctx.fillStyle = ready ? "#2f6b34" : "#5b7a55";
      TELAS.ctx.strokeStyle = "#16301a";
      TELAS.ctx.lineWidth = 0.7;
      TELAS.ctx.beginPath();
      TELAS.ctx.moveTo(n.x, n.y - 7 * k);
      TELAS.ctx.lineTo(n.x + 4.2 * k, n.y + 0.5);
      TELAS.ctx.lineTo(n.x - 4.2 * k, n.y + 0.5);
      TELAS.ctx.closePath();
      TELAS.ctx.fill();
      TELAS.ctx.stroke();
    } else {
      TELAS.ctx.fillStyle = "#9b9a92";
      TELAS.ctx.strokeStyle = "#3d3b36";
      TELAS.ctx.lineWidth = 0.8;
      TELAS.ctx.beginPath();
      TELAS.ctx.ellipse(n.x, n.y, 3.6, 2.6, 0, 0, 7);
      TELAS.ctx.fill();
      TELAS.ctx.stroke();
      TELAS.ctx.fillStyle = "rgba(255,255,255,.35)";
      TELAS.ctx.fillRect(n.x - 1.6, n.y - 1.4, 1.8, 0.9);
    }
    TELAS.ctx.restore();
  }
}
export function pickWildAt(x: number, y: number) {
  let b = null,
    bd = 11;
  for (const w of world.wild || []) {
    if (!w.alive) continue;
    const d = Math.hypot(w.x - x, w.y - y);
    if (d < bd) {
      bd = d;
      b = w;
    }
  }
  return b;
}
export function pickNodeAt(x: number, y: number) {
  let b = null,
    bd = 7;
  for (const n of world.nodes || []) {
    if (!nodeReady(n) && n.readyAt === Infinity) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      b = n;
    }
  }
  return b;
}
/** O que o inspetor mostra para uma coisa sem ficha própria (árvore, pedra, runa). */
interface FichaInfo {
  tag: string;
  color: string;
  name: string;
  sub: string;
  desc: string;
  meta: string;
  btn: string | null; // texto do botão de mandar alguém (ou nenhum)
  target?: { kind: string; x: number; y: number };
}
export function openInfo(o: FichaInfo) {
  SEL.selectedWild = null;
  SEL.selectedCity = null;
  SEL.selectedHero = null;
  SEL.selectedAnimal = null;
  SEL.selectedPlant = null;
  SEL.infoTarget = o.target || null;
  const $ = (i: string) => document.getElementById(i)!;
  $("insp-animal-stats").style.display = "none";
  $("insp-plant-info").style.display = "block";
  ($("b-growth").closest(".stat-bar-wrap") as HTMLElement).style.display = "none";
  $("insp-tag").textContent = o.tag;
  $("insp-tag").style.background = o.color;
  $("insp-tag").style.color = "#1c140b";
  $("insp-name").textContent = o.name;
  $("insp-id").textContent = o.sub;
  $("insp-desc").textContent = o.desc;
  $("insp-meta-plant").innerHTML = o.meta;
  $("insp-actions").dataset.sig = "info";
  $("insp-actions").innerHTML = o.btn ? '<button class="btn" data-act="dispatch">' + o.btn + "</button>" : "";
  $("inspector").classList.add("open");
}
export function openWildInspector(w: Wild) {
  // mesmo painel completo dos outros animais (Fome, Sede, Energia, Vida, estado, características)
  const i = WILD_INFO[w.species],
    cf = coatInfo(w.species, w.coat)!,
    $ = (x: string) => document.getElementById(x)!;
  SEL.selectedHero = null;
  SEL.selectedCity = null;
  SEL.selectedPlant = null;
  SEL.selectedAnimal = null;
  SEL.selectedWild = w;
  SEL.infoTarget = { kind: w.species, x: w.x, y: w.y };
  clearInspExtras();
  $("insp-animal-stats").style.display = "block";
  $("insp-plant-info").style.display = "none";
  $("insp-tag").textContent = i.tag;
  $("insp-tag").style.background = i.color;
  $("insp-tag").style.color = "#1c140b";
  $("insp-name").textContent = cf.name + (cf.rare ? " ✦" : "");
  icoPortrait(w.species, w.sex, w.coat);
  $("insp-id").textContent = w.id + " · " + (w.sex === "M" ? "macho" : "fêmea");
  const hg = w.hunger || 0,
    th = w.thirst == null ? 0 : w.thirst,
    en = w.energy == null ? 100 : w.energy,
    hp = Math.max(0, w.hp);
  $("v-hunger").textContent = Math.round(hg) + " · " + hungerTier(hg)[1];
  $("b-hunger").style.width = hg + "%";
  $("v-thirst").textContent = Math.round(th) + "%";
  $("b-thirst").style.width = th + "%";
  $("v-energy").textContent = Math.round(en) + "%" + (en < 1 ? " · exausto" : "");
  $("b-energy").style.width = en + "%";
  $("v-health").textContent = Math.round(hp) + "%";
  $("b-health").style.width = hp + "%";
  $("insp-state").textContent = w.alive ? "Estado: " + (WSTATE[w.state] || w.state) : "Estado: morto";
  $("insp-meta").textContent =
    "Posição: (" + Math.round(w.x) + ", " + Math.round(w.y) + ")  ·  Território: Floresta Central";
  $("insp-traits").innerHTML =
    '<div class="trait-title">CLASSIFICAÇÃO (pela aparência)</div><div class="trait-row"><span class="tname">' +
    cf.name +
    '</span><span class="teffect" style="font-weight:400">' +
    cf.desc +
    (cf.rare ? " · pelagem rara" : "") +
    "</span></div>" +
    '<div class="trait-title">SOBRE</div><div class="trait-row"><span class="teffect" style="font-weight:400">' +
    i.desc +
    "</span></div>" +
    (w.species === "duck"
      ? '<div class="trait-row"><span class="tname">Rende</span><span class="teffect">🪶 Pena (1–2) e 1 carne</span></div>'
      : w.species === "eagle"
        ? '<div class="trait-row"><span class="tname">Rende</span><span class="teffect">🪶 Pena de Águia (1–2) e 2 carne</span></div>'
        : "");
  const act = $("insp-actions");
  act.dataset.sig = "wild" + w.species;
  act.innerHTML = i.btn ? '<button class="btn" data-act="dispatch">' + i.btn + "</button>" : "";
  $("inspector").classList.add("open");
}
export function openNodeInspector(n: NoRecurso) {
  const t = n.kind === "tree";
  openInfo({
    tag: t ? "ÁRVORE" : "PEDRA",
    color: t ? "#7fae5a" : "#b9b7ae",
    name: t
      ? "Árvore " + ({ small: "pequena", medium: "média", large: "grande" } as Record<string, string>)[n.size]
      : "Pedra solta",
    sub: nodeReady(n) ? "Pronta para coleta" : "Se recuperando",
    desc: t
      ? "Dá galhos e lenha sem ser derrubada; volta a render depois de 2 dias."
      : "Pedra pequena do chão. Some depois de coletada.",
    meta: t
      ? "<b>Rende:</b> 🪵 " + TREE_WOOD[n.size][0] + "–" + TREE_WOOD[n.size][1] + " Lenha + galhos"
      : "<b>Rende:</b> 🪨 1–2 Pedra",
    btn: nodeReady(n) ? (t ? "🪵 Mandar coletar lenha e galhos" : "🪨 Mandar coletar pedra") : null,
    target: { kind: n.kind, x: n.x, y: n.y },
  });
}
