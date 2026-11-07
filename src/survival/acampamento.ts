/* ==== Fase 4 — acampamento: o mapa separado, fogueira, bigorna, maleta e mesa (v5.9, v5.9.15) ==== */
import { world, TELAS, camera, dungeon, econ, GL3 } from "../core/state.ts";
import { CAMF, constrainCamera, applyCameraTransform, animarCamera } from "../map/camera.ts";
import { M4, MALHA } from "../render/gl/geometria.ts";
import { MB, mbBox, glMesh, mbCyl, gmix, mbIco, grnd, glFree } from "../render/gl/malhas.ts";
import { glPush } from "../render/gl/renderer.ts";
import { mbTree } from "../render/gl/modelos.ts";
import { mbCenario } from "../render/gl/cenario.ts";
import { quadradoFacetado } from "../render/gl/relevo.ts";
import { CT, ctArrive } from "../intro/tutorial.ts";
import { CONFIG } from "../core/config.ts";
import { icoImg, icoTag } from "../ui/icones.ts";
import { coatOf, mnt, wildAnteaters, wildPos, drawAnteater2D, mountMapPos } from "../creatures/tamandua.ts";
import { MAPFX } from "../map/caca.ts";
import { campDrawExpedicao } from "../ui/menu_base.ts";
import { campDrawBalao, MAPCTL } from "../map/controle.ts";
import { docaCaca, docaVila, drawDoca } from "../map/vila_musgo.ts";
import { ensureInv } from "../items/inventario.ts";
import { prep, bag } from "../econ/economia.ts";
import { prepHero, closePrep, launchDungeon } from "../expedicao/preparo.ts";
import { mvToast } from "../ui/avisos.ts";
import { closeBag } from "../ui/janelas.ts";
import { ISC } from "../intro/cena.ts";
import { setBanner, spawnDungeonToast } from "../field/masmorra.ts";
import { renderInv } from "../field/chao.ts";
import { openForge } from "../forja/forja.ts";
import { cookFlip, cookBind, cookFinish } from "./cozinha.ts";
import { profLv } from "../hero/proficiencias.ts";
import { COOK } from "../data/sobrevivencia.ts";
import type { Hero, Ponto } from "../core/tipos.ts";

export function campPos() {
  const h0 = world.heroes && world.heroes[0];
  return h0 && h0.camp ? h0.camp : null;
}

interface EstadoCPS {
  pending: boolean;
  size: { cols: number; rows: number };
  prevCam: { s: number; x: number; y: number } | null; // a câmera do mapa antes de entrar
  fire: Ponto | null;
  anvil: Ponto | null;
  warm: number;
  // acrescentados depois
  tent?: Ponto;
  hunter?: { x: number; y: number } | null;
  tools?: Ponto;
  mesa?: { x: number; y: number };
  bau?: Ponto; // v7.7: o baú do acampamento, ao lado da tenda
}
export const CPS: EstadoCPS = {
  pending: false,
  size: { cols: 13, rows: 9 },
  prevCam: null,
  fire: null,
  anvil: null,
  warm: 0,
};
/* entrar: a câmera aproxima no personagem que está na base e abre o mapa do acampamento */
export function camZoomTo(wx: number, wy: number, s1: number, ms: number, cb?: () => void) {
  const vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight;
  s1 = Math.max(camera.minScale, Math.min(camera.maxScale, s1));
  const a = {
    s0: camera.scale,
    x0: camera.tx,
    y0: camera.ty,
    s1,
    x1: vw / 2 - wx * s1,
    y1: vh / 2 - wy * s1,
    t0: performance.now(),
  };
  if (typeof CAMF !== "undefined") CAMF.anim = a;
  camera.zt = null;
  // v7.7: anda no laço principal, antes do desenho (animarCamera, map/camera.ts)
  const step = (now: number) => {
    if (typeof CAMF !== "undefined" && CAMF.anim !== a) {
      cb && cb();
      return false;
    }
    const t = Math.max(0, Math.min(1, (now - a.t0) / ms)),
      e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.scale = a.s0 + (a.s1 - a.s0) * e;
    camera.tx = a.x0 + (a.x1 - a.x0) * e;
    camera.ty = a.y0 + (a.y1 - a.y0) * e;
    constrainCamera();
    applyCameraTransform();
    if (t < 1) return true;
    if (typeof CAMF !== "undefined") CAMF.anim = null;
    cb && cb();
    return false;
  };
  animarCamera(step);
}
export function campNear() {
  const d = dungeon;
  /* v7.7 — baú (abre ao lado da mochila) e tenda (preparo da expedição): vale o mais perto dos dois */
  if (d.camp && CPS.bau) {
    const T = d.tile,
      db = Math.hypot(d.px - CPS.bau.x, d.py - CPS.bau.y),
      dt = econ.tent && CPS.tent ? Math.hypot(d.px - CPS.tent.x, d.py - CPS.tent.y) : 1e9;
    if (db < T * 1.0 && db <= dt) return "bau";
    if (dt < T * 1.3) return "tenda";
  }
  if (d.camp && CPS.hunter && Math.hypot(d.px - CPS.hunter.x, d.py - CPS.hunter.y) < d.tile * 1.1) return "hunter"; // v6.1 — Caçador
  if (d.camp && CPS.tools) {
    const T = d.tile,
      dt = Math.hypot(d.px - CPS.tools.x, d.py - CPS.tools.y),
      dm = econ.mesa && CPS.mesa ? Math.hypot(d.px - CPS.mesa.x, d.py - CPS.mesa.y) : 1e9;
    if (dt < T * 1.1) return "tools";
    if (dm < T * 1.2) return "mesa";
  } // v5.9.15 — maleta e mesa
  if (!d.camp || !CPS.fire) return null;
  const T = d.tile,
    df = Math.hypot(d.px - CPS.fire.x, d.py - CPS.fire.y),
    da = Math.hypot(d.px - CPS.anvil!.x, d.py - CPS.anvil!.y);
  if (da < T * 1.15 && da < df) return "anvil";
  if (df < T * 1.5) return "fire";
  return null;
}
/** v8.0 — props do acampamento (medieval camp props, tools/modelos/cenario.json): escala sobre o `tam` do plano e
 *  giro (radianos) de cada um. Sem os dados (testes em Node), as malhas feitas por código. */
