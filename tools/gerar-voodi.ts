/* v7.7 — o Voodi, mascote da Voidd World, para a vinheta de abertura (src/intro/voidd.ts lê src/assets/models/voodi.json).

   Uso:  node tools/gerar-voodi.ts [plano.json]      (padrão tools/modelos/voodi.json)
   Fonte: o FBX do Meshy (malha só, sem esqueleto) e as texturas de cor e de relevo (normal map), em
   "arquivos de transferência/voodi/". A malha vai inteira (10.470 triângulos, sem redução): a vinheta mostra o bicho de
   perto. Passos:
     1. Z para cima (FBX do Meshy) → Y para cima; a frente (o rosto) fica em +z.
     2. Cor de cada ponto pela média dos cantos na textura; "escuro" = luminância abaixo de `escuro` (a cabeça preta).
     3. Esfera da cabeça por mínimos quadrados nos pontos escuros perto do centro deles.
     4. Olhos = pontos brancos (canais acima de `branco.min`, saturação abaixo de `branco.sat`) perto da esfera,
        separados pelo lado de x. A vinheta desenha olhos próprios (que piscam e olham), então os pintados somem:
        os pontos perto de cada olho (elipse × `achatar.raio`) voltam para a superfície da esfera (cheio até
        `achatar.cheio`, transição até `achatar.raio`) e, nas texturas, o branco dentro das caixas (em UV) dos olhos,
        dilatado `dilatar` × largura, vira `corCabeca` na cor e normal reta no relevo.
     5. Normais lisas por ponto (depois do achatamento); vértices por (ponto, UV).
   Saída: { p, n, uv, i, cab (centro da esfera), olhos: [{ c (centro na superfície), r: [rx, ry] }], cor, normal }
   (texturas webp em data URI, texW²). Prévias em build/modelos/voodi/ (frente e lado, uma cor por triângulo). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { lerMalhaFbx } from "./lib/fbx.ts";
import { desenhar } from "./lib/glb.ts";

interface Plano {
  fbx: string;
  cor: string;
  normal: string;
  saida: string;
  previas: string;
  texW: number;
  qualidade: number;
  escuro: number;
  branco: { min: number; sat: number };
  achatar: { raio: number; cheio: number; dz: number };
  corCabeca: [number, number, number];
  dilatar: number;
}

const plano = JSON.parse(readFileSync(process.argv[2] ?? "tools/modelos/voodi.json", "utf8")) as Plano;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const m = lerMalhaFbx(readFileSync(plano.fbx));
const nP = m.P.length / 3;

// 1. Z para cima → Y para cima
const Q = new Float64Array(m.P.length);
for (let i = 0; i < nP; i++) {
  Q[i * 3] = m.P[i * 3];
  Q[i * 3 + 1] = m.P[i * 3 + 2];
  Q[i * 3 + 2] = -m.P[i * 3 + 1];
}

// 2. cor de cada ponto (média dos cantos)
const corImg = await sharp(plano.cor).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = corImg.info.width,
  H = corImg.info.height,
  C = corImg.data;
const cor = new Float64Array(nP * 3),
  nCor = new Uint32Array(nP);
const pixel = (u: number, v: number) => {
  const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))),
    y = Math.min(H - 1, Math.max(0, Math.floor((1 - v) * H)));
  return (y * W + x) * 3;
};
m.poli.forEach((poli, p) =>
  poli.forEach((i, k) => {
    const o = pixel(m.uv[p][k][0], m.uv[p][k][1]);
    for (let e = 0; e < 3; e++) cor[i * 3 + e] += C[o + e] / 255;
    nCor[i]++;
  }),
);
for (let i = 0; i < nP; i++) for (let e = 0; e < 3; e++) cor[i * 3 + e] /= nCor[i] || 1;
const lum = (i: number) => 0.3 * cor[i * 3] + 0.59 * cor[i * 3 + 1] + 0.11 * cor[i * 3 + 2];
const ehBranco = (r: number, g: number, b: number) => {
  const mn = Math.min(r, g, b),
    mx = Math.max(r, g, b);
  return mn > plano.branco.min && mx - mn < plano.branco.sat;
};

// 3. esfera da cabeça
const centro = [0, 0, 0];
let nEsc = 0;
for (let i = 0; i < nP; i++)
  if (lum(i) < plano.escuro) {
    for (let e = 0; e < 3; e++) centro[e] += Q[i * 3 + e];
    nEsc++;
  }
for (let e = 0; e < 3; e++) centro[e] /= nEsc || 1;
const dist = (i: number, c: number[]) => Math.hypot(Q[i * 3] - c[0], Q[i * 3 + 1] - c[1], Q[i * 3 + 2] - c[2]);
function ajustarEsfera(ids: number[]) {
  // x² + y² + z² = 2ax + 2by + 2cz + d  (equações normais 4×4, eliminação de Gauss)
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0, 0]);
  for (const i of ids) {
    const x = Q[i * 3],
      y = Q[i * 3 + 1],
      z = Q[i * 3 + 2];
    const lin = [2 * x, 2 * y, 2 * z, 1],
      b = x * x + y * y + z * z;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) A[r][c] += lin[r] * lin[c];
      A[r][4] += lin[r] * b;
    }
  }
  for (let c = 0; c < 4; c++) {
    let piv = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 5; k++) A[r][k] -= f * A[c][k];
    }
  }
  const s = A.map((l, r) => l[4] / l[r]);
  return { c: [s[0], s[1], s[2]], R: Math.sqrt(s[3] + s[0] ** 2 + s[1] ** 2 + s[2] ** 2) };
}
const escuros: number[] = [];
for (let i = 0; i < nP; i++) if (lum(i) < plano.escuro && dist(i, centro) < 0.6) escuros.push(i);
const esf = ajustarEsfera(escuros);

// 4. olhos: acha, achata a malha
const olhos = [0, 1].map(() => ({ ids: [] as number[], mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }));
for (let i = 0; i < nP; i++) {
  if (!ehBranco(cor[i * 3], cor[i * 3 + 1], cor[i * 3 + 2]) || dist(i, esf.c) > esf.R * 1.4) continue;
  const ol = olhos[Q[i * 3] < esf.c[0] ? 0 : 1];
  ol.ids.push(i);
  for (let e = 0; e < 3; e++) {
    ol.mn[e] = Math.min(ol.mn[e], Q[i * 3 + e]);
    ol.mx[e] = Math.max(ol.mx[e], Q[i * 3 + e]);
  }
}
if (olhos.some((o) => o.ids.length < 5)) throw new Error("olhos não achados: confira `branco` no plano");
const { raio: RAIO, cheio: CHEIO, dz: DZ } = plano.achatar;
let achatados = 0;
for (const ol of olhos) {
  const c = [0, 1, 2].map((e) => (ol.mn[e] + ol.mx[e]) / 2);
  const rx = (ol.mx[0] - ol.mn[0]) / 2,
    ry = (ol.mx[1] - ol.mn[1]) / 2;
  for (let i = 0; i < nP; i++) {
    const el = Math.hypot((Q[i * 3] - c[0]) / rx, (Q[i * 3 + 1] - c[1]) / ry);
    if (el > RAIO || Math.abs(Q[i * 3 + 2] - c[2]) > DZ) continue;
    const v = [0, 1, 2].map((e) => Q[i * 3 + e] - esf.c[e]);
    const l = Math.hypot(v[0], v[1], v[2]);
    const f = el < CHEIO ? 1 : 1 - (el - CHEIO) / (RAIO - CHEIO);
    const alvo = l + (esf.R - l) * f;
    for (let e = 0; e < 3; e++) Q[i * 3 + e] = esf.c[e] + (v[e] / l) * alvo;
    achatados++;
  }
}

// 4b. texturas: o branco dos olhos vira cabeça (cor) e normal reta (relevo)
const ehOlho = new Uint8Array(nP);
for (const ol of olhos) for (const i of ol.ids) ehOlho[i] = 1;
const caixas: number[][] = [];
m.poli.forEach((poli, p) =>
  poli.forEach((i, k) => {
    if (!ehOlho[i]) return;
    const x = m.uv[p][k][0] * W,
      y = (1 - m.uv[p][k][1]) * H;
    const perto = (c: number[]) =>
      x > c[0] - W * 0.03 && x < c[2] + W * 0.03 && y > c[1] - H * 0.03 && y < c[3] + H * 0.03;
    let cx = caixas.find(perto);
    if (!cx) caixas.push((cx = [x, y, x, y]));
    cx[0] = Math.min(cx[0], x);
    cx[1] = Math.min(cx[1], y);
    cx[2] = Math.max(cx[2], x);
    cx[3] = Math.max(cx[3], y);
  }),
);
const nrm = await sharp(plano.normal).resize(W, H).removeAlpha().raw().toBuffer();
const folga = W * 0.012,
  dil = Math.max(1, Math.round(W * plano.dilatar));
let mascara = new Uint8Array(W * H);
for (const [x0, y0, x1, y1] of caixas)
  for (let y = Math.max(0, Math.floor(y0 - folga)); y < Math.min(H, Math.ceil(y1 + folga)); y++)
    for (let x = Math.max(0, Math.floor(x0 - folga)); x < Math.min(W, Math.ceil(x1 + folga)); x++) {
      const k = y * W + x;
      if (ehBranco(C[k * 3] / 255, C[k * 3 + 1] / 255, C[k * 3 + 2] / 255)) mascara[k] = 1;
    }
for (const eixo of [0, 1]) {
  const nova = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!mascara[y * W + x]) continue;
      for (let d = -dil; d <= dil; d++) {
        const xx = eixo ? x : x + d,
          yy = eixo ? y + d : y;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) nova[yy * W + xx] = 1;
      }
    }
  mascara = nova;
}
let apagados = 0;
for (let k = 0; k < W * H; k++) {
  if (!mascara[k]) continue;
  for (let e = 0; e < 3; e++) C[k * 3 + e] = plano.corCabeca[e];
  nrm[k * 3] = 128;
  nrm[k * 3 + 1] = 128;
  nrm[k * 3 + 2] = 255;
  apagados++;
}

// 5. normais lisas por ponto; vértices por (ponto, UV)
const N = new Float64Array(m.P.length);
const tris: number[][] = [],
  trisUV: number[][][] = [];
m.poli.forEach((v, p) => {
  for (let k = 1; k + 1 < v.length; k++) {
    const t = [v[0], v[k], v[k + 1]];
    tris.push(t);
    trisUV.push([m.uv[p][0], m.uv[p][k], m.uv[p][k + 1]]);
    const [a, b, c] = t.map((i) => [Q[i * 3], Q[i * 3 + 1], Q[i * 3 + 2]]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const i of t) for (let e = 0; e < 3; e++) N[i * 3 + e] += n[e];
  }
});
const vert = new Map<string, number>();
const p: number[] = [],
  n: number[] = [],
  uv: number[] = [],
  idx: number[] = [];
tris.forEach((t, ti) =>
  t.forEach((i, k) => {
    const [u, w] = trisUV[ti][k];
    const chave = i + "|" + r4(u) + "|" + r4(w);
    let j = vert.get(chave);
    if (j === undefined) {
      j = p.length / 3;
      vert.set(chave, j);
      const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
      for (let e = 0; e < 3; e++) {
        p.push(r4(Q[i * 3 + e]));
        n.push(Math.round((N[i * 3 + e] / l) * 1000) / 1000);
      }
      uv.push(r4(u), r4(w));
    }
    idx.push(j);
  }),
);
const olhosSaida = olhos.map((ol) => {
  const c = [0, 1, 2].map((e) => (ol.mn[e] + ol.mx[e]) / 2);
  const v = c.map((x, e) => x - esf.c[e]),
    l = Math.hypot(v[0], v[1], v[2]);
  return {
    c: v.map((x, e) => r4(esf.c[e] + (x / l) * esf.R)),
    r: [r4((ol.mx[0] - ol.mn[0]) / 2), r4((ol.mx[1] - ol.mn[1]) / 2)],
  };
});
const webp = async (dados: Buffer) =>
  "data:image/webp;base64," +
  (
    await sharp(dados, { raw: { width: W, height: H, channels: 3 } })
      .resize(plano.texW, plano.texW)
      .webp({ quality: plano.qualidade })
      .toBuffer()
  ).toString("base64");
const saida = { p, n, uv, i: idx, cab: esf.c.map(r4), olhos: olhosSaida, cor: await webp(C), normal: await webp(nrm) };
writeFileSync(plano.saida, JSON.stringify(saida) + "\n");

// prévias (uma cor por triângulo, da textura já sem os olhos)
mkdirSync(plano.previas, { recursive: true });
const corTri = (t: number) => {
  const vs = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
  const o = pixel(
    (uv[vs[0] * 2] + uv[vs[1] * 2] + uv[vs[2] * 2]) / 3,
    (uv[vs[0] * 2 + 1] + uv[vs[1] * 2 + 1] + uv[vs[2] * 2 + 1]) / 3,
  );
  return [C[o], C[o + 1], C[o + 2]];
};
for (const vista of ["frente", "lado"] as const)
  await desenhar(join(plano.previas, vista + ".png"), p, idx, corTri, { vista, W: 600 });

console.log(
  `voodi: ${idx.length / 3} triângulos, ${p.length / 3} vértices; cabeça r=${r4(esf.R)} (${escuros.length} pontos);` +
    ` olhos ${olhos.map((o) => o.ids.length).join("+")} pontos, ${achatados} achatados, ${apagados} pixels apagados` +
    ` → ${plano.saida}`,
);
