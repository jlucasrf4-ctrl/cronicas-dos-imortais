/* ==== v8.0 — os prédios e enfeites da Vila Musgo com textura (src/assets/models/vila.json + vila_tex.webp, gerados
   por tools/gerar-vila.ts com o plano tools/modelos/vila.json) ====
   A única parte do cenário que usa textura (o mantenedor preferiu a textura do Tripo à versão em cor por triângulo).
   glBuildVila chama vtPor(nome, …) para cada peça: a peça vai, já no lugar, para uma malha só (uma textura, um
   desenho); vtMalha() fecha essa malha. Sem os dados (testes em Node) vtPor devolve false e a vila usa as malhas
   feitas por código. A textura carrega da imagem embutida; até lá, uma de 1×1 cinza-claro. */
import { GL3 } from "../../core/state.ts";
import { glSmoothNormals } from "./estilo.ts";
import type { GLMesh } from "../../core/tipos.ts";

interface PecaVila {
  tam: number[];
  p: string;
  uv: string;
  i: string;
}
const DADOS = /* @inline-json src/assets/models/vila.json */ {} as { pecas?: Record<string, PecaVila> };
const TEX_URL = "/src/assets/models/vila_tex.webp";

/** luz: a cor do vértice (multiplica a textura, que já vem com luz assada e escurece com a luz do jogo) */
const VILA_TEX = { luz: 1.3 };

const decod = new Map<string, { tam: number[]; p: Int16Array; uv: Uint16Array; i: Uint16Array }>();
function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let k = 0; k < s.length; k++) u[k] = s.charCodeAt(k);
  return u.buffer;
}
function peca(nome: string) {
  let d = decod.get(nome);
  const cru = DADOS.pecas?.[nome];
  if (!d && cru) {
    d = {
      tam: cru.tam,
      p: new Int16Array(bytes(cru.p)),
      uv: new Uint16Array(bytes(cru.uv)),
      i: new Uint16Array(bytes(cru.i)),
    };
    decod.set(nome, d);
  }
  return d;
}

/** v8.1 — as peças da vila e os dados de uma (para a biblioteca do Modo Editor e a miniatura dela). */
export function pecasVila() {
  return Object.keys(DADOS.pecas || {});
}
export function vilaCrua(nome: string) {
  return peca(nome) ?? null;
}
export const VILA_TEX_URL = TEX_URL;

/** a malha em montagem (posições/normais/cores como MalhaCrua, + UV) */
const MT = { p: [] as number[], n: [] as number[], c: [] as number[], uv: [] as number[] };

/**
 * Põe a peça `nome` com a base no chão em (x, z), cabendo em w × d (unidades do jogo) depois de girar `giro` rad em y
 * (giro 0: a frente da peça para +z). `alto` multiplica a altura. Devolve false sem os dados.
 */
export function vtPor(nome: string, x: number, z: number, w: number, d: number, giro = 0, alto = 1) {
  const pc = peca(nome);
  if (!pc) return false;
  const cg = Math.cos(giro),
    sg = Math.sin(giro);
  // a caixa da peça girada, para caber em w × d
  const lx = Math.abs(pc.tam[0] * cg) + Math.abs(pc.tam[2] * sg),
    lz = Math.abs(pc.tam[0] * sg) + Math.abs(pc.tam[2] * cg);
  const s = Math.min(w / lx, d / lz);
  const pos = (v: number) => {
    const px = pc.p[v * 3] / 32000,
      py = pc.p[v * 3 + 1] / 32000,
      pz = pc.p[v * 3 + 2] / 32000;
    return [x + (px * cg + pz * sg) * s, py * s * alto, z + (-px * sg + pz * cg) * s];
  };
  const L = VILA_TEX.luz;
  for (let t = 0; t < pc.i.length; t += 3) {
    const vs = [pc.i[t], pc.i[t + 1], pc.i[t + 2]],
      Q = vs.map(pos);
    const a = [0, 1, 2].map((e) => Q[1][e] - Q[0][e]),
      b = [0, 1, 2].map((e) => Q[2][e] - Q[0][e]);
    const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
      ln = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let k = 0; k < 3; k++) {
      MT.p.push(Q[k][0], Q[k][1], Q[k][2]);
      MT.n.push(n[0] / ln, n[1] / ln, n[2] / ln);
      MT.c.push(L, L, L);
      MT.uv.push(pc.uv[vs[k] * 2] / 65535, pc.uv[vs[k] * 2 + 1] / 65535);
    }
  }
  return true;
}

let texGL: { gl: WebGL2RenderingContext; t: WebGLTexture } | null = null;
function textura(gl: WebGL2RenderingContext) {
  if (texGL && texGL.gl === gl) return texGL.t;
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 190, 170, 255]));
  gl.bindTexture(gl.TEXTURE_2D, null);
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  img.src = TEX_URL;
  texGL = { gl, t };
  return t;
}

/** Fecha a malha montada pelos vtPor desde a última chamada (null se nada foi posto). */
export function vtMalha(): GLMesh | null {
  const n = MT.p.length / 3;
  if (!n) return null;
  const gl = GL3.gl,
    vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const sm = glSmoothNormals(MT),
    bufs: WebGLBuffer[] = [];
  const attrs: [Float32Array, number, number][] = [
    [new Float32Array(MT.p), 0, 3],
    [sm.NS, 1, 3],
    [new Float32Array(MT.c), 2, 3],
    [sm.HS, 3, 3],
    [new Float32Array(MT.uv), 4, 2],
  ];
  for (const [arr, loc, k] of attrs) {
    const buf = gl.createBuffer()!;
    bufs.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0);
  }
  gl.bindVertexArray(null);
  MT.p = [];
  MT.n = [];
  MT.c = [];
  MT.uv = [];
  return { vao, n, bufs, tex: textura(gl) };
}
