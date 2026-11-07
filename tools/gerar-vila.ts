/* v8.0 — os prédios e enfeites da Vila Musgo, do FBX do Tripo COM a textura (mantenedor, 2026-10-25: entre a textura
   "esculpida" em cor por triângulo e a textura de verdade, ficou com a de verdade). O resto do cenário segue em cor
   por triângulo; só a vila usa textura (src/render/gl/vila_tex.ts lê a saída; o shader ganhou o UV e o sampler).

   Uso:  node tools/gerar-vila.ts [plano.json] [--simular]      (padrão tools/modelos/vila.json)
   O FBX é uma maquete: as peças estão no chão (y para cima, frente para +z), algumas umas sobre as outras. Cada peça do
   plano junta as ilhas de triângulos cujo centro cai na caixa x/z (e y, se dada) em unidades do FBX. A peça é centrada
   em x/z, com a base em y=0, e dividida pela maior medida (maior medida = 1); `tam` guarda as medidas nessa escala.
   Saída: { pecas: { nome: { tam, p (Int16 × 32000), uv (Uint16 × 65535), i (Uint16) } } } em base64 + a textura em
   .webp (texW²). Prévias em build/modelos/vila/ (todas as peças lado a lado, na câmera do jogo, com a textura). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { lerMalhaFbx } from "./lib/fbx.ts";
import { ilhas, type MalhaTex } from "./lib/glb.ts";

interface Caixa {
  x: [number, number];
  y?: [number, number];
  z: [number, number];
}
interface Plano {
  fbx: string;
  textura: string;
  texW: number;
  texQualidade: number;
  saida: string;
  texSaida: string;
  previas: string;
  pecas: Record<string, Caixa>;
}

const args = process.argv.slice(2);
const plano = JSON.parse(
  readFileSync(args.find((a) => !a.startsWith("--")) ?? "tools/modelos/vila.json", "utf8"),
) as Plano;
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

// FBX → triângulos com UV por canto (o v do FBX cresce para cima; o da imagem, para baixo)
const f = lerMalhaFbx(readFileSync(plano.fbx));
const P: number[] = [],
  T: number[] = [],
  I: number[] = [];
f.poli.forEach((pl, k) => {
  const base = P.length / 3;
  pl.forEach((v, c) => {
    P.push(f.P[v * 3], f.P[v * 3 + 1], f.P[v * 3 + 2]);
    T.push(f.uv[k][c][0], 1 - f.uv[k][c][1]);
  });
  for (let c = 1; c + 1 < pl.length; c++) I.push(base, base + c, base + c + 1);
});
const W = plano.texW;
const tex = await sharp(plano.textura).resize(W, W).removeAlpha().raw().toBuffer();
const m: MalhaTex = { P: new Float32Array(P), T: new Float32Array(T), I: new Uint32Array(I), tex, texW: W };
const gs = ilhas(m);

const dentro = (c: number[], cx: Caixa) =>
  c[0] > cx.x[0] && c[0] < cx.x[1] && c[2] > cx.z[0] && c[2] < cx.z[1] && (!cx.y || (c[1] > cx.y[0] && c[1] < cx.y[1]));
interface Peca {
  tam: number[];
  p: number[];
  uv: number[];
  i: number[];
}
const pecas: Record<string, Peca> = {};
const usadas = new Set<number>();
for (const [nome, cx] of Object.entries(plano.pecas)) {
  const tris: number[] = [];
  gs.forEach((g, gi) => {
    const c = [0, 1, 2].map((a) => (g.min[a] + g.max[a]) / 2);
    if (!dentro(c, cx)) return;
    if (usadas.has(gi)) console.warn(`aviso: uma ilha entrou em mais de uma peça (${nome})`);
    usadas.add(gi);
    tris.push(...g.tris);
  });
  if (!tris.length) throw new Error(`peça vazia: ${nome}`);
  // vértices reindexados (o FBX já não divide cantos com UV diferente)
  const novo = new Map<number, number>(),
    p: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      const v = m.I[t * 3 + k];
      let j = novo.get(v);
      if (j === undefined) {
        novo.set(v, (j = p.length / 3));
        p.push(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]);
        uv.push(m.T[v * 2], m.T[v * 2 + 1]);
      }
      idx.push(j);
    }
  const mn = [Infinity, Infinity, Infinity],
    mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], p[i + k]);
      mx[k] = Math.max(mx[k], p[i + k]);
    }
  const s = 1 / Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]),
    c = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) p[i + k] = (p[i + k] - c[k]) * s;
  pecas[nome] = { tam: [0, 1, 2].map((k) => +((mx[k] - mn[k]) * s).toFixed(4)), p, uv, i: idx };
  console.log(`${nome}: ${tris.length} triângulos, ${p.length / 3} vértices, tam ${pecas[nome].tam.join(" × ")}`);
}

// prévia: todas as peças numa fileira de células, câmera do jogo (50° de cima), textura por pixel
mkdirSync(plano.previas, { recursive: true });
const CEL = 300,
  COL = 5,
  nomes = Object.keys(pecas),
  LIN = Math.ceil(nomes.length / COL);
const img = Buffer.alloc(CEL * COL * CEL * LIN * 3, 38),
  IW = CEL * COL;
const zb = new Float32Array(IW * CEL * LIN).fill(-1e9);
const ang = (50 * Math.PI) / 180,
  ca = Math.cos(ang),
  sa = Math.sin(ang);
nomes.forEach((nome, n) => {
  const pc = pecas[nome],
    ox = (n % COL) * CEL + CEL / 2,
    oy = Math.floor(n / COL) * CEL + CEL * 0.78,
    s = CEL * 0.8;
  const pr = (v: number) => {
    const x = pc.p[v * 3],
      y = pc.p[v * 3 + 1],
      z = pc.p[v * 3 + 2];
    return [ox + x * s, oy - (y * ca - z * sa) * s, y * sa + z * ca];
  };
  for (let t = 0; t < pc.i.length; t += 3) {
    const vs = [pc.i[t], pc.i[t + 1], pc.i[t + 2]],
      Q = vs.map(pr);
    const area = (Q[1][0] - Q[0][0]) * (Q[2][1] - Q[0][1]) - (Q[2][0] - Q[0][0]) * (Q[1][1] - Q[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(Q[0][0], Q[1][0], Q[2][0]))),
      x1 = Math.min(IW - 1, Math.ceil(Math.max(Q[0][0], Q[1][0], Q[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(Q[0][1], Q[1][1], Q[2][1]))),
      y1 = Math.min(CEL * LIN - 1, Math.ceil(Math.max(Q[0][1], Q[1][1], Q[2][1])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5,
          qy = y + 0.5;
        const w0 = ((Q[1][0] - qx) * (Q[2][1] - qy) - (Q[2][0] - qx) * (Q[1][1] - qy)) / area,
          w1 = ((Q[2][0] - qx) * (Q[0][1] - qy) - (Q[0][0] - qx) * (Q[2][1] - qy)) / area,
          w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * Q[0][2] + w1 * Q[1][2] + w2 * Q[2][2],
          o = y * IW + x;
        if (z <= zb[o]) continue;
        zb[o] = z;
        const u = w0 * pc.uv[vs[0] * 2] + w1 * pc.uv[vs[1] * 2] + w2 * pc.uv[vs[2] * 2],
          v = w0 * pc.uv[vs[0] * 2 + 1] + w1 * pc.uv[vs[1] * 2 + 1] + w2 * pc.uv[vs[2] * 2 + 1];
        const tx = Math.min(W - 1, Math.max(0, Math.floor(u * W))),
          ty = Math.min(W - 1, Math.max(0, Math.floor(v * W))),
          ti = (ty * W + tx) * 3;
        for (let e = 0; e < 3; e++) img[o * 3 + e] = tex[ti + e];
      }
  }
});
const rotulos = nomes
  .map(
    (nome, n) =>
      `<text x="${(n % COL) * CEL + 8}" y="${Math.floor(n / COL) * CEL + 24}" font-size="18" font-family="Arial" fill="#ffd27a">${nome}</text>`,
  )
  .join("");
await sharp(img, { raw: { width: IW, height: CEL * LIN, channels: 3 } })
  .composite([{ input: Buffer.from(`<svg width="${IW}" height="${CEL * LIN}">${rotulos}</svg>`), left: 0, top: 0 }])
  .png()
  .toFile(join(plano.previas, "pecas.png"));
console.log(`prévia: ${join(plano.previas, "pecas.png")}`);

if (!args.includes("--simular")) {
  const saida: Record<string, { tam: number[]; p: string; uv: string; i: string }> = {};
  for (const [nome, pc] of Object.entries(pecas))
    saida[nome] = {
      tam: pc.tam,
      p: b64(Int16Array.from(pc.p, (v) => Math.round(v * 32000))),
      uv: b64(Uint16Array.from(pc.uv, (v) => Math.round(Math.min(1, Math.max(0, v)) * 65535))),
      i: b64(Uint16Array.from(pc.i)),
    };
  const json = JSON.stringify({ pecas: saida });
  writeFileSync(plano.saida, json);
  await sharp(plano.textura).resize(W, W).webp({ quality: plano.texQualidade }).toFile(plano.texSaida);
  const kb = (a: string) => (readFileSync(a).length / 1024).toFixed(0);
  console.log(`${plano.saida}: ${kb(plano.saida)} KB · ${plano.texSaida}: ${kb(plano.texSaida)} KB`);
}
