/* Fatiar folhas de sprites (ver tools/slice-sheet.ts): máscaras, morfologia, rótulos de componentes, linhas e alfa.
   Puro, sem I/O: testado em tests/unit/fatias.test.ts. Substitui o scipy.ndimage dos antigos scripts/assets/slice*.py
   (Fase 7): label + find_objects → rotular, binary_opening/closing → abrir/fechar, binary_fill_holes →
   preencherBuracos, grey_erosion → minimo, gaussian_filter → desfocar; rows_of → emLinhas, cut/unblack → alfaFundo,
   clean_alpha → limparAlfa.
   Diferença do scipy: na erosão, o que fica fora da imagem é ignorado (o scipy conta como desligado). Assim fechar()
   nunca apaga pixels de um objeto que encosta na borda; em troca, abrir() não apaga um cisco encostado nela. */

/** Imagem crua, linha a linha (`canais` = 3 ou 4; R, G, B primeiro). */
export interface Imagem {
  w: number;
  h: number;
  canais: number;
  d: Uint8Array;
}
/** Máscara binária: 1 = ligado. */
export interface Mascara {
  w: number;
  h: number;
  d: Uint8Array;
}
/** Retângulo [x0, y0, x1, y1), com x1/y1 exclusivos (como as fatias do find_objects). */
export type Caixa = [number, number, number, number];
/** Elemento estruturante: a cruz 3×3 repetida `vezes` (o padrão do scipy com `iterations=n`) ou um retângulo. */
export type Elemento = { forma: "cruz"; vezes: number } | { forma: "ret"; larg: number; alt: number };

/** Pixels com max(R, G, B) acima de `lim` (ou abaixo, com `acima` falso). */
export function limiar(img: Imagem, lim: number, acima = true): Mascara {
  const n = img.w * img.h;
  const d = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * img.canais;
    const mx = Math.max(img.d[p], img.d[p + 1], img.d[p + 2]);
    d[i] = (acima ? mx > lim : mx < lim) ? 1 : 0;
  }
  return { w: img.w, h: img.h, d };
}

/** Recorta a caixa (limitada à imagem). */
export function recortar(img: Imagem, c: Caixa): Imagem {
  const x0 = Math.max(0, c[0]);
  const y0 = Math.max(0, c[1]);
  const x1 = Math.min(img.w, c[2]);
  const y1 = Math.min(img.h, c[3]);
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  const d = new Uint8Array(w * h * img.canais);
  for (let y = 0; y < h; y++) {
    const de = ((y0 + y) * img.w + x0) * img.canais;
    d.set(img.d.subarray(de, de + w * img.canais), y * w * img.canais);
  }
  return { w, h, canais: img.canais, d };
}

/* ---------- morfologia ---------- */

// Janela 1D de tamanho k: deslocamentos de lo a lo + k - 1, com o centro em k/2 como no scipy (k = 2 → -1..0).
const janela = (k: number) => -(k >> 1);

/** Uma passada 1D (linhas se `horiz`): dilatação = algum ligado na janela; erosão = todos os de dentro da imagem. */
function passada1D(m: Mascara, k: number, horiz: boolean, dilata: boolean): Mascara {
  const { w, h } = m;
  const d = new Uint8Array(w * h);
  const comp = horiz ? w : h;
  const linhas = horiz ? h : w;
  const passo = horiz ? 1 : w;
  // dilatação: out[x] = OU de m[x - t]; erosão: out[x] = E de m[x + t], t em [lo, lo + k - 1]
  const lo = janela(k);
  const soma = new Int32Array(comp + 1);
  for (let l = 0; l < linhas; l++) {
    const base = horiz ? l * w : l;
    for (let x = 0; x < comp; x++) soma[x + 1] = soma[x] + m.d[base + x * passo];
    for (let x = 0; x < comp; x++) {
      const a = dilata ? x - (lo + k - 1) : x + lo;
      const b = a + k - 1;
      const a2 = Math.max(0, a);
      const b2 = Math.min(comp - 1, b);
      const cont = b2 >= a2 ? soma[b2 + 1] - soma[a2] : 0;
      d[base + x * passo] = dilata ? (cont > 0 ? 1 : 0) : cont === b2 - a2 + 1 && b2 >= a2 ? 1 : 0;
    }
  }
  return { w, h, d };
}

