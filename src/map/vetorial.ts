/* ==== Fase 4 — mapa vetorial procedural: símbolos, regiões e composição (base/13) ==== */
import { MAPDATA } from "./mapdata.ts";
import { TELAS, camera } from "../core/state.ts";
import { HUD } from "../ui/hud.ts";
import { CITIES } from "../data/economia.ts";
import type { Cidade } from "../data/economia.ts";
import { SPAWN0 } from "../core/config.ts";
import { ARQ } from "../data/mapa.ts";
import { mapZoomLimit } from "../ui/modos.ts";
import { quadOf, quadRect, QUAD, quadKey, quadName } from "./quadrantes.ts";
import { ED } from "../editor/estado.ts";
import { NAV } from "./navegacao.ts";
import { refazerNav } from "./agua.ts";
import { imagemMonte } from "../render/gl/montanhas.ts";

/* =====================================================================
   v3.18 — MUNDO 4x MAIOR + MAPA VETORIAL PROCEDURAL + QUADRANTES
   O continente é o mesmo do mapa original, ampliado 4x (a ilha inicial
   ficou do tamanho do mapa inteiro antigo). Costa com detalhe fractal;
   árvores, picos e pedras são gerados por posição (sempre iguais) a partir
   de campos de densidade, com nível de detalhe por zoom.
===================================================================== */
export const WORLD_K = MAPDATA.K || 4;
/** Vila ou torre do mapa (MAPDATA.settle sem nível numérico). */
interface Vila {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: number | string; // "t" = torre
}
interface EstadoMAPART {
  on: boolean;
  ready: boolean;
  cv: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  tiles: Map<string, { cv: HTMLCanvasElement; at: number }>; // ladrilhos já desenhados, por "z:tx:ty"
  dirty: boolean;
  lastSig: string;
  land: HTMLImageElement; // land, sea, ov e coast: postos por maBuild, lidos só com MAPART.ready
  sea: HTMLImageElement;
  ov: HTMLCanvasElement; // o mapa todo em baixa resolução (visão geral)
  paper: HTMLCanvasElement;
  coast: Path2D;
  costa: IndiceCosta; // v7.7: o mesmo contorno em trechos, por região (costaLocal)
  ripple: Path2D[];
  roads: { p: Path2D; major: boolean }[];
  dens: Uint8ClampedArray | null; // densidade da vegetação (pixels RGBA)
  dW: number;
  dH: number;
  villages: Vila[];
  statics: Simbolo[] | null; // morros e navios (fixos)
  fr: number;
  // acrescentados depois
  densImg?: HTMLImageElement;
}
export const MAPART: EstadoMAPART = {
  on: true,
  ready: false,
  cv: null,
  ctx: null,
  tiles: new Map(),
  dirty: true,
  lastSig: "",
  land: null!,
  sea: null!,
  ov: null!,
  paper: null!,
  coast: null!,
  costa: null!,
  ripple: [],
  roads: [],
  dens: null,
  dW: 0,
  dH: 0,
  villages: [],
  statics: null,
  fr: 0,
};
export const MA_PAD = 2;
const MA_TILE = 256,
  MA_MINZ = -2,
  MA_MAXZ = 4,
  MA_CACHE = 240;
