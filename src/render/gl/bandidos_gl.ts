/* ==== v8.1 — os bandidos animados (field/bandidos.ts) ====
   Cada bandido tem o próprio animado (os passos não andam juntos), no esqueleto e com os clips de combate da heroína,
   vestido com o personagem dele (vestidos.json): o combo de espada no preparo e no golpe (o preparo toca devagar, até o
   pico cair no acerto), a clava do bruto no golpe pesado de machado (erguida e descendo), o arco do arqueiro (sacar,
   mirar, soltar), guarda com escudo, esquiva rolando e as reações. Caído, a pose final da queda; derrotado, cai e fica
   no chão por BANDO.corpo s. */
import { M4, type Mat4 } from "./geometria.ts";
import { glPush, angSD } from "./renderer.ts";
import { animar, preso, trocarPele } from "./animado.ts";
import { novoComoHeroina, escudoNoBraco } from "./heroina_anim.ts";
import { GL3 } from "../../core/state.ts";
import { vestidoPorNome } from "./vestidos.ts";
import { armaModelo } from "./armas3d.ts";
import { centroEscudo } from "./heroina.ts";
import { duracaoClip, juntaGlobal } from "./esqueleto.ts";
import { BANDIDOS, BANDO } from "../../data/bandidos.ts";
import { CAIDOS } from "../../field/bandidos.ts";
import type { GLMesh, Monster } from "../../core/tipos.ts";

/** A escala no mundo (a da heroína animada) e o pico de cada passo do combo no tempo do jogo (COMBO.tPico, animado.ts). */
const BGL = { escala: 1.3, pico: [0.16, 0.16, 0.2], fim: 0.38, machado: 0.46 };

type Animado = ReturnType<typeof novoComoHeroina>;
interface Vivo {
  X: Animado;
  t: number;
  x: number;
  y: number;
  yaw: number;
  mv: number; // direção do último passo (rad)
}
const VIVOS = new WeakMap<Monster, Vivo>();

function vivoDe(m: Monster) {
  let v = VIVOS.get(m);
  if (!v) {
    const X = novoComoHeroina(),
      B = BANDIDOS[m.bandido!] ?? BANDIDOS.capuz;
    trocarPele(X, vestidoPorNome(B.modelo)?.anim ?? null);
    v = { X, t: 0, x: m.x, y: m.y, yaw: m.ang ?? 0, mv: m.ang ?? 0 };
    VIVOS.set(m, v);
  }
  return v;
}
function escudoMalha() {
  const [ex, , ez] = centroEscudo();
  return armaModelo("eq_escudo", M4.T(ex, -8.5, ez), "bandido_escudo");
}

