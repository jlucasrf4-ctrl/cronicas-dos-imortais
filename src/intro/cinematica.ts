/* ==== Fase 4 — história do novo jogo e a cinemática do coelho (base/19) ==== */
import { isArrowIt } from "../items/aljava.ts";
import { itemMsg } from "../field/masmorra.ts";
import { largarNoChao } from "../field/chao.ts";
import { lugarMaisPerto } from "../items/inventario.ts";
import { rastreioAlternar } from "../field/rastreio.ts";
import { pouparBandido } from "../field/bandidos.ts";
import { GL3, TELAS, OPT, camera, SEL, world, dungeon, JANELAS, econ } from "../core/state.ts";
import { audioCtx, musicStart, cineSfx, musicStop } from "../audio/som.ts";
import { MALHA, M4 } from "../render/gl/geometria.ts";
import { MB, mbIco, mbBox, glMesh, mbCyl, grnd, gmix, mbQuad } from "../render/gl/malhas.ts";
import { runePattern, runePickAt, openRuneInspector } from "../runas/runas.ts";
import { mbTree } from "../render/gl/modelos.ts";
import { glInit, glPush, glRender } from "../render/gl/renderer.ts";
import { bytes } from "../render/gl/chao.ts";
import { registrarCoelhoCine, animarCoelhoCine } from "./animacao_coelho.ts";
import { gfxDpr, optSave } from "../ui/opcoes.ts";
import { WORLD_K, MAPART, mapArtInit } from "../map/vetorial.ts";
import { CITIES } from "../data/economia.ts";
import { quadInit, quadSetBounds, quadOf } from "../map/quadrantes.ts";
import { SPAWN0, CONFIG } from "../core/config.ts";
import {
  resizeCanvas,
  constrainCamera,
  applyCameraTransform,
  fitToScreen,
  zoomAt,
  mapOverview,
} from "../map/camera.ts";
import { buildWaterGrid } from "../map/agua.ts";
import { seedVegetation } from "../sim/vegetacao.ts";
import { seedPopulation, snapToLand } from "../sim/animais.ts";
import { sampleStats } from "../sim/motor.ts";
import { updateHeroPanelUI, openPlantInspector, onHeroPanelClick } from "../ui/painel.ts";
import { pushEvent } from "../sim/eventos.ts";
import { anteaterClick } from "../creatures/tamandua.ts";
import { nearCamp, enterCamp } from "../survival/acampamento.ts";
import { termiteAt } from "../sim/cupinzeiros.ts";
import { mvToast } from "../ui/avisos.ts";
import { fitDungeonCanvas, switchWeapon, marcarFoco, limparFoco, interact, startSurvival } from "../field/masmorra.ts";
import { eApertado, eSolto } from "../ui/acoes.ts";
import { dPoint, D3 } from "../field/projecao.ts";
import { spearMode, spearChargeStart, bowRoll, spearDodge, espacoCorpo } from "../field/armas.ts";
import {
  wolfBody,
  startCharge,
  bodyDist,
  swingBasic,
  dungeonAttack,
  fireArrow,
  cancelarTiro,
} from "../field/acertos.ts";
import {
  toggleInv,
  renderInv,
  groundTake,
  groundPut,
  rotateDrag,
  doParry,
  tryExit,
  bankLoot,
  groundSync,
} from "../field/chao.ts";
import { exitDungeon, renderPrep, closePrep, prepShopClick, prepGo } from "../expedicao/preparo.ts";
import { INV, stackTarget, canPlace } from "../items/inventario.ts";
import { INV_CELL } from "../data/itens.ts";
import { prep, updateEcon, giveUpTrip } from "../econ/economia.ts";
import { closeCraft, healHerb } from "../econ/armaria.ts";
import { cApertado, cSolto } from "../field/craft_rapido.ts";
import { sheet, openSheet, onSheetClick, closeSheet } from "../ui/ficha.ts";
import { PORT } from "../render/retrato.ts";
import { loop } from "../core/laco.ts";
import { baseTapAt, baseMenu } from "../ui/menu_base.ts";
import { walkClick } from "../map/caca.ts";
import { fishSpot, askWork, workVerb } from "../minijogos/trabalho.ts";
import { cliqueComSelecao } from "../map/selecao.ts";
import { mapHitsSomething, mapHero } from "../map/controle.ts";
import { heroNaVila } from "../map/vila_musgo.ts";
import { vilaIr } from "../map/vila_cena.ts";
import { huntLabel } from "../render/sprites.ts";
import {
  openHeroInspector,
  openCityInspector,
  openInspector,
  openBag,
  winInit,
  resetWorld,
  openFullLog,
  closeFullLog,
} from "../ui/janelas.ts";
import { pickWildAt, openWildInspector, pickNodeAt, openNodeInspector } from "../sim/fauna.ts";
import { pickAnimalAt, pickPlantAt, layers } from "../map/render.ts";
import { openMarket } from "../econ/mercado.ts";
import { dispatchHero } from "../map/recursos.ts";
import { chestMoveAll, invItemMenu } from "../econ/bau.ts";
import { selAlternar, selSoltarGrupo } from "../items/selecao_inv.ts";
import { guardarNoBau } from "../items/bau_infinito.ts";
import { eqDropAt, eqSlotClick } from "../items/equipamento.ts";
import { refreshCreateUI, confirmCreateHero, closeCreateModal, randomizeCreate } from "../ui/criacao.ts";
import type { GLMesh, Monster } from "../core/tipos.ts";
import type { Mat4 } from "../render/gl/geometria.ts";

export function glDyn(VP: Mat4, P: number[], C: number[]) {
  const gl = GL3.gl;
  if (!P.length) return;
  gl.useProgram(GL3.tprog!);
  gl.uniformMatrix4fv(GL3.tVP!, false, VP);
  gl.bindVertexArray(GL3.tvao!);
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.tb![0]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.tb![1]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(C), gl.DYNAMIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES, 0, P.length / 3);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}

export function persp(fovy: number, asp: number, n: number, f: number) {
  const m = new Float32Array(16),
    t = 1 / Math.tan(fovy / 2);
  m[0] = t / asp;
  m[5] = t;
  m[10] = (f + n) / (n - f);
  m[11] = -1;
  m[14] = (2 * f * n) / (n - f);
  return m;
}

/* =====================================================================
   v3.16 — HISTÓRIA DO NOVO JOGO + CINEMÁTICA (coelho pisa numa runa natural e vira fera)
===================================================================== */
/** Anel de luz ou poeira da cinemática (t: quando surge; c: cor RGB). */
interface AnelCine {
  t: number;
  c: number[];
  big?: number;
  dust?: number;
}
/** Faísca da runa na cinemática. */
interface FaiscaCine {
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
  L: number;
  s: number;
}
/** Vaga-lume da cinemática. */
interface MoscaCine {
  x: number;
  y: number;
  z: number;
  ph: number;
}
interface EstadoIntro {
  open: boolean;
  i: number; // slide de texto atual
  timers: ReturnType<typeof setTimeout>[];
  cb: (() => void) | null; // chamado ao terminar
  raf: number;
  t0: number;
  phase: string; // "text" | "cine" …
  built: boolean;
  M: Record<string, GLMesh>; // malhas da cinemática (coelho, monstro, runa, chão…)
  scene: null; // sobra: ninguém mais usa
  fx: { rings: AnelCine[]; sparks: FaiscaCine[]; flies: MoscaCine[] };
  flags: Record<string, number>; // marcas do que já aconteceu na cinemática (1)
  // acrescentados depois
  lastHop?: number;
  lastT?: number;
  fz?: number | null; // tempo congelado (só lido)
}
export const INTRO: EstadoIntro = {
  open: false,
  i: -1,
  timers: [],
  cb: null,
  raf: 0,
  t0: 0,
  phase: "",
  built: false,
  M: {},
  scene: null,
  fx: { rings: [], sparks: [], flies: [] },
  flags: {},
};
const INTRO_SLIDES = [
  {
    t: "Há muitas gerações, a <b>Guerra do Continente Sul</b> incendiou reinos inteiros.",
    bg: "radial-gradient(ellipse at 50% 120%,rgba(180,60,20,.55),rgba(60,15,5,.25) 45%,#000 75%)",
    d: 5200,
  },
  {
    t: "Quando as últimas torres caíram, os <b>magos</b> foram saindo de cena…<br>um a um, sem deixar herdeiros.",
    bg: "radial-gradient(ellipse at 50% 30%,rgba(60,80,150,.35),rgba(10,15,40,.4) 50%,#000 80%)",
    d: 5600,
  },
  {
    t: "Por décadas, o mundo aprendeu a viver sem eles.<br>Aço, arco e trabalho duro. A magia virou história de taverna.",
    bg: "radial-gradient(ellipse at 50% 60%,rgba(120,95,55,.3),rgba(30,22,10,.35) 55%,#000 85%)",
    d: 5800,
  },
  {
    t: "Um mundo de <b>baixa magia</b>.",
    bg: "radial-gradient(ellipse at 50% 50%,rgba(90,80,60,.18),#000 70%)",
    d: 3800,
  },
  {
    t: "ATÉ QUE ALGO MUDOU.",
    bg: "radial-gradient(ellipse at 50% 50%,rgba(120,60,200,.35),rgba(30,10,60,.3) 40%,#000 75%)",
    d: 3600,
    big: true,
  },
];
function introBuild() {
  if (document.getElementById("intro")) return;
  const el = document.createElement("div");
  el.id = "intro";
  el.innerHTML =
    '<div id="intro-bg"></div><div id="cine"><canvas id="cine-ov"></canvas></div><div id="intro-text"></div><button id="intro-skip">Pular ▸▸</button><div id="intro-hint">clique para avançar · Esc para pular</div>';
  document.body.appendChild(el);
  el.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "intro-skip") {
      introSkip();
      return;
    }
    introNext();
  });
}
export function playIntro(cb: () => void) {
  introBuild();
  INTRO.cb = cb;
  INTRO.open = true;
  INTRO.i = -1;
  INTRO.phase = "text";
  INTRO.flags = {};
  const el = document.getElementById("intro")!;
  el.classList.add("open");
  document.getElementById("cine")!.classList.remove("on");
  document.getElementById("intro-hint")!.style.display = "";
  audioCtx();
  musicStart("dark", true);
  introNext();
}
function introClear() {
  INTRO.timers.forEach(clearTimeout);
  INTRO.timers = [];
}
export function introNext() {
  if (!INTRO.open) return;
  if (INTRO.phase === "cine") {
    if (INTRO.flags.title) introFinish();
    return;
  } // durante a cinemática o clique não pula cena (use "Pular")
  introClear();
  INTRO.i++;
  const tx = document.getElementById("intro-text")!,
    bg = document.getElementById("intro-bg")!;
  if (INTRO.i >= INTRO_SLIDES.length) {
    tx.classList.remove("show");
    INTRO.timers.push(setTimeout(() => cineStart(), 600));
    return;
  }
  const s = INTRO_SLIDES[INTRO.i];
  tx.classList.remove("show", "big");
  bg.style.background = s.bg;
  bg.style.opacity = "1";
  INTRO.timers.push(
    setTimeout(() => {
      tx.innerHTML = s.t;
      if (s.big) {
        tx.classList.add("big");
        cineSfx("boom");
      }
      tx.classList.add("show");
    }, 380),
  );
  INTRO.timers.push(setTimeout(() => tx.classList.remove("show"), s.d - 900));
  INTRO.timers.push(setTimeout(introNext, s.d));
}
export function introSkip() {
  introFinish();
}
function introFinish() {
  if (!INTRO.open) return;
  INTRO.open = false;
  introClear();
  cancelAnimationFrame(INTRO.raf);
  cineRestoreGL();
  const el = document.getElementById("intro")!;
  el.classList.remove("open");
  document.getElementById("intro-text")!.classList.remove("show", "big");
  musicStop(1.2);
  const cb = INTRO.cb;
  INTRO.cb = null;
  if (cb) cb();
}

