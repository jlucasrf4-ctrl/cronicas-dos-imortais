/* ==== v7.7 — leitura dos .glb do Tripo (uma malha só, folha com vários objetos) e prévias em software ====
   Usado por tools/gerar-personagem.ts (tools/lib/personagem.ts). Cada .glb tem 1 malha (POSITION, NORMAL, TEXCOORD_0,
   índices) e 3 texturas; aqui só a de cor é lida. O recorte de um objeto da folha (por ilha de triângulos) e a
   textura decodificada ficam em cache em build/modelos/cache, para as rodadas seguintes levarem segundos. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { Matrix4, Quaternion, Vector3 } from "three";

/** Malha indexada com UV e a textura de cor (RGB, lado×lado). */
export interface MalhaTex {
  P: Float32Array;
  T: Float32Array;
  I: Uint32Array;
  tex: Buffer;
  texW: number;
}
/** Região da folha: um objeto entra se o centro da caixa da sua ilha cai dentro (unidades do .glb). z: para folhas
 *  deitadas no chão (o diorama do acampamento), vistas de cima. */
export interface Regiao {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  zMin?: number;
  zMax?: number;
}

interface Acessor {
  bufferView: number;
  byteOffset?: number;
  count: number;
  type: string;
  componentType: number;
  normalized?: boolean;
}
interface Gltf {
  accessors: Acessor[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  nodes?: {
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  scenes?: { nodes: number[] }[];
  scene?: number;
  images: { bufferView: number }[];
  materials: { pbrMetallicRoughness?: { baseColorTexture?: { index: number }; baseColorFactor?: number[] } }[];
  textures?: { source: number }[];
}

/** Cópia alinhada de um trecho de buffer (um ArrayBuffer comum, que os Float32Array/Uint32Array aceitam). */
const copiaBytes = (buf: ArrayBufferLike, inicio: number, tamanho: number) =>
  new Uint8Array(buf, inicio, tamanho).slice().buffer;

function acessor(g: Gltf, bin: Buffer, i: number) {
  const a = g.accessors[i],
    bv = g.bufferViews[a.bufferView];
  const off = bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const n = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type];
  const copia = (C: Float32ArrayConstructor | Uint32ArrayConstructor | Uint16ArrayConstructor) =>
    new C(copiaBytes(bin.buffer, off, a.count * n * C.BYTES_PER_ELEMENT));
  if (a.componentType === 5126) return copia(Float32Array);
  if (a.componentType === 5125) return copia(Uint32Array);
  if (a.componentType === 5123) return copia(Uint16Array);
  if (a.componentType === 5121)
    return Float32Array.from(new Uint8Array(bin.buffer, off, a.count * n), (v) => (a.normalized ? v / 255 : v));
  throw new Error("tipo de componente não suportado: " + a.componentType);
}

/** Lê o .glb inteiro: malha + textura de cor redimensionada para texW². */
export async function lerGLB(arquivo: string, texW = 2048): Promise<MalhaTex> {
  const buf = readFileSync(arquivo);
  const jl = buf.readUInt32LE(12);
  const g = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8")) as Gltf;
  const bl = buf.readUInt32LE(20 + jl);
  const bin = Buffer.from(buf.subarray(28 + jl, 28 + jl + bl));
  const partes: { malha: number; matriz: Matrix4 }[] = [];
  const visitar = (id: number, pai: Matrix4) => {
    const no = g.nodes![id];
    const local = no.matrix
      ? new Matrix4().fromArray(no.matrix)
      : new Matrix4().compose(
          new Vector3().fromArray(no.translation ?? [0, 0, 0]),
          new Quaternion().fromArray(no.rotation ?? [0, 0, 0, 1]),
          new Vector3().fromArray(no.scale ?? [1, 1, 1]),
        );
    const matriz = pai.clone().multiply(local);
    if (no.mesh != null) partes.push({ malha: no.mesh, matriz });
    for (const filho of no.children ?? []) visitar(filho, matriz);
  };
  const raizes = g.scenes?.[g.scene ?? 0]?.nodes;
  if (g.nodes && raizes) for (const id of raizes) visitar(id, new Matrix4());
  else for (let i = 0; i < g.meshes.length; i++) partes.push({ malha: i, matriz: new Matrix4() });
  const pos: number[] = [],
    uv: number[] = [],
    ind: number[] = [],
    cores: number[] = [];
  let ti: number | undefined;
  for (const parte of partes)
    for (const p of g.meshes[parte.malha].primitives) {
      const pp = acessor(g, bin, p.attributes.POSITION),
        tt = p.attributes.TEXCOORD_0 == null ? null : acessor(g, bin, p.attributes.TEXCOORD_0),
        cc = p.attributes.COLOR_0 == null ? null : acessor(g, bin, p.attributes.COLOR_0),
        ii = p.indices == null ? Uint32Array.from({ length: pp.length / 3 }, (_, i) => i) : acessor(g, bin, p.indices),
        mat = g.materials[p.material ?? 0]?.pbrMetallicRoughness,
        canais = cc ? (g.accessors[p.attributes.COLOR_0].type === "VEC4" ? 4 : 3) : 3,
        inicio = pos.length / 3;
      ti ??= mat?.baseColorTexture?.index;
      const ponto = new Vector3();
      for (let v = 0; v < pp.length / 3; v++) {
        ponto.set(pp[v * 3], pp[v * 3 + 1], pp[v * 3 + 2]).applyMatrix4(parte.matriz);
        pos.push(ponto.x, ponto.y, ponto.z);
        uv.push(tt?.[v * 2] ?? 0, tt?.[v * 2 + 1] ?? 0);
        for (let k = 0; k < 3; k++) cores.push((cc?.[v * canais + k] ?? 1) * (mat?.baseColorFactor?.[k] ?? 1));
      }
      for (const i of ii) ind.push(inicio + i);
    }
  const P = Float32Array.from(pos),
    T = Float32Array.from(uv),
    I = Uint32Array.from(ind);
  // Folhas sem imagem usam COLOR_0. Converte a cor em UV de uma paleta para seguir o mesmo pipeline.
  if (ti == null) {
    const tex = Buffer.alloc(texW * texW * 3);
    const uv = new Float32Array((P.length / 3) * 2);
    for (let i = 0; i < 4096; i++) {
      const x = i % 64,
        y = Math.floor(i / 64);
      for (let yy = Math.floor((y * texW) / 64); yy < Math.floor(((y + 1) * texW) / 64); yy++)
        for (let xx = Math.floor((x * texW) / 64); xx < Math.floor(((x + 1) * texW) / 64); xx++)
          for (let k = 0; k < 3; k++) tex[(yy * texW + xx) * 3 + k] = ((i >> ((2 - k) * 4)) & 15) * 17;
    }
    for (let v = 0; v < P.length / 3; v++) {
      let id = 0;
      for (let k = 0; k < 3; k++) {
        // COLOR_0 no glTF é linear; a paleta é amostrada como imagem de cor sRGB.
        const linear = Math.max(0, Math.min(1, cores[v * 3 + k]));
        const srgb = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
        id = id * 16 + Math.round(srgb * 15);
      }
      uv[v * 2] = ((id % 64) + 0.5) / 64;
      uv[v * 2 + 1] = (Math.floor(id / 64) + 0.5) / 64;
    }
    return { P, T: uv, I, tex, texW };
  }
  const img = g.images[g.textures ? g.textures[ti].source : ti];
  const ibv = g.bufferViews[img.bufferView];
  const jpg = bin.subarray(ibv.byteOffset ?? 0, (ibv.byteOffset ?? 0) + ibv.byteLength);
  const tex = await sharp(jpg).resize(texW, texW, { fit: "fill" }).removeAlpha().raw().toBuffer();
  return { P, T, I, tex, texW };
}

/** Amostra a textura em (u, v) → [r, g, b] 0..255 (vizinho mais próximo). */
export function amostra(m: MalhaTex, u: number, v: number): [number, number, number] {
  const W = m.texW;
  const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))),
    y = Math.min(W - 1, Math.max(0, Math.floor(v * W)));
  const i = (y * W + x) * 3;
  return [m.tex[i], m.tex[i + 1], m.tex[i + 2]];
}