function passadaCruz(m: Mascara, dilata: boolean): Mascara {
  const { w, h } = m;
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const viz = [m.d[i]];
      if (x > 0) viz.push(m.d[i - 1]);
      if (x < w - 1) viz.push(m.d[i + 1]);
      if (y > 0) viz.push(m.d[i - w]);
      if (y < h - 1) viz.push(m.d[i + w]);
      d[i] = (dilata ? viz.some((v) => v) : viz.every((v) => v)) ? 1 : 0;
    }
  return { w, h, d };
}

function morfo(m: Mascara, el: Elemento, dilata: boolean): Mascara {
  if (el.forma === "cruz") {
    let r = m;
    for (let i = 0; i < el.vezes; i++) r = passadaCruz(r, dilata);
    return r;
  }
  return passada1D(passada1D(m, el.larg, true, dilata), el.alt, false, dilata);
}

export const dilatar = (m: Mascara, el: Elemento) => morfo(m, el, true);
export const erodir = (m: Mascara, el: Elemento) => morfo(m, el, false);
/** Abertura (erosão e dilatação): apaga pontos e fios menores que o elemento. */
export const abrir = (m: Mascara, el: Elemento) => dilatar(erodir(m, el), el);
/** Fechamento (dilatação e erosão): junta partes separadas por frestas menores que o elemento. */
export const fechar = (m: Mascara, el: Elemento) => erodir(dilatar(m, el), el);

/** Visita, a partir das sementes, os pixels 4-vizinhos que `pode` aceitar; devolve a marca (1 = alcançado). */
function inundar(w: number, h: number, sementes: number[], pode: (i: number) => boolean): Uint8Array {
  const n = w * h;
  const marca = new Uint8Array(n);
  const pilha: number[] = [];
  const pisar = (i: number) => {
    if (!marca[i] && pode(i)) {
      marca[i] = 1;
      pilha.push(i);
    }
  };
  for (const i of sementes) pisar(i);
  while (pilha.length) {
    const i = pilha.pop()!;
    const x = i % w;
    if (x > 0) pisar(i - 1);
    if (x < w - 1) pisar(i + 1);
    if (i >= w) pisar(i - w);
    if (i < n - w) pisar(i + w);
  }
  return marca;
}

/** Índices dos pixels da borda da imagem. */
function borda(w: number, h: number): number[] {
  const r: number[] = [];
  for (let x = 0; x < w; x++) r.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) r.push(y * w, y * w + w - 1);
  return r;
}

/** Liga os buracos: pixels desligados que não alcançam a borda por desligados (vizinhança 4, como o scipy). */
export function preencherBuracos(m: Mascara): Mascara {
  const fora = inundar(m.w, m.h, borda(m.w, m.h), (i) => !m.d[i]);
  const d = new Uint8Array(m.w * m.h);
  for (let i = 0; i < d.length; i++) d[i] = fora[i] ? 0 : 1;
  return { w: m.w, h: m.h, d };
}

/* ---------- componentes ---------- */

export interface Rotulos {
  /** Rótulo por pixel: 0 = desligado, 1..n = componente. */
  rot: Int32Array;
  n: number;
  /** Caixa e área de cada componente (índice = rótulo - 1). */
  caixas: Caixa[];
  areas: number[];
}

/** Componentes conexos (vizinhança 4, a padrão do scipy, ou 8), numerados na ordem de leitura do 1º pixel. */
export function rotular(m: Mascara, oito = false): Rotulos {
  const { w, h } = m;
  const rot = new Int32Array(w * h);
  const caixas: Caixa[] = [];
  const areas: number[] = [];
  const pilha: number[] = [];
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!m.d[i0] || rot[i0]) continue;
    const r = caixas.length + 1;
    const cx: Caixa = [w, h, 0, 0];
    let area = 0;
    rot[i0] = r;
    pilha.push(i0);
    while (pilha.length) {
      const i = pilha.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      area++;
      if (x < cx[0]) cx[0] = x;
      if (y < cx[1]) cx[1] = y;
      if (x + 1 > cx[2]) cx[2] = x + 1;
      if (y + 1 > cx[3]) cx[3] = y + 1;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!oito && dx && dy)) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (m.d[j] && !rot[j]) {
            rot[j] = r;
            pilha.push(j);
          }
        }
    }
    caixas.push(cx);
    areas.push(area);
  }
  return { rot, n: caixas.length, caixas, areas };
}