/* ---------- motor: reaproveita o WebGL da masmorra (mesmo canvas, movido para a tela da cinemática) ---------- */
function cineRestoreGL() {
  if (!GL3.cv || !GL3._home) return;
  const cv = GL3.cv;
  cv.style.cssText = "";
  GL3._home.insertBefore(cv, GL3._home.firstChild);
  GL3._home = null;
  GL3.fr = 0;
}
function cineBuild() {
  /* v4.6 */
  const prev = MALHA._icoBoost;
  MALHA._icoBoost = 1;
  try {
    cineBuildBase();
  } finally {
    MALHA._icoBoost = prev;
  }
  const M = INTRO.M;
  for (const k of ["rabbit", "ear", "mon", "jaw", "crys", "fogo"]) if (M[k]) M[k].ol = true;
}
// etapa de cineBuild: original
function cineBuildBase() {
  if (INTRO.built) return;
  INTRO.built = true;
  const M = INTRO.M;
  // coelho
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
    M.rabbit = glMesh(b);
    registrarCoelhoCine(M.rabbit, b.p);
    const e = MB();
    mbBox(e, M4.ch(M4.T(0, 3.6, 0), M4.S(1.3, 7.2, 2.3)), fur, 0.55, 0.05);
    mbBox(e, M4.ch(M4.T(0.5, 3.4, 0), M4.S(0.5, 5.6, 1.3)), "#e3b2a8", 0.5);
    M.ear = glMesh(e);
  }
  // fera rúnica
  MALHA._gs = 777;
  {
    const fur = "#66507a",
      fur2 = "#4e3d5f",
      bone = "#e8dcc0",
      claw = "#2c2333",
      b = MB();
    mbIco(b, M4.ch(M4.T(-2, 15, 0), M4.S(22, 17, 17)), fur, 1, 0.22, 0.08);
    mbIco(b, M4.ch(M4.T(7, 19, 0), M4.S(16, 16, 17)), fur, 1, 0.2, 0.08);
    for (const s of [1, -1]) {
      mbIco(b, M4.ch(M4.T(-8, 10.5, 6.5 * s), M4.S(14, 14, 8.5)), fur2, 1, 0.18, 0.08);
      mbBox(b, M4.ch(M4.T(-4, 1.2, 7.6 * s), M4.S(14, 2.4, 5)), claw, 0.8);
      for (const k of [-1.5, 0, 1.5])
        mbCyl(b, M4.ch(M4.T(3, 1.1, 7.6 * s + k), M4.RZ(-Math.PI / 2), M4.S(1.4, 3.2, 1.4)), bone, 4, 0);
      mbBox(b, M4.ch(M4.T(11, 8, 7 * s), M4.RZ(0.15), M4.S(5, 14, 5)), fur, 0.8, 0.08);
      mbBox(b, M4.ch(M4.T(12.5, 1.5, 7 * s), M4.S(6, 3, 5)), claw);
      for (const k of [-1.6, 0, 1.6])
        mbCyl(b, M4.ch(M4.T(15, 1.2, 7 * s + k), M4.RZ(-Math.PI / 2 - 0.3), M4.S(1.3, 3.6, 1.3)), bone, 4, 0);
      mbBox(b, M4.ch(M4.T(15, 33, 3.2 * s), M4.RZ(0.45), M4.RX(0.25 * s), M4.S(3, 16, 4.5)), fur, 0.45, 0.08);
      mbBox(b, M4.ch(M4.T(15.6, 32.5, 3.2 * s), M4.RZ(0.45), M4.RX(0.25 * s), M4.S(1, 12, 2.4)), "#7a4a6a", 0.45);
      mbCyl(b, M4.ch(M4.T(15, 28.5, 4.6 * s), M4.RX(-0.9 * s), M4.RZ(0.65), M4.S(3.2, 11, 3.2)), bone, 5, 0, 0.06);
      mbCyl(b, M4.ch(M4.T(23.4, 22.3, 2 * s), M4.RX(Math.PI), M4.S(1.3, 3.4, 1.3)), bone, 4, 0);
    }
    mbBox(b, M4.ch(M4.T(12, 22, 0), M4.RZ(-0.5), M4.S(9, 9, 10)), fur, 0.9, 0.08);
    mbBox(b, M4.ch(M4.T(16.5, 25.5, 0), M4.S(10, 9, 10)), fur, 0.85, 0.08);
    mbBox(b, M4.ch(M4.T(21.5, 24.4, 0), M4.S(7, 4.4, 7)), fur2, 0.8, 0.06);
    mbBox(b, M4.ch(M4.T(25, 25.2, 0), M4.S(1.2, 1.3, 2.6)), "#120a14");
    mbIco(b, M4.ch(M4.T(-13, 17, 0), M4.S(7.5)), "#8f7fa3", 0, 0.3, 0.1);
    for (const s of [1, -1])
      for (let k = 0; k < 3; k++)
        mbBox(b, M4.ch(M4.T(-6 + k * 5, 15 + k, 8.2 * s), M4.RX(0.3 * s), M4.RZ(0.6), M4.S(1, 6, 0.4)), "#c9a2ff");
    for (let i = 0; i < 6; i++)
      mbCyl(
        b,
        M4.ch(M4.T(-12 + i * 3.4, 23.5 - Math.abs(i - 3) * 1.3, 0), M4.RZ(0.55), M4.S(3.4, 5 + (i % 2) * 2, 3.4)),
        claw,
        4,
        0,
        0.1,
      );
    M.mon = glMesh(b);
    const j = MB();
    mbBox(j, M4.ch(M4.T(3, -1.2, 0), M4.S(7, 2.4, 6.4)), fur2, 1, 0.06);
    for (const s of [1, -1]) mbCyl(j, M4.ch(M4.T(5.4, -0.2, 1.9 * s), M4.S(1, 2.6, 1)), bone, 4, 0);
    M.jaw = glMesh(j);
    const ey = MB();
    for (const s of [1, -1]) mbBox(ey, M4.ch(M4.T(20.8, 27.3, 2.9 * s), M4.S(1.6, 1.4, 1.8)), "#ff8a2a");
    M.eyes = glMesh(ey);
    const cr = MB();
    for (let i = 0; i < 9; i++) {
      const x = -14 + i * 3.4,
        y = 27.5 - Math.abs(i - 4) * 1.4;
      mbCyl(
        cr,
        M4.ch(
          M4.T(x, y, (grnd() - 0.5) * 6),
          M4.RZ(0.35 + grnd() * 0.3),
          M4.RX((grnd() - 0.5) * 0.8),
          M4.S(3.2, 6 + grnd() * 6, 3.2),
        ),
        i % 2 ? "#d9772e" : "#f2a35a",
        5,
        0,
        0.1,
      );
    }
    for (const s of [1, -1]) mbCyl(cr, M4.ch(M4.T(6, 30, 6 * s), M4.RX(-0.6 * s), M4.S(2.6, 7, 2.6)), "#e8904a", 5, 0);
    M.crys = glMesh(cr);
  }
  // v8.0 — o coelho de fogo do Tripo (tools/gerar-coelho-fogo.ts) no lugar da fera feita por código, que fica de
  // reserva (sem os dados, nos testes em Node)
  if (COELHO_FOGO.p) {
    const P = new Int16Array(bytes(COELHO_FOGO.p).buffer),
      Cc = bytes(COELHO_FOGO.c || ""),
      b = MB();
    for (let t = 0; t < P.length / 9; t++) {
      const v = [0, 1, 2].map((j) => [
          P[t * 9 + j * 3] / 20000,
          P[t * 9 + j * 3 + 1] / 20000,
          P[t * 9 + j * 3 + 2] / 20000,
        ]),
        u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]],
        w = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]],
        n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]],
        l = Math.hypot(n[0], n[1], n[2]) || 1;
      for (const q of v) {
        b.p.push(q[0], q[1], q[2]);
        b.n.push(n[0] / l, n[1] / l, n[2] / l);
        b.c.push(...[0, 1, 2].map((e) => Math.min(1, (Cc[t * 3 + e] / 255) * FOGO.luz)));
      }
    }
    M.fogo = glMesh(b);
    registrarCoelhoCine(M.fogo, b.p);
  }
  // runa natural: traços brilhantes sob um tapete de folhas de Folhama (não é altar)
  MALHA._gs = 99;
  {
    const R = 24,
      b = MB(),
      cols = ["#3f6a2c", "#4f7a35", "#5c8a45", "#6d9a4c", "#476f30", "#587f3a"];
    mbCyl(b, M4.ch(M4.T(0, 0.04, 0), M4.S(R * 2.7, 0.3, R * 2.7)), "#4a3a22", 12, 1, 0.08);
    for (let i = 0; i < 16; i++) {
      const a = grnd() * 6.28,
        rr = R * (1.0 + grnd() * 0.55);
      mbIco(
        b,
        M4.ch(M4.T(Math.cos(a) * rr, 0.45, Math.sin(a) * rr), M4.RY(grnd() * 6.28), M4.S(R * 0.3, 0.45, R * 0.13)),
        ["#8a5a2a", "#a3692e", "#6b4a22", "#b07a36"][i % 4],
        0,
        0.2,
        0.1,
      );
    }
    for (let i = 0; i < 30; i++) {
      const x = (grnd() * 2 - 1) * R * 0.9,
        z = (grnd() * 2 - 1) * R * 0.9,
        L = R * (0.36 + grnd() * 0.26);
      mbIco(
        b,
        M4.ch(M4.T(x, 0.5 + i * 0.02, z), M4.RY(grnd() * 6.28), M4.S(L, 0.55, L * 0.42)),
        cols[i % cols.length],
        0,
        0.15,
        0.1,
      );
    }
    M.slab = glMesh(b);
    const g = MB(),
      S = R * 0.9;
    for (const s of runePattern(CINE_RUNE_SEED))
      for (let i = 0; i < s.length - 1; i++) {
        const ax = s[i][0] * S,
          az = s[i][1] * S,
          bx = s[i + 1][0] * S,
          bz = s[i + 1][1] * S,
          L = Math.hypot(bx - ax, bz - az),
          a = Math.atan2(bz - az, bx - ax);
        mbBox(g, M4.ch(M4.T((ax + bx) / 2, 1.5, (az + bz) / 2), M4.RY(-a), M4.S(L + 1.6, 0.45, 1.6)), "#4d4840");
      }
    M.glyph = glMesh(g);
  }
  // clareira: chão, árvores, pedras, flores
  MALHA._gs = 4242;
  {
    const b = MB(),
      T = 18;
    for (let gz = -22; gz < 22; gz++)
      for (let gx = -22; gx < 22; gx++) {
        const x = gx * T,
          z = gz * T,
          cx = x + T / 2,
          cz = z + T / 2,
          r = Math.hypot(cx, cz),
          n = (Math.sin(gx * 0.5) + Math.sin(gz * 0.37 + 1.3) + Math.sin((gx + gz) * 0.23)) / 3;
        let c = gmix("#7fae4f", "#a7c25e", 0.5 + n * 0.6);
        if (r < 34) c = gmix(c, "#6f6a3a", 0.5 * (1 - r / 34));
        mbQuad(
          b,
          [x, 0, z],
          [x + T, 0, z],
          [x + T, 0, z + T],
          [x, 0, z + T],
          c,
          [cx, -1, cz],
          1 + (grnd() - 0.5) * 0.05,
        );
      }
    M.ground = glMesh(b);
    const o = MB();
    for (let i = 0; i < 150; i++) {
      const a = grnd() * 6.283,
        r = 58 + grnd() * 260,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (z > -12 && Math.abs(x) < 150 && r < 250) continue;
      mbTree(o, x, z, grnd() < 0.3 ? 1 : grnd() < 0.25 ? 2 : 0, 0.9 + grnd() * 0.6);
    }
    for (let i = 0; i < 16; i++) {
      const x = (grnd() - 0.5) * 260,
        z = 40 + grnd() * 60;
      if (Math.abs(x) < 35) continue;
      if (grnd() < 0.5) mbTree(o, x, z, 3, 0.55 + grnd() * 0.3);
      else
        mbIco(
          o,
          M4.ch(M4.T(x, 2.5, z), M4.S(8 + grnd() * 8, 5 + grnd() * 4, 7 + grnd() * 6)),
          "#8d9096",
          0,
          0.35,
          0.12,
        );
    }
    for (let i = 0; i < 260; i++) {
      const x = (grnd() - 0.5) * 380,
        z = (grnd() - 0.5) * 380;
      if (Math.hypot(x, z) < 18) continue;
      for (let j = 0; j < 3; j++) {
        const a = grnd() * 6.28;
        mbCyl(
          o,
          M4.ch(
            M4.T(x + Math.cos(a) * 1.4, 0, z + Math.sin(a) * 1.4),
            M4.RX((grnd() - 0.5) * 0.8),
            M4.RZ((grnd() - 0.5) * 0.8),
            M4.S(1.3, 3.5 + grnd() * 3, 1.3),
          ),
          grnd() < 0.6 ? "#5e8f3a" : "#86a84a",
          3,
          0,
        );
      }
    }
    for (let i = 0; i < 70; i++) {
      const x = (grnd() - 0.5) * 300,
        z = (grnd() - 0.5) * 300;
      if (Math.hypot(x, z) < 20) continue;
      mbIco(o, M4.ch(M4.T(x, 1.6, z), M4.S(1.6)), ["#f5d34a", "#e86a8a", "#ffffff", "#b58cff"][i % 4], 0, 0.2);
      mbCyl(o, M4.ch(M4.T(x, 0, z), M4.S(0.5, 1.4, 0.5)), "#4f7f3a", 3, 1);
    }
    M.deco = glMesh(o);
  }
}
// v8.0 — o coelho de fogo (src/assets/models/coelho_fogo.json, tools/gerar-coelho-fogo.ts): o marcador precisa de `{}`
// logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio e vale a fera de código
const COELHO_FOGO = /* @inline-json src/assets/models/coelho_fogo.json */ {} as { p?: string; c?: string };
/** tam: comprimento (o modelo vem com maior medida = 1); dx: recua para o meio do corpo ficar na runa; luz: clareia a
    cor do Tripo; brasa: o brilho de fogo que pulsa (tint) e sobe no rugido. */
