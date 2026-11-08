/* ==== Fase 4 — campo com vida: pássaros, coelhos, cervos e o lobo neutro (v6.8, v7.0) ==== */
import { dungeon } from "../core/state.ts";
import { CRIT_SP, CAMPO_VIDA, CAMPO_CHAO } from "../data/campo.ts";
import { DANO } from "../data/combate.ts";
import { CACADA } from "../data/mapa.ts";
import { spawnBird, spawnDungeonMonster, spawnDungeonToast, dSafe } from "./masmorra.ts";
import { sfx } from "./chao.ts";
import { FIN } from "./faca_corda.ts";
import { folTick, stickTick, folWake, folDrain, folVel, folFugindo } from "./tipos.ts";
import { bleedTick } from "./combate.ts";
import { angSD } from "../render/gl/renderer.ts";
import { querLobo } from "../campanha/lobos.ts";
import { pontoPerto, mundoMover } from "../map/mundo.ts";
import { cansadoAI } from "./cansaco.ts";
import type { Monster, Ponto } from "../core/tipos.ts";

/* ==== v6.8 — Campo com vida: pássaros, coelhos e cervos (neutros) e, às vezes, um lobo que decide se te ataca ==== */
export const CRIT = { cur: null as Monster | null };

export function critSpawn(sp: string, edge?: boolean) {
  const d = dungeon,
    T = d.tile,
    S = CRIT_SP[sp];
  let x,
    y,
    n = 0;
  do {
    if (edge) {
      const side = Math.floor(Math.random() * 4);
      x = side < 2 ? (side ? d.cols * T - T * 1.5 : T * 1.5) : T * 2 + Math.random() * (d.cols * T - T * 4);
      y = side >= 2 ? (side === 2 ? T * 1.5 : d.rows * T - T * 1.5) : T * 2 + Math.random() * (d.rows * T - T * 4);
    } else {
      x = T * 3 + Math.random() * (d.cols * T - T * 6);
      y = T * 2 + Math.random() * (d.rows * T - T * 4);
    }
  } while (n++ < 30 && Math.hypot(x - d.px, y - d.py) < T * 6);
  const pp = pontoPerto(edge ? 11 : 6); // v8.0: no campo aberto, em volta dela e em terra (chegando de longe = edge)
  if (pp) ({ x, y } = pp);
  const m = {
    kind: "critter",
    critter: true,
    sp,
    prof: S.prof,
    name: S.n,
    x,
    y,
    hp: S.hp,
    hpMax: S.hp,
    alive: true,
    st: "wander",
    t: Math.random() * 2,
    ang: Math.random() * 6.28,
    dm: 0.5,
    coat: 0,
    sex: Math.random() < 0.5 ? "M" : "F",
    tgt: null as Ponto | null,
  };
  d.monsters.push(m);
  return m;
}
export function campoPovoar() {
  const d = dungeon,
    V = CAMPO_VIDA,
    r = (a: number[]) => a[0] + Math.floor(Math.random() * (a[1] - a[0] + 1));
  d.birds = d.birds || [];
  d.birdQ = d.birdQ || [];
  for (let i = 0; i < V.passaros; i++) spawnBird();
  // v8.0: no campo aberto os coelhos, cervos e lobos são os do mapa (map/mundo.ts, bichosTick); só o da missão vem
  const aberto = !!d.origem;
  if (!aberto) for (let i = r(V.coelhos); i > 0; i--) critSpawn("rabbit");
  if (!aberto) for (let i = r(V.cervos); i > 0; i--) critSpawn("deer");
  if ((!aberto && Math.random() < V.loboChance) || querLobo()) loboNeutro(); // v7.7: a missão do lobo garante um
  d.campoT = 0;
  /* v7.0 */
  try {
    // No mundo aberto os galhos só vêm das árvores derrubadas pelo jogador.
    if (!d.origem) for (let i = 0; i < CAMPO_CHAO.galhoIni; i++) groundAt("galho");
  } catch (_) {}
}
export function loboNeutro() {
  const m = spawnDungeonMonster();
  m.neutral = true;
  if (!m.nivel || m.nivel === "adulto") m.name = "Lobo"; // v8.0: jovem/veterano guardam o nome (LOBO_NIVEL)
  m.st = "wander";
  m.alerted = false;
  m.nt = 0;
  return m;
}
export function loboBravo(m: Monster) {
  if (!m.neutral) return;
  m.neutral = false;
  m.fugir = false;
  m.st = "chase";
  m.alerted = true;
  m.t = 0;
  spawnDungeonToast("😡", m.x, m.y - 34, "#ff6a5a", 18);
  sfx("guardbreak");
}
export function critLoot(m: Monster, fin: boolean) {
  const d = dungeon,
    S = CRIT_SP[m.sp!],
    up = fin ? 1 + (FIN.extra ? 1 : 0) : 0;
  d.loot = d.loot || [];
  for (let i = 0; i < S.meat; i++)
    d.loot.push({
      key: "carne",
      an: S.an,
      tier: Math.min(2, up),
      t: 0,
      ttl: 40,
      x: m.x + (Math.random() - 0.5) * 18,
      y: m.y + (Math.random() - 0.5) * 18,
      fin: !!fin,
    });
  if (Math.random() < (fin ? Math.max(0.65, S.pele) : S.pele))
    d.loot.push({
      key: "pele",
      tier: Math.min(2, up),
      t: 0,
      ttl: 0,
      x: m.x + (Math.random() - 0.5) * 18,
      y: m.y + (Math.random() - 0.5) * 18,
      fin: !!fin,
    });
}