export const ACAMP_PROPS = {
  barraca: 1,
  giroBarraca: 0,
  bau: 1,
  giroBau: 0,
  maleta: 1,
  giroMaleta: 0,
  mesa: 1,
  giroMesa: 0,
};
/** Malha de um prop sozinho, na origem (para os que vão por glPush: baú, maleta, mesa); null sem os dados. */
function propMesh(grupo: string, sc: number, giro: number) {
  const o = MB();
  return mbCenario(o, grupo, 0, 0, sc, { giro }) ? glMesh(o) : null;
}
/* toque: botão E do celular já chama interact(); a análise também inclui a mochila de quem está no acampamento */
/* 3D: pele no chão com a maleta e as ferramentas; mesa (se já foi feita) */
function campToolsMesh() {
  const o = MB();
  const P = { x: 0, y: 0 },
    fur = "#8a6038",
    furL = "#b08858",
    box = "#7a3a22",
    lid = "#5e2a18",
    iron = "#7d828a";
  mbBox(o, M4.ch(M4.T(P.x, 0.6, P.y), M4.RY(0.25), M4.S(30, 1, 22)), fur, 1, 0.12);
  mbBox(o, M4.ch(M4.T(P.x - 3, 0.9, P.y + 1), M4.RY(0.6), M4.S(20, 0.8, 14)), furL, 1, 0.12);
  for (const [dx, dz] of [
    [-15, -9],
    [15, -9],
    [-14, 10],
    [14, 10],
  ])
    mbBox(o, M4.ch(M4.T(P.x + dx, 0.5, P.y + dz), M4.RY(0.25 + dx * 0.02), M4.S(6, 0.6, 4)), fur, 1, 0.1); // patas da pele
  mbBox(o, M4.ch(M4.T(P.x, 5, P.y), M4.RY(0.25), M4.S(16, 8, 9)), box, 0.9, 0.05);
  mbBox(o, M4.ch(M4.T(P.x, 9.6, P.y), M4.RY(0.25), M4.S(16.6, 1.4, 9.6)), lid, 1, 0.04);
  mbBox(o, M4.ch(M4.T(P.x, 11.6, P.y), M4.RY(0.25), M4.S(6, 1, 1)), iron);
  for (const s of [-1, 1])
    mbBox(o, M4.ch(M4.T(P.x + s * 2.8, 10.9, P.y - s * 0.7), M4.RY(0.25), M4.S(1, 2.2, 1)), iron);
  mbBox(o, M4.ch(M4.T(P.x + 3, 5, P.y - 4.8), M4.RY(0.25), M4.S(3, 2, 0.6)), "#c9a24a"); // fecho
  mbBox(o, M4.ch(M4.T(P.x + 13, 1.6, P.y + 4), M4.RY(-0.4), M4.S(14, 0.6, 4.5)), "#a8adb5", 1, 0.03);
  mbBox(o, M4.ch(M4.T(P.x + 21, 2, P.y + 0.5), M4.RY(-0.4), M4.S(5, 2.2, 3)), "#6a4524"); // serrote
  mbBox(o, M4.ch(M4.T(P.x - 13, 1.4, P.y + 6), M4.RY(0.9), M4.S(10, 2, 2)), "#6a4524");
  mbBox(o, M4.ch(M4.T(P.x - 17, 2.2, P.y + 9), M4.RY(0.9), M4.S(3, 3.4, 5)), "#55585f"); // martelo
  mbBox(o, M4.ch(M4.T(P.x - 6, 1.6, P.y - 11), M4.RY(0.1), M4.S(11, 2.6, 4)), "#8a6a3a");
  mbBox(o, M4.ch(M4.T(P.x - 6, 2.4, P.y - 13), M4.RY(0.1), M4.S(8, 1, 1.2)), "#b0b4bb"); // plaina
  return glMesh(o);
}
function campMesaMesh() {
  const o = MB(),
    w = "#8a5a30",
    d = "#5e3c1e";
  mbBox(o, M4.ch(M4.T(0, 15, 0), M4.S(34, 2.4, 20)), w, 1, 0.06);
  for (const [x, z] of [
    [-14, -7.5],
    [14, -7.5],
    [-14, 7.5],
    [14, 7.5],
  ])
    mbCyl(o, M4.ch(M4.T(x, 0, z), M4.S(2, 14, 2)), d, 6, 1);
  mbBox(o, M4.ch(M4.T(-6, 17, 0), M4.RY(0.3), M4.S(10, 1, 7)), "#d8c8a0");
  mbBox(o, M4.ch(M4.T(8, 17.6, 2), M4.RY(-0.5), M4.S(3, 2.4, 9)), "#9aa3ae");
  mbCyl(o, M4.ch(M4.T(9, 16.2, -5), M4.S(2.4, 4, 2.4)), "#3a5a78", 8, 1); // papel, lâmina e tinteiro
  return glMesh(o);
}
/* v7.7 — o baú do acampamento: caixa de madeira com tampa, cintas de ferro e fecho */
function campBauMesh() {
  const o = MB(),
    wd = "#7a4a26",
    wl = "#8e5a30",
    iron = "#5f646c";
  mbBox(o, M4.ch(M4.T(0, 6, 0), M4.S(22, 12, 14)), wd, 0.9, 0.05);
  mbBox(o, M4.ch(M4.T(0, 13.4, 0), M4.S(23, 3, 15)), wl, 1, 0.04);
  mbCyl(o, M4.ch(M4.T(11.5, 13, 0), M4.RZ(Math.PI / 2), M4.S(9, 23, 15)), wl, 8, 1); // tampa arredondada
  for (const x of [-7, 7]) mbBox(o, M4.ch(M4.T(x, 9, 0), M4.S(1.6, 19, 15.4)), iron, 1, 0.02);
  mbBox(o, M4.ch(M4.T(0, 10, 7.4), M4.S(3, 4, 1)), "#c9a24a"); // fecho
  return glMesh(o);
}
/* maleta de ferramentas e mesa no acampamento (armasGLPush chama) */
export function campMesaGL() {
  if (!dungeon.camp || !CPS.tools) return;
  const P = ACAMP_PROPS;
  if (CPS.bau) {
    if (!GL3.mesh.campBau) GL3.mesh.campBau = propMesh("bau", P.bau, P.giroBau) ?? campBauMesh();
    glPush(GL3.mesh.campBau, M4.ch(M4.T(CPS.bau.x, 0, CPS.bau.y), M4.RY(0.3)));
  }
  if (!GL3.mesh.campTools) GL3.mesh.campTools = propMesh("maleta", P.maleta, P.giroMaleta) ?? campToolsMesh();
  glPush(GL3.mesh.campTools, M4.T(CPS.tools.x, 0, CPS.tools.y));
  if (econ.mesa) {
    if (!GL3.mesh.campMesa) GL3.mesh.campMesa = propMesh("mesa", P.mesa, P.giroMesa) ?? campMesaMesh();
    glPush(GL3.mesh.campMesa, M4.ch(M4.T(CPS.mesa!.x, 0, CPS.mesa!.y), M4.RY(0.35)));
  }
}

