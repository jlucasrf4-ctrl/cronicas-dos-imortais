/* ==== Fase 4 — armas no campo: clava, machado, lança, arco (v4.8, v5.9.01, v5.9.02) ==== */
import { consumirFolegoExterno } from "./folego.ts";
import { ensureEquip, placeIn, mkItem, heroEq } from "../items/equipamento.ts";
import { dungeon, econ, GL3, TELAS } from "../core/state.ts";
import type { EstadoGL3 } from "../core/state.ts";
import { isLanca } from "../items/galho.ts";
import { wolfBody, aimAngle, meleeDmg, hurtMonster, bodyDist } from "./acertos.ts";
import { glPush, lerp3, ik2, rodM, add3 } from "../render/gl/renderer.ts";
import { M4 } from "../render/gl/geometria.ts";
import { HEROINA } from "../render/gl/heroina.ts";
import type { Vec3 } from "../render/gl/geometria.ts";
import type { Braco } from "../render/gl/renderer.ts";
import { campMesaGL, campGLPush } from "../survival/acampamento.ts";
import { ISC, introGL, campNpcGL, introDraw2D } from "../intro/cena.ts";
import { rastroDraw2D } from "./rastro.ts";
import { spearMesh, wpnMesh } from "../render/gl/armas.ts";
import { dfireGL, dfireTick, dfireDraw2D } from "./fogueira.ts";
import { mountGL, mountTick, mountDraw2D } from "../creatures/tamandua.ts";
import { moitasGL } from "./moitas.ts";
import { campNapGL, napDraw2D } from "../intro/tutorial.ts";
import { vilaGL, vilaDraw2D } from "../map/vila_cena.ts";
import { campoMoitasGL } from "../ui/modos.ts";
import {
  WPN,
  WPN_OF,
  SPEAR_CH,
  LANCA_BALANCO,
  ARREMESSO,
  HV,
  FOL_HEROI,
  GINGA,
  CLAVA_COMBO,
  CLAVA_CD,
  ESQUIVA,
  ROLAR_GUARDA,
  EXAUSTAO,
} from "../data/combate.ts";
import { addRing, sfx, knockApart, shakeScreen, PARRY_NEAR, addSwordPts, addBowPts } from "./chao.ts";
import { profLv } from "../hero/proficiencias.ts";
import { spawnDungeonToast, reveal } from "./masmorra.ts";
import { ensureInv } from "../items/inventario.ts";
import { applyBleed, applySlow, applyStun, parryPerfectT, atkSpeedMult, adrenalinaCusto } from "./combate.ts";
import { eqDurInit, eqWear } from "../items/durabilidade.ts";
import { forgeBook } from "../forja/forja.ts";
import { MOB } from "../ui/celular.ts";
import {
  cravZoom,
  cravPose,
  spearThrowStick,
  spearStuckTick,
  cravTick,
  cravDraw2D,
  cravRip,
  folCansar,
} from "./tipos.ts";
import { ropeFlyTick, finishTick, lacoTick, cordaDraw2D, areaWrap } from "./faca_corda.ts";
import { angDiff } from "../core/util.ts";
import { D3 } from "./projecao.ts";
import { pushEvent } from "../sim/eventos.ts";
import { DMG } from "./dano.ts";
import {
  arvoreCampoNaMira,
  converterMadeiraEmGalho,
  golpearRecursoCampo,
  pedraCampoNaMira,
  troncoCampoNaMira,
  troncoCampoPorId,
} from "./recursos_campo.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import type { Dungeon, GLMesh, Hero, LancaCampo, Monster, Repasse } from "../core/tipos.ts";
import type { Mat4 } from "../render/gl/geometria.ts";

export function wpnKey(h: Hero) {
  const it = h && ensureEquip(h).maoD;
  return it ? it.def.key : null;
}
export function spearMode() {
  const d = dungeon;
  return d.weapon === "melee" && (isLanca(wpnKey(d.hero!)) || !!d.spearOut);
}

/* ---- desenho da lança voando / no chão ---- */
export function armasGLPush() {
  /* v6.4 — Caçador cochilando: o boneco acordado sai enquanto o resto é desenhado (o dormindo entra em campNapGL) */
  const d = dungeon,
    sl = econ.hunterNap && d.camp && ISC.campNpc,
    keep = ISC.campNpc;
  if (sl) ISC.campNpc = null;
  try {
    if (d.spears && d.spears.length) {
      const m = spearMesh(),
        now = performance.now();
      for (const s of d.spears) {
        if (s.stuck) {
          const m = s.stuck,
            a = (m.ang || 0) + s.sa!,
            B = wolfBody(m);
          glPush(
            spearMesh(),
            M4.ch(
              M4.T(m.x - Math.cos(a) * (B.r * 0.2), 9, m.y - Math.sin(a) * (B.r * 0.2)),
              M4.RY(-a),
              M4.RZ(-0.42),
              M4.T(-26, 0, 0),
              M4.S(1.15),
            ),
          );
          continue;
        }
        const ang = s.fly ? Math.atan2(s.vy, s.vx) : s.ang,
          y = s.fly ? 14 : 1.4;
        glPush(
          m,
          M4.ch(M4.T(s.x, y, s.y), M4.RY(-ang), M4.S(1.15)),
          s.fly ? null : [1, 0.9, 0.6, 0.12 + 0.12 * Math.sin(now / 180)],
        );
      }
    }
    if (dungeon.camp) campGLPush(); // v5.9 — acampamento
    try {
      dfireGL();
    } catch (_) {} // v5.9.02 — fogueira montada
    try {
      mountGL();
    } catch (e) {
      console.warn(e);
    } // v5.9.04 — tamanduá
    try {
      campMesaGL();
    } catch (_) {} // v5.9.15 — maleta e mesa
    try {
      introGL();
    } catch (_) {} // v6.1 — cena inicial
    try {
      campNpcGL();
    } catch (_) {} // v6.1 — Caçador no acampamento
    try {
      vilaGL();
    } catch (e) {
      console.warn(e);
    } // v8.0 — moradores da vila andável
    try {
      moitasGL();
    } catch (_) {} // v6.4 — moitas da expedição
  } finally {
    if (sl) ISC.campNpc = keep;
  }
  try {
    campNapGL(sl, keep);
  } catch (_) {} // v6.4 — barraca e Caçador dormindo
  try {
    campoMoitasGL();
  } catch (_) {} // v6.5 — moitas do Campo
}

