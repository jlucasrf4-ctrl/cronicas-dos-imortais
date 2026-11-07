/* ==== Fase 4 — coelho, cervo e pássaros em 3D (v7.0) ==== */
import { GL3, dungeon } from "../../core/state.ts";
import { MALHA, M4 } from "./geometria.ts";
import type { Vec3 } from "./geometria.ts";
import { MB, mbIco, mbBox, glMesh, mbCyl } from "./malhas.ts";
import { glPush, angSD } from "./renderer.ts";
import { bichoAnimado } from "./bichos.ts";
import { AVE } from "../../data/campo.ts";
import { sfx } from "../../field/chao.ts";
import { spawnDungeonToast } from "../../field/masmorra.ts";
import type { AveCampo, Monster } from "../../core/tipos.ts";

/* ==== v7.0 — cervo macho/fêmea e coelho em low poly no 3D · madeira (galhos) no campo · pássaro pousado de asas fechadas e que voa (pode soltar pena) ==== */
/* ---------- malhas ---------- */
function critMeshes() {
  const G = GL3.mesh;
  if (G.critRab) return;
  const prev = MALHA._icoBoost;
  MALHA._icoBoost = 1;
  try {
    /* coelho (mesmo da cinemática) */
    MALHA._gs = 501;
    {
      const fur = "#b59a7c",
        light = "#ebdfc9",
        b = MB();
      mbIco(b, M4.ch(M4.T(-0.5, 4.4, 0), M4.S(9.5, 7, 6.6)), fur, 1, 0.12, 0.06);
      for (const s of [1, -1]) {
        mbIco(b, M4.ch(M4.T(-2.6, 3.6, 2 * s), M4.S(5.6, 5.2, 3.2)), fur, 0, 0.12, 0.06);
        mbBox(b, M4.ch(M4.T(5, 1.1, 1.3 * s), M4.S(1.5, 2.4, 1.3)), fur);
        mbBox(b, M4.ch(M4.T(-1.2, 0.7, 2.4 * s), M4.S(5, 1.3, 1.8)), fur, 0.9);
        mbBox(b, M4.ch(M4.T(6.95, 8.2, 1.65 * s), M4.S(0.9, 1.05, 0.6)), "#120c06");
        mbBox(b, M4.ch(M4.T(7.25, 8.45, 1.75 * s), M4.S(0.3, 0.3, 0.3)), "#ffffff");
      }
      mbIco(b, M4.ch(M4.T(2.6, 4.6, 0), M4.S(5, 5.4, 5.2)), light, 0, 0.1, 0.05);
      mbIco(b, M4.ch(M4.T(5.2, 7.4, 0), M4.S(5, 4.4, 4.2)), fur, 1, 0.08, 0.05);
      mbIco(b, M4.ch(M4.T(7.3, 6.8, 0), M4.S(2.6, 2.2, 2.6)), light, 0, 0.1);
      mbBox(b, M4.ch(M4.T(8.5, 7.15, 0), M4.S(0.7, 0.6, 0.9)), "#d98b8b");
      mbIco(b, M4.ch(M4.T(-5.4, 5.2, 0), M4.S(2.9)), "#f6f0e4", 0, 0.15);
      G.critRab = glMesh(b);
      const e = MB();
      mbBox(e, M4.ch(M4.T(0, 3.6, 0), M4.S(1.3, 7.2, 2.3)), fur, 0.55, 0.05);
      mbBox(e, M4.ch(M4.T(0.5, 3.4, 0), M4.S(0.5, 5.6, 1.3)), "#e3b2a8", 0.5);
      G.critEar = glMesh(e);
    }
    /* cervo: corpo, perna, pescoço+cabeça (macho com galhada) */
    for (const sx of ["M", "F"]) {
      MALHA._gs = sx === "M" ? 611 : 612;
      const fur = sx === "M" ? "#8e5f34" : "#a8784a",
        belly = "#e9dcc2",
        rump = "#f2ead8",
        dark = "#2a1c10",
        b = MB();
      mbIco(b, M4.ch(M4.T(0, 18, 0), M4.S(24, 11, 10.5)), fur, 1, 0.1, 0.05);
      mbIco(b, M4.ch(M4.T(7, 19, 0), M4.S(10, 10.5, 9.5)), fur, 0, 0.1, 0.05);
      mbIco(b, M4.ch(M4.T(1, 15, 0), M4.S(18, 6, 8.5)), belly, 0, 0.08);
      mbIco(b, M4.ch(M4.T(-11, 18.5, 0), M4.S(4.5, 7, 7)), rump, 0, 0.1);
      mbBox(b, M4.ch(M4.T(-12.6, 21, 0), M4.RZ(0.7), M4.S(2.2, 4, 2)), fur, 0.6);
      mbBox(b, M4.ch(M4.T(-12.9, 20.3, 0), M4.RZ(0.7), M4.S(1, 2.6, 1.2)), rump, 0.6);
      G["critDeer" + sx] = glMesh(b);
      const l = MB();
      mbBox(l, M4.ch(M4.T(0, -4.5, 0), M4.S(3, 9, 3)), fur, 0.7);
      mbBox(l, M4.ch(M4.T(0, -10.5, 0), M4.S(1.7, 4.2, 1.8)), fur, 0.9);
      mbBox(l, M4.ch(M4.T(0.2, -12.6, 0), M4.S(2.2, 1, 2.3)), dark);
      G["critLeg" + sx] = glMesh(l);
      const h = MB();
      mbBox(h, M4.ch(M4.T(2.5, 5, 0), M4.RZ(-0.5), M4.S(5.5, 12, 5)), fur, 0.75, 0.05);
      mbBox(h, M4.ch(M4.T(3.2, 4, 0), M4.RZ(-0.5), M4.S(3.2, 9, 5.2)), belly, 0.7);
      mbIco(h, M4.ch(M4.T(6.5, 12.5, 0), M4.S(7, 5.5, 5)), fur, 0, 0.08);
      mbBox(h, M4.ch(M4.T(10.5, 11.4, 0), M4.S(5, 3.4, 3.4)), fur, 0.8);
      mbBox(h, M4.ch(M4.T(10.8, 10.3, 0), M4.S(4.2, 1, 3)), belly);
      mbBox(h, M4.ch(M4.T(13, 11.6, 0), M4.S(0.8, 1.6, 1.8)), "#14100c");
      for (const s of [1, -1]) {
        mbBox(h, M4.ch(M4.T(8, 13.6, 2.3 * s), M4.S(1.1, 1.1, 0.5)), "#120c06");
        mbBox(h, M4.ch(M4.T(4.8, 15.5, 2.6 * s), M4.RX(0.75 * s), M4.S(1.4, 5, 2.6)), fur, 0.45);
        mbBox(h, M4.ch(M4.T(5, 15.4, 2.75 * s), M4.RX(0.75 * s), M4.S(0.5, 3.6, 1.5)), "#d8b0a0", 0.45);
        if (sx === "M") {
          const ant = "#d8c7a0",
            B: Vec3 = [5.5, 15.5, 1.6 * s],
            dir = [-0.296, 0.838, 0.458 * s],
            at = (k: number) => M4.T(B[0] + dir[0] * k, B[1] + dir[1] * k, B[2] + dir[2] * k);
          mbCyl(h, M4.ch(M4.T(...B), M4.RX(0.5 * s), M4.RZ(0.3), M4.S(1.2, 10, 1.2)), ant, 5, 0.6);
          mbCyl(h, M4.ch(at(1.6), M4.RX(0.15 * s), M4.RZ(-1.1), M4.S(0.8, 3.6, 0.8)), ant, 4, 0.3);
          mbCyl(h, M4.ch(at(5), M4.RX(0.2 * s), M4.RZ(-0.7), M4.S(0.8, 5, 0.8)), ant, 4, 0.3);
          mbCyl(h, M4.ch(at(7.5), M4.RX(0.3 * s), M4.RZ(-0.3), M4.S(0.75, 4.5, 0.75)), ant, 4, 0.3);
          mbCyl(h, M4.ch(at(9.6), M4.RX(0.45 * s), M4.RZ(0.5), M4.S(0.7, 3.6, 0.7)), ant, 4, 0.3);
        }
      }
      G["critHead" + sx] = glMesh(h);
    }
    /* pássaro pousado: asas fechadas junto ao corpo + perninhas */
    MALHA._gs = 34;
    {
      const f = MB();
      for (const s of [1, -1]) {
        mbBox(f, M4.ch(M4.T(-1.4, 5.1, 2.05 * s), M4.RY(0.12 * s), M4.RZ(0.18), M4.S(6.8, 2.6, 0.7)), "#3a78c0", 0.7);
        mbBox(f, M4.ch(M4.T(0.4, 1.3, 0.9 * s), M4.S(0.45, 2.6, 0.45)), "#e0902a");
        mbBox(f, M4.ch(M4.T(0.9, 0.15, 0.9 * s), M4.S(1.6, 0.3, 0.9)), "#e0902a");
      }
      G.wingF = glMesh(f);
    }
    for (const k of [
      "critRab",
      "critEar",
      "critDeerM",
      "critDeerF",
      "critLegM",
      "critLegF",
      "critHeadM",
      "critHeadF",
      "wingF",
    ])
      if (G[k]) G[k].ol = true;
  } finally {
    MALHA._icoBoost = prev;
  }
}

