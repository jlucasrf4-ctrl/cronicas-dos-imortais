/* v8.1 — articulação procedural das patas e mandíbula da cinemática, amostrada pelo tempo da cena. */
import { GL3 } from "../core/state.ts";
import type { GLMesh } from "../core/tipos.ts";
import { normaisSuaves } from "../render/gl/esqueleto.ts";
import { SMOOTH_COS } from "../render/gl/geometria.ts";
const FONTES = new WeakMap<
  GLMesh,
  {
    p: Float32Array;
    altura: number;
    largura: number;
    meio: number;
    quadro: number;
    saida: Float32Array;
    normais: Float32Array;
    ns: Float32Array;
    hs: Float32Array;
    ini: Uint32Array;
    cantos: Uint32Array;
  }
>();
export function registrarCoelhoCine(m: GLMesh, p: number[]) {
  let y0 = Infinity,
    y1 = -Infinity,
    x0 = Infinity,
    x1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    y0 = Math.min(y0, p[i + 1]);
    y1 = Math.max(y1, p[i + 1]);
    x0 = Math.min(x0, p[i]);
    x1 = Math.max(x1, p[i]);
  }
  const grupos = new Map<string, number>(),
    ids: number[] = [];
  for (let i = 0; i < p.length; i += 3) {
    const chave = `${Math.round(p[i] * 1e5)},${Math.round(p[i + 1] * 1e5)},${Math.round(p[i + 2] * 1e5)}`;
    let id = grupos.get(chave);
    if (id == null) {
      id = grupos.size;
      grupos.set(chave, id);
    }
    ids.push(id);
  }
  const ini = new Uint32Array(grupos.size + 1),
    cantos = new Uint32Array(ids.length);
  for (const id of ids) ini[id + 1]++;
  for (let i = 1; i < ini.length; i++) ini[i] += ini[i - 1];
  const pos = ini.slice();
  ids.forEach((id, i) => {
    cantos[pos[id]++] = i;
  });
  FONTES.set(m, {
    p: Float32Array.from(p),
    altura: y1 - y0,
    largura: x1 - x0,
    meio: (x0 + x1) / 2,
    quadro: -1,
    saida: new Float32Array(p.length),
    normais: new Float32Array(p.length),
    ns: new Float32Array(p.length),
    hs: new Float32Array(p.length),
    ini,
    cantos,
  });
}
export function pontoCoelhoCine(
  x: number,
  y: number,
  z: number,
  altura: number,
  largura: number,
  meio: number,
  t: number,
  monstro: boolean,
  andando: boolean,
) {
  const h = Math.max(altura, 0.001),
    frente = x > meio;
  const peso = Math.max(0, Math.min(1, (h * 0.42 - y) / (h * 0.22)));
  const fase = t * (monstro ? 8 : 16) + (frente ? 0 : Math.PI);
  const ang = andando ? Math.sin(fase) * peso * (monstro ? 0.25 : 0.55) : 0;
  const px = meio + (frente ? 1 : -1) * largura * 0.26,
    py = h * 0.3;
  const dx = x - px,
    dy = y - py;
  let nx = x + (Math.cos(ang) * dx - Math.sin(ang) * dy + px - x) * peso;
  let ny = y + (Math.sin(ang) * dx + Math.cos(ang) * dy + py - y) * peso;
  ny += Math.sin(t * 2.2) * h * 0.007 * Math.max(0, Math.min(1, y / h));
  if (monstro && frente && y > h * 0.48 && y < h * 0.76 && t > 12.1 && t < 13.7) {
    const abre = Math.sin((Math.min(1, (t - 12.1) / 0.25) * Math.PI) / 2) * Math.min(1, (13.7 - t) / 0.5);
    ny -= abre * h * 0.055;
    nx += abre * largura * 0.018;
  }
  return [nx, ny, z];
}
export function animarCoelhoCine(m: GLMesh, t: number, monstro: boolean, andando: boolean) {
  const f = FONTES.get(m),
    gl = GL3.gl;
  if (!f || !m.bufs || !gl) return;
  const quadro = Math.floor(t * 30);
  if (f.quadro === quadro) return;
  f.quadro = quadro;
  for (let i = 0; i < f.p.length; i += 3)
    f.saida.set(pontoCoelhoCine(f.p[i], f.p[i + 1], f.p[i + 2], f.altura, f.largura, f.meio, t, monstro, andando), i);
  for (let i = 0; i < f.saida.length; i += 9) {
    const p = f.saida,
      ux = p[i + 3] - p[i],
      uy = p[i + 4] - p[i + 1],
      uz = p[i + 5] - p[i + 2],
      vx = p[i + 6] - p[i],
      vy = p[i + 7] - p[i + 1],
      vz = p[i + 8] - p[i + 2];
    const x = uy * vz - uz * vy,
      y = uz * vx - ux * vz,
      z = ux * vy - uy * vx,
      l = Math.hypot(x, y, z) || 1;
    for (let k = 0; k < 3; k++) f.normais.set([x / l, y / l, z / l], i + k * 3);
  }
  normaisSuaves(f, f.normais, SMOOTH_COS, f.ns, f.hs);
  for (const [slot, dados] of [
    [0, f.saida],
    [1, f.ns],
    [3, f.hs],
  ] as const) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.bufs[slot]);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dados);
  }
}