/* ---- v5.8: lança segurada com as DUAS mãos (estocada, mira do arremesso e bloqueio com a haste) ---- */
export function spearTwoHand(
  d: Dungeon,
  A: EstadoGL3["atk"],
  AF: Mat4,
  BL: Mat4,
  P: Record<string, GLMesh>,
  EQ: Record<string, number>,
  tint: number[] | null,
  sw: number,
) {
  if (d.weapon === "bow" || !isLanca(wpnKey(d.hero!))) return false;
  const SC = 1.3,
    W2 = (q: number[]) => M4.ap(AF, q[0], q[1], q[2]),
    L = M4.ap(BL, 0, HEROINA.ombroY, -HEROINA.ombroZ),
    R = M4.ap(BL, 0, HEROINA.ombroY, HEROINA.ombroZ);
  let ext = 0;
  if (A) {
    const t = A.t,
      p = Math.min(1, t / 0.07),
      e = 1 - Math.pow(1 - p, 2),
      r = Math.max(0, Math.min(1, (t - 0.09) / 0.14));
    ext = e * (1 - r * r * (3 - 2 * r));
  }
  const dg = d.shove! > 0 ? Math.sin(Math.PI * Math.min(1, (0.3 - d.shove!) / 0.3)) : 0;
  const ch = d.spCh ? d.spCh.ch : 0,
    s2 = sw * 0.8;
  // mãos: direita atrás (perto do quadril), esquerda à frente; estocada empurra as duas para a frente
  let Hr = [-3 + 7 * ext, 20.5 + s2 * 0.4 * (1 - ext), 3.2],
    Hl = [8 + 7 * ext, 22.5, 0.6]; // estocada: lança reta, as mãos deslizam juntas
  if (ch > 0) {
    Hr = lerp3(Hr, [-6, 33, 7], ch);
    Hl = lerp3(Hl, [11, 27, -4], ch);
  } // mirando o arremesso: lança acima do ombro
  if (dg > 0) {
    Hr = lerp3(Hr, [13, 24, 8], dg);
    Hl = lerp3(Hl, [13, 26, -8], dg);
  } // empurrão: haste atravessada, empurrada para a frente
  const lA = ik2(L, Hl, 6.5, 6.8, [0, -1, -0.4]),
    rA = ik2(R, Hr, 6.5, 6.8, [-0.7, -0.3, 1]);
  for (const [S, J] of [
    [L, lA],
    [R, rA],
  ] as [Vec3, Braco][]) {
    glPush(P.rodAr, rodM(W2(S), W2(J.E), 3.9 * SC), tint);
    glPush(P.rodAr, rodM(W2(J.E), W2(J.H), 3.5 * SC), tint);
    glPush(P.fist, M4.ch(M4.T(...W2(J.H)), M4.RY(-GL3.hyaw), M4.S(4.6 * SC)), tint);
  }
  if (EQ.maoE) glPush(P.shieldBack, M4.mul(AF, BL), tint);
  if (EQ.costas) glPush(P.bowOnly, M4.ch(AF, BL, M4.T(-6.4, 24, 0), M4.RX(0.55), M4.S(0.85)), tint);
  if (EQ.maoD) {
    // a lança passa pelas duas mãos
    let a = rA.H,
      b = lA.H;
    if (ch > 0) b = lerp3(lA.H, add3(rA.H, [10, 1.8, -0.6]), ch); // no arremesso só a mão direita segura
    let dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2];
    if (ch <= 0 && dg <= 0) {
      dx = Hl[0] - Hr[0];
      dy = Hl[1] - Hr[1];
      dz = Hl[2] - Hr[2];
      const n = Math.hypot(dx, dy, dz) || 1;
      a = add3(a, [(dx / n) * ext * 9, (dy / n) * ext * 9, (dz / n) * ext * 9]);
    } // estocada: a lança desliza reta pelas mãos
    const yaw = Math.atan2(dz, dx),
      pit = Math.atan2(dy, Math.hypot(dx, dz));
    let O = a;
    if (dg > 0)
      O = lerp3(
        a,
        add3(lerp3(a, b, 0.5), [
          (-dx / (Math.hypot(dx, dy, dz) || 1)) * 10,
          (-dy / (Math.hypot(dx, dy, dz) || 1)) * 10,
          (-dz / (Math.hypot(dx, dy, dz) || 1)) * 10,
        ]),
        dg,
      );
    glPush(wpnMesh(d.hero!, P), M4.ch(AF, M4.T(O[0], O[1], O[2]), M4.RY(-yaw), M4.RZ(pit)), tint);
  }
  return true;
}

export function wpnProf(h: Hero) {
  return WPN[WPN_OF[wpnKey(h)!]] || WPN.espada;
}
function spearDrop(s: LancaCampo) {
  s.fly = false;
  s.h = 0;
  addRing(s.x, s.y, "#e8d6a8", 22, 0.3, 2);
}

/* =====================================================================
   v5.9.01 — AJUSTES
   · Forja: couro e tecido (armadura de couro, botas, calça de linho) agora são
     CUTELARIA + COSTURA: corte o molde com a faca seguindo o risco e depois
     costure ponto a ponto. A cota de malha aquece o arame, FECHA OS ANÉIS
     um a um e vai para a têmpera.
   · Lança cravada: o arremesso que acerta fica preso no bicho e faz sangrar;
     chegue perto e clique (ou E) para arrancar com dano extra.
   · Lança no chão com a mão ocupada: E guarda na mochila.
   · Bicho derrubado pelo empurrão da lança leva +30% de dano.
   · Armas longas maiores na mochila (lança, clava e machado).
===================================================================== */
/* ---------- lança cravada ---------- */
export function spearStuckNear() {
  const d = dungeon,
    T = d.tile;
  let best = null,
    bd = T * 1.35;
  for (const s of d.spears || [])
    if (s.stuck && s.stuck.alive) {
      const m = s.stuck,
        dd = Math.hypot(m.x - d.px, m.y - d.py) - wolfBody(m).r;
      if (dd < bd) {
        bd = dd;
        best = s;
      }
    }
  return best;
}
export function spearGroundNear() {
  const d = dungeon;
  return (d.spears || []).find((s) => !s.fly && !s.stuck && Math.hypot(s.x - d.px, s.y - d.py) < 30) || null;
}
export function spearPull(s: LancaCampo) {
  const d = dungeon,
    h = d.hero!,
    m = s.stuck;
  if (!m) return;
  const i = d.spears!.indexOf(s);
  if (i >= 0) d.spears!.splice(i, 1);
  s.stuck = null;
  const dmg = (s.dmg * 0.9 + meleeDmg(h) * 0.5) * (1 + 0.06 * profLv(h, "lanca"));
  m.flash = 0.2;
  hurtMonster(m, dmg, "espada", 3);
  if (m.alive) applyBleed(m, s.dmg * 0.25);
  knockApart(m, 8, 6);
  d.fx!.push({ x: m.x, y: m.y, life: 0.3 });
  addRing(m.x, m.y, "#ff6a5a", 30, 0.3, 3);
  shakeScreen(0.1, 2.5);
  sfx("hit");
  spawnDungeonToast("ARRANCOU! 🩸", m.x, m.y - 36, "#ff8a7a", 13);
  const e = ensureEquip(h);
  if (!e.maoD) {
    e.maoD = s.it;
    GL3.heroKey = "";
  } else if (!placeIn(ensureInv(h), s.it)) {
    s.x = d.px;
    s.y = d.py;
    s.ang = aimAngle();
    spearDrop(s);
    d.spears!.push(s);
    spawnDungeonToast("Mochila cheia — a lança caiu", d.px, d.py - 30, "#ffb37a", 11);
  }
  d.cd = 0.35;
  d.cdMax = 0.35;
}

export function armasKit() {
  // primeira vez: clava, machado e lança no baú para testar
  if (econ.armasKit) return;
  econ.armasKit = 1;
  for (const k of ["eq_lanca", "eq_clava", "eq_machado"]) {
    const it = mkItem(k);
    eqDurInit(it);
    if (!placeIn(econ.stash, it)) econ.stash.items.push(it);
  }
  forgeBook().eq_clava = 1;
}

