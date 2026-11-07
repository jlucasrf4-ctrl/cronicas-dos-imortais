/* ==== Fase 4 — runas naturais: desenho, itens, mapa e masmorra (v4.4) ==== */
import { naVista } from "../render/desempenho.ts";
import { gcol, MB, mbIco, grnd, mbBox, glMesh, glFree } from "../render/gl/malhas.ts";
import { mbCenario } from "../render/gl/cenario.ts";
import { RUNE_EL, RUNAS, RUNE_KEYS, RUNE_SUBS, RUNE_LIQ, RUNIC_NAME, RUNE_MAP_S } from "../data/runas.ts";
import { MALHA, M4 } from "../render/gl/geometria.ts";
import { GL3, dungeon, OPT, econ, world, MEMO, camera, TELAS, SEL } from "../core/state.ts";
import { glPush } from "../render/gl/renderer.ts";
import { glDyn } from "../intro/cinematica.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { ensureInv } from "../items/inventario.ts";
import { formaA2 } from "../items/grade_a2.ts";
import { qvInv } from "../expedicao/preparo.ts";
import { tryAddToInv, addRing, shakeScreen, sfx, dungeonDeath } from "../field/chao.ts";
import { CONFIG } from "../core/config.ts";
import { isWaterCell } from "../map/agua.ts";
import { GENE_POOLS } from "../data/genetica.ts";
import { SPECIES } from "../data/especies.ts";
import { pushEvent } from "../sim/eventos.ts";
import { effRadius, moveStep } from "../sim/animais.ts";
import { esc } from "../core/util.ts";
import { openInfo } from "../sim/fauna.ts";
import { mvToast } from "../ui/avisos.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { HERO_SPEED, HERO_STATE_LABEL } from "../data/herois.ts";
import { runeAbsorbOpen, raEnsureDom } from "./absorcao.ts";
import { spawnDungeonToast } from "../field/masmorra.ts";
import { D3 } from "../field/projecao.ts";
import { WORLD_SAVE_KEYS } from "../save/salvar.ts";
import type { Animal, Hero, ItemDef, Monster, Planta, Ponto, Runa } from "../core/tipos.ts";
import type { Mat4 } from "../render/gl/geometria.ts";

function runeRGB(el: string) {
  return gcol((RUNE_EL[el] || RUNE_EL.nularis).c);
}
export function runeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/* Cores canônicas (iguais para runa, afinidade do personagem, aura e itens):
   Fogo laranja · Energia amarelo · Água azul · Ar verde-água · Terra ocre · Nularis BRANCO */