/** Solda vértices pela posição (o Tripo duplica nas costuras de UV) → id soldado de cada vértice. */
export function soldar(P: Float32Array, eps = 1e-6) {
  const mapa = new Map<string, number>(),
    id = new Uint32Array(P.length / 3);
  let n = 0;
  for (let v = 0; v < id.length; v++) {
    const k = `${Math.round(P[v * 3] / eps)},${Math.round(P[v * 3 + 1] / eps)},${Math.round(P[v * 3 + 2] / eps)}`;
    let j = mapa.get(k);
    if (j === undefined) mapa.set(k, (j = n++));
    id[v] = j;
  }
  return { id, n };
}

/** Ilhas (componentes conexos): triângulos e caixa de cada uma. */
export function ilhas(m: MalhaTex) {
  const { id, n } = soldar(m.P);
  const pai = new Uint32Array(n).map((_, i) => i);
  const raiz = (a: number) => {
    while (pai[a] !== a) a = pai[a] = pai[pai[a]];
    return a;
  };
  const une = (a: number, b: number) => {
    a = raiz(a);
    b = raiz(b);
    if (a !== b) pai[a] = b;
  };
  for (let t = 0; t < m.I.length; t += 3) {
    une(id[m.I[t]], id[m.I[t + 1]]);
    une(id[m.I[t]], id[m.I[t + 2]]);
  }
  const grupos = new Map<number, { tris: number[]; min: number[]; max: number[] }>();
  for (let t = 0; t < m.I.length; t += 3) {
    const r = raiz(id[m.I[t]]);
    let g = grupos.get(r);
    if (!g) grupos.set(r, (g = { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }));
    g.tris.push(t / 3);
    for (let k = 0; k < 3; k++) {
      const v = m.I[t + k];
      for (let a = 0; a < 3; a++) {
        g.min[a] = Math.min(g.min[a], m.P[v * 3 + a]);
        g.max[a] = Math.max(g.max[a], m.P[v * 3 + a]);
      }
    }
  }
  return [...grupos.values()];
}

