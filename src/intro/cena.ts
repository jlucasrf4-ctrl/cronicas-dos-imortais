/* ==== Fase 4 — cena inicial jogável: javali, o Caçador, flechas, runa (v6.1, v6.4) ==== */
import { ctPular, ctAtivo } from "./tutorial.ts";
import { caminhadaIni } from "./caminhada.ts";
import { GL3, dungeon, econ, world, TELAS } from "../core/state.ts";
import { glBuildHero, glBuildBoar } from "../render/gl/estilo.ts";
import { M4 } from "../render/gl/geometria.ts";
import { glPush, rodM } from "../render/gl/renderer.ts";
import { MB, mbIco, glMesh, glFree } from "../render/gl/malhas.ts";
import { cacadorAnimado, cacadorPreso, cacadorArcoNasCostas } from "../render/gl/cacador_anim.ts";
import { switchWeapon, spawnDungeonToast, updateWeaponUI, setBanner } from "../field/masmorra.ts";
import { MOB } from "../ui/celular.ts";
import { BOAR } from "../data/especies.ts";
import { ISC_BOAR, ISC_ESQUIVA, KNIFE_OBS } from "../data/intro.ts";
import { sfx, addRing, tryAddItem, toggleInv } from "../field/chao.ts";
import { resCount, qvInv, exitDungeon, launchDungeon } from "../expedicao/preparo.ts";
import { spawnJavalino } from "../creatures/javali.ts";
import { ensureInv } from "../items/inventario.ts";
import { ARROW_HOLD } from "../data/campo.ts";
import { arrowMakeOne } from "../items/aljava.ts";
import { mkItem, placeIn, ensureEquip } from "../items/equipamento.ts";
import { eqDurInit } from "../items/durabilidade.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mvToast } from "../ui/avisos.ts";
import { forgeLearn } from "../forja/forja.ts";
import { MAPCTL } from "../map/controle.ts";
import { snapToLand } from "../sim/animais.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { jogoEnter } from "../ui/modos.ts";
import { ensureHero } from "../hero/nivel.ts";
import { D3 } from "../field/projecao.ts";
import { campanhaEvento } from "../campanha/campanha.ts";
import { prenderSeCouber } from "../items/cinto.ts";
import type { Hero, Monster, Ponto } from "../core/tipos.ts";
import type { MalhasBichos } from "../core/state.ts";