/* ---- arremesso e coleta ---- */
/** `desvio`: o balanço da mira na hora de soltar (v8.1, balancoMira), somado ao rumo. */
export function spearThrow(ch: number, desvio = 0) {
  const d = dungeon;
  if (!d.active || d.dead || d.modalOpen || d.invOpen || d.cd! > 0) return;
  if (ch == null) ch = 1;
  const h = d.hero!,
    e = ensureEquip(h),
    it = e.maoD;
  if (!it || !isLanca(it.def.key)) {
    if (d.spearOut) spawnDungeonToast("Busque a lança", d.px, d.py - 30, "#ffe08a", 11);
    return;
  }
  const ang = aimAngle() + desvio,
    spd = 360 + 120 * ch,
    rng = spearRange(ch);
  e.maoD = null;
  d.spearOut = it;
  d.cd = 0.45;
  d.cdMax = 0.45;
  reveal();
  sfx("shoot");
  eqWear("maoD", 0);
  d.spears = d.spears || [];
  d.spears.push({
    x: d.px,
    y: d.py,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    life: rng / spd,
    it,
    dmg: (meleeDmg(h) * 1.7 + 3) * (0.5 + 0.7 * ch),
    fly: true,
    ang,
    h: 14,
    ch,
  });
}
export function armasTick(dt: number) {
  const d = dungeon;
  if (d.active && dt > 0) {
    const T = d.tile;
    for (const s of d.spears || []) {
      if (!s.fly) continue;
      const steps = 3;
      for (let k = 0; k < steps && s.fly; k++) {
        s.x += (s.vx * dt) / steps;
        s.y += (s.vy * dt) / steps;
        s.life -= dt / steps;
        for (const m of d.monsters) {
          if (!m.alive) continue;
          const B = wolfBody(m);
          if (bodyDist(B, s.x, s.y).d < B.r + 6) {
            d._lastCrit = false;
            hurtMonster(m, s.dmg, "espada", 3);
            const _cr = d._lastCrit;
            applySlow(m, 1.2);
            knockApart(m, 10, 0);
            d.fx!.push({ x: m.x, y: m.y, life: 0.25 });
            sfx("hit");
            eqWear("maoD", 1);
            if (m.alive && spearThrowStick(m, _cr, s)) {
              /* v6.2: crava pela ponta (perfurante) */ s.fly = false;
              s.stuck = m;
              s.sa = Math.atan2(s.vy, s.vx) - (m.ang || 0);
              s.bt = 0;
              s.st = 0;
              spawnDungeonToast("🔱 Cravada!", m.x, m.y - 30, "#ff8a7a", 12);
            } else spearDrop(s);
            break;
          }
        }
        if (s.x < T || s.y < T || s.x > d.cols * T - T || s.y > d.rows * T - T) {
          s.x = Math.max(T, Math.min(d.cols * T - T, s.x));
          s.y = Math.max(T, Math.min(d.rows * T - T, s.y));
          spearDrop(s);
        }
        if (s.life <= 0 && s.fly) spearDrop(s);
      }
    }
    if (d.spears)
      for (let i = d.spears.length - 1; i >= 0; i--) {
        const s = d.spears[i];
        if (s.fly || d.dead) continue;
        if (s.stuck) {
          const m = s.stuck;
          if (!m.alive) {
            s.stuck = null;
            s.x = m.x;
            s.y = m.y;
            s.ang = (m.ang || 0) + s.sa!;
            spearDrop(s);
            continue;
          }
          s.x = m.x;
          s.y = m.y;
          if (spearStuckTick(s, m, dt)) {
            s.stuck = null;
            s.x = m.x + 14;
            s.y = m.y + 6;
            s.ang = (m.ang || 0) + s.sa!;
            spearDrop(s);
            spawnDungeonToast("🔱 A lança caiu no chão", m.x, m.y - 30, "#e8d6a8", 11);
          }
          continue;
        }
        if (Math.hypot(d.px - s.x, d.py - s.y) < 20) {
          const e = ensureEquip(d.hero!);
          if (!e.maoD) {
            e.maoD = s.it;
            d.spears.splice(i, 1);
            GL3.heroKey = "";
            spawnDungeonToast("+🔱", d.px, d.py - 30, "#ffe08a");
            sfx("ping");
          }
        }
      }
    {
      const e = ensureEquip(d.hero!);
      const out = (d.spears || []).find((s) => !s.fly || s.stuck) || (d.spears || [])[0];
      d.spearOut = !e.maoD && out ? out.it : null;
    }
    if (d.shove! > 0) d.shove! -= dt;
    for (const m of d.monsters) if (m.downT! > 0) m.downT! -= dt;
    if (d.dodge) {
      const q = d.dodge;
      q.t -= dt;
      const sp = (q.k || 1) * (200 * Math.max(0, q.t / (q.dur || 0.3)) + 40);
      if (q.roll && Math.random() < dt * 30) d.fx!.push({ x: d.px - q.dx * 8, y: d.py - q.dy * 8, life: 0.18 });
      d.px = Math.max(T, Math.min(d.cols * T - T, d.px + q.dx * sp * dt));
      d.py = Math.max(T, Math.min(d.rows * T - T, d.py + q.dy * sp * dt));
      if (q.t <= 0) d.dodge = null;
    }
    if (d.spCh) {
      const it = ensureEquip(d.hero!).maoD;
      if (!it || !isLanca(it.def.key) || d.weapon !== "melee") d.spCh = null;
      else {
        d.spCh.t += dt;
        d.spCh.ch = Math.min(1, d.spCh.t / SPEAR_CH.time);
        if (d.spCh.ch >= 1 && !d.spCh.ping) {
          d.spCh.ping = 1;
          sfx("ping");
        }
        balancoMira(d.spCh, dt);
      }
    }
    if (d.rollGuard! > 0) d.rollGuard! -= dt;
    if (d.gingaGuard! > 0) d.gingaGuard! -= dt;
    if (d.dodgeGuard! > 0) d.dodgeGuard! -= dt;
    if (d.dodgeCd! > 0) d.dodgeCd! -= dt;
    if (typeof MOB !== "undefined" && MOB.on) {
      const bw = d.weapon === "bow",
        bp0 = document.getElementById("tb-parry");
      if (bp0 && bp0._bw !== bw) {
        bp0._bw = bw;
        bp0._sm = null;
      }
      const sm = bw ? "bow" : spearMode(),
        bp = document.getElementById("tb-parry"),
        bd = document.getElementById("tb-def");
      if (bp && bp._sm !== sm) {
        bp._sm = sm;
        bp.innerHTML =
          sm === "bow" ? "🤸<small>rolar</small>" : sm ? "🔱<small>arremessar</small>" : "⚡<small>parry</small>";
        if (bd) bd.innerHTML = sm === "bow" ? "🛡" : sm ? "💥<small>empurrão</small>" : "🛡";
      }
    }
  }
  try {
    hvTick(dt);
    dfireTick(dt);
  } catch (e) {
    console.warn(e);
  } // v5.9.02 — golpes carregados e fogueira montada
  try {
    mountTick(dt);
  } catch (e) {
    console.warn(e);
  } // v5.9.04 — tamanduá
  try {
    if (d.active && !d.camp) {
      if (d.kcd! > 0) d.kcd! -= dt;
      ropeFlyTick(dt);
      finishTick(dt);
    }
  } catch (_) {} // v6.0 — faca, corda e finalizar
  try {
    if (d.active && dt > 0) {
      if (d.noAtk! > 0) d.noAtk! -= dt;
      cravTick(dt);
    }
  } catch (e) {
    console.warn(e);
  } // v6.2 — arma cravada
  try {
    if (dungeon.active) cravZoom(dt > 0 ? dt : dungeon._realDt || 0);
    cravPose();
  } catch (e) {
    console.warn(e);
  } // v6.9 — câmera e pose da cravada
  try {
    if (d.active && !d.camp && dt > 0) lacoTick(dt);
  } catch (e) {
    console.warn(e);
  } // v7.2 — laço
}
export function spearDodge() {
  return spearShove();
} // v5.9.01: o Espaço da lança é o EMPURRÃO (não é mais esquiva)
export function spearShove() {
  const d = dungeon;
  if (
    !d.active ||
    d.dead ||
    d.modalOpen ||
    d.invOpen ||
    d.weapon !== "melee" ||
    d.dodgeCd! > 0 ||
    d.shove! > 0 ||
    d.down! > 0
  )
    return;
  if (d.gstam != null && d.gstam < 8) {
    spawnDungeonToast("Fôlego acabou!", d.px, d.py - 30, "#ff9a9a");
    return;
  }
  const T = d.tile,
    h = d.hero!,
    f = aimAngle();
  d.shove = 0.3;
  d.dodgeCd = 0.75;
  d.moveTarget = null;
  d.parryVis = 0.22;
  d.parryArc = { ang: f, x: d.px, y: d.py };
  d.parryCd = 0.75;
  d.parryMax = 0.75;
  if (d.gstam != null) {
    d.gstam = Math.max(0, d.gstam - 10);
    d.gregen = 0.6;
  }
  sfx("swing");
  const front = (m: Monster) => {
    const dd = Math.hypot(m.x - d.px, m.y - d.py);
    return dd < T * 0.55 || angDiff(Math.atan2(m.y - d.py, m.x - d.px), f) < 1.05;
  };
  const near = d.monsters.filter(
    (m) => m.alive && m.kind !== "bird" && front(m) && Math.hypot(m.x - d.px, m.y - d.py) - wolfBody(m).r < T * 1.3,
  );
  const striking = near.filter(
    (o) => (o.st === "windup" && (o.atk !== "pounce" || o.t <= PARRY_NEAR)) || o.st === "leap",
  );
  let perfect = 0,
    close = 0,
    early = 0;
  for (const m of striking) {
    const tt = m.st === "leap" ? 0 : m.t;
    if (tt <= parryPerfectT()) {
      perfect++;
      knockApart(m, 48, 4);
      applyStun(m, 2.4);
      m.downT = 2.4;
      m.flash = 0.25;
      hurtMonster(m, meleeDmg(h) * 0.6, "espada", 4);
      addRing(m.x, m.y, "#ffffff", 42, 0.35, 3);
      d.fx!.push({ x: m.x, y: m.y, life: 0.35 });
      spawnDungeonToast("💫", m.x, m.y - 34, "#ffe08a", 18);
    } else if (tt <= PARRY_NEAR) {
      close++;
      knockApart(m, 30, 6);
      applyStun(m, 0.7);
      addRing(m.x, m.y, "#ffb347", 32, 0.3, 2);
    } else {
      early++;
      m.parry = { kind: "weak" };
    }
  }
  if (perfect) {
    d.invuln = Math.max(d.invuln || 0, 1.2);
    d.cd = 0;
    addSwordPts(3);
    shakeScreen(0.12, 3);
    sfx("perfect");
    spawnDungeonToast("DERRUBOU!" + (perfect > 1 ? " x" + perfect : ""), d.px, d.py - 40, "#fff1c2", 13);
  } else if (close) {
    addSwordPts(1);
    sfx("block");
    spawnDungeonToast("Empurrão!", d.px, d.py - 30, "#ffb347", 12);
  } else if (early) {
    sfx("fail");
    spawnDungeonToast("Cedo demais", d.px, d.py - 28, "#ffcf9a", 11);
    d.dodgeCd = 1;
  } else if (near.length) {
    for (const m of near) {
      knockApart(m, 18, 4);
      applySlow(m, 0.5);
    }
    sfx("block");
    spawnDungeonToast("Afastou", d.px, d.py - 28, "#e8d6a8", 11);
  } else {
    sfx("fail");
    spawnDungeonToast("Errou o empurrão", d.px, d.py - 28, "#c9b88a", 11);
    d.dodgeCd = 0.9;
  }
  eqWear("maoD", 1);
}
export function spearParry(m: Monster, leap: boolean) {
  // golpe chegou durante a esquiva: apara com a haste
  knockApart(m, leap ? 30 : 22, 16);
  if (leap) {
    m.lx = m.x;
    m.ly = m.y;
  }
  addRing(dungeon.px, dungeon.py, "#e8d6a8", 26, 0.28, 3);
  shakeScreen(0.1, 2.5);
  sfx("block");
  spawnDungeonToast("Bloqueado", dungeon.px, dungeon.py - 32, "#9fe3ff", 11);
  dungeon.dodgeGuard = 0;
  addSwordPts(1);
  eqWear("maoD", 1);
}
export function armasDraw2D() {
  {
    const d = dungeon;
    if (d.spears && d.spears.length && !(D3.on && D3.gl)) {
      const c = TELAS.dCtx;
      for (const s of d.spears) {
        const a = s.stuck ? (s.stuck.ang || 0) + s.sa! : s.fly ? Math.atan2(s.vy, s.vx) : s.ang;
        c.save();
        c.translate(s.x, s.y);
        c.rotate(a);
        c.strokeStyle = "#7a4e28";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-18, 0);
        c.lineTo(16, 0);
        c.stroke();
        c.fillStyle = "#d8dee6";
        c.beginPath();
        c.moveTo(16, -3);
        c.lineTo(24, 0);
        c.lineTo(16, 3);
        c.fill();
        c.restore();
      }
    }
  }
  dfireDraw2D(); // v5.9.02 — luz das fogueiras e golpes carregados
  mountDraw2D(); // v5.9.04 — tamanduá
  try {
    cordaDraw2D();
  } catch (_) {} // v6.0 — corda, desmaio e finalizar
  try {
    introDraw2D();
  } catch (_) {} // v6.1 — cena inicial
  try {
    rastroDraw2D();
  } catch (_) {} // v8.0 — a seta para a presa da caçada
  try {
    cravDraw2D();
  } catch (_) {} // v6.2 — arma cravada
  try {
    napDraw2D();
  } catch (_) {} // v6.4 — Caçador cochilando
  try {
    vilaDraw2D();
  } catch (_) {} // v8.0 — placas da vila andável
}
export function armasExitCheck() {
  // saiu deixando a lança no chão?
  const d = dungeon;
  if (d.spears && d.spears.some((s) => !s.fly)) {
    if (!d._spearWarn) {
      d._spearWarn = 1;
      spawnDungeonToast("Sua lança ficou no chão! (E de novo para sair sem ela)", d.px, d.py - 40, "#ffb37a", 12);
      return true;
    }
    pushEvent("🔱 A lança ficou para trás na masmorra.");
  }
  return false;
}