/* cena 3D do acampamento */
function campCol(x: number, z: number, F: Ponto, T: number) {
  const n = (Math.sin(x * 0.013 + z * 0.007) + Math.sin(x * 0.005 - z * 0.009 + 1.3)) / 2,
    r = Math.hypot((x - F.x) / 1.25, z - F.y);
  let c = gmix("#7fa04a", "#9cb456", 0.5 + n * 0.5);
  if (r < T * 3.4) c = gmix(c, gmix("#8a6a42", "#a2825a", 0.5 + n * 0.5), Math.min(1, (T * 3.4 - r) / (T * 1.2)));
  if (r < T * 0.9) c = gmix(c, "#3a2c20", Math.min(1, (T * 0.9 - r) / (T * 0.4)));
  const k = 0.95 + Math.sin(x * 0.11) * Math.sin(z * 0.13) * 0.04;
  return [c[0] * k, c[1] * k, c[2] * k];
}
export function glBuildCamp() {
  const d = dungeon,
    T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    F = CPS.fire || { x: W / 2, y: H / 2 },
    A = CPS.anvil || { x: F.x + T * 1.7, y: F.y },
    e = d.entrance,
    b = MB(),
    o = MB();
  MALHA._gs = 515;
  for (let gy = -7; gy < d.rows + 6; gy++)
    for (let gx = -9; gx < d.cols + 9; gx++) {
      const x = gx * T,
        z = gy * T;
      // v8.0: com cara de malha (render/gl/relevo.ts quadradoFacetado), miúdo como o campo aberto perto do que se vê
      quadradoFacetado(b, x, z, T, Math.hypot(x - F.x, z - F.y) < T * 9 ? 3 : 1, (px, pz) => campCol(px, pz, F, T));
    }
  mbPropsAcampamento(o, F, A, T);
  // mato e árvores em volta
  for (let i = 0; i < 70; i++) {
    const a = grnd() * 6.283,
      r = T * (4.3 + grnd() * 5),
      x = F.x + Math.cos(a) * r * 1.5,
      z = F.y + Math.sin(a) * r;
    if (
      Math.hypot(x - e.x, z - e.y) < T * 2.2 ||
      (x > 0 && x < W && z > 0 && z < H && Math.hypot((x - F.x) / 1.5, z - F.y) < T * 4.6)
    )
      continue;
    if (grnd() < 0.75) mbTree(o, x, z, grnd() < 0.35 ? 1 : 0, 0.8 + grnd() * 0.45);
    else mbIco(o, M4.ch(M4.T(x, 4, z), M4.RY(grnd() * 3), M4.S(12, 9, 11)), "#868a90", 0, 0.35, 0.12);
  }
  for (let i = 0; i < 80; i++) {
    const x = -2 * T + grnd() * (W + 4 * T),
      z = -T + grnd() * (H + 2 * T);
    if (Math.hypot(x - F.x, z - F.y) < T * 2.5) continue;
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
        "#6d8f38",
        3,
        0,
      );
    }
  }
  return { floor: glMesh(b), deco: glMesh(o) };
}
/** Os objetos do acampamento em volta da fogueira F e da bigorna A (a cena do acampamento e, v8.1, o acampamento visto
    do campo aberto, field/acampamento_campo.ts). */
