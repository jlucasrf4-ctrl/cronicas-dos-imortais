/* v8.1 — a máscara de pele e cabelo de uma malha com cor por triângulo (tools/gerar-aparencias.ts → o tingimento do
   jogo, src/render/gl/aparencias.ts tingir). Só a cor não separa o couro marrom da pele morena, nem o delineado do olho
   do cabelo escuro: a região cresce a partir de sementes (o meio do rosto, as mãos; o topo da cabeça) pelos vizinhos de
   aresta, passando só por uma cor perto do vizinho de onde veio (`passo`) e da referência (`ref`). Borda de cor nítida
   (pele → colete, pele → delineado) para o crescimento; a sombra, que muda devagar, não.
   Distâncias em CIELAB (ΔE76), que segue o olho melhor que o rgb. ==== */

/** valores da máscara, um por triângulo; `rosto` = os detalhes do rosto no tom da pele (pálpebras, sombra, boca), que o
 *  jogo desloca junto com a pele em vez de pintar chapado */
export const PARTE = { outro: 0, pele: 1, cabelo: 2, rosto: 3 } as const;

export interface Segmentavel {
  /** índices (3 por triângulo) */
  I: ArrayLike<number>;
  /** cor por triângulo, rgb 0..255 (3 por triângulo) */
  C: ArrayLike<number>;
}

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** rgb 0..255 → CIELAB (D65) */
export function lab(r: number, g: number, b: number) {
  const R = lin(r),
    G = lin(g),
    B = lin(b);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047),
    y = f(0.2126 * R + 0.7152 * G + 0.0722 * B),
    z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export const dE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** vizinhos de aresta de cada triângulo (CSR) */
export function vizinhos(m: Segmentavel) {
  const nt = m.I.length / 3,
    arestas = new Map<number, number[]>(),
    chave = (a: number, b: number) => (a < b ? a * 1048576 + b : b * 1048576 + a);
  for (let t = 0; t < nt; t++)
    for (let k = 0; k < 3; k++) {
      const c = chave(m.I[t * 3 + k], m.I[t * 3 + ((k + 1) % 3)]);
      const l = arestas.get(c);
      if (l) l.push(t);
      else arestas.set(c, [t]);
    }
  const viz: number[][] = Array.from({ length: nt }, () => []);
  for (const l of arestas.values())
    for (const a of l) for (const b of l) if (a !== b && !viz[a].includes(b)) viz[a].push(b);
  return viz;
}

export interface Crescimento {
  /** triângulos de onde a região começa (os que passam em `tolSemente`) */
  sementes: number[];
  /** cores de referência (rgb) da parte: a mais perto vale */
  refs: number[][];
  /** ΔE máximo da semente à referência */
  tolSemente: number;
  /** ΔE máximo de qualquer triângulo da região à referência */
  tolRef: number;
  /** ΔE máximo entre vizinhos (a borda nítida para) */
  passo: number;
  /** só cresce onde isto deixa (a altura, a junta…) */
  pode?: (t: number) => boolean;
}

/** Várias partes crescendo ao mesmo tempo, disputando cada triângulo (divisor de águas): sai primeiro da fila o passo
 *  de menor ΔE, então a fronteira entre duas partes fica na maior mudança de cor entre elas. O cabelo loiro tem quase
 *  a cor da pele: crescendo uma depois da outra, a primeira levava a cabeça toda. */
