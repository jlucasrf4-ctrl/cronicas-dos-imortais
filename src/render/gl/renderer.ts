/* ==== Fase 4 — o renderizador WebGL2: programas, sombras, lista de desenho (base/11) ==== */
import { armaModelo, pontasArco } from "./armas3d.ts";
import { alturaMontada, alturaMontadaAnim } from "../../creatures/tamandua.ts";
import { GL3, TELAS, dungeon, OPT } from "../../core/state.ts";
import { GL_VS, GL_FS, GL_SVS, GL_SFS, GL_OVS, GL_OFS, WOLF_COATS } from "./shaders.ts";
import { glBuildWolf, glBuildBoar, glBuildHero, glOutlinePass } from "./estilo.ts";
import { bichoAnimado, tomPelagem } from "./bichos.ts";
import { cacadorAnimado } from "./cacador_anim.ts";
import { bandidoGL, bandidosCaidosGL } from "./bandidos_gl.ts";
import { D3 } from "../../field/projecao.ts";
import { CZ, ZOOM_PERTO } from "../../field/tipos.ts";
import { persp } from "../../intro/cinematica.ts";
import { glBuildMisc, glBuildScene } from "./modelos.ts";
import { HEROINA } from "./heroina.ts";
import {
  heroinaAnimada,
  presoEm,
  armaNoCombo,
  lancaDuasMaos,
  lancaNaMira,
  punhoLanca,
  arcoNasCostas,
  escudoNasCostas,
  escudoNoBraco,
  peleNaJunta,
  corpoDaHeroina,
  verticesDaHeroina,
} from "./heroina_anim.ts";
import { VESTIDO, vestirComoHeroi } from "./vestidos.ts";
import { mochilaVivaQuadro, retratoPainelQuadro } from "../retrato.ts";
import { malhaChao, anelChao, anelLinha, raioBrilho } from "./chao.ts";
import { fitDungeonCanvas } from "../../field/masmorra.ts";
import { perfW, perfH, glShadowPass, perfFrame, perfPausedView } from "../desempenho.ts";
import { M4 } from "./geometria.ts";
import type { Vec3 } from "./geometria.ts";
import { critGL, birdGL } from "./animais.ts";
import { glDummy } from "../../field/treino.ts";
import { runeWolfTint, runeGLPush, runeGLGlow } from "../../runas/runas.ts";
import { ensureEquip, heroEq, eqSig } from "../../items/equipamento.ts";
import { knifeIn } from "../../field/faca_corda.ts";
import { glFree, gcol, glMesh } from "./malhas.ts";
import { mbCenario } from "./cenario.ts";
import { aimAngle } from "../../field/acertos.ts";
import { heroFaceAngle } from "../../field/combate.ts";
import { addRing, anelAlcance } from "../../field/chao.ts";
import { spearPoseOv, wpnMesh, armaCravadaMatriz } from "./armas.ts";
import { spearTwoHand, armasGLPush, spearMode, wpnKey } from "../../field/armas.ts";
import { TIERS } from "../../items/inventario.ts";
import { mundoGLPush, mundoLuz, naVistaCampo, alturaChao } from "./mundo_cena.ts";
import { cantoCampo } from "../../map/mundo.ts";
import { desenharAgua } from "./agua.ts";
import { rastroGL } from "../../field/rastro.ts";
import { statusFxGL, esquivaFxGL } from "./status_fx.ts";
import { luzCampo, luzFogueira } from "../luz_do_dia.ts";
import { decoGLPush, efeitosGL } from "../../editor/cena.ts";
import type { GLMesh, Monster, Repasse } from "../../core/tipos.ts";
import type { Mat4 } from "./geometria.ts";
import type { Anim } from "./esqueleto.ts";
import type { MalhasBichos } from "../../core/state.ts";

/** v7.7 — contorno dos itens no chão: branco nos itens; dourado e mais grosso no que o E vai pegar (com um anel
 *  dourado no chão, `anelPegar` × o raio do brilho). */
const CHAO_OL = { base: [0.96, 0.94, 0.88], espBase: 1.3, pegar: [1, 0.78, 0.25], espPegar: 2.4, anelPegar: 1.35 };
/** v8.0 — espessura do contorno escuro dos modelos (× a de antes; mantenedor 2026-10-25: "achei os contornos muito
    marcados"). A cor fica em glOutlinePass (estilo.ts). */
const CONTORNO = { esp: 0.6 };
/** v8.0 — o arco equipado nas costas (o longo tem outro desenho, armas3d.ts) e onde a corda prendia no arco antigo. */
function arcoDaHeroina() {
  const h = dungeon.hero;
  return h && ensureEquip(h).costas?.def?.key === "eq_arco_longo" ? "eq_arco_longo" : "eq_arco";
}
const PONTAS_ANTIGAS: [number[], number[]] = [
  [-2.4, 13],
  [-2.4, -13],
];
export function glPush(mesh: GLMesh, M: Float32Array | number[], tint?: number[] | null, cast?: boolean) {
  GL3.list.push({ mesh, M, tint: tint || null, cast: cast !== false });
}

