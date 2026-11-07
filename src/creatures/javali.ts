/* ==== Fase 4 — javali: o modelo, a investida e o golpe (v4.4, v5.8) ==== */
import { MALHA, M4 } from "../render/gl/geometria.ts";
import { MB, mbIco, mbBox, mbCyl, glMesh } from "../render/gl/malhas.ts";
import { spawnDungeonMonster, spawnDungeonToast, dSafe } from "../field/masmorra.ts";
import { dungeon, TELAS } from "../core/state.ts";
import { sfx, shakeScreen, addRing, knockApart, addSwordPts, dungeonDeath } from "../field/chao.ts";
import { BOAR, BOAR_ARVORE, BOAR_DERRUBA } from "../data/especies.ts";
import { folCansar } from "../field/tipos.ts";
import { linhaLivre } from "../map/mundo.ts";
import { bleedTick, applyStun, applySlow, hurtPlayer } from "../field/combate.ts";
import { DMG } from "../field/dano.ts";
import { aimAngle } from "../field/acertos.ts";
import { ensureEquip, armorRed } from "../items/equipamento.ts";
import { eqBlockMult, eqWear, eqWearArmor } from "../items/durabilidade.ts";
import { attrOf } from "../hero/atributos.ts";
import { STAT } from "../data/atributos.ts";
import type { Monster, Repasse } from "../core/tipos.ts";

/* =====================================================================
   FAUNA DO CANON — JAVALINO na masmorra (a partir da 2ª horda):
   mais vida, investe em linha reta com frequência (o "bote" dele é uma
   carga). Também pode tocar uma runa e virar Javalino Rúnico.
===================================================================== */
export function glBuildBoarBase() {
  MALHA._gs = 515;
  const fur = "#5a4636",
    dark = "#3a2c22",
    snout = "#c99a8a",
    tusk = "#efe6cf",
    b = MB();
  mbIco(b, M4.ch(M4.T(-1, 13.5, 0), M4.S(27, 15, 15.5)), fur, 0, 0.14, 0.1);
  mbIco(b, M4.ch(M4.T(7, 15, 0), M4.S(15, 16, 15.5)), fur, 0, 0.15, 0.1);
  mbBox(b, M4.ch(M4.T(15, 12.5, 0), M4.RZ(-0.35), M4.S(10, 10, 9.5)), fur, 0.8, 0.1);
  mbBox(b, M4.ch(M4.T(21, 9.5, 0), M4.RZ(-0.25), M4.S(7.5, 6, 6.5)), dark, 0.85, 0.1);
  mbBox(b, M4.ch(M4.T(24.8, 8.6, 0), M4.S(1.6, 4.6, 5.2)), snout);
  for (const s of [1, -1]) {
    mbBox(b, M4.ch(M4.T(17.6, 15.4, s * 3.1), M4.S(1.2, 1.1, 1.1)), "#1a0f08");
    mbCyl(b, M4.ch(M4.T(13, 18.5, s * 3.6), M4.RX(s * 0.5), M4.RZ(-0.2), M4.S(3, 4.5, 2.2)), dark, 3, 0, 0.1);
    mbCyl(b, M4.ch(M4.T(22.5, 7, s * 3.4), M4.RZ(-0.75), M4.RX(-s * 0.35), M4.S(1.3, 5.5, 1.3)), tusk, 4, 0);
  }
  for (let i = 0; i < 6; i++)
    mbCyl(
      b,
      M4.ch(M4.T(-10 + i * 3.8, 19.8 - (i > 3 ? 0.6 : 0), 0), M4.RZ(0.5), M4.S(3.4, 5 + (i % 2) * 2, 3)),
      dark,
      4,
      0,
      0.1,
    );
  mbCyl(b, M4.ch(M4.T(-15, 14, 0), M4.RZ(2.3), M4.S(1.4, 6, 1.4)), dark, 4, 0, 0.1);
  const l = MB();
  mbBox(l, M4.ch(M4.T(0, -5.5, 0), M4.S(4.2, 11, 4.2)), fur, 0.85, 0.1);
  mbBox(l, M4.ch(M4.T(0.6, -10.6, 0), M4.S(4.6, 1.8, 4.2)), "#241a12", 1, 0.1);
  return { body: glMesh(b), leg: glMesh(l) };
}

export function spawnJavalino(n: number) {
  const m = spawnDungeonMonster({ hpMult: 1 + (n - 1) * 0.15 });
  Object.assign(m, {
    kind: "javalino",
    name: "Javalino",
    hpMax: Math.round(m.hpMax * 1.8),
    dm: 1.25,
    wu: 0.85,
    spd: m.spd! * 0.85,
    pcd: 1.4,
  });
  m.hp = m.hpMax;
  return m;
}