export function mbPropsAcampamento(o: ReturnType<typeof MB>, F: Ponto, A: Ponto, T: number) {
  const wood = "#7a4e28",
    dark = "#4e321a";
  // anel de pedras, lenha e brasas (v8.0: o modelo dos props de acampamento; sem os dados, o feito por código)
  if (mbCenario(o, "fogueira", F.x, F.y, 1, { giro: 0 }))
    for (let i = 0; i < 26; i++) grnd(); // os sorteios do anel feito por código: as árvores em volta ficam onde estavam
  else {
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 6.283;
      mbIco(
        o,
        M4.ch(M4.T(F.x + Math.cos(a) * 15, 2.4, F.y + Math.sin(a) * 15), M4.RY(grnd() * 3), M4.S(7, 5.5, 6.5)),
        gmix("#8d8d88", "#b0afa8", grnd()),
        0,
        0.3,
        0.1,
      );
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 3.1416 + 0.4;
      mbCyl(
        o,
        M4.ch(M4.T(F.x, 2.5, F.y), M4.RY(a), M4.RZ(Math.PI / 2), M4.T(0, -11, 0), M4.S(3.2, 22, 3.2)),
        gmix(wood, dark, grnd() * 0.6),
        7,
        1,
        0.06,
      );
    }
    mbIco(o, M4.ch(M4.T(F.x, 1, F.y), M4.S(16, 2, 16)), "#2a201a", 0, 0.2, 0.05);
  }
  // fornalha com toldo atrás da bigorna (v8.0: peça F10 da folha da forja; só enfeite, a forja abre na bigorna)
  mbCenario(o, "fornalha", A.x - T * 0.1, A.y - T * 1.5, 1, { giro: 0 });
  for (const s of [-1, 1]) mbCyl(o, M4.ch(M4.T(F.x + s * 14, 0, F.y), M4.S(1.4, 24, 1.4)), dark, 5, 1);
  mbCyl(o, M4.ch(M4.T(F.x - 15, 22, F.y), M4.RZ(-Math.PI / 2), M4.S(1, 30, 1)), dark, 5, 1); // espeto
  // bigorna num toco, ao lado da fogueira (v8.0: o modelo da folha da forja; sem os dados, a feita por código)
  if (!mbCenario(o, "bigorna", A.x, A.y, 1, { giro: 0 })) {
    mbCyl(o, M4.ch(M4.T(A.x, 0, A.y), M4.S(15, 13, 15)), "#6a4524", 10, 0.95, 0.06);
    mbCyl(o, M4.ch(M4.T(A.x, 12.9, A.y), M4.S(14, 0.4, 14)), "#c8a170", 10, 1, 0.03);
    const an = "#3a3d44";
    mbBox(o, M4.ch(M4.T(A.x, 15.5, A.y), M4.S(7, 5, 7)), an, 0.75);
    mbBox(o, M4.ch(M4.T(A.x, 19.5, A.y), M4.S(17, 4, 7.5)), an, 1, 0.03);
    mbCyl(o, M4.ch(M4.T(A.x + 8.5, 19.5, A.y), M4.RZ(-Math.PI / 2), M4.S(5.5, 7, 5.5)), an, 8, 0);
    mbBox(o, M4.ch(M4.T(A.x - 0.5, 21.6, A.y), M4.S(17, 0.6, 7.2)), "#8f939c");
    mbBox(o, M4.ch(M4.T(A.x - 3, 22.5, A.y + 6), M4.RY(0.5), M4.S(2, 2, 11)), "#6a4524");
    mbBox(o, M4.ch(M4.T(A.x - 0.6, 23, A.y + 10.5), M4.RY(0.5), M4.S(5, 4, 3)), "#55585f"); // martelo
  }
  if (!mbCenario(o, "balde", A.x + 11, A.y + 12, 1, { giro: 0 })) {
    mbCyl(o, M4.ch(M4.T(A.x + 11, 0, A.y + 12), M4.S(9, 9, 9)), "#5a5a58", 8, 0.85, 0.05);
    mbCyl(o, M4.ch(M4.T(A.x + 11, 8.5, A.y + 12), M4.S(7.5, 0.4, 7.5)), "#3b5a78", 8, 1); // balde d'água
  }
  // tronco para sentar, saco de dormir, lona simples e mochila
  mbCyl(
    o,
    M4.ch(M4.T(F.x - T * 1.05, 4.5, F.y - T * 0.95), M4.RY(0.25), M4.RZ(Math.PI / 2), M4.T(0, -16, 0), M4.S(9, 32, 9)),
    wood,
    9,
    1,
    0.08,
  );
  // saco de dormir aberto com o enrolado na cabeceira (v8.0: props de acampamento; sem os dados, os feitos por código)
  if (mbCenario(o, "saco", F.x - T * 0.4, F.y + T * 1.35, 1, { giro: 0 }))
    mbCenario(o, "rolo", F.x - T * 0.4 - 22, F.y + T * 1.35, 1, { giro: 0 });
  else {
    mbCyl(
      o,
      M4.ch(M4.T(F.x - T * 0.4, 3, F.y + T * 1.35), M4.RY(-0.15), M4.RZ(Math.PI / 2), M4.T(0, -14, 0), M4.S(6, 28, 6)),
      "#6a8a5a",
      9,
      1,
      0.05,
    );
    mbBox(
      o,
      M4.ch(M4.T(F.x - T * 0.4 - 10, 1.2, F.y + T * 1.35 + 9), M4.RY(-0.15), M4.S(24, 1.8, 14)),
      "#7a6a4a",
      1,
      0.05,
    );
  }
  const lx = F.x - T * 1.9,
    lz = F.y + T * 1.8;
  // toldo no lugar da lona simples, mas do outro lado da fogueira (ao lado da barraca ficava apertado); o lampião
  // fica na porta da barraca (a tenda de campSetup: F − 2.8T, F + 2.4T)
  if (mbCenario(o, "toldo", F.x - T * 2.3, F.y - T * 1.9, 1, { giro: 0 }))
    mbCenario(o, "lampiao", F.x - T * 1.7, F.y + T * 2.1, 1, { giro: 0 });
  else {
    for (const s of [-1, 1]) mbCyl(o, M4.ch(M4.T(lx + s * 16, 0, lz - 8), M4.S(1.6, 26, 1.6)), dark, 5, 1);
    mbBox(o, M4.ch(M4.T(lx, 13, lz + 2), M4.RX(0.75), M4.S(32, 1, 26)), "#8f8a5c", 1, 0.05);
  }
  if (!mbCenario(o, "mochila", F.x + T * 0.3, F.y - T * 1.5, 1, { giro: 0.3 }))
    mbBox(o, M4.ch(M4.T(F.x + T * 0.3, 6, F.y - T * 1.5), M4.RY(0.3), M4.S(11, 12, 8)), "#8a6a3a", 0.8, 0.06); // mochila
  if (mbCenario(o, "lenha", F.x + T * 1.2 + 5, F.y + T * 1.4, 1, { giro: 0 }))
    for (let i = 0; i < 5; i++) grnd(); // os sorteios da lenha feita por código: as árvores em volta ficam onde estavam
  else
    for (let i = 0; i < 5; i++)
      mbCyl(
        o,
        M4.ch(
          M4.T(F.x + T * 1.2 + i * 2.5, 1.5 + (i % 2) * 2.4, F.y + T * 1.4),
          M4.RX(Math.PI / 2),
          M4.T(0, -9, 0),
          M4.S(2.6, 18, 2.6),
        ),
        gmix(wood, dark, grnd() * 0.5),
        6,
        1,
      ); // lenha empilhada
}
export function campGLPush() {
  if (CT.unlit && dungeon.camp) return; // v6.4 — fogueira apagada no tutorial
  if (CPS.fire) chamasGLPush(CPS.fire);
}
/** As chamas e a luz de uma fogueira em F (campo: a do acampamento; v8.1: também a vista do campo aberto). */
export function chamasGLPush(F: Ponto) {
  if (!GL3.mesh.flame) {
    const b = MB();
    mbCyl(b, M4.S(1, 1, 1), "#ffb43a", 7, 0);
    GL3.mesh.flame = glMesh(b);
    const c = MB();
    mbCyl(c, M4.S(1, 1, 1), "#ff6a1a", 7, 0);
    GL3.mesh.flame2 = glMesh(c);
  }
  const t = performance.now() / 1000;
  GL3.fogos.push([F.x, F.y, 1]); // v8.0: a luz da fogueira (luzFogueira)
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26,
      r = i ? 4 : 0,
      h = (i ? 12 : 18) * (0.8 + 0.25 * Math.sin(t * (9 + i) + i * 2)),
      w = i ? 6 : 9;
    glPush(
      i % 2 ? GL3.mesh.flame2 : GL3.mesh.flame,
      M4.ch(M4.T(F.x + Math.cos(a) * r, 3, F.y + Math.sin(a) * r), M4.RZ(Math.sin(t * 5 + i) * 0.12), M4.S(w, h, w)),
      [1, 0.85, 0.4, 0.55],
      false,
    );
    GL3.list[GL3.list.length - 1].brilha = true;
  }
}