/* --- estado --- */
/** O Caçador da cena inicial e do acampamento: onde está, para onde anda (go) e o que fazer ao chegar. */
interface NpcCacador extends Ponto {
  yaw: number;
  ph: number;
  aim?: number;
  carry?: boolean;
  came?: boolean;
  go?: Ponto | null;
  onArrive?: (() => void) | null;
  gone?: boolean;
  look?: Ponto | null;
  fade?: number;
}
/** Uma fala em curso (say): páginas de linhas, a página e a linha atuais. */
/** Uma página de fala: as linhas (por índice) e, às vezes, o que fazer quando ela termina. */
export interface PaginaFala {
  [linha: number]: string;
  act?: () => void;
  _did?: number; // a ação já rodou (1)
}
interface Dialogo {
  pages: PaginaFala[];
  i: number;
  j: number;
  done: () => void;
  t0: number;
}
interface EstadoISC {
  pending: boolean;
  on: boolean;
  ph: string;
  t: number;
  h: Hero | null;
  npc: NpcCacador | null;
  corpse: { x: number; y: number; yaw: number; gem: boolean } | null; // o javali abatido pelo Caçador
  arrow: { x0: number; y0: number; x1: number; y1: number; k: number; hit?: boolean } | null; // a flecha do resgate
  dlg: Dialogo | null;
  obj: null; // sobra: ninguém mais usa
  boar: Monster | null;
  hits: number;
  last: number;
  // acrescentados depois
  cand?: Hero | null;
  herbTry?: number;
  anaInv?: boolean;
  ac?: { step: number; made: number; k?: number; hold?: boolean };
  gemShow?: number;
  campNpc?: NpcCacador | null;
  shots?: number;
  moved0?: Ponto;
  boar0?: { wind: number[]; speed: number; cd?: number[] } | null;
  gotHit?: number;
  hitT?: number;
  noArrowSaid?: number;
  rescueAt?: number;
  herb0?: number;
  hp0?: number;
  lock?: null; // sobra: só é zerado
  _toMap?: boolean | number;
  ana?: number;
  _tap?: number;
  /** v8.0 — a lição do rolamento (ISC_ESQUIVA): 0 ainda não, 1 câmera lenta / congelado esperando o rolamento,
      2 rolou (o tempo voltando), 3 acabou */
  esq?: number;
  esqT?: number;
}
export const ISC: EstadoISC = {
  pending: false,
  on: false,
  ph: "",
  t: 0,
  h: null,
  npc: null,
  corpse: null,
  arrow: null,
  dlg: null,
  obj: null,
  boar: null,
  hits: 0,
  last: 0,
};
/* --- 3D: Caçador, flecha do resgate, javali caído com a joia --- */
export function hunterParts() {
  if (!GL3.hunterP)
    GL3.hunterP = glBuildHero("#6b7a3c", { cabeca: 0, peito: 1, pernas: 1, pes: 1, maoD: 0, maoE: 0, costas: 1 });
  return GL3.hunterP;
}
export function npcGL(n: NpcCacador) {
  /* v7.7 — Caçador animado (parado/andando); mirando e carregando o javali ficam na pose parada/andando */
  {
    const an = cacadorAnimado(n.x, n.y, { andando: !!n.go });
    if (an) {
      const P = hunterParts(),
        AF = M4.ch(M4.T(n.x, 0, n.y), M4.RY(-n.yaw), M4.S(1.3));
      glPush(an.mesh, AF, n.fade ? [0, 0, 0, 0] : null);
      if (n.aim) glPush(P.bowOnly, M4.mul(AF, cacadorPreso(an.mat, "arco")));
      else glPush(P.bowOnly, M4.ch(AF, cacadorPreso(an.mat, "costas"), cacadorArcoNasCostas()));
      return;
    }
  }
  const P = hunterParts(),
    mv = n.go ? 1 : 0,
    sw = Math.sin(n.ph) * 0.55 * mv,
    bob = Math.abs(Math.cos(n.ph)) * 1.1 * mv,
    AF = M4.ch(M4.T(n.x, bob, n.y), M4.RY(-n.yaw), M4.S(1.3)),
    body = AF;
  glPush(P.torso, body, n.fade ? [0, 0, 0, 0] : null);
  glPush(P.leg, M4.ch(AF, M4.T(0, 15 + Math.max(0, Math.sin(n.ph)) * mv, 2.8), M4.RZ(sw)));
  glPush(P.leg, M4.ch(AF, M4.T(0, 15 + Math.max(0, -Math.sin(n.ph)) * mv, -2.8), M4.RZ(-sw)));
  const shR = M4.ch(body, M4.T(0, 28, 7.6)),
    shL = M4.ch(body, M4.T(0, 28, -7.6));
  if (n.aim) {
    glPush(P.armPlain, M4.ch(shR, M4.RY(-0.2), M4.RZ(1.45)));
    glPush(P.armPlain, M4.ch(shL, M4.RY(0.3), M4.RZ(1.5)));
    glPush(P.bowOnly, M4.ch(body, M4.T(17, 28, -5), M4.RX(0.1)));
  } else if (n.carry) {
    glPush(P.armPlain, M4.ch(shR, M4.RZ(2.6)));
    glPush(P.armPlain, M4.ch(shL, M4.RZ(2.6)));
    glPush(P.bowOnly, M4.ch(body, M4.T(-6.4, 24, 0), M4.RX(0.55), M4.S(0.85)));
  } else {
    glPush(P.armPlain, M4.ch(shR, M4.RZ(0.35 + sw * 0.85)));
    glPush(P.armPlain, M4.ch(shL, M4.RZ(0.2 - sw * 0.9)));
    glPush(P.bowOnly, M4.ch(body, M4.T(-6.4, 24, 0), M4.RX(0.55), M4.S(0.85)));
  }
}
export function introGL() {
  if (!ISC.on && !ISC.npc) return;
  const d = dungeon;
  if (!d.active || d.mode !== "intro") return;
  const t = performance.now() / 1000;
  const C = ISC.corpse;
  if (C) {
    const W =
      (GL3.mesh as unknown as MalhasBichos).boar || ((GL3.mesh as unknown as MalhasBichos).boar = glBuildBoar());
    const n = ISC.npc;
    const M =
      n && n.carry
        ? M4.ch(M4.T(n.x, 30, n.y), M4.RY(-n.yaw + Math.PI / 2), M4.RX(Math.PI), M4.T(0, -12, 0), M4.S(0.8))
        : M4.ch(M4.T(C.x, 7, C.y), M4.RY(-C.yaw), M4.RX(1.45), M4.T(0, -6, 0), M4.S(0.95));
    glPush(W.body, M);
    if (!(n && n.carry)) {
      const P = hunterParts();
      glPush(P.rodWood, rodM([C.x - 4, 14, C.y - 2], [C.x + 6, 22, C.y - 9], 1.1));
      glPush(P.fletch, rodM([C.x + 5, 21, C.y - 8], [C.x + 8, 24, C.y - 11], 2.4, 0.3));
    }
    if (C.gem) {
      if (!GL3.mesh.introGem) {
        const b = MB();
        mbIco(b, M4.S(1), "#e8323e", 0, 0.05, 0.02);
        GL3.mesh.introGem = glMesh(b);
      }
      const pul = ISC.gemShow ? 0.5 + 0.5 * Math.sin(t * 6) : 0.2,
        base = n && n.carry ? M4.ch(M4.T(n.x, 40, n.y), M4.RY(-n.yaw)) : M4.T(C.x + 3, 20, C.y + 2);
      glPush(GL3.mesh.introGem, M4.ch(base, M4.RY(t * 1.5), M4.S(3.2, 4.4, 3.2)), [1, 0.85, 0.85, 0.25 + pul * 0.5]);
      glPush(GL3.mesh.introGem, M4.ch(base, M4.T(-3, -1, 2), M4.RY(-t), M4.S(2, 2.8, 2)), [
        1,
        0.85,
        0.85,
        0.2 + pul * 0.4,
      ]);
    }
  }
  const A = ISC.arrow;
  if (A && !A.hit) {
    const P = hunterParts(),
      x = A.x0 + (A.x1 - A.x0) * A.k,
      y = A.y0 + (A.y1 - A.y0) * A.k,
      ux = A.x1 - A.x0,
      uy = A.y1 - A.y0,
      L = Math.hypot(ux, uy) || 1;
    glPush(P.rodWood, rodM([x - (ux / L) * 26, 18, y - (uy / L) * 26], [x, 18, y], 1));
    glPush(P.arrowHead, rodM([x, 18, y], [x + (ux / L) * 4, 18, y + (uy / L) * 4], 2));
  }
  const n = ISC.npc;
  if (n && !n.gone) npcGL(n);
}
/* Caçador no acampamento olha para o herói (armasGLPush chama) */
export function campNpcGL() {
  const d = dungeon;
  if (d.camp && ISC.campNpc) {
    const n = ISC.campNpc;
    n.yaw = Math.atan2(d.py - n.y, d.px - n.x) * 0.3 + (Math.PI / 2) * 0.7;
    npcGL(n);
  }
}

