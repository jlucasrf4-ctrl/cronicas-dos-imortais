/* ==== Fase 4 — sala de treino e o campo de teste (v5.0) ==== */
import { GL3, dungeon, econ, world } from "../core/state.ts";
import { MALHA, M4 } from "../render/gl/geometria.ts";
import { MB, mbCyl, mbIco, mbBox, glMesh, gmix, grnd, glFree } from "../render/gl/malhas.ts";
import { glPush } from "../render/gl/renderer.ts";
import { mbTree } from "../render/gl/modelos.ts";
import { ensureEquip, mkItem } from "../items/equipamento.ts";
import { setBanner, spawnDungeonMonster, switchWeapon } from "./masmorra.ts";
import { eqDurInit, eqName } from "../items/durabilidade.ts";
import { attrBase, hpMaxOf, afText, afSum, attrOf, statsHtml } from "../hero/atributos.ts";
import { addRing } from "./chao.ts";
import { MOB } from "../ui/celular.ts";
import { exitDungeon, closePrep, launchDungeon } from "../expedicao/preparo.ts";
import { TR_WPN } from "../data/combate.ts";
import { QUAL } from "../data/equipamento.ts";
import { ATTR_DEFS } from "../data/nascimento.ts";
import { icoAttr, icoItem } from "../ui/icones.ts";
import { ensureHero } from "../hero/nivel.ts";
import { pushEvent } from "../sim/eventos.ts";
import { prep } from "../econ/economia.ts";
import { vestidos, desenharManequim } from "../render/gl/vestidos.ts";
import { abrirModelosTeste } from "../ui/modelos_teste.ts";
import type { Item, Monster } from "../core/tipos.ts";
import type { Mat4 } from "../render/gl/geometria.ts";

export function glDummy(m: Monster) {
  if (!GL3.mesh.dummy) {
    const prev = MALHA._icoBoost;
    MALHA._icoBoost = 1;
    const b = MB(),
      wood = "#7a4e28",
      straw = "#d9b45a",
      rope = "#8a6a3a",
      sack = "#c8b28a";
    mbCyl(b, M4.ch(M4.T(0, 1.5, 0), M4.S(10, 3, 10)), "#5e4a35", 10, 1);
    mbCyl(b, M4.ch(M4.T(0, 22, 0), M4.S(2.6, 40, 2.6)), wood, 8, 1, 0.04);
    mbCyl(b, M4.ch(M4.T(0, 28, 0), M4.S(9, 22, 8)), straw, 10, 1.4, 0.08);
    for (const y of [20, 30, 37]) mbCyl(b, M4.ch(M4.T(0, y, 0), M4.S(9.6, 1.6, 8.6)), rope, 10, 1);
    mbCyl(b, M4.ch(M4.T(0, 34, 0), M4.RX(Math.PI / 2), M4.S(1.8, 30, 1.8)), wood, 6, 1);
    mbIco(b, M4.ch(M4.T(0, 46, 0), M4.S(6.4, 6.8, 6.4)), sack, 1, 0.08, 0.04);
    mbBox(b, M4.ch(M4.T(5.6, 47, 0), M4.S(0.8, 1.2, 3.2)), "#3a2a1a");
    mbCyl(b, M4.ch(M4.T(6.2, 28, 0), M4.RZ(Math.PI / 2), M4.S(5, 1, 5)), "#c03a2a", 12, 1);
    mbCyl(b, M4.ch(M4.T(6.6, 28, 0), M4.RZ(Math.PI / 2), M4.S(2.4, 1, 2.4)), "#f4f1ea", 12, 1);
    MALHA._icoBoost = prev;
    const mesh = glMesh(b);
    mesh.ol = true;
    GL3.mesh.dummy = mesh;
  }
  const w = m.wob || 0,
    now = performance.now() / 1000,
    tilt = w * 0.32 * Math.cos(now * 18) * w,
    face = Math.atan2(dungeon.py - m.y, dungeon.px - m.x);
  if (m.model === "alvo") {
    glAlvo(m);
    return;
  }
  if (m.model?.startsWith("vestido:")) {
    // de frente para a câmera (que olha do sul): +z
    desenharManequim(m.model.slice(8), m.x, m.y, Math.PI / 2, m.flash! > 0 ? [1, 1, 1, 0.5] : null);
    return;
  }
  glPush(
    GL3.mesh.dummy,
    M4.ch(M4.T(m.x, 0, m.y), M4.S(1.3), M4.RY(-(m.wobA || 0)), M4.RZ(-tilt), M4.RY((m.wobA || 0) - face)),
    m.flash! > 0 ? [1, 1, 1, 0.5] : null,
  );
}