/* ---- v4.9: DEFESA DO ARCO — ROLAMENTO ----
   Botão direito (ou 🤸 no celular) com o arco: rolamento rápido (~1,7 tile) na direção
   do movimento — parado, rola para trás, para longe da mira. Durante o rolamento
   os golpes passam direto (sem dano). Esquivar de um golpe de verdade = ESQUIVA
   PERFEITA: a próxima flecha já sai com a corda toda puxada. Gasta fôlego. */
export function bowRoll() {
  const d = dungeon;
  if (!d.active || d.dead || d.modalOpen || d.invOpen || d.weapon !== "bow" || d.dodgeCd! > 0 || d.dodge) return;
  const gi = d.gint == null ? 100 : d.gint;
  // v7.7: o dash gasta só o interno; o fôlego de fora (o verde de correr) não entra
  if (gi < FOL_HEROI.min + FOL_HEROI.rolar - 0.01) {
    spawnDungeonToast("Fôlego acabou!", d.px, d.py - 30, "#ff9a9a");
    return;
  }
  const k = d.keys || {},
    J = d.joy;
  let dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0),
    dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
  if (J && (J.x || J.y)) {
    dx = J.x;
    dy = J.y;
  }
  if (!dx && !dy) {
    const a = aimAngle();
    dx = -Math.cos(a);
    dy = -Math.sin(a);
  }
  const n = Math.hypot(dx, dy) || 1;
  if (d.charging) {
    d.charging = false;
    d.charge = 0;
  } // rolar solta a corda sem atirar
  d.dodge = { t: 0.3, dur: 0.3, dx: dx / n, dy: dy / n, k: 1.05, roll: true };
  d.rollGuard = ROLAR_GUARDA;
  d.rollHit = 0;
  d.dodgeCd = 0.8;
  d.moveTarget = null;
  /* v7.7 — cada rolamento tira 1/4 do fôlego interno (FOL_HEROI.rolar); v8.0: o fôlego de fora não muda */
  d.gint = gi - FOL_HEROI.rolar * adrenalinaCusto();
  addRing(d.px, d.py, "#e8d6a8", 18, 0.25, 2);
  sfx("swing");
}
/* v7.7 — Espaço com arma corpo a corpo: com escudo ergue a guarda; sem escudo, ginga (GINGA) */
export function espacoCorpo() {
  const d = dungeon;
  if (d.hero && !heroEq(d.hero).maoE) gingar();
  else d.guard = true;
}
function gingar() {
  const d = dungeon;
  if (!d.active || d.dead || d.modalOpen || d.invOpen || d.weapon !== "melee" || d.dodgeCd! > 0 || d.dodge) return;
  if ((d.gstam ?? 100) < GINGA.minStam) {
    spawnDungeonToast("Fôlego acabou!", d.px, d.py - 30, "#ff9a9a");
    return;
  }
  // para onde está andando; parado, de lado em relação à mira (alternando os lados)
  const k = d.keys || {},
    J = d.joy;
  let dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0),
    dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
  if (J && (J.x || J.y)) {
    dx = J.x;
    dy = J.y;
  }
  if (!dx && !dy) {
    const a = aimAngle() + (Math.PI / 2) * (d._gingaLado ? 1 : -1);
    d._gingaLado = !d._gingaLado;
    dx = Math.cos(a);
    dy = Math.sin(a);
  }
  const n = Math.hypot(dx, dy) || 1;
  d.dodge = { t: GINGA.dur, dur: GINGA.dur, dx: dx / n, dy: dy / n, k: GINGA.passo, roll: false };
  d.gingaGuard = GINGA.janela;
  d.dodgeCd = GINGA.cd;
  d.moveTarget = null;
  consumirFolegoExterno(d, GINGA.stam * adrenalinaCusto(), 0.4);
  sfx("swing");
}
/** v8.0 — esquiva no último instante (ESQUIVA): o golpe chegou até `perfeita` s depois de começar a esquiva. Câmera
    lenta curta, anéis, o texto grande e um pouco de fôlego de volta. true = foi perfeita. */
