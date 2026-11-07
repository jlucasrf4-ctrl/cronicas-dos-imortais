/* ==== Fase 4 — modelos low-poly: lobo, herói, cenário (base/11) ==== */
import { armaModelo, ESCUDO_COSTAS } from "./armas3d.ts";
import { MALHA, M4 } from "./geometria.ts";
import { WOLF_COATS } from "./shaders.ts";
import { gmix, MB, mbIco, mbBox, mbCyl, glMesh, grnd } from "./malhas.ts";
import { GL3, dungeon } from "../../core/state.ts";
import { glBuildCamp } from "../../survival/acampamento.ts";
import { glBuildVila } from "../../map/vila_cena.ts";
import { glBuildArena } from "../../field/treino.ts";
import { floorQuad } from "./estilo.ts";
import { glBuildHeroina, centroEscudo } from "./heroina.ts";
import { mbCenario, mbEnfeitesBorda, mbEnfeitesMeio } from "./cenario.ts";
import type { GLMesh, MalhaCrua } from "../../core/tipos.ts";

/* ---------- modelos ---------- */
export function glBuildWolfBase(ci: number) {
  MALHA._gs = 100 + ci;
  const coat = WOLF_COATS[ci],
    dark = gmix(coat, "#000000", 0.35),
    belly = gmix(coat, "#ffffff", ci === 3 ? 0.1 : 0.3),
    eye = ci === 6 ? "#ff3b2e" : "#ffcf4a",
    b = MB();
  mbIco(b, M4.ch(M4.T(-1, 13, 0), M4.S(22, 10.5, 12.5)), coat, 0, 0.12, 0.1);
  mbIco(b, M4.ch(M4.T(7, 14.5, 0), M4.S(14, 13.5, 13.5)), coat, 0, 0.15, 0.1);
  mbIco(b, M4.ch(M4.T(-9, 13, 0), M4.S(13, 11, 12)), coat, 0, 0.15, 0.1);
  mbBox(b, M4.ch(M4.T(12, 18, 0), M4.RZ(-0.55), M4.S(7, 8, 7.5)), coat, 0.85, 0.1);
  mbBox(b, M4.ch(M4.T(16.5, 20.5, 0), M4.S(8, 7, 7.6)), coat, 0.8, 0.1);
  mbBox(b, M4.ch(M4.T(21.5, 19, 0), M4.S(7, 3.6, 4.4)), belly, 0.75, 0.1);
  mbBox(b, M4.ch(M4.T(21, 16.8, 0), M4.S(6, 1.6, 3.6)), dark, 1, 0.1);
  mbBox(b, M4.ch(M4.T(25, 19.6, 0), M4.S(1.6, 1.6, 2.2)), "#151515");
  for (const s of [1, -1]) {
    mbBox(b, M4.ch(M4.T(19.6, 21.6, s * 2.5), M4.S(1.3, 1.1, 1.1)), eye);
    mbCyl(b, M4.ch(M4.T(15.5, 23, s * 2.4), M4.RX(s * 0.3), M4.RZ(0.2), M4.S(3.2, 6, 2.6)), dark, 3, 0, 0.1);
  }
  for (let i = 0; i < 5; i++)
    mbCyl(
      b,
      M4.ch(M4.T(-8 + i * 4, 17.5 + (i === 3 ? 1 : 0), 0), M4.RZ(0.7), M4.S(4.5, 6 + (i % 2) * 2.5, 4.2)),
      dark,
      4,
      0,
      0.1,
    );
  mbCyl(b, M4.ch(M4.T(-14, 15, 0), M4.RZ(1.95), M4.S(5, 14, 5)), coat, 5, 0.2, 0.1);
  mbCyl(b, M4.ch(M4.T(-14 - 12.5, 15 - 4.5, 0), M4.RZ(1.95), M4.S(2, 4, 2)), dark, 4, 0, 0.1);
  const l = MB();
  mbBox(l, M4.ch(M4.T(0, -5.5, 0), M4.S(3.4, 11, 3.4)), coat, 0.85, 0.1);
  mbBox(l, M4.ch(M4.T(0.8, -10.6, 0), M4.S(4.6, 1.8, 3.8)), dark, 1, 0.1);
  return { body: glMesh(b), leg: glMesh(l) };
}
/** As peças do herói low-poly (GL3.hero, GL3.port…), como glBuildHero devolve. */
export type ModeloHeroi = ReturnType<typeof glBuildHeroBase>;
export function glBuildHeroBase(color: string, EQ: Record<string, number>) {
  // herói low-poly arredondado; a aparência segue o equipamento
  EQ = EQ || { cabeca: 1, peito: 1, pernas: 1, pes: 1, maoD: 1, maoE: 1, costas: 1 };
  MALHA._gs = 9;
  const steel = "#a9b0ba",
    dk = "#5d626c",
    gold = "#d2ad45",
    tb = color || "#3f6fc4",
    skin = "#e2b48c",
    hair = "#5a3a22",
    leather = "#7a5530",
    linen = "#cfc2a0",
    pants = "#4a5a7a",
    boot = "#4a3020",
    P: Record<string, GLMesh> = {};
  const sleeve = EQ.peito ? leather : linen;
  const torso = MB();
  mbCyl(torso, M4.ch(M4.T(0, 12.6, 0), M4.S(8.6, 5.6, 10.2)), EQ.pernas ? pants : "#8a6a4a", 8, 0.95, 0.04); // quadril
  mbCyl(torso, M4.ch(M4.T(0, 17.6, 0), M4.S(8.4, 12.4, 10.6)), EQ.peito ? leather : linen, 8, 1.16, 0.05); // tronco (mais largo nos ombros)
  if (EQ.peito) {
    mbCyl(torso, M4.ch(M4.T(0, 25.5, 0), M4.S(9.9, 3.6, 12.3)), "#5e3f22", 8, 0.95);
    for (const s of [1, -1]) mbIco(torso, M4.ch(M4.T(0, 28.2, s * 6.6), M4.S(6.8, 4.6, 6.4)), "#8a6440", 1, 0.08, 0.06);
  }
  mbBox(torso, M4.ch(M4.T(3.9, 20.5, 0), M4.RZ(-0.06), M4.S(0.9, 10.5, 4.4)), tb, 0.8, 0.04); // tabardo
  mbBox(torso, M4.ch(M4.T(4.45, 23, 0), M4.S(0.3, 2.2, 1.6)), gold);
  mbCyl(torso, M4.ch(M4.T(0, 17.2, 0), M4.S(9.6, 1.7, 11.6)), "#3e2612", 8, 1);
  mbBox(torso, M4.ch(M4.T(4.9, 18, 0), M4.S(0.6, 1.8, 1.8)), gold);
  mbCyl(torso, M4.ch(M4.T(0, 29.6, 0), M4.S(4.2, 2.8, 4.2)), skin, 7, 1); // pescoço
  mbIco(torso, M4.ch(M4.T(0.3, 34.6, 0), M4.S(8.2, 9, 8)), skin, 1, 0.04); // cabeça
  for (const s of [1, -1]) {
    mbBox(torso, M4.ch(M4.T(4.15, 35.1, s * 1.6), M4.S(0.4, 0.8, 0.7)), "#1d140c");
    mbBox(torso, M4.ch(M4.T(3.9, 36.6, s * 1.7), M4.S(0.5, 0.45, 1.6)), hair);
  }
  mbBox(torso, M4.ch(M4.T(4.4, 34, 0), M4.S(1, 1.6, 1)), "#d29d78"); // nariz
  if (EQ.cabeca) {
    mbIco(torso, M4.ch(M4.T(-0.1, 36.6, 0), M4.S(9.2, 7.6, 9)), steel, 1, 0.03, 0.04);
    mbCyl(torso, M4.ch(M4.T(-0.1, 34.2, 0), M4.S(9.6, 1.3, 9.4)), dk, 10, 1);
    mbBox(torso, M4.ch(M4.T(4.6, 34.6, 0), M4.S(0.6, 3.4, 1)), dk);
    mbBox(torso, M4.ch(M4.T(-0.6, 40.6, 0), M4.S(6, 1.6, 1.2)), tb);
  } else {
    mbIco(torso, M4.ch(M4.T(-1, 37, 0), M4.S(8.6, 6.4, 8.8)), hair, 1, 0.18, 0.06);
    mbIco(torso, M4.ch(M4.T(-3, 34, 0), M4.S(4, 6, 7.6)), hair, 0, 0.2);
  }
  mbBox(torso, M4.ch(M4.T(-4.9, 21.5, 0), M4.RZ(0.07), M4.S(1, 16, 10)), gmix(tb, "#000000", 0.28), 1.25, 0.05); // capa
  P.torso = glMesh(torso);
  const leg = MB();
  mbCyl(leg, M4.ch(M4.T(0, -14, 0), M4.S(4.4, 14, 4.4)), EQ.pernas ? pants : skin, 7, 1.3, 0.04);
  if (EQ.pes) {
    mbCyl(leg, M4.ch(M4.T(0.3, -15.2, 0), M4.S(5.2, 5, 5)), boot, 7, 0.95);
    mbIco(leg, M4.ch(M4.T(2.3, -14.6, 0), M4.S(4.6, 2.6, 4.4)), boot, 0, 0.05);
  } else mbIco(leg, M4.ch(M4.T(1.6, -14.8, 0), M4.S(4.6, 2, 3.6)), skin, 0, 0.05);
  P.leg = glMesh(leg);
  const arm = (b: MalhaCrua) => {
    mbCyl(b, M4.ch(M4.T(0, -11.5, 0), M4.S(3.4, 11.5, 3.4)), sleeve, 7, 1.25, 0.04);
    mbIco(b, M4.ch(M4.T(0, -12.6, 0), M4.S(3.4)), EQ.peito ? "#5e3f22" : skin, 0, 0.05);
  };
  const ap = MB();
  arm(ap);
  P.armPlain = glMesh(ap);
  const sw = MB();
  mbCyl(sw, M4.ch(M4.T(-4.2, 0, 0), M4.RZ(-Math.PI / 2), M4.S(1.4, 4.2, 1.4)), "#4a2e16", 6, 1);
  mbIco(sw, M4.ch(M4.T(-4.6, 0, 0), M4.S(1.9)), gold, 0);
  mbBox(sw, M4.ch(M4.T(0.6, 0, 0), M4.S(1.1, 1.6, 7)), gold, 1);
  mbBox(sw, M4.ch(M4.T(10, 0, 0), M4.S(17.5, 0.9, 2.3)), "#e1e7ee", 1, 0.05);
  mbBox(sw, M4.ch(M4.T(9.5, 0.5, 0), M4.S(15.5, 0.15, 0.5)), "#9aa3ae");
  mbCyl(sw, M4.ch(M4.T(18.7, 0, 0), M4.RZ(-Math.PI / 2), M4.S(2.3, 3.6, 0.9)), "#e1e7ee", 4, 0);
  P.sword = armaModelo("eq_espada", null, null) ?? glMesh(sw); // v8.0: a espada desenhada (armas3d.ts)
  const sh = MB();
  arm(sh);
  mbCyl(sh, M4.ch(M4.T(1.2, -8.5, -1.2), M4.RX(-Math.PI / 2), M4.S(12, 1.5, 12)), "#8a6a3a", 10, 1, 0.05);
  mbCyl(sh, M4.ch(M4.T(1.2, -8.5, -1.0), M4.RX(-Math.PI / 2), M4.S(12.6, 0.9, 12.6)), dk, 10, 1);
  mbIco(sh, M4.ch(M4.T(1.2, -8.5, -2.9), M4.S(3.2, 3.2, 1.8)), gold, 0);
  for (let i = 0; i < 2; i++)
    mbBox(sh, M4.ch(M4.T(1.2, -8.5, -2.75), M4.RZ((i * Math.PI) / 2), M4.S(11, 0.8, 0.3)), "#5a3a1c");
  P.armShield = glMesh(sh);
  /* v7.7 — heroína: tronco, braços e pernas do modelo 3D; o escudo vai sozinho no antebraço esquerdo */
  Object.assign(P, glBuildHeroina());
  {
    const es = MB(),
      [ex, , ez] = centroEscudo();
    mbCyl(es, M4.ch(M4.T(ex, -8.5, ez), M4.RX(-Math.PI / 2), M4.S(12, 1.5, 12)), "#8a6a3a", 10, 1, 0.05);
    mbCyl(es, M4.ch(M4.T(ex, -8.5, ez + 0.2), M4.RX(-Math.PI / 2), M4.S(12.6, 0.9, 12.6)), dk, 10, 1);
    mbIco(es, M4.ch(M4.T(ex, -8.5, ez - 1.7), M4.S(3.2, 3.2, 1.8)), gold, 0);
    for (let i = 0; i < 2; i++)
      mbBox(es, M4.ch(M4.T(ex, -8.5, ez - 1.55), M4.RZ((i * Math.PI) / 2), M4.S(11, 0.8, 0.3)), "#5a3a1c");
    // v8.0: o escudo desenhado, com o centro onde ficava o disco (de frente em x/y, a espessura em z)
    P.escudo = armaModelo("eq_escudo", M4.T(ex, -8.5, ez), null) ?? glMesh(es);
  }
  const rod = (col: string, n?: number) => {
    const r = MB();
    mbCyl(r, M4.S(1, 1, 1), col, n || 7, 1);
    return glMesh(r);
  };
  P.rodAr = rod(sleeve);
  P.rodStr = rod("#f1e8d0", 4);
  P.rodWood = rod("#a8793f", 5);
  P.fletch = rod("#e05a4a", 3);
  {
    const ah = MB();
    mbCyl(ah, M4.S(1, 1, 1), "#c8ced8", 4, 0);
    P.arrowHead = glMesh(ah);
  }
  {
    const fs = MB();
    mbIco(fs, M4.S(0.8, 0.8, 0.8), EQ.peito ? "#5e3f22" : skin, 0, 0.05);
    P.fist = glMesh(fs);
  }
  {
    const bo = MB();
    for (let i = -6; i <= 6; i++) {
      const t = i / 6,
        x = -3 * t * t,
        y = 13 * t;
      mbCyl(
        bo,
        M4.ch(M4.T(x, y - 1.3, 0), M4.RZ(Math.atan2(6 * t, 13)), M4.S(1.4, 2.7, 1.4)),
        i % 3 === 0 ? "#6e4520" : "#8a5a2b",
        6,
        0.9,
      );
    }
    mbCyl(bo, M4.ch(M4.T(0, -2.1, 0), M4.S(2.2, 4.2, 2.2)), "#4a2e16", 6, 1);
    for (const sY of [1, -1]) mbIco(bo, M4.ch(M4.T(-3, 13 * sY, 0), M4.S(1.4)), gold, 0);
    P.bowOnly = armaModelo("eq_arco", null, null) ?? glMesh(bo); // v8.0: o arco desenhado
  }
  const back = MB();
  mbCyl(back, M4.ch(M4.T(-5.6, 24, 0), M4.RZ(Math.PI / 2), M4.S(11, 1.5, 11)), "#8a6a3a", 10, 1);
  mbIco(back, M4.ch(M4.T(-7.1, 24, 0), M4.S(1.6, 2.8, 2.8)), gold, 0);
  // v8.0: o escudo desenhado deitado nas costas (de frente para trás, a face de dentro em x = −5,6)
  P.shieldBack = armaModelo("eq_escudo", ESCUDO_COSTAS, null) ?? glMesh(back);
  return P;
}