/* ---- ACAMPAMENTO: um mapa separado (como a masmorra), com fogueira e bigorna ---- */
/** A carne no espeto (campCook): os dois lados (a, b), o lado virado para o fogo, o calor e a animação. */
export interface Cozimento {
  a: number;
  b: number;
  down: "a" | "b"; // o lado virado para o fogo
  heat: number;
  ht: number;
  up: boolean;
  t: number;
  last: number;
  tier: number;
  an: string;
  flare: number;
  flipT?: number;
  msgT?: number;
}
interface EstadoCAMP {
  open: boolean;
  cook: Cozimento | null;
  // acrescentados depois
  allowForge?: number | boolean;
  noWood?: boolean | number;
  raf?: number | null;
}
export const CAMP: EstadoCAMP = { open: false, cook: null };
/* no mapa: só um camping provisório — fogueira de pedras e a bigorna ao lado */
export function campDraw() {
  const p = campPos();
  if (p) {
    const c = TELAS.ctx,
      t = performance.now() / 1000,
      tod = (world.tick % CONFIG.DAY_MIN) / CONFIG.DAY_MIN,
      night = tod < 0.23 || tod > 0.8,
      fx = p.x - 7,
      fy = p.y + 7;
    const g = c.createRadialGradient(fx, fy, 1, fx, fy, night ? 40 : 18);
    g.addColorStop(0, "rgba(255,170,60," + (night ? 0.42 : 0.22) + ")");
    g.addColorStop(1, "rgba(255,120,40,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(fx, fy, night ? 40 : 18, 0, 6.283);
    c.fill();
    c.fillStyle = "rgba(90,64,36,.35)";
    c.beginPath();
    c.ellipse(p.x, p.y + 6, 18, 9, 0, 0, 6.283);
    c.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283;
      c.fillStyle = i % 2 ? "#8a8a86" : "#a4a49e";
      c.beginPath();
      c.arc(fx + Math.cos(a) * 4.2, fy + Math.sin(a) * 2.6, 1.3, 0, 6.283);
      c.fill();
    }
    c.strokeStyle = "#5a3a1e";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(fx - 3, fy + 1.5);
    c.lineTo(fx + 3, fy - 0.5);
    c.moveTo(fx - 3, fy - 0.5);
    c.lineTo(fx + 3, fy + 1.5);
    c.stroke();
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * 2.1,
        hgt = 4.5 + Math.sin(a) * 1.5 + i * 0.8;
      c.fillStyle = ["#ffd24a", "#ff8a2a", "#ff5a2a"][i];
      c.beginPath();
      c.moveTo(fx - 2.2 + i * 0.7, fy);
      c.quadraticCurveTo(fx + Math.sin(a * 1.3) * 1.5, fy - hgt, fx + 2.2 - i * 0.7, fy);
      c.fill();
    }
    const ax = p.x + 8,
      ay = p.y + 6;
    c.fillStyle = "#6a4524";
    c.fillRect(ax - 2, ay - 1, 4, 4);
    c.fillStyle = "#3d3f44";
    c.beginPath();
    c.moveTo(ax - 5, ay - 4);
    c.lineTo(ax + 4, ay - 4);
    c.quadraticCurveTo(ax + 6.5, ay - 3.6, ax + 6.5, ay - 2.6);
    c.lineTo(ax + 2, ay - 1.6);
    c.lineTo(ax - 2, ay - 1.6);
    c.lineTo(ax - 3, ay - 2.6);
    c.closePath();
    c.fill();
    c.fillStyle = "#9a9ca2";
    c.fillRect(ax - 4.6, ay - 4.2, 8.5, 0.8);
    c.fillStyle = "#8a6a4a";
    c.save();
    c.translate(p.x - 13, p.y - 1);
    c.rotate(-0.3);
    c.fillRect(-4.5, -1.6, 9, 3.2);
    c.fillStyle = "#6a8a5a";
    c.fillRect(-1.5, -1.6, 6, 3.2);
    c.restore(); // saco de dormir
  }
  /* v5.9.04 — tamanduás selvagens e o seu no mapa */
  {
    const c = TELAS.ctx,
      t = performance.now() / 1000,
      sc = camera.scale,
      vx0 = -camera.tx / sc - 30,
      vy0 = -camera.ty / sc - 30,
      vx1 = vx0 + TELAS.viewport.clientWidth / sc + 60,
      vy1 = vy0 + TELAS.viewport.clientHeight / sc + 60;
    for (const a of wildAnteaters()) {
      const p = wildPos(a);
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      drawAnteater2D(c, p.x, p.y, 0.95, p.face, false, t * 0.6, a.coat);
    }
    const mp = mountMapPos();
    if (mp) {
      const tk = icoImg("tam_tok_" + coatOf(mnt()));
      if (tk) {
        const S = 20,
          fl = mp.face < 0 ? -1 : 1;
        c.save();
        c.translate(mp.x, mp.y - 4 + (mp.ridden ? Math.sin(t * 9) * 0.6 : 0));
        c.scale(fl, 1);
        c.drawImage(tk, -S / 2, -S / 2, S, S);
        c.restore();
      } else drawAnteater2D(c, mp.x, mp.y, 1.05, mp.face, true, mp.ridden ? t * 2 : 0, coatOf(mnt()));
      c.save();
      c.font = "bold 6px Lora,serif";
      c.textAlign = "center";
      c.fillStyle = "#1c140b";
      c.fillText(mnt()!.name, mp.x, mp.y - 9);
      c.restore();
    }
  }
  /* v5.9.11 — área de caça e caminho de quem está andando */
  try {
    const c = TELAS.ctx,
      t = performance.now() / 1000;
    for (const h of world.heroes) {
      if ((h.state === "hunting" || h.state === "traveling") && h.task && h.task.r) {
        c.save();
        c.setLineDash([5, 4]);
        c.lineDashOffset = -t * 6;
        c.strokeStyle = h.color || "#ffd27a";
        c.globalAlpha = 0.75;
        c.lineWidth = 1.4;
        c.beginPath();
        c.arc(h.task.x, h.task.y, h.task.r, 0, 6.283);
        c.stroke();
        c.globalAlpha = 0.07;
        c.fillStyle = h.color || "#ffd27a";
        c.fill();
        c.restore();
      }
      if (h.state === "walking" && h.walkTo) {
        c.save();
        c.setLineDash([3, 4]);
        c.strokeStyle = h.color || "#fff";
        c.globalAlpha = 0.8;
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(h.x, h.y);
        c.lineTo(h.walkTo.x, h.walkTo.y);
        c.stroke();
        c.setLineDash([]);
        c.beginPath();
        c.arc(h.walkTo.x, h.walkTo.y, 3 + Math.sin(t * 5), 0, 6.283);
        c.stroke();
        c.restore();
      }
      if (h.state === "field") {
        c.save();
        c.strokeStyle = h.color || "#fff";
        c.globalAlpha = 0.55;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(h.x, h.y, 9 + Math.sin(t * 3) * 1.5, 0, 6.283);
        c.stroke();
        c.restore();
      }
    }
  } catch (_) {}
  /* v5.9.12 — balão de expedição */
  try {
    campDrawExpedicao();
  } catch (_) {}
  /* v5.9.13 — mesa e caixas no acampamento; textos que sobem no mapa */
  try {
    const c = TELAS.ctx,
      now = performance.now(),
      p = campPos();
    if (p && econ.mesa) {
      const x = p.x + 14,
        y = p.y + 4;
      c.save();
      c.fillStyle = "#6b4a2a";
      c.fillRect(x - 6, y - 2, 12, 3);
      c.fillStyle = "#4a3018";
      c.fillRect(x - 5, y + 1, 1.5, 4);
      c.fillRect(x + 3.5, y + 1, 1.5, 4);
      c.restore();
    }
    if (p && econ.caixas)
      for (let i = 0; i < econ.caixas; i++) {
        const x = p.x - 16 - (i % 2) * 6,
          y = p.y + 6 - Math.floor(i / 2) * 5;
        c.save();
        c.fillStyle = "#8a5a2a";
        c.fillRect(x - 2.5, y - 2.5, 5, 5);
        c.strokeStyle = "#3a2410";
        c.lineWidth = 0.6;
        c.strokeRect(x - 2.5, y - 2.5, 5, 5);
        c.restore();
      }
    for (let i = MAPFX.length - 1; i >= 0; i--) {
      const f = MAPFX[i],
        k = (now - f.t0) / 1700;
      if (k >= 1) {
        MAPFX.splice(i, 1);
        continue;
      }
      const x = f.h.x,
        y = f.y - 10 - k * 16,
        a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4),
        s = Math.max(1, 1.6 / Math.sqrt(camera.scale / camera.minScale / 6));
      c.save();
      c.globalAlpha = a;
      const im = f.ico && icoImg(f.ico);
      c.font = "700 " + 7 * s + "px Lora, serif";
      const tw = c.measureText(f.txt).width,
        w = tw + (im ? 10 * s : 0) + 6 * s;
      c.fillStyle = "rgba(30,20,10,.82)";
      c.fillRect(x - w / 2, y - 6 * s, w, 12 * s);
      if (im) c.drawImage(im, x - w / 2 + 2 * s, y - 5 * s, 10 * s, 10 * s);
      c.fillStyle = "#ffe8a8";
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.fillText(f.txt, x - w / 2 + (im ? 12 * s : 3 * s), y);
      c.restore();
    }
  } catch (_) {}
  /* v6.4 — balão do tutorial */
  try {
    campDrawBalao();
  } catch (_) {}
  /* v7.5 — docas */
  try {
    const c = TELAS.ctx,
      t = performance.now() / 1000,
      D = docaCaca(),
      V = docaVila();
    if (D) drawDoca(c, D, t);
    if (V) drawDoca(c, V, t + 1);
  } catch (_) {}
}
export function nearCamp(wx: number, wy: number) {
  const p = campPos();
  return p && Math.hypot(wx - p.x, wy - p.y) < Math.max(18, 26 / camera.scale);
}
export function campMeatStock() {
  let n = 0;
  for (const h of world.heroes) n += (h.loot && h.loot.meat) || 0;
  return n;
}
function campWood() {
  let n = 0;
  for (const h of world.heroes) n += (h.loot && h.loot.wood) || 0;
  return n;
}
export function campTake(kind: string, n: number) {
  for (const h of world.heroes) {
    if (n <= 0) break;
    const v = (h.loot && h.loot[kind]) || 0,
      t = Math.min(v, n);
    if (t) {
      h.loot[kind] -= t;
      n -= t;
    }
  }
  return n <= 0;
}
function campRawItem() {
  const d = dungeon;
  for (const inv of [
    d.active && d.hero ? ensureInv(d.hero) : null,
    econ.stash,
    ...world.heroes.map((h) => h.inv),
  ].filter(Boolean)) {
    const it = inv!.items.find((i) => i.def.key === "carne" || i.def.key === "peixe");
    if (it) return { it, inv };
  }
  return null;
}
export function enterCamp(h?: Hero) {
  /* v6.4 */
  if (!h && performance.now() - MAPCTL.clickT < 150) return;
  if (dungeon.active) return;
  if (!h || h.state !== "idle")
    h =
      (prep.open && prepHero && prepHero() && prepHero()!.state === "idle" ? prepHero() : null) ||
      world.heroes.find((x) => x.state === "idle");
  if (!h) {
    mvToast("⛺ Ninguém no acampamento agora — espere alguém voltar.");
    return;
  }
  if (prep.open) closePrep();
  if (typeof bag !== "undefined" && bag.open) closeBag();
  const insp = document.getElementById("hero-inspector");
  if (insp) insp.classList.remove("open");
  CPS.prevCam = { s: camera.scale, x: camera.tx, y: camera.ty };
  camZoomTo(h.x, h.y, Math.max(camera.scale * 4, camera.minScale * 10), 800, () => {
    CPS.pending = true;
    launchDungeon(h.id);
  });
}
export function campSetup() {
  if (econ.introDone && econ.campTut == null) econ.campTut = 1; // v6.5 — tutorial do acampamento na 1ª entrada depois da abertura
  const d = dungeon,
    T = d.tile;
  d.camp = true;
  d.mode = "camp";
  d.flow = "camp";
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
  d.spears = [];
  d.spearOut = null;
  CPS.fire = { x: T * 6.6, y: (d.rows * T) / 2 + T * 0.2 };
  CPS.anvil = { x: CPS.fire.x + T * 1.7, y: CPS.fire.y - T * 0.35 };
  d.px = CPS.fire.x - T * 2.2;
  d.py = CPS.fire.y + T * 0.3;
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.6,
      r = T * (2.6 + (i % 2));
    d.loot.push({
      key: "galho",
      x: CPS.fire.x + Math.cos(a) * r * 1.3,
      y: CPS.fire.y + Math.sin(a) * r * 0.8,
      ground: true,
      t: 0,
      ttl: 0,
    });
  }
  GL3.sceneKey = "";
  GL3.heroKey = "";
  setBanner(
    "⛺ ACAMPAMENTO",
    "Fogueira (E): assar carne · Bigorna (E): forjar · descansar perto do fogo fecha ferimentos · saia pelo círculo verde",
    5,
    "#ffd08a",
  );
  /* v5.9.15 — maleta de ferramentas e mesa */
  {
    const T = dungeon.tile,
      F = CPS.fire;
    CPS.tools = { x: F.x + T * 2.5, y: F.y + T * 2.0 };
    CPS.mesa = { x: F.x - T * 2.7, y: F.y - T * 0.5 };
    setBanner(
      "⛺ ACAMPAMENTO",
      "Fogueira: assar · Bigorna: forjar · Maleta: carpintaria" +
        (econ.mesa ? " · Mesa: analisar" : "") +
        " (E) · saia pelo círculo verde",
      5,
      "#ffd08a",
    );
  }
  /* v6.1 — o Caçador fica no acampamento depois da abertura */
  {
    if (econ.hunterCamp || econ.introDone) {
      const T = dungeon.tile,
        F = CPS.fire;
      CPS.hunter = { x: F.x - T * 0.2, y: F.y - T * 1.55 };
      ISC.campNpc = { x: CPS.hunter.x, y: CPS.hunter.y, yaw: Math.PI / 2, ph: 0 };
    } else {
      CPS.hunter = null;
      ISC.campNpc = null;
    }
  }
  /* v6.4 — começa o tutorial da fogueira; barraca */
  try {
    if (econ.campTut === 1) {
      econ.campTut = 2;
      Object.assign(CT, { on: true, unlit: true, lighting: false, stage: "arrive" });
      dungeon.banner = null;
      setTimeout(ctArrive, 900);
    }
  } catch (e) {
    console.warn(e);
  }
  try {
    const T = dungeon.tile,
      F = CPS.fire;
    CPS.tent = { x: F.x - T * 2.8, y: F.y + T * 2.4 };
    CPS.bau = { x: F.x - T * 1.35, y: F.y + T * 2.9 }; // v7.7
  } catch (_) {}
}
export function campForge() {
  CAMP.allowForge = true;
  try {
    openForge();
  } finally {
    CAMP.allowForge = false;
  }
}
/* v7.7 — os avisos do acampamento (fogueira, bigorna, maleta, mesa, Caçador, tamanduá, cochilo) foram para o painel
   de ações no canto (ui/acoes.ts) */