export function introSetup() {
  /* v6.5 */
  ISC.shots = 0;
  ISC.esq = 0;
  const d = dungeon,
    T = d.tile;
  d.camLenta = undefined;
  d.mode = "intro";
  d.flow = "intro";
  d.banner = null;
  d.birds = [];
  d.birdQ = [];
  d.monsters = [];
  d.loot = [];
  for (const r of d.runes || [])
    if (r._m) {
      try {
        glFree(r._m.patch);
        glFree(r._m.glyph);
      } catch (_) {}
    }
  d.runes = [];
  d.spears = [];
  d.spearOut = null;
  d.px = T * 4;
  d.py = (d.rows * T) / 2;
  if (d.weapon !== "bow") {
    try {
      switchWeapon();
    } catch (_) {}
  }
  d.weapon = "bow";
  for (let i = 0; i < 6; i++)
    d.loot.push({
      key: ["erva", "galho", "pedra"][i % 3],
      x: T * (6 + Math.random() * (d.cols - 9)),
      y: T * (1.6 + Math.random() * (d.rows - 3.2)),
      ground: true,
      t: 0,
      ttl: 0,
    });
  Object.assign(ISC, {
    on: true,
    ph: "cine",
    t: 0,
    rescueAt: 0,
    noArrowSaid: 0,
    lock: null,
    npc: null,
    corpse: null,
    arrow: null,
    boar: null,
    hits: 0,
    last: performance.now(),
    q0: econ.quiver.n,
    moved0: { x: d.px, y: d.py },
  });
  d.modalOpen = true;
  GL3.sceneKey = "";
  introUi();
  requestAnimationFrame(introLoop);
}
/* --- laço da cena (roda mesmo com o jogo pausado no diálogo) --- */
function introLoop() {
  if (!ISC.on) return;
  const d = dungeon;
  if (!d.active || d.mode !== "intro") {
    introEnd(true);
    return;
  }
  const now = performance.now(),
    dt = Math.min(0.25, (now - ISC.last) / 1000);
  ISC.last = now;
  ISC.t += dt;
  const T = d.tile;
  try {
    introStep(dt, T);
    npcStep(dt);
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(introLoop);
}
export function introGo(ph: string) {
  ISC.ph = ph;
  ISC.t = 0;
}
function introStep(dt: number, T: number) {
  const d = dungeon,
    ph = ISC.ph;
  if (d.modalOpen && d.shake! > 0) d.shake = Math.max(0, d.shake! - dt * 2);
  if (ph === "cine") {
    if (ISC.t > 3.4) {
      d.modalOpen = false;
      introCine(false);
      introObj("Explore a floresta", MOB.on ? "joystick à esquerda para andar" : "WASD para andar");
      introGo("explore");
    }
    return;
  }
  if (ph === "explore") {
    if (ISC.t > 7 || (Math.hypot(d.px - ISC.moved0!.x, d.py - ISC.moved0!.y) > T * 3 && ISC.t > 3)) {
      ISC.boar0 = { wind: BOAR.wind.slice(), speed: BOAR.speed };
      ISC.boar0.cd = BOAR.cd.slice();
      BOAR.wind = ISC_BOAR.mira.slice();
      BOAR.speed = ISC_BOAR.vel;
      BOAR.cd = ISC_BOAR.pausa.slice();
      const m = spawnJavalino(1);
      m.intro = true;
      m.name = "Javali Alfa";
      m.big = ISC_BOAR.tam;
      m.spd! *= 1.1;
      ISC.gotHit = 0;
      ISC.hitT = 0;
      m.x = Math.min(d.cols * T - T * 1.5, d.px + T * 7);
      m.y = d.py + (Math.random() - 0.5) * T * 2;
      m.alerted = true;
      m.st = "chase";
      ISC.boar = m;
      ISC.hits = 0;
      sfx("guardbreak");
      introObj(
        "🐗 Um javali! Atire com o arco",
        MOB.on
          ? "segure ⚔ para puxar e solte para atirar"
          : "segure o botão DIREITO para puxar, solte para atirar · a linha mostra a investida",
      );
      introGo("boar");
    }
    return;
  }
  if (ph === "boar") {
    const m = ISC.boar;
    if (!m || !m.alive) {
      introGo("rescue");
      return;
    }
    const dist = Math.hypot(m.x - d.px, m.y - d.py);
    const out = econ.quiver.n <= 0 && !d.arrows!.length;
    if (out && !ISC.noArrowSaid) {
      ISC.noArrowSaid = 1;
      introObj("🏹 Sem flechas!", "ele é rápido demais…");
      spawnDungeonToast("🏹 SEM FLECHAS!", d.px, d.py - 50, "#ff8a6a", 18);
      sfx("guardbreak");
    }
    /* v8.0 — a lição do rolamento (ISC_ESQUIVA): a 1ª investida que ia acertar desacelera o tempo e pede o rolamento */
    const E = ISC_ESQUIVA,
      licao = ISC.esq === 1 || ISC.esq === 2;
    if (!ISC.esq && !ISC.gotHit && m.st === "charge" && dist < T * E.aviso) {
      ISC.esq = 1;
      d.camLenta = E.lenta;
    }
    if (ISC.esq === 1) {
      if (d.dodge) {
        ISC.esq = 2;
        ISC.esqT = 0;
        d.camLenta = E.rolando;
        telaEsquiva(false);
        spawnDungeonToast("💨 Esquivou!", d.px, d.py - 46, "#bfe8ff", 16);
      } else if (dist < T * E.perto && d.camLenta !== 0) {
        d.camLenta = 0; // perto: o tempo congela até ela rolar
        introObj("", ""); // o objetivo do arco ficava por trás da tela
        telaEsquiva(true);
        sfx("guardbreak");
      } else if (m.st !== "charge" && d.camLenta !== 0) {
        ISC.esq = 0; // a investida passou longe antes de chegar perto: a lição espera a próxima
        d.camLenta = undefined;
      }
    } else if (ISC.esq === 2) {
      ISC.esqT! += dt;
      d.camLenta = Math.min(1, E.rolando + ((1 - E.rolando) * ISC.esqT!) / E.volta);
      if (ISC.esqT! >= E.volta) {
        ISC.esq = 3;
        d.camLenta = undefined;
        introObj("🐗 Ele vai investir de novo", "atire enquanto ele se vira · ESPAÇO rola");
      }
    }
    if (m.st === "charge" && !licao) {
      d.rollGuard = 0;
      d.gingaGuard = 0;
      d.invuln = 0;
      d.dodgeGuard = 0;
      if (!m.hit) {
        const want = Math.atan2(d.py - m.y, d.px - m.x);
        m.ang! +=
          Math.max(-1, Math.min(1, Math.atan2(Math.sin(want - m.ang!), Math.cos(want - m.ang!)))) *
          Math.min(1, dt * ISC_BOAR.curva);
      }
    }
    // v8.0: depois do primeiro golpe, o Caçador chega antes do segundo (na próxima preparação ou investida)
    if (ISC.gotHit && !ISC.rescueAt && (m.st === "bwind" || m.st === "charge")) ISC.rescueAt = ISC.t + 0.3;
    if (ISC.rescueAt && ISC.t >= ISC.rescueAt) {
      introRescue();
      return;
    }
    if (m.st === "wander" || m.st === "idle") {
      m.st = "chase";
      m.target = null;
    }
    if (m.st === "chase" && m.bcd! <= 0 && dist > T * 1.2) {
      m.st = "bwind";
      m.t = ISC_BOAR.mira[0] + Math.random() * (ISC_BOAR.mira[1] - ISC_BOAR.mira[0]);
      m.ang = Math.atan2(d.py - m.y, d.px - m.x);
      addRing(m.x, m.y, "#ffd27a", 30, 0.35, 3);
    }
    if (ISC.t > 120) introRescue();
    return;
  }
  if (ph === "rescue") {
    const A = ISC.arrow;
    if (A) {
      A.k = Math.min(1, A.k + dt / 0.32);
      if (A.k >= 1 && !A.hit) {
        A.hit = true;
        introBoarDies();
      }
    }
    if (ISC.t > 1.3 && !ISC.npc!.came) {
      ISC.npc!.came = true;
      ISC.npc!.go = { x: d.px + T * 1.9, y: d.py };
    }
    if (ISC.npc!.came && !ISC.npc!.go && ISC.t > 1.6) {
      introGo("talk");
      introTalk1();
    }
    return;
  }
  if (ph === "gather") {
    const h = d.hero!,
      g = itemCnt(h, "galho"),
      s = resCount(h, "stone");
    introObj("Junte galhos e pedras (E)", "🪵 " + Math.min(g, 2) + "/2 · 🪨 " + Math.min(s, 1) + "/1");
    if (g >= 2 && s >= 1) {
      introObj("", "");
      introGo("talk");
      say(
        [["Isso. Agora presta atenção.", "Galho vira haste, a pedra vira ponta. Se tiver pena, a flecha voa reta."]],
        () => arrowCraftOpen(),
      );
    }
    return;
  }
  if (ph === "herb") {
    const d2 = dungeon;
    if (
      itemCnt(d2.hero!, "erva") < ISC.herb0! ||
      d2.hp > ISC.hp0! + 2 ||
      (ISC.herbTry && ISC.t > 1.2) ||
      (d2.hp >= d2.hpMax * 0.97 && !(d2.wound! > 0.5))
    ) {
      introObj("", "");
      introGo("talk");
      setTimeout(introTalkArrows, 1400);
    } else if (ISC.t > 12) {
      introObj("", "");
      introGo("talk");
      introTalkArrows();
    }
    return;
  }
  if (ph === "craft") return;
}
export function itemCnt(h: Hero, k: string) {
  let n = 0;
  for (const inv of [ensureInv(h), qvInv(h)]) for (const it of inv.items) if (it.def.key === k) n += it.n || 1;
  return n;
}
export function itemTakeH(h: Hero, k: string, n: number) {
  for (const inv of [ensureInv(h), qvInv(h)])
    for (let i = inv.items.length - 1; i >= 0 && n > 0; i--) {
      const it = inv.items[i];
      if (it.def.key !== k) continue;
      const c = it.n || 1;
      if (c > n) {
        it.n = c - n;
        n = 0;
      } else {
        inv.items.splice(i, 1);
        n -= c;
      }
    }
  return n <= 0;
}
/* --- o resgate: flecha de fora da tela, javali cai, aparece o Caçador --- */
function introRescue() {
  const d = dungeon,
    T = d.tile,
    m = ISC.boar;
  if (!m) return;
  ISC.lock = null;
  ISC.rescueAt = 0;
  ISC.esq = 3;
  d.camLenta = undefined;
  telaEsquiva(false);
  if (ISC.boar0) {
    BOAR.wind = ISC.boar0.wind;
    BOAR.speed = ISC.boar0.speed;
    if (ISC.boar0.cd) BOAR.cd = ISC.boar0.cd;
    ISC.boar0 = null;
  }
  d.modalOpen = true;
  d.charging = false;
  d.guard = false;
  const ax = m.x - d.px,
    ay = m.y - d.py,
    L = Math.hypot(ax, ay) || 1,
    ux = ax / L,
    uy = ay / L,
    side = uy > 0 ? -1 : 1;
  const hx = m.x + ux * T * 6 - uy * side * T * 4,
    hy = m.y + uy * T * 6 + ux * side * T * 4;
  const W = d.cols * T,
    H = d.rows * T,
    sx = Math.max(-T * 2, Math.min(W + T * 2, hx)),
    sy = Math.max(-T * 1, Math.min(H + T, hy));
  ISC.arrow = { x0: sx, y0: sy, x1: m.x, y1: m.y, k: 0 };
  ISC.npc = { x: sx, y: sy, yaw: Math.atan2(m.y - sy, m.x - sx), ph: 0, aim: 1, carry: false, came: false };
  sfx("shoot");
  introObj("", "");
  introGo("rescue");
}
function introBoarDies() {
  const d = dungeon,
    m = ISC.boar;
  if (!m) return;
  m.alive = false;
  m.hp = 0;
  ISC.corpse = { x: m.x, y: m.y, yaw: m._yaw || 0, gem: false };
  d.monsters = d.monsters.filter((o) => o !== m);
  sfx("guardbreak");
  setTimeout(() => sfx("perfect"), 120);
  d.fx!.push({ x: m.x, y: m.y, life: 0.45 });
  addRing(m.x, m.y, "#ffffff", 50, 0.4, 3);
  spawnDungeonToast("💥", m.x, m.y - 30, "#fff", 26);
  ISC.npc!.aim = 0;
}
/* --- NPC: anda até o alvo, olha, carrega o javali --- */
function npcStep(dt: number) {
  const n = ISC.npc,
    d = dungeon;
  if (!n) return;
  if (n.go) {
    const dx = n.go.x - n.x,
      dy = n.go.y - n.y,
      L = Math.hypot(dx, dy);
    if (L < 3) {
      n.go = null;
      if (n.onArrive) {
        const f = n.onArrive;
        n.onArrive = null;
        f();
      }
    } else {
      const sp = (n.carry ? 90 : 135) * dt;
      n.x += (dx / L) * Math.min(sp, L);
      n.y += (dy / L) * Math.min(sp, L);
      n.yaw = Math.atan2(dy, dx);
      n.ph += dt * 9;
    }
  } else {
    const want = n.look ? Math.atan2(n.look.y - n.y, n.look.x - n.x) : Math.atan2(d.py - n.y, d.px - n.x);
    n.yaw += Math.atan2(Math.sin(want - n.yaw), Math.cos(want - n.yaw)) * Math.min(1, dt * 8);
  }
  if (n.carry && ISC.corpse) {
    ISC.corpse.x = n.x;
    ISC.corpse.y = n.y;
  }
  if (ISC.ph === "talk" || ISC.ph === "rescue") d.mouse = { x: n.x, y: n.y };
}
/* --- diálogos --- */
export function say(pages: PaginaFala[], done: () => void, quem?: { nome: string; ava: string }) {
  /* v7.7 — a fala fecha a mochila: com as duas abertas o jogo travava (a fala não avança com a mochila aberta e
     a mochila não fechava com a fala na tela) */
  if (dungeon.invOpen) toggleInv(false);
  /* v7.7 — campanha: quem fala (nome e rosto); sem `quem` é o Caçador, como sempre foi */
  {
    const b = document.querySelector("#isc-dlg .idl-who b"),
      a = document.querySelector("#isc-dlg .idl-ava");
    if (b) b.textContent = quem ? quem.nome : "Caçador";
    if (a) a.textContent = quem ? quem.ava : "🏹";
  }
  /* v7.7 — o botão Pular só aparece quando há o que pular: a introdução ou o tutorial do acampamento */
  {
    const sk = document.getElementById("isc-skip");
    if (sk) {
      sk.style.display = ISC.on || ctAtivo() ? "" : "none";
      sk.textContent = ISC.on ? "Pular introdução ⏭" : "Pular tutorial ⏭";
    }
  }
  ISC.dlg = { pages, i: 0, j: 0, done, t0: performance.now() };
  dungeon.modalOpen = true;
  dlgRender();
}
export function dlgAdvance() {
  /* v6.5 — diálogo: toque fora só avança se não houver outra janela aberta por cima */
  if (document.querySelector("#camp-modal.open, #fire-modal.open, #inv-modal.open")) return;
  const D = ISC.dlg;
  if (!D) return;
  const P = D.pages[D.i];
  const full = P[D.j];
  const el = document.getElementById("isc-text");
  if (el && el._typing) {
    el._typing = false;
    el.textContent = full;
    return;
  }
  if (P[D.j + 1] != null) D.j++;
  else if (D.pages[D.i + 1]) {
    D.i++;
    D.j = 0;
  } else {
    ISC.dlg = null;
    const box = document.getElementById("isc-dlg");
    if (box) box.classList.remove("on");
    dungeon.modalOpen = false;
    if (D.done) D.done();
    return;
  }
  if (D.pages[D.i].act && D.j === 0 && !D.pages[D.i]._did) {
    D.pages[D.i]._did = 1;
    D.pages[D.i].act!();
  }
  dlgRender();
}
function dlgRender() {
  const D = ISC.dlg,
    box = document.getElementById("isc-dlg");
  if (!D || !box) return;
  const P = D.pages[D.i];
  if (P.act && !P._did) {
    P._did = 1;
    P.act();
  }
  const txt = P[D.j];
  box.classList.add("on");
  const el = document.getElementById("isc-text")!;
  el.textContent = "";
  el._typing = true;
  let k = 0;
  sfx("ping");
  const ty = () => {
    if (!el._typing || ISC.dlg !== D) return;
    k += 2;
    el.textContent = txt.slice(0, k);
    if (k >= txt.length) {
      el._typing = false;
      return;
    }
    setTimeout(ty, 28);
  };
  ty();
}
function introTalk1() {
  say(
    [
      ["Olá, forasteiro.", "Vejo que veio se aventurar por essas terras… mas parece ser novato."],
      [
        "Três flechas contra um javali adulto? Coragem não te falta.",
        "Sorte sua que eu estava caçando por perto. A segunda investida ia te quebrar ao meio.",
      ],
      ["É perigoso andar por aqui sem flechas e sem saber o que está fazendo."],
      {
        0: "Você levou uma bela pancada. Tome, mastigue esta erva.",
        1: "Ela fecha o ferimento aos poucos.",
        act: () => {
          const h = dungeon.hero!;
          for (let i = 0; i < 2; i++) tryAddItem(h, "erva");
          spawnDungeonToast("+2 🌿 Erva", dungeon.px, dungeon.py - 46, "#9fe38a", 14);
        },
      },
    ],
    () => {
      ISC.herb0 = itemCnt(dungeon.hero!, "erva");
      ISC.herbTry = 0;
      ISC.hp0 = dungeon.hp;
      introObj("🌿 Use a erva para se curar", MOB.on ? "botão 🌿 erva" : "tecla H");
      introGo("herb");
    },
  );
}
function introTalkArrows() {
  say(
    [
      ["Melhor? Erva é coisa que você sempre deve ter na mochila."],
      ["Agora presta atenção, que flecha não cai do céu.", "Pega uns galhos e uma pedra aí no chão."],
    ],
    () => {
      introSpawnMats();
      introGo("gather");
    },
  );
}
function introSpawnMats() {
  const d = dungeon,
    T = d.tile;
  const put = (k: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283,
        r = T * (1.6 + Math.random() * 2.2);
      d.loot!.push({
        key: k,
        x: Math.max(T, Math.min(d.cols * T - T, d.px + Math.cos(a) * r)),
        y: Math.max(T, Math.min(d.rows * T - T, d.py + Math.sin(a) * r)),
        ground: true,
        t: 0,
        ttl: 0,
        introMat: true,
      });
    }
  };
  put("galho", 4);
  put("pedra", 3);
  put("pena", 2);
}
/* --- fazer flechas com o Caçador (prático: lascar → encaixar → amarrar) --- */
function arrowCraftOpen() {
  introGo("craft");
  let m = document.getElementById("isc-craft");
  if (!m) {
    m = document.createElement("div");
    m.id = "isc-craft";
    document.getElementById("dungeon-view")!.appendChild(m);
  }
  dungeon.modalOpen = true;
  ISC.ac = { step: 0, made: 0 };
  arrowCraftRender();
  m.classList.add("on");
}
export function arrowCraftRender(msg?: string) {
  // reescrita na v6.5
  const m = document.getElementById("isc-craft"),
    h = dungeon.hero!,
    A = ISC.ac;
  if (!m || !A) return;
  const g = itemCnt(h, "galho"),
    s = resCount(h, "stone"),
    p = resCount(h, "feather"),
    can = g >= 1 && s >= 1;
  const st = ["🪨 Lascar a pedra", "🪵 Encaixar na haste", p > 0 ? "🪶 Amarrar a pena" : "🧵 Amarrar com fibra"];
  m.innerHTML =
    "<div class='ic-card'><div class='ic-h'><b>🏹 Fazer flechas</b><small>com o Caçador</small></div><div class='ic-rec'><span>🪵 1 galho</span>+<span>🪨 1 pedra</span>" +
    (p > 0 ? "+<span>🪶 pena (opcional)</span>" : "") +
    "→<b>🏹 " +
    (p > 0 ? 3 : 2) +
    " flechas</b></div>" +
    "<div class='ic-have'>Você tem: 🪵 " +
    g +
    " · 🪨 " +
    s +
    " · 🪶 " +
    p +
    " · aljava 🏹 " +
    econ.quiver.n +
    "</div>" +
    "<div class='ich-stages'>" +
    st.map((t, i) => "<span data-stg='" + i + "'>" + t + "</span>").join("") +
    "</div><div class='ich-bar'><i id='ich-fill'></i></div>" +
    "<button class='btn pri ich-hold' id='ich-hold'" +
    (can ? "" : " disabled") +
    ">" +
    // v8.1 — o arco em meio círculo (Tinta e Cinza): só aparece com html.hud-traco; enche com --p, marcas nas etapas
    "<svg class='ich-arco' viewBox='0 0 120 66' aria-hidden='true'><path class='f' d='M10 60A50 50 0 0 1 110 60' pathLength='100'/>" +
    "<path class='p' d='M10 60A50 50 0 0 1 110 60' pathLength='100'/><line x1='35' y1='16.7' x2='32' y2='11.5'/><line x1='85' y1='16.7' x2='88' y2='11.5'/></svg>" +
    "<span class='ich-ico'>🏹</span><span class='ich-rot'>" +
    (can ? "✋ Segure para fazer" : "Faltam materiais") +
    "</span></button>" +
    (msg ? "<div class='ic-msg'>" + msg + "</div>" : "") +
    "<div class='ic-foot'>" +
    (A.made ? "<button class='btn' data-ic='ok'>Pronto</button>" : "") +
    "</div></div>";
  // a barra (largura) e o arco (--p) mostram o mesmo progresso
  const pinta = () => {
    const f = m.querySelector("#ich-fill") as HTMLElement;
    if (f) f.style.width = (A.k || 0) * 100 + "%";
    m.style.setProperty("--p", String(A.k || 0));
  };
  pinta();
  const b = m.querySelector<HTMLElement>("#ich-hold");
  if (!b || !can) return;
  let raf = 0,
    last = 0;
  const loop = (now: number) => {
    if (!A.hold) return;
    const dt = Math.min(0.25, (now - (last || now)) / 1000);
    last = now;
    const k0 = A.k || 0;
    A.k = Math.min(1, k0 + dt / ARROW_HOLD);
    for (const c of [1 / 3, 2 / 3]) if (k0 < c && A.k >= c) sfx(c < 0.5 ? "hitlite" : "swing");
    pinta();
    m.querySelectorAll("[data-stg]").forEach((e, i) =>
      e.classList.toggle("on", A.k! >= (i + 1) / 3 - 1e-6 || A.k! > i / 3),
    );
    if (A.k >= 1) {
      A.hold = false;
      A.k = 0;
      arrowMakeOne();
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  const down = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    A.hold = true;
    last = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };
  const up = () => {
    if (!A.hold) return;
    A.hold = false;
    cancelAnimationFrame(raf);
    const k = A.k || 0;
    const dec = () => {
      A.k = Math.max(0, (A.k || 0) - 0.04);
      pinta();
      if (A.k > 0 && !A.hold) requestAnimationFrame(dec);
    };
    if (k > 0) requestAnimationFrame(dec);
  };
  b.addEventListener("pointerdown", down);
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, up);
}
function introGiveKnife() {
  const d = dungeon,
    h = d.hero!,
    it = mkItem("eq_faca_velha");
  it.q = 0;
  eqDurInit(it);
  // na mochila: o tutorial a analisa pelo 🔍 do item; v7.7: depois de deduzir, ela vai para o cinto (faquinhaNoCinto)
  if (!placeIn(ensureInv(h), it)) {
    const e = ensureEquip(h);
    if (!e.maoD) e.maoD = it;
  }
  GL3.heroKey = "";
  try {
    updateWeaponUI();
  } catch (_) {}
  spawnDungeonToast("🔪 Faca Velha (na mochila)", d.px, d.py - 48, "#ffe08a", 16);
  sfx("perfect");
  pushEvent(
    "🔪 O Caçador deu a " +
      h.name +
      " uma Faca Velha. Sem outra arma, ela é o seu ataque corpo a corpo (Q troca arco ↔ faca).",
  );
}
/** v7.7 — depois da análise (ou ao pular a introdução): a Faca Velha sai da mochila e vai para o cinto, onde ela
    finaliza bichos caídos com E (items/cinto.ts). */