/* ---- o desenho de cada runa: traços angulares numa grade (como os traços da referência) ---- */
const _rpCache = new Map();
export function runePattern(seed: number) {
  if (_rpCache.has(seed)) return _rpCache.get(seed);
  const R = runeRng(seed * 7 + 3),
    G = 0.25,
    LIM = 3,
    out = [],
    DIRS = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
  const nS = 3 + Math.floor(R() * 2);
  for (let k = 0; k < nS; k++) {
    let x = Math.round((R() * 2 - 1) * LIM),
      y = Math.round((R() * 2 - 1) * LIM),
      d = Math.floor(R() * 4);
    const pts = [[x * G, y * G]];
    const nseg = 2 + Math.floor(R() * 4);
    for (let i = 0; i < nseg; i++) {
      if (i > 0) {
        const rr = R();
        d = rr < 0.42 ? d : rr < 0.82 ? ((d % 4) + (R() < 0.5 ? 1 : 3)) % 4 : 4 + Math.floor(R() * 4);
      }
      const L = 1 + Math.floor(R() * 2);
      let nx = x + DIRS[d][0] * L,
        ny = y + DIRS[d][1] * L;
      if (Math.abs(nx) > LIM || Math.abs(ny) > LIM) {
        d = ((d % 4) + 2) % 4;
        nx = x + DIRS[d][0];
        ny = y + DIRS[d][1];
        if (Math.abs(nx) > LIM || Math.abs(ny) > LIM) break;
      }
      x = nx;
      y = ny;
      pts.push([x * G, y * G]);
    }
    if (pts.length > 1) out.push(pts);
  }
  if (R() < 0.55) {
    const cx = Math.round((R() * 2 - 1) * 2) * G,
      cy = Math.round((R() * 2 - 1) * 2) * G,
      r = G * 0.8;
    out.push([
      [cx, cy - r],
      [cx + r, cy],
      [cx, cy + r],
      [cx - r, cy],
      [cx, cy - r],
    ]);
  }
  if (!out.length)
    out.push([
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.25],
    ]);
  _rpCache.set(seed, out);
  return out;
}
function runeBuildMeshes(r: Runa) {
  MALHA._gs = (r.seed % 100000) + 5;
  const R = r.R!;
  /* v7.7 — a runa aparece numa laje de pedra do pacote de natureza (a de Água, num poço com pedras), achatada para
     ficar logo abaixo do símbolo (render/gl/cenario.ts); sem o modelo, o remendo de terra e folhas de antes */
  {
    const lj = MB();
    if (mbCenario(lj, r.el === "agua" ? "poco" : "laje", 0, 0, R * 2.7, { altura: 1.6, semente: r.seed % 9973 }))
      return { patch: glMesh(lj), glyph: runeGlyphMesh(r) };
  }
  const b = MB(),
    cols = ["#3f6a2c", "#4f7a35", "#5c8a45", "#6d9a4c", "#476f30", "#587f3a"];
  mbIco(b, M4.ch(M4.T(0, 0.0, 0), M4.S(R * 2.6, 0.1, R * 2.35)), "#5a4528", 1, 0.25, 0.1);
  for (let i = 0; i < 7; i++) {
    const a = grnd() * 6.28,
      rr = R * (1.05 + grnd() * 0.3);
    mbIco(
      b,
      M4.ch(M4.T(Math.cos(a) * rr, 0.4, Math.sin(a) * rr), M4.RY(grnd() * 6.28), M4.S(R * 0.34, 0.45, R * 0.15)),
      ["#8a5a2a", "#a3692e", "#6b4a22"][i % 3],
      0,
      0.2,
      0.1,
    );
  }
  for (let i = 0; i < 34; i++) {
    const a = grnd() * 6.283,
      rr = Math.sqrt(grnd()) * R * 0.95,
      x = Math.cos(a) * rr,
      z = Math.sin(a) * rr,
      L = R * (0.4 + grnd() * 0.26);
    mbIco(
      b,
      M4.ch(M4.T(x, 0.35 + i * 0.02, z), M4.RY(grnd() * 6.28), M4.S(L, 0.55, L * 0.42)),
      cols[i % cols.length],
      0,
      0.15,
      0.1,
    );
  }
  return { patch: glMesh(b), glyph: runeGlyphMesh(r) };
}
/** O símbolo da runa (traços brancos a y=1,9; a cor vem do tint). */
function runeGlyphMesh(r: Runa) {
  const g = MB(),
    S = r.R! * 0.88;
  for (const s of runePattern(r.seed))
    for (let i = 0; i < s.length - 1; i++) {
      const ax = s[i][0] * S,
        az = s[i][1] * S,
        bx = s[i + 1][0] * S,
        bz = s[i + 1][1] * S,
        L = Math.hypot(bx - ax, bz - az),
        a = Math.atan2(bz - az, bx - ax);
      mbBox(g, M4.ch(M4.T((ax + bx) / 2, 1.9, (az + bz) / 2), M4.RY(-a), M4.S(L + 2.8, 0.6, 2.8)), "#ffffff");
    }
  return glMesh(g);
}
function runeBuildLeafLoot() {
  MALHA._gs = 321;
  const b = MB();
  for (let i = 0; i < 3; i++)
    mbIco(
      b,
      M4.ch(M4.T((i - 1) * 2.5, 0.6 + i * 0.2, (i % 2) * 2 - 1), M4.RY(i * 1.3), M4.S(9, 0.7, 3.8)),
      ["#4f7a35", "#5c8a45", "#6d9a4c"][i],
      0,
      0.15,
      0.1,
    );
  return glMesh(b);
}
export function runeGLPush() {
  if (!GL3.mesh.folhama) GL3.mesh.folhama = runeBuildLeafLoot();
  const d = dungeon;
  if (!d.runes || !d.runes.length) return;
  const now = performance.now() / 1000;
  for (const r of d.runes) {
    if (!r._m) r._m = runeBuildMeshes(r);
    const M = M4.T(r.x, 0, r.y),
      c = runeRGB(r.el),
      pul = 0.78 + 0.22 * Math.sin(now * 2.4 + (r.seed % 9));
    glPush(r._m.patch, M, null, false);
    glPush(r._m.glyph, M, [c[0], c[1], c[2], Math.min(1, (0.9 + 0.1 * pul) * Math.max(0.5, r.str + 0.2))], false);
  }
}
export function runeGLGlow(VP: Mat4) {
  const d = dungeon,
    P: number[] = [],
    C: number[] = [],
    now = performance.now() / 1000;
  const tri = (a: number[], b: number[], c: number[], ca: number[], cb: number[], cc: number[]) => {
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    C.push(ca[0], ca[1], ca[2], ca[3], cb[0], cb[1], cb[2], cb[3], cc[0], cc[1], cc[2], cc[3]);
  };
  const disc = (x: number, z: number, y: number, R: number, col: number[], a: number) => {
    const n = 24,
      k = [col[0], col[1], col[2], a],
      o = [col[0], col[1], col[2], 0];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283,
        a1 = ((i + 1) / n) * 6.283;
      tri(
        [x, y, z],
        [x + Math.cos(a0) * R, y, z + Math.sin(a0) * R],
        [x + Math.cos(a1) * R, y, z + Math.sin(a1) * R],
        k,
        o,
        o,
      );
    }
  };
  for (const r of d.runes || []) {
    const c = runeRGB(r.el),
      pul = 0.7 + 0.3 * Math.sin(now * 2.4 + (r.seed % 9)),
      k = Math.max(0.35, Math.min(1, r.str + 0.1)),
      S = r.R! * 0.88;
    disc(r.x, r.y, 1.2, r.R! * 1.45, c, 0.3 * pul * k);
    for (const s of runePattern(r.seed))
      for (let i = 0; i < s.length - 1; i++) {
        const ax = r.x + s[i][0] * S,
          az = r.y + s[i][1] * S,
          bx = r.x + s[i + 1][0] * S,
          bz = r.y + s[i + 1][1] * S,
          L = Math.hypot(bx - ax, bz - az) || 1,
          nx = (-(bz - az) / L) * 5.5,
          nz = ((bx - ax) / L) * 5.5,
          y = 2;
        const ci = [c[0], c[1], c[2], 0.42 * pul * k],
          co = [c[0], c[1], c[2], 0];
        tri([ax, y, az], [bx, y, bz], [bx + nx, y, bz + nz], ci, ci, co);
        tri([ax, y, az], [bx + nx, y, bz + nz], [ax + nx, y, az + nz], ci, co, co);
        tri([ax, y, az], [bx - nx, y, bz - nz], [bx, y, bz], ci, co, ci);
        tri([ax, y, az], [ax - nx, y, az - nz], [bx - nx, y, bz - nz], ci, co, co);
      }
  }
  for (const m of d.monsters) {
    if (!m.alive || !m.runic) continue;
    const c = runeRGB(m.runic),
      pul = 0.6 + 0.4 * Math.sin(now * 5 + (m.x % 7));
    disc(m.x, m.y, 1.5, m.boss ? 56 : 38, c, 0.6 * pul);
  }
  if (P.length) glDyn(VP, P, C);
}
export function runeWolfTint(m: Monster) {
  if (!m.runic) return null;
  const c = runeRGB(m.runic);
  return [c[0], c[1], c[2], 0.34 + 0.12 * Math.sin(performance.now() / 150)];
}

