/* v8.0 — uma pose T exportada (tools/lib/exportar.ts: .glb com cor por face numa paleta) com a TEXTURA de verdade no
   lugar da paleta, para levar a outro programa: o Mixamo (que aceita .obj/.zip, não .glb) e o Blender. Mantenedor
   2026-10-25: "manda pra mim o glb da deusa que vou tentar fazer o rig padrão mais caprichado".

   Uso:  node tools/pacote-textura.ts <pasta> <nome> <saida>
     lê <pasta>/<nome>.glb, <nome>_uv.bin (Float32, 6 por triângulo, na ordem do .glb — build/tmp/deusas_proj.ts
     --textura) e <nome>_tex.webp; grava em <saida>/: <nome>.glb (UV + textura PNG embutida), <nome>.obj + .mtl +
     <nome>_textura.png (posições soldadas: o rig não rasga a malha; UV por canto). Metros, Y para cima, frente +Z. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const [pasta, nome, saida] = process.argv.slice(2);
if (!pasta || !nome || !saida) throw new Error("uso: node tools/pacote-textura.ts <pasta> <nome> <saida>");
mkdirSync(saida, { recursive: true });

/* ---- a pose T: posições por canto (3 por triângulo, na ordem das faces) ---- */
const glb = readFileSync(join(pasta, nome + ".glb"));
const jl = glb.readUInt32LE(12),
  gltf = JSON.parse(glb.subarray(20, 20 + jl).toString("utf8")),
  bin = glb.subarray(20 + jl + 8);
const acP = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION],
  bvP = gltf.bufferViews[acP.bufferView],
  o0 = bin.byteOffset + (bvP.byteOffset ?? 0) + (acP.byteOffset ?? 0);
const P = new Float32Array(bin.buffer.slice(o0, o0 + acP.count * 12)),
  nt = acP.count / 3;
const ub = readFileSync(join(pasta, nome + "_uv.bin")),
  UV = new Float32Array(ub.buffer.slice(ub.byteOffset, ub.byteOffset + ub.byteLength));
if (UV.length !== nt * 6) throw new Error(`${UV.length / 6} UVs para ${nt} triângulos`);
const png = await sharp(join(pasta, nome + "_tex.webp"))
  .png()
  .toBuffer();

function normalFace(t: number) {
  const a = t * 9,
    u = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]],
    w = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]];
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]],
    l = Math.hypot(n[0], n[1], n[2]) || 1;
  return n.map((v) => v / l);
}

/* ---- .glb: posição, normal da face, UV (origem em cima à esquerda, como no glTF) e a textura PNG ---- */
{
  const N = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) {
    const n = normalFace(t);
    for (let k = 0; k < 3; k++) N.set(n, t * 9 + k * 3);
  }
  const mn = [Infinity, Infinity, Infinity],
    mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3)
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], P[i + k]);
      mx[k] = Math.max(mx[k], P[i + k]);
    }
  const partes = [Buffer.from(P.buffer), Buffer.from(N.buffer), Buffer.from(UV.buffer), png];
  const vistas: { buffer: 0; byteOffset: number; byteLength: number }[] = [];
  let off = 0;
  for (const b of partes) {
    vistas.push({ buffer: 0, byteOffset: off, byteLength: b.length });
    off += Math.ceil(b.length / 4) * 4;
  }
  const corpo = Buffer.alloc(off);
  partes.forEach((b, i) => b.copy(corpo, vistas[i].byteOffset));
  const g = {
    asset: { version: "2.0", generator: "Crônicas dos Imortais — tools/pacote-textura.ts" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: nome, mesh: 0 }],
    meshes: [{ name: nome, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0 }] }],
    materials: [
      {
        name: nome + "_textura",
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 },
      },
    ],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987 }], // LINEAR / LINEAR_MIPMAP_LINEAR
    images: [{ bufferView: 3, mimeType: "image/png" }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: nt * 3, type: "VEC3", min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: nt * 3, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: nt * 3, type: "VEC2" },
    ],
    bufferViews: vistas,
    buffers: [{ byteLength: corpo.length }],
  };
  let json = Buffer.from(JSON.stringify(g));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const cab = Buffer.alloc(12);
  cab.writeUInt32LE(0x46546c67, 0);
  cab.writeUInt32LE(2, 4);
  cab.writeUInt32LE(12 + 8 + json.length + 8 + corpo.length, 8);
  const pedaco = (tipo: number, dados: Buffer) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(dados.length, 0);
    h.writeUInt32LE(tipo, 4);
    return Buffer.concat([h, dados]);
  };
  writeFileSync(join(saida, nome + ".glb"), Buffer.concat([cab, pedaco(0x4e4f534a, json), pedaco(0x004e4942, corpo)]));
}

/* ---- .obj + .mtl + .png: posições soldadas, UV por canto (v para cima no OBJ) ---- */
{
  const idx = new Map<string, number>(),
    v: string[] = [],
    vt: string[] = [],
    f: string[] = [];
  const vert = (i: number) => {
    const k = `${Math.round(P[i] * 1e5)},${Math.round(P[i + 1] * 1e5)},${Math.round(P[i + 2] * 1e5)}`;
    let j = idx.get(k);
    if (j === undefined) {
      idx.set(k, (j = v.length + 1));
      v.push(`v ${P[i].toFixed(5)} ${P[i + 1].toFixed(5)} ${P[i + 2].toFixed(5)}`);
    }
    return j;
  };
  for (let t = 0; t < nt; t++) {
    const a = vert(t * 9),
      b = vert(t * 9 + 3),
      c = vert(t * 9 + 6);
    for (let k = 0; k < 3; k++) vt.push(`vt ${UV[t * 6 + k * 2].toFixed(6)} ${(1 - UV[t * 6 + k * 2 + 1]).toFixed(6)}`);
    if (a !== b && b !== c && a !== c) f.push(`f ${a}/${t * 3 + 1} ${b}/${t * 3 + 2} ${c}/${t * 3 + 3}`);
  }
  writeFileSync(join(saida, nome + "_textura.png"), png);
  writeFileSync(
    join(saida, nome + ".mtl"),
    `newmtl ${nome}_textura\nKd 1 1 1\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1\nmap_Kd ${nome}_textura.png\n`,
  );
  writeFileSync(
    join(saida, nome + ".obj"),
    [`mtllib ${nome}.mtl`, `o ${nome}`, ...v, ...vt, `usemtl ${nome}_textura`, "s 1", ...f, ""].join("\n"),
  );
  console.log(`${saida}/${nome}.glb e .obj/.mtl/_textura.png: ${nt} triângulos, ${v.length} vértices soldados`);
}
