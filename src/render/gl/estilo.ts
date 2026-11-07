/* ==== Fase 4 — visual estilizado: normais suaves, contorno, chão (v4.6) ==== */
import { SMOOTH_COS, MALHA } from "./geometria.ts";
import { GL3 } from "../../core/state.ts";
import { glBuildWolfBase, glBuildHeroBase } from "./modelos.ts";
import { glBuildBoarBase } from "../../creatures/javali.ts";
import { gmix } from "./malhas.ts";
import { quadradoFacetado } from "./relevo.ts";
import type { GLMesh, MalhaCrua, Repasse } from "../../core/tipos.ts";
import type { Mat4 } from "./geometria.ts";

export function glSmoothNormals(b: MalhaCrua) {
  const P = b.p,
    N = b.n,
    n = P.length / 3,
    groups = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.round(P[3 * i] * 16) + "," + Math.round(P[3 * i + 1] * 16) + "," + Math.round(P[3 * i + 2] * 16);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(i);
  }
  const NS = new Float32Array(n * 3),
    HS = new Float32Array(n * 3);
  for (const g of groups.values()) {
    let hx = 0,
      hy = 0,
      hz = 0;
    for (const i of g) {
      hx += N[3 * i];
      hy += N[3 * i + 1];
      hz += N[3 * i + 2];
    }
    const hl = Math.hypot(hx, hy, hz) || 1;
    for (const i of g) {
      HS[3 * i] = hx / hl;
      HS[3 * i + 1] = hy / hl;
      HS[3 * i + 2] = hz / hl;
      let sx = 0,
        sy = 0,
        sz = 0;
      for (const j of g) {
        if (N[3 * i] * N[3 * j] + N[3 * i + 1] * N[3 * j + 1] + N[3 * i + 2] * N[3 * j + 2] > SMOOTH_COS) {
          sx += N[3 * j];
          sy += N[3 * j + 1];
          sz += N[3 * j + 2];
        }
      }
      const sl = Math.hypot(sx, sy, sz) || 1;
      NS[3 * i] = sx / sl;
      NS[3 * i + 1] = sy / sl;
      NS[3 * i + 2] = sz / sl;
    }
  }
  return { NS, HS };
}
export function glOutlinePass(VP: Mat4, th: number, push: number) {
  const gl = GL3.gl;
  if (!GL3.oprog) return;
  let any = false;
  for (const it of GL3.list)
    if (it.mesh.ol) {
      any = true;
      break;
    }
  if (!any) return;
  gl.useProgram(GL3.oprog);
  gl.uniformMatrix4fv(GL3.OU!.uVP, false, VP);
  gl.uniform1f(GL3.OU!.uTh, th);
  gl.uniform1f(GL3.OU!.uPush, push);
  const COR_OL = [0.2, 0.14, 0.1]; // v8.0: um pouco menos escuro (era 0.13, 0.09, 0.07)
  gl.uniform3fv(GL3.OU!.uCol, COR_OL);
  let corAtual = COR_OL,
    espAtual = 1;
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.FRONT); // v5.8: casco invertido — só as faces de trás do contorno aparecem (não cobre mais o corpo)
  for (const it of GL3.list) {
    if (!it.mesh.ol || it.noOl) continue;
    const cor = it.olCor || COR_OL, // v7.7: contorno próprio (itens no chão) e espessura própria
      esp = it.olEsp || 1;
    if (cor !== corAtual) {
      gl.uniform3fv(GL3.OU!.uCol, cor);
      corAtual = cor;
    }
    if (esp !== espAtual) {
      gl.uniform1f(GL3.OU!.uTh, th * esp);
      espAtual = esp;
    }
    const M = it.M,
      det =
        M[0] * (M[5] * M[10] - M[6] * M[9]) - M[1] * (M[4] * M[10] - M[6] * M[8]) + M[2] * (M[4] * M[9] - M[5] * M[8]);
    gl.frontFace(det < 0 ? gl.CW : gl.CCW);
    gl.uniformMatrix4fv(GL3.OU!.uM, false, M);
    gl.bindVertexArray(it.mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, it.mesh.n);
  }
  gl.frontFace(gl.CCW);
  gl.disable(gl.CULL_FACE);
  gl.bindVertexArray(null);
}
function glMarkOl<T extends GLMesh | Record<string, GLMesh> | null | undefined>(o: T): T {
  if (!o) return o;
  if ((o as GLMesh).vao) {
    (o as GLMesh).ol = true;
    return o;
  }
  for (const k in o)
    if ((o as Record<string, GLMesh>)[k] && (o as Record<string, GLMesh>)[k].vao)
      (o as Record<string, GLMesh>)[k].ol = true;
  return o;
} // uma malha ou um conjunto delas (por nome)
function glBoosted<F extends (...a: never[]) => GLMesh | Record<string, GLMesh>>(fn: F): F {
  return <F>function (this: unknown) {
    const prev = MALHA._icoBoost;
    MALHA._icoBoost = 1;
    try {
      return glMarkOl(fn.apply(this, arguments as Repasse));
    } finally {
      MALHA._icoBoost = prev;
    }
  };
}
export const glBuildWolf = glBoosted(glBuildWolfBase),
  glBuildHero = glBoosted(glBuildHeroBase),
  glBuildBoar = glBoosted(glBuildBoarBase);
/* chão pintado: cor por vértice (manchas suaves, sem xadrez) */
function floorCol(x: number, z: number) {
  const n =
      (Math.sin(x * 0.0088 + z * 0.005) + Math.sin(x * 0.0031 - z * 0.0069 + 1.7) + Math.sin((x + z) * 0.0021 + 0.4)) /
      3,
    t = Math.max(0, Math.min(1, 0.5 + n * 1.1));
  let c = gmix("#b9c86a", "#e6cf93", t);
  const g2 = (Math.sin(x * 0.021 + 3) + Math.sin(z * 0.017 - 5) + Math.sin((x - z) * 0.013)) / 3;
  if (g2 > 0.15) c = gmix(c, "#9db45c", Math.min(0.55, (g2 - 0.15) * 2.2));
  if (MALHA.FLOOR_B) {
    const B = MALHA.FLOOR_B,
      din = Math.min(x - B.x0, B.x1 - x, z - B.z0, B.z1 - z);
    if (din > -B.T) c = gmix(c, "#d6b77a", 0.32 * Math.max(0, Math.min(1, (din + B.T) / (B.T * 1.5))));
  }
  const k = 0.95 + Math.sin(x * 0.11) * Math.sin(z * 0.13) * 0.035 + Math.sin(x * 0.37 + z * 0.29) * 0.015;
  return [c[0] * k, c[1] * k, c[2] * k];
}
export function floorQuad(b: MalhaCrua, x: number, z: number, T: number) {
  const B = MALHA.FLOOR_B,
    near = !B || (x > B.x0 - 3 * T && x < B.x1 + 3 * T && z > B.z0 - 3 * T && z < B.z1 + 3 * T);
  // v5.7: longe da arena, 1 quadrado por casa; v8.0: com cara de malha (relevo.ts quadradoFacetado)
  quadradoFacetado(b, x, z, T, near ? 3 : 1, floorCol);
}