function esquivaPerfeita(desde: number, m: Monster | null) {
  const d = dungeon,
    E = ESQUIVA;
  if (desde > E.perfeita) return false;
  if (m && m.alive) folCansar(m, E.cansaBicho); // o bote no vazio cansa o bicho
  d.lenta = { k: E.lenta, ate: performance.now() + E.lentaMs };
  if (d.gstam != null) d.gstam = Math.min(d.gint ?? 100, d.gstam + E.folego);
  if (d.gint != null) d.gint = Math.min(100, d.gint + E.interno);
  for (let i = 0; i < 3; i++) addRing(d.px, d.py, "#bfe8ff", 22 + i * 12, 0.25 + i * 0.08, 2);
  shakeScreen(0.08, 2);
  spawnDungeonToast("ESQUIVA PERFEITA!", d.px, d.py - 44, "#dff4ff", 17);
  return true;
}
/** O golpe chegou dentro da janela da ginga: passa direto, sem efeito no bicho. */
export function gingaDesvia(m?: Monster) {
  const d = dungeon,
    desde = GINGA.janela - (d.gingaGuard || 0);
  d.gingaGuard = 0;
  sfx("near");
  if (esquivaPerfeita(desde, m || null)) return;
  addRing(d.px, d.py, "#e8f4ff", 22, 0.25, 2);
  spawnDungeonToast("Desviou!", d.px, d.py - 34, "#bfe8ff", 12);
}
export function bowEvade(m: Monster) {
  // golpe atravessou o rolamento
  const d = dungeon;
  if (d.rollHit) return;
  d.rollHit = 1;
  d.quickShot = 1;
  m.flash = 0.15;
  sfx("near");
  addBowPts(1);
  if (esquivaPerfeita(ROLAR_GUARDA - (d.rollGuard || 0), m)) return;
  addRing(d.px, d.py, "#bfe8ff", 30, 0.3, 3);
  spawnDungeonToast("💨", d.px, d.py - 34, "#bfe8ff", 20);
}
export function bowQuickCheck() {
  const d = dungeon;
  if (d.quickShot && d.charging) {
    d.quickShot = 0;
    d.charge = 1;
    d.full = 0;
    d.pinged = true;
    addRing(d.px, d.py, "#ffe08a", 22, 0.25, 2);
  }
}

/* ---- v5.4: arremesso da lança igual ao arco (segura para mirar, solta para arremessar), com alcance menor ---- */
export function spearRange(ch: number) {
  return dungeon.tile * (SPEAR_CH.rMin + (SPEAR_CH.rMax - SPEAR_CH.rMin) * Math.max(0, Math.min(1, ch)));
}
export function spearChargeStart() {
  /* v6.9 */
  if (dungeon.active && dungeon.crav) {
    cravRip();
    return;
  }
  const d = dungeon;
  if (!d.active || d.dead || d.modalOpen || d.invOpen || d.cd! > 0 || d.spCh) return;
  const it = ensureEquip(d.hero!).maoD;
  if (!it || !isLanca(it.def.key)) {
    if (d.spearOut) spawnDungeonToast("Busque a lança 🔱", d.px, d.py - 30, "#ffe08a", 11);
    return;
  }
  d.spCh = { t: 0, ch: 0 };
  d.moveTarget = null;
  sfx("draw");
}
export function spearChargeRelease() {
  const d = dungeon;
  if (!d.spCh) return;
  const ch = d.spCh.ch,
    desvio = d.spCh.desvio || 0;
  d.spCh = null;
  spearThrow(ch, desvio);
}
/** v8.1 — o balanço da mira da lança (LANCA_BALANCO): andando balança um pouco, correndo mais, parada assenta; cada
    nível de Lança deixa mais firme. Vale para a linha da mira e para o arremesso. */
function balancoMira(C: NonNullable<typeof dungeon.spCh>, dt: number) {
  const d = dungeon,
    B = LANCA_BALANCO,
    andou = C.x == null || dt <= 0 ? 0 : Math.hypot(d.px - C.x, d.py - C.y!) / dt;
  C.x = d.px;
  C.y = d.py;
  const firme = Math.max(0, 1 - B.porNivel * profLv(d.hero!, "lanca")),
    alvo = andou < 5 ? 0 : (d.running ? B.correndo : B.andando) * firme;
  C.bal = (C.bal || 0) + (alvo - (C.bal || 0)) * Math.min(1, dt * 6);
  C.fase = (C.fase || 0) + dt * B.freq * (d.running ? 1.4 : 1);
  C.desvio = C.bal * (Math.sin(C.fase) * 0.8 + Math.sin(C.fase * 2.3 + 1) * 0.2);
}
export function spearAimDraw() {
  const d = dungeon;
  if (!d.spCh) return;
  const c = TELAS.dCtx,
    ch = d.spCh.ch,
    len = spearRange(ch),
    ang = aimAngle() + (d.spCh.desvio || 0),
    full = ch >= 1;
  c.save();
  c.translate(d.px, d.py);
  c.rotate(ang);
  c.fillStyle = full ? "rgba(255,190,110,0.30)" : "rgba(255,240,210," + (0.07 + 0.12 * ch) + ")";
  c.fillRect(0, -4, len, 8);
  c.strokeStyle = full ? "#ffb35f" : "rgba(255,240,210,.55)";
  c.lineWidth = 1.5;
  c.strokeRect(0, -4, len, 8);
  c.beginPath();
  c.moveTo(len, -8);
  c.lineTo(len + 9, 0);
  c.lineTo(len, 8);
  c.stroke();
  c.setLineDash([3, 4]);
  c.strokeStyle = "rgba(255,255,255,.25)";
  c.beginPath();
  c.moveTo(spearRange(1), -10);
  c.lineTo(spearRange(1), 10);
  c.stroke();
  c.restore();
  c.fillStyle = "rgba(0,0,0,.6)";
  c.fillRect(d.px - 20, d.py + 23, 40, 6);
  c.fillStyle = full ? "#ff7a3a" : ch >= ARREMESSO.medio ? "#ffd84a" : "#e8d6a8";
  c.fillRect(d.px - 20, d.py + 23, 40 * ch, 6);
  c.fillStyle = "rgba(255,255,255,.7)";
  c.fillRect(d.px - 20 + 40 * ARREMESSO.medio - 0.5, d.py + 22, 1.2, 8);
}