export interface FiltroPeca {
  /** Área mínima (exclusiva, como o `area > minA` dos scripts). */
  areaMin?: number;
  /** Largura e altura mínimas (exclusivas). */
  ladoMin?: number;
  /** Largura e altura máximas (exclusivas). */
  ladoMax?: number;
  /** Só a largura ou só a altura mínima (exclusivas). */
  largMin?: number;
  altMin?: number;
}

/** Caixas dos componentes que passam o filtro, deslocadas por (dx, dy). */
export function pecas(m: Mascara, f: FiltroPeca = {}, dx = 0, dy = 0, oito = false): Caixa[] {
  const R = rotular(m, oito);
  const out: Caixa[] = [];
  R.caixas.forEach((c, i) => {
    const w = c[2] - c[0];
    const h = c[3] - c[1];
    if (f.areaMin !== undefined && !(R.areas[i] > f.areaMin)) return;
    if (f.ladoMin !== undefined && !(w > f.ladoMin && h > f.ladoMin)) return;
    if (f.ladoMax !== undefined && !(w < f.ladoMax && h < f.ladoMax)) return;
    if (f.largMin !== undefined && !(w > f.largMin)) return;
    if (f.altMin !== undefined && !(h > f.altMin)) return;
    out.push([c[0] + dx, c[1] + dy, c[2] + dx, c[3] + dy]);
  });
  return out;
}

/** Agrupa caixas em linhas (porta do `rows_of`): ordena pelo centro vertical; uma caixa entra na última linha se o
    seu centro estiver a menos de `folga` da média dos centros dela. Cada linha sai ordenada da esquerda à direita. */
export function emLinhas(caixas: Caixa[], folga = 45): Caixa[][] {
  const cy = (b: Caixa) => (b[1] + b[3]) / 2;
  const linhas: { m: number; cs: Caixa[] }[] = [];
  for (const b of [...caixas].sort((a, b) => cy(a) - cy(b))) {
    const u = linhas[linhas.length - 1];
    if (u && Math.abs(cy(b) - u.m) < folga) {
      u.cs.push(b);
      u.m = (u.m * (u.cs.length - 1) + cy(b)) / u.cs.length;
    } else linhas.push({ m: cy(b), cs: [b] });
  }
  return linhas.map((l) => l.cs.sort((a, b) => a[0] - b[0]));
}

/* ---------- alfa ---------- */

/** Filtro de mínimo k×k (o grey_erosion do scipy), ignorando o que fica fora da imagem. */
export function minimo(a: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 1) return a.slice();
  const lo = janela(k);
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 255;
      for (let t = lo; t < lo + k; t++) {
        const xx = x + t;
        if (xx >= 0 && xx < w) v = Math.min(v, a[y * w + xx]);
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 255;
      for (let t = lo; t < lo + k; t++) {
        const yy = y + t;
        if (yy >= 0 && yy < h) v = Math.min(v, tmp[yy * w + x]);
      }
      out[y * w + x] = v;
    }
  return out;
}

/** Desfoque gaussiano separável (raio 3σ; a borda repete o último pixel). */
export function desfocar(a: Uint8Array, w: number, h: number, sigma: number): Uint8Array {
  if (sigma <= 0) return a.slice();
  const r = Math.ceil(sigma * 3);
  const pesos: number[] = [];
  for (let t = -r; t <= r; t++) pesos.push(Math.exp(-(t * t) / (2 * sigma * sigma)));
  const total = pesos.reduce((s, p) => s + p, 0);
  const passa = (src: Float32Array, horiz: boolean) => {
    const dst = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let t = -r; t <= r; t++) {
          const xx = horiz ? Math.min(w - 1, Math.max(0, x + t)) : x;
          const yy = horiz ? y : Math.min(h - 1, Math.max(0, y + t));
          s += src[yy * w + xx] * pesos[t + r];
        }
        dst[y * w + x] = s / total;
      }
    return dst;
  };
  const f = passa(passa(Float32Array.from(a), true), false);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(255, Math.max(0, f[i])));
  return out;
}