export function faquinhaNoCinto() {
  const h = dungeon.hero;
  if (!h) return;
  const inv = ensureInv(h),
    it = inv.items.find((i) => i.def.key === "eq_faca_velha");
  if (!it) return;
  inv.items.splice(inv.items.indexOf(it), 1);
  if (!prenderSeCouber(h, it)) inv.items.push(it);
}
function introUnlockCamp() {
  econ.hunterCamp = true;
  setBanner(
    "⛺ Acampamento do Caçador",
    "Seu primeiro lugar seguro: preparar, guardar, cozinhar e forjar.",
    4.5,
    "#ffd08a",
  );
}
function introEnd(silent?: boolean) {
  ISC.on = false;
  dungeon.camLenta = undefined;
  telaEsquiva(false);
  econ.introDone = true;
  ["isc-dlg", "isc-cine", "isc-obj", "isc-craft", "isc-ana"].forEach((id) => {
    const e = document.getElementById(id);
    if (e) e.classList.remove("on");
  });
  if (!silent) dungeon.modalOpen = false;
}
export function iscSkip() {
  const d = dungeon,
    h = d.hero!;
  if (!ISC.on) return;
  ISC.dlg = null;
  if (ISC.boar && ISC.boar.alive) {
    ISC.boar.alive = false;
    d.monsters = d.monsters.filter((o) => o !== ISC.boar);
  }
  if (!ensureEquip(h).maoD) introGiveKnife();
  faquinhaNoCinto();
  if (!econ.introDone && econ.quiver.n < 12) econ.quiver.n = 12;
  introUnlockCamp();
  forgeLearn("eq_faca");
  econ.weaponLore = true;
  ISC.npc = null;
  ISC.corpse = null;
  d.flow = "introFree";
  introEnd();
  introObj("", "");
  mvToast("⏭ Introdução pulada");
}
/* --- interface: cinema, objetivo, caixa de diálogo --- */
export function introUi() {
  const v = document.getElementById("dungeon-view")!;
  const mk = (id: string, html: string) => {
    let e = document.getElementById(id);
    if (!e) {
      e = document.createElement("div");
      e.id = id;
      v.appendChild(e);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  mk(
    "isc-cine",
    "<div class='icn-top'></div><div class='icn-bot'></div><div class='icn-cap'><b>Em algum lugar da floresta…</b><span>O ar é frio. Pássaros. Folhas. Nada conhecido.</span></div>",
  ).classList.add("on");
  mk("isc-obj", "<b></b><small></small>");
  const dl = mk(
    "isc-dlg",
    "<div class='idl-who'><span class='idl-ava'>🏹</span><b>Caçador</b></div><div id='isc-text'></div><div class='idl-foot'><small>" +
      "toque em qualquer lugar da tela para continuar" +
      "</small><button class='btn' id='isc-skip'>Pular introdução ⏭</button></div>",
  );
  if (!dl._b) {
    dl._b = 1;
    dl.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "isc-skip") {
        e.stopPropagation();
        if (ISC.on) iscSkip();
        else ctPular(); // v7.7: no acampamento o mesmo botão pula o tutorial dele
        return;
      }
      dlgAdvance();
    });
  }
}
/** v8.0 — a tela da lição do rolamento (ISC_ESQUIVA), no meio do campo, com o tempo congelado. */
function telaEsquiva(on: boolean) {
  const v = document.getElementById("dungeon-view");
  let el = document.getElementById("isc-esq");
  if (!el && on && v) {
    el = document.createElement("div");
    el.id = "isc-esq";
    v.appendChild(el);
  }
  if (!el) return;
  if (on)
    el.innerHTML = MOB.on
      ? "<b>Toque <kbd>🤸</kbd> para desviar</b><small>o javali vai te acertar</small>"
      : "<b>Aperte <kbd>ESPAÇO</kbd> para desviar</b><small>o javali vai te acertar</small>";
  el.classList.toggle("on", on);
}
function introCine(on: boolean) {
  const e = document.getElementById("isc-cine");
  if (e) e.classList.toggle("on", on);
}
export function introObj(t: string, s: string) {
  const e = document.getElementById("isc-obj");
  if (!e) return;
  e.querySelector("b")!.textContent = t;
  e.querySelector("small")!.textContent = s || "";
  e.classList.toggle("on", !!t);
}

