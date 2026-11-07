/* ==== v8.1 — Modo Editor: um .glb qualquer → modelo do jogo (a biblioteca, src/editor/modelos.ts) ====
   O mantenedor joga o .glb em modelos-novos/; o servidor ao vivo (tools/vite-plugin-jogo.ts) chama importarPasta, que
   converte cada arquivo novo ou mudado e grava src/assets/editor/modelos.json (+ a textura <nome>.webp). Também roda
   sozinho:  node tools/lib/importar.ts  (converte a pasta inteira de novo com --tudo).

   Conversão: junta todas as malhas da cena (com as transformações dos nós), reduz para ORC.tris triângulos
   (meshoptimizer; as costuras de UV ficam presas para a textura não rasgar), centra em x/z com a base em y=0 e divide
   pela maior medida (maior medida = 1, o mesmo formato das peças da vila). Com UMA textura de cor, ela vai junto
   (ORC.tex², .webp); com várias (ou cor sem textura), a cor vai por vértice. glb comprimido (Draco/meshopt) não dá:
   exporte sem compressão. */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { MeshoptSimplifier } from "meshoptimizer";

/** tris: triângulos depois de reduzir; tex: lado da textura; qualidade do webp. */
const ORC = { tris: 4000, tex: 512, qualidade: 82 };
export const PASTA_NOVOS = "modelos-novos";
const SAIDA = "src/assets/editor";

interface Acessor {
  bufferView?: number;
  byteOffset?: number;
  count: number;
  type: string;
  componentType: number;
  normalized?: boolean;
}
interface Primitiva {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}
interface Gltf {
  accessors: Acessor[];
  bufferViews: { buffer?: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  meshes: { primitives: Primitiva[] }[];
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
  images?: { bufferView?: number; uri?: string; mimeType?: string }[];
  textures?: { source?: number }[];
  materials?: { pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } } }[];
  extensionsUsed?: string[];
}

const N_COMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
/** Lê um acessor como números (com stride e normalização). */
function ler(g: Gltf, bin: Buffer, i: number): { v: Float64Array; n: number } {
  const a = g.accessors[i],
    n = N_COMP[a.type],
    bv = a.bufferView != null ? g.bufferViews[a.bufferView] : null,
    tam = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>)[a.componentType],
    passo = bv?.byteStride || n * tam,
    base = (bv?.byteOffset ?? 0) + (a.byteOffset ?? 0),
    v = new Float64Array(a.count * n);
  if (!bv) return { v, n };
  const max = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 1, 5126: 1 }[a.componentType] ?? 1;
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < n; c++) {
      const o = base + k * passo + c * tam;
      let x: number;
      switch (a.componentType) {
        case 5126:
          x = bin.readFloatLE(o);
          break;
        case 5125:
          x = bin.readUInt32LE(o);
          break;
        case 5123:
          x = bin.readUInt16LE(o);
          break;
        case 5122:
          x = bin.readInt16LE(o);
          break;
        case 5121:
          x = bin.readUInt8(o);
          break;
        default:
          x = bin.readInt8(o);
      }
      v[k * n + c] = a.normalized && a.componentType !== 5126 ? x / max : x;
    }
  return { v, n };
}