export function glBuildMisc() {
  const M = GL3.mesh;
  MALHA._gs = 33;
  const bd = MB();
  mbIco(bd, M4.ch(M4.T(0, 4.5, 0), M4.S(6, 4, 4)), "#4a8fd8", 0, 0.1, 0.08);
  mbIco(bd, M4.ch(M4.T(3.2, 6.8, 0), M4.S(3.4)), "#4a8fd8", 0, 0.1);
  mbIco(bd, M4.ch(M4.T(0.5, 3.6, 0), M4.S(4.5, 2.4, 3)), "#efe0b6", 0, 0.1);
  mbCyl(bd, M4.ch(M4.T(4.6, 6.8, 0), M4.RZ(-Math.PI / 2), M4.S(1.4, 2.2, 1.4)), "#f0a020", 4, 0);
  mbBox(bd, M4.ch(M4.T(-3.8, 4.8, 0), M4.RZ(0.3), M4.S(3, 0.6, 2.6)), "#2f5f9a");
  M.bird = glMesh(bd);
  const wg = MB();
  mbBox(wg, M4.ch(M4.T(-0.5, 0, 2.6), M4.S(3.6, 0.5, 5)), "#3a78c0", 0.9);
  M.wing = glMesh(wg);
  const lg = MB();
  mbCyl(lg, M4.ch(M4.T(-7, 2.4, 0), M4.RZ(-Math.PI / 2), M4.S(4.8, 14, 4.8)), "#8a5a30", 6, 0.92, 0.12);
  mbCyl(lg, M4.ch(M4.T(1, 3.2, 1), M4.RX(-1.1), M4.S(1.5, 6, 1.5)), "#7a4e28", 4, 0.5);
  M.galho = glMesh(lg);
  const st = MB();
  mbIco(st, M4.ch(M4.T(0, 2.6, 0), M4.S(8, 5.5, 7)), "#8d9096", 0, 0.35, 0.12);
  M.pedra = glMesh(st);
  const hb = MB();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mbCyl(
      hb,
      M4.ch(
        M4.T(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5),
        M4.RX(Math.sin(a) * 0.45),
        M4.RZ(-Math.cos(a) * 0.45),
        M4.S(2, 8 + (i % 2) * 2, 2),
      ),
      i % 2 ? "#5aa845" : "#79c25a",
      3,
      0,
    );
  }
  M.erva = glMesh(hb);
  const pn = MB();
  mbBox(pn, M4.ch(M4.T(0, 0.6, 0), M4.RY(0.5), M4.S(10, 0.4, 3)), "#efebe2", 0.8);
  mbBox(pn, M4.ch(M4.T(0, 0.9, 0), M4.RY(0.5), M4.S(11, 0.4, 0.5)), "#b8a98a");
  M.pena = glMesh(pn);
  const sk = MB();
  mbIco(sk, M4.ch(M4.T(0, 4, 0), M4.S(10, 8, 9)), "#9a7448", 0, 0.2, 0.1);
  mbCyl(sk, M4.ch(M4.T(0, 7.4, 0), M4.S(4, 2.6, 4)), "#7a5634", 5, 0.8);
  mbBox(sk, M4.ch(M4.T(0, 7.2, 0), M4.S(4.6, 0.9, 4.6)), "#d2ad45");
  M.sack = glMesh(sk);
  /* v4.6 */
  for (const k of [
    "bird",
    "wing",
    "galho",
    "pedra",
    "erva",
    "pena",
    "sack",
    "carne",
    "pele",
    "presa",
    "gema",
    "lingote",
  ])
    if (GL3.mesh[k]) GL3.mesh[k].ol = true;
}
export function mbTree(b: MalhaCrua, x: number, z: number, kind: number, sc: number) {
  /* v7.7 — modelo da folha de natureza (render/gl/cenario.ts); sem ele, a árvore feita por código */
  const grupo =
    kind === 1
      ? "pinheiro"
      : kind === 2
        ? "outono"
        : kind === 3
          ? Math.abs(Math.sin(x * 3.7 + z * 1.3)) < 0.2
            ? "moita_outono"
            : "moita"
          : "folhosa";
  if (mbCenario(b, grupo, x, z, sc)) return;
  const tr = "#7a4a2a",
    greens = ["#7fb04f", "#6aa046", "#8cbd57"],
    autumn = ["#c58a3e", "#b9773a", "#d39a48"],
    pal = kind === 2 ? autumn : greens,
    g = () => pal[Math.floor(grnd() * 3)];
  if (kind === 1) {
    // pinheiro
    mbCyl(b, M4.ch(M4.T(x, 0, z), M4.S(4.5 * sc, 20 * sc, 4.5 * sc)), tr, 6, 0.7, 0.1);
    for (let i = 0; i < 4; i++)
      mbCyl(
        b,
        M4.ch(M4.T(x, (12 + i * 11) * sc, z), M4.RY(grnd() * 3), M4.S((30 - i * 6) * sc, 18 * sc, (30 - i * 6) * sc)),
        i % 2 ? "#4f8a3c" : "#5a9a44",
        7,
        0,
        0.12,
      );
    return;
  }
  if (kind === 3) {
    const n = 3 + Math.floor(grnd() * 3),
      bc = grnd() < 0.5 ? autumn : greens;
    for (let i = 0; i < n; i++) {
      const r = (9 + grnd() * 6) * sc;
      mbIco(
        b,
        M4.ch(M4.T(x + (grnd() - 0.5) * 18 * sc, r * 0.42, z + (grnd() - 0.5) * 14 * sc), M4.S(r)),
        bc[i % 3],
        1,
        0.22,
        0.1,
      );
    }
    return;
  }
  const h = (24 + grnd() * 10) * sc;
  mbCyl(b, M4.ch(M4.T(x, 0, z), M4.S(5.5 * sc, h, 5.5 * sc)), tr, 6, 0.65, 0.1);
  mbCyl(b, M4.ch(M4.T(x, h * 0.55, z), M4.RZ(0.7), M4.S(2.4 * sc, 10 * sc, 2.4 * sc)), tr, 5, 0.5, 0.1);
  const n = 2 + Math.floor(grnd() * 2);
  for (let i = 0; i < n; i++) {
    const r = (17 + grnd() * 9) * sc;
    mbIco(
      b,
      M4.ch(
        M4.T(x + (grnd() - 0.5) * 12 * sc, h + r * 0.35 + i * 5 * sc, z + (grnd() - 0.5) * 10 * sc),
        M4.S(r, r * 1.08, r),
      ),
      g(),
      1,
      0.25,
      0.1,
    );
  }
}
export function glBuildScene() {
  /* v5.9 */
  if (dungeon.vila) return glBuildVila(); // v8.0 — a vila andável (map/vila_cena.ts)
  return dungeon.camp ? glBuildCamp() : glBuildSceneBase4();
}
// etapa de glBuildScene: v5.0 + v5.7
function glBuildSceneBase4() {
  const r = glBuildSceneBase3();
  /* v5.7 */
  if (r && r.deco) {
    r.deco.stat = true;
    r.deco.uid = ++MALHA._statUid;
  }
  return r;
}
function glBuildSceneBase3() {
  return dungeon.training ? glBuildArena() : glBuildSceneBase2();
}
// etapa de glBuildScene: v4.6
function glBuildSceneBase2() {
  /* v4.6 */
  const d = dungeon,
    T = d.tile;
  MALHA.FLOOR_B = { x0: T, x1: d.cols * T - T, z0: T, z1: d.rows * T - T, T };
  try {
    return glBuildSceneBase();
  } finally {
    MALHA.FLOOR_B = null;
  }
}
// etapa de glBuildScene: original
function glBuildSceneBase() {
  const d = dungeon,
    T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    e = d.entrance,
    b = MB();
  MALHA._gs = 2024;
  for (let gy = -9; gy < d.rows + 8; gy++)
    for (let gx = -12; gx < d.cols + 12; gx++) {
      // a cor por ladrilho que era calculada aqui nunca era usada; o sorteio fica, porque o resto da cena segue a mesma sequência de grnd()
      grnd();
      floorQuad(b, gx * T, gy * T, T);
    }
  const floor = glMesh(b),
    o = MB(),
    clear = (x: number, z: number, r: number) => Math.hypot(x - e.x, z - e.y) < r;
  // fundo: penhascos de arenito e árvores
  for (let x = -6 * T; x < W + 6 * T; x += T * (1.2 + grnd() * 0.6)) {
    const h = 60 + grnd() * 50,
      z = -2.6 * T - grnd() * 2 * T;
    mbBox(
      o,
      M4.ch(M4.T(x, h / 2, z), M4.RY((grnd() - 0.5) * 0.4), M4.S(T * (1.3 + grnd() * 0.6), h, T * 1.6)),
      gmix("#ead29a", "#d9b57a", grnd()),
      0.9,
      0.06,
    );
  }
  for (let x = -3 * T; x < W + 3 * T; x += T * (0.9 + grnd() * 0.5))
    mbTree(o, x, -T * (0.1 + grnd() * 1.3), grnd() < 0.25 ? 1 : grnd() < 0.35 ? 2 : 0, 0.85 + grnd() * 0.4);
  for (let x = -T; x < W + T; x += T * (2 + grnd() * 2)) {
    const z = T * (0.3 + grnd() * 0.4);
    if (!mbCenario(o, "pedra", x, z, 0.75 + grnd() * 0.3))
      mbIco(
        o,
        M4.ch(M4.T(x, 3, z), M4.RY(grnd() * 3), M4.S(10 + grnd() * 8, 7 + grnd() * 5, 9 + grnd() * 6)),
        grnd() < 0.5 ? "#8d9096" : "#767a80",
        0,
        0.35,
        0.12,
      );
  }
  // laterais
  for (const side of [0, 1])
    for (let z = -T; z < H + 2 * T; z += T * (0.8 + grnd() * 0.5)) {
      const x = side ? W - T * 0.35 + grnd() * 4 * T : T * 0.35 - grnd() * 4 * T;
      if (clear(x, z, T * 2.6)) continue;
      const r = grnd();
      if (z > H - T * 1.2) {
        mbTree(o, x, z, 3, 0.7 + grnd() * 0.3);
        continue;
      }
      if (r < 0.55) mbTree(o, x, z, grnd() < 0.25 ? 1 : grnd() < 0.3 ? 2 : 0, 0.8 + grnd() * 0.4);
      else if (r < 0.8) mbTree(o, x, z, 3, 0.8 + grnd() * 0.4);
      else if (!mbCenario(o, "pedra", x, z, 0.9 + grnd() * 0.4))
        mbIco(
          o,
          M4.ch(M4.T(x, 4, z), M4.RY(grnd() * 3), M4.S(12 + grnd() * 10, 9 + grnd() * 8, 11 + grnd() * 8)),
          "#868a90",
          0,
          0.35,
          0.12,
        );
    }
  // frente: só coisas baixas
  for (let x = -T * 2; x < W + T * 2; x += T * (1.1 + grnd() * 1.2)) {
    const z = H - T * 0.45 + grnd() * T * 1.6;
    if (grnd() < 0.5) {
      if (!mbCenario(o, "pedra", x, z, 0.6 + grnd() * 0.3))
        mbIco(
          o,
          M4.ch(M4.T(x, 2.5, z), M4.RY(grnd() * 3), M4.S(9 + grnd() * 7, 5 + grnd() * 4, 8 + grnd() * 6)),
          "#8d9096",
          0,
          0.35,
          0.12,
        );
    } else mbTree(o, x, z, 3, 0.55 + grnd() * 0.2);
  }
  /* v7.7 — troncos, tocos, árvores secas, samambaias e cogumelos nas bordas (sorteio próprio) */
  mbEnfeitesBorda(o, W, H, T, MALHA._gs, (x, z) => clear(x, z, T * 2.4));
  /* v7.7 — e no meio do campo, longe da entrada, das runas e das moitas de esconder */
  mbEnfeitesMeio(
    o,
    W,
    H,
    T,
    MALHA._gs,
    (x, z) =>
      clear(x, z, T * 2.6) ||
      (d.runes || []).some((r) => Math.hypot(r.x - x, r.y - z) < (r.R || T) * 1.6 + T * 0.4) ||
      (d.bushes || []).some((m) => Math.hypot(m.x - x, m.y - z) < m.r + T * 0.4),
  );
  // entrada: arco de pedra e lajes em volta da zona segura
  const st = "#b3ada0";
  for (const s of [-1, 1]) {
    mbBox(o, M4.ch(M4.T(e.x - T * 0.95, 17, e.y + s * T * 1.3), M4.S(8, 34, 8)), st, 0.88, 0.08);
    mbBox(o, M4.ch(M4.T(e.x - T * 0.95, 1.5, e.y + s * T * 1.3), M4.S(11, 3, 11)), "#9a948a");
  }
  mbBox(o, M4.ch(M4.T(e.x - T * 0.95, 36, e.y), M4.S(10, 5, T * 2.6 + 14)), st, 0.95, 0.06);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      r = T * 1.4 + 4;
    mbBox(
      o,
      M4.ch(M4.T(e.x + Math.cos(a) * r, 0.8, e.y + Math.sin(a) * r), M4.RY(-a), M4.S(6, 1.6, 10)),
      "#a8a296",
      1,
      0.1,
    );
  }
  // tufos de grama e pedrinhas (só enfeite)
  for (let i = 0; i < 140; i++) {
    const x = -2 * T + grnd() * (W + 4 * T),
      z = -T + grnd() * (H + 2 * T);
    if (clear(x, z, T * 1.5)) continue;
    for (let j = 0; j < 3; j++) {
      const a = grnd() * 6.28;
      mbCyl(
        o,
        M4.ch(
          M4.T(x + Math.cos(a) * 1.5, 0, z + Math.sin(a) * 1.5),
          M4.RX((grnd() - 0.5) * 0.9),
          M4.RZ((grnd() - 0.5) * 0.9),
          M4.S(1.4, 4 + grnd() * 3, 1.4),
        ),
        grnd() < 0.5 ? "#a3b54a" : "#c4a75a",
        3,
        0,
      );
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = T + grnd() * (W - 2 * T),
      z = T + grnd() * (H - 2 * T);
    mbIco(o, M4.ch(M4.T(x, 0.6, z), M4.S(2 + grnd() * 2.5, 1.4, 2 + grnd() * 2)), "#9a9690", 0, 0.3, 0.1);
  }
  return { floor, deco: glMesh(o) };
}