/* ---------------- MACHADO e CLAVA: golpes carregados ---------------- */
export function hvKind(btn: string) {
  const k = wpnKey(dungeon.hero!);
  if (k === "eq_machado" || k === "eq_picareta") return btn === "R" ? "axe" : null; // v8.1: a picareta, o mesmo golpe
  if (k === "eq_clava") return btn === "R" ? "clubR" : "clubL";
  return null;
}
export function hvStart(kind: string) {
  const d = dungeon;
  if (
    !d.active ||
    d.dead ||
    d.invOpen ||
    d.modalOpen ||
    d.craftOpen ||
    d.weapon !== "melee" ||
    d.hv ||
    d.cd! > 0 ||
    d.down! > 0 ||
    d.guard
  )
    return false;
  const cortandoMadeira =
    kind === "axe" &&
    wpnKey(d.hero!) !== "eq_picareta" &&
    !!(arvoreCampoNaMira(aimAngle()) || troncoCampoNaMira(aimAngle()));
  if (kind === "axe" && !cortandoMadeira && d.gstam != null && d.gstam < 12) {
    spawnDungeonToast("Fôlego acabou!", d.px, d.py - 30, "#ff9a9a");
    return false;
  }
  if (kind === "axe" && d.gstam != null) {
    if (cortandoMadeira) consumirFolegoExterno(d, HV.axe.stam0!, 0.8);
    else {
      d.gstam = Math.max(0, d.gstam - HV.axe.stam0!);
      d.gregen = 0.8;
    }
  }
  // v8.1: o machado trava numa árvore (ou num tronco caído); a picareta, numa pedra
  const pica = kind === "axe" && wpnKey(d.hero!) === "eq_picareta",
    arvore = kind === "axe" && !pica ? arvoreCampoNaMira(aimAngle()) : null,
    pedra = pica ? pedraCampoNaMira(aimAngle()) : null,
    tronco = kind === "axe" && !pica && !arvore ? troncoCampoNaMira(aimAngle()) : null;
  d.hv = {
    kind,
    t: 0,
    ch: 0,
    full: false,
    ...(arvore ? { recursoId: arvore.id, recursoTipo: "arvore" as const } : {}),
    ...(pedra ? { recursoId: pedra.id, recursoTipo: "pedra" as const } : {}),
    ...(tronco ? { recursoId: tronco.id, recursoTipo: "tronco" as const } : {}),
  };
  d.moveTarget = null;
  sfx("draw");
  return true;
}
export function hvRelease(btn: string) {
  const d = dungeon,
    v = d.hv;
  if (!v) return;
  const right = v.kind === "axe" || v.kind === "clubR";
  if ((btn === "R") !== right) return;
  d.hv = null;
  if (v.kind === "axe") {
    if (v.t < 0.12) {
      spawnDungeonToast("Cancelado", d.px, d.py - 28, "#c9b88a", 11);
      return;
    }
    d.golpeMachado = {
      t: 0,
      angulo: aimAngle(),
      carga: v.ch,
      qualidade: qualidadePonto(v.ponto || 0),
      recursoId: v.recursoId,
      recursoTipo: v.recursoTipo,
    };
    if (
      v.recursoTipo === "arvore" ||
      v.recursoTipo === "tronco" ||
      (!v.recursoTipo && wpnKey(d.hero!) !== "eq_picareta" && arvoreCampoNaMira(aimAngle()))
    ) {
      d.cd = d.cdMax = 0.65;
    } else {
      d.golpeMachado.impactoAplicado = true;
      hvAxe(v.ch);
    }
  } else if (v.kind === "clubR") {
    if (v.ch < 0.35) {
      spawnDungeonToast("Soltou cedo — sem golpe", d.px, d.py - 28, "#c9b88a", 11);
      sfx("fail");
      return;
    }
    hvSmash(!v.full);
  } // 3 tempos: cedo = nada · médio = golpe com 55% de atordoar · cheio = porradão com 89%
  else if (v.kind === "clubL") {
    if (!v.full) spawnDungeonToast("Cancelado", d.px, d.py - 28, "#c9b88a", 10);
  }
}
function hvTick(dt: number) {
  const d = dungeon,
    v = d.hv;
  if (d.golpeMachado) {
    const golpe = d.golpeMachado;
    golpe.t += dt;
    if (!golpe.impactoAplicado && golpe.t >= EXAUSTAO.impactoMachadoEm) {
      golpe.impactoAplicado = true; // antes dos efeitos: um contato mesmo em quadro longo
      if (!d.dead && !(d.down! > 0) && !d.crav) hvAxe(golpe.carga);
    }
    if (d.golpeMachado.t > 0.46) d.golpeMachado = null;
  }
  if (!v) return;
  if (
    !d.active ||
    d.dead ||
    d.modalOpen ||
    d.invOpen ||
    d.down! > 0 ||
    d.weapon !== "melee" ||
    !hvKind(v.kind === "clubL" ? "L" : "R")
  ) {
    d.hv = null;
    return;
  }
  v.t += dt;
  if (v.kind === "axe" && v.recursoId) v.ponto = Math.min(100, (v.t / 1.2) * 100);
  const dur =
    HV[v.kind].dur *
    (v.kind === "clubL" ? atkSpeedMult() : 1) *
    (v.kind === "axe" ? 1 : 1 - 0.035 * profLv(d.hero!, "clava"));
  v.ch = Math.min(1, v.t / dur);
  if (v.kind === "axe" && d.gstam != null) {
    const custo = HV.axe.stamS! * (1 - 0.04 * profLv(d.hero!, "machado")) * dt,
      madeira = v.recursoTipo === "arvore" || v.recursoTipo === "tronco";
    if (madeira) consumirFolegoExterno(d, custo, 0.8);
    else {
      d.gstam = Math.max(0, d.gstam - custo);
      d.gregen = 0.8;
    }
    if (d.gstam <= 0 && !madeira) {
      d.hv = null;
      d.golpeMachado = {
        impactoAplicado: true,
        t: 0,
        carga: v.ch,
        qualidade: qualidadePonto(v.ponto || 0),
        recursoId: v.recursoId,
        recursoTipo: v.recursoTipo,
      };
      hvAxe(v.ch);
      return;
    }
  }
  if (v.ch >= 1 && !v.full) {
    v.full = true;
    sfx("ping");
    addRing(d.px, d.py, v.kind === "axe" ? "#b9a2ff" : "#ffe08a", 22, 0.25, 2);
    if (v.kind === "clubL") {
      d.hv = null;
      hvClubCombo();
    }
  }
}
function hvArc(reach: number, half: number, fn: (m: Monster) => void) {
  const d = dungeon,
    T = d.tile,
    ang = aimAngle();
  let n = 0;
  for (const m of d.monsters) {
    if (!m.alive) continue;
    const B = wolfBody(m),
      q = bodyDist(B, d.px, d.py),
      dx = q.x - d.px,
      dy = q.y - d.py,
      dist = Math.hypot(dx, dy);
    if (dist - B.r > T * reach) continue;
    if (dist > B.r && angDiff(Math.atan2(dy, dx), ang) > half + Math.asin(Math.min(1, B.r / dist))) continue;
    fn(m);
    n++;
  }
  return n;
}
function hvSlash(step: number, reach: number, half: number, som = true) {
  const d = dungeon;
  d.slash = { ang: aimAngle(), life: 0.2, step, half, reach, ox: d.px, oy: d.py };
  reveal();
  if (som) sfx("swing");
}
function qualidadePonto(ponto: number): "laranja" | "amarelo" | "verde" | "forte" {
  return ponto >= 72 ? "forte" : ponto >= 55 ? "verde" : ponto >= 30 ? "amarelo" : "laranja";
}