/* ---------- WebGL ---------- */
function glProg(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const mk = (t: number, s: string) => {
    const sh = gl.createShader(t)!;
    gl.shaderSource(sh, s);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)!);
    return sh;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)!);
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)!);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)!);
  return p;
}
export function glInit() {
  GL3.tried = true;
  try {
    const cv = document.createElement("canvas");
    cv.id = "dungeon-gl";
    const gl = cv.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) return false;
    GL3.cv = cv;
    GL3.gl = gl;
    GL3.prog = glProg(gl, GL_VS, GL_FS);
    GL3.sprog = glProg(gl, GL_SVS, GL_SFS);
    GL3.tprog = glProg(
      gl,
      "#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; out vec4 vC; void main(){ vC = aC; gl_Position = uVP * vec4(aP, 1.0); }",
      "#version 300 es\nprecision mediump float; in vec4 vC; out vec4 o; void main(){ o = vC; }",
    );
    GL3.tVP = gl.getUniformLocation(GL3.tprog, "uVP");
    GL3.tvao = gl.createVertexArray();
    gl.bindVertexArray(GL3.tvao);
    GL3.tb = [gl.createBuffer(), gl.createBuffer()];
    gl.bindBuffer(gl.ARRAY_BUFFER, GL3.tb[0]);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, GL3.tb[1]);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    for (const u of [
      "uVP",
      "uM",
      "uL",
      "uS",
      "uLd",
      "uTint",
      "uCam",
      "uFogC",
      "uFog",
      "uVD",
      "uNoite",
      "uFogos",
      "uFogoC",
      "uBrilha",
      "uTex",
      "uUsaTex",
    ])
      GL3.U[u] = gl.getUniformLocation(GL3.prog, u);
    GL3.oprog = glProg(gl, GL_OVS, GL_OFS);
    for (const u of ["uVP", "uM", "uTh", "uPush", "uCol"]) GL3.OU![u] = gl.getUniformLocation(GL3.oprog, u);
    for (const u of ["uL", "uM"]) GL3.SU[u] = gl.getUniformLocation(GL3.sprog, u);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, GL3.SM, GL3.SM);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("fbo de sombra incompleto");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    GL3.fbo = f;
    GL3.stex = t;
    (GL3.mesh as unknown as MalhasBichos).wolf = [];
    for (let i = 0; i < WOLF_COATS.length; i++) (GL3.mesh as unknown as MalhasBichos).wolf.push(glBuildWolf(i));
    glBuildMisc();
    cv.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      GL3.ok = false;
      D3.gl = false;
      fitDungeonCanvas();
    });
    const wrap = document.getElementById("dungeon-stage-wrap")!;
    wrap.insertBefore(cv, wrap.firstChild);
    GL3.ok = true;
    return true;
  } catch (err) {
    console.warn("3D WebGL indisponível, usando o 3D simples:", err);
    GL3.ok = false;
    return false;
  }
}
export function glPlace() {
  // reescrita na v5.7
  const cv = GL3.cv;
  if (!cv || !TELAS.dCanvas) return;
  const w = perfW(),
    h = perfH();
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  cv.style.width = TELAS.dCanvas.style.width;
  cv.style.height = TELAS.dCanvas.style.height;
  cv.style.left = TELAS.dCanvas.offsetLeft + "px";
  cv.style.top = TELAS.dCanvas.offsetTop + "px";
}
/* v7.7 — pernas da heroína montada (rad): abertas para os lados e um pouco para a frente */
const MONTADA = { abre: 0.6, frente: 0.35 };
export function angSD(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
} // diferença de ângulo COM sinal
function glWolf(m: Monster, ghost?: boolean) {
  /* v7.0 · v8.1: o chefe rúnico com modelo de coelho ou cervo (Monster.visualBicho) também */
  if (m && (m.critter || m.visualBicho)) {
    if (m.alive)
      try {
        critGL(m);
      } catch (e) {
        console.warn(e);
      }
    return;
  }
  /* v6.8 — desenho: coelho e cervo com os retratos pintados (de pé no 3D) */
  if (m && m.critter) return;
  if (m && m.bandido) {
    if (!ghost) bandidoGL(m); // v8.1: cada um com o próprio animado (bandidos_gl.ts)
    return;
  }
  if (m && m.humano) {
    if (ghost) return;
    const dx = m.x - (m._gx ?? m.x),
      dy = m.y - (m._gy ?? m.y),
      mov = Math.hypot(dx, dy),
      want = Math.atan2(dungeon.py - m.y, dungeon.px - m.x);
    m._gx = m.x;
    m._gy = m.y;
    m._yaw = m._yaw == null ? want : m._yaw + angSD(want, m._yaw) * 0.24;
    const an = cacadorAnimado(m.x, m.y, { andando: mov > 0.05 || m.st === "windup", deitado: (m.ko || 0) > 0 });
    if (an) {
      const AF = M4.ch(M4.T(m.x, 0, m.y), M4.RY(-m._yaw), M4.S(1.3));
      glPush(an.mesh, AF, m.flash! > 0.04 ? [1, 0.7, 0.55, 0.8] : null);
    }
    return;
  }
  /* v5.0 */
  if (m.dummy) {
    if (!ghost) glDummy(m);
    return;
  }
  const d = dungeon,
    sc = m.boss ? 1.65 : m.big || 0.95,
    W =
      m.kind === "javalino" && !ghost
        ? (GL3.mesh as unknown as MalhasBichos).boar || ((GL3.mesh as unknown as MalhasBichos).boar = glBuildBoar())
        : (GL3.mesh as unknown as MalhasBichos).wolf[m.boss ? 6 : (m.coat || 0) % 6];
  /* v7.7 — modelo animado do pacote craftpix (render/gl/bichos.ts); sem ele, o corpo e as pernas de antes */
  const esp = m.kind === "javalino" ? "javali" : "lobo",
    tom = esp === "lobo" ? tomPelagem(m.boss ? 6 : (m.coat || 0) % 6) : null;
  if (ghost) {
    const k = 1 - m.life! / m.max!,
      base = M4.ch(
        M4.T(m.x + Math.cos(m.ang!) * 18 * k, -k * 4, m.y + Math.sin(m.ang!) * 18 * k),
        M4.RY(-(m.ang! + Math.PI)),
        M4.S(sc),
        M4.RX(k * 1.4),
      );
    const ma = bichoAnimado(m, esp, m.x, m.y, { fixo: "parada", tom });
    glPush(ma || W.body, base, [0.25, 0.2, 0.2, k * 0.6]);
    return;
  }
  if (m._gx == null) {
    m._gx = m.x;
    m._gy = m.y;
    m._yaw = Math.atan2(d.py - m.y, d.px - m.x);
    m._ph = Math.random() * 6;
  }
  const dx = m.x - m._gx,
    dy = m.y - m._gy!,
    mv = Math.hypot(dx, dy);
  m._gx = m.x;
  m._gy = m.y;
  let want;
  if (m.st === "windup" || m.st === "leap" || m.st === "recover") want = m.ang;
  else if (mv > 0.05 && !(m.retreat! > 0)) want = Math.atan2(dy, dx);
  else want = Math.atan2(d.py - m.y, d.px - m.x);
  if (m.fleeT! > 0 && mv > 0.05) want = Math.atan2(dy, dx);
  const caido = m.ko! > 0; // v7.7: lobo/javali caído fica deitado de lado (como o coelho e o cervo) e não gira
  if (!caido) m._yaw! += angSD(want!, m._yaw!) * 0.22;
  if (mv > 0.03) m._ph! += mv * 0.3;
  const lift =
      m.st === "leap" ? Math.sin((m.lp || 0) * Math.PI) * 20 : m.hop! > 0 ? Math.sin((m.hop! / 0.3) * Math.PI) * 7 : 0,
    hk = m.hitT! > 0 ? m.hitT! : 0;
  const hox = hk ? Math.cos(m.hitAng || 0) * hk * 28 : 0,
    hoy = hk ? Math.sin(m.hitAng || 0) * hk * 28 : 0,
    shk = m.st === "windup" && m.atk === "pounce" ? (Math.random() - 0.5) * 1.6 : 0;
  const pitch = m.st === "windup" ? -0.14 : m.st === "leap" ? 0.22 : 0,
    crouch = m.st === "windup" ? -2 : 0;
  const base = M4.ch(M4.T(m.x + hox + shk, lift + crouch * sc, m.y + hoy), M4.RY(-m._yaw!), M4.S(sc), M4.RZ(pitch));
  const tint =
    m.flash! > 0.04
      ? [1, 1, 1, 0.75]
      : hk > 0
        ? [1, 0.15, 0.15, Math.min(0.55, hk * 3)]
        : m.runic
          ? runeWolfTint(m)
          : m.low === "frenzy"
            ? [1, 0.3, 0.1, 0.12 + 0.08 * Math.sin(performance.now() / 110)]
            : null;
  const ma = bichoAnimado(m, esp, m.x, m.y, { fixo: caido ? "parada" : m.st === "leap" ? "salto" : undefined, tom });
  if (ma) {
    glPush(
      ma,
      caido
        ? M4.ch(M4.T(m.x, 5 * sc, m.y), M4.RY(-m._yaw!), M4.S(sc), M4.RX(Math.cos(m._yaw!) >= 0 ? 1.45 : -1.45))
        : base,
      tint,
    );
    return;
  }
  glPush(W.body, base, tint);
  const moving = mv > 0.05 ? 1 : 0,
    sw = Math.sin(m._ph!) * 0.75 * moving;
  for (const [hx, hz, ph] of [
    [9, 3.6, 0],
    [9, -3.6, Math.PI],
    [-9, 3.6, Math.PI],
    [-9, -3.6, 0],
  ]) {
    const a = m.st === "leap" ? (hx > 0 ? 1.0 : -1.0) : ph ? -sw : sw;
    glPush(W.leg, M4.ch(base, M4.T(hx, 11, hz), M4.RZ(a)), tint);
  }
}
export function rodM(A: number[], B: number[], th: number, tz?: number) {
  // matriz que estica uma caixa unitária (y de 0 a 1) de A até B
  const dx = B[0] - A[0],
    dy = B[1] - A[1],
    dz = B[2] - A[2],
    L = Math.hypot(dx, dy, dz) || 1e-4,
    Y = [dx / L, dy / L, dz / L],
    ref = Math.abs(Y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let X = [ref[1] * Y[2] - ref[2] * Y[1], ref[2] * Y[0] - ref[0] * Y[2], ref[0] * Y[1] - ref[1] * Y[0]];
  const lx = Math.hypot(...X);
  X = X.map((v) => v / lx);
  const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]],
    m = M4.id();
  tz = tz || th;
  m[0] = X[0] * th;
  m[1] = X[1] * th;
  m[2] = X[2] * th;
  m[4] = Y[0] * L;
  m[5] = Y[1] * L;
  m[6] = Y[2] * L;
  m[8] = Z[0] * tz;
  m[9] = Z[1] * tz;
  m[10] = Z[2] * tz;
  m[12] = A[0];
  m[13] = A[1];
  m[14] = A[2];
  return m;
}
/** Braço resolvido por ik2: cotovelo (E) e mão (H). */
export interface Braco {
  E: Vec3;
  H: Vec3;
}
export function ik2(S: number[], H: number[], a: number, b: number, pole: number[]): Braco {
  // braço de 2 ossos: devolve cotovelo e mão (mão presa ao alcance)
  const dx = H[0] - S[0],
    dy = H[1] - S[1],
    dz = H[2] - S[2],
    d = Math.hypot(dx, dy, dz) || 1e-4,
    u = [dx / d, dy / d, dz / d],
    dd = Math.min(d, a + b - 0.05);
  const x = (a * a - b * b + dd * dd) / (2 * dd),
    h = Math.sqrt(Math.max(0, a * a - x * x)),
    pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
  let p = [pole[0] - u[0] * pd, pole[1] - u[1] * pd, pole[2] - u[2] * pd];
  const pl = Math.hypot(...p) || 1;
  p = p.map((v) => v / pl);
  return {
    E: [S[0] + u[0] * x + p[0] * h, S[1] + u[1] * x + p[1] * h, S[2] + u[2] * x + p[2] * h],
    H: [S[0] + u[0] * dd, S[1] + u[1] * dd, S[2] + u[2] * dd],
  };
}
export const lerp3 = (a: number[], b: number[], t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const add3 = (a: number[], b: number[]): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function glHeroPose(this: unknown, _dt?: number) {
  // dt vai por `arguments` para glHeroPoseBase
  /* v6.1.3 — a faca da mochila aparece na mão enquanto você está no modo corpo a corpo */
  const d = dungeon,
    h = d.hero;
  if (!h || d.weapon !== "melee" || d.spearOut) return glHeroPoseBase.apply(this, arguments as Repasse);
  const e = ensureEquip(h);
  if (e.maoD) return glHeroPoseBase.apply(this, arguments as Repasse);
  const k = knifeIn(h);
  if (!k) return glHeroPoseBase.apply(this, arguments as Repasse);
  e.maoD = k;
  try {
    return glHeroPoseBase.apply(this, arguments as Repasse);
  } finally {
    if (ensureEquip(h).maoD === k) e.maoD = null;
  }
}
// etapa de glHeroPose: original
function glHeroPoseBase(dt: number) {
  const d = dungeon,
    h = d.hero!,
    now = performance.now();
  const EQ = heroEq(h),
    _hk = h.color + "|" + eqSig(h);
  if (GL3.heroKey !== _hk) {
    if (GL3.hero) for (const k in GL3.hero) glFree(GL3.hero[k]);
    GL3.hero = glBuildHero(h.color, EQ);
    GL3.heroKey = _hk;
  }
  const P = GL3.hero!,
    SC = 1.3;
  if (GL3.hx == null) {
    GL3.hx = d.px;
    GL3.hy = d.py;
    GL3.hyaw = aimAngle();
    GL3.bk = 0;
    GL3.rel = 0;
  }
  const mv = Math.hypot(d.px - GL3.hx, d.py - GL3.hy);
  if (mv > 0.05 && mv < 20) GL3.mvA = Math.atan2(d.py - GL3.hy, d.px - GL3.hx);
  GL3.hx = d.px;
  GL3.hy = d.py;
  GL3.mvK = (GL3.mvK || 0) + ((mv > 0.05 ? 1 : 0) - (GL3.mvK || 0)) * Math.min(1, dt * 10);
  GL3.runK = (GL3.runK || 0) + ((d.running && mv > 0.05 ? 1 : 0) - (GL3.runK || 0)) * Math.min(1, dt * 6);
  if (mv > 0.03 && mv < 20) GL3.hph += (mv * 0.28) / (1 + 0.3 * GL3.runK);
  // golpe do combo: cada clique cria um novo d.slash → nova animação
  const sl = d.slash;
  if (sl && sl.life > 0 && sl !== GL3.lastSl) {
    GL3.lastSl = sl;
    GL3.atk = { step: sl.step == null ? 0 : sl.step, t: 0, ang: sl.ang, hit: false };
    GL3.trail.length = 0;
  }
  const A = GL3.atk;
  if (A) {
    A.t += dt;
    if (GL3.fz != null) A.t = GL3.fz;
    if (A.t > 0.38) GL3.atk = null;
  }
  const want = A ? A.ang : heroFaceAngle();
  GL3.hyaw += angSD(want, GL3.hyaw) * Math.min(1, dt * (A ? 30 : d.charging ? 22 : 14));
  // v7.7: montada, a heroína fica sentada (sem o passo, o balanço e a inclinação da corrida); quem anda é o tamanduá
  const montada = !!(d.mount && d.mount.mounted),
    moving = montada ? 0 : GL3.mvK,
    rk = montada ? 0 : GL3.runK,
    sw = Math.sin(GL3.hph) * (0.55 + 0.4 * rk) * moving,
    bob = Math.abs(Math.cos(GL3.hph)) * (1.1 + 1.4 * rk) * moving;
  // pose do combo (0: da direita p/ esquerda · 1: de volta · 2: finalizador de cima p/ baixo com pulinho)
  const comboPose = (step: number, t: number) => {
    // pose do golpe no instante t (usada também para desenhar o rastro sem depender do FPS)
    const q = { tw: 0, lean: d.guard ? -0.1 : 0, lift: 0, armY: 0, armZ: 0.35 + sw * 0.85, fwd: 0, wr: 0, p: 0 };
    const p = Math.min(1, t / (step === 2 ? 0.2 : 0.16)),
      e = 1 - Math.pow(1 - p, 3),
      r = Math.max(0, Math.min(1, (t - 0.22) / 0.16)),
      w = 1 - r * r * (3 - 2 * r);
    q.p = p;
    let tY, tZ, tT, tL, tW;
    if (step === 0) {
      tY = -1.7 + 3.3 * e;
      tZ = 1.5;
      tT = -0.55 + 1.05 * e;
      tL = -0.14 * e;
      tW = -1.3;
    } else if (step === 1) {
      tY = 1.6 - 3.3 * e;
      tZ = 1.4;
      tT = 0.5 - 1.05 * e;
      tL = -0.14 * e;
      tW = -1.25;
    } else {
      tY = -0.12;
      tZ = 3.0 - 2.3 * e;
      tT = -0.2 + 0.3 * e;
      tL = 0.12 - 0.42 * e;
      tW = -1.45;
      q.lift = Math.sin(p * Math.PI) * 4 * w;
      q.fwd = 3 * e * w;
    }
    q.armY = tY * w;
    q.armZ += (tZ - q.armZ) * w;
    q.tw = tT * w;
    q.lean += (tL - q.lean) * w;
    q.wr = tW * w;
    return q;
  };
  let tw = Math.sin(GL3.hph) * (0.1 + 0.08 * rk) * moving,
    lean = (d.guard ? -0.1 : 0) + 0.05 * moving + 0.17 * rk,
    lift = 0,
    armY = 0,
    armZ = 0.35 + sw * 0.85,
    fwd = 0,
    wr = 0;
  if (A && d.weapon !== "bow") {
    const q = comboPose(A.step, A.t);
    ({ tw, lean, lift, armY, armZ, fwd, wr } = q);
    if (A.step === 2 && q.p >= 1 && !A.hit) {
      A.hit = true;
      addRing(d.px + Math.cos(A.ang) * 26, d.py + Math.sin(A.ang) * 26, "#e8d6a8", 26, 0.32, 3);
    }
  }
  {
    const _sp = spearPoseOv(A, sw);
    if (_sp) ({ tw, lean, lift, armY, armZ, fwd, wr } = _sp);
  }
  // arco: blend da pose de mira (k) + soltura (rel)
  if (d.weapon === "bow") {
    if (GL3.wasCh && !d.charging && d.shotT! > now - 120) GL3.rel = 0.3;
    GL3.wasCh = d.charging;
    if (GL3.rel > 0) GL3.rel = Math.max(0, GL3.rel - dt);
  } else {
    GL3.wasCh = false;
    GL3.rel = 0;
  }
  const bkT = d.weapon === "bow" && (d.charging || GL3.rel > 0) ? 1 : 0;
  GL3.bk += (bkT - GL3.bk) * Math.min(1, dt * (bkT ? 16 : 7));
  const k = GL3.bk;
  if (d.weapon === "bow") {
    tw = -1.05 * k;
    lean = 0.05 * k;
  }
  const _mtd = d.mount && d.mount.mounted,
    AF = M4.ch(
      M4.T(
        d.px + Math.cos(GL3.hyaw) * fwd,
        (_mtd ? alturaMontada() + Math.abs(Math.cos(d.mount!.ph)) * 1.2 : bob) + lift,
        d.py + Math.sin(GL3.hyaw) * fwd,
      ),
      M4.RY(-GL3.hyaw),
      M4.S(SC),
    );
  const BL = M4.ch(
      M4.T(0, 15, 0),
      M4.RY(tw),
      M4.RZ(lean),
      M4.RX(Math.cos(GL3.hph) * (0.045 + 0.03 * rk) * moving),
      M4.T(0, -15, 0),
    ),
    body = M4.mul(AF, BL);
  const tint =
    d.hurtFlash! > 0
      ? [1, 0.12, 0.12, Math.min(0.7, (d.hurtFlash! / 0.45) * 0.75)]
      : d.dead
        ? [0.2, 0.2, 0.2, 0.5]
        : null;
  /* v7.7 — heroína animada (esqueleto): parada, andar, correr, coletar, cambalhota, queda, arco (sacar, mirar,
     andar mirando, soltar), estocada da lança e defesa com escudo. Golpe de espada/machado/clava, carga e empurrão da
     lança e montaria ainda usam a heroína de peças, logo abaixo. */
  {
    const rolando = !!(d.dodge && d.dodge.roll),
      lanca = spearMode(),
      arco = d.weapon === "bow";
    // v7.7: o combo de espada/machado/clava agora é animado (COMBO em animado.ts); só a carga/empurrão da lança e a
    // montaria continuam na heroína de peças
    // v7.7: montada também é a heroína animada (só da cintura para cima aparece: a cintura fica no alto da carga, as
    // pernas dentro do tamanduá) — provisório até o esqueleto sentado do rig (o mantenedor vai trazer)
    // v8.0: a mira do arremesso (d.spCh) também é animada (andar/parada + braços em IK, MIRA_LANCA em animado.ts)
    const combate = lanca && d.shove! > 0,
      derrubada = d.down! > 0 && (d.derrubada || 0) > 0 && d.derrubadaDe != null;
    const wk = wpnKey(dungeon.hero!) || "";
    vestirComoHeroi(h.visual, h.id, ensureEquip(h)); // aparência e vestes pelo item equipado
    const yaw = rolando ? Math.atan2(d.dodge!.dy, d.dodge!.dx) : derrubada ? d.derrubadaDe! : GL3.hyaw,
      altura = _mtd ? alturaMontadaAnim() + Math.abs(Math.cos(d.mount!.ph)) * 1.2 : 0,
      AFa = M4.ch(M4.T(d.px, altura, d.py), M4.RY(-yaw), M4.S(SC));
    if (rolando || derrubada) GL3.hyaw = yaw;
    let cravM: Mat4 | null = null;
    const an = combate
      ? null
      : heroinaAnimada(
          {
            dt,
            andou: mv < 20 ? mv : 0,
            correndo: rk,
            movendo: moving,
            rolando,
            debilitado: (d.debilitadoT || 0) > 0 && moving > 0.5,
            morto: !!d.dead,
            // v8.0: de perto (a câmera de frente, CZ.perto) ela relaxa na parada simples, sem a guarda de combate
            modo: arco ? "arco" : CZ.perto > 0.3 ? "" : /faca/.test(wk) ? "faca" : d.target?.alive ? "combate" : "",
            carga: arco && d.charging ? Math.min(1, d.charge || 0) : 0,
            mirando: arco && !!d.charging,
            soltando: arco && GL3.rel > 0,
            dirMov: -angSD(GL3.mvA ?? GL3.hyaw, GL3.hyaw),
            golpe: d.crav ? 0.14 : lanca && A ? A.t : null,
            combo: A && !d.crav && !lanca && !arco ? { passo: A.step, t: A.t } : null,
            machadoCarga: d.hv?.kind === "axe" ? d.hv.ch : null,
            machadoGolpe: d.golpeMachado ? Math.min(1, d.golpeMachado.t / 0.46) : null,
            guarda: !!d.guard && !arco && !lanca,
            aparo: !arco && !lanca ? d.parryT : null,
            aparoPerfeito: !arco && !lanca && d._parryEm ? (performance.now() - d._parryEm) / 1000 : null,
            // v7.7: reações — hurtFlash começa em 0,45 s quando ela leva dano (hurtPlayerBase); _blqEm = quando o escudo segurou
            atingido: d.hurtFlash! > 0 && !d.dead ? 0.45 - d.hurtFlash! : null,
            bloqueou: d._blqEm ? (performance.now() - d._blqEm) / 1000 : null,
            miraLanca: lanca && d.spCh ? d.spCh.ch : null,
            derrubada: derrubada ? { t: d.derrubada! - d.down!, dur: d.derrubada! } : null,
          },
          d.crav
            ? (mat) => {
                const palma = M4.mul(AFa, presoEm(mat, "palmaD"));
                cravM = armaCravadaMatriz(SC, [palma[12], palma[13], palma[14]]);
                if (!cravM) return null;
                const local = M4.ch(M4.S(1 / SC), M4.RY(yaw), M4.T(-d.px, -altura, -d.py), cravM);
                return { arma: local, duasMaos: lanca };
              }
            : undefined,
        );
    if (an) {
      glPush(an.mesh, AFa, tint);
      if (an.roupaPernas) glPush(an.roupaPernas, AFa, tint);
      if (an.roupaPes) glPush(an.roupaPes, AFa, tint);
      if (an.roupaPeito) glPush(an.roupaPeito, AFa, tint);
      if (arco) {
        const bowM = M4.mul(AFa, presoEm(an.mat, "arco")),
          ak = arcoDaHeroina();
        glPush(armaModelo(ak) ?? P.bowOnly, bowM, tint);
        if (EQ.maoE) glPush(P.shieldBack, M4.ch(AFa, presoEm(an.mat, "costas"), escudoNasCostas()), tint);
        // corda: das pontas do arco até a mão direita (puxando) ou reta (parado); flecha encaixada ao puxar
        const [pc, pb] = pontasArco(ak) ?? PONTAS_ANTIGAS,
          tipT = M4.ap(bowM, pc[0], pc[1], 0),
          tipB = M4.ap(bowM, pb[0], pb[1], 0),
          puxando = !!d.charging;
        const pm = M4.mul(AFa, presoEm(an.mat, "palmaD")),
          palma: Vec3 = [pm[12], pm[13], pm[14]];
        if (puxando) {
          glPush(P.rodStr, rodM(tipT, palma, 0.45 * SC));
          glPush(P.rodStr, rodM(tipB, palma, 0.45 * SC));
          // A flecha segue a mira do personagem (+x local), não a rotação do pulso que
          // segura o arco; o punho pode girar durante a animação sem desviar o disparo.
          const eixo: Vec3 = [AFa[0], AFa[1], AFa[2]],
            L = Math.hypot(...eixo) || 1,
            u: Vec3 = [eixo[0] / L, eixo[1] / L, eixo[2] / L],
            ponta: Vec3 = add3(palma, [u[0] * 27 * SC, u[1] * 27 * SC, u[2] * 27 * SC]);
          glPush(P.rodWood, rodM(palma, ponta, 0.8 * SC));
          glPush(P.arrowHead, rodM(ponta, add3(ponta, [u[0] * 3.5 * SC, u[1] * 3.5 * SC, u[2] * 3.5 * SC]), 1.8 * SC));
          glPush(
            P.fletch,
            rodM(
              add3(palma, [u[0] * 0.6, u[1] * 0.6, u[2] * 0.6]),
              add3(palma, [u[0] * 4.5 * SC, u[1] * 4.5 * SC, u[2] * 4.5 * SC]),
              2.6 * SC,
              0.3 * SC,
            ),
          );
        } else glPush(P.rodStr, rodM(tipT, tipB, 0.45 * SC));
      } else {
        if (EQ.maoD) {
          // v7.7: na estocada a lança passa pelas duas mãos (entra em 0,05 s, sai nos últimos 0,08 s do golpe)
          const ss = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)),
            wl = lanca && A ? ss(A.t / 0.05) * (1 - ss((A.t - 0.3) / 0.08)) : 0;
          const palma = M4.mul(AFa, presoEm(an.mat, "palmaD")),
            WM = cravM ?? M4.mul(AFa, lanca && d.spCh ? lancaNaMira(an.mat) : lancaDuasMaos(an.mat, wl));
          glPush(wpnMesh(dungeon.hero!, P), WM, tint);
          // v8.0: o punho fechado em volta do cabo (o esqueleto não tem dedos)
          const pu = lanca ? punhoLanca() : null;
          if (pu) {
            const pegada = d.crav ? Float32Array.from(WM) : WM;
            if (d.crav) {
              pegada[12] = palma[12];
              pegada[13] = palma[13];
              pegada[14] = palma[14];
            }
            glPush(pu, pegada, tint);
          }
        }
        if (EQ.maoE) glPush(P.escudo, M4.ch(AFa, presoEm(an.mat, "escudo"), escudoNoBraco()), tint);
        if (EQ.costas) {
          const ak = arcoDaHeroina();
          glPush(
            armaModelo(ak) ?? P.bowOnly,
            M4.ch(AFa, presoEm(an.mat, "costas"), arcoNasCostas(undefined, ak)),
            tint,
          );
        }
      }
      GL3.trail.length = 0;
      // v7.7: rastro do combo animado: amostra o clip nos últimos ~0,1 s (como o comboPose da heroína de peças)
      if (A && !lanca && !arco && EQ.maoD && A.t < 0.32 && !GL3.noTrail) {
        const fade = A.t < 0.2 ? 1 : Math.max(0, 1 - (A.t - 0.2) / 0.12),
          N = 10;
        for (let i = 0; i <= N; i++) {
          const W = armaNoCombo(A.step, Math.max(0, A.t - 0.1 + (0.1 * i) / N));
          if (!W) break;
          const sq = M4.mul(AFa, W);
          GL3.trail.push({ b: M4.ap(sq, 5, 0, 0), p: M4.ap(sq, 21.5, 0, 0), a: fade * (i / N), fin: A.step === 2 });
        }
      }
      return;
    }
  }
  glPush(P.torsoH, body, tint); // v7.7: heroína
  const ls = A && A.step === 2 ? 0.35 * Math.sin(Math.min(1, A.t / 0.2) * Math.PI) : 0;
  const _kl = (0.9 + 1.6 * rk) * moving;
  if (montada) {
    // v7.7: sentada na sela, uma perna de cada lado do corpo do tamanduá, um pouco para a frente
    glPush(P.pernaD, M4.ch(AF, M4.T(0, 15, 2.8), M4.RX(MONTADA.abre), M4.RZ(MONTADA.frente)), tint);
    glPush(P.pernaE, M4.ch(AF, M4.T(0, 15, -2.8), M4.RX(-MONTADA.abre), M4.RZ(MONTADA.frente)), tint);
  } else {
    glPush(P.pernaD, M4.ch(AF, M4.T(0, 15 + Math.max(0, Math.sin(GL3.hph)) * _kl, 2.8), M4.RZ(sw + ls)), tint);
    glPush(P.pernaE, M4.ch(AF, M4.T(0, 15 + Math.max(0, -Math.sin(GL3.hph)) * _kl, -2.8), M4.RZ(-sw - ls * 0.6)), tint);
  }
  const { ombroY: OY, ombroZ: OZ, mao: MAO } = HEROINA;
  if (spearTwoHand(d, A, AF, BL, P, EQ, tint, sw)) {
    /* v5.8: lança com as duas mãos */
  } else if (d.weapon === "bow") {
    if (EQ.maoE) glPush(P.shieldBack, body, tint);
    const L = M4.ap(BL, 0, OY, -OZ),
      R = M4.ap(BL, 0, OY, OZ),
      W2 = (q: number[]) => M4.ap(AF, q[0], q[1], q[2]);
    const Hd = [L[0] + 11.5, 29.5, -1.2],
      Hi = [4 + sw * 2.5, 17, -9.5],
      ch = d.charging ? d.charge || 0 : 1,
      e = 1 - Math.pow(1 - ch, 2);
    let H = lerp3(Hi, Hd, k);
    if (d.charging && ch >= 1) H = add3(H, [(Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, 0]);
    if (GL3.rel > 0) H = add3(H, [(-1.6 * GL3.rel) / 0.3, (0.4 * GL3.rel) / 0.3, 0]);
    const N0 = add3(H, [-3, 0, 0]),
      N1 = [1.5, 31, 0.2],
      Ri = [1 - sw * 2.5, 16, 9.5];
    let Rh, N;
    if (d.charging) {
      N = lerp3(N0, N1, e);
      Rh = lerp3(Ri, N, k);
    } else if (GL3.rel > 0) {
      const q = (0.3 - GL3.rel) / 0.3;
      N = add3(N0, [-2.4 * Math.sin(q * 26) * (1 - q), 0, 0]);
      Rh = lerp3(add3(N1, [-5, 1.5, 2.5]), Ri, Math.max(0, (q - 0.35) / 0.65));
    } else {
      N = N0;
      Rh = lerp3(Ri, N0, 0);
    }
    const lA = ik2(L, H, 6.5, 6.8, [0, -1, -0.4]),
      rA = ik2(R, Rh, 6.5, 6.8, [-0.7, 0.15, 1]);
    for (const [S, J] of [
      [L, lA],
      [R, rA],
    ] as [Vec3, Braco][]) {
      glPush(P.rodAr, rodM(W2(S), W2(J.E), 3.9 * SC), tint);
      glPush(P.rodAr, rodM(W2(J.E), W2(J.H), 3.5 * SC), tint);
      glPush(P.fist, M4.ch(M4.T(...W2(J.H)), M4.RY(-GL3.hyaw), M4.S(4.6 * SC)), tint);
    }
    glPush(
      armaModelo(arcoDaHeroina()) ?? P.bowOnly,
      M4.ch(AF, M4.T(lA.H[0] + 0.6, lA.H[1], lA.H[2]), M4.RZ(-0.3 * (1 - k)), M4.RX(0.1 * k)),
      tint,
    );
    const [pc, pb] = pontasArco(arcoDaHeroina()) ?? PONTAS_ANTIGAS,
      tipT = W2(add3(lA.H, [pc[0] + 0.6, pc[1], 0])),
      tipB = W2(add3(lA.H, [pb[0] + 0.6, pb[1], 0])),
      Nw = W2(d.charging ? rA.H : N);
    glPush(P.rodStr, rodM(tipT, Nw, 0.45 * SC));
    glPush(P.rodStr, rodM(tipB, Nw, 0.45 * SC));
    if (d.charging) {
      // flecha encaixada
      const tail = rA.H,
        tip = add3(rA.H, [27, 0, 0]);
      glPush(P.rodWood, rodM(W2(tail), W2(tip), 0.8 * SC));
      glPush(P.arrowHead, rodM(W2(tip), W2(add3(tip, [3.5, 0, 0])), 1.8 * SC));
      glPush(P.fletch, rodM(W2(add3(tail, [0.6, 0, 0])), W2(add3(tail, [4.5, 0, 0])), 2.6 * SC, 0.3 * SC));
    }
  } else {
    const shR = M4.ch(body, M4.T(0, OY, OZ)),
      shL = M4.ch(body, M4.T(0, OY, -OZ)),
      armR = M4.ch(shR, M4.RY(armY), M4.RZ(armZ));
    const swM = M4.ch(armR, M4.T(...MAO), M4.RZ(wr));
    glPush(P.bracoD, armR, tint);
    if (EQ.maoD) glPush(wpnMesh(dungeon.hero!, P), armaCravadaMatriz(SC, [swM[12], swM[13], swM[14]]) ?? swM, tint);
    if (EQ.costas) glPush(P.bowOnly, M4.ch(body, M4.T(-6.4, 24, 0), M4.RX(0.55), M4.S(0.85)), tint);
    const armL = d.guard ? M4.ch(shL, M4.RY(-1.25), M4.RZ(1.05)) : M4.ch(shL, M4.RZ(0.2 - sw * 0.9 + (A ? -0.25 : 0)));
    glPush(P.bracoE, armL, tint);
    if (EQ.maoE) glPush(P.escudo, armL, tint);
  }
  GL3.trail.length = 0;
  if (A && d.weapon !== "bow" && A.t < 0.32 && !GL3.noTrail) {
    // rastro: amostra a própria animação nos últimos ~0,1 s
    const fade = A.t < 0.2 ? 1 : Math.max(0, 1 - (A.t - 0.2) / 0.12),
      N = 10;
    for (let i = 0; i <= N; i++) {
      const tt = Math.max(0, A.t - 0.1 + (0.1 * i) / N),
        q = comboPose(A.step, Math.min(tt, 0.2));
      const AFq = M4.ch(
        M4.T(d.px + Math.cos(GL3.hyaw) * q.fwd, bob + q.lift, d.py + Math.sin(GL3.hyaw) * q.fwd),
        M4.RY(-GL3.hyaw),
        M4.S(SC),
      );
      const bq = M4.ch(AFq, M4.T(0, 15, 0), M4.RY(q.tw), M4.RZ(q.lean), M4.T(0, -15, 0)),
        sq = M4.ch(bq, M4.T(0, OY, OZ), M4.RY(q.armY), M4.RZ(q.armZ), M4.T(...MAO), M4.RZ(q.wr));
      GL3.trail.push({ b: M4.ap(sq, 5, 0, 0), p: M4.ap(sq, 21.5, 0, 0), a: fade * (i / N), fin: A.step === 2 });
    }
  }
}
export function glRender(
  VP: Mat4,
  LV: Mat4,
  Ld: number[],
  clear: number[],
  fog: { cam: number[]; col: number[]; near: number; far: number } | null,
  noite = [1, 1, 1],
  fogo: { pos: number[]; cor: number[] } | null = null,
) {
  // sombra (shadow map) + cena com a lista GL3.list; `noite` (v8.0) = o fator de cor da hora, só no campo; `fogo`
  // (v8.0) = a luz das fogueiras (luzFogueira): até 4 × (x, y, z, raio) e a cor × força
  const gl = GL3.gl;
  glShadowPass(LV); // v5.7: sombra estática em cache
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, GL3.cv.width, GL3.cv.height);
  gl.clearColor(clear[0] * noite[0], clear[1] * noite[1], clear[2] * noite[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(GL3.prog);
  gl.uniformMatrix4fv(GL3.U.uVP, false, VP);
  gl.uniformMatrix4fv(GL3.U.uL, false, LV);
  gl.uniform3fv(GL3.U.uLd, Ld);
  gl.uniform3fv(GL3.U.uCam, fog ? fog.cam : [0, 0, 0]);
  // v8.1 — a linha w de VP: na ortográfica (0, 0, 0, 1); na perspectiva, −(o eixo z da câmera), um vetor unitário.
  // Só VP[11] (o z dela) falhava com a câmera olhando ao longo de x (o palco da criação, a mochila): virava
  // "ortográfica", o brilho de borda usava a direção da câmera do campo e acendia toda face voltada para a câmera —
  // a personagem inteira lavada de bege
  const wl = [VP[3], VP[7], VP[11]],
    wn = Math.hypot(wl[0], wl[1], wl[2]),
    _persp = wn > 0.5;
  // a direção da câmera (o brilho de borda): na perspectiva, a da câmera de perto do campo (VISTA.vd) ou a da própria
  // matriz (do alvo para o olho); com a fixa da cinemática, a câmera de perto clareava tudo
  gl.uniform4fv(
    GL3.U.uVD,
    fog ? [0, 0, 0, 0] : _persp ? (VISTA.vd ?? [-wl[0] / wn, -wl[1] / wn, -wl[2] / wn, 1]) : [0, D3.SIN!, D3.COS!, 1],
  );
  gl.uniform3fv(GL3.U.uFogC, fog ? fog.col : [0, 0, 0]);
  gl.uniform2fv(GL3.U.uFog, fog ? [fog.near, fog.far] : [0, 0]);
  gl.uniform3fv(GL3.U.uNoite, noite);
  const pf = new Float32Array(16);
  if (fogo) pf.set(fogo.pos.slice(0, 16));
  gl.uniform4fv(GL3.U.uFogos, pf);
  gl.uniform3fv(GL3.U.uFogoC, fogo ? fogo.cor : [0, 0, 0]);
  let brilha = false;
  gl.uniform1f(GL3.U.uBrilha, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, GL3.stex);
  gl.uniform1i(GL3.U.uS, 0);
  gl.uniform1i(GL3.U.uTex, 1); // v8.0: textura de cor na unidade 1 (só as malhas com `tex`)
  gl.uniform1f(GL3.U.uUsaTex, 0);
  let texAtual: WebGLTexture | null = null;
  for (const it of GL3.list) {
    gl.uniformMatrix4fv(GL3.U.uM, false, it.M);
    gl.uniform4fv(GL3.U.uTint, it.tint || [0, 0, 0, 0]);
    if (!!it.brilha !== brilha) {
      brilha = !!it.brilha;
      gl.uniform1f(GL3.U.uBrilha, brilha ? 1 : 0);
    }
    const tx = it.mesh.tex ?? null;
    if (tx !== texAtual) {
      if (tx) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.activeTexture(gl.TEXTURE0);
      }
      if (!tx !== !texAtual) gl.uniform1f(GL3.U.uUsaTex, tx ? 1 : 0);
      texAtual = tx;
    }
    gl.bindVertexArray(it.mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, it.mesh.n);
  }
  gl.bindVertexArray(null);
  if (OPT.outline !== false)
    glOutlinePass(VP, (fog ? 0.55 : _persp ? 0.42 : 0.85) * CONTORNO.esp, fog ? 0.0008 : _persp ? 0.0005 : 0.004);
}
function glTrail(VP: Mat4) {
  // rastro da espada (faixa translúcida que some rápido)
  const gl = GL3.gl,
    tr = GL3.trail;
  if (tr.length < 2) return;
  const P = [],
    C = [];
  for (let i = 0; i < tr.length - 1; i++) {
    const a = tr[i],
      b = tr[i + 1],
      fa = a.a,
      fb = b.a,
      col = a.fin ? [1, 0.86, 0.45] : [1, 0.97, 0.88];
    const quad: [Vec3, number][] = [
      [a.b, fa * 0.1],
      [a.p, fa * 0.6],
      [b.p, fb * 0.6],
      [a.b, fa * 0.1],
      [b.p, fb * 0.6],
      [b.b, fb * 0.1],
    ];
    for (const [v, al] of quad) {
      P.push(v[0], v[1], v[2]);
      C.push(col[0], col[1], col[2], al);
    }
  }
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
/** v8.1 — as fitas das deusas. `perfil` = o tronco do corpo das deusas medido na malha (vestidos.json, altura 45, frente
 *  +x): [y, frente, trás, lado]; `enrolar` = [y inicial, y final, voltas, meia largura, folga da pele] (peito, quadril);
 *  `pontas` = de onde a onde caem as pontas na frente e atrás (`folga` = a delas); `alfa` = o miolo da fita (bordas ×
 *  `borda`). */
const NEVOA_DEUSA = {
  perfil: [
    [19.8, 3.0, -2.1, 5.2],
    [20.7, 3.1, -2.2, 5.6],
    [21.6, 3.1, -2.6, 5.6],
    [22.5, 3.0, -3.4, 5.7],
    [23.4, 2.9, -3.7, 5.5],
    [24.3, 3.2, -3.85, 5.4],
    [25.2, 3.25, -3.8, 5.1],
    [26.1, 3.1, -3.6, 4.7],
    [27.0, 3.25, -2.85, 4.2],
    [27.9, 3.25, -2.1, 3.8],
    [28.8, 3.1, -1.0, 3.2],
    [29.7, 3.2, -0.8, 2.6],
    [30.6, 3.85, -1.2, 2.7],
    [31.5, 4.0, -1.7, 3.3],
    [32.4, 4.3, -2.0, 3.6],
    [33.3, 4.3, -2.2, 3.65],
    [34.2, 4.0, -2.45, 3.8],
  ],
  // cada volta sobe menos que o miolo da fita (fileiras ±0,6): as voltas se sobrepõem e cobrem sem fresta
  enrolar: [
    [30.4, 34.6, 3.5, 1.3, 0.45],
    [21.0, 27.0, 4.5, 1.3, 0.4],
  ],
  pontas: [21.5, 13],
  larguraPonta: 1.5,
  folga: 0.45,
  alfa: 0.5, // 2026-11-06: era 0,75 (as voltas sobrepostas ficavam opacas e escondiam a personagem)
  borda: 0.35,
  giro: 0.25,
  onda: 0.15,
};
/** O contorno medido do tronco, na pose do quadro (mantenedor 2026-10-31: com a elipse, e depois com o contorno do
 *  repouso, a fita entrava nos seios — na guarda o seio do lado do escudo vem junto com o braço): os vértices já
 *  deformados voltam ao espaço da junta da fita (a inversa da pele dela) e, para cada fatia de y (`passo`) e cada um dos
 *  `angulos` em volta do centro do perfil, fica o raio do mais afastado, sem os braços; depois o máximo com as fatias e
 *  ângulos vizinhos, para a fita não cortar entre duas amostras. `margem` = quanto além da faixa os vértices entram. */
const CONTORNO_DEUSA = { passo: 0.5, angulos: 64, margem: 2.5 };
interface ContornoDeusa {
  R: Float32Array;
  y0: number;
  ny: number;
}
/** Os vértices do tronco (sem os braços) com o y do repouso perto da faixa [y0, y1]: uma lista por corpo e faixa. */
const CANDIDATOS_DEUSA = new WeakMap<Anim, Map<string, Int32Array>>();
function candidatosDeusa(A: Anim, y0: number, y1: number) {
  let porFaixa = CANDIDATOS_DEUSA.get(A);
  if (!porFaixa) CANDIDATOS_DEUSA.set(A, (porFaixa = new Map()));
  const chave = y0 + "|" + y1;
  let L = porFaixa.get(chave);
  if (L) return L;
  // os seios pesam no ombro e no braço: os vértices do braço entram com sinal negativo (−v − 1) e só contam na frente
  // do tronco (contornoDeusa); a mão e o antebraço nunca
  const braco = A.juntas.map((n) => (/ForeArm|Hand/.test(n) ? 2 : /Arm/.test(n) ? 1 : 0)),
    m = CONTORNO_DEUSA.margem,
    l: number[] = [];
  for (let v = 0; v < A.P.length / 3; v++) {
    const y = A.P[v * 3 + 1];
    if (y < y0 - m || y > y1 + m) continue;
    let jm = 0;
    for (let k = 1; k < 4; k++) if (A.W[v * 4 + k] > A.W[v * 4 + jm]) jm = k;
    const b = braco[A.J[v * 4 + jm]];
    if (b < 2) l.push(b ? -v - 1 : v);
  }
  porFaixa.set(chave, (L = Int32Array.from(l)));
  return L;
}
/** O contorno da faixa [y0, y1] de `A` na pose: `V` = os vértices deformados (espaço do modelo), `S` = a pele da junta
 *  em que a fita está presa. */
function contornoDeusa(A: Anim, V: Float32Array, S: Float32Array, y0: number, y1: number): ContornoDeusa {
  const { passo, angulos: na, margem } = CONTORNO_DEUSA,
    ya = y0 - margem,
    ny = Math.round((y1 - y0 + 2 * margem) / passo) + 1,
    bruto = new Float32Array(ny * na);
  // a inversa da parte 3×3 (colunas a b c / d e f / g h i) e a translação
  const [a, b, c] = [S[0], S[1], S[2]],
    [d, e, f] = [S[4], S[5], S[6]],
    [g, h, i] = [S[8], S[9], S[10]],
    det = a * (e * i - h * f) - d * (b * i - h * c) + g * (b * f - e * c),
    q = det ? 1 / det : 0,
    inv = [
      e * i - h * f,
      g * f - d * i,
      d * h - g * e,
      h * c - b * i,
      a * i - g * c,
      g * b - a * h,
      b * f - e * c,
      d * c - a * f,
      a * e - d * b,
    ];
  for (const cv of candidatosDeusa(A, y0, y1)) {
    const v = cv < 0 ? -cv - 1 : cv,
      px = V[v * 3] - S[12],
      py = V[v * 3 + 1] - S[13],
      pz = V[v * 3 + 2] - S[14],
      y = (inv[3] * px + inv[4] * py + inv[5] * pz) * q,
      iy = Math.round((y - ya) / passo);
    if (iy < 0 || iy >= ny) continue;
    const x = (inv[0] * px + inv[1] * py + inv[2] * pz) * q - centroDeusa(y),
      z = (inv[6] * px + inv[7] * py + inv[8] * pz) * q;
    if (cv < 0 && x < Math.abs(z) * 0.8) continue; // do braço: só o que está na frente (o seio), não o braço ao lado
    const ia = (Math.round((Math.atan2(z, x) / (Math.PI * 2)) * na) + na) % na,
      o = iy * na + ia;
    bruto[o] = Math.max(bruto[o], Math.hypot(x, z));
  }
  const R = new Float32Array(ny * na);
  for (let iy = 0; iy < ny; iy++)
    for (let ia = 0; ia < na; ia++) {
      let r = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let da = -2; da <= 2; da++) {
          const yy = iy + dy;
          if (yy >= 0 && yy < ny) r = Math.max(r, bruto[yy * na + ((ia + da + na) % na)]);
        }
      R[iy * na + ia] = r;
    }
  return { R, y0: ya, ny };
}
/** O centro (x) do tronco na altura y: o meio entre frente e trás do perfil medido. */
function centroDeusa(y: number) {
  const T = NEVOA_DEUSA.perfil;
  let i = 0;
  while (i < T.length - 2 && T[i + 1][0] < y) i++;
  const k = Math.min(1, Math.max(0, (y - T[i][0]) / (T[i + 1][0] - T[i][0]))),
    fr = T[i][1] + (T[i + 1][1] - T[i][1]) * k,
    tr = T[i][2] + (T[i + 1][2] - T[i][2]) * k;
  return (fr + tr) / 2;
}
/** Ponto no contorno do tronco da deusa na altura y (espaço da malha em repouso), no ângulo `ang` (0 = frente), a
 *  `folga` da pele: o contorno medido `C` (interpolado em y e no ângulo). */