/* ---- JAVALI na masmorra: investida que derruba ----
   telegrafa (raspa o chão e mira) → dispara em linha reta. Esquivar (rolar/esquiva da lança) passa por ele;
   escudo de frente bloqueia (gasta muito fôlego); parry no tempo certo atordoa o javali.
   Se acertar: derruba o herói (BOAR_DERRUBA.t s sem agir; era 1,1 s) e deixa TONTO por 5 s (anda 35% mais devagar e
   ataca mais devagar). Com ela caída, ele não começa outra investida. */
export function boarAI(m: Monster, dt: number) {
  if (!m.alive) return;
  const d = dungeon,
    T = d.tile;
  if (m.flash! > 0) m.flash! -= dt;
  if (m.kx || m.ky) {
    m.x = Math.max(T, Math.min(d.cols * T - T, m.x + m.kx! * dt));
    m.y = Math.max(T, Math.min(d.rows * T - T, m.y + m.ky! * dt));
    const f = Math.exp(-9 * dt);
    m.kx! *= f;
    m.ky! *= f;
    if (Math.abs(m.kx!) + Math.abs(m.ky!) < 4) m.kx = m.ky = 0;
  }
  if (m.slow! > 0) m.slow! -= dt;
  if (m.stun! > 0) m.stun! -= dt;
  if (m.bleed) {
    m.bleed.t -= dt;
    if (m.bleed.t <= 0) bleedTick(m);
    if (!m.alive) return;
  }
  const dist = Math.hypot(d.px - m.x, d.py - m.y),
    safe = dSafe();
  m.bcd = (m.bcd == null ? 1.5 : m.bcd) - dt;
  if (m.st === "recover") {
    m.t -= dt;
    if (m.t <= 0) {
      if ((m.investidasErradas || 0) >= 2) {
        m.st = "wander";
        m.acalmarT = 8;
        m.investidasErradas = 0;
      } else m.st = "chase";
      m.stunMax = 0;
    }
    return;
  }
  const pouca = m.alive && m.hp < (m.hpMax || m.maxHp || m.hp) * 0.35,
    fury = pouca || m.desespero! > 0; // v8.1: levantou de uma queda (FOLEGO.desespero): a fúria por uns segundos
  if (pouca && !m.fury) {
    m.fury = 1;
    spawnDungeonToast("😤 Enfurecido!", m.x, m.y - 36, "#ff6a4a", 13);
  }
  if (m.st === "bwind") {
    // raspa o chão e mira: a linha segue você e ninguém sabe quando ele dispara
    m.t -= dt;
    m.ang = Math.atan2(d.py - m.y, d.px - m.x);
    if (Math.random() < dt * 14)
      d.fx!.push({ x: m.x - Math.cos(m.ang) * 14, y: m.y - Math.sin(m.ang) * 14, life: 0.2 });
    if (m.t <= 0) {
      m.st = "charge";
      m.ct = 0;
      m.cx0 = m.x;
      m.cy0 = m.y;
      m.hit = false;
      sfx("shoot");
      shakeScreen(0.08, 1.5);
      spawnDungeonToast("❗", m.x, m.y - 34, "#ff4a3a", 20);
    }
    return;
  }
  if (m.st === "charge") {
    // v8.2 (mantenedor: "pequenos desvios"): olha um pouco à frente; se um tronco ou água está na linha, curva de leve
    // para o lado livre (no máximo JAVALI_PENSA.curva rad/s), em vez de bater de frente
    if (!linhaLivre(m.x, m.y, m.x + Math.cos(m.ang!) * T * 1.3, m.y + Math.sin(m.ang!) * T * 1.3, 0.35)) {
      const P = JAVALI_PENSA,
        livre = (a: number) => linhaLivre(m.x, m.y, m.x + Math.cos(a) * T * 1.3, m.y + Math.sin(a) * T * 1.3, 0.35);
      for (const da of [0.35, -0.35, 0.7, -0.7])
        if (livre(m.ang! + da)) {
          m.ang! += Math.sign(da) * Math.min(Math.abs(da), P.curva * dt);
          break;
        }
    }
    const sp = BOAR.speed * (m.slow! > 0 ? 0.6 : 1) * dt,
      nx = m.x + Math.cos(m.ang!) * sp,
      ny = m.y + Math.sin(m.ang!) * sp;
    m.ct! += dt;
    const wall = nx < T || ny < T || nx > d.cols * T - T || ny > d.rows * T - T;
    m.x = Math.max(T, Math.min(d.cols * T - T, nx));
    m.y = Math.max(T, Math.min(d.rows * T - T, ny));
    if (Math.random() < dt * 30)
      d.fx!.push({ x: m.x - Math.cos(m.ang!) * 10, y: m.y - Math.sin(m.ang!) * 10, life: 0.25 });
    if (!m.hit && !safe && !d.dead && Math.hypot(d.px - m.x, d.py - m.y) < T * 0.8) {
      m.investidasErradas = 0;
      m.hit = true;
      boarHit(m);
      return;
    }
    if (wall || m.ct! > 2.2 || Math.hypot(m.x - m.cx0!, m.y - m.cy0!) > T * BOAR.range) {
      // errou: fica ofegante e vulnerável
      m.investidasErradas = (m.investidasErradas || 0) + 1;
      m.st = "recover";
      m.t = wall ? 1.8 : fury ? 0.35 : 1.2;
      m.stunMax = m.t;
      m.bcd = fury ? 0.2 + Math.random() * 0.4 : BOAR.cd[0] + Math.random() * (BOAR.cd[1] - BOAR.cd[0]);
      if (wall) {
        addRing(m.x, m.y, "#c9a27a", 34, 0.3, 3);
        shakeScreen(0.12, 2.5);
        spawnDungeonToast("💫", m.x, m.y - 30, "#ffe08a", 18);
        folCansar(m, BOAR_ARVORE.folego); // v8.1: a cabeçada na parede também cansa
      }
    }
    return;
  }
  if (m.cacFuga && dist > T * 4) {
    // v8.0: o tempo da caçada acabou (map/cacada.ts) e ele não está brigando: some correndo para longe
    const l = dist || 1,
      s = (m.spd || 32) * 1.6 * dt;
    m.x = Math.max(T, Math.min(d.cols * T - T, m.x - ((d.px - m.x) / l) * s));
    m.y = Math.max(T, Math.min(d.rows * T - T, m.y - ((d.py - m.y) / l) * s));
    m.ang = Math.atan2(m.y - d.py, m.x - d.px);
    m.st = "wander";
    const W = d.cols * T,
      H = d.rows * T;
    if (dist > T * 14 || m.x <= T * 1.05 || m.y <= T * 1.05 || m.x >= W - T * 1.05 || m.y >= H - T * 1.05) {
      m.alive = false;
      m.fugiu = true;
      d.monsters = d.monsters.filter((o) => o !== m);
    }
    return;
  }
  if ((m.acalmarT || 0) > 0 || safe || dist > T * BOAR.notice) {
    // passeia
    if ((m.acalmarT || 0) > 0) m.acalmarT = Math.max(0, (m.acalmarT || 0) - dt);
    if (!m.target || Math.hypot(m.target.x - m.x, m.target.y - m.y) < 4 || Math.random() < 0.01)
      m.target = { x: T + Math.random() * (d.cols * T - 2 * T), y: T + Math.random() * (d.rows * T - 2 * T) };
    const dx = m.target.x - m.x,
      dy = m.target.y - m.y,
      l = Math.hypot(dx, dy) || 1,
      s = Math.min(18 * dt, l);
    m.x += (dx / l) * s;
    m.y += (dy / l) * s;
    m.st = "wander";
    return;
  }
  m.st = "chase";
  const ux = (d.px - m.x) / (dist || 1),
    uy = (d.py - m.y) / (dist || 1),
    spd = (m.spd || 32) * dt * (m.slow! > 0 ? 0.5 : 1);
  // v8.2 (mantenedor: "pensar antes de correr"): pronto para investir mas com tronco/água no caminho → procura, na mesma
  // distância, um ângulo de onde a linha até ela está livre e anda até lá (em vez de só rodear às cegas)
  if (m.bcd <= 0 && dist >= T * BOAR.minD && dist <= T * 7 && !linhaLivre(m.x, m.y, d.px, d.py)) {
    if (
      !m.posto ||
      Math.hypot(m.posto.x - m.x, m.posto.y - m.y) < T * 0.3 ||
      !linhaLivre(m.posto.x, m.posto.y, d.px, d.py)
    )
      m.posto = lugarLivre(m, dist);
    if (m.posto) {
      const px = m.posto.x - m.x,
        py = m.posto.y - m.y,
        l = Math.hypot(px, py) || 1;
      m.x += (px / l) * spd * JAVALI_PENSA.passo;
      m.y += (py / l) * spd * JAVALI_PENSA.passo;
      m.ang = Math.atan2(py, px);
      return;
    }
  } else m.posto = null;
  if (dist < T * 2.4) {
    m.x -= ux * spd * 1.1;
    m.y -= uy * spd * 1.1;
  } // perto demais: recua para ganhar distância
  else if (dist > T * 5.5) {
    m.x += ux * spd;
    m.y += uy * spd;
  } else {
    const lado = m.rodeio || 1; // v8.1: troca de lado quando um tronco barra (field/acertos.ts)
    m.x += -uy * spd * 0.7 * lado;
    m.y += ux * spd * 0.7 * lado;
  } // rodeia
  m.x = Math.max(T, Math.min(d.cols * T - T, m.x));
  m.y = Math.max(T, Math.min(d.rows * T - T, m.y));
  // v8.1: no campo aberto só mira com o caminho até ela livre (senão rodeia até achar); se ela se esconder atrás de um
  // tronco depois que ele disparou, ele segue reto e bate
  if (
    m.bcd <= 0 &&
    !(d.down! > 0) &&
    (fury || (dist >= T * BOAR.minD && dist <= T * 7)) &&
    linhaLivre(m.x, m.y, d.px, d.py)
  ) {
    m.st = "bwind";
    m.t = fury ? 0.45 + Math.random() * 0.5 : BOAR.wind[0] + Math.random() * (BOAR.wind[1] - BOAR.wind[0]);
    m.ang = Math.atan2(d.py - m.y, d.px - m.x);
    addRing(m.x, m.y, "#ffd27a", 30, 0.35, 3);
  }
}
/** v8.2 — o javali que pensa: `curva` = o quanto ele corrige a investida para desviar (rad/s), `passo` = a pressa
 *  indo para o lugar de onde a linha está livre (× a velocidade de andar), `passos` = ângulos testados de cada lado. */