function maHash(n: number) {
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function maH2(i: number, j: number, s: number) {
  return maHash(i * 157.31 + j * 311.7 + s * 71.13);
}
function maSmoothPath(p: Path2D, flat: number[], closed: boolean) {
  const n = flat.length / 2;
  if (n < 2) return;
  const X = (i: number) => flat[(((i % n) + n) % n) * 2],
    Y = (i: number) => flat[(((i % n) + n) % n) * 2 + 1];
  if (closed) {
    p.moveTo((X(n - 1) + X(0)) / 2, (Y(n - 1) + Y(0)) / 2);
    for (let i = 0; i < n; i++) p.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    p.closePath();
  } else {
    p.moveTo(X(0), Y(0));
    for (let i = 1; i < n - 1; i++) p.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    p.lineTo(X(n - 1), Y(n - 1));
  }
}
/* v7.7 — o contorno da costa (20 mil pontos) em trechos guardados por bloco do mundo: cada ladrilho traça só os
   trechos perto dele. Antes, cada ladrilho traçava o contorno inteiro 4 vezes (~13 ms cada, o que mais pesava). Cada
   trecho é uma curva de maSmoothPath (início, controle, fim), na mesma ordem: juntos desenham a mesma linha. */
interface IndiceCosta {
  seg: Float64Array; // por trecho: x0, y0, cx, cy, x1, y1
  anel: Int32Array; // de qual anel do contorno o trecho veio (trechos seguidos do mesmo anel continuam a linha)
  caixa: Float64Array; // por trecho: xmin, ymin, xmax, ymax
  baldes: Map<number, number[]>; // bloco (COSTA_B) → trechos que passam nele
  marca: Uint32Array; // para não repetir um trecho que está em dois blocos
  vez: number;
}
const COSTA_B = 128;
const chaveBalde = (bx: number, by: number) => (by + 64) * 4096 + (bx + 64);
function indexarCosta(aneis: number[][]): IndiceCosta {
  let n = 0;
  for (const f of aneis) if (f.length >= 4) n += f.length / 2;
  const seg = new Float64Array(n * 6),
    anel = new Int32Array(n),
    caixa = new Float64Array(n * 4),
    baldes = new Map<number, number[]>();
  let k = 0;
  aneis.forEach((f, ai) => {
    const m = f.length / 2;
    if (m < 2) return;
    const X = (i: number) => f[(((i % m) + m) % m) * 2],
      Y = (i: number) => f[(((i % m) + m) % m) * 2 + 1];
    for (let i = 0; i < m; i++, k++) {
      const x0 = (X(i - 1) + X(i)) / 2,
        y0 = (Y(i - 1) + Y(i)) / 2,
        x1 = (X(i) + X(i + 1)) / 2,
        y1 = (Y(i) + Y(i + 1)) / 2;
      seg.set([x0, y0, X(i), Y(i), x1, y1], k * 6);
      anel[k] = ai;
      const a = Math.min(x0, X(i), x1),
        b = Math.min(y0, Y(i), y1),
        c = Math.max(x0, X(i), x1),
        d = Math.max(y0, Y(i), y1);
      caixa.set([a, b, c, d], k * 4);
      for (let by = Math.floor(b / COSTA_B); by <= Math.floor(d / COSTA_B); by++)
        for (let bx = Math.floor(a / COSTA_B); bx <= Math.floor(c / COSTA_B); bx++) {
          const ch = chaveBalde(bx, by);
          let L = baldes.get(ch);
          if (!L) baldes.set(ch, (L = []));
          L.push(k);
        }
    }
  });
  return { seg, anel, caixa, baldes, marca: new Uint32Array(n), vez: 0 };
}
/** Os trechos do contorno da costa que passam no retângulo (x0,y0)-(x1,y1), num Path2D para traçar. */
function costaLocal(x0: number, y0: number, x1: number, y1: number) {
  const I = MAPART.costa,
    vez = ++I.vez,
    achados: number[] = [];
  for (let by = Math.floor(y0 / COSTA_B); by <= Math.floor(y1 / COSTA_B); by++)
    for (let bx = Math.floor(x0 / COSTA_B); bx <= Math.floor(x1 / COSTA_B); bx++) {
      const L = I.baldes.get(chaveBalde(bx, by));
      if (!L) continue;
      for (const k of L) {
        if (I.marca[k] === vez) continue;
        I.marca[k] = vez;
        const q = k * 4;
        if (I.caixa[q] > x1 || I.caixa[q + 2] < x0 || I.caixa[q + 1] > y1 || I.caixa[q + 3] < y0) continue;
        achados.push(k);
      }
    }
  achados.sort((a, b) => a - b);
  const p = new Path2D(),
    S = I.seg;
  let ant = -2;
  for (const k of achados) {
    const q = k * 6;
    if (k !== ant + 1 || I.anel[k] !== I.anel[ant]) p.moveTo(S[q], S[q + 1]);
    p.quadraticCurveTo(S[q + 2], S[q + 3], S[q + 4], S[q + 5]);
    ant = k;
  }
  return p;
}
// campos: R floresta (0-1), G núcleo de montanha (0 = fora), B distância da costa
export function maDens(x: number, y: number) {
  return maDensEm(x, y, [0, 0, 0]);
}
/** maDens escrevendo em `out` (v7.7: os ladrilhos chamam milhares de vezes; sem criar listas nem funções a cada vez). */
function maDensEm(x: number, y: number, out: number[]) {
  const D = MAPART.dens;
  if (!D) {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  const fx = x / (WORLD_K * 2) - 0.5,
    fy = y / (WORLD_K * 2) - 0.5,
    ix = Math.floor(fx),
    iy = Math.floor(fy),
    tx = fx - ix,
    ty = fy - iy,
    W = MAPART.dW,
    H = MAPART.dH,
    i0 = ix < 0 ? 0 : ix >= W ? W - 1 : ix,
    i1 = ix + 1 < 0 ? 0 : ix + 1 >= W ? W - 1 : ix + 1,
    j0 = iy < 0 ? 0 : iy >= H ? H - 1 : iy,
    j1 = iy + 1 < 0 ? 0 : iy + 1 >= H ? H - 1 : iy + 1,
    a = (j0 * W + i0) * 4,
    b = (j0 * W + i1) * 4,
    c = (j1 * W + i0) * 4,
    d = (j1 * W + i1) * 4;
  for (let k = 0; k < 3; k++)
    out[k] = (D[a + k] * (1 - tx) + D[b + k] * tx) * (1 - ty) + (D[c + k] * (1 - tx) + D[d + k] * tx) * ty;
  return out;
}
export function mapArtInit() {
  const D = MAPDATA;
  MAPART.ready = false;
  MAPART.coast = new Path2D();
  for (const r of D.coast) maSmoothPath(MAPART.coast, r, true);
  MAPART.costa = indexarCosta(D.coast);
  MAPART.ripple = D.ripple.map((lv) => {
    const p = new Path2D();
    for (const r of lv) maSmoothPath(p, r, true);
    return p;
  });
  MAPART.roads = D.roads.map((r) => {
    const p = new Path2D();
    maSmoothPath(p, r.p, false);
    return { p, major: r.major };
  });
  MAPART.villages = D.settle
    .filter((s) => typeof s[4] !== "number")
    .map((s) => ({ id: s[0], name: s[1], x: s[2], y: s[3], kind: s[4] }));
  MAPART.statics = [];
  for (const p of D.hills) MAPART.statics.push({ t: "hill", x: p[0], y: p[1], s: p[2], h: maHash(p[0] + p[1] * 3.1) });
  for (const p of D.ships || [])
    MAPART.statics.push({ t: "ship", x: p[0], y: p[1], s: 1, h: maHash(p[0] + p[1] * 9.1), port: p[2] });
  const pc = document.createElement("canvas");
  pc.width = pc.height = 128;
  const px = pc.getContext("2d")!,
    id = px.createImageData(128, 128);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 40;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 22;
  }
  px.putImageData(id, 0, 0);
  MAPART.paper = pc;
  let n = 0;
  const done = () => {
    if (++n < 3) return;
    const dc = document.createElement("canvas");
    dc.width = MAPART.densImg!.naturalWidth;
    dc.height = MAPART.densImg!.naturalHeight;
    const dx = dc.getContext("2d", { willReadFrequently: true })!;
    dx.drawImage(MAPART.densImg!, 0, 0);
    MAPART.dens = dx.getImageData(0, 0, dc.width, dc.height).data;
    MAPART.dW = dc.width;
    MAPART.dH = dc.height;
    MAPART.ov = maRenderRegion(0, 0, TELAS.worldW, TELAS.worldH, Math.min(0.32, 1400 / TELAS.worldW));
    MAPART.ready = true;
    MAPART.dirty = true;
    HUD.mmBase = null;
    if (NAV.ready) refazerNav(); // v8.1: a densidade diz onde está o paredão da montanha (map/terreno.ts)
    maApplyMode();
  };
  MAPART.land = new Image();
  MAPART.land.onload = done;
  MAPART.land.src = "data:image/png;base64," + D.land;
  MAPART.sea = new Image();
  MAPART.sea.onload = done;
  MAPART.sea.src = "data:image/png;base64," + D.sea;
  MAPART.densImg = new Image();
  MAPART.densImg.onload = done;
  MAPART.densImg.src = "data:image/png;base64," + D.dens;
  if (!MAPART.cv) {
    const cv = document.createElement("canvas");
    cv.id = "map-canvas";
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1";
    const vp = document.getElementById("viewport")!;
    vp.insertBefore(cv, document.getElementById("sim-canvas"));
    MAPART.cv = cv;
    MAPART.ctx = cv.getContext("2d");
  }
}
export function maApplyMode() {
  const on = MAPART.on && MAPART.ready;
  if (MAPART.cv) MAPART.cv.style.display = on ? "" : "none";
  const lad = camadaLadrilhos();
  if (lad) lad.style.display = on ? "" : "none"; // v7.7: a camada dos ladrilhos
  const mi = document.getElementById("map-img");
  if (mi) mi.style.visibility = on ? "hidden" : "";
  HUD.mmBase = null;
  MAPART.dirty = true;
  const ts = document.getElementById("ts-map") as HTMLImageElement;
  if (ts && on) {
    try {
      ts.src = MAPART.ov.toDataURL("image/jpeg", 0.88);
    } catch (e) {}
  } else if (ts) ts.src = (document.getElementById("map-img") as HTMLImageElement).src;
}

/* ---------- símbolos gerados por posição (determinísticos) ---------- */
/** Símbolo desenhado no mapa vetorial: t = tipo; c = a cidade/vila de onde veio (para o rótulo). */
interface Simbolo {
  t: string;
  x: number;
  y: number;
  s?: number;
  h: number;
  c?: Cidade | Vila;
  port?: number;
}
/* v7.7 — (x0,y0)-(x1,y1) é a região desenhada; cada tipo de símbolo procura em volta dela só a margem que o maior
   símbolo daquele tipo ocupa (antes era uma margem fixa de 64–160 unidades: no zoom de perto, um ladrilho de 16
   unidades gerava e desenhava as árvores de uma área dezenas de vezes maior). Os símbolos saem dos mesmos hashes. */
function maGenSymbols(x0: number, y0: number, x1: number, y1: number, r: number) {
  const out: Simbolo[] = [],
    K = WORLD_K,
    d = [0, 0, 0],
    north = (x: number, y: number) => y < 230 * K || (x > 640 * K && y < 330 * K);
  // árvores: tamanho/espaçamento pelo zoom (longe = poucas e grandes; perto = muitas e pequenas)
  // (a maior, s = 1,4·ts, ocupa de 1,4·ts à esquerda a 2,24·ts à direita, de 3,8·ts acima a 0,84·ts abaixo do pé)
  const ts = Math.max(4.6, 5.2 / r),
    cs = ts * 1.75,
    lvl = Math.round(Math.log2(cs) * 4);
  for (let i = Math.floor((x0 - 2.4 * ts) / cs); i <= Math.floor((x1 + 1.7 * ts) / cs); i++)
    for (let j = Math.floor((y0 - 1 * ts) / cs); j <= Math.floor((y1 + 4.1 * ts) / cs); j++) {
      const h1 = maH2(i, j, lvl),
        x = (i + 0.15 + 0.7 * maH2(i, j, lvl + 1)) * cs,
        y = (j + 0.15 + 0.7 * maH2(i, j, lvl + 2)) * cs;
      maDensEm(x, y, d);
      if (d[2] < 18 || d[1] > 2) continue;
      const f = d[0] / 255,
        pr = Math.pow(Math.max(0, (f - 0.3) / 0.7), 1.25) * 0.92 + 0.012;
      if (h1 > pr) continue;
      const pine = north(x, y) ? maH2(i, j, 7) < 0.7 : maH2(i, j, 7) < 0.18;
      out.push({ t: pine ? "pine" : "tree", x, y, s: ts * (0.75 + 0.45 * maH2(i, j, 9) + f * 0.2), h: maH2(i, j, 11) });
    }
  // picos: camada grande (cordilheira) + camada pequena (contrafortes) de perto
  // (um pico de tamanho S ocupa de 0,74·S à esquerda a 1,19·S à direita, com a sombra, e de 0,88·S acima a 0,32·S abaixo;
  // v8.1: a imagem do modelo, maPicoModelo, até ~1,0·S de cada lado, ~1,0·S acima e ~0,7·S abaixo)
  const layers = [
    [44, 1, 0, K * (6.5 + 26) * 1.15],
    [20, 0.5, 0.45, K * (3 + 12 * 0.35) * 1.15],
  ];
  for (const [cell, kSz, minR, S] of layers) {
    if (r < minR) continue;
    for (let i = Math.floor((x0 - 1.25 * S) / cell); i <= Math.floor((x1 + 1.1 * S) / cell); i++)
      for (let j = Math.floor((y0 - 0.8 * S) / cell); j <= Math.floor((y1 + 1.1 * S) / cell); j++) {
        const x = (i + 0.1 + 0.8 * maH2(i, j, 21 + cell)) * cell,
          y = (j + 0.1 + 0.8 * maH2(i, j, 22 + cell)) * cell;
        maDensEm(x, y, d);
        if (d[1] < 10) continue;
        const core = (d[1] - 8) / 8;
        if (maH2(i, j, 23 + cell) > (kSz === 1 ? 0.55 + Math.min(core, 20) * 0.03 : 0.7)) continue;
        const s =
          (kSz === 1 ? K * (6.5 + Math.min(core, 26) * 1.0) : K * (3 + Math.min(core, 12) * 0.35)) *
          (0.85 + 0.3 * maH2(i, j, 24));
        out.push({ t: "peak", x, y, s, h: maH2(i, j, 25 + cell) });
      }
  }
  // pedras soltas nas montanhas (de perto)
  if (r >= 0.9) {
    const cell = 13; // (pedra de no máximo 4,8: 6 de margem dos lados e embaixo, 1 em cima)
    for (let i = Math.floor((x0 - 6) / cell); i <= Math.floor((x1 + 6) / cell); i++)
      for (let j = Math.floor((y0 - 1) / cell); j <= Math.floor((y1 + 6) / cell); j++) {
        if (maH2(i, j, 31) > 0.3) continue;
        const x = (i + maH2(i, j, 32)) * cell,
          y = (j + maH2(i, j, 33)) * cell;
        maDensEm(x, y, d);
        if (d[1] < 10) continue;
        out.push({ t: "rock", x, y, s: 2.2 + maH2(i, j, 34) * 2.6, h: maH2(i, j, 35) });
      }
  }
  return out;
}

/* ---------- desenho de uma região do mundo ---------- */
function maRenderRegion(x0: number, y0: number, w: number, h: number, r: number, cvIn?: HTMLCanvasElement) {
  const g = maRenderPassos(x0, y0, w, h, r, cvIn);
  let p = g.next();
  while (!p.done) p = g.next();
  return p.value;
}
/** v8.1 — o terreno pintado no Modo Editor (ED.dados.terreno, unidades do mapa) por cima do ladrilho, na ordem: terra
 *  = a imagem de terra (com o papel) dentro do círculo, com uma beira de areia; água = a imagem do mar. */
function tracosNoMapa(
  c: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  pw: number,
  ph: number,
) {
  const L = ED.dados.terreno;
  if (!L || !L.length) return;
  for (const t of L) {
    if (t.x + t.r * 1.2 < x0 || t.x - t.r * 1.2 > x0 + w || t.y + t.r * 1.2 < y0 || t.y - t.r * 1.2 > y0 + h) continue;
    c.save();
    if (t.t === "terra") {
      c.fillStyle = "rgba(222,204,150,.9)";
      c.beginPath();
      c.arc(t.x, t.y, t.r * 1.12, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    c.clip();
    if (t.t === "terra") {
      c.drawImage(MAPART.land, 0, 0, TELAS.worldW, TELAS.worldH);
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = c.createPattern(MAPART.paper, "repeat")!;
      c.fillRect(0, 0, pw, ph);
      c.restore();
    } else c.drawImage(MAPART.sea, 0, 0, TELAS.worldW, TELAS.worldH);
    c.restore();
  }
}
/** v8.1 — o terreno pintado mudou: os ladrilhos do mapa são desenhados de novo. */
export function mapaTerrenoMudou() {
  MAPART.tiles.clear();
  LAD.fila.clear();
  for (const el of LAD.postos.values()) el.remove();
  LAD.postos.clear();
  MAPART.dirty = true;
}
/** v7.7 — o desenho de uma região em passos (o fundo em 4 partes, depois um símbolo por passo): os ladrilhos do mapa
    são desenhados aos poucos, alguns milissegundos por quadro (mapComposeBase), sem travar o quadro. */
function* maRenderPassos(
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  cvIn?: HTMLCanvasElement,
): Generator<void, HTMLCanvasElement> {
  const pw = Math.ceil(w * r) + MA_PAD * 2,
    ph = Math.ceil(h * r) + MA_PAD * 2,
    cv = cvIn || document.createElement("canvas");
  cv.width = pw;
  cv.height = ph;
  const c = cv.getContext("2d")!,
    L = (px: number) => px / r,
    SF = Math.max(1.8, 2.6 / r); // SF: cidades/barcos legíveis de longe
  c.setTransform(r, 0, 0, r, -x0 * r + MA_PAD, -y0 * r + MA_PAD);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  const mg = (160 * WORLD_K) / 4,
    vx0 = x0 - mg * 0.4,
    vy0 = y0 - 30,
    vx1 = x0 + w + mg * 0.4,
    vy1 = y0 + h + mg;
  // v7.7: só os trechos da costa que passam na região (com folga para a linha mais grossa, L(5))
  const fol = 4 + L(6),
    costa = costaLocal(x0 - fol, y0 - fol, x0 + w + fol, y0 + h + fol);
  c.drawImage(MAPART.sea, 0, 0, TELAS.worldW, TELAS.worldH);
  [
    [0.26, 1.1],
    [0.15, 1],
    [0.08, 0.9],
  ].forEach(([a, lw], i) => {
    c.strokeStyle = "rgba(225,245,250," + a + ")";
    c.lineWidth = L(lw);
    c.setLineDash(i === 2 ? [L(5), L(4)] : []);
    c.stroke(MAPART.ripple[i]);
  });
  c.setLineDash([]);
  c.save();
  c.strokeStyle = "rgba(235,248,250,.38)";
  c.lineWidth = Math.max(L(2.4), 1.2);
  c.stroke(costa);
  c.restore();
  yield;
  c.save();
  c.clip(MAPART.coast, "evenodd");
  c.drawImage(MAPART.land, 0, 0, TELAS.worldW, TELAS.worldH);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = c.createPattern(MAPART.paper, "repeat")!;
  c.fillRect(0, 0, pw, ph);
  c.restore();
  yield;
  if (r >= 3) {
    c.strokeStyle = "rgba(70,95,35,.3)";
    c.lineWidth = L(0.9);
    c.beginPath();
    const step = 5.5; // v7.7: só os tufos da região (cada um ocupa até 3 para os lados e acima), em posições exatas
    for (let ix = Math.floor((x0 - 3) / step); ix * step < x0 + w + 3; ix++)
      for (let iy = Math.floor(y0 / step); iy * step < y0 + h + 4; iy++) {
        const gx = ix * step,
          gy = iy * step;
        const hh = maHash(gx * 0.37 + gy * 1.91);
        if (hh > 0.55) continue;
        const px = gx + maHash(gx + gy * 3.3) * step,
          py = gy + maHash(gx * 2.2 - gy) * step,
          k = 0.9 + hh;
        c.moveTo(px - k, py);
        c.lineTo(px - k * 1.4, py - k * 1.6);
        c.moveTo(px, py);
        c.lineTo(px, py - k * 2);
        c.moveTo(px + k, py);
        c.lineTo(px + k * 1.5, py - k * 1.5);
      }
    c.stroke();
    yield;
  }
  c.strokeStyle = "rgba(90,70,30,.28)";
  c.lineWidth = Math.max(L(5), 2.2);
  c.stroke(costa);
  c.strokeStyle = "rgba(255,240,200,.35)";
  c.lineWidth = Math.max(L(1.6), 0.9);
  c.stroke(costa);
  c.restore();
  tracosNoMapa(c, x0, y0, w, h, pw, ph);
  c.strokeStyle = "rgba(38,28,14,.85)";
  c.lineWidth = Math.max(L(1.25), 0.45);
  c.stroke(costa);
  for (const rd of MAPART.roads) {
    c.strokeStyle = rd.major ? "rgba(120,86,46,.75)" : "rgba(120,86,46,.55)";
    c.lineWidth = L(rd.major ? 2 : 1.4);
    c.setLineDash([L(rd.major ? 6 : 4), L(3.5)]);
    c.lineCap = "round";
    c.stroke(rd.p);
  }
  c.setLineDash([]);
  c.lineCap = "butt";
  yield;
  const list = maGenSymbols(x0, y0, x0 + w, y0 + h, r);
  for (const o of MAPART.statics!) if (o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1) list.push(o);
  for (const ct of CITIES)
    if (ct.x > vx0 - 80 && ct.x < vx1 + 80 && ct.y > vy0 - 60 && ct.y < vy1 + 120)
      list.push({ t: "city", x: ct.x, y: ct.y, c: ct, h: maHash(ct.x + ct.y) });
  for (const v of MAPART.villages)
    if (v.x > vx0 - 60 && v.x < vx1 + 60 && v.y > vy0 - 60 && v.y < vy1 + 100)
      list.push({ t: v.kind === "t" ? "tower" : "village", x: v.x, y: v.y, c: v, h: maHash(v.x * 3 + v.y) });
  list.sort((a, b) => a.y - b.y);
  for (const o of list) {
    if (o.t === "tree") maTree(c, o, L);
    else if (o.t === "pine") maPine(c, o, L);
    else if (o.t === "peak") {
      if (!maPicoModelo(c, o)) maPeak(c, o, L);
    } else if (o.t === "hill") maHill(c, o, L);
    else if (o.t === "rock") maRock(c, o, L);
    else {
      c.save();
      c.translate(o.x, o.y);
      c.scale(SF, SF);
      c.translate(-o.x, -o.y);
      const Ls = (px: number) => px / r / SF;
      if (o.t === "ship") maShip(c, o, Ls);
      else if (o.t === "city") maTown(c, o, Ls, (o.c as Cidade).level || 1, true);
      else if (o.t === "village") maTown(c, o, Ls, 1, false);
      else maTower(c, o, Ls);
      c.restore();
    }
    yield;
  }
  return cv;
}
/* a lente da sombra da árvore (maTree), em unidades de s: copa = círculo de raio 1 em (0, −1,15), sombra = raio 1,05
   em (0,45, −0,8). a1→b1: o arco da copa que fica dentro da sombra; a2→b2: o arco da sombra que fica dentro da copa. */
const LENTE = (() => {
  const dx = 0.45,
    dy = 0.35,
    d = Math.hypot(dx, dy),
    phi = Math.atan2(dy, dx),
    a = (1 - 1.05 * 1.05 + d * d) / (2 * d),
    h = Math.sqrt(1 - a * a),
    al = Math.atan2(h, a),
    be = Math.atan2(h, a - d);
  return { a1: phi - al, b1: phi + al, a2: phi + be, b2: phi - be + 2 * Math.PI };
})();
const MA_TREE = ["#5f9a45", "#6aa64c", "#57903f", "#76ad52", "#4f8a3d"],
  MA_PINE = ["#3f7a45", "#47844b", "#356b3d"];
function maTree(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number) {
  const s = o.s!,
    x = o.x,
    y = o.y,
    col = MA_TREE[Math.floor(o.h * MA_TREE.length)];
  c.fillStyle = "rgba(40,50,20,.22)";
  c.beginPath();
  c.ellipse(x + s * 0.55, y + s * 0.15, s * 1.05, s * 0.45, 0, 0, 7);
  c.fill();
  c.fillStyle = "#6b4a2a";
  c.fillRect(x - s * 0.13, y - s * 0.55, s * 0.26, s * 0.6);
  c.beginPath();
  c.arc(x, y - s * 1.15, s, 0, 7);
  c.fillStyle = col;
  c.fill();
  // v7.7: a sombra é só a parte do círculo da sombra dentro da copa (a "lente" entre os dois), sem clip() por árvore;
  // o brilho já cabe inteiro dentro da copa
  c.fillStyle = "rgba(20,40,10,.32)";
  c.beginPath();
  c.arc(x, y - s * 1.15, s, LENTE.a1, LENTE.b1);
  c.arc(x + s * 0.45, y - s * 0.8, s * 1.05, LENTE.a2, LENTE.b2);
  c.fill();
  c.fillStyle = "rgba(255,255,200,.22)";
  c.beginPath();
  c.arc(x - s * 0.35, y - s * 1.5, s * 0.45, 0, 7);
  c.fill();
  c.strokeStyle = "rgba(30,45,15,.8)";
  c.lineWidth = Math.max(L(0.8), 0.25);
  c.beginPath();
  c.arc(x, y - s * 1.15, s, 0, 7);
  c.stroke();
}
function maPine(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number) {
  const s = o.s! * 0.95,
    x = o.x,
    y = o.y,
    col = MA_PINE[Math.floor(o.h * MA_PINE.length)];
  c.fillStyle = "rgba(30,45,20,.22)";
  c.beginPath();
  c.ellipse(x + s * 0.6, y + s * 0.1, s * 0.95, s * 0.38, 0, 0, 7);
  c.fill();
  c.fillStyle = "#5e4024";
  c.fillRect(x - s * 0.12, y - s * 0.5, s * 0.24, s * 0.55);
  for (let k = 0; k < 2; k++) {
    const by = y - s * (0.35 + k * 0.95),
      w = s * (1.05 - k * 0.25),
      hh = s * 1.55;
    c.beginPath();
    c.moveTo(x - w, by);
    c.lineTo(x, by - hh);
    c.lineTo(x + w, by);
    c.closePath();
    c.fillStyle = col;
    c.fill();
    c.beginPath();
    c.moveTo(x, by - hh);
    c.lineTo(x + w, by);
    c.lineTo(x + w * 0.1, by);
    c.closePath();
    c.fillStyle = "rgba(10,30,10,.3)";
    c.fill();
    c.beginPath();
    c.moveTo(x - w, by);
    c.lineTo(x, by - hh);
    c.lineTo(x + w, by);
    c.closePath();
    c.strokeStyle = "rgba(20,40,20,.8)";
    c.lineWidth = Math.max(L(0.7), 0.25);
    c.stroke();
  }
}
/** v8.1 — o pico do mapa com a imagem do modelo do campo (render/gl/montanhas.ts imagemMonte): os grandes (o miolo
 *  da cordilheira) viram o pico nevado, os menores (beira e contrafortes) as colinas. Largura = MA_MONTE.larg × o
 *  tamanho do símbolo, a base onde ficava a do triângulo, com uma sombra mole à direita. False sem os modelos. */
const MA_MONTE = { pico: 12, larg: 1.35, sombra: "rgba(60,40,20,.2)" };
function maPicoModelo(c: CanvasRenderingContext2D, o: Simbolo) {
  const s = o.s!,
    im = imagemMonte(s >= MA_MONTE.pico * WORLD_K ? "pico" : "colina", o.h);
  if (!im) return false;
  const k = (s * MA_MONTE.larg) / im.esc,
    x = o.x,
    y = o.y + s * 0.22;
  c.fillStyle = MA_MONTE.sombra;
  c.beginPath();
  c.ellipse(x + s * 0.25, y + s * 0.02, s * 0.75, s * 0.2, 0, 0, Math.PI * 2);
  c.fill();
  c.drawImage(im.cv, x - im.ax * k, y - im.ay * k, im.cv.width * k, im.cv.height * k);
  return true;
}
function maPeak(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number) {
  const s = o.s!,
    x = o.x,
    y = o.y + s * 0.22,
    bw = s * (0.62 + o.h * 0.12),
    hh = s * (0.85 + o.h * 0.25),
    ax = x + (o.h - 0.5) * s * 0.18,
    ay = y - hh,
    mx = x + bw * (0.1 + o.h * 0.15);
  c.fillStyle = "rgba(60,40,20,.22)";
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(x + bw * 1.6, y + s * 0.08);
  c.lineTo(x + bw * 0.2, y + s * 0.1);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(x - bw, y);
  c.lineTo(ax, ay);
  c.lineTo(mx, y);
  c.closePath();
  c.fillStyle = "#d9c49b";
  c.fill();
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(x + bw, y);
  c.lineTo(mx, y);
  c.closePath();
  c.fillStyle = "#9b7b56";
  c.fill();
  c.strokeStyle = "rgba(90,65,40,.45)";
  c.lineWidth = Math.max(L(0.7), 0.25);
  c.beginPath();
  for (let i = 1; i <= 3; i++) {
    const f = i / 4.2;
    c.moveTo(ax + (x - bw - ax) * f * 0.9 + bw * 0.1, ay + (y - ay) * f);
    c.lineTo(ax + (x - bw - ax) * f * 0.6 + bw * 0.25, ay + (y - ay) * (f + 0.15));
  }
  c.stroke();
  if (s > 21 * WORLD_K) {
    const sk = Math.min(0.34, 0.16 + (s / WORLD_K - 21) * 0.012),
      lx = ax + (x - bw - ax) * sk,
      ly = ay + (y - ay) * sk,
      rx = ax + (x + bw - ax) * sk,
      ry = ly;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(rx, ry);
    c.lineTo(ax + (rx - ax) * 0.45, ry - hh * 0.04);
    c.lineTo(ax - bw * 0.05, ry + hh * 0.05);
    c.lineTo(lx + (ax - lx) * 0.4, ly - hh * 0.03);
    c.lineTo(lx, ly);
    c.closePath();
    c.fillStyle = "#f6f2ea";
    c.fill();
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(rx, ry);
    c.lineTo(ax + (rx - ax) * 0.45, ry - hh * 0.04);
    c.lineTo(ax + bw * 0.05, ry + hh * 0.02);
    c.closePath();
    c.fillStyle = "#c9cdd6";
    c.fill();
  }
  c.beginPath();
  c.moveTo(x - bw, y);
  c.lineTo(ax, ay);
  c.lineTo(x + bw, y);
  c.strokeStyle = "rgba(60,42,22,.9)";
  c.lineWidth = Math.max(L(1), 0.35);
  c.stroke();
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(mx, y);
  c.strokeStyle = "rgba(70,50,28,.55)";
  c.lineWidth = Math.max(L(0.7), 0.25);
  c.stroke();
}
function maRock(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number) {
  const s = o.s!,
    x = o.x,
    y = o.y;
  c.beginPath();
  c.moveTo(x - s, y);
  c.lineTo(x - s * 0.6, y - s * 0.8);
  c.lineTo(x + s * 0.2, y - s * 1.05);
  c.lineTo(x + s, y - s * 0.3);
  c.lineTo(x + s * 0.8, y);
  c.closePath();
  c.fillStyle = "#b8a684";
  c.fill();
  c.beginPath();
  c.moveTo(x + s * 0.2, y - s * 1.05);
  c.lineTo(x + s, y - s * 0.3);
  c.lineTo(x + s * 0.8, y);
  c.lineTo(x + s * 0.1, y);
  c.closePath();
  c.fillStyle = "rgba(80,60,35,.35)";
  c.fill();
  c.beginPath();
  c.moveTo(x - s, y);
  c.lineTo(x - s * 0.6, y - s * 0.8);
  c.lineTo(x + s * 0.2, y - s * 1.05);
  c.lineTo(x + s, y - s * 0.3);
  c.lineTo(x + s * 0.8, y);
  c.strokeStyle = "rgba(60,45,25,.8)";
  c.lineWidth = Math.max(L(0.7), 0.25);
  c.stroke();
}
function maShip(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number) {
  const k = o.port ? 0.8 : 1.15,
    x = o.x,
    y = o.y,
    d = o.h < 0.5 ? 1 : -1;
  c.save();
  c.translate(x, y);
  c.scale(d * k, k);
  c.strokeStyle = "rgba(255,255,255,.35)";
  c.lineWidth = L(0.8) / k;
  c.beginPath();
  c.moveTo(-9, 1.5);
  c.quadraticCurveTo(-13, 2.5, -17, 1.5);
  c.moveTo(-9, 3);
  c.quadraticCurveTo(-12, 4.5, -15, 4);
  c.stroke();
  c.fillStyle = "#6b4526";
  c.beginPath();
  c.moveTo(-7, 0);
  c.lineTo(7, 0);
  c.lineTo(4.5, 2.6);
  c.lineTo(-5, 2.6);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(35,22,10,.9)";
  c.lineWidth = L(0.7) / k;
  c.stroke();
  c.strokeStyle = "#4a3018";
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -10);
  c.stroke();
  c.fillStyle = "#f4ecd8";
  c.beginPath();
  c.moveTo(0.6, -9.5);
  c.quadraticCurveTo(6.5, -5, 0.6, -1);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(60,45,25,.7)";
  c.stroke();
  if (!o.port) {
    c.beginPath();
    c.moveTo(-0.6, -8);
    c.quadraticCurveTo(-5, -4.5, -0.6, -1.2);
    c.closePath();
    c.fillStyle = "#e9dcc0";
    c.fill();
    c.stroke();
    c.fillStyle = "#b5523b";
    c.beginPath();
    c.moveTo(0, -10);
    c.lineTo(3, -9.3);
    c.lineTo(0, -8.6);
    c.fill();
  }
  c.restore();
}
function maHill(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number) {
  const w = o.s! * 0.9,
    x = o.x,
    y = o.y,
    hh = o.s! * 0.55;
  c.beginPath();
  c.moveTo(x - w, y);
  c.quadraticCurveTo(x - w * 0.2, y - hh * 1.6, x + w, y);
  c.closePath();
  c.fillStyle = "#b7ad74";
  c.fill();
  c.beginPath();
  c.moveTo(x + w * 0.05, y - hh * 0.78);
  c.quadraticCurveTo(x + w * 0.6, y - hh * 0.6, x + w, y);
  c.lineTo(x + w * 0.1, y);
  c.closePath();
  c.fillStyle = "rgba(90,70,30,.3)";
  c.fill();
  c.beginPath();
  c.moveTo(x - w, y);
  c.quadraticCurveTo(x - w * 0.2, y - hh * 1.6, x + w, y);
  c.strokeStyle = "rgba(70,55,25,.75)";
  c.lineWidth = Math.max(L(0.8), 0.3);
  c.stroke();
}
function maHouse(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  roof: string,
  L: (w: number) => number,
) {
  c.fillStyle = "rgba(40,30,15,.25)";
  c.fillRect(x - w / 2 + w * 0.25, y - h * 0.1, w, h * 0.35);
  c.fillStyle = "#efe3c8";
  c.fillRect(x - w / 2, y - h, w, h);
  c.fillStyle = "rgba(120,90,50,.35)";
  c.fillRect(x + w * 0.1, y - h, w * 0.4, h);
  c.beginPath();
  c.moveTo(x - w * 0.62, y - h);
  c.lineTo(x, y - h - w * 0.75);
  c.lineTo(x + w * 0.62, y - h);
  c.closePath();
  c.fillStyle = roof;
  c.fill();
  c.beginPath();
  c.moveTo(x, y - h - w * 0.75);
  c.lineTo(x + w * 0.62, y - h);
  c.lineTo(x, y - h);
  c.closePath();
  c.fillStyle = "rgba(0,0,0,.22)";
  c.fill();
  c.strokeStyle = "rgba(40,25,10,.85)";
  c.lineWidth = Math.max(L(0.7), 0.05);
  c.strokeRect(x - w / 2, y - h, w, h);
  c.beginPath();
  c.moveTo(x - w * 0.62, y - h);
  c.lineTo(x, y - h - w * 0.75);
  c.lineTo(x + w * 0.62, y - h);
  c.closePath();
  c.stroke();
  c.fillStyle = "#4a3420";
  c.fillRect(x - w * 0.12, y - h * 0.5, w * 0.24, h * 0.5);
}
function maTown(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number, lvl: number, market: boolean) {
  const x = o.x,
    y = o.y - 4,
    n = market ? (lvl >= 4 ? 4 + lvl * 2 : 2 + lvl) : 2,
    R = 3 + lvl * (lvl >= 4 ? 2.8 : 2.2),
    roofs = ["#b5523b", "#a8473a", "#5a6fb0", "#8a5aa8", "#c06a3a"];
  c.fillStyle = "rgba(170,140,90,.45)";
  c.beginPath();
  c.ellipse(x, y, R + 5, (R + 5) * 0.62, 0, 0, 7);
  c.fill();
  for (let i = 0; i < (market ? 3 : 2); i++) {
    const a = o.h * 6 + i * 2.1,
      fx = x + Math.cos(a) * (R + 9),
      fy = y + Math.sin(a) * (R + 6) * 0.7;
    c.save();
    c.translate(fx, fy);
    c.rotate(a);
    c.fillStyle = i % 2 ? "rgba(214,190,110,.75)" : "rgba(150,170,80,.7)";
    c.fillRect(-5, -3, 10, 6);
    c.strokeStyle = "rgba(110,90,40,.55)";
    c.lineWidth = Math.max(L(0.6), 0.05);
    c.beginPath();
    for (let k = -4; k <= 4; k += 2) {
      c.moveTo(k, -3);
      c.lineTo(k, 3);
    }
    c.stroke();
    c.restore();
  }
  const H = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + o.h * 6,
      rr = i === 0 ? 0 : R * Math.sqrt(i / n);
    H.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, i]);
  }
  H.sort((a, b) => a[1] - b[1]);
  for (const [hx, hy, i] of H)
    maHouse(
      c,
      hx,
      hy,
      4.2 + (i === 0 ? 1.2 : 0),
      3.4 + (i === 0 ? 1 : 0),
      roofs[(i + Math.floor(o.h * 5)) % roofs.length],
      L,
    );
  if (lvl >= 4) {
    const cx = x + R * 0.2,
      cy = y - R * 0.35,
      tw = 4.2,
      th = 11;
    c.fillStyle = "#cfc6b3";
    c.fillRect(cx - 9, cy - 7, 18, 7);
    c.strokeStyle = "rgba(40,30,20,.9)";
    c.lineWidth = Math.max(L(0.8), 0.05);
    c.strokeRect(cx - 9, cy - 7, 18, 7);
    for (const dx of [-9, 9, 0]) {
      const hh = dx === 0 ? th + 4 : th;
      c.fillStyle = dx === 0 ? "#ddd5c2" : "#c9bfa9";
      c.fillRect(cx + dx - tw / 2, cy - hh, tw, hh);
      c.strokeRect(cx + dx - tw / 2, cy - hh, tw, hh);
      c.fillStyle = "#7a5a8a";
      c.beginPath();
      c.moveTo(cx + dx - tw * 0.65, cy - hh);
      c.lineTo(cx + dx, cy - hh - 4.5);
      c.lineTo(cx + dx + tw * 0.65, cy - hh);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.strokeStyle = "#3a2a18";
    c.beginPath();
    c.moveTo(cx, cy - th - 8.5);
    c.lineTo(cx, cy - th - 13);
    c.stroke();
    c.fillStyle = "#c0392b";
    c.beginPath();
    c.moveTo(cx, cy - th - 13);
    c.lineTo(cx + 4, cy - th - 12);
    c.lineTo(cx, cy - th - 11);
    c.fill();
  }
}
function maTower(c: CanvasRenderingContext2D, o: Simbolo, L: (w: number) => number) {
  const x = o.x,
    y = o.y;
  c.fillStyle = "rgba(40,30,20,.25)";
  c.beginPath();
  c.ellipse(x + 4, y + 1, 7, 2.5, 0, 0, 7);
  c.fill();
  c.fillStyle = "#b9b1a2";
  c.beginPath();
  c.moveTo(x - 3.2, y);
  c.lineTo(x - 2.4, y - 15);
  c.lineTo(x - 1, y - 16.5);
  c.lineTo(x + 0.6, y - 14.8);
  c.lineTo(x + 2.4, y - 16);
  c.lineTo(x + 3.2, y);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(0,0,0,.25)";
  c.fillRect(x + 0.6, y - 15, 2.6, 15);
  c.strokeStyle = "rgba(40,30,20,.9)";
  c.lineWidth = Math.max(L(0.8), 0.05);
  c.stroke();
  c.fillStyle = "#b48cff";
  c.globalAlpha = 0.85;
  c.fillRect(x - 0.6, y - 10, 1.2, 2.2);
  c.globalAlpha = 1;
  for (const [dx, dy] of [
    [-6, -1],
    [5, 1],
    [7, -2],
  ]) {
    c.fillStyle = "#a9a194";
    c.fillRect(x + dx, y + dy - 1.6, 2.4, 1.6);
  }
}