/** Sub-malha só com os triângulos dados (vértices reindexados na ordem em que aparecem). */
export function subMalha(m: MalhaTex, tris: number[]): MalhaTex {
  const novo = new Map<number, number>(),
    P: number[] = [],
    T: number[] = [],
    I: number[] = [];
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      const v = m.I[t * 3 + k];
      let j = novo.get(v);
      if (j === undefined) {
        novo.set(v, (j = P.length / 3));
        P.push(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]);
        T.push(m.T[v * 2], m.T[v * 2 + 1]);
      }
      I.push(j);
    }
  return { P: new Float32Array(P), T: new Float32Array(T), I: new Uint32Array(I), tex: m.tex, texW: m.texW };
}

const dentro = (r: Regiao, x: number, y: number, z = 0) =>
  x > (r.xMin ?? -Infinity) &&
  x < (r.xMax ?? Infinity) &&
  y > (r.yMin ?? -Infinity) &&
  y < (r.yMax ?? Infinity) &&
  z > (r.zMin ?? -Infinity) &&
  z < (r.zMax ?? Infinity);

/**
 * Recorta da folha os objetos cujo centro cai na região. Guarda em cache (chave: arquivo, tamanho, data, região,
 * textura); as rodadas seguintes só leem os binários.
 */
export async function recortar(arquivo: string, regiao: Regiao, texW: number, cache: string): Promise<MalhaTex> {
  const st = statSync(arquivo);
  // hash do texto todo: o fim dele sozinho (só o y da região) repetia entre peças da mesma linha da folha
  const chave = createHash("sha1")
    .update(JSON.stringify(["cena-v2", arquivo, st.size, st.mtimeMs, regiao, texW]))
    .digest("hex");
  const base = join(cache, chave);
  if (existsSync(base + ".tex")) {
    const ler = (ext: string) => {
      const b = readFileSync(base + ext);
      return copiaBytes(b.buffer, b.byteOffset, b.byteLength);
    };
    return {
      P: new Float32Array(ler(".P")),
      T: new Float32Array(ler(".T")),
      I: new Uint32Array(ler(".I")),
      tex: readFileSync(base + ".tex"),
      texW,
    };
  }
  const m = await lerGLB(arquivo, texW);
  const tris: number[] = [];
  for (const g of ilhas(m)) {
    const larga = g.max[0] - g.min[0] > 1.6 * ((regiao.xMax ?? Infinity) - (regiao.xMin ?? -Infinity));
    const alta = g.max[1] - g.min[1] > 1.6 * ((regiao.yMax ?? Infinity) - (regiao.yMin ?? -Infinity));
    if (larga || alta)
      for (const t of g.tris) {
        const c = [0, 1, 2].map(
          (e) => (m.P[m.I[t * 3] * 3 + e] + m.P[m.I[t * 3 + 1] * 3 + e] + m.P[m.I[t * 3 + 2] * 3 + e]) / 3,
        );
        if (dentro(regiao, c[0], c[1], c[2])) tris.push(t);
      }
    else if (dentro(regiao, (g.min[0] + g.max[0]) / 2, (g.min[1] + g.max[1]) / 2, (g.min[2] + g.max[2]) / 2))
      for (const t of g.tris) tris.push(t);
  }
  if (!tris.length) throw new Error(`Recorte vazio: ${arquivo} ${JSON.stringify(regiao)}`);
  const s = subMalha(m, tris);
  mkdirSync(cache, { recursive: true });
  writeFileSync(base + ".P", Buffer.from(s.P.buffer));
  writeFileSync(base + ".T", Buffer.from(s.T.buffer));
  writeFileSync(base + ".I", Buffer.from(s.I.buffer));
  writeFileSync(base + ".tex", s.tex);
  return s;
}