const JAVALI_PENSA = { curva: 1.4, passo: 1.3, passos: 8 };
/** Um ponto, na distância `dist` dela, de onde a linha até ela está livre — o mais perto de onde ele está. */
function lugarLivre(m: Monster, dist: number) {
  const d = dungeon,
    T = d.tile,
    a0 = Math.atan2(m.y - d.py, m.x - d.px);
  for (let k = 1; k <= JAVALI_PENSA.passos; k++)
    for (const s of [1, -1]) {
      const a = a0 + s * k * 0.2,
        r = Math.min(dist, T * 6),
        x = Math.max(T, Math.min(d.cols * T - T, d.px + Math.cos(a) * r)),
        y = Math.max(T, Math.min(d.rows * T - T, d.py + Math.sin(a) * r));
      if (linhaLivre(x, y, d.px, d.py) && linhaLivre(m.x, m.y, x, y)) return { x, y };
    }
  return null;
}
/** v8.1 — a investida bateu de frente num tronco (campo aberto, field/acertos.ts): tonto e cansado. É a recompensa de
    esquivar com uma árvore atrás. */
export function boarTrombou(m: Monster) {
  m.st = "recover";
  m.t = m.stunMax = BOAR_ARVORE.tonto;
  m.bcd = BOAR.cd[0];
  m.investidasErradas = (m.investidasErradas || 0) + 1;
  folCansar(m, BOAR_ARVORE.folego);
  addRing(m.x, m.y, "#c9a27a", 34, 0.3, 3);
  shakeScreen(0.12, 2.5);
  sfx("block");
  spawnDungeonToast("💥 Bateu na árvore!", m.x, m.y - 34, "#ffe08a", 13);
}
export function boarHit(this: unknown, m: Monster) {
  /* v6.2 */
  const o = DMG.att;
  DMG.att = m;
  try {
    return boarHitBase.apply(this, arguments as Repasse);
  } finally {
    DMG.att = o;
  }
}
// etapa de boarHit: original
function boarHitBase(m: Monster) {
  const d = dungeon,
    ang = Math.atan2(m.y - d.py, m.x - d.px),
    front = Math.abs(Math.atan2(Math.sin(ang - aimAngle()), Math.cos(ang - aimAngle()))) < 1.3;
  m.bcd = m.fury ? 0.4 : BOAR.cd[0] + Math.random() * (BOAR.cd[1] - BOAR.cd[0]);
  const stunBoar = (t: number) => {
    m.st = "recover";
    m.t = t;
    m.stunMax = t;
    applySlow(m, t * 0.6);
  };
  if (d.invuln! > 0 || d.rollGuard! > 0 || d.gingaGuard! > 0) {
    spawnDungeonToast("💨", d.px, d.py - 34, "#bfe8ff", 20);
    m.hit = false;
    return;
  } // passou por ele
  if (d.dodgeGuard! > 0) {
    knockApart(m, 26, 14);
    stunBoar(1.3);
    spawnDungeonToast("🛡️", d.px, d.py - 34, "#e8d6a8", 20);
    sfx("block");
    shakeScreen(0.1, 2.5);
    return;
  } // haste da lança
  if (d.parryVis! > 0 && d.weapon === "melee" && front) {
    knockApart(m, 40, 6);
    stunBoar(2.5);
    applyStun(m, 2.5);
    m.st = "recover";
    addRing(m.x, m.y, "#ffffff", 40, 0.35, 3);
    shakeScreen(0.12, 3);
    sfx("perfect");
    spawnDungeonToast("Parry!", d.px, d.py - 38, "#fff1c2", 12);
    addSwordPts(3);
    return;
  }
  if (d.weapon === "melee" && d.guard && !(d.guardBroken! > 0) && front && ensureEquip(d.hero!).maoE) {
    d.gstam! -= 45 * eqBlockMult(d.hero!);
    d.gregen = 1;
    eqWear("maoE", 2);
    knockApart(m, 30, 16);
    stunBoar(1.5);
    sfx("block");
    shakeScreen(0.14, 3);
    spawnDungeonToast("Bloqueado", d.px, d.py - 32, "#9fe3ff", 11);
    if (d.gstam! > 0) return;
    d.gstam = 0;
    d.guard = false;
    d.guardBroken = 1.5;
    spawnDungeonToast("Guarda quebrou!", d.px, d.py - 48, "#ff9a9a", 12);
  }
  const dmg = Math.max(
    2,
    Math.round(
      (5 + Math.random() * 3 - attrOf(d.hero!, "constituicao") * STAT.conDef) * (m.dm || 1) * (1 - armorRed(d.hero!)),
    ),
  );
  hurtPlayer(dmg, ang, m);
  eqWearArmor();
  knockApart(m, 4, 34);
  d.down = d.derrubada = BOAR_DERRUBA.t;
  d.derrubadaDe = ang;
  d.dazed = 5;
  d.charging = false;
  d.guard = false;
  d.spCh = null;
  d.moveTarget = null;
  spawnDungeonToast("Derrubado!", d.px, d.py - 46, "#ff9a6a", 13);
  shakeScreen(0.25, 5);
  m.st = "recover";
  m.t = 0.8;
  if (d.hp <= 0) dungeonDeath();
}
export function boarTick(dt: number) {
  const d = dungeon;
  if (d.down! > 0) d.down! -= dt;
  if (!(d.down! > 0)) d.derrubada = 0;
  if (d.dazed! > 0) {
    d.dazed! -= dt;
    if (Math.random() < dt * 2) d.fx!.push({ x: d.px + (Math.random() - 0.5) * 14, y: d.py - 30, life: 0.3 });
  }
}
export function boarDraw2D() {
  // mirando: faixa clara que segue o herói (sem aviso de quando dispara) · correndo: faixa VERMELHA fixa
  const d = dungeon,
    c = TELAS.dCtx,
    T = d.tile,
    now = performance.now() / 1000;
  for (const m of d.monsters) {
    if (!m.alive || m.kind !== "javalino" || (m.st !== "bwind" && m.st !== "charge")) continue;
    const L = T * BOAR.range,
      w = T * 0.8;
    c.save();
    if (m.st === "bwind") {
      c.translate(m.x, m.y);
      c.rotate(m.ang!);
      const p = 0.5 + 0.5 * Math.sin(now * 7);
      c.globalAlpha = 0.22 + 0.12 * p;
      c.fillStyle = "#fff4c8";
      c.fillRect(0, -w / 2, L, w);
      c.globalAlpha = 0.95;
      c.strokeStyle = "#ffe08a";
      c.lineWidth = 2.5;
      c.setLineDash([10, 7]);
      c.lineDashOffset = -now * 40;
      c.strokeRect(0, -w / 2, L, w);
      c.setLineDash([]);
      c.fillStyle = "#ffe08a";
      for (let i = 1; i <= 3; i++) {
        const x = (L * i) / 4;
        c.beginPath();
        c.moveTo(x, -6);
        c.lineTo(x + 9, 0);
        c.lineTo(x, 6);
        c.closePath();
        c.fill();
      }
    } else {
      c.translate(m.cx0!, m.cy0!);
      c.rotate(m.ang!);
      c.globalAlpha = 0.42;
      c.fillStyle = "#ff2a1a";
      c.fillRect(0, -w / 2, L, w);
      c.globalAlpha = 1;
      c.strokeStyle = "#ff3a2a";
      c.lineWidth = 3;
      c.strokeRect(0, -w / 2, L, w);
    }
    c.restore();
  }
}
