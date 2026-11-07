/* ==== v8.0 — o terreno do mapa lido ponto a ponto, para o campo aberto (map/mundo.ts, render/gl/mundo_cena.ts) ====
   O campo que se abre pelo mapa é o mesmo lugar: água onde o mapa tem água (mar, lago, rio = fora do contorno da costa,
   MAPART.coast com "evenodd", como o mapa recorta a terra), floresta onde o mapa tem floresta (as MESMAS árvores que o
   mapa desenha no zoom máximo: mesmas células, mesmo hash e mesma regra de maGenSymbols em map/vetorial.ts), montanha
   e a cor do chão tirada da imagem de terra do mapa (MAPART.land). Tudo em unidades do mapa.
   v8.1: o paredão da montanha (MONTANHA, montanhaEm) barra o caminho no mapa (map/navegacao.ts, sim/animais.ts) e no
   campo (map/mundo.ts barrado); o campo o enche com os modelos do Tripo (render/gl/montanhas.ts).
   A máscara de terra é desenhada por blocos (TERRENO.bloco unidades, 1 px por unidade) e guardada; a imagem de terra
   vira pixels uma vez. Sem o mapa pronto (testes em Node, carga), é tudo terra sem floresta. */
import { MAPART, maDens, WORLD_K } from "./vetorial.ts";
import { TELAS } from "../core/state.ts";
import { ED } from "../editor/estado.ts";

/** bloco: lado (unidades do mapa) de cada pedaço da máscara de terra; arvCel e arvLvl: a grade das árvores do mapa no
 *  zoom máximo (maGenSymbols com ts = 4,6: célula 4,6 × 1,75 e o nível do hash que sai dela). */
const TERRENO = { bloco: 256, arvCel: 4.6 * 1.75, arvLvl: Math.round(Math.log2(4.6 * 1.75) * 4), cache: 48 };

const MASCARA = new Map<string, Uint8Array>();
const TERRA = { px: null as Uint8ClampedArray | null, w: 0, h: 0 };

/** O mapa já pode ser lido (desenho vetorial pronto). */
export function terrenoPronto() {
  return !!(MAPART.ready && MAPART.coast && TELAS.worldW);
}

function bloco(bx: number, by: number) {
  const k = bx + "," + by;
  let m = MASCARA.get(k);
  if (m) return m;
  const B = TERRENO.bloco,
    cv = document.createElement("canvas");
  cv.width = cv.height = B;
  const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.setTransform(1, 0, 0, 1, -bx * B + 0.5, -by * B + 0.5);
  c.fillStyle = "#fff";
  c.fill(MAPART.coast, "evenodd");
  pintarTracos(c, bx * B, by * B, B, B);
  const px = c.getImageData(0, 0, B, B).data;
  m = new Uint8Array(B * B);
  for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] >= 128 ? 1 : 0;
  if (MASCARA.size >= TERRENO.cache) MASCARA.delete(MASCARA.keys().next().value!);
  MASCARA.set(k, m);
  return m;
}

/** v8.1 — as pinceladas do pincel de terreno (Modo Editor, ED.dados.terreno) por cima da costa, na ordem: terra
 *  pinta, água apaga. `c` já está nas unidades do mapa; (x0, y0, w, h) = a região, para pular as que não encostam. */
