/* ==== v7.7 — exporta uma malha do jogo (cor por face) para programas de rigging/animação ====
   Entrada: uma Peca (tools/lib/personagem.ts), no espaço do jogo (pés em y=0, frente +x, direita +z).
   Saída em metros, Y para cima e frente +Z (o padrão do glTF, do Blender e do Mixamo):
     - <nome>.glb: faces separadas (cor por face), textura de paleta com amostragem "nearest";
     - <nome>.obj + .mtl + .png: posições soldadas (o rig não rasga a malha), UV por face na mesma paleta.
   A cor de cada face vira um pixel da paleta; os 3 vértices da face apontam para o centro desse pixel. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { Peca } from "./personagem.ts";

/** Paleta: uma cor única por pixel, lado potência de 2; UV (origem em cima à esquerda, como no glTF) de cada face. */
function paleta(m: Peca) {
  const nt = m.p.length / 9,
    indice = new Map<number, number>(),
    cores: number[] = [],
    deFace = new Uint32Array(nt);
  for (let t = 0; t < nt; t++) {
    const rgb = [0, 1, 2].map((k) => Math.round(Math.min(1, Math.max(0, m.c[t * 9 + k])) * 255));
    const chave = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    let i = indice.get(chave);
    if (i === undefined) {
      indice.set(chave, (i = cores.length / 3));
      cores.push(...rgb);
    }
    deFace[t] = i;
  }
  let N = 2;
  while (N * N < cores.length / 3) N *= 2;
  const img = Buffer.alloc(N * N * 3, 0);
  img.set(cores);
  const uv = (i: number) => [((i % N) + 0.5) / N, (Math.floor(i / N) + 0.5) / N];
  return { N, img, deFace, uv, n: cores.length / 3 };
}

/** Posição no espaço exportado (metros, frente +Z). */
function paraExport(m: Peca, escala: number) {
  const P = new Float32Array(m.p.length);
  for (let i = 0; i < m.p.length; i += 3) {
    P[i] = -m.p[i + 2] * escala; // direita do jogo (+z) → -X (frente +Z)
    P[i + 1] = m.p[i + 1] * escala;
    P[i + 2] = m.p[i] * escala; // frente do jogo (+x) → +Z
  }
  return P;
}

function normalFace(P: Float32Array, t: number) {
  const a = t * 9;
  const u = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]],
    w = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]];
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return n.map((v) => v / l);
}

/** Grava <pasta>/<nome>.glb, .obj, .mtl e .png; `altura` em metros (a malha é escalada para ela). */
export async function exportarMalha(m: Peca, pasta: string, nome: string, altura: number) {
  let ymax = 0;
  for (let i = 1; i < m.p.length; i += 3) ymax = Math.max(ymax, m.p[i]);
  const escala = altura / ymax,
    P = paraExport(m, escala),
    nt = P.length / 9,
    pal = paleta(m);
  const png = await sharp(pal.img, { raw: { width: pal.N, height: pal.N, channels: 3 } })
    .png()
    .toBuffer();
  writeFileSync(join(pasta, nome + ".png"), png);

  /* ---- glTF binário ---- */
  const N = new Float32Array(nt * 9),
    UV = new Float32Array(nt * 6);
  for (let t = 0; t < nt; t++) {
    const n = normalFace(P, t),
      uv = pal.uv(pal.deFace[t]);
    for (let k = 0; k < 3; k++) {
      N.set(n, t * 9 + k * 3);
      UV.set(uv, t * 6 + k * 2);
    }
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
  const bin = Buffer.alloc(off);
  partes.forEach((b, i) => b.copy(bin, vistas[i].byteOffset));
  const gltf = {
    asset: { version: "2.0", generator: "Crônicas dos Imortais — tools/lib/exportar.ts" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: nome, mesh: 0 }],
    meshes: [{ name: nome, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0 }] }],
    materials: [
      {
        name: nome + "_paleta",
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 },
      },
    ],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728 }], // NEAREST: cada face fica com a sua cor exata
    images: [{ bufferView: 3, mimeType: "image/png" }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: nt * 3, type: "VEC3", min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: nt * 3, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: nt * 3, type: "VEC2" },
    ],
    bufferViews: vistas,
    buffers: [{ byteLength: bin.length }],
  };
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const cab = Buffer.alloc(12);
  cab.writeUInt32LE(0x46546c67, 0); // "glTF"
  cab.writeUInt32LE(2, 4);
  cab.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const pedaco = (tipo: number, dados: Buffer) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(dados.length, 0);
    h.writeUInt32LE(tipo, 4);
    return Buffer.concat([h, dados]);
  };
  writeFileSync(join(pasta, nome + ".glb"), Buffer.concat([cab, pedaco(0x4e4f534a, json), pedaco(0x004e4942, bin)]));

  /* ---- OBJ + MTL: posições soldadas, UV e normal por face ---- */
  const idx = new Map<string, number>(),
    v: string[] = [],
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
  const vt: string[] = [];
  for (let i = 0; i < pal.n; i++) {
    const [u, w] = pal.uv(i);
    vt.push(`vt ${u.toFixed(6)} ${(1 - w).toFixed(6)}`); // OBJ: v cresce para cima
  }
  const vn: string[] = [];
  for (let t = 0; t < nt; t++) {
    const n = normalFace(P, t);
    vn.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`);
    const a = vert(t * 9),
      b = vert(t * 9 + 3),
      c = vert(t * 9 + 6),
      tex = pal.deFace[t] + 1;
    if (a !== b && b !== c && a !== c) f.push(`f ${a}/${tex}/${t + 1} ${b}/${tex}/${t + 1} ${c}/${tex}/${t + 1}`);
  }
  writeFileSync(
    join(pasta, nome + ".mtl"),
    `newmtl ${nome}_paleta\nKd 1 1 1\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1\nmap_Kd ${nome}.png\n`,
  );
  writeFileSync(
    join(pasta, nome + ".obj"),
    [`mtllib ${nome}.mtl`, `o ${nome}`, ...v, ...vt, ...vn, `usemtl ${nome}_paleta`, "s off", ...f, ""].join("\n"),
  );
  return { triangulos: nt, vertices: v.length, cores: pal.n, lado: pal.N, alturaM: altura };
}