/* =====================================================================
   v4.4 — RUNAS NATURAIS (mapa + masmorra) · ABSORÇÃO COM FOLHAMA
   Canon (GDD): Runas Naturais surgem no ambiente, como um fenômeno
   natural. Pele e animais não podem tocar a runa bruta: um ser vivo que
   toca pode absorver a energia sem controle e virar uma Runa Selvagem.
   Absorção (qualquer pessoa, com conhecimento e equipamento):
     aquecer e esticar Folhama → 1ª camada → (molde de vista, técnica
     da Lina) → substratos → selar com a 2ª camada → traçar com a agulha
     → aguardar a energia fixar no melhor substrato → separar e testar.
   RUNAS.* decide quando elas existem — para amarrar ao enredo depois.
===================================================================== */
function runasOn(where: string) {
  return (
    RUNAS.ativo && OPT.runas !== false && (where !== "mapa" || RUNAS.mapa) && (where !== "dungeon" || RUNAS.dungeon)
  );
}
function runeRollEl() {
  let r = Math.random() * RUNE_KEYS.reduce((s, k) => s + RUNE_EL[k].w, 0);
  for (const k of RUNE_KEYS) {
    r -= RUNE_EL[k].w;
    if (r <= 0) return k;
  }
  return "nularis";
}

/* =====================================================================
   MASMORRA
===================================================================== */
export function runeSeedDungeon() {
  const d = dungeon;
  for (const r of d.runes || [])
    if (r._m) {
      try {
        glFree(r._m.patch);
        glFree(r._m.glyph);
      } catch (e) {}
    }
  d.runes = [];
  d._frT = 25;
  if (!runasOn("dungeon")) return;
  const T = d.tile,
    n = RUNAS.porDungeon[0] + Math.floor(Math.random() * (RUNAS.porDungeon[1] - RUNAS.porDungeon[0] + 1));
  for (let i = 0; i < n; i++) {
    let x: number,
      y: number,
      t = 0;
    do {
      x = T * 3.2 + Math.random() * (d.cols * T - T * 6.4);
      y = T * 2.6 + Math.random() * (d.rows * T - T * 5.2);
    } while (
      t++ < 50 &&
      (Math.hypot(x - d.entrance.x, y - d.entrance.y) < T * 6 ||
        d.runes.some((r) => Math.hypot(r.x - x, r.y - y) < T * 5))
    );
    const r = { id: "D" + i, x, y, el: runeRollEl(), seed: Math.floor(Math.random() * 1e9), str: 1, R: 30 };
    d.runes.push(r);
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * 6.28,
        rr = r.R + 16 + Math.random() * 34;
      d.loot!.push({
        key: "folhama",
        x: Math.max(T * 1.5, Math.min(d.cols * T - T * 1.5, x + Math.cos(a) * rr)),
        y: Math.max(T * 1.5, Math.min(d.rows * T - T * 1.5, y + Math.sin(a) * rr)),
        ground: true,
        t: 0,
        ttl: 0,
      });
    }
  }
}