type M = number[];
const ID: M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a: M, b: M): M {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function matrizNo(n: NonNullable<Gltf["nodes"]>[number]): M {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation || [0, 0, 0],
    [x, y, z, w] = n.rotation || [0, 0, 0, 1],
    [sx, sy, sz] = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

export interface ModeloImportado {
  nome: string;
  tam: number[];
  p: string;
  i: string;
  uv?: string;
  c?: string;
  tex?: string;
}
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

/** Um nome de arquivo → chave segura ("Casa Velha (2).glb" → "casa_velha_2"). */
export function chaveDe(arquivo: string) {
  return (
    basename(arquivo)
      .replace(/\.glb$/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "modelo"
  );
}

/** Converte um .glb. `raiz` = a pasta do projeto. */
export async function importarGlb(raiz: string, arquivo: string): Promise<ModeloImportado> {
  const buf = readFileSync(arquivo);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("não é um .glb");
  const jl = buf.readUInt32LE(12),
    g = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8")) as Gltf;
  const comp = (g.extensionsUsed || []).filter((e) => /draco|meshopt/i.test(e));
  if (comp.length) throw new Error("glb comprimido (" + comp.join(", ") + "): exporte sem compressão");
  const bl = 28 + jl <= buf.length ? buf.readUInt32LE(20 + jl) : 0,
    bin = Buffer.from(buf.subarray(28 + jl, 28 + jl + bl));

  // texturas usadas (índice da imagem) e a cor base de cada material
  const imagem = (mat?: number) => {
    const t = mat != null ? g.materials?.[mat]?.pbrMetallicRoughness?.baseColorTexture : undefined;
    if (!t) return -1;
    return g.textures?.[t.index]?.source ?? t.index;
  };
  const corBase = (mat?: number) =>
    (mat != null && g.materials?.[mat]?.pbrMetallicRoughness?.baseColorFactor) || [1, 1, 1, 1];
  const bytesImagem = (ii: number) => {
    const im = g.images![ii];
    if (im.bufferView != null) {
      const bv = g.bufferViews[im.bufferView];
      return bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    }
    if (im.uri?.startsWith("data:")) return Buffer.from(im.uri.slice(im.uri.indexOf(",") + 1), "base64");
    throw new Error("textura fora do .glb (" + im.uri + "): use um .glb com tudo dentro");
  };

  // todas as primitivas, com a matriz do nó
  const prims: { p: Primitiva; m: M }[] = [];
  const andar = (ni: number, pai: M) => {
    const n = g.nodes![ni],
      m = mul(pai, matrizNo(n));
    if (n.mesh != null) for (const p of g.meshes[n.mesh].primitives) prims.push({ p, m });
    for (const c of n.children || []) andar(c, m);
  };
  const raizes = g.scenes?.[g.scene ?? 0]?.nodes;
  if (g.nodes && raizes) for (const r of raizes) andar(r, ID);
  else for (const me of g.meshes) for (const p of me.primitives) prims.push({ p, m: ID });
  const tri = prims.filter((q) => (q.p.mode ?? 4) === 4);
  if (!tri.length) throw new Error("sem triângulos");

  const imgs = new Set(tri.map((q) => imagem(q.p.material)).filter((x) => x >= 0));
  const comTextura =
    imgs.size === 1 && tri.every((q) => q.p.attributes.TEXCOORD_0 != null && imagem(q.p.material) >= 0);
  const pixels = new Map<number, { d: Buffer; w: number }>();
  if (!comTextura)
    for (const ii of imgs) {
      const d = await sharp(bytesImagem(ii)).resize(256, 256, { fit: "fill" }).removeAlpha().raw().toBuffer();
      pixels.set(ii, { d, w: 256 });
    }

  const P: number[] = [],
    UV: number[] = [],
    C: number[] = [],
    I: number[] = [];
  for (const { p, m } of tri) {
    const pos = ler(g, bin, p.attributes.POSITION),
      uv = p.attributes.TEXCOORD_0 != null ? ler(g, bin, p.attributes.TEXCOORD_0) : null,
      cor = p.attributes.COLOR_0 != null ? ler(g, bin, p.attributes.COLOR_0) : null,
      base = P.length / 3,
      nv = pos.v.length / 3,
      fator = corBase(p.material),
      ii = imagem(p.material),
      px = pixels.get(ii);
    for (let k = 0; k < nv; k++) {
      const x = pos.v[k * 3],
        y = pos.v[k * 3 + 1],
        z = pos.v[k * 3 + 2];
      P.push(
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      );
      const u = uv ? uv.v[k * 2] : 0,
        v = uv ? uv.v[k * 2 + 1] : 0;
      if (comTextura) UV.push(u, v);
      let r = fator[0],
        gg = fator[1],
        b = fator[2];
      if (cor) {
        r *= cor.v[k * cor.n];
        gg *= cor.v[k * cor.n + 1];
        b *= cor.v[k * cor.n + 2];
      }
      if (px && uv) {
        const tx = Math.min(px.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * px.w))),
          ty = Math.min(px.w - 1, Math.max(0, Math.floor((v - Math.floor(v)) * px.w))),
          o = (ty * px.w + tx) * 3;
        r *= px.d[o] / 255;
        gg *= px.d[o + 1] / 255;
        b *= px.d[o + 2] / 255;
      }
      C.push(r, gg, b);
    }
    if (p.indices != null) for (const x of ler(g, bin, p.indices).v) I.push(base + x);
    else for (let k = 0; k < nv; k++) I.push(base + k);
  }

  // reduzir
  await MeshoptSimplifier.ready;
  const Pf = new Float32Array(P);
  let idx: Uint32Array<ArrayBufferLike> = new Uint32Array(I);
  if (idx.length / 3 > ORC.tris) {
    const alvo = ORC.tris * 3;
    let [lo] = MeshoptSimplifier.simplify(idx, Pf, 3, alvo, 0.02, comTextura ? ["LockBorder"] : []);
    if (lo.length > alvo * 1.6) [lo] = MeshoptSimplifier.simplify(idx, Pf, 3, alvo, 0.05, []);
    if (lo.length > alvo * 1.6) {
      // costuras demais (cada uma é borda solta): solda pela posição, reduz, e cada vértice soldado volta a ser um
      // dos originais (o UV na costura pode escorregar um pouco)
      const mapa = new Map<string, number>(),
        sold = new Uint32Array(P.length / 3);
      for (let v = 0; v < sold.length; v++) {
        const k = `${Math.round(P[v * 3] * 1e5)},${Math.round(P[v * 3 + 1] * 1e5)},${Math.round(P[v * 3 + 2] * 1e5)}`;
        let j = mapa.get(k);
        if (j === undefined) mapa.set(k, (j = v));
        sold[v] = j;
      }
      const soldados = idx.map((v) => sold[v]);
      [lo] = MeshoptSimplifier.simplify(soldados, Pf, 3, alvo, 0.08, []);
    }
    idx = lo;
  }
  // só os vértices usados, renumerados
  const novo = new Map<number, number>(),
    p2: number[] = [],
    uv2: number[] = [],
    c2: number[] = [],
    i2: number[] = [];
  for (const v of idx) {
    let j = novo.get(v);
    if (j === undefined) {
      novo.set(v, (j = p2.length / 3));
      p2.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      if (comTextura) uv2.push(UV[v * 2], UV[v * 2 + 1]);
      c2.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]);
    }
    i2.push(j);
  }
  if (p2.length / 3 > 65535) throw new Error("modelo grande demais mesmo reduzido");
  const mn = [Infinity, Infinity, Infinity],
    mx = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < p2.length; k += 3)
    for (let e = 0; e < 3; e++) {
      mn[e] = Math.min(mn[e], p2[k + e]);
      mx[e] = Math.max(mx[e], p2[k + e]);
    }
  const s = 1 / Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1e-9),
    cc = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  const chave = chaveDe(arquivo),
    saida: ModeloImportado = {
      nome: basename(arquivo).replace(/\.glb$/i, ""),
      tam: [0, 1, 2].map((e) => +((mx[e] - mn[e]) * s).toFixed(4)),
      p: b64(Int16Array.from(p2, (v, k) => Math.round((v - cc[k % 3]) * s * 32000))),
      i: b64(Uint16Array.from(i2)),
    };
  if (comTextura) {
    saida.uv = b64(Uint16Array.from(uv2, (v) => Math.round(Math.min(1, Math.max(0, v)) * 65535)));
    mkdirSync(join(raiz, SAIDA), { recursive: true });
    await sharp(bytesImagem([...imgs][0]))
      .resize(ORC.tex, ORC.tex, { fit: "fill" })
      .webp({ quality: ORC.qualidade })
      .toFile(join(raiz, SAIDA, chave + ".webp"));
    saida.tex = "/" + SAIDA + "/" + chave + ".webp";
  } else saida.c = b64(Uint8Array.from(c2, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255)));
  return saida;
}