export function crescerJuntos(m: Segmentavel, viz: number[][], mask: Uint8Array, partes: [number, Crescimento][]) {
  const L = labs(m),
    regras = partes.map(([parte, c]) => ({ parte, c, refs: c.refs.map((r) => lab(r[0], r[1], r[2])) })),
    dRef = (t: number, q: (typeof regras)[number]) => Math.min(...q.refs.map((r) => dE(L[t], r)));
  // fila de prioridade (heap mínimo) de [custo, triângulo, regra]
  const h: [number, number, number][] = [];
  const pôr = (x: [number, number, number]) => {
    h.push(x);
    for (let i = h.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  };
  const tirar = () => {
    const topo = h[0],
      fim = h.pop()!;
    if (h.length) {
      h[0] = fim;
      for (let i = 0; ;) {
        const a = 2 * i + 1,
          b = a + 1;
        let m = i;
        if (a < h.length && h[a][0] < h[m][0]) m = a;
        if (b < h.length && h[b][0] < h[m][0]) m = b;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return topo;
  };
  regras.forEach((q, r) => {
    for (const t of q.c.sementes)
      if (mask[t] === PARTE.outro && dRef(t, q) <= q.c.tolSemente && (!q.c.pode || q.c.pode(t))) pôr([0, t, r]);
  });
  while (h.length) {
    const [, t, r] = tirar();
    if (mask[t] !== PARTE.outro) continue;
    const q = regras[r];
    mask[t] = q.parte;
    for (const v of viz[t]) {
      if (mask[v] !== PARTE.outro || (q.c.pode && !q.c.pode(v))) continue;
      const d = dE(L[v], L[t]);
      if (d > q.c.passo || dRef(v, q) > q.c.tolRef) continue;
      pôr([d, v, r]);
    }
  }
}

/** Ilhas pequenas de "outro" cercadas só por `parte` (um reflexo do cabelo, uma sombra da pele) passam a `parte` se
 *  a cor média delas ficar a até `tol` da referência. Os olhos não entram: ficam fora do `pode`. v8.1 — `opc.passo`:
 *  a ilha só junta vizinhos de tom parecido (a mancha vermelha não se liga à tanga escura do lado); `opc.cerco`: basta
 *  essa fração da borda ser `parte` (padrão 1, toda). */
export function fecharIlhas(
  m: Segmentavel,
  viz: number[][],
  mask: Uint8Array,
  parte: number,
  refs: number[][],
  tol: number,
  maxTris: number,
  pode?: (t: number) => boolean,
  opc: { passo?: number; cerco?: number } = {},
) {
  const L = labs(m),
    R = refs.map((r) => lab(r[0], r[1], r[2])),
    visto = new Uint8Array(mask.length),
    passo = opc.passo ?? Infinity,
    cerco = opc.cerco ?? 1;
  let n = 0;
  for (let t0 = 0; t0 < mask.length; t0++) {
    if (mask[t0] !== PARTE.outro || visto[t0]) continue;
    const ilha = [t0],
      fila = [t0];
    visto[t0] = 1;
    let naParte = 0,
      fora = 0;
    while (fila.length) {
      const t = fila.pop()!;
      for (const v of viz[t]) {
        if (mask[v] === parte) naParte++;
        else if (mask[v] !== PARTE.outro || dE(L[t], L[v]) > passo) fora++;
        else if (!visto[v]) {
          visto[v] = 1;
          ilha.push(v);
          fila.push(v);
        }
      }
    }
    const cercada = naParte > 0 && naParte >= cerco * (naParte + fora);
    if (!cercada || ilha.length > maxTris || (pode && !ilha.every(pode))) continue;
    const media = [0, 1, 2].map((e) => ilha.reduce((s, t) => s + L[t][e], 0) / ilha.length);
    if (Math.min(...R.map((r) => dE(media, r))) > tol) continue;
    for (const t of ilha) mask[t] = parte;
    n += ilha.length;
  }
  return n;
}

/**
 * v8.1 — alisa a pele (mantenedor: "muito polígono pontudo no rosto, dá um ar de rosto deformado"): a malha reduzida
 * deixou picos e vales nas bochechas e na testa, e cada triângulo da pele tem um tom (a luz assada da textura) que
 * realça a faceta. Os vértices cercados só de pele andam (Taubin: λ encolhe, μ devolve — alisa sem afinar o rosto);
 * a borda com olho, boca e cabelo fica onde está. Depois a cor de cada triângulo de pele vai para a média dos vizinhos
 * de pele de tom parecido (ΔE ≤ `tolCor`). Muda `P` (x, y, z por vértice) e `C` (rgb 0..255 por triângulo).
 */
export function alisarPele(
  P: Float32Array,
  I: ArrayLike<number>,
  C: Uint8Array,
  mask: ArrayLike<number>,
  opc: { voltas: number; lambda: number; mu: number; voltasCor: number; pesoCor: number; tolCor: number },
) {
  const nv = P.length / 3,
    nt = I.length / 3,
    pele = (t: number) => mask[t] === PARTE.pele;
  // vértice móvel: todos os triângulos dele são pele; vizinhos de cada vértice
  const movel = new Uint8Array(nv).fill(1),
    tocado = new Uint8Array(nv),
    viz: Set<number>[] = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < nt; t++)
    for (let k = 0; k < 3; k++) {
      const a = I[t * 3 + k];
      tocado[a] = 1;
      if (!pele(t)) movel[a] = 0;
      viz[a].add(I[t * 3 + ((k + 1) % 3)]);
      viz[a].add(I[t * 3 + ((k + 2) % 3)]);
    }
  const passo = (f: number) => {
    const novo = Float32Array.from(P);
    for (let v = 0; v < nv; v++) {
      if (!movel[v] || !tocado[v] || !viz[v].size) continue;
      const m = [0, 0, 0];
      for (const w of viz[v]) for (let e = 0; e < 3; e++) m[e] += P[w * 3 + e] / viz[v].size;
      for (let e = 0; e < 3; e++) novo[v * 3 + e] = P[v * 3 + e] + f * (m[e] - P[v * 3 + e]);
    }
    P.set(novo);
  };
  for (let i = 0; i < opc.voltas; i++) {
    passo(opc.lambda);
    passo(opc.mu);
  }
  // a cor: vizinhos de aresta de pele, de tom parecido
  const vt = vizinhos({ I, C });
  for (let i = 0; i < opc.voltasCor; i++) {
    const L = Array.from({ length: nt }, (_, t) => lab(C[t * 3], C[t * 3 + 1], C[t * 3 + 2])),
      novo = Uint8Array.from(C);
    for (let t = 0; t < nt; t++) {
      if (!pele(t)) continue;
      const m = [0, 0, 0];
      let n = 0;
      for (const v of vt[t])
        if (pele(v) && dE(L[t], L[v]) <= opc.tolCor) {
          for (let e = 0; e < 3; e++) m[e] += C[v * 3 + e];
          n++;
        }
      if (!n) continue;
      for (let e = 0; e < 3; e++)
        novo[t * 3 + e] = Math.round(C[t * 3 + e] * (1 - opc.pesoCor) + (m[e] / n) * opc.pesoCor);
    }
    C.set(novo);
  }
}

const cacheLab = new WeakMap<Segmentavel, number[][]>();
function labs(m: Segmentavel) {
  let L = cacheLab.get(m);
  if (!L) {
    L = [];
    for (let t = 0; t < m.C.length / 3; t++) L.push(lab(m.C[t * 3], m.C[t * 3 + 1], m.C[t * 3 + 2]));
    cacheLab.set(m, L);
  }
  return L;
}