function anelDeusa(C: ContornoDeusa, y: number, ang: number, folga: number): [number, number, number] {
  const { R, y0, ny } = C,
    { passo, angulos: na } = CONTORNO_DEUSA,
    fy = Math.max(0, (y - y0) / passo),
    iy = Math.min(Math.floor(fy), ny - 2),
    ky = Math.min(1, fy - iy),
    fa = ((((ang / (Math.PI * 2)) * na) % na) + na) % na,
    ia = Math.floor(fa),
    ka = fa - ia,
    em = (yy: number, aa: number) => R[yy * na + (aa % na)],
    r =
      (em(iy, ia) * (1 - ka) + em(iy, ia + 1) * ka) * (1 - ky) +
      (em(iy + 1, ia) * (1 - ka) + em(iy + 1, ia + 1) * ka) * ky;
  return [centroDeusa(y) + Math.cos(ang) * (r + folga), y, Math.sin(ang) * (r + folga)];
}
/** Névoa mágica das deusas: fitas leves em alfa, desenhadas por cima da cena sem alterar a pele/malha. */
function glNevoaDeusa(VP: Mat4) {
  const d = dungeon,
    h = d.hero,
    roupa = VESTIDO.atual || "",
    visualDeusa =
      h?.visual?.corpo.startsWith("deusa_") ||
      h?.visual?.cabeca.startsWith("deusa_") ||
      /^deusa_(primavera|verao|outono|inverno)$/.test(roupa);
  if (!h || !visualDeusa || !GL3.gl || !GL3.tprog || !GL3.tvao || !GL3.tb) return;

  const gl = GL3.gl,
    agora = performance.now() / 1000,
    yaw = -GL3.hyaw,
    cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    P: number[] = [],
    C: number[] = [],
    sazonal = roupa || (h.visual?.corpo.startsWith("deusa_") ? h.visual.corpo : h.visual?.cabeca) || "deusa_outono",
    // as cores das estações (inverno azul-gelo, verão dourado, primavera rosa-cerejeira, outono vermelho-cobre), longe
    // do tom da pele para a fita aparecer em cima do corpo
    cor: [number, number, number] = sazonal.includes("inverno")
      ? [0.72, 0.87, 1]
      : sazonal.includes("verao")
        ? [1, 0.84, 0.3]
        : sazonal.includes("primavera")
          ? [1, 0.58, 0.76]
          : [0.8, 0.16, 0.08];

  // Em espaço local da personagem; a escala e o giro coincidem com a malha animada.
  // No campo aberto sobe com o relevo, como a personagem (erguerNoRelevo).
  const canto = cantoCampo(),
    chao = canto ? alturaChao(d.px + canto.x, d.py + canto.y) : 0;
  const ponto = (x: number, y: number, z: number): [number, number, number] => [
    d.px + (x * cy - z * sy) * 1.3,
    chao + y * 1.3,
    d.py + (x * sy + z * cy) * 1.3,
  ];
  const vert = (p: [number, number, number], a: number, brilho: number) => {
    P.push(...p);
    C.push(Math.min(1, cor[0] * brilho), Math.min(1, cor[1] * brilho), Math.min(1, cor[2] * brilho), a);
  };

  // Fitas que cobrem (mantenedor 2026-10-31): enroladas rente ao corpo no peito e no quadril (pelve e bumbum), mais as
  // pontas que caem na frente e atrás. Cada fita tem 4 fileiras (borda, miolo, miolo, borda): o miolo cobre, as bordas
  // esfumam.
  // presas às juntas da pose ao vivo (Spine2 no peito, Hips no quadril): sobem, descem e giram com o corpo
  // Só cobrem o corpo da deusa (pele nua); com a cabeça de deusa num corpo vestido ficam só os véus soltos
  // (mantenedor, 2026-11-06: a aura escondia a personagem).
  const corpoDeusa = h.visual?.corpo.startsWith("deusa_") || /^deusa_(primavera|verao|outono|inverno)$/.test(roupa);
  const N = NEVOA_DEUSA,
    corpo = corpoDeusa ? corpoDaHeroina() : null,
    peito = corpo && peleNaJunta("Spine2"),
    quadril = corpo && peleNaJunta("Hips"),
    naPele = (S: Float32Array, [x, y, z]: number[]): [number, number, number] => [
      S[0] * x + S[4] * y + S[8] * z + S[12],
      S[1] * x + S[5] * y + S[9] * z + S[13],
      S[2] * x + S[6] * y + S[10] * z + S[14],
    ],
    fumo = (u: number, k: number) =>
      0.8 + 0.2 * Math.sin(u * 23 - agora * 1.6 + k) * Math.sin(u * 9 + agora * 0.7 + k * 2);
  const fita = (
    n: number,
    f: (u: number, lado: number) => [number, number, number],
    alfa: (u: number) => number,
    k: number,
  ) => {
    for (let i = 0; i < n; i++)
      for (const [l0, l1] of [
        [-1, -0.6],
        [-0.6, 0.6],
        [0.6, 1],
      ])
        for (const [j, lado] of [
          [i, l0],
          [i, l1],
          [i + 1, l1],
          [i, l0],
          [i + 1, l1],
          [i + 1, l0],
        ]) {
          const u = j / n;
          vert(
            ponto(...f(u, lado)),
            alfa(u) * fumo(u, k) * (Math.abs(lado) > 0.9 ? N.borda : 1),
            0.9 + 0.12 * Math.sin(u * 17 + k - agora),
          );
        }
  };
  const V = corpo ? verticesDaHeroina() : null;
  let contQuadril: ContornoDeusa | null = null;
  for (const [e, en] of N.enrolar.entries()) {
    const [y0, y1, voltas, meia, folga] = en,
      fase = agora * N.giro + e * 2.4,
      S = e ? quadril : peito;
    if (!S || !V) continue;
    const C = contornoDeusa(corpo!, V, S, y0 - meia, y1 + meia);
    if (e) contQuadril = C;
    fita(
      Math.round(voltas * 72),
      (u, lado) => {
        const ang = u * voltas * Math.PI * 2 + fase,
          y = y0 + (y1 - y0) * u + lado * meia + Math.sin(ang * 2 + agora) * N.onda;
        return naPele(S, anelDeusa(C, y, ang, folga + 0.12 * Math.sin(ang * 3 + agora * 2)));
      },
      (u) => N.alfa * Math.min(1, u * voltas * 6, (1 - u) * voltas * 6),
      e,
    );
  }
  for (const [p, lado0] of [
    [0, 1],
    [1, -1],
  ]) {
    // as pontas: saem do quadril (frente/trás) e balançam até o meio da coxa
    const C = contQuadril;
    if (!quadril || !C) break;
    fita(
      24,
      (u, lado) => {
        const y = N.pontas[0] + (N.pontas[1] - N.pontas[0]) * u,
          [x] = anelDeusa(C, N.pontas[0], lado0 > 0 ? 0 : Math.PI, N.folga),
          bal = Math.sin(agora * 1.8 + p * 1.7 + u * 3) * u * u * 1.4;
        return naPele(quadril, [
          x + lado0 * (0.25 + u * 0.6) + bal * 0.4,
          y,
          lado * N.larguraPonta * (1 - u * 0.35) + bal,
        ]);
      },
      (u) => N.alfa * (1 - u * u),
      5 + p,
    );
  }

  // Três véus estreitos e espaçados: passam ao redor da silhueta (o hagoromo solto).
  for (let fita = 0; fita < 3; fita++) {
    const n = 112,
      fase = agora * (0.42 + fita * 0.07) + fita * 2.1;
    for (let i = 0; i < n; i++) {
      const quads: [number, number][] = [
        [i, -1],
        [i, 1],
        [i + 1, 1],
        [i, -1],
        [i + 1, 1],
        [i + 1, -1],
      ];
      for (const [j, lado] of quads) {
        const u = j / n,
          a = u * Math.PI * 2 * 2.15 + fase,
          y = 3.5 + u * 39.5 + Math.sin(a * 0.65 + fita) * 1.4,
          r = (fita === 0 ? 3.6 : fita === 1 ? 5.1 : 6.3) + Math.sin(a * 1.7 + fita) * 1.0,
          width = 0.63 + 0.33 * (0.5 + 0.5 * Math.sin(a * 2 + fita)),
          x = Math.cos(a) * r,
          z = Math.sin(a) * r * 0.58,
          // Largura tangencial da faixa para parecer uma tira de fumaça, sem formar placas cheias.
          tx = -Math.sin(a) * width * lado,
          tz = Math.cos(a) * width * 0.58 * lado,
          fade = Math.sin(Math.PI * u) * (0.25 + 0.12 * (0.5 + 0.5 * Math.sin(a * 2.4 + fita))), // 2026-11-06: era 0,33 + 0,15
          brilho = 0.86 + 0.14 * Math.sin(a + fita);
        vert(ponto(x + tx, y + Math.sin(a * 1.4) * 0.35, z + tz), fade, brilho);
      }
    }
  }

  gl.useProgram(GL3.tprog);
  gl.uniformMatrix4fv(GL3.tVP!, false, VP);
  gl.bindVertexArray(GL3.tvao);
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.tb[0]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.tb[1]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(C), gl.DYNAMIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.disable(gl.DEPTH_TEST); // TESTE_FITAS
  gl.drawArrays(gl.TRIANGLES, 0, P.length / 3);
  gl.enable(gl.DEPTH_TEST); // TESTE_FITAS
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}
export function glFrame() {
  const gl = GL3.gl,
    d = dungeon,
    T = d.tile,
    W = d.cols * T,
    H = d.rows * T;
  if (!gl || GL3._home) return;
  perfFrame(performance.now());
  if (perfPausedView() && GL3.fr % 4 !== 0) {
    GL3.fr++;
    return;
  }
  // v8.0: o personagem em 3D na mochila aberta; só num quadro em que o campo é redesenhado logo depois (ele troca o
  // tamanho do canvas, que apaga: num quadro pulado o campo ficava preto)
  mochilaVivaQuadro();
  retratoPainelQuadro();
  if (GL3.fr++ % 30 === 0 || GL3.cv.width !== perfW() || GL3.cv.height !== perfH()) glPlace();
  GL3.cv.style.transform = TELAS.dCanvas.style.transform;
  const key =
    (d.vila ? "vl:" : d.camp ? "cp:" : d.training ? "tr:" : "") +
    d.cols +
    "x" +
    d.rows +
    ":" +
    Math.round(d.entrance.x) +
    "," +
    Math.round(d.entrance.y);
  const aberto = !!d.origem; // v8.0: campo aberto = o cenário vem do mapa em blocos (render/gl/mundo_cena.ts)
  if (!aberto && GL3.sceneKey !== key) {
    if (GL3.scene) {
      glFree(GL3.scene.floor);
      glFree(GL3.scene.deco);
      if (GL3.scene.tex) glFree(GL3.scene.tex);
    }
    GL3.scene = glBuildScene();
    GL3.sceneKey = key;
  }
  GL3.list.length = 0;
  GL3.fogos.length = 0;
  if (aberto) mundoGLPush();
  else {
    glPush(GL3.scene!.floor, M4.id(), null, false);
    glPush(GL3.scene!.deco, M4.id());
    if (GL3.scene!.tex) glPush(GL3.scene!.tex, M4.id());
  }
  decoGLPush(); // v8.1: a decoração posta no Modo Editor (editor/cena.ts)
  runeGLPush();
  armasGLPush();
  for (const m of d.monsters)
    if (m.alive && naVistaCampo(m.x, m.y)) {
      glWolf(m);
      statusFxGL(m); // v8.0: estrelas 3D do atordoado/caído (status_fx.ts)
      if (m.st === "recover" && !m.humano && m !== d.target && m !== d.foco)
        glPush(anelChao(true), M4.ch(M4.T(m.x, 0, m.y), M4.S(15, 1, 15)), [0.62, 0.89, 1, 1], false);
    }
  bandidosCaidosGL(); // v8.1: os bandidos derrotados ficam no chão um tempo
  // Anéis no plano do chão: o teste de profundidade oculta o trecho atrás do corpo 3D.
  const alvo = d.target?.alive ? d.target : null,
    foco = d.foco?.alive ? d.foco : null;
  if (alvo && alvo !== foco)
    glPush(anelChao(true), M4.ch(M4.T(alvo.x, 0, alvo.y), M4.S(15, 1, 15)), [1, 0.6, 0.24, 1], false);
  // segurar Alt: o alcance do básico (e o do arco carregado, mais apagado), fino e discreto
  const alc = anelAlcance();
  if (alc) {
    glPush(anelLinha(alc.basico), M4.T(d.px, 0, d.py), [0.94, 0.91, 0.87, 1], false);
    if (alc.carregado) glPush(anelLinha(alc.carregado), M4.T(d.px, 0, d.py), [0.55, 0.52, 0.48, 1], false);
  }
  if (foco) {
    const r = foco === alvo ? 17 : 15;
    glPush(
      anelChao(true),
      M4.ch(M4.T(foco.x, 0, foco.y), M4.S(r, 1, r)),
      foco === alvo ? [1, 0.6, 0.24, 1] : [0.85, 0.89, 0.92, 1],
      false,
    );
  }
  for (const g of d.ghosts || []) glWolf(g as Monster, true); // o fantasma só tem x, y, coat, boss, ang, life e max
  const now = performance.now();
  for (const bd of d.birds || []) {
    if (!bd.alive || !naVistaCampo(bd.x, bd.y)) continue;
    birdGL(bd, now);
  }
  /* v7.7 — itens no chão: o modelo low poly do item (render/gl/chao.ts) em vez do ícone flutuante, com contorno
     branco; o item que o E vai pegar ganha contorno dourado grosso e um anel dourado pulsando no chão; A+ e SS ganham
     um anel fino na cor da qualidade */
  rastroGL(naVistaCampo); // v8.0: as pegadas da presa da caçada (field/rastro.ts)
  for (const l of d.loot!) {
    if (!naVistaCampo(l.x, l.y)) continue;
    const perto = l === d.near;
    if (l.key === "flecha" && GL3.hero) {
      // v8.0: flecha caída (as peças da flecha da heroína, deitada no chão)
      const P = GL3.hero,
        a = (l.x * 0.37 + l.y * 0.11) % 6.28,
        u = [Math.cos(a), 0, Math.sin(a)],
        cauda = [l.x - u[0] * 14, 1.2, l.y - u[2] * 14],
        ponta = [l.x + u[0] * 13, 1.2, l.y + u[2] * 13];
      glPush(P.rodWood, rodM(cauda, ponta, 0.8));
      glPush(P.arrowHead, rodM(ponta, [ponta[0] + u[0] * 3.5, 1.2, ponta[2] + u[2] * 3.5], 1.8));
      glPush(P.fletch, rodM(cauda, [cauda[0] + u[0] * 4, 1.2, cauda[2] + u[2] * 4], 2.6, 0.3));
    } else {
      const ms = malhaChao(l.key) || GL3.mesh[l.key] || GL3.mesh.sack;
      if (!ms) continue;
      const bl = l.ttl && l.ttl - l.t < 8 && Math.sin(now / (45 + (l.ttl - l.t) * 30)) < 0;
      if (bl) continue;
      glPush(ms, M4.ch(M4.T(l.x, 0, l.y), M4.RY((l.x * 0.37 + l.y * 0.11) % 6.28)));
    }
    const it = GL3.list[GL3.list.length - 1];
    it.noOl = !perto;
    it.olCor = l.key === "galho" ? CHAO_OL.base : CHAO_OL.pegar;
    it.olEsp = l.key === "galho" ? 1.1 : CHAO_OL.espPegar;
    if (perto && l.key !== "galho") {
      const r = raioBrilho(l.key, now / 1000) * CHAO_OL.anelPegar;
      glPush(anelChao(), M4.ch(M4.T(l.x, 0, l.y), M4.S(r, 1, r)), [...CHAO_OL.pegar, 1], false);
    }
    if ((l.tier || 0) >= 1) {
      const tc = gcol(TIERS[l.tier!].col),
        r = raioBrilho(l.key, now / 1000);
      glPush(anelChao(), M4.ch(M4.T(l.x, 0, l.y), M4.S(r, 1, r)), [tc[0], tc[1], tc[2], 1], false);
    }
  }
  const _gn = performance.now(),
    _gdt = Math.min(0.05, Math.max(0, (_gn - (GL3.lt || _gn)) / 1000));
  GL3.lt = _gn;
  if (d.hero) glHeroPose(_gdt);
  if (d.dodge) {
    const q = d.dodge,
      progresso = 1 - Math.max(0, Math.min(1, q.t / q.dur));
    esquivaFxGL(d.px, d.py, q.dx, q.dy, progresso);
  }
  const Ld = (() => {
      const v = [0.55, -0.62, 0.42],
        l = Math.hypot(...v);
      return v.map((x) => x / l);
    })(),
    ctr = [W / 2, 0, H / 2],
    R = Math.max(W, H) / 2 + 6 * T;
  const LV = aberto
    ? mundoLuz(Ld)
    : M4.mul(
        M4.ortho(-R, R, -R, R, 1, 1600),
        M4.look([ctr[0] - Ld[0] * 800, -Ld[1] * 800, ctr[2] - Ld[2] * 800], ctr, [0, 1, 0]),
      );
  const s = D3.s,
    cw = D3.cw,
    chh = D3.ch,
    SIN = D3.SIN!,
    COS = D3.COS!,
    cz = D3.cz,
    VP = new Float32Array(16);
  VP[0] = (2 * s) / cw;
  VP[12] = (-2 * s * D3.cx) / cw;
  VP[5] = (2 * COS * s) / chh;
  VP[9] = (-2 * SIN * s) / chh;
  VP[13] = (2 * SIN * s * cz - 2 * D3.vy) / chh;
  VP[6] = -SIN / 700;
  VP[10] = -COS / 700;
  VP[14] = (cz * COS) / 700;
  VP[15] = 1;
  if (CZ.perto > 0.03) fundoPerto(Ld);
  if (aberto) erguerNoRelevo(); // v8.0: o relevo do campo aberto (render/gl/relevo.ts): o que pisa no chão sobe com ele
  const VPf = CZ.perto > 0.001 ? vpPerto() : VP,
    vd = VISTA.vd ?? [0, SIN, COS, 1],
    noite = luzCampo(),
    ol = OPT.outline;
  if (CZ.perto > ZOOM_PERTO.semContorno) OPT.outline = false;
  try {
    glRender(VPf, LV, Ld, [0.86, 0.78, 0.55], null, noite, luzFogueira(GL3.fogos));
  } finally {
    OPT.outline = ol;
    VISTA.vd = null;
  }
  desenharAgua(VPf, Ld, vd, noite); // v8.0: a lâmina d'água (render/gl/agua.ts), por cima da cena opaca
  glNevoaDeusa(VPf);
  glTrail(VPf);
  runeGLGlow(VPf);
  efeitosGL(VPf); // v8.1: fumaça, vaga-lumes, folhas… (editor/cena.ts)
}
/** v8.0 — sobe tudo o que foi posto neste quadro (personagem, bichos, itens, armas, anéis) até a altura do chão do
 *  campo aberto no ponto da origem da peça (mundo_cena.ts alturaChao); os blocos do chão (stat) e a lâmina d'água
 *  (relevo) já estão no lugar. A matriz é copiada: há matrizes reaproveitadas entre peças. O rastro da espada sobe
 *  junto (glTrail). */
