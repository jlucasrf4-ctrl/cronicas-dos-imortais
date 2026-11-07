/* ==== v8.1 — as montanhas do campo aberto com os modelos do Tripo (mantenedor 2026-11-06) ====
   Antes a montanha do mapa virava só pedras soltas no campo. Agora (src/assets/models/montanhas.json, gerado por
   tools/gerar-chao.ts com o plano tools/modelos/montanhas.json: o pico nevado e as 11 colinas do kit) ela vira uma
   cordilheira, em camadas pelo canal G do mapa (map/terreno.ts MONTANHA; ~12 por casa da borda para dentro):
   - pé (anda-se): morrotes soltos, que barram como as pedras grandes;
   - beira do paredão: morrotes encostados uns nos outros, com a base logo depois do contorno que barra;
   - meio: colinas, maiores quanto mais fundo;
   - miolo: o pico nevado, em tamanhos e giros diferentes.
   Mais alto quanto mais fundo, para os picos não taparem a heroína andando do lado de cima da montanha. Cada peça fica
   no bloco de cenário onde cai o centro dela (grades presas ao mundo; render/gl/mundo_cena.ts construir), com a cor da
   estação por triângulo como as árvores. A colisão não vem daqui: é o contorno liso do mapa (map/mundo.ts barrado). */
import { corEstacao, estacaoVista } from "./estacao_cor.ts";
import { densEm } from "../../map/terreno.ts";
import type { MalhaCrua } from "../../core/tipos.ts";

interface DadosMontanhas {
  versao: number;
  pecas: Record<string, { p: string; c: string }>;
  itens: Record<string, { peca: string; tam: number }>;
}
// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/montanhas.json */ {} as DadosMontanhas;

/** Uma camada: cel = lado da grade (casas); g = [de, até) do canal G no centro da peça; chance por célula; grupo do
 *  modelo ("morrote_<n>", "colina_<n>", "pico_<n>"); larg = a maior medida (casas) no começo e no fim da faixa;
 *  raio = colisão (fração da largura) só para as peças soltas no pé, onde se anda. */
interface Camada {
  cel: number;
  g: [number, number];
  chance: number;
  grupo: string;
  larg: [number, number];
  raio?: number;
}
/** luz: multiplica a cor (a textura do Tripo é escura, como a do cenário); enterrar: fração da altura abaixo do chão
 *  (a base não flutua no relevo); rocha: a cor do chão dentro da montanha (render/gl/mundo_cena.ts chao). */
export const MONTES = {
  luz: 1.25,
  enterrar: 0.06,
  rocha: [0.47, 0.44, 0.39],
  camadas: [
    { cel: 3.2, g: [16, 34], chance: 0.22, grupo: "morrote", larg: [1.4, 1.9], raio: 0.36 },
    { cel: 1.5, g: [52, 82], chance: 1, grupo: "morrote", larg: [2.6, 3.0] },
    { cel: 2.8, g: [82, 170], chance: 1, grupo: "colina", larg: [3.6, 6] },
    { cel: 6.5, g: [140, 999], chance: 1, grupo: "pico", larg: [8, 10.5] },
  ] as Camada[],
};

/** base64 → bytes (o mesmo de render/gl/chao.ts; aqui à parte porque o mapa, map/vetorial.ts, usa este módulo) */
function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
const CACHE = {
  pecas: {} as Record<string, { P: Int16Array; C: Uint8Array }>,
  grupos: null as Record<string, string[]> | null,
};
function grupos() {
  if (!CACHE.grupos) {
    const g: Record<string, string[]> = {};
    for (const k of Object.keys(DADOS.itens || {})) (g[k.replace(/_\d+$/, "")] ||= []).push(k);
    CACHE.grupos = g;
  }
  return CACHE.grupos;
}
function peca(id: string) {
  if (!CACHE.pecas[id]) {
    const pc = DADOS.pecas[id];
    CACHE.pecas[id] = { P: new Int16Array(bytes(pc.p).buffer), C: bytes(pc.c) };
  }
  return CACHE.pecas[id];
}
/** Há modelos de montanha (sem os dados, nos testes em Node, o campo fica com as pedras de antes). */
export function temMontanhas() {
  return !!grupos().pico;
}
function hash(i: number, j: number, k: number) {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Põe em `b` o modelo `item` com a base no centro (x, y, z) (espaço do bloco), a maior medida `larg` px, girado `a`. */
function emitir(b: MalhaCrua, item: string, x: number, y: number, z: number, larg: number, a: number, luz: number) {
  const { P, C } = peca(DADOS.itens[item].peca),
    k = larg / 20000,
    ca = Math.cos(a),
    sa = Math.sin(a),
    est = estacaoVista();
  let ymax = 0;
  for (let i = 1; i < P.length; i += 3) ymax = Math.max(ymax, P[i]);
  const y0 = y - ymax * k * MONTES.enterrar;
  for (let t = 0; t < P.length / 9; t++) {
    const v = [0, 1, 2].map((j) => {
      const px = P[t * 9 + j * 3] * k,
        py = P[t * 9 + j * 3 + 1] * k,
        pz = P[t * 9 + j * 3 + 2] * k;
      return [x + px * ca - pz * sa, y0 + py, z + px * sa + pz * ca];
    });
    const u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]],
      w = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((q) => q / l);
    let cor = [0, 1, 2].map((e) => Math.min(1, (C[t * 3 + e] / 255) * luz));
    if (est) cor = corEstacao(cor, "planta", n[1], t * 7 + Math.round(x * 3.1 + z * 5.3), est);
    for (const q of v) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(n[0], n[1], n[2]);
      b.c.push(cor[0], cor[1], cor[2]);
    }
  }
}

