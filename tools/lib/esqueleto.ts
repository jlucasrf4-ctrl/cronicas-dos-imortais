/* ==== v7.7 — leitura de um .glb com esqueleto e animações (rig do Tripo/Mixamo) e skinning em software ====
   Usado por tools/gerar-animacoes.ts. Matrizes 4×4 em coluna (como o glTF). O .glb tem 1 malha com JOINTS_0/WEIGHTS_0,
   1 skin e várias animações (translation/rotation/scale por junta, interpolação linear). */
import { readFileSync } from "node:fs";
import sharp from "sharp";

export type M4 = Float64Array;
interface Acessor {
  bufferView: number;
  byteOffset?: number;
  count: number;
  type: string;
  componentType: number;
  normalized?: boolean;
}
interface No {
  name?: string;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
  mesh?: number;
  skin?: number;
}
interface Gltf {
  nodes: No[];
  scenes: { nodes: number[] }[];
  accessors: Acessor[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  animations: {
    name: string;
    channels: { sampler: number; target: { node: number; path: string } }[];
    samplers: { input: number; output: number; interpolation?: string }[];
  }[];
  materials: { pbrMetallicRoughness: { baseColorTexture?: { index: number } } }[];
  textures: { source: number }[];
  images: { bufferView: number }[];
}

const N_COMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function ler(g: Gltf, bin: Buffer, i: number): Float64Array {
  const a = g.accessors[i],
    bv = g.bufferViews[a.bufferView],
    n = N_COMP[a.type];
  const tam = { 5126: 4, 5125: 4, 5123: 2, 5121: 1, 5122: 2, 5120: 1 }[a.componentType]!;
  const passo = bv.byteStride ?? n * tam,
    base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * n);
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < n; c++) {
      const o = base + k * passo + c * tam;
      let v =
        a.componentType === 5126
          ? bin.readFloatLE(o)
          : a.componentType === 5125
            ? bin.readUInt32LE(o)
            : a.componentType === 5123
              ? bin.readUInt16LE(o)
              : a.componentType === 5121
                ? bin.readUInt8(o)
                : a.componentType === 5122
                  ? bin.readInt16LE(o)
                  : bin.readInt8(o);
      if (a.normalized) v /= a.componentType === 5121 ? 255 : a.componentType === 5123 ? 65535 : 1;
      out[k * n + c] = v;
    }
  return out;
}