/* ---------- DUNGEON TESTE: o mapa do campo de treino ---------- */
function glAlvo(m: Monster) {
  if (!GL3.mesh.alvo) {
    const prev = MALHA._icoBoost;
    MALHA._icoBoost = 1;
    const b = MB(),
      wood = "#7a4e28";
    for (const s of [-1, 1]) mbBox(b, M4.ch(M4.T(s * 10, 19, 3), M4.RZ(s * -0.12), M4.S(2.4, 40, 2.4)), wood, 1, 0.04);
    mbBox(b, M4.ch(M4.T(0, 17, -8), M4.RX(-0.42), M4.S(2.2, 38, 2.2)), wood, 1, 0.04);
    const F = (M: Mat4) => M4.ch(M4.T(0, 30, -2), M4.RX(-0.45), M);
    mbCyl(b, F(M4.ch(M4.RX(Math.PI / 2), M4.S(16.5, 5, 16.5))), "#c9a25a", 18, 1, 0.05);
    (
      [
        ["#f4f1ea", 15],
        ["#2b2b2b", 12.4],
        ["#3f7dd8", 9.8],
        ["#c03a2a", 7],
        ["#ffd24a", 3.8],
      ] as [string, number][]
    ).forEach(([c, r], i) =>
      mbCyl(b, F(M4.ch(M4.T(0, 0, 5.3 + i * 0.12), M4.RX(Math.PI / 2), M4.S(r, 0.6, r))), c, 20, 1),
    );
    MALHA._icoBoost = prev;
    const mesh = glMesh(b);
    mesh.ol = true;
    GL3.mesh.alvo = mesh;
  }
  const w = m.wob || 0,
    now = performance.now() / 1000,
    face = Math.max(-0.6, Math.min(0.6, (dungeon.px - m.x) / 300));
  glPush(
    GL3.mesh.alvo,
    M4.ch(M4.T(m.x, 0, m.y), M4.S(1.25), M4.RY(-face), M4.RX(w * 0.08 * Math.cos(now * 22))),
    m.flash! > 0 ? [1, 1, 1, 0.45] : null,
  );
}
function arenaCol(
  x: number,
  z: number,
  B: { x0: number; x1: number; z0: number; z1: number; T: number; lane: number },
) {
  const n = (Math.sin(x * 0.011 + z * 0.006) + Math.sin(x * 0.004 - z * 0.008 + 1.7)) / 2,
    din = Math.min(x - B.x0, B.x1 - x, z - B.z0, B.z1 - z);
  let c = gmix("#9fb75e", "#b9c86a", 0.5 + n * 0.5);
  if (din > -B.T * 0.4) {
    const k = Math.max(0, Math.min(1, (din + B.T * 0.4) / (B.T * 0.8)));
    c = gmix(c, gmix("#c9a26a", "#d8b77e", 0.5 + n * 0.6), k);
  }
  const lane = Math.abs(z - B.lane) < B.T * 0.55 && x > B.x0 + B.T * 4.5;
  if (lane && din > 0) c = gmix(c, "#e6cf93", 0.45); // faixa de tiro até o alvo
  const st = Math.sin(x * 0.19 + z * 0.07) * Math.sin(z * 0.23 - x * 0.05);
  if (din > 0 && st > 0.6) c = gmix(c, "#e2c46a", 0.5); // palha espalhada
  const k = 0.95 + Math.sin(x * 0.11) * Math.sin(z * 0.13) * 0.035;
  return [c[0] * k, c[1] * k, c[2] * k];
}
export function glBuildArena() {
  const d = dungeon,
    T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    e = d.entrance,
    b = MB(),
    o = MB();
  MALHA._gs = 909;
  const B = { x0: T * 0.6, x1: W - T * 0.6, z0: T * 0.6, z1: H - T * 0.6, T, lane: H / 2 - T * 1.6 };
  for (let gy = -8; gy < d.rows + 7; gy++)
    for (let gx = -10; gx < d.cols + 10; gx++) {
      const x = gx * T,
        z = gy * T,
        S = x > B.x0 - 3 * T && x < B.x1 + 3 * T && z > B.z0 - 3 * T && z < B.z1 + 3 * T ? 2 : 1,
        s = T / S;
      for (let i = 0; i < S; i++)
        for (let j = 0; j < S; j++) {
          const ax = x + i * s,
            az = z + j * s,
            P = [
              [ax, az],
              [ax + s, az],
              [ax + s, az + s],
              [ax, az + s],
            ],
            C = P.map((p) => arenaCol(p[0], p[1], B));
          for (const t of [
            [0, 2, 1],
            [0, 3, 2],
          ])
            for (const q of t) {
              b.p.push(P[q][0], 0, P[q][1]);
              b.n.push(0, 1, 0);
              b.c.push(C[q][0], C[q][1], C[q][2]);
            }
        }
    }
  const wood = "#8a5a2b",
    dark = "#5e3d1e",
    straw = "#e0bf62";
  // cerca de madeira em volta do campo (com portão na entrada)
  const post = (x: number, z: number, h: number) => {
    mbBox(
      o,
      M4.ch(M4.T(x, h / 2, z), M4.RY((grnd() - 0.5) * 0.2), M4.S(4, h, 4)),
      gmix(wood, dark, grnd() * 0.5),
      1,
      0.05,
    );
    mbBox(o, M4.ch(M4.T(x, h + 1, z), M4.RY(0.785), M4.S(3, 2.4, 3)), dark);
  };
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0),
      a = Math.atan2(z1 - z0, x1 - x0);
    for (const y of [8, 15])
      mbBox(
        o,
        M4.ch(M4.T((x0 + x1) / 2, y, (z0 + z1) / 2), M4.RY(-a), M4.S(L, 2.2, 1.6)),
        gmix(wood, "#a07040", grnd() * 0.4),
        1,
        0.04,
      );
  };
  const edge = (x0: number, z0: number, x1: number, z1: number, gap?: (x: number, z: number) => boolean) => {
    const L = Math.hypot(x1 - x0, z1 - z0),
      n = Math.max(1, Math.round(L / (T * 0.9)));
    let px = x0,
      pz = z0;
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        x = x0 + (x1 - x0) * t,
        z = z0 + (z1 - z0) * t;
      const mx = (px + x) / 2,
        mz = (pz + z) / 2;
      if (!(gap && gap(mx, mz))) rail(px, pz, x, z);
      post(px, pz, 18);
      px = x;
      pz = z;
    }
    post(x1, z1, 18);
  };
  const gate = (x: number, z: number) => Math.abs(z - e.y) < T * 1.6 && x < B.x0 + 2;
  edge(B.x0, B.z0, B.x1, B.z0);
  edge(B.x1, B.z0, B.x1, B.z1);
  edge(B.x1, B.z1, B.x0, B.z1);
  edge(B.x0, B.z1, B.x0, B.z0, gate);
  // portal de entrada com placa
  for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(B.x0, 22, e.y + s * T * 1.5), M4.S(5, 44, 5)), dark, 1, 0.05);
  mbBox(o, M4.ch(M4.T(B.x0, 44, e.y), M4.S(6, 4, T * 3 + 12)), wood, 1, 0.04);
  mbBox(o, M4.ch(M4.T(B.x0 + 1, 36, e.y), M4.S(2, 9, T * 1.6)), "#c9a25a", 1, 0.04);
  for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(B.x0 + 1.5, 40.5, e.y + s * T * 0.6), M4.S(0.8, 5, 0.8)), dark);
  // fardos de feno, barris e o suporte de armas
  const bale = (x: number, z: number, a: number) => {
    mbBox(o, M4.ch(M4.T(x, 6, z), M4.RY(a), M4.S(18, 12, 11)), gmix(straw, "#cfa848", grnd()), 1.2, 0.08);
    for (const k of [-5, 5]) mbBox(o, M4.ch(M4.T(x, 6, z), M4.RY(a), M4.T(k, 0, 0), M4.S(1.2, 12.4, 11.4)), "#9a7a3a");
  };
  bale(B.x0 + T * 1.2, B.z0 + T * 0.8, 0.1);
  bale(B.x0 + T * 1.6, B.z0 + T * 1.5, 1.4);
  bale(B.x1 - T * 1.1, B.z1 - T * 0.8, -0.2);
  bale(B.x1 - T * 2.2, B.z1 - T * 0.75, 0.3);
  mbBox(o, M4.ch(M4.T(B.x1 - T * 1.6, 18, B.z1 - T * 0.75), M4.S(18, 12, 11)), straw, 1.2, 0.08);
  const barrel = (x: number, z: number) => {
    mbCyl(o, M4.ch(M4.T(x, 9, z), M4.S(7, 18, 7)), "#7a4e28", 12, 1, 0.06);
    for (const y of [3, 15]) mbCyl(o, M4.ch(M4.T(x, y, z), M4.S(7.4, 1.4, 7.4)), "#4a4a4a", 12, 1);
  };
  barrel(B.x1 - T * 0.9, B.z0 + T * 0.9);
  barrel(B.x1 - T * 1.5, B.z0 + T * 0.8);
  barrel(B.x0 + T * 1.0, B.z1 - T * 0.9);
  const rx = B.x0 + T * 6,
    rz = B.z0 + T * 0.55; // suporte de armas no fundo
  for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(rx + s * T * 1.4, 14, rz), M4.S(3, 28, 3)), dark, 1, 0.04);
  for (const y of [8, 24]) mbBox(o, M4.ch(M4.T(rx, y, rz), M4.S(T * 2.9, 2.4, 3)), wood, 1, 0.04);
  for (let i = 0; i < 6; i++) {
    const x = rx - T * 1.1 + i * T * 0.44,
      k = i % 3;
    mbCyl(o, M4.ch(M4.T(x, 17, rz + 2.5), M4.RX(0.15), M4.S(1.1, 30, 1.1)), "#6a4524", 6, 1);
    if (k === 0) mbBox(o, M4.ch(M4.T(x, 31, rz + 4.2), M4.RX(0.15), M4.S(1, 7, 4)), "#d8dee6");
    else if (k === 1) mbCyl(o, M4.ch(M4.T(x, 33, rz + 4.6), M4.RX(0.15), M4.S(2.2, 5, 2.2)), "#d8dee6", 4, 0);
    else mbIco(o, M4.ch(M4.T(x, 31, rz + 4.4), M4.S(3, 4, 3)), "#7a4e28", 0, 0.1, 0.05);
  }
  // estandartes nos cantos
  for (const [x, z, c] of [
    [B.x0 + 4, B.z0 + 4, "#c03a2a"],
    [B.x1 - 4, B.z0 + 4, "#3f7dd8"],
  ] as [number, number, string][]) {
    mbCyl(o, M4.ch(M4.T(x, 26, z), M4.S(1.4, 52, 1.4)), dark, 6, 1);
    mbBox(o, M4.ch(M4.T(x + 7, 42, z), M4.S(13, 16, 0.8)), c, 1, 0.05);
    mbBox(o, M4.ch(M4.T(x + 7, 42, z + 0.5), M4.S(5, 5, 0.6)), "#ffe08a");
  }
  // marcas de distância na faixa de tiro
  for (let i = 1; i <= 4; i++) {
    const x = B.x1 - T * 2.6 - i * T * 1.5;
    if (x < B.x0 + T * 4) break;
    mbBox(o, M4.ch(M4.T(x, 3, B.lane + T * 0.75), M4.S(2, 6, 2)), "#f4f1ea", 1, 0.03);
  }
  // em volta: barracas, árvores e pedras (fora da cerca)
  const tent = (x: number, z: number, a: number, c: string) => {
    mbBox(o, M4.ch(M4.T(x, 0, z), M4.RY(a), M4.RX(Math.PI / 4), M4.S(20, 20, 26)), c, 1, 0.04);
    mbBox(o, M4.ch(M4.T(x, 0, z), M4.RY(a), M4.S(1.6, 30, 1.6)), dark);
  };
  tent(-T * 2.2, -T * 1.6, 0.3, "#e6dcc4");
  tent(W + T * 1.8, -T * 1.4, -0.4, "#c9a2a2");
  tent(W + T * 2.6, H * 0.55, 0.9, "#e6dcc4");
  for (let x = -6 * T; x < W + 6 * T; x += T * (0.9 + grnd() * 0.6))
    mbTree(o, x, -T * (1.4 + grnd() * 2.2), grnd() < 0.3 ? 1 : 0, 0.85 + grnd() * 0.4);
  for (const side of [0, 1])
    for (let z = -T; z < H + 2 * T; z += T * (1 + grnd() * 0.7)) {
      const x = side ? W + T * (1.2 + grnd() * 3) : -T * (1.2 + grnd() * 3);
      if (Math.hypot(x - e.x, z - e.y) < T * 3) continue;
      if (grnd() < 0.6) mbTree(o, x, z, grnd() < 0.3 ? 1 : 3, 0.8 + grnd() * 0.4);
      else mbIco(o, M4.ch(M4.T(x, 4, z), M4.RY(grnd() * 3), M4.S(12, 9, 11)), "#868a90", 0, 0.35, 0.12);
    }
  for (let x = -T * 2; x < W + T * 2; x += T * (1.4 + grnd()))
    mbTree(o, x, H + T * (0.6 + grnd() * 1.2), 3, 0.55 + grnd() * 0.2);
  for (let i = 0; i < 90; i++) {
    const x = -2 * T + grnd() * (W + 4 * T),
      z = -T + grnd() * (H + 2 * T);
    const inA = x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1;
    if (inA && grnd() < 0.8) continue;
    for (let j = 0; j < 3; j++) {
      const a = grnd() * 6.28;
      mbCyl(
        o,
        M4.ch(
          M4.T(x + Math.cos(a) * 1.5, 0, z + Math.sin(a) * 1.5),
          M4.RX((grnd() - 0.5) * 0.9),
          M4.RZ((grnd() - 0.5) * 0.9),
          M4.S(0.5, 5 + grnd() * 3, 0.5),
        ),
        inA ? "#d8b450" : "#7d9a3e",
        3,
        0,
      );
    }
  }
  return { floor: glMesh(b), deco: glMesh(o) };
}