/** As montanhas do bloco que começa em (ax0, az0) (px do campo absolutos, lado B; T = a casa; e = MUNDO.escala) na
 *  malha `b` (espaço do bloco). `chao(fx, fz)` = a altura do chão no ponto absoluto. Devolve as colisões das peças do
 *  pé [x, z, raio, …] (absolutas). */
export function mbMontanhas(
  b: MalhaCrua,
  ax0: number,
  az0: number,
  B: number,
  T: number,
  e: number,
  chao: (fx: number, fz: number) => number,
) {
  const obst: number[] = [],
    G = grupos();
  if (!G.pico) return obst;
  MONTES.camadas.forEach((cm, n) => {
    const vs = G[cm.grupo],
      S = cm.cel * T;
    if (!vs) return;
    for (let i = Math.floor(ax0 / S) - 1; i <= Math.floor((ax0 + B) / S) + 1; i++)
      for (let j = Math.floor(az0 / S) - 1; j <= Math.floor((az0 + B) / S) + 1; j++) {
        const x = (i + 0.15 + 0.7 * hash(i, j, 40 + n)) * S,
          z = (j + 0.15 + 0.7 * hash(i, j, 50 + n)) * S;
        if (x < ax0 || x >= ax0 + B || z < az0 || z >= az0 + B) continue; // é do bloco vizinho
        if (hash(i, j, 60 + n) >= cm.chance) continue;
        const g = densEm(x * e, z * e)[1];
        if (g < cm.g[0] || g >= cm.g[1]) continue;
        const t = Math.min(1, (g - cm.g[0]) / Math.min(100, cm.g[1] - cm.g[0])),
          larg = (cm.larg[0] + (cm.larg[1] - cm.larg[0]) * t) * (0.9 + 0.2 * hash(i, j, 70 + n)) * T,
          item = vs[Math.floor(hash(i, j, 80 + n) * vs.length)];
        emitir(
          b,
          item,
          x - ax0,
          chao(x, z),
          z - az0,
          larg,
          hash(i, j, 90 + n) * Math.PI * 2,
          MONTES.luz * (0.94 + 0.12 * hash(i, j, 100 + n)),
        );
        if (cm.raio) obst.push(x, z, larg * cm.raio);
      }
  });
  return obst;
}

/* ---------- v8.1 — os mesmos modelos no modo Mapa (mantenedor 2026-11-07: "imagem do modelo" no lugar dos
   triângulos). Cada modelo é desenhado uma vez numa imagem (z-buffer em software, de cima e um pouco de lado, luz da
   esquerda como as sombras do mapa) com a cor puxada para o papel; map/vetorial.ts maPeak a cola no lugar do pico. */

/** inclina: ângulo da vista acima do horizonte; giros: quantas vistas giradas por modelo (variedade); lado: largura
 *  da imagem (px); papel/papelK: a cor do papel do mapa e quanto ela entra; luz: direção (x, y, z) e [mín, máx]. */
export const MONTES_MAPA = {
  inclina: (38 * Math.PI) / 180,
  giros: 3,
  lado: 200,
  papel: [0.85, 0.77, 0.6],
  papelK: 0.2,
  luz: { d: [-0.62, 0.7, 0.35], min: 0.55, max: 1.2 },
};
/** Uma imagem pronta: o canvas, o ponto do chão debaixo do centro do modelo (px da imagem) e px por unidade do modelo
 *  (maior medida = 1). */
export interface ImagemMonte {
  cv: HTMLCanvasElement;
  ax: number;
  ay: number;
  esc: number;
}
const IMAGENS = new Map<string, ImagemMonte | null>();

/** A imagem do grupo ("pico", "colina", "morrote") para um número fixo `h` (0..1): a variante e o giro saem dele. */
export function imagemMonte(grupo: string, h: number): ImagemMonte | null {
  const vs = grupos()[grupo];
  if (!vs || typeof document === "undefined") return null;
  const n = Math.floor(h * vs.length * MONTES_MAPA.giros) % (vs.length * MONTES_MAPA.giros),
    item = vs[n % vs.length],
    giro = Math.floor(n / vs.length),
    k = item + "@" + giro;
  if (!IMAGENS.has(k)) IMAGENS.set(k, desenharMonte(item, (giro / MONTES_MAPA.giros) * Math.PI * 2 + 0.4));
  return IMAGENS.get(k)!;
}