export function rgba(hex: string, a: number) {
  const c = gcol(hex);
  return "rgba(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + "," + a + ")";
}
export function runeSamples(strokes: number[][][], step: number) {
  const out = [];
  for (const s of strokes) {
    if (s.length === 1) {
      out.push(s[0]);
      continue;
    }
    for (let i = 0; i < s.length - 1; i++) {
      const [ax, ay] = s[i],
        [bx, by] = s[i + 1],
        L = Math.hypot(bx - ax, by - ay),
        n = Math.max(1, Math.ceil(L / step));
      for (let j = i ? 1 : 0; j <= n; j++) out.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
    }
  }
  return out;
}
export function runeScore(truth: number[][][], drawn: number[][][], tol: number) {
  // cobertura do desenho verdadeiro + quanto do traço caiu em cima dele
  const T = runeSamples(truth, 0.04),
    D = runeSamples(
      drawn.filter((s: number[][]) => s.length > 1),
      0.04,
    );
  if (!D.length) return { cov: 0, prec: 0, s: 0 };
  const t2 = tol * tol,
    near = (p: number[], Q: number[][]) => {
      for (const q of Q) {
        const dx = p[0] - q[0],
          dy = p[1] - q[1];
        if (dx * dx + dy * dy < t2) return true;
      }
      return false;
    };
  const cov = T.filter((p) => near(p, D)).length / T.length,
    prec = D.filter((p) => near(p, T)).length / D.length;
  return { cov, prec, s: cov * 0.62 + prec * 0.38 };
}
export function runeStrokes(
  c: CanvasRenderingContext2D,
  strokes: number[][][],
  S: number,
  col: string,
  w: number,
  glow: number,
  alpha: number,
) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = "round";
  c.lineJoin = "round";
  if (glow) {
    c.shadowColor = col;
    c.shadowBlur = glow;
  }
  c.beginPath();
  for (const s of strokes) {
    c.moveTo(s[0][0] * S, s[0][1] * S);
    for (let i = 1; i < s.length; i++) c.lineTo(s[i][0] * S, s[i][1] * S);
  }
  c.stroke();
  c.restore();
}
export function runeLeafPatch(c: CanvasRenderingContext2D, S: number, seed: number, alpha: number) {
  // tapete de folhas de Folhama sobre a runa
  const R = runeRng(seed + 17),
    cols = ["#3f6a2c", "#4f7a35", "#5c8a45", "#6d9a4c", "#476f30", "#587f3a"],
    dry = ["#8a5a2a", "#a3692e", "#6b4a22"];
  c.save();
  c.globalAlpha = alpha == null ? 1 : alpha;
  for (let i = 0; i < 6; i++) {
    const a = R() * 6.28,
      rr = S * (1.0 + R() * 0.35);
    c.save();
    c.translate(Math.cos(a) * rr, Math.sin(a) * rr);
    c.rotate(R() * 6.28);
    c.fillStyle = dry[i % 3];
    const L = S * 0.3;
    c.beginPath();
    c.ellipse(0, 0, L, L * 0.42, 0, 0, 6.283);
    c.fill();
    c.restore();
  }
  for (let i = 0; i < 18; i++) {
    const x = (R() * 2 - 1) * S * 0.82,
      y = (R() * 2 - 1) * S * 0.82,
      a = R() * 6.28,
      L = S * (0.42 + R() * 0.3),
      W = L * 0.45;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = cols[Math.floor(R() * cols.length)];
    c.beginPath();
    c.moveTo(-L, 0);
    c.quadraticCurveTo(0, -W, L, 0);
    c.quadraticCurveTo(0, W, -L, 0);
    c.fill();
    c.strokeStyle = "rgba(20,40,12,.5)";
    c.lineWidth = L * 0.05;
    c.beginPath();
    c.moveTo(-L * 0.9, 0);
    c.lineTo(L * 0.9, 0);
    for (let k = -2; k <= 2; k++) {
      if (!k) continue;
      const px = k * L * 0.3;
      c.moveTo(px, 0);
      c.lineTo(px + L * 0.18, -W * 0.45);
      c.moveTo(px, 0);
      c.lineTo(px + L * 0.18, W * 0.45);
    }
    c.stroke();
    c.restore();
  }
  c.restore();
}
export function runeDefKey(tier: string, el: string, sub: string, fx: number) {
  return "runa_" + tier + "_" + el + "_" + sub + (tier === "liq" ? "_" + (fx | 0) : "");
}
export function runeDef(key: string) {
  if (ITEM_DEFS[key]) return ITEM_DEFS[key];
  const p = key.split("_"),
    tier = p[1],
    el = p[2],
    sub = p[3],
    fx = +p[4] || 0,
    E = RUNE_EL[el] || RUNE_EL.nularis,
    S = RUNE_SUBS[sub] || RUNE_SUBS.pedra;
  let name, val, desc, art;
  if (tier === "preciosa") {
    name = "Runa Preciosa de " + E.n + " (" + S.n + ")";
    val = Math.round(70 + S.q * 35);
    desc =
      "Runa de " +
      E.t +
      " estabilizada em pedra " +
      (S.q >= 4 ? "preciosa" : "semipreciosa") +
      ". Vida muito longa — só um mago consegue transformá-la em artefato.";
    art = [".#.", "###", ".#."];
  } else if (tier === "capturada") {
    name = "Runa de " + E.n + " em " + S.n;
    val = Math.round(28 + S.q * 12);
    desc =
      "Runa de " +
      E.t +
      " fixada em " +
      S.n.toLowerCase() +
      ". Funciona, mas é bem menos estável que uma Runa Preciosa.";
    art = ["##", "##"];
  } else if (tier === "fraturada") {
    name = "Runa Fraturada de " + E.n;
    val = 9;
    desc =
      "Rachaduras coloridas atravessam o " +
      S.n.toLowerCase() +
      ". Instável e perigosa: de vez em quando estala e fere quem a carrega na masmorra.";
    art = ["#.", "##"];
  } else {
    name = "Runa de Liquidação (" + S.n + ")";
    val = Math.round(30 + S.q * 14);
    desc =
      "Runa Nularis de brilho branco: em vez de seguir um elemento, muda um pedaço da realidade. Efeito: " +
      RUNE_LIQ[fx % RUNE_LIQ.length];
    art = [".#", "##", "#."];
  }
  const d: ItemDef = {
    key,
    name,
    emoji: tier === "liq" ? "⚪" : tier === "fraturada" ? "💥" : E.e,
    color: tier === "fraturada" ? "#8a5a5a" : E.c,
    val,
    w: 0,
    desc,
    rune: { tier, el, sub, fx },
  };
  d.shape = formaA2(
    key,
    art.map((r) => Array.from(r, (ch) => (ch === "#" ? 1 : 0))),
  ); // v7.7: sem dentes (items/grade_a2.ts)
  ITEM_DEFS[key] = d;
  return d;
}
export function runeRebindItems() {
  // saves: recria as definições das runas capturadas
  const invs = [econ.stash];
  for (const h of world.heroes || []) {
    if (h.inv) invs.push(h.inv);
    if (h.inv2) invs.push(h.inv2);
  }
  for (const inv of invs)
    for (const it of (inv && inv.items) || [])
      if (it.def && /^runa_(preciosa|capturada|fraturada|liq)_/.test(it.def.key)) it.def = runeDef(it.def.key);
}
function runeInvs(h: Hero) {
  return [ensureInv(h), qvInv(h)];
}
export function runeCount(h: Hero, key: string) {
  const n = runeCountBase(h, key);
  /* v5.8 */
  return econ.test && (key === "folhama" || RUNE_SUBS[key]) ? Math.max(n, 9) : n;
}
function runeCountBase(h: Hero, key: string) {
  let n = 0;
  for (const inv of runeInvs(h)) for (const it of inv.items) if (it.def.key === key) n += it.n || 1;
  return n;
}
export function runeSubsOf(h: Hero) {
  const m = runeSubsOfBase(h);
  /* v5.8 */
  if (econ.test) for (const k in RUNE_SUBS) if (ITEM_DEFS[k]) m[k] = Math.max(m[k] || 0, 9);
  return m;
}
function runeSubsOfBase(h: Hero) {
  const m: Record<string, number> = {};
  for (const inv of runeInvs(h))
    for (const it of inv.items) if (RUNE_SUBS[it.def.key]) m[it.def.key] = (m[it.def.key] || 0) + (it.n || 1);
  return m;
}
export function runeTake(h: Hero, key: string) {
  const ok = runeTakeBase(h, key);
  /* v5.8 */
  return ok || (econ.test && (key === "folhama" || !!RUNE_SUBS[key]));
}
function runeTakeBase(h: Hero, key: string) {
  for (const inv of runeInvs(h)) {
    const it = inv.items.find((i) => i.def.key === key);
    if (!it) continue;
    if ((it.n || 1) > 1) {
      it.n!--;
      if ((it.insp || 0) > it.n!) it.insp = it.n;
    } else inv.items.splice(inv.items.indexOf(it), 1);
    return true;
  }
  return false;
}
export function runeGive(h: Hero, key: string) {
  if (key.startsWith("runa_") && key !== "runa_bruta") runeDef(key);
  if (tryAddToInv(ensureInv(h), key) || tryAddToInv(qvInv(h), key)) return "mochila";
  if (dungeon.active && dungeon.hero === h) {
    dungeon.loot!.push({
      key,
      x: dungeon.px + (Math.random() - 0.5) * 30,
      y: dungeon.py + 18,
      ground: false,
      tier: 0,
      t: 0,
      ttl: 0,
    });
    return "chão";
  }
  if (tryAddToInv(econ.stash, key)) return "baú";
  return null;
}