/** Converte o que é novo ou mudou em modelos-novos/ e regrava o índice. Devolve o que fez. */
export async function importarPasta(raiz: string, tudo = false) {
  const pasta = join(raiz, PASTA_NOVOS),
    indice = join(raiz, SAIDA, "modelos.json"),
    marca = join(pasta, ".importados.json");
  mkdirSync(pasta, { recursive: true });
  const dados = existsSync(indice)
    ? (JSON.parse(readFileSync(indice, "utf8")) as { modelos: Record<string, ModeloImportado> })
    : { modelos: {} };
  dados.modelos ||= {};
  const vistos = existsSync(marca) && !tudo ? (JSON.parse(readFileSync(marca, "utf8")) as Record<string, string>) : {};
  const ok: string[] = [],
    erros: string[] = [];
  for (const f of readdirSync(pasta)) {
    if (!/\.glb$/i.test(f)) continue;
    const arq = join(pasta, f),
      st = statSync(arq),
      assinatura = st.size + ":" + Math.round(st.mtimeMs);
    if (vistos[f] === assinatura && dados.modelos[chaveDe(f)]) continue;
    try {
      dados.modelos[chaveDe(f)] = await importarGlb(raiz, arq);
      vistos[f] = assinatura;
      ok.push(f);
    } catch (e) {
      erros.push(f + ": " + ((e as Error).message || e));
      vistos[f] = assinatura; // não tenta de novo até o arquivo mudar
    }
  }
  if (ok.length) {
    mkdirSync(join(raiz, SAIDA), { recursive: true });
    writeFileSync(indice, JSON.stringify(dados));
  }
  writeFileSync(marca, JSON.stringify(vistos, null, 1));
  return { ok, erros, modelos: dados.modelos };
}

// sozinho: node tools/lib/importar.ts [--tudo]
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const r = await importarPasta(process.cwd(), process.argv.includes("--tudo"));
  for (const f of r.ok) console.log("importado: " + f);
  for (const e of r.erros) console.log("erro: " + e);
  console.log(Object.keys(r.modelos).length + " modelo(s) na biblioteca");
}