/* ---------- coelho e cervo no 3D ---------- */
export function critGL(m: Monster) {
  critMeshes();
  const G = GL3.mesh,
    t = performance.now() / 1000;
  if (m._gx == null) {
    m._gx = m.x;
    m._gy = m.y;
    m._yy = m.ang || 0;
    m._ph = Math.random() * 6;
    m._hd = 0;
  }
  const mv = Math.hypot(m.x - m._gx, m.y - m._gy!);
  m._gx = m.x;
  m._gy = m.y;
  const moving = mv > 0.05 && !(m.ko! > 0);
  if (moving) m._ph! += mv * (m.sp === "rabbit" ? 0.32 : 0.2);
  const want = m.crav && m._yaw != null ? m._yaw : m.ang || 0;
  m._yy! += angSD(want, m._yy!) * 0.2;
  const tint = m.flash! > 0.04 ? [1, 1, 1, 0.75] : m.hitT! > 0 ? [1, 0.15, 0.15, 0.4] : null,
    ko = m.ko! > 0;
  /* v7.7 — modelos animados do pacote craftpix (render/gl/bichos.ts); caído = deitado de lado */
  {
    const coelho = m.sp === "rabbit",
      raposa = m.sp === "fox", // v8.0
      cervo = !coelho && !raposa,
      ma = bichoAnimado(m, coelho ? "coelho" : raposa ? "raposa" : m.sex === "M" ? "cervo_m" : "cervo_f", m.x, m.y, {
        fixo: ko ? "parada" : undefined,
        pastar: cervo && !moving && m.st === "graze",
      });
    if (ma) {
      glPush(ma, M4.ch(M4.T(m.x, ko ? (cervo ? 5 : 2) : 0, m.y), M4.RY(-m._yy!), ko ? M4.RX(1.45) : M4.id()), tint);
      return;
    }
  }
  if (m.sp === "rabbit") {
    const hop = moving ? Math.abs(Math.sin(m._ph!)) : 0,
      sc = 1.05;
    const base = M4.ch(
      M4.T(m.x, hop * 5 + (ko ? 3 : 0), m.y),
      M4.RY(-m._yy!),
      M4.S(sc),
      ko ? M4.RX(1.45) : M4.RZ(moving ? -0.18 * Math.cos(m._ph!) : 0),
    );
    glPush(G.critRab, base, tint);
    const tw =
      m.st === "flee"
        ? -0.45
        : Math.sin(t * 2.6 + m.x) * 0.08 + (Math.sin(t * 0.7 + m.y) > 0.92 ? Math.sin(t * 30) * 0.12 : 0);
    for (const s of [1, -1])
      glPush(G.critEar, M4.ch(base, M4.T(5, 9.2, s), M4.RX(0.2 * s), M4.RZ(0.3 + tw + (s > 0 ? 0.04 : 0))), tint);
    return;
  }
  const sx = m.sex === "M" ? "M" : "F",
    sc = sx === "M" ? 1.0 : 0.88,
    run = m.st === "flee",
    bob = moving ? Math.abs(Math.sin(m._ph!)) * (run ? 2.2 : 0.8) : 0;
  const base = M4.ch(
    M4.T(m.x, bob + (ko ? 5 : 0), m.y),
    M4.RY(-m._yy!),
    M4.S(sc),
    ko ? M4.RX(1.45) : M4.RZ(run && moving ? -0.06 * Math.cos(m._ph!) : 0),
  );
  glPush(G["critDeer" + sx], base, tint);
  const hdWant = ko ? 0.3 : !moving && m.st === "graze" ? -1.15 : run ? 0.2 : 0;
  m._hd! += (hdWant - m._hd!) * 0.06;
  glPush(
    G["critHead" + sx],
    M4.ch(base, M4.T(9, 22, 0), M4.RZ(m._hd! + (m.st === "graze" && !moving ? Math.sin(t * 5) * 0.04 : 0))),
    tint,
  );
  for (const [hx, hz, ph] of [
    [7, 3.2, 0],
    [7, -3.2, Math.PI],
    [-7.5, 3.2, Math.PI],
    [-7.5, -3.2, 0],
  ]) {
    const a = ko ? (hx > 0 ? 0.5 : -0.5) : moving ? Math.sin(m._ph! + ph) * (run ? 0.75 : 0.45) : 0;
    glPush(G["critLeg" + sx], M4.ch(base, M4.T(hx, 13, hz), M4.RZ(a)), tint);
  }
}
export function birdGL(bd: AveCampo, now: number) {
  const G = GL3.mesh;
  critMeshes();
  const fly = bd.st === "fly",
    hop = bd.st === "hop";
  if (Math.hypot(bd.tx - bd.x, bd.ty - bd.y) > 0.5) bd._yw = Math.atan2(bd.ty - bd.y, bd.tx - bd.x);
  const yaw = bd._yw || 0;
  const up = fly ? bd.alt || 0 : hop ? Math.abs(Math.sin(now / 90 + bd.vr)) * 3 : 0,
    peck = !fly && !hop && Math.sin(now / 700 + bd.vr * 3) > 0.7 ? 0.35 : 0;
  const base = M4.ch(M4.T(bd.x, up, bd.y), M4.RY(-yaw), M4.S(1.6), M4.RZ(fly ? -0.12 : -peck));
  glPush(G.bird, base);
  if (fly) {
    const fl = Math.sin(now / 45 + bd.vr) * 0.9;
    glPush(G.wing, M4.ch(base, M4.T(0, 5.5, 1.5), M4.RX(fl)));
    glPush(G.wing, M4.ch(base, M4.T(0, 5.5, -1.5), M4.RY(Math.PI), M4.RX(fl)));
  } else glPush(G.wingF, base);
}