/* ---------- composição na tela + grade de quadrantes ---------- */
export function mapCompose() {
  // mapComposeBase diz se redesenhou a grade e os nomes (só então o nome do arquipélago vai por cima de novo)
  if (!mapComposeBase()) return;
  /* v7.5 */
  try {
    const lim = Math.max(1.1, mapZoomLimit() * 1.35);
    if (!MAPART.ctx || camera.scale > lim) return;
    const k = quadOf(SPAWN0.x * WORLD_K, SPAWN0.y * WORLD_K),
      R = quadRect(k);
    if (!R) return;
    const c = MAPART.ctx,
      X = (R.x + R.w * 0.6) * camera.scale + camera.tx,
      Y = (R.y + R.h * 0.5) * camera.scale + camera.ty,
      a = Math.min(1, (lim - camera.scale) / (lim * 0.25));
    c.save();
    c.globalAlpha = 0.85 * a;
    c.font = "italic 700 " + Math.round(16 + 8 * a) + "px Cinzel, serif";
    c.textAlign = "center";
    c.lineJoin = "round";
    c.strokeStyle = "rgba(20,30,40,.7)";
    c.lineWidth = 4;
    c.strokeText(ARQ.nome, X, Y);
    c.fillStyle = "#f3e6c0";
    c.fillText(ARQ.nome, X, Y);
    c.font = "11px serif";
    c.fillText("🐟", X, Y + 16);
    c.restore();
  } catch (_) {}
}
/* v7.7 — ladrilhos numa camada própria (documento mestre 7.1/7.3): antes, a cada movimento da câmera o mapa era
   repintado inteiro num canvas de tela cheia, com suavização alta (o que mais pesava no mapa). Agora cada ladrilho é
   um canvas posicionado no mundo dentro de #map-ladrilhos, que a placa de vídeo move e escala com a mesma transformação
   da câmera (applyCameraTransform): arrastar não repinta nada. No zoom, os ladrilhos do nível antigo ficam embaixo,
   esticados, até os do nível novo (nítidos) ficarem prontos por cima; a visão geral (MAPART.ov) é o fundo de tudo.
   O canvas de tela cheia (MAPART.cv) ficou só com a grade, a região ativa e os nomes. */