export function caixa(P: ArrayLike<number>) {
  const mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < P.length; i += 3)
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], P[i + k]);
      mx[k] = Math.max(mx[k], P[i + k]);
    }
  return { mn, mx };
}

/**
 * Rasteriza triângulos (z-buffer, luz de lado) num PNG. Vistas: "frente" (olhando de +z), "lado" (de +x).
 * `corTri(t)` → [r, g, b] 0..255; `caixaFixa` enquadra uma região (senão, a caixa de P).
 */
export async function desenhar(
  arquivo: string,
  P: ArrayLike<number>,
  I: ArrayLike<number>,
  corTri: (t: number) => number[],
  opc: { vista?: "frente" | "lado"; W?: number; caixaFixa?: { mn: number[]; mx: number[] } } = {},
) {
  const vista = opc.vista ?? "frente",
    W = opc.W ?? 800;
  const pz = (v: number) => (vista === "frente" ? P[v * 3 + 2] : P[v * 3]);
  const px0 = (v: number) => (vista === "lado" ? -P[v * 3 + 2] : P[v * 3]);
  const { mn, mx } = opc.caixaFixa ?? caixa(P);
  const xmin = vista === "lado" ? -mx[2] : mn[0],
    xmax = vista === "lado" ? -mn[2] : mx[0];
  const s = (W - 60) / Math.max(xmax - xmin, mx[1] - mn[1]);
  const H = Math.ceil((mx[1] - mn[1]) * s) + 60;
  const zb = new Float32Array(W * H).fill(-1e9),
    col = Buffer.alloc(W * H * 3, 38);
  const L = [0.3, 0.5, 0.81];
  for (let t = 0; t < I.length / 3; t++) {
    const vs = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]];
    const X = vs.map((v) => 30 + (px0(v) - xmin) * s),
      Y = vs.map((v) => 30 + (mx[1] - P[v * 3 + 1]) * s),
      Z = vs.map(pz);
    const area = (X[1] - X[0]) * (Y[2] - Y[0]) - (X[2] - X[0]) * (Y[1] - Y[0]);
    if (Math.abs(area) < 1e-12) continue;
    const e1 = [X[1] - X[0], -(Y[1] - Y[0]), (Z[1] - Z[0]) * s],
      e2 = [X[2] - X[0], -(Y[2] - Y[0]), (Z[2] - Z[0]) * s];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const ln = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((q) => q / ln);
    if (n[2] < 0) n = n.map((q) => -q);
    const sh = 0.5 + 0.5 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const cor = corTri(t);
    const x0 = Math.max(0, Math.floor(Math.min(...X))),
      x1 = Math.min(W - 1, Math.ceil(Math.max(...X)));
    const y0 = Math.max(0, Math.floor(Math.min(...Y))),
      y1 = Math.min(H - 1, Math.ceil(Math.max(...Y)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5,
          qy = y + 0.5;
        const w0 = ((X[1] - qx) * (Y[2] - qy) - (X[2] - qx) * (Y[1] - qy)) / area;
        const w1 = ((X[2] - qx) * (Y[0] - qy) - (X[0] - qx) * (Y[2] - qy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * Z[0] + w1 * Z[1] + w2 * Z[2],
          o = y * W + x;
        if (z <= zb[o]) continue;
        zb[o] = z;
        for (let k = 0; k < 3; k++) col[o * 3 + k] = Math.min(255, cor[k] * sh);
      }
  }
  await sharp(col, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toFile(arquivo);
}