/* ---------- matrizes ---------- */
export function m4id(): M4 {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
export function m4mul(a: M4, b: M4): M4 {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
export function m4trs(t: ArrayLike<number>, q: ArrayLike<number>, s: ArrayLike<number>): M4 {
  const [x, y, z, w] = [q[0], q[1], q[2], q[3]];
  const m = new Float64Array(16);
  m[0] = (1 - 2 * (y * y + z * z)) * s[0];
  m[1] = 2 * (x * y + z * w) * s[0];
  m[2] = 2 * (x * z - y * w) * s[0];
  m[4] = 2 * (x * y - z * w) * s[1];
  m[5] = (1 - 2 * (x * x + z * z)) * s[1];
  m[6] = 2 * (y * z + x * w) * s[1];
  m[8] = 2 * (x * z + y * w) * s[2];
  m[9] = 2 * (y * z - x * w) * s[2];
  m[10] = (1 - 2 * (x * x + y * y)) * s[2];
  m[12] = t[0];
  m[13] = t[1];
  m[14] = t[2];
  m[15] = 1;
  return m;
}

/* ---------- o .glb animado ---------- */
export interface Clip {
  nome: string;
  duracao: number;
  /** por nó animado: tempos e valores de cada caminho */
  canais: { no: number; caminho: "translation" | "rotation" | "scale"; t: Float64Array; v: Float64Array }[];
}
export interface Rig {
  nos: No[];
  pais: Int32Array;
  raizes: number[];
  juntas: number[]; // índice de nó de cada junta da skin
  ibm: M4[]; // matriz inversa de bind de cada junta
  /** malha: posições, normais, UV, juntas e pesos por vértice; índices de triângulo */
  P: Float64Array;
  UV: Float64Array;
  J: Float64Array;
  W: Float64Array;
  I: Uint32Array;
  tex: { dados: Buffer; lado: number };
  clips: Clip[];
}

export async function lerRig(arquivo: string): Promise<Rig> {
  const buf = readFileSync(arquivo);
  const jl = buf.readUInt32LE(12);
  const g = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8")) as Gltf;
  const bl = buf.readUInt32LE(20 + jl);
  const bin = Buffer.from(buf.subarray(28 + jl, 28 + jl + bl));
  const pais = new Int32Array(g.nodes.length).fill(-1);
  g.nodes.forEach((n, i) => n.children?.forEach((c) => (pais[c] = i)));
  const pr = g.meshes[0].primitives[0],
    at = pr.attributes;
  const P = ler(g, bin, at.POSITION),
    UV = ler(g, bin, at.TEXCOORD_0),
    J = ler(g, bin, at.JOINTS_0),
    W = ler(g, bin, at.WEIGHTS_0);
  const I =
    pr.indices != null
      ? Uint32Array.from(ler(g, bin, pr.indices))
      : Uint32Array.from({ length: P.length / 3 }, (_, i) => i);
  const skin = g.skins[0],
    ibmF = ler(g, bin, skin.inverseBindMatrices);
  const ibm = skin.joints.map((_, j) => Float64Array.from(ibmF.subarray(j * 16, j * 16 + 16)));
  const mat = g.materials[pr.material ?? 0],
    ti = mat.pbrMetallicRoughness.baseColorTexture?.index ?? 0;
  const ibv = g.bufferViews[g.images[g.textures[ti].source].bufferView];
  const img = sharp(bin.subarray(ibv.byteOffset ?? 0, (ibv.byteOffset ?? 0) + ibv.byteLength));
  const meta = await img.metadata();
  const dados = await img.removeAlpha().raw().toBuffer();
  const clips: Clip[] = g.animations.map((a) => {
    let duracao = 0;
    const canais = a.channels.map((c) => {
      const s = a.samplers[c.sampler];
      const t = ler(g, bin, s.input),
        v = ler(g, bin, s.output);
      duracao = Math.max(duracao, t[t.length - 1]);
      return { no: c.target.node, caminho: c.target.path as Clip["canais"][number]["caminho"], t, v };
    });
    return { nome: a.name, duracao, canais };
  });
  return {
    nos: g.nodes,
    pais,
    raizes: g.scenes[0].nodes,
    juntas: skin.joints,
    ibm,
    P,
    UV,
    J,
    W,
    I,
    tex: { dados, lado: meta.width ?? 1 },
    clips,
  };
}

/** Valor de um canal no tempo t (linear; rotação com slerp). */
function amostrar(c: Clip["canais"][number], t: number) {
  const n = c.caminho === "rotation" ? 4 : 3,
    T = c.t;
  if (t <= T[0]) return Array.from(c.v.subarray(0, n));
  if (t >= T[T.length - 1]) return Array.from(c.v.subarray((T.length - 1) * n, T.length * n));
  let k = 0;
  while (T[k + 1] < t) k++;
  const f = (t - T[k]) / (T[k + 1] - T[k] || 1),
    a = c.v.subarray(k * n, k * n + n),
    b = c.v.subarray((k + 1) * n, (k + 1) * n + n);
  if (n === 3) return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * f);
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  let wa = 1 - f,
    wb = f * s;
  if (d < 0.9995) {
    const th = Math.acos(d),
      sn = Math.sin(th);
    wa = Math.sin((1 - f) * th) / sn;
    wb = (Math.sin(f * th) / sn) * s;
  }
  const q = [0, 1, 2, 3].map((i) => a[i] * wa + b[i] * wb);
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return q.map((v) => v / l);
}

/** Translação, rotação (quatérnio) e escala locais de cada nó no tempo t do clip (sem clip: a pose de repouso). */
export function poseLocal(rig: Rig, clip: Clip | null, t: number) {
  const loc = rig.nos.map((n) => ({
    t: n.translation ?? [0, 0, 0],
    r: n.rotation ?? [0, 0, 0, 1],
    s: n.scale ?? [1, 1, 1],
  }));
  if (clip)
    for (const c of clip.canais) {
      const v = amostrar(c, t);
      if (c.caminho === "translation") loc[c.no].t = v;
      else if (c.caminho === "rotation") loc[c.no].r = v;
      else loc[c.no].s = v;
    }
  return loc;
}

/** Matriz global de cada nó no tempo t do clip (sem clip: a pose de repouso). */
export function poseGlobal(rig: Rig, clip: Clip | null, t: number): M4[] {
  const loc = poseLocal(rig, clip, t);
  const glob: (M4 | null)[] = rig.nos.map(() => null);
  const calc = (i: number): M4 => {
    const ja = glob[i];
    if (ja) return ja;
    const n = rig.nos[i];
    const l = n.matrix ? Float64Array.from(n.matrix) : m4trs(loc[i].t, loc[i].r, loc[i].s);
    return (glob[i] = rig.pais[i] >= 0 ? m4mul(calc(rig.pais[i]), l) : l);
  };
  return rig.nos.map((_, i) => calc(i));
}

/** Matrizes de skinning (global da junta × inversa de bind) de cada junta. */
export function matrizesSkin(rig: Rig, glob: M4[]): M4[] {
  return rig.juntas.map((no, j) => m4mul(glob[no], rig.ibm[j]));
}

/** Posições dos vértices deformadas pelas matrizes de skinning. */
export function deformar(rig: Rig, skin: M4[]): Float64Array {
  const P = rig.P,
    out = new Float64Array(P.length);
  for (let v = 0; v < P.length / 3; v++) {
    const x = P[v * 3],
      y = P[v * 3 + 1],
      z = P[v * 3 + 2];
    let ox = 0,
      oy = 0,
      oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = rig.W[v * 4 + k];
      if (!w) continue;
      const m = skin[rig.J[v * 4 + k]];
      ox += w * (m[0] * x + m[4] * y + m[8] * z + m[12]);
      oy += w * (m[1] * x + m[5] * y + m[9] * z + m[13]);
      oz += w * (m[2] * x + m[6] * y + m[10] * z + m[14]);
    }
    out[v * 3] = ox;
    out[v * 3 + 1] = oy;
    out[v * 3 + 2] = oz;
  }
  return out;
}

/** Cor (0..255) da textura no centro de UV de cada triângulo (a paleta: uma cor por face). */
export function coresDasFaces(rig: Rig): Uint8Array {
  const nt = rig.I.length / 3,
    L = rig.tex.lado,
    out = new Uint8Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    let u = 0,
      v = 0;
    for (let k = 0; k < 3; k++) {
      u += rig.UV[rig.I[t * 3 + k] * 2] / 3;
      v += rig.UV[rig.I[t * 3 + k] * 2 + 1] / 3;
    }
    const x = Math.min(L - 1, Math.max(0, Math.floor(u * L))),
      y = Math.min(L - 1, Math.max(0, Math.floor(v * L)));
    for (let c = 0; c < 3; c++) out[t * 3 + c] = rig.tex.dados[(y * L + x) * 3 + c];
  }
  return out;
}