function erguerNoRelevo() {
  const c = cantoCampo();
  if (!c) return;
  for (const it of GL3.list) {
    if (it.mesh.stat || it.mesh.relevo) continue;
    const h = alturaChao(it.M[12] + c.x, it.M[14] + c.y);
    if (!h) continue;
    const M = Float32Array.from(it.M);
    M[13] += h * M[15];
    it.M = M;
  }
  for (const p of GL3.trail) {
    p.b = [p.b[0], p.b[1] + alturaChao(p.b[0] + c.x, p.b[2] + c.y), p.b[2]];
    p.p = [p.p[0], p.p[1] + alturaChao(p.p[0] + c.x, p.p[2] + c.y), p.p[2]];
  }
}
/** v8.0 — a câmera de perto (CZ.perto, a roda além do zoom máximo): perspectiva que sai do centro e da inclinação da
 *  vista de sempre (a distância que mostra a mesma altura de mundo: sem salto) e vai até o peito do herói, descendo e
 *  dando a volta até ficar de frente para onde ele olhava ao começar (CZ.pertoYaw). */
function vpPerto() {
  const d = dungeon,
    Z = ZOOM_PERTO,
    t = CZ.perto,
    k = t * t * (3 - 2 * t),
    mix = (a: number[], f = k) => a[0] + (a[1] - a[0]) * f,
    fov = mix(Z.fov),
    // altura de mundo que a vista de sempre mostra → a distância da perspectiva no começo
    dist0 = D3.ch / (D3.s * D3.SIN!) / 2 / Math.tan(fov / 2),
    dist = dist0 * Math.pow(Z.dist[1] / dist0, k),
    a0 = Math.PI / 2, // a vista de sempre olha do sul (+z)
    a = a0 + angSD(CZ.pertoYaw, a0) * k,
    p = (mix(Z.alt) * Math.PI) / 180,
    alvo = [D3.cx + (d.px - D3.cx) * k, mix(Z.alvoY), D3.cz + (d.py - D3.cz) * k],
    // mochila ao lado (CZ.desloc): o ponto olhado vai para a direita da tela, e a personagem fica à esquerda
    meiaLarg = dist * Math.tan(fov / 2) * (D3.cw / D3.ch),
    dx = CZ.desloc * meiaLarg;
  alvo[0] += Math.sin(a) * dx;
  alvo[2] -= Math.cos(a) * dx;
  const olho = [
    alvo[0] + dist * Math.cos(p) * Math.cos(a),
    alvo[1] + dist * Math.sin(p),
    alvo[2] + dist * Math.cos(p) * Math.sin(a),
  ];
  VISTA.vd = [Math.cos(p) * Math.cos(a), Math.sin(p), Math.cos(p) * Math.sin(a), 1];
  return M4.mul(persp(fov, D3.cw / D3.ch, 4, dist + 2400), M4.look(olho, alvo, [0, 1, 0]));
}
/** A direção da câmera (do alvo para o olho) da câmera de perto, para o brilho de borda do shader; null fora dela. */
const VISTA = { vd: null as number[] | null };