export interface OpcoesFundo {
  /** Também apaga a região escura que contém o centro (o `center_clear` do `cut`). */
  centro?: boolean;
  /** Lado do filtro de mínimo aplicado ao alfa (padrão 2, como o `grey_erosion(size=(2, 2))`); 1 = nenhum. */
  erosao?: number;
  /** σ do desfoque do alfa (0 = nenhum). */
  desfoque?: number;
}

/** Alfa de uma peça sobre fundo escuro: os pixels escuros (max(R, G, B) < `lim`) ligados à borda por escuros ficam
    transparentes, o resto opaco. Um buraco escuro cercado pela peça continua opaco. */
export function alfaFundo(img: Imagem, lim: number, o: OpcoesFundo = {}): Uint8Array {
  const { w, h } = img;
  const escuro = limiar(img, lim, false);
  const sementes = borda(w, h);
  if (o.centro) sementes.push(((h >> 1) * w + (w >> 1)) | 0);
  const fundo = inundar(w, h, sementes, (i) => escuro.d[i] === 1);
  let a: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = fundo[i] ? 0 : 255;
  a = minimo(a, w, h, o.erosao ?? 2);
  if (o.desfoque) a = desfocar(a, w, h, o.desfoque);
  return a;
}

/** Porta do `clean_alpha`: agrupa os pixels visíveis (alfa > 20, aproximados por uma dilatação em cruz) e apaga os
    grupos com menos de `frac` da área do maior. Altera `rgba` (4 canais) e devolve quantos grupos apagou. */
export function limparAlfa(rgba: Imagem, frac: number): number {
  const { w, h } = rgba;
  const vis: Mascara = { w, h, d: new Uint8Array(w * h) };
  for (let i = 0; i < w * h; i++) vis.d[i] = rgba.d[i * 4 + 3] > 20 ? 1 : 0;
  const R = rotular(dilatar(vis, { forma: "cruz", vezes: 1 }));
  if (R.n <= 1) return 0;
  const tam = new Array<number>(R.n).fill(0);
  for (let i = 0; i < w * h; i++) if (vis.d[i]) tam[R.rot[i] - 1]++;
  const maior = Math.max(...tam);
  let apagados = 0;
  const apaga = tam.map((t) => {
    const s = t < frac * maior;
    if (s) apagados++;
    return s;
  });
  for (let i = 0; i < w * h; i++) if (R.rot[i] && apaga[R.rot[i] - 1]) rgba.d[i * 4 + 3] = 0;
  return apagados;
}

/** Caixa dos pixels com alfa > `min` (null se nenhum). */
export function caixaAlfa(rgba: Imagem, min = 0): Caixa | null {
  const c: Caixa = [rgba.w, rgba.h, 0, 0];
  for (let y = 0; y < rgba.h; y++)
    for (let x = 0; x < rgba.w; x++)
      if (rgba.d[(y * rgba.w + x) * 4 + 3] > min) {
        c[0] = Math.min(c[0], x);
        c[1] = Math.min(c[1], y);
        c[2] = Math.max(c[2], x + 1);
        c[3] = Math.max(c[3], y + 1);
      }
  return c[2] > c[0] ? c : null;
}

/** Centraliza a imagem (4 canais) num quadrado transparente de lado max(w, h) + 2·`margem`. */
export function quadrar(rgba: Imagem, margem = 0): Imagem {
  const S = Math.max(rgba.w, rgba.h) + 2 * margem;
  const d = new Uint8Array(S * S * 4);
  const ox = (S - rgba.w) >> 1;
  const oy = (S - rgba.h) >> 1;
  for (let y = 0; y < rgba.h; y++)
    d.set(rgba.d.subarray(y * rgba.w * 4, (y + 1) * rgba.w * 4), ((oy + y) * S + ox) * 4);
  return { w: S, h: S, canais: 4, d };
}