function pintarTracos(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  const L = ED.dados.terreno;
  if (!L || !L.length) return;
  c.save();
  for (const t of L) {
    if (t.x + t.r < x0 || t.x - t.r > x0 + w || t.y + t.r < y0 || t.y - t.r > y0 + h) continue;
    c.globalCompositeOperation = t.t === "terra" ? "source-over" : "destination-out";
    c.beginPath();
    c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
/** v8.1 — o terreno pintado mudou na área (unidades do mapa; sem área = tudo): a máscara de lá é refeita. */
export function terrenoMudou(area?: { x0: number; y0: number; x1: number; y1: number }) {
  const B = TERRENO.bloco;
  for (const k of [...MASCARA.keys()]) {
    const [bx, by] = k.split(",").map(Number);
    if (!area || (bx * B < area.x1 && (bx + 1) * B > area.x0 && by * B < area.y1 && (by + 1) * B > area.y0))
      MASCARA.delete(k);
  }
}

/** Água no ponto (x, y) do mapa (fora do mundo também é água). */
export function aguaEm(x: number, y: number) {
  if (!terrenoPronto()) return false;
  if (x < 0 || y < 0 || x >= TELAS.worldW || y >= TELAS.worldH) return true;
  const B = TERRENO.bloco,
    bx = Math.floor(x / B),
    by = Math.floor(y / B);
  return bloco(bx, by)[Math.floor(y - by * B) * B + Math.floor(x - bx * B)] === 0;
}

/** Densidades do mapa no ponto: [floresta 0–255, núcleo de montanha (0 = fora), distância da costa]. */
export function densEm(x: number, y: number) {
  return terrenoPronto() ? maDens(x, y) : [0, 0, 255];
}

/** v8.1 — montanha (mantenedor 2026-11-06: "não passa, contorna"). O canal G da densidade do mapa é a distância até
 *  a borda da área de montanha (~12 por casa do campo, até 252 no miolo). borda: onde a montanha começa (o pé, que se
 *  anda: pedras e morrotes soltos); parede: daí para dentro não se passa, nem no mapa nem no campo (4 casas da borda);
 *  saida: até onde quem estava dentro (save antigo) é levado para fora. */
export const MONTANHA = { borda: 10, parede: 48, saida: 40 };

/** O valor de montanha (canal G, 0 = fora) no ponto do mapa; 0 sem o mapa pronto. */
export function montanhaG(x: number, y: number) {
  return MAPART.dens ? maDens(x, y)[1] : 0;
}
/** v8.1 — o ponto do mapa está no paredão da montanha (não se anda). */
export function montanhaEm(x: number, y: number) {
  return montanhaG(x, y) >= MONTANHA.parede;
}
/** v8.1 — o ponto do mapa mais perto de (x, y) fora do paredão (no pé da montanha); o próprio ponto se já está fora. */
export function foraDaMontanha(x: number, y: number) {
  if (montanhaG(x, y) < MONTANHA.parede) return { x, y };
  for (let r = 4; r <= 400; r += 4)
    for (let q = 0; q < 24; q++) {
      const a = (q / 24) * Math.PI * 2,
        px = x + Math.cos(a) * r,
        py = y + Math.sin(a) * r;
      if (montanhaG(px, py) < MONTANHA.saida && !aguaEm(px, py)) return { x: px, y: py };
    }
  return { x, y };
}

/** Cor da terra do mapa no ponto (0–1), ou null sem o mapa. */
export function corTerra(x: number, y: number) {
  if (!terrenoPronto()) return null;
  if (!TERRA.px) {
    const im = MAPART.land;
    if (!im || !im.naturalWidth) return null;
    const cv = document.createElement("canvas");
    cv.width = im.naturalWidth;
    cv.height = im.naturalHeight;
    const c = cv.getContext("2d", { willReadFrequently: true })!;
    c.drawImage(im, 0, 0);
    TERRA.px = c.getImageData(0, 0, cv.width, cv.height).data;
    TERRA.w = cv.width;
    TERRA.h = cv.height;
  }
  const i = Math.max(0, Math.min(TERRA.w - 1, Math.floor((x / TELAS.worldW) * TERRA.w))),
    j = Math.max(0, Math.min(TERRA.h - 1, Math.floor((y / TELAS.worldH) * TERRA.h))),
    k = (j * TERRA.w + i) * 4;
  return [TERRA.px[k] / 255, TERRA.px[k + 1] / 255, TERRA.px[k + 2] / 255];
}

/* o hash das árvores do mapa (o mesmo de map/vetorial.ts) */
function maHash(n: number) {
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function maH2(i: number, j: number, s: number) {
  return maHash(i * 157.31 + j * 311.7 + s * 71.13);
}
/** Uma árvore do mapa: posição, pinheiro ou não, tamanho relativo (0–1) e um número fixo dela. */
interface ArvoreMapa {
  x: number;
  y: number;
  pinho: boolean;
  t: number;
  h: number;
  f: number;
}
/** As árvores que o mapa desenha no zoom máximo dentro de (x0, y0)-(x1, y1) (mesma regra de maGenSymbols). */
export function arvoresEm(x0: number, y0: number, x1: number, y1: number) {
  const out: ArvoreMapa[] = [];
  if (!terrenoPronto()) return out;
  const K = WORLD_K,
    cs = TERRENO.arvCel,
    lvl = TERRENO.arvLvl,
    norte = (x: number, y: number) => y < 230 * K || (x > 640 * K && y < 330 * K);
  for (let i = Math.floor(x0 / cs) - 1; i <= Math.floor(x1 / cs); i++)
    for (let j = Math.floor(y0 / cs) - 1; j <= Math.floor(y1 / cs); j++) {
      const x = (i + 0.15 + 0.7 * maH2(i, j, lvl + 1)) * cs,
        y = (j + 0.15 + 0.7 * maH2(i, j, lvl + 2)) * cs;
      if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
      const d = maDens(x, y);
      if (d[2] < 18 || d[1] > 2) continue;
      const f = d[0] / 255,
        pr = Math.pow(Math.max(0, (f - 0.3) / 0.7), 1.25) * 0.92 + 0.012;
      if (maH2(i, j, lvl) > pr) continue;
      out.push({
        x,
        y,
        pinho: norte(x, y) ? maH2(i, j, 7) < 0.7 : maH2(i, j, 7) < 0.18,
        t: maH2(i, j, 9),
        h: maH2(i, j, 11),
        f,
      });
    }
  return out;
}