/* ---------- pássaros: pousado = asas fechadas; voa quando você chega perto (ou de vez em quando) e pode soltar uma pena ---------- */
function birdTakeoff(b: AveCampo) {
  const d = dungeon,
    T = d.tile;
  let fx,
    fy,
    n = 0;
  do {
    fx = T * 2 + Math.random() * (d.cols * T - T * 4);
    fy = T * 2 + Math.random() * (d.rows * T - T * 4);
  } while (n++ < 20 && (Math.hypot(fx - d.px, fy - d.py) < T * 7 || Math.hypot(fx - b.x, fy - b.y) < T * 5));
  b.st = "fly";
  b.fx = fx;
  b.fy = fy;
  b.fd = Math.hypot(fx - b.x, fy - b.y) || 1;
  b.alt = 0;
  b.flyT = AVE.vooAleatorio[0] + Math.random() * (AVE.vooAleatorio[1] - AVE.vooAleatorio[0]);
  try {
    sfx("bird");
  } catch (_) {}
  if (!b.pena && Math.random() < AVE.penaChance) {
    b.pena = true;
    d.loot = d.loot || [];
    d.loot.push({
      key: "pena",
      ground: true,
      t: 0,
      ttl: 0,
      x: b.x + (Math.random() - 0.5) * 10,
      y: b.y + (Math.random() - 0.5) * 10,
    });
    spawnDungeonToast("🪶", b.x, b.y - 20, "#e8f0ff", 12);
  }
}
export function birdFly(b: AveCampo, dt: number) {
  const d = dungeon,
    T = d.tile;
  if (b.st !== "fly") {
    if (!(dt > 0) || !d.active || d.dead) return false;
    if (b.flyT == null) b.flyT = AVE.vooAleatorio[0] + Math.random() * (AVE.vooAleatorio[1] - AVE.vooAleatorio[0]);
    b.flyT -= dt;
    const dp = Math.hypot(d.px - b.x, d.py - b.y);
    if (dp < T * AVE.susto * (d.running ? 1.6 : 1) || b.flyT <= 0) birdTakeoff(b);
    return b.st === "fly";
  }
  if (!(dt > 0)) return true;
  const dx = b.fx! - b.x,
    dy = b.fy! - b.y,
    dist = Math.hypot(dx, dy),
    st = Math.min(AVE.vel * dt, dist);
  if (dist > 0.5) {
    b.x += (dx / dist) * st;
    b.y += (dy / dist) * st;
  }
  const k = 1 - dist / b.fd!;
  b.alt = AVE.alt * Math.min(1, k * 4) * Math.min(1, (1 - k) * 4 + 0.05);
  b.tx = b.fx!;
  b.ty = b.fy!;
  if (dist < 1) {
    b.st = "idle";
    b.alt = 0;
    b.t = 1 + Math.random() * 2;
    b.tx = b.x + Math.cos(b._yw || 0);
    b.ty = b.y + Math.sin(b._yw || 0);
  }
  return true;
}