/* ---------- campo: madeira (galhos) no chão ---------- */
export function groundAt(key: string) {
  const d = dungeon,
    T = d.tile;
  if (d.origem && key === "galho") return;
  let x,
    y,
    t = 0;
  do {
    x = T * 1.6 + Math.random() * (d.cols * T - T * 3.2);
    y = T * 1.6 + Math.random() * (d.rows * T - T * 3.2);
  } while (t++ < 30 && Math.hypot(x - d.entrance.x, y - d.entrance.y) < T * 1.8);
  const pp = pontoPerto(1.8); // v8.0: no campo aberto, perto dela e em terra
  if (pp) ({ x, y } = pp);
  d.loot = d.loot || [];
  d.loot.push({ key, x, y, ground: true, t: 0, ttl: 0 });
}

/* ==== v6.8 — Campo com vida: pássaros, coelhos e cervos (neutros) e, às vezes, um lobo que decide se te ataca ==== */
/* IA dos bichos neutros */
function critMove(m: Monster, ax: number, ay: number, sp: number, dt: number) {
  const d = dungeon,
    T = d.tile,
    L = Math.hypot(ax, ay) || 1;
  sp *= folVel(m); // v7.7: cansado anda mais devagar
  [m.x, m.y] = mundoMover(
    m.x,
    m.y,
    Math.max(T, Math.min(d.cols * T - T, m.x + (ax / L) * sp * dt)),
    Math.max(T, Math.min(d.rows * T - T, m.y + (ay / L) * sp * dt)),
    0.2, // v8.0: no campo aberto, sem entrar na água nem atravessar tronco
  );
  m.ang = Math.atan2(ay, ax);
  m.moving = true;
}
function critBase(m: Monster, dt: number) {
  if (m.flash! > 0) m.flash! -= dt;
  if (m.kx || m.ky) {
    const d = dungeon,
      T = d.tile;
    m.x = Math.max(T, Math.min(d.cols * T - T, m.x + m.kx! * dt));
    m.y = Math.max(T, Math.min(d.rows * T - T, m.y + m.ky! * dt));
    const f = Math.exp(-9 * dt);
    m.kx! *= f;
    m.ky! *= f;
    if (Math.abs(m.kx!) + Math.abs(m.ky!) < 4) m.kx = m.ky = 0;
  }
  if (m.slow! > 0) m.slow! -= dt;
  if (m.stun! > 0) m.stun! -= dt;
  try {
    folTick(m, dt);
    stickTick(m, dt);
  } catch (_) {}
  if (!m.alive) return false;
  if (m.bleed) {
    m.bleed.t -= dt;
    if (m.bleed.t <= 0) bleedTick(m);
    if (!m.alive) return false;
  }
  if (m.ko! > 0) {
    m.ko! -= dt;
    m.st = "recover";
    if (m.ko! <= 0) {
      m.ko = 0;
      m.st = "wander";
      try {
        folWake(m);
      } catch (_) {}
      // v8.0: levanta e foge com o fôlego que recuperou; ferido, a fuga cansa e ele pode cair de novo.
      // v8.1: foge para longe dela (antes, para um lado qualquer), no desespero (FOLEGO.desespero: sem cair e mais rápido)
      const d = dungeon;
      m.scared = Math.max(2.5, m.desespero || 0);
      m.fa = Math.atan2(m.y - d.py, m.x - d.px) + (Math.random() - 0.5) * 0.8;
      if (m.hp < m.hpMax) m.ferido = Math.max(m.ferido || 0, 8);
    }
    return false;
  }
  if (folFugindo(m, dt)) return false;
  if (m.bound || m.crav) return false;
  return true;
}
export function critAI(m: Monster, dt: number) {
  critAIBase(m, dt);
  /* v7.0 */
  {
    const S = CRIT_SP[m.sp!];
    if (m.ferido! > 0 && m.alive && dt > 0) {
      m.ferido! -= dt;
      m.scared = Math.max(m.scared || 0, 0.5);
      if (m.st === "flee" && m.moving && S.corridaFol) folDrain(m, S.corridaFol * dt);
    }
    // v8.1: a fuga do susto gasta o fôlego que ele ganhou ao levantar (FOLEGO.desespero.corre): escapa ou cai de novo
    if (m.desespero! > 0 && m.alive && dt > 0 && m.st === "flee" && m.moving)
      folDrain(m, DANO.FOLEGO.desespero.corre * m.folMax! * dt);
  }
}
function critAIBase(m: Monster, dt: number) {
  const d = dungeon,
    T = d.tile,
    S = CRIT_SP[m.sp!];
  m.moving = false;
  if (!critBase(m, dt)) return;
  if (m.stun! > 0) return;
  if (m.cacFuga) {
    fugaBorda(m, dt);
    return;
  }
  const dp = Math.hypot(d.px - m.x, d.py - m.y);
  let thr = null,
    td = 1e9;
  if (dp < T * S.scare * (m.st === "flee" ? 1.7 : 1) || m.scared! > 0) {
    thr = { x: d.px, y: d.py };
    td = dp;
  } /* v7.6: só para de fugir bem mais longe (sem vai-e-volta) */
  for (const o of d.monsters)
    if (o.alive && !o.critter && o.kind !== "bird") {
      const dd = Math.hypot(o.x - m.x, o.y - m.y);
      if (dd < T * 5 && dd < td) {
        thr = o;
        td = dd;
      }
    }
  if (m.scared! > 0) m.scared! -= dt;
  if (thr) {
    if (m.st !== "flee") m.fa = Math.atan2(m.y - thr.y, m.x - thr.x);
    m.st = "flee";
    m.calmT = 1.5; /* v7.6: rumo de fuga suave, desviando das bordas */
    let vx = m.x - thr.x,
      vy = m.y - thr.y;
    const L0 = Math.hypot(vx, vy) || 1;
    vx /= L0;
    vy /= L0;
    const W = d.cols * T,
      H = d.rows * T,
      mg = T * 2.5;
    if (m.x < mg) vx += ((mg - m.x) / mg) * 1.5;
    if (m.x > W - mg) vx -= ((m.x - (W - mg)) / mg) * 1.5;
    if (m.y < mg) vy += ((mg - m.y) / mg) * 1.5;
    if (m.y > H - mg) vy -= ((m.y - (H - mg)) / mg) * 1.5;
    m.wob = (m.wob || 0) + (Math.random() - 0.5) * dt * 2;
    m.wob = Math.max(-0.4, Math.min(0.4, m.wob));
    const want = Math.atan2(vy, vx) + m.wob;
    m.fa = m.fa == null ? want : m.fa + angSD(want, m.fa) * Math.min(1, dt * 3.5);
    // v8.1 (2026-11-08): correr cansa de verdade (field/cansaco.ts folCorrida; antes o fôlego voltava a 35% a cada
    // quadro e a corrida nunca cansava); cansado, ele escolhe a saída
    const cs = cansadoAI(m, thr, dt);
    if (cs === "parado") {
      m.st = "graze";
      return;
    }
    if (cs && cs !== "luta") {
      critMove(m, cs.x - m.x, cs.y - m.y, S.flee * (m.slow! > 0 ? 0.5 : 1), dt);
      return;
    }
    critMove(
      m,
      Math.cos(m.fa),
      Math.sin(m.fa),
      S.flee * (m.slow! > 0 ? 0.5 : 1), // v7.7: o fôlego entra em critMove (folVel), em faixas
      dt,
    );
    return;
  }
  // v8.1: cansado longe de quem fugia, continua descansando (ou indo para a moita) até recuperar
  if (m.cansado) {
    const cs = cansadoAI(m, { x: d.px, y: d.py }, dt);
    if (cs === "parado") {
      m.st = "graze";
      return;
    }
    if (cs && cs !== "luta") {
      critMove(m, cs.x - m.x, cs.y - m.y, S.flee, dt);
      return;
    }
  }
  if (m.calmT! > 0) {
    m.calmT! -= dt;
    m.st = "graze";
    m.tgt = null;
    m.t = Math.max(m.t, 1.5);
    return;
  } /* depois de fugir, para e respira antes de voltar a andar */
  m.t -= dt;
  if (m.t <= 0 || !m.tgt) {
    m.t = 2 + Math.random() * 4;
    m.tgt =
      Math.random() < 0.35
        ? null
        : {
            x: Math.max(T * 2, Math.min(d.cols * T - T * 2, m.x + (Math.random() - 0.5) * T * 6)),
            y: Math.max(T * 2, Math.min(d.rows * T - T * 2, m.y + (Math.random() - 0.5) * T * 5)),
          };
    m.st = m.tgt ? "wander" : "graze";
  }
  if (m.tgt) {
    const ax = m.tgt.x - m.x,
      ay = m.tgt.y - m.y;
    if (Math.hypot(ax, ay) < 4) m.tgt = null;
    else critMove(m, ax, ay, S.wander, dt);
  }
}
/* v7.7 — fluxo de caça (map/cacada.ts): o tempo acabou, a presa corre para a borda mais próxima e sai do campo */
function fugaBorda(m: Monster, dt: number) {
  const d = dungeon,
    T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    bordas = [
      [m.x, -1, 0],
      [W - m.x, 1, 0],
      [m.y, 0, -1],
      [H - m.y, 0, 1],
    ].sort((a, b) => a[0] - b[0]),
    [dist, bx, by] = bordas[0];
  m.st = "flee";
  if (dist < T * 1.15) {
    m.alive = false;
    m.fugiu = true;
    d.monsters = d.monsters.filter((o) => o !== m);
    if (d.target === m) d.target = null;
    return;
  }
  critMove(m, bx, by, CRIT_SP[m.sp!].flee * CACADA.fugaVel * (m.slow! > 0 ? 0.5 : 1), dt);
}
/* lobo neutro: passeia, pode caçar coelho/cervo; se você chega perto: 80% te ataca, 20% se afasta e some */
export function loboAI(m: Monster, dt: number) {
  const d = dungeon,
    T = d.tile,
    V = CAMPO_VIDA;
  m.moving = false;
  if (!critBase(m, dt)) return;
  if (m.stun! > 0) return;
  const dp = Math.hypot(d.px - m.x, d.py - m.y);
  if (m.fugir) {
    // v8.1 (2026-11-08): cansado, o lobo encurralado vira e luta; longe, descansa ou vai para a moita (field/cansaco.ts)
    const cs = cansadoAI(m, { x: d.px, y: d.py }, dt, true);
    if (cs === "luta") {
      spawnDungeonToast("🐺 encurralado!", m.x, m.y - 30, "#ff7a5a", 12);
      loboBravo(m);
      return;
    }
    if (cs === "parado") {
      m.st = "recover";
      return;
    }
    if (cs) {
      critMove(m, cs.x - m.x, cs.y - m.y, (m.spd || 38) * 1.6, dt);
      m._yaw = m.ang;
      return;
    }
    critMove(m, m.x - d.px, m.y - d.py, (m.spd || 38) * 1.6, dt);
    m._yaw = m.ang;
    if (
      m.x <= T * 1.05 ||
      m.y <= T * 1.05 ||
      m.x >= d.cols * T - T * 1.05 ||
      m.y >= d.rows * T - T * 1.05 ||
      dp > T * 14
    ) {
      m.alive = false;
      m.fugiu = true; // a caçada (map/cacada.ts) diz "fugiu", não "outro bicho levou"
      d.monsters = d.monsters.filter((o) => o !== m);
    }
    return;
  }
  /* v8.1 — espreita (intro/caminhada.ts): acompanha de lado, a m.espreita da heroína, olhando para ela; se ela chega
     perto, ele recua para a mata em vez de atacar */
  if (m.espreita) {
    const ux = (d.px - m.x) / (dp || 1),
      uy = (d.py - m.y) / (dp || 1),
      falta = dp - m.espreita;
    if (Math.abs(falta) > T * 0.8) {
      critMove(m, ux * falta, uy * falta, (m.spd || 38) * (falta > 0 ? 1.1 : 1.4), dt);
      m.st = falta > 0 ? "chase" : "wander";
    } else m.st = "recover";
    m.ang = Math.atan2(uy, ux);
    m._yaw = m.ang;
    return;
  }
  if (dp < T * V.perto && !dSafe()) {
    if (Math.random() < V.loboAtaca) loboBravo(m);
    else {
      m.fugir = true;
      spawnDungeonToast("🐺 recuou", m.x, m.y - 30, "#c9b88a", 12);
    }
    return;
  }
  /* v8.0: come a carne da presa no chão (ela some) e recupera vida enquanto mastiga */
  if (m.comendo! > 0) {
    const carne = m.mordida;
    if (carne && !(d.loot || []).includes(carne)) {
      m.comendo = 0; // alguém pegou a carne
      m.mordida = null;
      return;
    }
    m.comendo! -= dt;
    m.st = "recover";
    m.hp = Math.min(m.hpMax, m.hp + ((m.hpMax * V.loboCura) / V.loboCome) * dt);
    if (m.comendo! <= 0) {
      m.comendo = 0;
      if (carne) d.loot = (d.loot || []).filter((l) => l !== carne);
      m.mordida = null;
    }
    return;
  }
  if (m.refeicao) {
    m.refeicao = m.refeicao.filter((l) => (d.loot || []).includes(l));
    const carne = m.refeicao[0];
    if (!carne) m.refeicao = undefined;
    else {
      const ax = carne.x - m.x,
        ay = carne.y - m.y;
      if (Math.hypot(ax, ay) < T * 0.35) {
        m.refeicao.shift();
        m.mordida = carne;
        m.comendo = V.loboCome;
      } else {
        critMove(m, ax, ay, (m.spd || 38) * 0.6, dt);
        m._yaw = m.ang;
        m.st = "wander";
      }
      return;
    }
  }
  let presa = m.presa && m.presa.alive ? m.presa : null;
  m.nt! -= dt;
  if (!presa && m.nt! <= 0) {
    m.nt = 3 + Math.random() * 4;
    if (Math.random() < 0.4) {
      let b = null,
        bd = T * 8;
      for (const o of d.monsters)
        if (o.alive && o.critter) {
          const dd = Math.hypot(o.x - m.x, o.y - m.y);
          if (dd < bd) {
            bd = dd;
            b = o;
          }
        }
      presa = m.presa = b;
    }
  }
  if (presa) {
    const ax = presa.x - m.x,
      ay = presa.y - m.y,
      dd = Math.hypot(ax, ay);
    critMove(m, ax, ay, (m.spd || 38) * 1.9, dt);
    m._yaw = m.ang;
    m.st = "chase";
    if (dd < T * 0.55) {
      const antes = (d.loot || []).length;
      critDie(presa, true);
      m.presa = null;
      m.refeicao = (d.loot || []).slice(antes).filter((l) => l.key === "carne");
      spawnDungeonToast("🐺 caçou um " + presa.name.toLowerCase(), m.x, m.y - 34, "#ffb37a", 12);
    } else if (dd > T * 10) m.presa = null;
    return;
  }
  m.t -= dt;
  if (m.t <= 0 || !m.tgt) {
    m.t = 3 + Math.random() * 4;
    m.tgt = { x: T * 2 + Math.random() * (d.cols * T - T * 4), y: T * 2 + Math.random() * (d.rows * T - T * 4) };
  }
  const ax = m.tgt.x - m.x,
    ay = m.tgt.y - m.y;
  if (Math.hypot(ax, ay) < 6) m.tgt = null;
  else {
    critMove(m, ax, ay, (m.spd || 38) * 0.45, dt);
    m._yaw = m.ang;
    m.st = "wander";
  }
}
function critDie(m: Monster, byWolf: boolean) {
  if (!m.alive && !byWolf) return;
  m.alive = false;
  m.hp = 0;
  const d = dungeon;
  d.monsters = d.monsters.filter((o) => o !== m);
  if (d.target === m) d.target = null;
  critLoot(m, false);
}