/** Desenha um bandido vivo (glWolf chama, para os humanos com `bandido`). */
export function bandidoGL(m: Monster) {
  const v = vivoDe(m),
    B = BANDIDOS[m.bandido!] ?? BANDIDOS.capuz,
    agora = performance.now() / 1000,
    dt = v.t ? Math.min(0.1, Math.max(0, agora - v.t)) : 1 / 60;
  v.t = agora;
  let andou = Math.hypot(m.x - v.x, m.y - v.y);
  if (andou > 0.05) v.mv = Math.atan2(m.y - v.y, m.x - v.x);
  if (andou > 20) andou = 0;
  v.x = m.x;
  v.y = m.y;
  // olha para onde mira; fugindo, para onde corre
  const quer = m.bFoge ? v.mv : (m.ang ?? v.yaw);
  v.yaw += angSD(quer, v.yaw) * Math.min(1, dt * 12);
  m._yaw = v.yaw;
  const caido = (m.ko || 0) > 0,
    prep = m.st === "windup",
    k = prep ? Math.max(0, Math.min(1, 1 - m.t / (m.wuTot || 1))) : 0,
    gT = m.humanoGolpeT,
    arco = !!B.arco,
    clava = B.arma === "eq_clava" && m.atk === "heavy",
    passo = Math.min(2, m.bPasso ?? 0),
    pico = BGL.pico[passo],
    combo =
      arco || clava
        ? null
        : prep
          ? { passo, t: k * pico }
          : gT != null && pico + gT < BGL.fim
            ? { passo, t: pico + gT }
            : null,
    X = v.X;
  const an = animar(X, {
    dt,
    andou,
    movendo: andou > 0.05 ? 1 : 0,
    correndo: m.humanoCorrendo ? 1 : 0,
    rolando: !!m.humanoRolando && (m.humanoEsquivaT || 0) > 0,
    fixo: caido && X.A ? { clip: "morrer", t: duracaoClip(X.A, "morrer") } : undefined,
    modo: arco ? "arco" : /faca/.test(B.arma) ? "faca" : "combate",
    carga: arco && prep ? k : 0,
    mirando: arco && prep,
    soltando: arco && (m.humanoSoltarT || 0) > 0,
    dirMov: -angSD(v.mv, v.yaw),
    combo,
    machadoCarga: clava && prep ? k : null,
    machadoGolpe: clava && !prep && gT != null && gT < BGL.machado ? gT / BGL.machado : null,
    guarda: (m.humanoGuardT || 0) > 0,
    atingido: m.humanoAtingidoT ?? null,
    bloqueou: m.humanoBloqueouT ?? null,
  });
  if (!an) return;
  const AF = M4.ch(M4.T(m.x, 0, m.y), M4.RY(-v.yaw), M4.S(BGL.escala)),
    tint = (m.flash || 0) > 0.04 ? [1, 0.7, 0.55, 0.8] : null;
  // v8.1 — caído: onde o corpo deitado está (quadril → cabeça), para o golpe acertar o corpo e não os pés
  if (caido && X.A) {
    const q = juntaGlobal(X.A, an.mat, "Hips"),
      c = juntaGlobal(X.A, an.mat, "Head");
    if (q && c) {
      const Q = M4.ap(AF, q[12], q[13], q[14]),
        C = M4.ap(AF, c[12], c[13], c[14]);
      // as pernas seguem do quadril para o lado oposto da cabeça (~70% do tronco)
      m.corpoCaido = [Q[0] - (C[0] - Q[0]) * 0.7, Q[2] - (C[2] - Q[2]) * 0.7, C[0], C[2]];
    }
  } else m.corpoCaido = undefined;
  glPush(an.mesh, AF, tint);
  // v8.1 — o aviso do golpe é a arma: brilha nos últimos BANDO.brilho.t s do preparo (mais forte no pesado)
  const Br = BANDO.brilho,
    brilho = prep && !arco && m.t < Br.t ? (m.atk === "heavy" ? Br.pesado : Br.leve) * (1 - m.t / Br.t) : 0;
  armas(X, an.mat, AF, B.arma, !!B.escudo, arco, brilho > 0.02 ? [1, 0.96, 0.82, brilho] : tint);
}
function armas(
  X: Animado,
  mat: Parameters<typeof preso>[1],
  AF: Mat4,
  arma: string,
  escudo: boolean,
  arco: boolean,
  tint: number[] | null,
) {
  const a = armaModelo(arma); // o arco na mão esquerda, o resto na direita
  if (a) glPush(a, M4.mul(AF, preso(X, mat, arco ? "arco" : "arma")), tint);
  if (escudo) {
    const e = escudoMalha();
    if (e) glPush(e, M4.ch(AF, preso(X, mat, "escudo"), escudoNoBraco(X)), tint);
  }
}

/** Os bandidos derrotados: caem (o clip da queda) e ficam no chão até sumir. */
const CORPO = new WeakMap<Monster, { t0: number; mesh: GLMesh | null }>();
export function bandidosCaidosGL() {
  const agora = performance.now();
  for (let i = CAIDOS.length - 1; i >= 0; i--) {
    const c = CAIDOS[i];
    if (agora > c.ate) {
      CAIDOS.splice(i, 1);
      continue;
    }
    const v = VIVOS.get(c.m);
    if (!v || !v.X.A) continue;
    let q = CORPO.get(c.m);
    if (!q) CORPO.set(c.m, (q = { t0: agora, mesh: null }));
    const dur = duracaoClip(v.X.A, "morrer"),
      t = (agora - q.t0) / 1000;
    // caindo: anima; deitado: a última malha serve (não deforma de novo a cada quadro)
    if (t < dur || !q.mesh || v.X.gl !== GL3.gl)
      q.mesh = animar(v.X, { dt: 0, andou: 0, fixo: { clip: "morrer", t: Math.min(dur, t) } })?.mesh ?? null;
    if (q.mesh) glPush(q.mesh, M4.ch(M4.T(c.m.x, 0, c.m.y), M4.RY(-c.yaw), M4.S(BGL.escala)));
  }
}