/* ---------- FIM DA CENA INICIAL → MAPA, um pouco longe do acampamento ---------- */
export function introToMap() {
  // reescrita na v6.5
  if (ISC._toMap) return;
  ISC._toMap = true;
  econ.campTut = 1;
  campanhaEvento("introFim");
  const h = dungeon.hero;
  try {
    introObj("", "");
  } catch (_) {}
  if (h && caminhadaIni(h)) return; // v8.0: o campo continua e ela anda até a base (intro/caminhada.ts)
  exitDungeon();
  setTimeout(() => {
    try {
      const H = h && world.heroes.includes(h) ? h : world.heroes[0];
      if (!H || !H.camp) return;
      const p = snapToLand(H.camp.x + 6, H.camp.y + 78) || { x: H.camp.x, y: H.camp.y + 40 };
      H.x = p.x;
      H.y = p.y;
      H.state = "field";
      MAPCTL.sel = H.id;
      updateHeroPanelUI();
      setTimeout(() => {
        jogoEnter();
        setTimeout(() => {
          try {
            setBanner(
              "🌲 Campo",
              (MOB.on ? "pinça para fora" : "role o mouse para trás") +
                " para abrir o mapa · o acampamento fica ao norte",
              7,
              "#9fe38a",
            );
          } catch (_) {}
        }, 1600);
      }, 500);
    } catch (e) {
      console.warn(e);
    }
  }, 1000);
}