function desenharMonte(item: string, giro: number): ImagemMonte | null {
  const { P, C } = peca(DADOS.itens[item].peca),
    M = MONTES_MAPA,
    nv = P.length / 3,
    ca = Math.cos(giro),
    sa = Math.sin(giro),
    ci = Math.cos(M.inclina),
    si = Math.sin(M.inclina);
  // projeção: x da tela = x girado; y da tela = −(altura·cos − z·sen); profundidade = altura·sen + z·cos
  const S = new Float32Array(nv * 3),
    W3 = new Float32Array(nv * 3);
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let v = 0; v < nv; v++) {
    const px = P[v * 3] / 20000,
      py = P[v * 3 + 1] / 20000,
      pz = P[v * 3 + 2] / 20000,
      x = px * ca - pz * sa,
      z = px * sa + pz * ca;
    W3[v * 3] = x;
    W3[v * 3 + 1] = py;
    W3[v * 3 + 2] = z;
    S[v * 3] = x;
    S[v * 3 + 1] = -(py * ci - z * si);
    S[v * 3 + 2] = py * si + z * ci;
    x0 = Math.min(x0, S[v * 3]);
    x1 = Math.max(x1, S[v * 3]);
    y0 = Math.min(y0, S[v * 3 + 1]);
    y1 = Math.max(y1, S[v * 3 + 1]);
  }
  const pad = 3,
    esc = (M.lado - pad * 2) / (x1 - x0),
    Wd = M.lado,
    Hd = Math.ceil((y1 - y0) * esc) + pad * 2,
    cv = document.createElement("canvas");
  cv.width = Wd;
  cv.height = Hd;
  const c = cv.getContext("2d");
  if (!c) return null;
  const img = c.createImageData(Wd, Hd),
    zb = new Float32Array(Wd * Hd).fill(-Infinity),
    L = M.luz.d,
    ll = Math.hypot(L[0], L[1], L[2]);
  const sx = (v: number) => pad + (S[v * 3] - x0) * esc,
    sy = (v: number) => pad + (S[v * 3 + 1] - y0) * esc;
  for (let t = 0; t < nv / 3; t++) {
    const a = t * 3,
      b = a + 1,
      d = a + 2;
    const X = [sx(a), sx(b), sx(d)],
      Y = [sy(a), sy(b), sy(d)],
      Z = [S[a * 3 + 2], S[b * 3 + 2], S[d * 3 + 2]];
    const area = (X[1] - X[0]) * (Y[2] - Y[0]) - (X[2] - X[0]) * (Y[1] - Y[0]);
    if (Math.abs(area) < 1e-9) continue;
    // normal no espaço girado, virada para a câmera
    const u = [W3[b * 3] - W3[a * 3], W3[b * 3 + 1] - W3[a * 3 + 1], W3[b * 3 + 2] - W3[a * 3 + 2]],
      w = [W3[d * 3] - W3[a * 3], W3[d * 3 + 1] - W3[a * 3 + 1], W3[d * 3 + 2] - W3[a * 3 + 2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((q) => q / nl);
    if (n[1] * si + n[2] * ci < 0) n = n.map((q) => -q);
    const k = M.luz.min + (M.luz.max - M.luz.min) * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll);
    const cor = [0, 1, 2].map((e) => {
      const cc = Math.min(1, (C[t * 3 + e] / 255) * MONTES.luz * k);
      return Math.round(255 * (cc * (1 - M.papelK) + M.papel[e] * M.papelK));
    });
    const bx0 = Math.max(0, Math.floor(Math.min(X[0], X[1], X[2]))),
      bx1 = Math.min(Wd - 1, Math.ceil(Math.max(X[0], X[1], X[2]))),
      by0 = Math.max(0, Math.floor(Math.min(Y[0], Y[1], Y[2]))),
      by1 = Math.min(Hd - 1, Math.ceil(Math.max(Y[0], Y[1], Y[2])));
    for (let py = by0; py <= by1; py++)
      for (let px = bx0; px <= bx1; px++) {
        const qx = px + 0.5,
          qy = py + 0.5,
          w0 = ((X[1] - qx) * (Y[2] - qy) - (X[2] - qx) * (Y[1] - qy)) / area,
          w1 = ((X[2] - qx) * (Y[0] - qy) - (X[0] - qx) * (Y[2] - qy)) / area,
          w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * Z[0] + w1 * Z[1] + w2 * Z[2],
          o = py * Wd + px;
        if (z <= zb[o]) continue;
        zb[o] = z;
        img.data[o * 4] = cor[0];
        img.data[o * 4 + 1] = cor[1];
        img.data[o * 4 + 2] = cor[2];
        img.data[o * 4 + 3] = 255;
      }
  }
  c.putImageData(img, 0, 0);
  // o chão debaixo do centro (0, 0, 0): x = 0 girado, y = 0
  return { cv, ax: pad + (0 - x0) * esc, ay: pad + (0 - y0) * esc, esc };
}