/* ---------- SALA DE TREINO ---------- */
export const TR = {
  pending: false,
  hits: [] as { t: number; dmg: number; crit: boolean; dot: boolean; skill: string }[],
  tot: 0,
  n: 0,
  max: 0,
  crits: 0,
  direct: 0,
  t0: 0,
  wolf: false,
  human: false,
  ui: 0,
  eq0: null as { maoD: Item | null; costas: Item | null } | null,
  wear0: false,
  hp0: 0,
  q: 1,
};
export const DG_SIZE = { cols: dungeon.cols, rows: dungeon.rows },
  TR_SIZE = { cols: 17, rows: 11 };
/** v8.0 — a grade de manequins (em tiles): `colunas` por linha, a partir de `z` da cerca de baixo. */
const FILA = { x0: 3, x1: 14.2, z: 2.2, colunas: 25, entreLinhas: 1.25, perto: 0.9 };
/** v8.0 — o manequim (personagem vestido) ao alcance do E na sala de treino, ou null. */
export function manequimPerto() {
  const d = dungeon;
  if (!d.active || !d.training) return null;
  let melhor: Monster | null = null,
    md = d.tile * FILA.perto;
  for (const m of d.monsters) {
    if (!m.alive || !m.model?.startsWith("vestido:")) continue;
    const dist = Math.hypot(m.x - d.px, m.y - d.py);
    if (dist < md) {
      md = dist;
      melhor = m;
    }
  }
  return melhor ? { nome: melhor.model!.slice(8), rotulo: melhor.name! } : null;
}
export function trainSetup() {
  const d = dungeon,
    h = d.hero!,
    T = d.tile,
    e = ensureEquip(h);
  d.training = true;
  d.mode = "training";
  d.flow = "training";
  d.banner = null;
  d.birds = [];
  d.birdQ = [];
  d.loot = [];
  d.monsters = [];
  for (const r of d.runes || [])
    if (r._m) {
      try {
        glFree(r._m.patch);
        glFree(r._m.glyph);
      } catch (_) {}
    }
  d.runes = [];
  TR.eq0 = { maoD: e.maoD, costas: e.costas };
  TR.wear0 = !!econ.noWear;
  econ.noWear = true;
  TR.hp0 = d.hp;
  d.hp = d.hpMax;
  h._trAttr = {};
  TR.wolf = false;
  TR.human = false;
  d.px = T * 3.6;
  d.py = (d.rows * T) / 2;
  const mk = (name: string, model: string, x: number, y: number) => ({
    name,
    model,
    kind: "dummy",
    dummy: true,
    x,
    y,
    hp: 1e6,
    hpMax: 1e6,
    alive: true,
    st: "dummy",
    t: 0,
    dm: 0,
    spd: 0,
    ang: Math.PI,
    atk: "none",
    pcd: 99,
    coat: 0,
    wu: 1,
  });
  d.monsters.push(
    mk("Boneco de Treino", "boneco", T * 6.2, d.py),
    mk("Alvo de Arco", "alvo", T * (d.cols - 2.6), d.py - T * 1.6),
  );
  // v8.1 — a grade evita sobrepor os corpos quando entram mais variações de roupa (E veste: render/gl/vestidos.ts)
  const V = vestidos();
  V.forEach((v, i) => {
    const linha = Math.floor(i / FILA.colunas),
      inicio = linha * FILA.colunas,
      naLinha = Math.min(FILA.colunas, V.length - inicio),
      coluna = i - inicio;
    d.monsters.push(
      mk(
        v.rotulo,
        "vestido:" + v.nome,
        T * (FILA.x0 + (coluna * (FILA.x1 - FILA.x0)) / Math.max(1, naLinha - 1)),
        d.rows * T - T * (FILA.z + linha * FILA.entreLinhas),
      ),
    );
  });
  trainReset();
  GL3.sceneKey = "";
  setBanner(
    "🧪 DUNGEON TESTE",
    "Campo de treino · teste stamina, debilitamento, CC e finalização humana",
    4,
    "#9fe3ff",
  );
  trainHud(true);
}
function trainReset() {
  TR.hits = [];
  TR.tot = 0;
  TR.n = 0;
  TR.max = 0;
  TR.crits = 0;
  TR.direct = 0;
  TR.t0 = 0;
  trainUI(true);
}
export function trainRecord(dmg: number, crit: boolean, dot: boolean, skill: string) {
  const now = performance.now() / 1000;
  if (!TR.t0) TR.t0 = now;
  TR.hits.push({ t: now, dmg, crit, dot, skill });
  if (TR.hits.length > 400) TR.hits.shift();
  TR.tot += dmg;
  TR.n++;
  if (!dot) {
    TR.direct++;
    if (crit) TR.crits++;
  }
  TR.max = Math.max(TR.max, dmg);
}
export function trainDps() {
  const now = performance.now() / 1000,
    w = TR.hits.filter((x) => now - x.t <= 5);
  if (!w.length) return 0;
  const span = Math.max(1, Math.min(5, now - w[0].t + 0.35));
  return w.reduce((s, x) => s + x.dmg, 0) / span;
}
export function trainRestore() {
  const d = dungeon,
    h = d.hero;
  if (!h) return;
  const e = ensureEquip(h);
  if (TR.eq0) {
    e.maoD = TR.eq0.maoD;
    e.costas = TR.eq0.costas;
    TR.eq0 = null;
  }
  delete h._trAttr;
  econ.noWear = TR.wear0;
  d.hp = TR.hp0;
  for (const m of d.monsters) m.alive = false;
  d.training = false;
  TR.wolf = false;
  TR.human = false;
  GL3.heroKey = "";
}
export function trainWolf() {
  const d = dungeon,
    m = spawnDungeonMonster();
  m.x = d.px + d.tile * 4;
  m.y = d.py - d.tile * 1.5;
  m.st = "chase";
  m.alerted = true;
  return m;
}
/** Adversário da sala de testes: percorre o mesmo fluxo de dano, CC e finalização dos humanos. */
export function trainHuman() {
  const d = dungeon;
  if (!d.active || !d.training) return null;
  const estilos = ["agressivo", "calculista", "acrobata"] as const,
    personalidade = estilos[Math.floor(Math.random() * estilos.length)];
  for (const old of d.monsters)
    if (old.humano) {
      old.alive = false;
      if (d.target === old) d.target = null;
    }
  const m = spawnDungeonMonster({ hpMult: 7, spdMult: 0.9 });
  m.name =
    personalidade === "agressivo"
      ? "Parceiro Impulsivo"
      : personalidade === "acrobata"
        ? "Parceiro Acrobata"
        : "Parceiro Calculista";
  m.kind = "humano";
  m.model = "cacador";
  m.humano = true;
  m.humanoCC = true;
  m.humanoFolego = 100;
  m.humanoArma = "melee";
  m.humanoEscudo = true;
  m.humanoPersonalidade = personalidade;
  m.humanoTrocaCd = 0;
  m.hpMax = 160;
  m.hp = m.hpMax;
  m.dm = 1;
  m.spd = 34;
  m.st = "chase";
  m.atk = "punch";
  m.pcd = 0.8;
  m.cmt = 0.4;
  m.lowSet = true;
  m.alerted = true;
  m.dummy = false;
  m.x = d.px + d.tile * 3.2;
  m.y = d.py - d.tile * 0.6;
  TR.human = true;
  addRing(m.x, m.y, "#ffc66b", 38, 0.55, 3);
  const estilo =
    personalidade === "agressivo"
      ? "Força a aproximação e arrisca golpes pesados."
      : personalidade === "acrobata"
        ? "Circula, esquiva e troca de arma com frequência."
        : "Controla a distância, defende e usa o arco quando pode.";
  setBanner(m.name, estilo + " Espada e arco mudam conforme a distância.", 3, "#ffd477");
  trainUI(true);
  return m;
}
export function trainWeapon(k: string) {
  const d = dungeon,
    h = d.hero!,
    e = ensureEquip(h);
  if (!d.training) return;
  if (k === "bow") {
    if (!e.costas) {
      e.costas = eqDurInit(mkItem("eq_arco"));
    }
    if (d.weapon !== "bow") switchWeapon();
  } else if (k === "eq_arco" || k === "eq_arco_longo") {
    const it = mkItem(k);
    it.q = TR.q;
    it.af = undefined;
    it.durMax = null;
    eqDurInit(it);
    e.costas = it;
    if (d.weapon !== "bow") switchWeapon();
  } else {
    const it = mkItem(k);
    it.q = TR.q;
    it.af = undefined;
    it.durMax = null;
    eqDurInit(it);
    e.maoD = it;
    d.spearOut = null;
    d.spears = [];
    if (d.weapon !== "melee") switchWeapon();
  }
  GL3.heroKey = "";
  trainUI(true);
}
export function trainAttr(id: string, dv: number) {
  const h = dungeon.hero;
  if (!h || !dungeon.training) return;
  h._trAttr = h._trAttr || {};
  const v = (h._trAttr[id] || 0) + dv;
  if (attrBase(h, id) + v < 1 || v > 12) return;
  h._trAttr[id] = v;
  dungeon.hpMax = hpMaxOf(h);
  dungeon.hp = Math.min(dungeon.hp, dungeon.hpMax);
  trainUI(true);
}
export function trainHud(on: boolean) {
  let el = document.getElementById("tr-hud");
  if (!on) {
    if (el) el.style.display = "none";
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "tr-hud";
    (document.getElementById("dungeon-view") || document.body).appendChild(el);
    el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    el.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest("[data-tr]") as HTMLElement;
      if (!b) return;
      const [a, x, y] = b.dataset.tr!.split(":");
      if (a === "w") trainWeapon(x);
      else if (a === "q") {
        TR.q = +x;
        trainUI(true);
      } else if (a === "at") trainAttr(x, +y);
      else if (a === "reset") trainReset();
      else if (a === "modelos") abrirModelosTeste();
      else if (a === "wolf") {
        TR.wolf = !TR.wolf;
        if (TR.wolf) trainWolf();
        else
          for (const m of dungeon.monsters)
            if (!m.dummy && !m.humano && m.alive) {
              m.alive = false;
              addRing(m.x, m.y, "#c9a2ff", 30, 0.4, 3);
            }
        trainUI(true);
      } else if (a === "human") {
        TR.human = !TR.human;
        if (TR.human) trainHuman();
        else
          for (const m of dungeon.monsters)
            if (m.humano && m.alive) {
              m.alive = false;
              if (dungeon.target === m) dungeon.target = null;
              addRing(m.x, m.y, "#ffc66b", 30, 0.4, 3);
            }
        trainUI(true);
      } else if (a === "min") {
        el!.classList.toggle("min");
      } else if (a === "exit") {
        exitDungeon();
      }
      b.blur();
    });
  }
  el.style.display = "";
  if (typeof MOB !== "undefined" && MOB.on) el.classList.add("min");
  trainUI(true);
}
function trainUI(full: boolean) {
  const el = document.getElementById("tr-hud");
  if (!el || el.style.display === "none" || !dungeon.active) return;
  const d = dungeon,
    h = d.hero!,
    e = ensureEquip(h);
  const last = TR.hits[TR.hits.length - 1],
    crPct = TR.direct ? Math.round((TR.crits / TR.direct) * 100) : 0;
  const meter =
    '<div class="tr-big"><div><b id="tr-dps">' +
    trainDps().toFixed(1) +
    "</b><small>DPS (5 s)</small></div><div><b>" +
    Math.round(TR.tot) +
    "</b><small>dano total</small></div></div>" +
    '<div class="tr-grid"><span>Golpes <b>' +
    TR.n +
    "</b></span><span>Maior <b>" +
    TR.max.toFixed(1) +
    "</b></span><span>Crít. <b>" +
    crPct +
    "%</b></span><span>Último <b>" +
    (last ? last.dmg.toFixed(1) + (last.crit ? "💥" : last.dot ? "🩸" : "") : "—") +
    "</b></span></div>" +
    '<div class="tr-log">' +
    TR.hits
      .slice(-7)
      .reverse()
      .map(
        (x) =>
          '<i class="' +
          (x.crit ? "c" : x.dot ? "b" : "") +
          '">' +
          (x.skill === "arco" ? "🏹" : "⚔") +
          " " +
          x.dmg.toFixed(1) +
          (x.crit ? " 💥" : x.dot ? " 🩸" : "") +
          "</i>",
      )
      .join("") +
    "</div>";
  if (!full) {
    const m = el.querySelector(".tr-meter");
    if (m) m.innerHTML = meter;
    return;
  }
  const cur = d.weapon === "bow" ? e.costas && e.costas.def.key : e.maoD && e.maoD.def.key;
  const wb = TR_WPN.map(
    ([k, ic, n]) =>
      '<button data-tr="w:' + k + '" title="' + n + '" class="' + (cur === k ? "on" : "") + '">' + ic + "</button>",
  ).join("");
  const qb = QUAL.map(
    (Q, i) =>
      '<button data-tr="q:' +
      i +
      '" class="' +
      (TR.q === i ? "on" : "") +
      '" style="color:' +
      Q.col +
      '">' +
      Q.n +
      "</button>",
  ).join("");
  const ab = ATTR_DEFS.filter((a) => a.id !== "mana")
    .map((a) => {
      const it = afSum(h, a.id),
        t = (h._trAttr && h._trAttr[a.id]) || 0;
      return (
        '<div class="tr-at"><span title="' +
        a.desc +
        '">' +
        icoAttr(a.id, a.icon) +
        " " +
        a.name +
        '</span><button data-tr="at:' +
        a.id +
        ':-1">−</button><b>' +
        attrOf(h, a.id) +
        '</b><button data-tr="at:' +
        a.id +
        ':1">+</button><small>' +
        attrBase(h, a.id) +
        (it ? " +" + it + "🎒" : "") +
        (t ? " " + (t > 0 ? "+" : "") + t + "🧪" : "") +
        "</small></div>"
      );
    })
    .join("");
  const held = d.weapon === "bow" ? e.costas : e.maoD;
  el.innerHTML =
    '<div class="tr-h"><i class="ic ico-btn_teste"></i> Dungeon Teste <button data-tr="min" title="Recolher">▾</button></div><div class="tr-body">' +
    '<button data-tr="modelos">👤 Ver modelos e animações</button><div class="tr-meter">' +
    meter +
    "</div>" +
    '<div class="tr-sec"><div class="tr-l">Arma</div><div class="tr-row">' +
    wb +
    '</div><div class="tr-row q">' +
    qb +
    "</div>" +
    (held
      ? '<div class="tr-af">' +
        icoItem(held.def) +
        " " +
        eqName(held) +
        (afText(held) ? " · " + afText(held) : "") +
        "</div>"
      : "") +
    "</div>" +
    '<div class="tr-sec"><div class="tr-l">Atributos <small>nascimento + 🎒itens + 🧪teste</small></div>' +
    ab +
    "</div>" +
    '<div class="tr-sec">' +
    statsHtml(h) +
    "</div>" +
    '<div class="tr-row act"><button data-tr="human" class="' +
    (TR.human ? "on" : "") +
    '">🤺 Parceiro humano</button><button data-tr="wolf" class="' +
    (TR.wolf ? "on" : "") +
    '">🐺 Lobo de treino</button><button data-tr="reset">↺ Zerar</button><button data-tr="exit">🚪 Sair</button></div></div>';
}

