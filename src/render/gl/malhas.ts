/* ==== Fase 4 — montagem de malhas low-poly: cores, triângulos, caixas, cilindros, icosfera (base/11) ==== */
import { MALHA, M4, ICO } from "./geometria.ts";
import { GL3 } from "../../core/state.ts";
import { glSmoothNormals } from "./estilo.ts";
import type { GLMesh, MalhaCrua } from "../../core/tipos.ts";
import type { Mat4 } from "./geometria.ts";

/* ===== 3D low-poly de verdade: WebGL2 próprio (sol, sombras projetadas, modelos facetados gerados por código) ===== */
export function grnd() {
  MALHA._gs = (MALHA._gs * 1664525 + 1013904223) >>> 0;
  return MALHA._gs / 4294967296;
}
export function gcol(c: string | number[]) {
  if (typeof c !== "string") return c;
  const v = parseInt(c.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
export function gmix(a: string | number[], b: string | number[], t: number) {
  a = gcol(a);
  b = gcol(b);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function MB(): MalhaCrua {
  return { p: [], n: [], c: [] };
}
function vk(v?: number) {
  return v ? 1 + (grnd() - 0.5) * v : 1;
}
export function mbTri(b: MalhaCrua, A: number[], B: number[], C: number[], col: number[], ctr: number[], k: number) {
  const ux = B[0] - A[0],
    uy = B[1] - A[1],
    uz = B[2] - A[2],
    vx = C[0] - A[0],
    vy = C[1] - A[1],
    vz = C[2] - A[2];
  let nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  if (ctr) {
    const gx = (A[0] + B[0] + C[0]) / 3 - ctr[0],
      gy = (A[1] + B[1] + C[1]) / 3 - ctr[1],
      gz = (A[2] + B[2] + C[2]) / 3 - ctr[2];
    if (nx * gx + ny * gy + nz * gz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
  }
  k = k || 1;
  for (const P of [A, B, C]) {
    b.p.push(P[0], P[1], P[2]);
    b.n.push(nx, ny, nz);
    b.c.push(col[0] * k, col[1] * k, col[2] * k);
  }
}
export function mbQuad(
  b: MalhaCrua,
  A: number[],
  B: number[],
  C: number[],
  D: number[],
  col: number[],
  ctr: number[],
  k: number,
) {
  mbTri(b, A, B, C, col, ctr, k);
  mbTri(b, A, C, D, col, ctr, k);
}
export function mbBox(b: MalhaCrua, M: Mat4, col: string | number[], tp?: number, vary?: number) {
  // caixa unitária centrada; tp afunila o topo
  tp = tp == null ? 1 : tp;
  const cl = gcol(col),
    v = [];
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? 0.5 : -0.5,
      y = i & 2 ? 0.5 : -0.5,
      z = i & 4 ? 0.5 : -0.5,
      f = y > 0 ? tp : 1;
    v.push(M4.ap(M, x * f, y, z * f));
  }
  const C = M4.ap(M, 0, 0, 0);
  for (const f of [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
  ])
    mbQuad(b, v[f[0]], v[f[1]], v[f[2]], v[f[3]], cl, C, vk(vary));
}
export function mbCyl(b: MalhaCrua, M: Mat4, col: string | number[], n: number, tp: number, vary?: number) {
  // cilindro/cone unitário (raio 0,5, y de 0 a 1)
  const cl = gcol(col),
    C = M4.ap(M, 0, 0.5, 0),
    bot = [],
    top = [],
    cb = M4.ap(M, 0, 0, 0),
    ct = M4.ap(M, 0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      x = Math.cos(a) * 0.5,
      z = Math.sin(a) * 0.5;
    bot.push(M4.ap(M, x, 0, z));
    top.push(M4.ap(M, x * tp, 1, z * tp));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      k = vk(vary);
    if (tp > 0) {
      mbQuad(b, bot[i], bot[j], top[j], top[i], cl, C, k);
      mbTri(b, ct, top[i], top[j], cl, C, k);
    } else mbTri(b, bot[i], bot[j], ct, cl, C, k);
    mbTri(b, cb, bot[j], bot[i], cl, C, k);
  }
}
const _icoC: Record<string, { v: number[][]; f: number[][] }> = {};
function icoGeo(sub: number) {
  if (_icoC[sub]) return _icoC[sub];
  const v = ICO.v.map((p) => p.slice());
  let f = ICO.f.map((x) => x.slice());
  for (let s = 0; s < sub; s++) {
    const cache: Record<string, number> = {},
      mid = (a: number, b: number) => {
        const k = a < b ? a + "_" + b : b + "_" + a;
        if (cache[k] != null) return cache[k];
        const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2],
          l = Math.hypot(...p);
        v.push(p.map((q) => q / l));
        return (cache[k] = v.length - 1);
      };
    const nf = [];
    for (const [a, b, c] of f) {
      const ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = nf;
  }
  return (_icoC[sub] = { v, f });
}
export function mbIco(b: MalhaCrua, M: Mat4, col: string | number[], sub?: number, jit?: number, vary?: number) {
  // esfera facetada (pedras, copas, corpo)
  const g = icoGeo(Math.min(2, sub! + MALHA._icoBoost)),
    cl = gcol(col),
    C = M4.ap(M, 0, 0, 0),
    v = g.v.map((p) => {
      const r = 0.5 * (1 + (grnd() - 0.5) * jit!);
      return M4.ap(M, p[0] * r, p[1] * r, p[2] * r);
    });
  for (const [a, b2, c] of g.f) mbTri(b, v[a], v[b2], v[c], cl, C, vk(vary));
}
export function glMesh(b: MalhaCrua): GLMesh {
  const gl = GL3.gl,
    vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const _sm = glSmoothNormals(b),
    bufs: WebGLBuffer[] = [];
  [new Float32Array(b.p), _sm.NS, new Float32Array(b.c), _sm.HS].forEach((arr, loc) => {
    const buf = gl.createBuffer();
    bufs.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  });
  gl.bindVertexArray(null);
  return { vao, n: b.p.length / 3, bufs };
}

export function glFree(m: GLMesh) {
  if (!m || !GL3.gl) return;
  GL3.gl.deleteVertexArray(m.vao);
  for (const b of m.bufs || []) GL3.gl.deleteBuffer(b); // v8.0: os buffers também (os blocos do campo aberto vão e vêm)
}