function hvAxeBase(ch: number) {
  const d = dungeon,
    h = d.hero!,
    W = WPN.machado,
    golpe = d.golpeMachado,
    dur = (1.2 + 3.8 * ch) * (1 + 0.05 * profLv(h, "machado")),
    angulo = golpe?.angulo ?? aimAngle(),
    // v8.1: a picareta quebra pedra, o machado corta árvore (cada um no recurso travado no começo do golpe, ou no da mira)
    ferramenta = wpnKey(h) === "eq_picareta" ? "picareta" : "machado",
    travado =
      golpe?.recursoTipo === "arvore" || golpe?.recursoTipo === "pedra"
        ? (d.recursosCampo || []).find((n) => n.id === golpe.recursoId)
        : null,
    alvo =
      travado ||
      (!golpe?.recursoTipo ? (ferramenta === "picareta" ? pedraCampoNaMira : arvoreCampoNaMira)(angulo) : null),
    troncoAlvo = golpe?.recursoTipo === "tronco" && golpe.recursoId ? troncoCampoPorId(golpe.recursoId) : null,
    recurso =
      golpe?.recursoTipo === "tronco"
        ? null
        : golpearRecursoCampo(ch, angulo, ferramenta, travado ? golpe!.qualidade : undefined, alvo?.id);
  hvSlash(2, 1.05, 1.25, !alvo && !troncoAlvo && !recurso);
  // a ferramenta errada no recurso da mira: diz qual usar
  if (!recurso && !troncoAlvo) {
    if (ferramenta === "machado" && pedraCampoNaMira(angulo))
      spawnDungeonToast("⛏ Pedra: use a picareta", d.px, d.py - 30, "#c9b88a", 11);
    else if (ferramenta === "picareta" && arvoreCampoNaMira(angulo))
      spawnDungeonToast("🪓 Árvore: use o machado", d.px, d.py - 30, "#c9b88a", 11);
  }
  if (troncoAlvo && golpe?.qualidade) {
    const msg = converterMadeiraEmGalho(troncoAlvo.id, golpe.qualidade);
    if (msg) {
      spawnDungeonToast(msg.texto, msg.x, msg.z - 24, msg.ok ? "#89d86d" : "#ffd27a", 12);
      sfx(msg.ok ? "branchwork" : "fail");
    }
  }
  if (recurso) {
    if (recurso.recurso.tipo === "arvore") consumirFolegoExterno(d, 100 * EXAUSTAO.impactoMachado, 0.8);
    efeitoGolpeRecursoCampo(recurso);
  }
  d.cd = 0.65;
  d.cdMax = 0.65;
  const n = hvArc(1.05, 1.25, (m: Monster) => {
    const dmg = meleeDmg(h) * W.mult * (0.85 + ch * 0.9);
    d.fx!.push({ x: m.x, y: m.y, life: 0.3 });
    knockApart(m, 12, 4);
    hurtMonster(m, dmg, "machado", 3);
    if (m.alive) {
      m.cripple = Math.max(m.cripple || 0, dur);
      m.crippleMax = m.cripple;
      applySlow(m, dur);
      if (m.st === "windup" && ch >= 0.5) {
        m.st = "chase";
        m.t = 0;
      }
      spawnDungeonToast("🦵 Aleijado " + dur.toFixed(1) + "s", m.x, m.y - 34, "#b9a2ff", 12);
    }
  });
  if (n) {
    shakeScreen(0.14, 3);
  }
  eqWear("maoD", 1);
}