export function launchTraining(heroId: string) {
  const h = world.heroes.find((x) => x.id === heroId);
  if (!h) return;
  ensureHero(h);
  if (h.state !== "idle") {
    pushEvent(h.name + " está ocupado.");
    return;
  }
  if (prep.open) closePrep();
  TR.pending = true;
  launchDungeon(heroId);
}
/** v8.0 — a sala de treino de onde a heroína estiver (GameShark TREINO, botão Dungeon Teste do painel): só entrava
    com ela livre na base, e no jogo de hoje ela vive no mapa ou num campo — a entrada era recusada ("está ocupado";
    mantenedor 2026-10-25: "não consigo entrar na dungeon teste"). Fecha o campo aberto na hora (sem o portal), solta
    a heroína e entra. Sem `heroId`: a livre, ou a primeira. Devolve o texto do aviso. */
export function treinoDeQualquerLugar(heroId?: string) {
  const h = heroId
    ? world.heroes.find((x) => x.id === heroId)
    : (world.heroes.find((x) => x.state === "idle") ?? world.heroes[0]);
  if (!h) return "Nenhuma heroína.";
  if (dungeon.active && dungeon.training) return "Você já está na sala de treino.";
  if (dungeon.active) exitDungeon(() => {}); // `suave`: fecha na hora
  if (h.state !== "idle") {
    h.state = "idle";
    h.walkTo = null;
    h.task = null;
    h._enterCamp = false;
  }
  launchTraining(h.id);
  return dungeon.active || TR.pending
    ? "Sala de treino · E num manequim veste o personagem"
    : "Não deu para entrar agora.";
}
export function trainTick(dt: number) {
  const d = dungeon;
  if (!d.active) return;
  if (d.hero && !d.dead) {
    const hm = hpMaxOf(d.hero);
    if (hm !== d.hpMax) {
      d.hpMax = hm;
      d.hp = Math.min(d.hp, hm);
    }
  }
  {
    const hn = document.getElementById("dungeon-hint");
    if (hn) hn.style.visibility = d.training || d.camp ? "hidden" : "";
  }
  if (!d.training) return;
  TR.ui += dt;
  if (TR.ui > 0.25) {
    TR.ui = 0;
    trainUI(false);
  }
}