/* =====================================================================
   MAPA DO MUNDO
===================================================================== */
export function runeList() {
  return world.runes || (world.runes = []);
}
export function runeNew(x: number, y: number, el?: string) {
  return {
    id: "R" + (world.nextId || 0) + "_" + ++MEMO.runeUid + "_" + Math.floor(Math.random() * 1e4),
    x,
    y,
    el: el || runeRollEl(),
    seed: Math.floor(Math.random() * 1e9),
    str: 1,
    born: world.tick,
  };
}
function runeInBounds(r: Ponto) {
  const b = CONFIG.SIM_BOUNDS;
  return r.x >= b.x && r.x <= b.x + b.w && r.y >= b.y && r.y <= b.y + b.h;
}
function runeSpotMap() {
  const b = CONFIG.SIM_BOUNDS,
    ok = (p: Planta) => p.x > b.x + 24 && p.x < b.x + b.w - 24 && p.y > b.y + 24 && p.y < b.y + b.h - 24,
    fol = (world.veg || []).filter((p) => p.kind === "folhama" && ok(p));
  for (let t = 0; t < 40; t++) {
    let x, y;
    if (fol.length && t < 30) {
      const p = fol[Math.floor(Math.random() * fol.length)];
      x = p.x + (Math.random() - 0.5) * 18;
      y = p.y + (Math.random() - 0.5) * 18;
    } else {
      x = b.x + 30 + Math.random() * (b.w - 60);
      y = b.y + 30 + Math.random() * (b.h - 60);
    }
    if (isWaterCell(x, y) || isWaterCell(x + 6, y) || isWaterCell(x - 6, y)) continue;
    if (runeList().some((r) => Math.hypot(r.x - x, r.y - y) < 70)) continue;
    if (world.heroes.some((h) => h.camp && Math.hypot(h.camp.x - x, h.camp.y - y) < 45)) continue;
    return { x, y };
  }
  return null;
}
function runeTransform(a: Animal, r: Runa) {
  const P = GENE_POOLS,
    E = RUNE_EL[r.el];
  a.runic = r.el;
  a.genes = Object.assign({}, a.genes, { size: P.size[4], speed: P.speed[4], strength: P.strength[4] });
  if (a.weightMult) a.weightMult *= 1.35;
  a.health = 100;
  a.energy = Math.max(a.energy || 0, 70);
  r.str -= 0.5;
  r.byAnimal = true;
  r.lastBeast = a.id;
  const lab = SPECIES[a.species] ? SPECIES[a.species].label.toLowerCase() : a.species;
  pushEvent(
    "✨ Um " +
      lab +
      " pisou numa Runa Natural (" +
      E.n +
      ") e virou " +
      (RUNIC_NAME[a.species] || "Runa Selvagem") +
      "!",
  );
}
function runeGiveKit() {
  for (const h of world.heroes || [])
    if (!h._folhKit) {
      h._folhKit = 1;
      for (let i = 0; i < 2; i++)
        tryAddToInv(ensureInv(h), "folhama") || tryAddToInv(qvInv(h), "folhama") || tryAddToInv(econ.stash, "folhama");
    }
}
export function runeSimTick(dtMin: number) {
  if (!runasOn("mapa")) return;
  const L = runeList(),
    day = world.tick / CONFIG.DAY_MIN + 1;
  if (day < RUNAS.inicioDia) return;
  if ((world._rnK = (world._rnK || 0) + dtMin) > 30) {
    world._rnK = 0;
    runeGiveKit();
  }
  const act = L.filter(runeInBounds);
  world._rnT = (world._rnT || 0) + dtMin;
  if (world._rnT >= 90) {
    // a cada 1,5 h de jogo, chance de surgir uma nova
    world._rnT = 0;
    const want = act.length === 0 ? 0.9 : act.length < RUNAS.maxMapa ? 0.16 : 0;
    if (Math.random() < want) {
      const p = runeSpotMap();
      if (p) {
        const r = runeNew(p.x, p.y);
        L.push(r);
        pushEvent(
          "✨ Uma Runa Natural (" +
            RUNE_EL[r.el].n +
            ") surgiu entre as folhas, perto de (" +
            Math.round(r.x) +
            ", " +
            Math.round(r.y) +
            ").",
        );
      }
    }
  }
  const k = 1 - Math.exp(-dtMin * 0.35),
    RR = RUNE_MAP_S * 0.75;
  for (const r of act) {
    for (const a of world.animals) {
      if (!a.alive || a.runic) continue;
      const dx = a.x - r.x,
        dy = a.y - r.y;
      if (dx * dx + dy * dy > RR * RR || Math.random() > k) continue;
      runeTransform(a, r);
      if (r.str <= 0) break;
    }
    if (world.tick - r.born! > CONFIG.DAY_MIN * 6) r.str -= dtMin / (CONFIG.DAY_MIN * 2); // com o tempo ela se apaga sozinha
  }
  for (let i = L.length - 1; i >= 0; i--)
    if (L[i].str <= 0) {
      const r = L[i];
      L.splice(i, 1);
      if (r.absorbed) continue;
      pushEvent(
        r.byAnimal
          ? "A Runa Natural (" + RUNE_EL[r.el].n + ") se apagou depois de transformar um bicho."
          : "Uma Runa Natural (" + RUNE_EL[r.el].n + ") se apagou.",
      );
    }
}
export function runeDrawMap() {
  if (!runasOn("mapa")) return;
  const L = runeList();
  if (!L.length) return;
  const now = performance.now() / 1000,
    s = camera.scale;
  for (const r of L) {
    if (!naVista(r.x, r.y, 40)) continue; // v7.7
    const E = RUNE_EL[r.el],
      pul = 0.6 + 0.4 * Math.sin(now * 2.2 + (r.seed % 7)),
      str = Math.max(0.3, Math.min(1, r.str + 0.15));
    TELAS.ctx.save();
    TELAS.ctx.translate(r.x, r.y);
    if (s < 0.9) {
      // de longe: marcador brilhante (tamanho fixo na tela)
      const R = 7 / s,
        g = TELAS.ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.9);
      g.addColorStop(0, rgba(E.c, 0.85 * pul * str));
      g.addColorStop(1, rgba(E.c, 0));
      TELAS.ctx.fillStyle = g;
      TELAS.ctx.beginPath();
      TELAS.ctx.arc(0, 0, R * 1.9, 0, 6.283);
      TELAS.ctx.fill();
      TELAS.ctx.strokeStyle = "#fff3d6";
      TELAS.ctx.lineWidth = 1.5 / s;
      TELAS.ctx.beginPath();
      TELAS.ctx.moveTo(0, -R * 0.75);
      TELAS.ctx.lineTo(R * 0.75, 0);
      TELAS.ctx.lineTo(0, R * 0.75);
      TELAS.ctx.lineTo(-R * 0.75, 0);
      TELAS.ctx.closePath();
      TELAS.ctx.stroke();
      TELAS.ctx.restore();
      continue;
    }
    const S = RUNE_MAP_S,
      g = TELAS.ctx.createRadialGradient(0, 0, 0, 0, 0, S * 2);
    TELAS.ctx.fillStyle = "rgba(40,28,14,.55)";
    TELAS.ctx.beginPath();
    TELAS.ctx.ellipse(0, 0, S * 1.25, S * 1.15, 0.3, 0, 6.283);
    TELAS.ctx.fill();
    g.addColorStop(0, rgba(E.c, 0.35 * pul * str));
    g.addColorStop(1, rgba(E.c, 0));
    runeLeafPatch(TELAS.ctx, S, r.seed, 0.95);
    TELAS.ctx.globalCompositeOperation = "lighter";
    TELAS.ctx.fillStyle = g;
    TELAS.ctx.beginPath();
    TELAS.ctx.arc(0, 0, S * 2, 0, 6.283);
    TELAS.ctx.fill();
    TELAS.ctx.globalCompositeOperation = "source-over";
    const P = runePattern(r.seed);
    runeStrokes(TELAS.ctx, P, S * 0.85, E.c, 2.6, 14 * pul, 0.95 * str);
    runeStrokes(TELAS.ctx, P, S * 0.85, "#fff6e0", 0.9, 0, 0.9 * str);
    if (runeHeroAt(r) || world.heroes.some((h) => h.task && h.task.runeId === r.id)) {
      TELAS.ctx.strokeStyle = "rgba(255,240,200,.7)";
      TELAS.ctx.setLineDash([2, 2]);
      TELAS.ctx.lineWidth = 1.2;
      TELAS.ctx.setLineDash([4, 4]);
      TELAS.ctx.beginPath();
      TELAS.ctx.arc(0, 0, S * 1.5, 0, 6.283);
      TELAS.ctx.stroke();
    }
    TELAS.ctx.restore();
  }
}
export function runeAura(a: Animal) {
  // brilho dos bichos que viraram Runa Selvagem
  const E = RUNE_EL[a.runic!] || RUNE_EL.nularis,
    r = effRadius(a),
    pul = 0.6 + 0.4 * Math.sin(performance.now() / 260 + a.x);
  TELAS.ctx.save();
  const g = TELAS.ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r * 3.4);
  g.addColorStop(0, rgba(E.c, 0.55 * pul));
  g.addColorStop(1, rgba(E.c, 0));
  TELAS.ctx.globalCompositeOperation = "lighter";
  TELAS.ctx.fillStyle = g;
  TELAS.ctx.beginPath();
  TELAS.ctx.arc(a.x, a.y, r * 3.4, 0, 6.283);
  TELAS.ctx.fill();
  TELAS.ctx.restore();
}
export function runeInspAnimal(a: Animal) {
  const E = RUNE_EL[a.runic!] || RUNE_EL.nularis,
    $ = (i: string) => document.getElementById(i);
  $("insp-tag")!.textContent = "RUNA SELVAGEM · " + E.n.toUpperCase();
  $("insp-tag")!.style.background = E.c;
  $("insp-name")!.textContent = (RUNIC_NAME[a.species] || "Fera Rúnica") + " — " + $("insp-name")!.textContent;
}
export function runePickAt(x: number, y: number) {
  if (!runasOn("mapa")) return null;
  let b = null,
    bd = Math.max(RUNE_MAP_S * 1.1, 16 / camera.scale);
  for (const r of runeList()) {
    const d = Math.hypot(r.x - x, r.y - y);
    if (d < bd) {
      bd = d;
      b = r;
    }
  }
  return b;
}
function runeHeroAt(r: Runa) {
  return world.heroes.find((h) => h.task && h.task.runeId === r.id && h.state === "hunting");
}
export function openRuneInspector(r: Runa) {
  const E = RUNE_EL[r.el],
    day = Math.floor(r.born! / CONFIG.DAY_MIN) + 1,
    at = runeHeroAt(r),
    going = world.heroes.find((h) => h.task && h.task.runeId === r.id && h.state === "traveling");
  openInfo({
    tag: "RUNA NATURAL",
    color: E.c,
    name: "Runa Natural · " + E.n,
    sub: E.t.charAt(0).toUpperCase() + E.t.slice(1) + " · surgiu no dia " + day,
    desc: "Uma Runa Natural brilha por baixo das folhas de Folhama. Pele e animais não devem tocar a runa bruta — um bicho que pisa nela pode virar Runa Selvagem. Com 2 folhas de Folhama, substratos (pedras ou minérios) e a agulha, dá para transferir a energia.",
    meta:
      "<b>Força:</b> " +
      Math.round(Math.max(0, r.str) * 100) +
      "%" +
      (r.byAnimal ? " · já transformou um bicho" : "") +
      "<br><b>Precisa:</b> 🍃 2 Folhama + 1 a 3 substratos (pedra, ferro, prata, quartzo, ametista, gema)",
    btn: null,
  });
  const box = document.getElementById("insp-actions")!;
  box.dataset.sig = "rune";
  box.innerHTML = at
    ? '<button class="btn" data-ract="absorb" data-rid="' +
      r.id +
      '">🍃 Absorver agora (' +
      esc(at.name) +
      " está na runa)</button>"
    : going
      ? '<button class="btn" disabled>' + esc(going.name) + " está a caminho…</button>"
      : '<button class="btn" data-ract="send" data-rid="' + r.id + '">🍃 Mandar absorver</button>';
  SEL.runeInspR = r;
}
export function runeSend(r: Runa) {
  const h = world.heroes.find((o) => o.state === "idle");
  if (!h) {
    mvToast("Nenhum personagem livre no acampamento.");
    return;
  }
  const f = runeCount(h, "folhama"),
    sb = Object.keys(runeSubsOf(h)).length;
  if (f < 2 || !sb) {
    mvToast(
      "🍃 " +
        h.name +
        " precisa ter na mochila: 2 folhas de Folhama" +
        (f < 2 ? " (tem " + f + ")" : "") +
        (!sb ? " e ao menos 1 substrato (pedra, minério ou pedra semipreciosa)" : "") +
        ".",
    );
    return;
  }
  h.task = { x: r.x, y: r.y, targetSpecies: "runa", runeId: r.id, killsWanted: 1, killsDone: 0, maxMin: 10 * 60, t: 0 };
  h.state = "traveling";
  h.targetEntity = null;
  pushEvent("🍃 " + h.name + " foi até a Runa Natural (" + RUNE_EL[r.el].n + ") levando Folhama e substratos.");
  updateHeroPanelUI();
  openRuneInspector(r);
}
export function runeHeroStep(h: Hero, dtMin: number) {
  const t = h.task!,
    r = runeList().find((q) => q.id === t.runeId);
  if (!r) {
    h.state = "returning";
    pushEvent("A Runa Natural se apagou antes de " + h.name + " terminar. Voltando ao acampamento.");
    return;
  }
  if (h.state === "traveling") {
    const d = moveStep(h, r.x + RUNE_MAP_S * 1.3, r.y + 4, HERO_SPEED, dtMin, true);
    if (d < 4) {
      h.state = "hunting";
      t.t = 0;
      pushEvent("🍃 " + h.name + " chegou à Runa Natural. Toque na runa para fazer a absorção.");
      runeNotify(h, r);
    }
    return;
  }
  t.t = (t.t || 0) + dtMin;
  if (t.t > t.maxMin!) {
    h.state = "returning";
    pushEvent(h.name + " cansou de esperar na runa e voltou ao acampamento.");
  }
}
function runeNotify(h: Hero, r: Runa) {
  let el = document.getElementById("rune-notif");
  if (!el) {
    el = document.createElement("div");
    el.id = "rune-notif";
    document.body.appendChild(el);
  }
  el.innerHTML =
    "<span>🍃 <b>" +
    esc(h.name) +
    "</b> chegou à Runa Natural (" +
    RUNE_EL[r.el].n +
    ")</span><button class='btn' data-go='1'>Absorver agora</button><button class='btn' data-x='1'>✕</button>";
  el.classList.add("on");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("on"), 25000);
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    el.classList.remove("on");
    if (b.dataset.go) runeAbsorbOpen({ hero: h, rune: r, where: "mapa" });
  };
}
export function runeNearDungeon() {
  const d = dungeon;
  if (!d.runes) return null;
  let b = null,
    bd = 1e9;
  for (const r of d.runes) {
    const dd = Math.hypot(d.px - r.x, d.py - r.y);
    if (dd < r.R! + 30 && dd < bd) {
      bd = dd;
      b = r;
    }
  }
  return b;
}
function runeWolf(m: Monster, r: Runa) {
  const E = RUNE_EL[r.el];
  m.runic = r.el;
  m.hpMax = Math.round(m.hpMax * 1.6);
  m.hp = Math.min(m.hpMax, m.hp + m.hpMax * 0.5);
  m.dm = (m.dm || 1) * 1.35;
  m.spd = (m.spd || 38) * 1.15;
  m.name = (m.kind === "javalino" ? "Javalino Rúnico" : "Lobo Rúnico") + " · " + E.n;
  r.str -= 0.34;
  addRing(m.x, m.y, E.c, 74, 0.7, 4);
  addRing(r.x, r.y, E.c, 60, 0.5, 3);
  shakeScreen(0.15, 3);
  sfx("guardbreak");
  spawnDungeonToast("✨ Tocou a runa: virou Runa Selvagem!", m.x, m.y - 38, E.c, 13);
}
export function runeDungeonTick(dt: number) {
  const d = dungeon;
  if (!d.active || dt <= 0) return;
  const runes = d.runes || [];
  for (const r of runes) {
    for (const m of d.monsters) {
      if (!m.alive || m.runic || m.boss || m.st === "leap") continue;
      if (Math.hypot(m.x - r.x, m.y - r.y) < r.R! * 0.72) runeWolf(m, r);
      if (r.str <= 0) break;
    }
    const hd = Math.hypot(d.px - r.x, d.py - r.y);
    if (hd < r.R! * 0.8 && !d.dead) {
      // pele não pode tocar a runa bruta
      const ux = hd > 0.5 ? (d.px - r.x) / hd : -1,
        uy = hd > 0.5 ? (d.py - r.y) / hd : 0;
      d.px += ux * 80 * dt;
      d.py += uy * 80 * dt;
      d.moveTarget = null;
      d.hp -= 7 * dt;
      if ((d._rnHurt = (d._rnHurt || 0) - dt) <= 0) {
        d._rnHurt = 1.3;
        spawnDungeonToast("A runa bruta queima a pele!", d.px, d.py - 30, RUNE_EL[r.el].c, 12);
        sfx("fail");
      }
      if (d.hp <= 0) {
        d.hp = 0;
        dungeonDeath();
      }
    }
  }
  for (let i = runes.length - 1; i >= 0; i--)
    if (runes[i].str <= 0) {
      const r = runes[i];
      addRing(r.x, r.y, RUNE_EL[r.el].c, 70, 0.9, 3);
      spawnDungeonToast("A Runa Natural se apagou", r.x, r.y - 20, "#c9b88a", 11);
      if (r._m) {
        try {
          glFree(r._m.patch);
          glFree(r._m.glyph);
        } catch (e) {}
      }
      runes.splice(i, 1);
    }
  d._frT = (d._frT == null ? 25 : d._frT) - dt; // runa fraturada na mochila pode estalar
  if (d._frT <= 0 && d.hero) {
    d._frT = 22 + Math.random() * 26;
    const has = runeInvs(d.hero).some((inv) => inv.items.some((it) => it.def.rune && it.def.rune.tier === "fraturada"));
    if (has && Math.random() < 0.5 && !d.dead) {
      const dm = 3 + Math.floor(Math.random() * 4);
      d.hp -= dm;
      spawnDungeonToast("💥 A Runa Fraturada estalou! −" + dm, d.px, d.py - 34, "#ff8a6a", 12);
      shakeScreen(0.15, 3);
      sfx("hit");
      if (d.hp <= 0) {
        d.hp = 0;
        dungeonDeath();
      }
    }
  }
}
export function runeDraw2D() {
  // visão 2D / 3D sem WebGL
  const d = dungeon;
  if (!d.runes || !d.runes.length || (D3.on && D3.gl)) return;
  const c = TELAS.dCtx,
    now = performance.now() / 1000;
  for (const r of d.runes) {
    const E = RUNE_EL[r.el],
      pul = 0.7 + 0.3 * Math.sin(now * 2.4 + (r.seed % 9));
    c.save();
    c.translate(r.x, r.y);
    runeLeafPatch(c, r.R!, r.seed, 1);
    const P = runePattern(r.seed);
    runeStrokes(c, P, r.R! * 0.88, E.c, 3.2, 14 * pul, 0.95);
    runeStrokes(c, P, r.R! * 0.88, "#fff6e0", 1.1, 0, 0.9);
    c.restore();
  }
  for (const m of d.monsters) {
    if (!m.alive || !m.runic) continue;
    const E = RUNE_EL[m.runic];
    c.save();
    const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, 34);
    g.addColorStop(0, rgba(E.c, 0.5));
    g.addColorStop(1, rgba(E.c, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(m.x, m.y, 34, 0, 6.283);
    c.fill();
    c.restore();
  }
}

/* ---- inicialização: ligações de interface ---- */
export function runeInit() {
  if (!WORLD_SAVE_KEYS.includes("runes")) WORLD_SAVE_KEYS.push("runes", "_rnT", "_rnK");
  HERO_STATE_LABEL.runa = "Na Runa Natural";
  const ia = document.getElementById("insp-actions");
  if (ia)
    ia.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-ract]") as HTMLElement;
      if (!b) return;
      const r = runeList().find((q) => q.id === b.dataset.rid);
      if (!r) return;
      if (b.dataset.ract === "send") runeSend(r);
      else if (b.dataset.ract === "absorb") {
        const h = runeHeroAt(r);
        if (h) runeAbsorbOpen({ hero: h, rune: r, where: "mapa" });
      }
    });
  raEnsureDom();
}