const FOGO = { tam: 46, dx: 2, luz: 1.25, brasa: 0.12 };
// coelho: pulos até a runa
const CINE_RUNE_SEED = 31;
const RAB_PATH = (() => {
  const hops: { t0: number; x0: number; z0: number; x1: number; z1: number }[] = [],
    add = (x0: number, z0: number, x1: number, z1: number, n: number, t0: number) => {
      for (let i = 0; i < n; i++)
        hops.push({
          t0: t0 + i * 0.44,
          x0: x0 + ((x1 - x0) * i) / n,
          z0: z0 + ((z1 - z0) * i) / n,
          x1: x0 + ((x1 - x0) * (i + 1)) / n,
          z1: z0 + ((z1 - z0) * (i + 1)) / n,
        });
    };
  add(-82, 16, -19, 3, 8, 1.1);
  add(-19, 3, 0, 0, 2, 6.35);
  return hops;
})();
function rabbitAt(t: number) {
  const H = RAB_PATH;
  let x = H[0].x0,
    z = H[0].z0,
    y = 0,
    sq = 1,
    yaw = Math.atan2(H[0].z1 - H[0].z0, H[0].x1 - H[0].x0),
    hop = false;
  for (const h of H) {
    if (t < h.t0) break;
    const p = Math.min(1, (t - h.t0) / 0.38);
    x = h.x0 + (h.x1 - h.x0) * p;
    z = h.z0 + (h.z1 - h.z0) * p;
    yaw = Math.atan2(h.z1 - h.z0, h.x1 - h.x0);
    if (p < 1) {
      y = Math.sin(p * Math.PI) * 5;
      sq = 1 + Math.sin(p * Math.PI) * 0.12;
      hop = true;
    } else {
      y = 0;
      sq = 1;
    }
  }
  if (t > 4.7 && t < 6.35) yaw += Math.sin((t - 4.7) * 3) * 0.35; // fareja em volta
  return { x, z, y, sq, yaw, hop };
}
const sstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
export function cineStart() {
  INTRO.phase = "cine";
  document.getElementById("intro-hint")!.style.display = "none";
  const bg = document.getElementById("intro-bg")!;
  bg.style.opacity = "0";
  if (!GL3.tried) glInit();
  const cine = document.getElementById("cine")!;
  cine.classList.add("on");
  INTRO.fx = { rings: [], sparks: [], flies: [] };
  INTRO.flags = {};
  INTRO.lastHop = -1;
  for (let i = 0; i < 26; i++)
    INTRO.fx.flies.push({
      x: (Math.random() - 0.5) * 160,
      y: 2 + Math.random() * 14,
      z: (Math.random() - 0.5) * 90,
      ph: Math.random() * 6,
    });
  if (GL3.ok) {
    cineBuild();
    GL3._home = GL3.cv.parentNode;
    cine.insertBefore(GL3.cv, cine.firstChild);
    GL3.cv.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;display:block;border-radius:0;transform:none";
  }
  INTRO.t0 = performance.now();
  INTRO.raf = requestAnimationFrame(cineFrame);
}
function cineFrame(now: number) {
  if (!INTRO.open) return;
  INTRO.raf = requestAnimationFrame(cineFrame);
  const t = INTRO.fz != null ? INTRO.fz : (now - INTRO.t0) / 1000,
    F = INTRO.flags,
    ov = document.getElementById("cine-ov") as HTMLCanvasElement,
    W = innerWidth,
    H = innerHeight,
    dpr = Math.min(2, gfxDpr());
  if (ov.width !== Math.round(W * dpr) || ov.height !== Math.round(H * dpr)) {
    ov.width = Math.round(W * dpr);
    ov.height = Math.round(H * dpr);
  }
  // sons marcados no tempo
  const once = (k: string, at: number, fn: () => void) => {
    if (!F[k] && t >= at) {
      F[k] = 1;
      fn();
    }
  };
  for (let i = 0; i < RAB_PATH.length; i++) once("h" + i, RAB_PATH[i].t0, () => cineSfx("hop"));
  once("land", 7.2, () => {
    cineSfx("rune");
    INTRO.fx.rings.push({ t: 7.2, c: [1, 0.6, 0.25] }, { t: 7.55, c: [1, 0.82, 0.5] }, { t: 7.95, c: [1, 0.5, 0.18] });
  });
  once("rise", 7.9, () => cineSfx("rise"));
  once("flash", 10.6, () => {
    cineSfx("flash");
    cineSfx("suck");
    musicStart("dark");
    INTRO.fx.rings.push({ t: 10.6, c: [1, 0.92, 0.8], big: 1 }, { t: 10.75, c: [0.55, 0.45, 0.3], dust: 1 });
  });
  once("roar", 12.1, () => {
    cineSfx("roar");
    INTRO.fx.rings.push({ t: 12.1, c: [0.55, 0.45, 0.3], dust: 1 }, { t: 12.2, c: [1, 0.55, 0.22] });
  });
  once("titleS", 17.4, () => cineSfx("title"));
  if (t > 21.5) {
    introFinish();
    return;
  }
  if (GL3.ok) cineRenderGL(t, W, H, dpr);
  // camada 2D: faixas de cinema, vinheta, clarão, legendas, título
  const c = ov.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  if (!GL3.ok) cineFallback2D(c, t, W, H);
  const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.55)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  const lb = H * 0.11 * sstep(0, 1.2, t);
  c.fillStyle = "#000";
  c.fillRect(0, 0, W, lb);
  c.fillRect(0, H - lb, W, lb);
  const fadeIn = 1 - sstep(0, 1.6, t);
  if (fadeIn > 0) {
    c.fillStyle = "rgba(0,0,0," + fadeIn + ")";
    c.fillRect(0, 0, W, H);
  }
  if (t >= 10.45 && t < 12.2) {
    const a = t < 10.6 ? sstep(10.45, 10.6, t) : 1 - sstep(10.6, 12.2, t);
    c.fillStyle = "rgba(255,248,255," + a + ")";
    c.fillRect(0, 0, W, H);
  }
  if (t >= 9.6 && t < 10.6) {
    c.fillStyle = "rgba(255,140,50," + 0.18 * sstep(9.6, 10.6, t) + ")";
    c.fillRect(0, 0, W, H);
  }
  const sub = (txt: string, a0: number, a1: number, y: number) => {
    const a = sstep(a0, a0 + 0.8, t) * (1 - sstep(a1 - 0.8, a1, t));
    if (a <= 0) return;
    c.save();
    c.globalAlpha = a;
    c.textAlign = "center";
    c.font = "italic " + Math.max(16, Math.min(26, W / 48)) + "px Lora, serif";
    c.fillStyle = "#f1e3c0";
    c.shadowColor = "#000";
    c.shadowBlur = 10;
    c.fillText(txt, W / 2, y);
    c.restore();
  };
  sub("Numa clareira qualquer, longe de todas as torres…", 1.4, 5.2, H - lb - 22);
  sub("…sob as folhas, uma runa natural pulsava em silêncio.", 5.4, 9.2, H - lb - 22);
  sub("Algo despertou.", 13.4, 16.6, H - lb - 22);
  const blk = sstep(16.2, 17.2, t);
  if (blk > 0) {
    c.fillStyle = "rgba(0,0,0," + blk + ")";
    c.fillRect(0, 0, W, H);
  }
  if (t > 17.2) {
    F.title = 1;
    const a = sstep(17.4, 18.6, t) * (1 - sstep(20.6, 21.5, t));
    c.save();
    c.globalAlpha = a;
    c.textAlign = "center";
    c.font = "600 " + Math.max(11, W / 90) + "px Cinzel, serif";
    c.fillStyle = "#cdb27a";
    c.fillText("M A P A   V I V O", W / 2, H / 2 - Math.min(80, W / 12));
    const fs = Math.max(30, Math.min(78, W / 13));
    c.font = "900 " + fs + "px 'Cinzel Decorative', Cinzel, serif";
    const g = c.createLinearGradient(0, H / 2 - fs, 0, H / 2 + fs * 0.2);
    g.addColorStop(0, "#fff2c9");
    g.addColorStop(0.5, "#f0c66e");
    g.addColorStop(1, "#a8742c");
    c.shadowColor = "rgba(240,190,90,.35)";
    c.shadowBlur = 24;
    c.fillStyle = g;
    c.fillText("Crônicas dos Imortais", W / 2, H / 2);
    c.shadowBlur = 0;
    c.font = "italic " + Math.max(14, W / 70) + "px Lora, serif";
    c.fillStyle = "#ffb36b";
    c.globalAlpha = a * sstep(18.4, 19.4, t);
    c.fillText("As runas despertaram.", W / 2, H / 2 + Math.min(60, W / 16));
    c.globalAlpha = a * 0.7 * sstep(19.4, 20, t);
    c.font = "11px Lora, serif";
    c.fillStyle = "#8d7c5a";
    c.fillText("clique para começar", W / 2, H - 40);
    c.restore();
  }
}
function cineRenderGL(t: number, W: number, H: number, dpr: number) {
  const cv = GL3.cv,
    M = INTRO.M;
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const R = rabbitAt(t),
    mon = t >= 10.6;
  if (M.rabbit) animarCoelhoCine(M.rabbit, t, false, R.hop && t < 7.2);
  if (M.fogo && mon) animarCoelhoCine(M.fogo, t, true, t < 12.1);
  // câmera
  let tx, ty, tz, d, h, az;
  if (t < 6.4) {
    const k = sstep(0, 6.2, t);
    tx = lerpN(-55, R.x, sstep(0.8, 3, t));
    ty = 4;
    tz = lerpN(8, R.z, sstep(0.8, 3, t));
    d = lerpN(118, 58, k);
    h = lerpN(42, 20, k);
    az = lerpN(1.25, 1.5, k);
  } else if (t < 7.6) {
    const k = sstep(6.4, 7.6, t);
    tx = lerpN(R.x, 0, k);
    ty = 4;
    tz = lerpN(R.z, 0, k);
    d = lerpN(58, 52, k);
    h = lerpN(20, 16, k);
    az = 1.5;
  } else if (!mon) {
    const k = sstep(7.6, 10.6, t),
      lev = sstep(7.8, 10.2, t) * 9;
    tx = 0;
    ty = 4 + lev * 0.8;
    tz = 0;
    d = lerpN(54, 42, k);
    h = lerpN(16, 8, k);
    az = lerpN(1.5, 1.78, k);
  } else {
    const k = sstep(10.6, 16.5, t);
    tx = 2;
    ty = lerpN(14, 19, sstep(11.2, 12.4, t));
    tz = 0;
    d = lerpN(104, 92, k);
    h = lerpN(30, 24, k);
    az = lerpN(1.45, 1.85, k);
  }
  const shake = (t > 12.1 && t < 13.6 ? (1 - (t - 12.1) / 1.5) * 1.6 : 0) + (t > 10.2 && t < 10.6 ? 0.5 : 0);
  const eye = [
      tx + Math.cos(az) * d + (Math.random() - 0.5) * shake,
      ty + h + (Math.random() - 0.5) * shake,
      tz + Math.sin(az) * d,
    ],
    tgt = [tx, ty, tz];
  const VP = M4.mul(persp(0.66, W / H, 1, 1200), M4.look(eye, tgt, [0, 1, 0]));
  const Ld = (() => {
      const v = [0.5, -0.55, 0.62],
        l = Math.hypot(...v);
      return v.map((x) => x / l);
    })(),
    Rr = 260,
    ctr = [0, 0, 0];
  const LV = M4.mul(
    M4.ortho(-Rr, Rr, -Rr, Rr, 1, 1400),
    M4.look([-Ld[0] * 600, -Ld[1] * 600, -Ld[2] * 600], ctr, [0, 1, 0]),
  );
  GL3.list.length = 0;
  glPush(M.ground, M4.id(), null, false);
  glPush(M.deco, M4.id());
  glPush(M.slab, M4.id());
  const runeOn =
    t < 7.2
      ? 0.1 + 0.05 * Math.sin(t * 3) + 0.2 * sstep(5.5, 7.1, t)
      : !mon
        ? 0.95
        : lerpN(0.95, 0.35, sstep(10.6, 13, t)) + 0.08 * Math.sin(t * 6);
  glPush(M.glyph, M4.id(), [1, 0.62, 0.26, Math.min(0.97, runeOn)], false);
  if (!mon) {
    const lev = t > 7.2 ? sstep(7.8, 10.2, t) * 9 : 0,
      spin = t > 7.8 ? Math.pow(Math.max(0, t - 7.8), 1.6) * 0.9 : 0,
      trem = t > 8.4 ? (t - 8.4) * 0.25 : 0;
    const sw = t > 9.9 ? 1 + sstep(9.9, 10.6, t) * 0.9 + Math.sin(t * 60) * 0.06 * sstep(9.9, 10.6, t) : 1,
      glow = t > 7.2 ? Math.min(0.75, sstep(7.3, 10.2, t) * 0.75) : 0;
    const x = (t < 7.2 ? R.x : 0) + (Math.random() - 0.5) * trem,
      z = (t < 7.2 ? R.z : 0) + (Math.random() - 0.5) * trem,
      y = (t < 7.2 ? R.y : 2.2 + lev) + (Math.random() - 0.5) * trem;
    const base = M4.ch(
      M4.T(x, y, z),
      M4.RY(-(t < 7.2 ? R.yaw : R.yaw + spin)),
      M4.S(sw * (t < 7.2 ? 1 / R.sq : 1), sw * (t < 7.2 ? R.sq : 1), sw),
      t < 7.2 && R.hop ? M4.RZ(0.12) : M4.id(),
    );
    const tint = glow > 0 ? [1, 0.62, 0.3, glow] : null;
    glPush(M.rabbit, base, tint);
    const tw =
      (t > 4.7 && t < 6.35 ? Math.sin(t * 9) * 0.15 : 0) +
      (R.hop && t < 7.2 ? -0.35 : 0) +
      (t > 7.4 ? -0.5 * sstep(7.4, 8, t) : 0);
    for (const s of [1, -1])
      glPush(M.ear, M4.ch(base, M4.T(5, 9.2, s), M4.RX(0.2 * s), M4.RZ(0.3 + tw + (s > 0 ? 0.04 : 0))), tint);
  } else {
    const rise = sstep(11.2, 12.1, t),
      breathe = Math.sin(t * 2.2) * 0.4,
      pitch = lerpN(-0.32, 0.1, rise),
      roar =
        t > 12.1 && t < 13.7
          ? Math.sin((Math.min(1, (t - 12.1) / 0.25) * Math.PI) / 2) * (1 - sstep(13.2, 13.7, t))
          : 0;
    const yaw = 1.05,
      avanco = sstep(11.1, 12.1, t) * 3,
      base = M4.ch(
        M4.T(Math.cos(yaw) * avanco, 2.2 + breathe - (1 - rise) * 3, Math.sin(yaw) * avanco),
        M4.RY(-yaw),
        M4.S(1.15),
        M4.T(-4, 0, 0),
        M4.RZ(pitch + roar * 0.12),
        M4.T(4, 0, 0),
      );
    const fl = t < 11.2 ? 1 - sstep(10.6, 11.2, t) : 0,
      tint = fl > 0 ? [1, 1, 1, fl] : null;
    if (M.fogo) {
      // v8.0: o coelho de fogo (uma peça: sem a boca que abre); o fogo pulsa e acende mais no rugido
      const brasa = FOGO.brasa + 0.1 * Math.sin(t * 7) + 0.25 * roar;
      glPush(M.fogo, M4.ch(base, M4.T(FOGO.dx, 0, 0), M4.S(FOGO.tam)), tint || [1, 0.45, 0.12, Math.max(0, brasa)]);
    } else {
      glPush(M.mon, base, tint);
      glPush(M.jaw, M4.ch(base, M4.T(19, 22.4, 0), M4.RZ(-0.75 * roar - 0.08)), tint);
      const eg = 0.55 + 0.4 * rise + 0.05 * Math.sin(t * 9);
      glPush(M.eyes, base, [1, 0.55, 0.15, Math.min(1, eg)], false);
      glPush(M.crys, base, [1, 0.62, 0.25, 0.35 + 0.3 * rise + 0.15 * Math.sin(t * 4)]);
    }
  }
  glRender(VP, LV, Ld, [0.82, 0.78, 0.68], { cam: eye, col: [0.84, 0.8, 0.7], near: 160, far: 560 });
  // efeitos aditivos
  const P: number[] = [],
    C: number[] = [],
    vw = M4.look(eye, tgt, [0, 1, 0]),
    rgt = [vw[0], vw[4], vw[8]],
    up = [vw[1], vw[5], vw[9]];
  const tri = (a: number[], b: number[], cc: number[], ca: number[], cb: number[], ccol: number[]) => {
    for (const [p, q] of [
      [a, ca],
      [b, cb],
      [cc, ccol],
    ]) {
      P.push(p[0], p[1], p[2]);
      C.push(q[0], q[1], q[2], q[3]);
    }
  };
  const bill = (p: number[], s: number, col: number[], a: number) => {
    const r = [rgt[0] * s, rgt[1] * s, rgt[2] * s],
      u = [up[0] * s, up[1] * s, up[2] * s],
      A = [p[0] - r[0] - u[0], p[1] - r[1] - u[1], p[2] - r[2] - u[2]],
      B = [p[0] + r[0] - u[0], p[1] + r[1] - u[1], p[2] + r[2] - u[2]],
      Cc = [p[0] + r[0] + u[0], p[1] + r[1] + u[1], p[2] + r[2] + u[2]],
      D = [p[0] - r[0] + u[0], p[1] - r[1] + u[1], p[2] - r[2] + u[2]],
      k = [...col, a],
      z = [...col, 0];
    const ctr2 = p;
    tri(A, B, ctr2, z, z, k);
    tri(B, Cc, ctr2, z, z, k);
    tri(Cc, D, ctr2, z, z, k);
    tri(D, A, ctr2, z, z, k);
  };
  const disc = (y: number, r: number, col: number[], a: number) => {
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283,
        a1 = ((i + 1) / n) * 6.283;
      tri(
        [0, y, 0],
        [Math.cos(a0) * r, y, Math.sin(a0) * r],
        [Math.cos(a1) * r, y, Math.sin(a1) * r],
        [...col, a],
        [...col, 0],
        [...col, 0],
      );
    }
  };
  const ring = (y: number, r0: number, r1: number, col: number[], a: number) => {
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283,
        a1 = ((i + 1) / n) * 6.283,
        p0 = [Math.cos(a0) * r0, y, Math.sin(a0) * r0],
        p1 = [Math.cos(a1) * r0, y, Math.sin(a1) * r0],
        q0 = [Math.cos(a0) * r1, y, Math.sin(a0) * r1],
        q1 = [Math.cos(a1) * r1, y, Math.sin(a1) * r1],
        k = [...col, a],
        z = [...col, 0];
      tri(p0, p1, q1, z, z, k);
      tri(p0, q1, q0, z, k, k);
    }
  };
  const pillar = (r: number, hh: number, col: number[], a: number) => {
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283,
        a1 = ((i + 1) / n) * 6.283,
        b0 = [Math.cos(a0) * r, 2, Math.sin(a0) * r],
        b1 = [Math.cos(a1) * r, 2, Math.sin(a1) * r],
        t0 = [b0[0] * 0.6, hh, b0[2] * 0.6],
        t1 = [b1[0] * 0.6, hh, b1[2] * 0.6],
        k = [...col, a],
        z = [...col, 0];
      tri(b0, b1, t1, k, k, z);
      tri(b0, t1, t0, k, z, z);
    }
  };
  if (t < 10.6)
    for (const f of INTRO.fx.flies) {
      const p = [
        f.x + Math.sin(t * 0.7 + f.ph) * 6,
        f.y + Math.sin(t * 1.3 + f.ph) * 2,
        f.z + Math.cos(t * 0.5 + f.ph) * 6,
      ];
      bill(p, 1.1, [1, 0.85, 0.4], 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + f.ph)) * (1 - sstep(9.5, 10.6, t)));
    }
  if (runeOn > 0.05) disc(2.4, 18 + 8 * sstep(7.2, 8, t), [1, 0.55, 0.2], Math.min(0.32, runeOn * 0.32));
  for (const rg of INTRO.fx.rings) {
    const k = (t - rg.t) / (rg.big ? 1.6 : rg.dust ? 1.4 : 1.2);
    if (k < 0 || k > 1) continue;
    const r = rg.big ? 10 + 120 * k : rg.dust ? 12 + 70 * Math.sqrt(k) : 6 + 60 * k;
    ring(rg.dust ? 1 : 2.6, r * 0.8, r, rg.c, (1 - k) * (rg.dust ? 0.35 : 0.7));
  }
  if (t > 7.8 && t < 11.5) {
    const a = sstep(7.8, 9, t) * (1 - sstep(10.6, 11.5, t));
    pillar(9 + Math.sin(t * 7) * 0.5, 70 + 20 * sstep(8, 10.6, t), [1, 0.58, 0.25], 0.5 * a);
    pillar(5, 90, [1, 0.88, 0.7], 0.35 * a);
  }
  const sp = INTRO.fx.sparks;
  if (t > 7.4 && t < 13.5 && sp.length < 220)
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.283,
        r = Math.random() * (t < 10.6 ? 11 : 22);
      sp.push({
        x: Math.cos(a) * r,
        y: 2.5,
        z: Math.sin(a) * r,
        vy: 6 + Math.random() * 14,
        life: 0,
        L: 1.4 + Math.random() * 1.6,
        s: 0.4 + Math.random() * 0.8,
      });
    }
  const dt = Math.min(0.05, INTRO.lastT ? t - INTRO.lastT : 0.016);
  INTRO.lastT = t;
  for (let i = sp.length - 1; i >= 0; i--) {
    const s = sp[i];
    s.life += dt;
    if (s.life > s.L) {
      sp.splice(i, 1);
      continue;
    }
    s.y += s.vy * dt;
    s.x += Math.sin(s.y * 0.3 + i) * dt * 2;
    bill([s.x, s.y, s.z], s.s, [1, 0.7, 0.35], Math.sin((Math.PI * s.life) / s.L) * 0.9);
  }
  if (mon) {
    const eg = 0.6 + 0.4 * Math.sin(t * 9);
    const bm = M4.ch(M4.T(0, 2.2, 0), M4.RY(-1.05), M4.S(1.15));
    for (const s of [1, -1]) bill(M4.ap(bm, 21.4, 27.3, 2.9 * s), 2.6, [1, 0.5, 0.15], 0.6 * eg * sstep(11, 12.1, t));
  }
  glDyn(VP, P, C);
}
function cineFallback2D(c: CanvasRenderingContext2D, t: number, W: number, H: number) {
  // sem WebGL: versão ilustrada simples
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2c3a24");
  g.addColorStop(1, "#141c10");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const cx = W / 2,
    cy = H * 0.66,
    on = t > 7.2 ? 1 : 0.2;
  c.save();
  c.translate(cx, cy);
  c.scale(1, 0.35);
  c.strokeStyle = "rgba(255,170,80," + (0.3 + on * 0.6) + ")";
  c.lineWidth = 6;
  c.shadowColor = "#ff9a3c";
  c.shadowBlur = 30 * on;
  c.beginPath();
  c.arc(0, 0, 70, 0, 7);
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 40, 0, 7);
  c.stroke();
  c.restore();
  c.font = (t > 10.6 ? 120 : 46) + "px serif";
  c.textAlign = "center";
  const x = t < 7.2 ? lerpN(-60, cx, sstep(1, 7.2, t)) : cx;
  c.fillText(t > 10.6 ? "👹" : "🐇", x, cy - (t > 7.8 && t < 10.6 ? sstep(7.8, 10.2, t) * 60 : 0));
}
export function init() {
  TELAS.viewport = document.getElementById("viewport")!;
  TELAS.stage = document.getElementById("stage")!;
  TELAS.mapImg = document.getElementById("map-img") as HTMLImageElement;
  TELAS.canvas = document.getElementById("sim-canvas") as HTMLCanvasElement;

  function onImgReady() {
    TELAS.worldW = TELAS.mapImg.naturalWidth * WORLD_K;
    TELAS.worldH = TELAS.mapImg.naturalHeight * WORLD_K;
    for (const c of CITIES) {
      c.x *= WORLD_K;
      c.y *= WORLD_K;
    }
    quadInit();
    quadSetBounds(quadOf(SPAWN0.x * WORLD_K, SPAWN0.y * WORLD_K));
    try {
      MAPART.on = OPT.mapNew !== false;
      mapArtInit();
    } catch (e) {
      console.warn("mapa novo indisponível", e);
      MAPART.on = false;
    }
    TELAS.mapImg.style.width = TELAS.worldW + "px";
    TELAS.mapImg.style.height = TELAS.worldH + "px";
    TELAS.ctx = TELAS.canvas.getContext("2d")!;
    resizeCanvas();

    buildWaterGrid(TELAS.mapImg);
    seedVegetation();
    seedPopulation();
    sampleStats();

    fitToScreen();
    requestAnimationFrame(loop);
  }
  if (TELAS.mapImg.complete && TELAS.mapImg.naturalWidth) onImgReady();
  else TELAS.mapImg.addEventListener("load", onImgReady);

  // ---- pan & zoom ----
  let dragging = false,
    lastX = 0,
    lastY = 0,
    moved = false;
  TELAS.viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      zoomAt(Math.exp(-Math.max(-240, Math.min(240, dy)) * 0.0016), e.clientX, e.clientY);
    },
    { passive: false },
  );
  TELAS.viewport.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    TELAS.viewport.classList.add("dragging");
    TELAS.viewport.setPointerCapture(e.pointerId);
  });
  TELAS.viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX,
      dy = e.clientY - lastY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    camera.tx += dx;
    camera.ty += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    constrainCamera();
    applyCameraTransform();
  });
  function endDrag() {
    dragging = false;
    TELAS.viewport.classList.remove("dragging");
  }
  TELAS.viewport.addEventListener("pointerup", (e) => {
    endDrag();
    // v7.7: só o botão esquerdo é "toque" aqui; o direito é a ordem do RTS (map/selecao.ts). Sem isso, o direito na
    // heroína já selecionada em cima do acampamento abria o menu dela por cima de tudo, em vez de entrar
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!moved && mapOverview() && !SEL.commandMode && !baseTapAt(e)) {
      zoomAt(2.4, e.clientX, e.clientY);
      const _oh =
        document.getElementById("map-ov-hint") ||
        (() => {
          const x = document.createElement("div");
          x.id = "map-ov-hint";
          document.getElementById("viewport")!.appendChild(x);
          return x;
        })();
      _oh.textContent = "🔭 Visão geral — aproxime para interagir";
      _oh.style.display = "block";
      clearTimeout(_oh._t);
      _oh._t = setTimeout(() => (_oh.style.display = "none"), 1800);
      return;
    }
    if (!moved) {
      const rect = TELAS.viewport.getBoundingClientRect();
      const wx = (e.clientX - rect.left - camera.tx) / camera.scale;
      const wy = (e.clientY - rect.top - camera.ty) / camera.scale;
      if (SEL.commandMode && walkClick(SEL.commandMode, wx, wy)) {
        SEL.commandMode = null;
        document.getElementById("command-hint")!.style.display = "none";
        updateHeroPanelUI();
        return;
      }
      if (SEL.commandMode) {
        const h = world.heroes.find((x) => x.id === SEL.commandMode);
        if (h && h.state === "idle") {
          const kind = h.huntSpecies,
            p = kind === "fish" ? fishSpot(wx, wy) : snapToLand(wx, wy);
          if (!p) pushEvent("Clique perto da água para pescar.");
          else
            askWork(h, kind, () => {
              if (h.state !== "idle") return;
              h.task = {
                x: p.x,
                y: p.y,
                targetSpecies: kind,
                killsWanted: 99999,
                killsDone: 0,
                maxMin: (h.huntHours || 6) * 60,
              };
              h.state = "traveling";
              pushEvent(
                h.name +
                  " foi " +
                  workVerb(kind) +
                  huntLabel(kind) +
                  " por " +
                  (h.huntHours || 6) +
                  "h perto de (" +
                  Math.round(p.x) +
                  ", " +
                  Math.round(p.y) +
                  ").",
              );
              updateHeroPanelUI();
            });
        }
        SEL.commandMode = null;
        document.getElementById("command-hint")!.style.display = "none";
        updateHeroPanelUI();
        return;
      }
      if (e.pointerType === "mouse" && cliqueComSelecao(wx, wy, !mapHitsSomething(wx, wy))) return; // v7.7: seleção do RTS (map/selecao.ts)
      const _hh = world.heroes.find(
        (h) =>
          h.state !== "indungeon" &&
          h.state !== "idle" &&
          Math.hypot(h.x - wx, h.y - wy) < Math.max(12, 18 / camera.scale),
      );
      if (_hh) {
        if (_hh.state === "field") baseMenu(_hh);
        else openHeroInspector(_hh);
        return;
      }
      const _hi = world.heroes.find(
        (h) => h.state === "idle" && Math.hypot(h.x - wx, h.y - wy) < Math.max(6, 9 / camera.scale),
      );
      if (_hi) {
        baseMenu(_hi);
        return;
      }
      if (anteaterClick(wx, wy)) return;
      if (nearCamp(wx, wy)) {
        const _hb = world.heroes.find((h) => h.state === "idle");
        if (_hb) baseMenu(_hb);
        else enterCamp();
        return;
      }
      const _tm = termiteAt(wx, wy);
      if (_tm) {
        mvToast("🐜 Cupinzeiro — tamanduás virão comer aqui (montaria e baú que anda, em breve).");
        return;
      }
      const _rr = runePickAt(wx, wy);
      if (_rr) {
        openRuneInspector(_rr);
        return;
      }
      const _ww = pickWildAt(wx, wy);
      if (_ww) {
        openWildInspector(_ww);
        return;
      }
      const _nn = pickNodeAt(wx, wy);
      if (_nn) {
        openNodeInspector(_nn);
        return;
      }
      const _cc = CITIES.find((c) => Math.hypot(c.x - wx, c.y - 12 - wy) < Math.max(14, 22 / camera.scale));
      if (_cc) {
        // v8.0: a Vila Musgo é andável (map/vila_cena.ts): clicar entra nela (ou vai até lá), como o acampamento
        const _vh = _cc.id === "musgo" ? heroNaVila() || mapHero() : null;
        if (_vh) vilaIr(_vh);
        else openCityInspector(_cc);
        return;
      }
      const hit = pickAnimalAt(wx, wy);
      if (hit) {
        openInspector(hit);
      } else {
        const phit = pickPlantAt(wx, wy);
        if (phit) openPlantInspector(phit);
      }
    }
  });
  TELAS.viewport.addEventListener("pointercancel", endDrag);
  TELAS.viewport.addEventListener("pointerleave", endDrag);

  document.getElementById("zoom-in")!.addEventListener("click", () => {
    const r = TELAS.viewport.getBoundingClientRect();
    zoomAt(1.3, r.left + r.width / 2, r.top + r.height / 2);
  });
  document.getElementById("zoom-out")!.addEventListener("click", () => {
    const r = TELAS.viewport.getBoundingClientRect();
    zoomAt(1 / 1.3, r.left + r.width / 2, r.top + r.height / 2);
  });
  document.getElementById("zoom-reset")!.addEventListener("click", fitToScreen);
  document.getElementById("hud-toggle")!.addEventListener("click", () => {
    document.getElementById("app")!.classList.toggle("hud-off");
    setTimeout(() => {
      resizeCanvas();
    }, 30);
  });
  window.addEventListener("resize", () => {
    if (TELAS.worldW) {
      resizeCanvas();
      constrainCamera();
      applyCameraTransform();
    }
    if (typeof dungeon !== "undefined" && dungeon.active) fitDungeonCanvas();
  });

  // ---- inspector ----
  document.getElementById("inspector-close")!.addEventListener("click", () => {
    document.getElementById("inspector")!.classList.remove("open");
    SEL.selectedAnimal = null;
    SEL.selectedPlant = null;
    SEL.selectedHero = null;
    SEL.selectedCity = null;
  });
  document.getElementById("hero-rows")!.addEventListener("change", (e) => {
    const el = (e.target as HTMLElement).closest("select[data-sel]") as HTMLInputElement;
    if (!el) return;
    const h = world.heroes.find((x) => x.id === el.dataset.hero);
    if (!h) return;
    if (el.dataset.sel === "species") h.huntSpecies = el.value;
    else h.huntHours = +el.value;
  });
  document.getElementById("insp-actions")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button[data-act]") as HTMLElement;
    if (!b) return;
    if (b.dataset.act === "giveup" && SEL.selectedHero) giveUpTrip(SEL.selectedHero);
    if (b.dataset.act === "isheet" && SEL.selectedHero) openSheet(SEL.selectedHero.id);
    if (b.dataset.act === "ibag" && SEL.selectedHero) openBag(SEL.selectedHero.id);
    if (b.dataset.act === "sendhere" && SEL.selectedCity) {
      JANELAS.mkCity = SEL.selectedCity.id;
      openMarket();
    }
    if (b.dataset.act === "dispatch" && SEL.infoTarget) {
      dispatchHero(SEL.infoTarget.kind, SEL.infoTarget.x, SEL.infoTarget.y);
    }
  });

  // ---- velocidade ----
  document.querySelectorAll("[data-speed]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-speed]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      world.speedMult = parseFloat((btn as HTMLElement).dataset.speed!);
      world.paused = false;
      document.getElementById("btn-pause")!.textContent = "⏸ Pausar";
    });
  });
  document.getElementById("btn-pause")!.addEventListener("click", (e) => {
    world.paused = !world.paused;
    (e.target as HTMLElement).textContent = world.paused ? "▶ Continuar" : "⏸ Pausar";
  });
  document.getElementById("ff-hour")!.addEventListener("click", () => {
    world.fastForwardTarget += 60;
  });
  document.getElementById("ff-day")!.addEventListener("click", () => {
    world.fastForwardTarget += CONFIG.DAY_MIN;
  });

  document.getElementById("hero-rows")!.addEventListener("click", onHeroPanelClick);

  // ---- masmorra (motor separado) ----
  TELAS.dCanvas = document.getElementById("dungeon-canvas") as HTMLCanvasElement;
  TELAS.dCanvas.width = dungeon.cols * dungeon.tile;
  TELAS.dCanvas.height = dungeon.rows * dungeon.tile;
  TELAS.dCtx = TELAS.dCanvas.getContext("2d")!;
  TELAS.dCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
  const DIREITO_HOLD_MS = 200;
  let direitoPointer: number | null = null;
  let direitoTimer: ReturnType<typeof setTimeout> | null = null;
  let direitoAcionou = false;
  const iniciarAcaoDireita = () => {
    direitoTimer = null;
    if (direitoPointer == null || !dungeon.active || dungeon.invOpen || dungeon.craftOpen || dungeon.modalOpen) return;
    direitoAcionou = true;
    if (dungeon.weapon === "bow") startCharge();
    else spearMode() ? spearChargeStart() : doParry();
  };
  TELAS.dCanvas.addEventListener("pointerdown", (e) => {
    if (!dungeon.active || dungeon.invOpen || dungeon.craftOpen || dungeon.modalOpen) return;
    if (e.button === 2) {
      e.preventDefault();
      dungeon.especialPressionado = true;
      if (dungeon.alvoAutomatico && dungeon.hv?.kind === "clubL") dungeon.hv = null;
      const { x, y } = dPoint(e);
      dungeon.mouse = { x, y };
      dungeon.mouseC = { clientX: e.clientX, clientY: e.clientY };
      direitoPointer = e.pointerId;
      direitoAcionou = false;
      if (direitoTimer) clearTimeout(direitoTimer);
      // v7.7: só o arco espera o segurar; parry e lança agem na hora (o atraso atrapalhava o parry)
      if (dungeon.weapon === "bow") direitoTimer = setTimeout(iniciarAcaoDireita, DIREITO_HOLD_MS);
      else iniciarAcaoDireita();
      return;
    }
    if (e.button !== 0) return;
    // v8.0: clique esquerdo com o arco puxado cancela o tiro (field/acertos.ts)
    if (e.button === 0 && dungeon.weapon === "bow" && cancelarTiro()) return;
    const { x, y } = dPoint(e);
    dungeon.mouseC = { clientX: e.clientX, clientY: e.clientY };
    const _hit = dungeon.monsters.find((m) => {
      if (!m.alive) return false;
      const B = wolfBody(m);
      return bodyDist(B, x, y).d < Math.max(20, B.r + 9);
    });
    dungeon.mouse = { x, y };
    const _bh = _hit ? null : (dungeon.birds || []).find((b) => b.alive && Math.hypot(b.x - x, b.y - y) < 20);
    // v7.7: Ctrl + clique num bicho inclui/tira do rastreio (field/rastreio.ts); não ataca
    if (e.ctrlKey && _hit) {
      rastreioAlternar(_hit);
      return;
    }
    // O foco clicado comanda os básicos; o alvo prioritário dos avisos continua independente.
    if (_hit) {
      marcarFoco(_hit);
      if (dungeon.weapon === "melee") {
        if (!OPT.ataqueAutomatico || dungeon.crav)
          swingBasic(); // mantém o gesto manual de empurrar a arma cravada
        else {
          dungeon.alvoAutomatico = _hit;
          dungeon.moveTarget = null;
        }
      } else if (dungeon.weapon === "bow" && OPT.ataqueAutomatico) {
        // básico do arco: marca (como antes) e atira sozinho ao alcance (field/chao.ts autoAttack)
        dungeon.alvoAutomatico = _hit;
        dungeon.moveTarget = null;
      }
      return;
    }
    if (dungeon.alvoAutomatico && dungeon.hv?.kind === "clubL") dungeon.hv = null;
    dungeon.alvoAutomatico = null;
    if (_bh) {
      marcarFoco(_bh as Monster);
      return;
    }
    if (dungeon.weapon === "melee") {
      swingBasic();
      return;
    } // espada: clique = golpe (ande com WASD)
    dungeon.moveTarget = {
      x: Math.max(dungeon.tile, Math.min(dungeon.cols * dungeon.tile - dungeon.tile, x)),
      y: Math.max(dungeon.tile, Math.min(dungeon.rows * dungeon.tile - dungeon.tile, y)),
    };
  });
  window.addEventListener("pointerup", (e) => {
    if (e.button !== 2 || direitoPointer !== e.pointerId) return;
    dungeon.especialPressionado = false;
    if (direitoTimer) clearTimeout(direitoTimer);
    direitoTimer = null;
    direitoPointer = null;
    direitoAcionou = false;
  });
  window.addEventListener("pointercancel", (e) => {
    if (direitoPointer !== e.pointerId) return;
    dungeon.especialPressionado = false;
    if (direitoTimer) clearTimeout(direitoTimer);
    direitoTimer = null;
    if (direitoAcionou) {
      dungeon.charging = false;
      dungeon.charge = 0;
      dungeon.spCh = null;
      dungeon.hv = null;
    }
    direitoPointer = null;
    direitoAcionou = false;
  });
  window.addEventListener("blur", () => {
    if (direitoTimer) clearTimeout(direitoTimer);
    direitoTimer = null;
    direitoPointer = null;
    direitoAcionou = false;
    dungeon.especialPressionado = false;
    dungeon.alvoAutomatico = null;
  });
  document.getElementById("dungeon-exit")!.addEventListener("click", tryExit);
  const _gb = document.getElementById("dungeon-guard")!;
  _gb.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dungeon.guard = true;
  });
  _gb.addEventListener("pointerup", () => {
    dungeon.guard = false;
  });
  _gb.addEventListener("pointerleave", () => {
    dungeon.guard = false;
  });
  document.getElementById("dungeon-herb")!.addEventListener("click", () => healHerb());
  document.getElementById("dungeon-parry")!.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    doParry();
  });
  document.getElementById("dungeon-bag")!.addEventListener("click", () => toggleInv());
  document.getElementById("dungeon-interact")!.addEventListener("click", interact);
  {
    // v8.1: o 🔨 do HUD como o C: toque abre o craft, segurar faz o craft rápido (field/craft_rapido.ts)
    const b = document.getElementById("dungeon-craft")!;
    b.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      cApertado();
    });
    b.addEventListener("pointerup", () => cSolto());
    b.addEventListener("pointerleave", () => cSolto(false));
    b.addEventListener("pointercancel", () => cSolto(false));
  }
  document.getElementById("dungeon-3d")!.addEventListener("click", () => {
    OPT.d3 = !D3.on;
    optSave();
  });
  document.getElementById("dungeon-test")!.addEventListener("click", () => {
    const t = document.getElementById("toggle-test") as HTMLInputElement;
    t.checked = !econ.test;
    t.dispatchEvent(new Event("change"));
  });
  document.getElementById("exp-leave")!.addEventListener("click", () => {
    document.getElementById("exp-modal")!.style.display = "none";
    dungeon.modalOpen = false;
    bankLoot();
    exitDungeon();
  });
  document.getElementById("exp-stay")!.addEventListener("click", () => {
    document.getElementById("exp-modal")!.style.display = "none";
    dungeon.modalOpen = false;
    startSurvival();
  });
  document.getElementById("inv-close")!.addEventListener("click", () => toggleInv(false));
  document.getElementById("chest-all-out")!.addEventListener("click", () => chestMoveAll(true));
  document.getElementById("chest-all-in")!.addEventListener("click", () => chestMoveAll(false));
  window.addEventListener("pointermove", (e) => {
    if (!INV.invDrag) return;
    if (Math.hypot(e.clientX - INV.invDrag.sx, e.clientY - INV.invDrag.sy) > 5) INV.invDrag.moved = true;
    let hit = null,
      r = null;
    for (const gr of INV.invGrids) {
      const rr = gr.el.getBoundingClientRect();
      if (
        e.clientX >= rr.left - 8 &&
        e.clientX <= rr.right + 8 &&
        e.clientY >= rr.top - 8 &&
        e.clientY <= rr.bottom + 8
      ) {
        hit = gr;
        r = rr;
        break;
      }
    }
    INV.invDrag.over = hit;
    if (hit) {
      INV.invDrag.gx = Math.floor((e.clientX - r!.left) / INV_CELL) - INV.invDrag.ox;
      INV.invDrag.gy = Math.floor((e.clientY - r!.top) / INV_CELL) - INV.invDrag.oy;
    }
    renderInv();
  });
  window.addEventListener("pointerup", (e) => {
    if (!INV.invDrag) return;
    const d = INV.invDrag,
      to = d.over;
    if (d.sx != null && !d.moved) {
      INV.invDrag = null;
      renderInv();
      if (selAlternar(d.it)) return; // v7.7: com seleção, o toque marca/desmarca (items/selecao_inv.ts)
      invItemMenu(d.it, d.from, e.clientX, e.clientY);
      return;
    }
    if (dungeon.active && dungeon.invOpen && eqDropAt(d.it, d.from, e.clientX, e.clientY)) {
      INV.invDrag = null;
      renderInv();
      return;
    }
    if (prep.open && eqDropAt(d.it, d.from, e.clientX, e.clientY)) {
      INV.invDrag = null;
      renderPrep();
      return;
    }
    // v7.7: item selecionado solto noutra grade: a seleção inteira vai junto (items/selecao_inv.ts)
    if (to && selSoltarGrupo(d, to)) {
      INV.invDrag = null;
      renderInv();
      updateEcon();
      return;
    }
    // v7.7: solto em qualquer ponto do baú infinito: guarda (items/bau_infinito.ts)
    if (to && to.inv.infinito) {
      INV.invDrag = null;
      if (to.inv !== d.from.inv) guardarNoBau(d.it, d.from.inv, to.inv);
      renderInv();
      updateEcon();
      return;
    }
    /* v7.7 — soltar na área do chão: o item vai inteiro para o mundo, ao lado do personagem (a área do chão se arruma
       sozinha); não depende da casa exata onde foi solto */
    if (to && to.inv.ground && !d.from.inv.ground && dungeon.active) {
      INV.invDrag = null;
      if (isArrowIt(d.it)) itemMsg("Flechas só vão na aljava.");
      else largarNoChao(d.it, d.from.inv);
      renderInv();
      updateEcon();
      return;
    }
    const stk = to && !to.inv.ground && stackTarget(to.inv, d.it, d.gx, d.gy);
    if (stk) {
      const q = Math.min(stk.def.stack! - (stk.n || 1), d.it.n || 1);
      stk.n = (stk.n || 1) + q;
      d.it.n = (d.it.n || 1) - q;
      if (d.it.n <= 0) d.from.inv.items.splice(d.from.inv.items.indexOf(d.it), 1);
      if (d.from.inv.ground) groundSync(d.it);
    } else if (to && canPlace(to.inv, d.shape, d.gx, d.gy, d.it)) {
      if (to.inv !== d.from.inv) {
        d.from.inv.items.splice(d.from.inv.items.indexOf(d.it), 1);
        to.inv.items.push(d.it);
        if (d.from.inv.ground) groundTake(d.it);
        if (to.inv.ground) groundPut(d.it);
      }
      d.it.x = d.gx;
      d.it.y = d.gy;
      d.it.shape = d.shape;
    } else if (to && to.inv !== d.from.inv) {
      /* v7.7 — não coube exatamente onde soltou: vai para o lugar livre mais perto (girando se preciso); sem lugar,
         fica onde estava e o jogo diz por quê (antes voltava calado, mesmo havendo espaço) */
      const p = lugarMaisPerto(to.inv, d.shape, d.gx, d.gy, d.it);
      if (p) {
        d.from.inv.items.splice(d.from.inv.items.indexOf(d.it), 1);
        to.inv.items.push(d.it);
        if (d.from.inv.ground) groundTake(d.it);
        if (to.inv.ground) groundPut(d.it);
        d.it.x = p.x;
        d.it.y = p.y;
        d.it.shape = p.shape;
      } else
        itemMsg(
          isArrowIt(d.it) && !to.inv.qv ? "Flechas só vão na aljava." : "Não cabe aí — o item ficou onde estava.",
        );
    }
    INV.invDrag = null;
    renderInv();
    updateEcon();
  });
  document.getElementById("dungeon-weapon")!.addEventListener("click", switchWeapon);
  const _ab = document.getElementById("dungeon-attack")!;
  _ab.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dungeon.weapon === "bow" ? startCharge() : dungeonAttack();
  });
  _ab.addEventListener("pointerup", () => {
    if (dungeon.weapon === "bow") fireArrow();
  });
  _ab.addEventListener("pointerleave", () => {
    if (dungeon.weapon === "bow") fireArrow();
  });
  window.addEventListener("keydown", (e) => {
    if (!dungeon.active) return;
    if (dungeon.craftOpen) {
      if (e.code === "KeyC" || e.code === "Escape") closeCraft();
      return;
    }
    // v7.7: I/Esc fecham a mochila mesmo com uma fala na tela (antes o modalOpen barrava e o jogo travava)
    if (dungeon.invOpen && (e.code === "KeyI" || e.code === "Escape")) {
      toggleInv(false);
      return;
    }
    if (dungeon.modalOpen) return;
    if (dungeon.invOpen) {
      if (e.code === "KeyI" || e.code === "Escape") toggleInv(false);
      else if (e.code === "KeyR") rotateDrag();
      return;
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(e.code)) dungeon.keys![e.code] = true;
    else if (e.code === "AltLeft" || e.code === "AltRight") {
      // segurar Alt mostra o alcance (field/chao.ts anelAlcance); sem o menu do navegador
      e.preventDefault();
      dungeon.keys![e.code] = true;
    } else if (e.code === "KeyQ") switchWeapon();
    else if (e.code === "KeyH") healHerb();
    else if (e.code === "Space") {
      e.preventDefault();
      if (e.repeat) return;
      dungeon.weapon === "bow" ? bowRoll() : spearMode() ? spearDodge() : espacoCorpo(); // v7.7: sem escudo = ginga
    } else if (e.code === "KeyE") {
      if (!e.repeat) eApertado(); // v7.7: toque pega; segurar num item abre a mochila com ele (ui/acoes.ts)
    } else if (e.code === "KeyR") {
      if (!e.repeat) pouparBandido(); // v8.1: o bandido caído (field/bandidos.ts)
    } else if (e.code === "KeyC") {
      if (!e.repeat) cApertado(); // v8.1: toque abre o craft (no soltar); segurar faz o craft rápido (field/craft_rapido.ts)
    } else if (e.code === "KeyI") toggleInv();
    else if (e.code === "Escape") limparFoco(); // v7.7: Esc tira o foco (o alvo prioritário fica; Tab não troca mais o alvo)
  });
  window.addEventListener("keyup", (e) => {
    if (dungeon.keys) dungeon.keys[e.code] = false;
    if (dungeon.active && (e.code === "AltLeft" || e.code === "AltRight")) e.preventDefault();
    if (e.code === "Space") dungeon.guard = false;
    if (e.code === "KeyE") eSolto(); // v7.7
    if (e.code === "KeyC") cSolto(); // v8.1
  });
  window.addEventListener("blur", () => {
    cSolto(false);
    if (direitoTimer) clearTimeout(direitoTimer);
    direitoTimer = null;
    direitoPointer = null;
    direitoAcionou = false;
    dungeon.guard = false;
    dungeon.keys = {};
    dungeon.joy = null;
    dungeon.charging = false;
    dungeon.charge = 0;
  });
  TELAS.dCanvas.addEventListener("pointermove", (e) => {
    dungeon.mouse = dPoint(e);
    dungeon.mouseC = { clientX: e.clientX, clientY: e.clientY };
  });

  // ---- criação de personagem ----
  document.getElementById("create-name")!.addEventListener("input", refreshCreateUI);
  document.getElementById("create-confirm")!.addEventListener("click", confirmCreateHero);
  document.getElementById("create-cancel")!.addEventListener("click", closeCreateModal);
  winInit();
  document.getElementById("sheet-body")!.addEventListener("click", onSheetClick);
  document.getElementById("dungeon-sheet")!.addEventListener("click", () => {
    if (dungeon.active && dungeon.hero) openSheet(dungeon.hero.id);
  });
  document.getElementById("prep-sheet")!.addEventListener("click", () => {
    if (prep.open) openSheet(prep.heroId!);
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && sheet.open) {
      closeSheet();
      return;
    }
    if (
      e.code === "KeyK" &&
      dungeon.active &&
      !dungeon.dead &&
      !dungeon.invOpen &&
      !dungeon.craftOpen &&
      (!dungeon.modalOpen || sheet.open) &&
      !/INPUT|TEXTAREA/.test(((e.target || {}) as HTMLElement).tagName || "")
    ) {
      e.preventDefault();
      sheet.open ? closeSheet() : openSheet(dungeon.hero!.id);
    }
  });
  document.getElementById("create-random")!.addEventListener("click", randomizeCreate);
  document.getElementById("prep-shop")!.addEventListener("click", prepShopClick);
  document.querySelector<HTMLElement>("#prep-modal .eq-wrap")!.addEventListener("click", eqSlotClick);
  {
    const pc = document.getElementById("prep-portrait3d")!;
    pc.addEventListener("pointerdown", (e) => {
      PORT.drag = { x: e.clientX, y0: PORT.yaw };
      PORT.auto = false;
      try {
        pc.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    pc.addEventListener("pointermove", (e) => {
      if (PORT.drag) PORT.yaw = PORT.drag.y0 + (e.clientX - PORT.drag.x) * 0.02;
    });
    pc.addEventListener("pointerup", () => {
      PORT.drag = null;
    });
    pc.addEventListener("dblclick", () => {
      PORT.auto = true;
    });
  }
  document.getElementById("prep-go")!.addEventListener("click", prepGo);
  document.getElementById("prep-cancel")!.addEventListener("click", closePrep);
  window.addEventListener("keydown", (e) => {
    if (!prep.open || sheet.open) return;
    if (e.code === "Escape") closePrep();
    else if (e.code === "KeyR") rotateDrag();
  });

  document.getElementById("btn-reset")!.addEventListener("click", resetWorld);
  document.getElementById("btn-reset-from-banner")!.addEventListener("click", resetWorld);

  document.getElementById("btn-full-log")!.addEventListener("click", openFullLog);
  document.getElementById("log-modal-close")!.addEventListener("click", closeFullLog);
  document.getElementById("log-modal")!.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "log-modal") closeFullLog();
  });

  // ---- camadas ----
  document
    .getElementById("toggle-fauna")!
    .addEventListener("change", (e) => (layers.fauna = (e.target as HTMLInputElement).checked));
  document
    .getElementById("toggle-flora")!
    .addEventListener("change", (e) => (layers.flora = (e.target as HTMLInputElement).checked));
  document
    .getElementById("toggle-water")!
    .addEventListener("change", (e) => (layers.water = (e.target as HTMLInputElement).checked));
  document
    .getElementById("toggle-bounds")!
    .addEventListener("change", (e) => (layers.bounds = (e.target as HTMLInputElement).checked));

  setTimeout(() => {
    const hint = document.getElementById("empty-hint")!;
    hint.style.transition = "opacity 0.6s ease";
    hint.style.opacity = "0";
  }, 6000);
}