const LAD = {
  el: null as HTMLDivElement | null,
  postos: new Map<string, HTMLCanvasElement>(),
  fundo: false,
  fila: new Map<string, Generator<void, HTMLCanvasElement>>(), // v7.7: ladrilhos começados, por "z:tx:ty"
  faltam: 0, // ladrilhos da tela ainda não prontos no último quadro
};
/** v7.7 — milissegundos por quadro para desenhar ladrilhos (o resto do quadro fica para o jogo). */
const LAD_ORC = 6;
/** Quantos ladrilhos da tela ainda faltam (0 = o mapa da tela está pronto). */
export function ladrilhosFaltando() {
  return LAD.faltam;
}
/** A camada dos ladrilhos (criada no primeiro uso, embaixo de tudo na #viewport). */
export function camadaLadrilhos() {
  if (LAD.el) return LAD.el;
  const vp = document.getElementById("viewport");
  if (!vp) return null;
  const el = document.createElement("div");
  el.id = "map-ladrilhos";
  el.style.transform = "translate(" + camera.tx + "px," + camera.ty + "px) scale(" + camera.scale + ")";
  vp.insertBefore(el, vp.firstChild);
  LAD.el = el;
  return el;
}
function porNoMundo(cv: HTMLCanvasElement, x: number, y: number, r: number, z: number) {
  const s = cv.style;
  s.left = x - MA_PAD / r + "px";
  s.top = y - MA_PAD / r + "px";
  s.width = cv.width / r + "px";
  s.height = cv.height / r + "px";
  s.zIndex = String(z + 10);
}
function mapComposeBase() {
  if (!MAPART.ready || !MAPART.on || !MAPART.cv) return;
  const cv = MAPART.cv,
    c = MAPART.ctx!,
    vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight,
    dpr = TELAS.canvasDpr,
    camada = camadaLadrilhos();
  if (!camada) return;
  if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
    cv.width = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
    MAPART.dirty = true;
  }
  // o fundo: o mapa todo em baixa resolução, sempre por baixo dos ladrilhos
  if (!LAD.fundo) {
    const rOv = (MAPART.ov.width - MA_PAD * 2) / TELAS.worldW;
    porNoMundo(MAPART.ov, 0, 0, rOv, -10);
    camada.appendChild(MAPART.ov);
    LAD.fundo = true;
  }
  const p = camera.scale * dpr,
    z = Math.max(MA_MINZ, Math.min(MA_MAXZ, Math.ceil(Math.log2(p) - 0.15))),
    r = Math.pow(2, z),
    tw = MA_TILE / r;
  const x0 = -camera.tx / camera.scale,
    y0 = -camera.ty / camera.scale,
    x1 = x0 + vw / camera.scale,
    y1 = y0 + vh / camera.scale;
  const sig =
    z +
    "|" +
    camera.scale.toFixed(4) +
    "|" +
    camera.tx.toFixed(1) +
    "|" +
    camera.ty.toFixed(1) +
    "|" +
    cv.width +
    "|" +
    QUAD.active;
  const need = [];
  for (let ty = Math.floor(Math.max(0, y0) / tw); ty * tw < Math.min(TELAS.worldH, y1); ty++)
    for (let tx = Math.floor(Math.max(0, x0) / tw); tx * tw < Math.min(TELAS.worldW, x1); tx++) need.push([tx, ty]);
  let missing = 0;
  const t0 = performance.now(),
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  need.sort(
    (a, b) =>
      Math.hypot((a[0] + 0.5) * tw - cx, (a[1] + 0.5) * tw - cy) -
      Math.hypot((b[0] + 0.5) * tw - cx, (b[1] + 0.5) * tw - cy),
  );
  /* v7.7: cada ladrilho que falta é desenhado em passos (maRenderPassos), os mais perto do centro primeiro, até
     LAD_ORC ms por quadro; um ladrilho começado continua no quadro seguinte e só aparece pronto. Antes, um ladrilho
     inteiro era desenhado de uma vez (o limite de 8 ms só era olhado antes de começar) e travava o quadro. */
  const precisa = new Set(need.map(([tx, ty]) => z + ":" + tx + ":" + ty));
  for (const k of LAD.fila.keys()) if (!precisa.has(k)) LAD.fila.delete(k);
  let posto = false;
  for (const [tx, ty] of need) {
    const k = z + ":" + tx + ":" + ty;
    if (MAPART.tiles.has(k)) continue;
    if (performance.now() - t0 >= LAD_ORC) {
      missing++;
      continue;
    }
    let g = LAD.fila.get(k);
    if (!g) LAD.fila.set(k, (g = maRenderPassos(tx * tw, ty * tw, tw, tw, r)));
    let passo = g.next();
    while (!passo.done && performance.now() - t0 < LAD_ORC) passo = g.next();
    if (!passo.done) {
      missing++;
      continue;
    }
    LAD.fila.delete(k);
    porNoMundo(passo.value, tx * tw, ty * tw, r, z);
    MAPART.tiles.set(k, { cv: passo.value, at: 0 });
    posto = true;
  }
  LAD.faltam = missing;
  const mudou = MAPART.dirty || sig !== MAPART.lastSig;
  if (!mudou && !posto) return false;
  MAPART.lastSig = sig;
  MAPART.dirty = false;
  // os ladrilhos na tela: os do nível atual; os de outro nível só enquanto faltar algum do atual
  const now = ++MAPART.fr,
    querer = new Set<string>();
  for (const [tx, ty] of need) {
    const k = z + ":" + tx + ":" + ty,
      t = MAPART.tiles.get(k);
    if (!t) continue;
    t.at = now;
    querer.add(k);
    if (!LAD.postos.has(k)) {
      camada.appendChild(t.cv);
      LAD.postos.set(k, t.cv);
    }
  }
  for (const [k, el] of LAD.postos) {
    if (querer.has(k)) continue;
    const fora =
      parseFloat(el.style.left) > x1 ||
      parseFloat(el.style.top) > y1 ||
      parseFloat(el.style.left) + parseFloat(el.style.width) < x0 ||
      parseFloat(el.style.top) + parseFloat(el.style.height) < y0;
    if (!missing || fora || !MAPART.tiles.has(k)) {
      el.remove();
      LAD.postos.delete(k);
    }
  }
  if (MAPART.tiles.size > MA_CACHE) {
    const arr = [...MAPART.tiles.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < arr.length - MA_CACHE; i++) {
      const k = arr[i][0];
      if (LAD.postos.has(k)) continue; // na tela: fica
      MAPART.tiles.delete(k);
    }
  }
  if (!mudou) return false; // só ficou pronto um ladrilho: a grade e os nomes continuam iguais
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(p, 0, 0, p, camera.tx * dpr, camera.ty * dpr); // grade dos quadrantes
  c.save();
  c.setLineDash([10 / camera.scale, 8 / camera.scale]);
  c.lineWidth = 1.2 / camera.scale;
  c.strokeStyle = "rgba(255,236,190,.28)";
  c.beginPath();
  for (let i = 1; i < QUAD.cols; i++) {
    c.moveTo(i * QUAD.w, 0);
    c.lineTo(i * QUAD.w, TELAS.worldH);
  }
  for (let j = 1; j < QUAD.rows; j++) {
    c.moveTo(0, j * QUAD.h);
    c.lineTo(TELAS.worldW, j * QUAD.h);
  }
  c.stroke();
  c.restore();
  const aq = quadRect(QUAD.active);
  if (aq) {
    c.save();
    c.fillStyle = "rgba(255,225,150,.05)";
    c.fillRect(aq.x, aq.y, aq.w, aq.h);
    c.restore();
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.textAlign = "center";
  c.lineJoin = "round";
  const sx = (wx: number) => wx * camera.scale + camera.tx,
    sy = (wy: number) => wy * camera.scale + camera.ty;
  // rótulos dos quadrantes (canto de cada um)
  c.font = "700 11px Cinzel, serif";
  c.textAlign = "left";
  for (let i = 0; i < QUAD.cols; i++)
    for (let j = 0; j < QUAD.rows; j++) {
      const X = sx(i * QUAD.w) + 6,
        Y = sy(j * QUAD.h) + 15;
      if (X < -40 || Y < -20 || X > vw || Y > vh) continue;
      const act = quadKey(i, j) === QUAD.active;
      c.fillStyle = act ? "rgba(255,226,150,.95)" : "rgba(255,240,210,.55)";
      c.strokeStyle = "rgba(20,12,4,.6)";
      c.lineWidth = 3;
      const tx = quadName(i, j) + (act ? " · região ativa" : "");
      c.strokeText(tx, X, Y);
      c.fillText(tx, X, Y);
    }
  c.textAlign = "center";
  for (const ct of CITIES) {
    const X = sx(ct.x),
      Y = sy(ct.y) + 10 + Math.min(26, camera.scale * 9);
    if (X < -80 || X > vw + 80 || Y < -20 || Y > vh + 30) continue;
    maLabel(c, ct.name, X, Y, (ct.level || 1) >= 4 ? 14 : 12, true);
  }
  if (camera.scale > 0.55)
    for (const v of MAPART.villages) {
      const X = sx(v.x),
        Y = sy(v.y) + 8 + Math.min(20, camera.scale * 7);
      if (X < -80 || X > vw + 80 || Y < -20 || Y > vh + 30) continue;
      maLabel(c, v.name, X, Y, 10.5, false);
    }
  return true;
}
function maLabel(c: CanvasRenderingContext2D, txt: string, X: number, Y: number, fs: number, major: boolean) {
  c.font = (major ? "700 " : "italic 600 ") + fs + "px " + (major ? "Cinzel, serif" : "Lora, serif");
  const w = c.measureText(txt).width;
  if (major) {
    c.fillStyle = "rgba(30,20,8,.62)";
    c.beginPath();
    c.roundRect(X - w / 2 - 7, Y - fs + 1, w + 14, fs + 6, 4);
    c.fill();
    c.strokeStyle = "rgba(224,179,95,.55)";
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = "#f6dfa6";
    c.fillText(txt, X, Y + 1);
  } else {
    c.lineWidth = 3;
    c.strokeStyle = "rgba(255,248,230,.85)";
    c.strokeText(txt, X, Y);
    c.fillStyle = "#3a2a14";
    c.fillText(txt, X, Y);
  }
}