export function introStart(h: Hero) {
  if (!h) return;
  ensureHero(h);
  const e = ensureEquip(h);
  for (const k of ["maoD", "maoE"]) {
    const it = e[k];
    if (it) {
      if (world.heroes.length > 1 || econ._introKeep) placeIn(econ.stash, it);
      e[k] = null;
    }
  }
  econ.quiver.n = 3;
  econ.arrowStock = 0;
  ISC.pending = true;
  ISC.h = h;
  launchDungeon(h.id);
}
export function introTalk2() {
  const n = ISC.npc!;
  say(
    [
      ["Viu? Flecha não cai do céu. Galho, pedra, pena… tudo isso está no chão, esperando alguém pegar."],
      ["Sou um caçador.", "Estou acampando aqui há meses."],
      ["Ouvi dizer que uma Runa Natural apareceu por aqui.", "Muita gente acha que é só boato."],
      ["Mas eu acho que é real.", "Tem algo diferente nesta floresta."],
    ],
    () => {
      n.go = { x: ISC.corpse!.x - dungeon.tile * 0.9, y: ISC.corpse!.y };
      n.onArrive = () => {
        n.look = { x: ISC.corpse!.x, y: ISC.corpse!.y };
        ISC.gemShow = performance.now();
        setTimeout(introTalk3, 500);
      };
    },
  );
}
function introTalk3() {
  const n = ISC.npc;
  say(
    [
      ["Esse aqui é um javali comum.", "Carne, couro, presas… já dá um dinheirinho."],
      [
        "Agora… sabe as Runas Selvagens?",
        "São bichos que pisaram numa Runa Natural e mudaram. Essas sim são bem rentáveis.",
      ],
      [
        "Dizem que aparecem joias cravadas no corpo delas…",
        "…como se fossem furúnculos. Bicho comum assim não tem disso.",
      ],
      {
        0: "Esse aqui vai virar janta e couro.",
        act: () => {
          n!.carry = true;
          n!.look = null;
          sfx("swing");
        },
      },
    ],
    () => {
      n!.go = { x: dungeon.px + dungeon.tile * 1.7, y: dungeon.py };
      n!.onArrive = () => setTimeout(introTalk4, 300);
    },
  );
}
function introTalk4() {
  // reescrita na v6.5
  say(
    [
      { 0: "Tome.", act: () => introGiveKnife() },
      ["Quando ficar sem flechas, use isso.", "Pode ficar. É um presente para os novatos."],
      ["Tenho um acampamento montado ali.", "Se quiser, pode ir para lá."],
      ["Ah, e repara bem nessa faca.", "Dá pra aprender muita coisa só olhando como algo foi feito."],
    ],
    () => {
      introUnlockCamp();
      ISC.anaInv = true;
      try {
        toggleInv(true);
      } catch (_) {}
      introObj(
        "🔍 Abra a Faca Velha na mochila",
        MOB.on ? "toque no 🔍 da faca" : "passe o mouse na faca e clique em 🔍 Analisar",
      );
    },
  );
}
/* --- ANALISAR a faca --- */
export function knifeAnalyzeOpen() {
  let m = document.getElementById("isc-ana");
  if (!m) {
    m = document.createElement("div");
    m.id = "isc-ana";
    document.getElementById("dungeon-view")!.appendChild(m);
  }
  dungeon.modalOpen = true;
  ISC.ana = 0;
  knifeAnalyzeRender();
  m.classList.add("on");
}
export function knifeAnalyzeRender() {
  const m = document.getElementById("isc-ana"),
    n = ISC.ana!;
  if (!m) return;
  const done = n >= KNIFE_OBS.length;
  m.innerHTML =
    "<div class='ic-card'><div class='ic-h'><b>🔍 Analisar: Faca Velha</b><small>analise cada parte</small></div><div class='ia-knife'>🔪</div>" +
    "<div class='ia-list'>" +
    KNIFE_OBS.map(
      (o, i) =>
        "<div class='ia-o" +
        (i < n ? " on" : "") +
        "'><b>" +
        (i < n ? o[0] : "❓ ???") +
        "</b><span>" +
        (i < n ? o[1] : "") +
        "</span></div>",
    ).join("") +
    "</div>" +
    (done
      ? "<div class='ic-msg'>Você começa a entender como essa arma foi construída.</div><div class='ic-foot'><button class='btn pri' data-ia='learn'>📖 Deduzir: como fazer uma faca</button></div>"
      : "<div class='ic-foot'><button class='btn pri' data-ia='look'>🔍 Analisar (" +
        n +
        "/" +
        KNIFE_OBS.length +
        ")</button></div>") +
    "</div>";
}
export function introOutro() {
  const n = ISC.npc!,
    d = dungeon,
    T = d.tile;
  n.go = { x: d.entrance ? d.entrance.x : T, y: d.entrance ? d.entrance.y : d.py };
  n.onArrive = () => {
    n.gone = true;
    ISC.corpse = null;
    addRing(n.x, n.y, "#7dff9a", 30, 0.4, 3);
    introObj("🌿 Explore à vontade", "quando quiser seguir, saia pela moita da entrada (E)");
  };
  introObj("O Caçador foi na frente", "logo você também sai da floresta…");
  econ.introDone = true;
  d.flow = "introFree";
  setTimeout(() => {
    if (ISC.npc && !ISC.npc.gone) {
      ISC.npc.gone = true;
      ISC.corpse = null;
      introObj("🌿 Explore à vontade", "quando quiser seguir, saia pela moita da entrada (E)");
    }
  }, 12000);
  pushEvent("🍃 O Caçador falou de uma Runa Natural nesta região. Ninguém sabe onde…");
}
/* 2D (sem 3D) e marcador do Caçador */
/* cena inicial no 2D: nome do Caçador, corpo, brilho da gema (armasDraw2D chama) */
export function introDraw2D() {
  const d = dungeon,
    c = TELAS.dCtx;
  if (d.mode !== "intro") return;
  const n = ISC.npc,
    t = performance.now() / 1000;
  if (n && !n.gone) {
    c.save();
    c.font = "600 11px Lora,serif";
    c.textAlign = "center";
    // v8.0: contorno em vez da faixa de fundo (no 3D a faixa ia para o chão e cobria a cabeça dele)
    c.lineJoin = "round";
    c.lineWidth = 3;
    c.strokeStyle = "rgba(30,20,8,.85)";
    c.strokeText("Caçador", n.x, n.y - 55);
    c.fillStyle = "#ffe08a";
    c.fillText("Caçador", n.x, n.y - 55);
    c.restore();
  }
  if (!D3.gl && n && !n.gone) {
    c.save();
    c.fillStyle = "#6b7a3c";
    c.beginPath();
    c.arc(n.x, n.y, 11, 0, 6.283);
    c.fill();
    c.restore();
  }
  if (!D3.gl && ISC.corpse) {
    c.save();
    c.fillStyle = "#5a4636";
    c.beginPath();
    c.ellipse(ISC.corpse.x, ISC.corpse.y, 16, 9, 0, 0, 6.283);
    c.fill();
    c.restore();
  }
  if (ISC.corpse && ISC.gemShow && performance.now() - ISC.gemShow < 6000 && !(n && n.carry)) {
    const C = ISC.corpse;
    c.save();
    c.strokeStyle = "rgba(255,90,100," + (0.5 + 0.5 * Math.sin(t * 6)) + ")";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(C.x + 3, C.y, 13 + Math.sin(t * 6) * 2, 0, 6.283);
    c.stroke();
    c.restore();
  }
}
/* --- no acampamento: o Caçador fica perto da fogueira e conversa --- */
export function campTalk(lines: string[]) {
  const dl = document.getElementById("isc-dlg");
  if (!dl) {
    introUi();
    document.getElementById("isc-cine")!.classList.remove("on");
  }
  say([lines], () => {});
}
export function mapTip(t: string) {
  let el = document.getElementById("map-tip");
  if (!el) {
    el = document.createElement("div");
    el.id = "map-tip";
    document.getElementById("viewport")!.appendChild(el);
  }
  el.textContent = t;
  el.classList.add("on");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("on"), 7000);
}