/** v8.0 — o fundo da câmera de perto (de frente, ela vê o horizonte: antes era o chão até o fim e o cinza liso da
 *  limpeza de tela): cúpula de céu em degradê (escurece à noite como o resto: uNoite) e um anel de mata ao longe com
 *  as árvores do cenário. Montado uma vez, na origem; vai junto com o herói (de perto ele não anda). */
const FUNDO_PERTO = {
  raioCeu: 1900,
  // elevação (rad) → cor: névoa clara no horizonte, azul no alto
  ceu: [
    [-0.08, "#c9d2c4"],
    [0.04, "#d6dfdc"],
    [0.22, "#b3c8dc"],
    [0.55, "#8eb0d6"],
    [1.1, "#6f95c8"],
    [1.57, "#6a8fc4"],
  ] as [number, string][],
  arvores: 46,
  raioMata: [760, 1150],
  escalaMata: [1.7, 2.8],
};
function fundoPerto(Ld: number[]) {
  const F = FUNDO_PERTO;
  if (!GL3.mesh.fundoCeu) {
    const b = { p: [] as number[], n: [] as number[], c: [] as number[] },
      N = 40,
      luz = [-Ld[0], -Ld[1], -Ld[2]], // toda a cúpula virada para a luz: luz cheia e lisa
      ponto = (e: number, a: number) => [
        F.raioCeu * Math.cos(e) * Math.cos(a),
        F.raioCeu * Math.sin(e),
        F.raioCeu * Math.cos(e) * Math.sin(a),
      ];
    for (let r = 0; r + 1 < F.ceu.length; r++) {
      const [e0, c0] = F.ceu[r],
        [e1, c1] = F.ceu[r + 1],
        k0 = gcol(c0),
        k1 = gcol(c1);
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2,
          a1 = ((i + 1) / N) * Math.PI * 2,
          q = [ponto(e0, a0), ponto(e0, a1), ponto(e1, a1), ponto(e1, a0)],
          cq = [k0, k0, k1, k1];
        for (const t of [0, 1, 2, 0, 2, 3]) {
          b.p.push(...q[t]);
          b.n.push(...luz);
          b.c.push(...cq[t]);
        }
      }
    }
    GL3.mesh.fundoCeu = glMesh(b);
    // a mata: sorteio próprio (não mexe no grnd() da cena)
    const m = { p: [] as number[], n: [] as number[], c: [] as number[] };
    let s = 917;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < F.arvores; i++) {
      const a = (i / F.arvores) * Math.PI * 2 + rnd() * 0.12,
        r = F.raioMata[0] + rnd() * (F.raioMata[1] - F.raioMata[0]),
        sc = F.escalaMata[0] + rnd() * (F.escalaMata[1] - F.escalaMata[0]);
      mbCenario(m, rnd() < 0.55 ? "pinheiro" : "folhosa", Math.cos(a) * r, Math.sin(a) * r, sc);
    }
    if (m.p.length) GL3.mesh.fundoMata = glMesh(m);
  }
  const d = dungeon,
    M = M4.T(d.px, 0, d.py);
  glPush(GL3.mesh.fundoCeu, M, null, false);
  if (GL3.mesh.fundoMata) glPush(GL3.mesh.fundoMata, M, null, false);
}