/* modal da fogueira (minigame) */
function campEnsureDom() {
  if (document.getElementById("camp-modal")) return;
  const m = document.createElement("div");
  m.id = "camp-modal";
  m.className = "v3-modal";
  m.innerHTML =
    '<div class="v3-card" id="camp-card"><div id="camp-head"><b>🔥 Fogueira</b><button class="btn" id="camp-x">✕</button></div><div id="camp-body"></div></div>';
  document.body.appendChild(m);
  (m.querySelector("#camp-x") as HTMLElement).onclick = campClose;
  m.addEventListener("click", (e) => {
    if (e.target === m) campClose();
  });
  m.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest("[data-ca]") as HTMLButtonElement;
    if (a && !a.disabled) campAct(a.dataset.ca!);
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (!CAMP.open) return;
      if (e.code === "Escape") {
        e.stopPropagation();
        if (!CAMP.cook) campClose();
      } else if (CAMP.cook && e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) cookFlip();
      } else if (CAMP.cook && e.code === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        CAMP.cook.up = true;
      } else if (e.code === "KeyE" || e.code.startsWith("Key") || e.code.startsWith("Arrow")) e.stopPropagation();
    },
    true,
  );
  window.addEventListener("keyup", (e) => {
    if (CAMP.cook && e.code === "ArrowUp") CAMP.cook.up = false;
  });
}
export function campOpen() {
  if (CT.unlit && dungeon.camp) {
    spawnDungeonToast("A fogueira está apagada", dungeon.px, dungeon.py - 40, "#ffb37a", 12);
    return;
  } // v6.4 — fogueira apagada no tutorial
  {
    const h = (dungeon.active && dungeon.hero) || world.heroes[0],
      lv = profLv(h, "sobrevivencia");
    COOK.ok[0] = 0.72 - lv * 0.012;
    COOK.ok[1] = 0.95 + lv * 0.006;
  } // v5.9.05 — Sobrevivência alarga o ponto da carne
  campEnsureDom();
  CAMP.open = true;
  if (dungeon.active) dungeon.modalOpen = true;
  document.getElementById("camp-modal")!.classList.add("open");
  campRender();
}
export function campClose() {
  CAMP.noWood = false;
  /* v5.9.02 */ CAMP.open = false;
  CAMP.cook = null;
  if (dungeon.active) dungeon.modalOpen = false;
  const m = document.getElementById("camp-modal");
  if (m) m.classList.remove("open");
}
export function campRender() {
  const B = document.getElementById("camp-body"),
    meat = campMeatStock(),
    raw = campRawItem(),
    wood = campWood();
  if (CAMP.cook) {
    B!.innerHTML =
      '<canvas id="cook-cv" width="420" height="260"></canvas><p class="cook-tip"><b>Espaço</b> (ou clique na carne) vira o espeto · segure <b>↑</b> (ou o botão) para afastar do fogo quando a chama subir · tire quando os dois lados estiverem <b>ao ponto</b> (faixa verde).</p><div class="cook-btns"><button class="btn" data-ca="flip">🔄 Virar</button><button class="btn" data-ca="up" id="cook-up">⬆ Afastar (segure)</button><button class="btn pri" data-ca="done">🍖 Tirar do fogo</button></div>';
    cookBind();
    return;
  }
  B!.innerHTML =
    "<p>Asse a carne para virar <b>Carne Assada</b>: mata bem a fome (−45) e ajuda a fechar ferimentos. Carne crua quase não sustenta e pode dar enjoo.</p>" +
    '<div class="camp-stock"><span>' +
    icoTag("ui_comida", "🥩") +
    " Carne no estoque: <b>" +
    meat +
    "</b></span><span>" +
    icoTag("carne", "🥩") +
    " Carne na mochila/baú: <b>" +
    (raw ? "sim" : "não") +
    "</b></span><span>" +
    icoTag("ui_madeira", "🪵") +
    " Lenha: <b>" +
    wood +
    "</b></span></div>" +
    '<button class="btn pri" data-ca="cook"' +
    ((meat > 0 || raw) && (wood > 0 || econ.test || CAMP.noWood) ? "" : " disabled") +
    ">🔥 Assar um pedaço" +
    (CAMP.noWood ? "" : " (1 lenha)") +
    "</button>" +
    (wood <= 0 && !econ.test && !CAMP.noWood
      ? ' <small class="camp-warn">Sem lenha: pegue os galhos do chão (E) ou colete madeira no mapa.</small>'
      : "") +
    (meat <= 0 && !raw ? ' <small class="camp-warn">Sem carne: cace no mapa ou traga da masmorra.</small>' : "");
}
export function campAct(a: string) {
  if (a === "cook") {
    if (!econ.test && !CAMP.noWood && !campTake("wood", 1)) return;
    let src;
    if (campMeatStock() > 0) {
      campTake("meat", 1);
      src = { tier: 0, an: ["javali", "cervo", "coelho", "lobo"][Math.floor(Math.random() * 4)] };
    } else {
      const r = campRawItem();
      if (!r) return;
      src = { tier: r.it.tier | 0, an: r.it.def.key === "peixe" ? "peixe" : r.it.an };
      if ((r.it.n || 1) > 1) r.it.n!--;
      else r.inv!.items.splice(r.inv!.items.indexOf(r.it), 1);
      renderInv(); // v7.7: a mochila aberta (no tutorial ela fica aberta) mostrava a carne que já foi para o fogo
    }
    CAMP.cook = {
      a: 0,
      b: 0,
      down: "a",
      heat: 1,
      ht: 0,
      up: false,
      t: 0,
      last: performance.now(),
      tier: src.tier,
      an: src.an || "javali",
      flare: 0,
    };
    campRender();
    return;
  }
  if (a === "flip") {
    cookFlip();
    return;
  }
  if (a === "done") {
    cookFinish();
    return;
  }
}