function efeitoGolpeRecursoCampo(recurso: NonNullable<ReturnType<typeof golpearRecursoCampo>>) {
  const d = dungeon,
    h = d.hero!,
    madeira = recurso.recurso.tipo === "arvore",
    cor = madeira ? "#d19a59" : "#b9c1c9",
    nome = madeira ? "Árvore" : "Rocha",
    partes = d.parts || (d.parts = []);
  addRing(recurso.x, recurso.z, cor, recurso.quebrou ? 40 : 25, 0.35, recurso.quebrou ? 4 : 2.5);
  for (let i = 0; i < (recurso.quebrou ? 12 : 7); i++) {
    const a = Math.random() * Math.PI * 2,
      sp = 30 + Math.random() * (recurso.quebrou ? 115 : 70);
    partes.push({
      x: recurso.x,
      y: recurso.z,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 24,
      t: 0,
      life: 0.7 + Math.random() * 0.35,
      col: cor,
      r: 1.4 + Math.random() * 2,
    });
  }
  // v8.1: o que caiu no chão (a pedra solta pedra e minério a cada golpe; field/recursos_campo.ts)
  for (const k of recurso.minerios)
    spawnDungeonToast("✨ " + (ITEM_DEFS[k]?.name || k), recurso.x, recurso.z - 32, "#ffe08a", 12);
  if (recurso.quebrou) {
    if (!madeira) spawnDungeonToast(nome + " quebrada", recurso.x, recurso.z - 24, cor, 13);
    pushEvent(
      h.name +
        (madeira
          ? " derrubou uma árvore; o tronco e os galhos ficaram no chão."
          : " quebrou uma rocha; as pedras ficaram no chão."),
    );
    shakeScreen(0.2, 4);
    sfx(madeira ? "woodbreak" : "guardbreak");
  } else sfx(madeira ? "woodhit" : "hit"); // a vida que falta: a barrinha em cima dele (barrasRecursos)
}
function clubBlock(m: Monster) {
  // a pancada da clava interrompe o ataque do bicho, como um parry
  const d = dungeon;
  if (!m.alive) return false;
  if (m.kind === "javalino" && (m.st === "charge" || m.st === "bwind")) {
    m.st = "recover";
    m.t = 2.2;
    m.stunMax = 2.2;
    m.hit = true;
    applySlow(m, 1.4);
    knockApart(m, 30, 10);
    m.bcd = 2.5;
  } else if (m.st === "windup" || m.st === "leap") {
    applyStun(m, 1.1);
    knockApart(m, 24, 8);
  } else return false;
  m.flash = 0.25;
  addRing(m.x, m.y, "#ffffff", 38, 0.35, 3);
  shakeScreen(0.12, 3);
  sfx("perfect");
  spawnDungeonToast("Bloqueou!", d.px, d.py - 40, "#fff1c2", 12);
  addSwordPts(2);
  return true;
}
function hvClubCombo() {
  const d = dungeon,
    h = d.hero!,
    W = WPN.clava,
    sess = d.sess;
  const hit = (k: number, mult: number, kb: number) => {
    if (!d.active || d.dead || d.sess !== sess) return;
    const mouse = d.mouse,
      alvo = d.alvoAutomatico;
    if (alvo?.alive && !d.especialPressionado) {
      const q = bodyDist(wolfBody(alvo), d.px, d.py);
      d.mouse = { x: q.x, y: q.y };
    }
    try {
      hvSlash(k, 0.85, 0.85);
      hvArc(0.85, 0.85, (m: Monster) => {
        const blk = clubBlock(m);
        d.fx!.push({ x: m.x, y: m.y, life: 0.25 });
        if (!blk) knockApart(m, kb, 6);
        hurtMonster(m, meleeDmg(h) * W.mult * mult, "espada", 2);
      });
    } finally {
      d.mouse = mouse;
    }
  };
  hit(0, CLAVA_COMBO[0], 10);
  d.cd = CLAVA_CD;
  d.cdMax = CLAVA_CD;
  setTimeout(() => hit(1, CLAVA_COMBO[1], 22), 200);
  addSwordPts(1);
  eqWear("maoD", 1);
}
function hvSmashBase(mid: boolean) {
  const d = dungeon,
    h = d.hero!,
    W = WPN.clava;
  hvSlash(mid ? 1 : 2, mid ? 0.9 : 1.0, mid ? 0.9 : 1.0);
  d.cd = mid ? 0.6 : 0.9;
  d.cdMax = d.cd;
  const chance = Math.min(0.97, (mid ? 0.55 : 0.89) + 0.01 * profLv(h, "clava")),
    st = mid ? 1.4 : 2.6,
    mult = mid ? 1.0 : 2.1;
  const n = hvArc(mid ? 0.9 : 1.0, mid ? 0.9 : 1.0, (m: Monster) => {
    const blk = clubBlock(m);
    d.fx!.push({ x: m.x, y: m.y, life: 0.35 });
    if (!blk) knockApart(m, mid ? 18 : 34, 8);
    hurtMonster(m, meleeDmg(h) * W.mult * mult, "espada", mid ? 2 : 4);
    if (m.alive && Math.random() < chance) {
      applyStun(m, Math.max(st, m.stun || 0));
      m.flash = 0.25;
      if (!mid) addRing(m.x, m.y, "#ffffff", 40, 0.35, 3);
      spawnDungeonToast("💫 Atordoado", m.x, m.y - 34, "#ffe08a", 12);
    } else if (m.alive && !blk) spawnDungeonToast("resistiu", m.x, m.y - 30, "#c9b88a", 10);
  });
  if (!mid) addRing(d.px + Math.cos(aimAngle()) * 30, d.py + Math.sin(aimAngle()) * 30, "#e8d6a8", 36, 0.35, 4);
  shakeScreen(n ? (mid ? 0.14 : 0.25) : 0.08, n ? (mid ? 3 : 5) : 2);
  sfx(n ? (mid ? "hit" : "guardbreak") : "hitlite");
  if (n && !mid) {
    spawnDungeonToast("PORRADÃO!", d.px, d.py - 44, "#fff1c2", 14);
    addSwordPts(3);
  }
  eqWear("maoD", mid ? 1 : 2);
}
/* v6.2 — golpes pesados não saem com a arma cravada, e o dano conta como "heavy" */
function hvSmashTipos(this: unknown) {
  if (dungeon.crav || dungeon.noAtk! > 0) return;
  const o = DMG.src;
  DMG.src = "heavy";
  try {
    return hvSmashBase.apply(this, arguments as Repasse);
  } finally {
    DMG.src = o;
  }
}
function hvAxeTipos(this: unknown) {
  if (dungeon.crav) return;
  const o = DMG.src;
  DMG.src = "heavy";
  try {
    return hvAxeBase.apply(this, arguments as Repasse);
  } finally {
    DMG.src = o;
  }
}
/* v7.3 — e dividem o dano entre os alvos (areaWrap) */
const hvSmash = areaWrap(hvSmashTipos),
  hvAxe = areaWrap(hvAxeTipos);
export function hvDraw2D() {
  const d = dungeon,
    c = TELAS.dCtx,
    T = d.tile,
    v = d.hv,
    t = performance.now() / 1000;
  for (const m of d.monsters)
    if (m.alive && m.cripple! > 0) {
      c.save();
      c.strokeStyle = "rgba(185,162,255,.85)";
      c.lineWidth = 2;
      c.setLineDash([4, 3]);
      c.lineDashOffset = -t * 20;
      c.beginPath();
      c.ellipse(m.x, m.y + 4, 16, 8, 0, 0, 6.283);
      c.stroke();
      c.restore();
    }
  if (!v) return;
  const ang = aimAngle(),
    reach = T * (v.kind === "axe" ? 1.05 : v.kind === "clubR" ? 1.0 : 0.85),
    half = v.kind === "axe" ? 1.25 : v.kind === "clubR" ? 1.0 : 0.85,
    col = v.kind === "axe" ? "185,162,255" : "255,224,138";
  c.save();
  c.beginPath();
  c.moveTo(d.px, d.py);
  c.arc(d.px, d.py, reach, ang - half, ang + half);
  c.closePath();
  c.fillStyle = "rgba(" + col + "," + (0.08 + 0.2 * v.ch + (v.full ? 0.1 * Math.sin(t * 14) : 0)) + ")";
  c.fill();
  if ((v.kind === "axe" || v.kind === "clubR" || v.kind === "clubL") && (v.recursoId || v.ch > 0)) {
    // No corte, a faixa verde é o ponto de precisão; em combate, vermelho comunica carga e dano maiores.
    const ponto = Math.min(100, v.kind === "axe" && v.recursoId ? v.ponto || 0 : v.ch * 100);
    const corPonto = ponto >= 72 ? "191,73,56" : ponto >= 55 ? "112,179,78" : ponto >= 30 ? "231,189,69" : "216,117,49";
    c.beginPath();
    c.moveTo(d.px, d.py);
    c.arc(d.px, d.py, reach, ang - half, ang - half + (half * 2 * ponto) / 100);
    c.closePath();
    c.fillStyle = "rgba(" + corPonto + ",.24)";
    c.fill();
  }
  c.strokeStyle = "rgba(" + col + ",.8)";
  c.lineWidth = v.full ? 2.5 : 1.5;
  c.stroke();
  c.restore();
  c.fillStyle = "rgba(0,0,0,.55)";
  c.fillRect(d.px - 18, d.py + 26, 36, 5);
  c.fillStyle = v.full ? "#fff1c2" : v.kind === "clubR" && v.ch < 0.35 ? "#8a7a5a" : "rgb(" + col + ")";
  c.fillRect(d.px - 18, d.py + 26, 36 * v.ch, 5);
  if (v.kind === "clubR") {
    c.fillStyle = "#fff";
    c.fillRect(d.px - 18 + 36 * 0.35 - 0.5, d.py + 24, 1.5, 9);
    c.font = "10px Lora,serif";
    c.textAlign = "center";
    c.fillStyle = "#e9dcc0";
    c.fillText(v.full ? "💫 89%" : v.ch >= 0.35 ? "💫 55%" : "…", d.px, d.py + 42);
  }
  if (v.kind === "axe") {
    c.fillStyle = "#e9dcc0";
    c.font = "10px Lora,serif";
    c.textAlign = "center";
    c.fillText("🦵 " + (1.2 + 3.8 * v.ch).toFixed(1) + "s", d.px, d.py + 42);
  }
}
