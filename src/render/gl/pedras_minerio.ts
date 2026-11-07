/* ==== v8.1 — pedras de minério feitas em código (tabelas em data/pedras.ts) ====
   Rocha = icosfera amassada, uma cor por triângulo pelo padrão do tipo; quebrada = a base da rocha cortada reta, com
   cristais, pedaços de metal, lascas de vidro ou o padrão no corte, e cascalho em volta. Cada tipo tem algumas formas
   (PEDRA_MINERIO.variantes) montadas uma vez na escala 1 e copiadas para o lugar. Sem arquivo de modelo: nada a
   carregar, e funciona nos testes em Node. */
import { PEDRA_MINERIO, TIPOS_PEDRA, type TipoPedra } from "../../data/pedras.ts";
import type { MalhaCrua } from "../../core/tipos.ts";

type V3 = [number, number, number];
/** malha na escala 1 (a rocha inteira tem ~1,5 de largura): triângulos soltos, uma cor (0..255+) cada */
interface Crua {
  P: number[];
  C: number[][];
  /** centro da peça sendo montada: cada face é virada para fora dele */
  o: V3;
}

function rngDe(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const meio = (a: V3, b: V3, c: V3): V3 => [
  (a[0] + b[0] + c[0]) / 3,
  (a[1] + b[1] + c[1]) / 3,
  (a[2] + b[2] + c[2]) / 3,
];
function tri(m: Crua, a: V3, b: V3, c: V3, cor: number[]) {
  const n = cruz([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]),
    q = meio(a, b, c);
  if (n[0] * (q[0] - m.o[0]) + n[1] * (q[1] - m.o[1]) + n[2] * (q[2] - m.o[2]) < 0) [b, c] = [c, b];
  m.P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  m.C.push(cor);
}

function icosfera(niveis: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V: V3[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  let F = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let n = 0; n < niveis; n++) {
    const meios = new Map<string, number>();
    const m = (a: number, b: number) => {
      const k = a < b ? a + "," + b : b + "," + a;
      let i = meios.get(k);
      if (i === undefined) {
        i = V.length;
        V.push([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]);
        meios.set(k, i);
      }
      return i;
    };
    const F2: number[][] = [];
    for (const [a, b, c] of F) {
      const ab = m(a, b),
        bc = m(b, c),
        ca = m(c, a);
      F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    F = F2;
  }
  V = V.map(norm);
  return { V, F };
}
const ICO = { 1: null as ReturnType<typeof icosfera> | null, 2: null as ReturnType<typeof icosfera> | null };
const ico = (n: 1 | 2) => (ICO[n] ||= icosfera(n));

/** A cor de cada face pelo padrão do tipo (c = centro da face no espaço da rocha, ~-1..1). */
function fabricaCor(tp: TipoPedra, r: () => number) {
  const planos = [0, 1, 2, 3].map(() => ({ n: norm([r() - 0.5, r() - 0.5, r() - 0.5]), d: (r() - 0.5) * 0.8 }));
  const centroAnel: V3 = [(r() - 0.5) * 0.6, 0.3 + r() * 0.5, (r() - 0.5) * 0.6];
  const inclina = (r() - 0.5) * 0.8;
  return (c: V3, rr: () => number): number[] => {
    const k = 0.86 + rr() * 0.26;
    let cor: number[] = tp.base;
    if (tp.padrao === "veios") {
      const perto = planos.some(
        (p) => Math.abs(c[0] * p.n[0] + c[1] * p.n[1] + c[2] * p.n[2] - p.d) < PEDRA_MINERIO.veio,
      );
      if (perto || rr() < (tp.dens ?? 0.03)) cor = tp.cores[0];
    } else if (tp.padrao === "pintas") {
      if (rr() < (tp.dens ?? 0.1)) cor = tp.cores[0];
    } else if (tp.padrao === "faixas") {
      const t = (c[1] + inclina * c[0] + 0.12 * Math.sin(4 * c[2])) * (tp.freq ?? 5);
      cor = tp.cores[((Math.floor(t) % tp.cores.length) + tp.cores.length) % tp.cores.length];
    } else if (tp.padrao === "aneis") {
      const d = Math.hypot(c[0] - centroAnel[0], c[1] - centroAnel[1], c[2] - centroAnel[2]) * (tp.freq ?? 4);
      cor = tp.cores[Math.floor(d) % tp.cores.length];
    } else if (tp.padrao === "manchas") {
      cor = tp.cores[Math.floor(rr() * tp.cores.length)];
    }
    return cor.some((q) => q > 255) ? cor : cor.map((q) => q * k);
  };
}

interface Pos {
  x: number;
  z: number;
  esc: number;
  alt?: number;
  corte?: number;
  niveis?: 1 | 2;
}
/** Rocha amassada pousada em y = 0. Com `corte` (0..1 da altura) o topo vira uma face plana que mostra o interior. */
function rocha(
  m: Crua,
  tp: TipoPedra,
  r: () => number,
  p: Pos,
  corDaFace: (c: V3, rr: () => number) => number[],
  corCorte?: (c: V3) => number[],
) {
  const I = ico(p.niveis ?? 2),
    sx = 0.9 + r() * 0.15,
    sy = 1.3 * (p.alt ?? 1),
    sz = 0.8 + r() * 0.15;
  const bossas = [0, 1, 2].map(() => ({ d: I.V[Math.floor(r() * I.V.length)], a: 0.08 + r() * 0.1 }));
  const L: V3[] = I.V.map((v) => {
    let k = 1 + (r() - 0.5) * 0.16;
    for (const b of bossas) k += b.a * Math.max(0, v[0] * b.d[0] + v[1] * b.d[1] + v[2] * b.d[2]) ** 2;
    let y = v[1];
    if (y < -0.55) y = -0.55 + (y + 0.55) * 0.25; // base achatada
    return [v[0] * k * sx, y * k * sy, v[2] * k * sz];
  });
  let ymin = 1e9,
    ymax = -1e9;
  for (const v of L) {
    ymin = Math.min(ymin, v[1]);
    ymax = Math.max(ymax, v[1]);
  }
  const yCorte = p.corte !== undefined ? ymin + (ymax - ymin) * p.corte : 1e9;
  m.o = [p.x, (Math.min(ymax, yCorte) - ymin) * p.esc * 0.45, p.z];
  const g = r() * Math.PI * 2,
    cg = Math.cos(g),
    sg = Math.sin(g);
  const lugar = (v: V3): V3 => {
    const y = Math.min(v[1], yCorte);
    return [p.x + (v[0] * cg - v[2] * sg) * p.esc, (y - ymin) * p.esc, p.z + (v[0] * sg + v[2] * cg) * p.esc];
  };
  for (const [a, b, c] of I.F) {
    const A = L[a],
      B = L[b],
      C = L[c];
    if (Math.min(A[1], B[1], C[1]) >= yCorte) continue; // inteira acima do corte: a tampa cobre
    tri(m, lugar(A), lugar(B), lugar(C), corDaFace(meio(A, B, C), r));
  }
  if (p.corte === undefined) return;
  // tampa: o contorno no plano do corte (raio máximo por setor), em dois anéis para o padrão do corte aparecer
  const N = 18,
    raio = new Array<number>(N).fill(0);
  for (const v of L) {
    if (v[1] < yCorte - (ymax - ymin) * 0.22) continue;
    const s = Math.floor(((Math.atan2(v[2], v[0]) + Math.PI) / (2 * Math.PI)) * N) % N;
    raio[s] = Math.max(raio[s], Math.hypot(v[0], v[2]) * 0.97);
  }
  for (let s = 0; s < N; s++) if (!raio[s]) raio[s] = raio[(s + N - 1) % N] || 0.5;
  const pt = (s: number, f: number): V3 => {
    const a = ((s + 0.5) / N) * 2 * Math.PI - Math.PI;
    return [Math.cos(a) * raio[s % N] * f, yCorte, Math.sin(a) * raio[s % N] * f];
  };
  const ctr: V3 = [0, yCorte, 0],
    cc = corCorte ?? ((c: V3) => corDaFace(c, r));
  for (let s = 0; s < N; s++) {
    const a1 = pt(s, 0.5),
      b1 = pt(s + 1, 0.5),
      a2 = pt(s, 1),
      b2 = pt(s + 1, 1);
    tri(m, lugar(ctr), lugar(b1), lugar(a1), cc(meio(ctr, b1, a1)));
    tri(m, lugar(a1), lugar(b1), lugar(b2), cc(meio(a1, b1, b2)));
    tri(m, lugar(a1), lugar(b2), lugar(a2), cc(meio(a1, b2, a2)));
  }
}

/** Prisma hexagonal com ponta, da base `b` na direção `d`; faces alternam claro/escuro (facetas). */
function cristal(m: Crua, b: V3, d: V3, comp: number, raio: number, cor: number[], contraste = 0.2) {
  const D = norm(d),
    u = norm(cruz(D, Math.abs(D[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    w = cruz(D, u);
  const ponto = (h: number, a: number): V3 => [
    b[0] + D[0] * h + (u[0] * Math.cos(a) + w[0] * Math.sin(a)) * raio,
    b[1] + D[1] * h + (u[1] * Math.cos(a) + w[1] * Math.sin(a)) * raio,
    b[2] + D[2] * h + (u[2] * Math.cos(a) + w[2] * Math.sin(a)) * raio,
  ];
  const corpo = comp * 0.72,
    ponta: V3 = [b[0] + D[0] * comp, b[1] + D[1] * comp, b[2] + D[2] * comp];
  m.o = b;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2,
      a1 = ((i + 1) / 6) * Math.PI * 2,
      f = i % 2 ? 1 : 1 - contraste,
      c = cor.map((q) => q * f);
    tri(m, ponto(0, a0), ponto(0, a1), ponto(corpo, a1), c);
    tri(m, ponto(0, a0), ponto(corpo, a1), ponto(corpo, a0), c);
    tri(
      m,
      ponto(corpo, a0),
      ponto(corpo, a1),
      ponta,
      c.map((q) => q * (1 + contraste)),
    );
  }
}

/** Octaedro amassado (pedaço de metal, pedrisco). */
function caco(m: Crua, r: () => number, c: V3, t: number, cor: number[], varia = 0.15, achata = 0.7) {
  const eixos: V3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const v = eixos.map((e): V3 => {
    const k = t * (0.7 + r() * 0.6);
    return [c[0] + e[0] * k, c[1] + e[1] * k * achata, c[2] + e[2] * k];
  });
  const F = [
    [0, 2, 4],
    [4, 2, 1],
    [1, 2, 5],
    [5, 2, 0],
    [4, 3, 0],
    [1, 3, 4],
    [5, 3, 1],
    [0, 3, 5],
  ];
  m.o = c;
  for (const [a, b, d] of F)
    tri(
      m,
      v[a],
      v[b],
      v[d],
      cor.map((q) => q * (1 - varia + r() * varia * 2)),
    );
}

function inteira(tp: TipoPedra, semente: number): Crua {
  const m: Crua = { P: [], C: [], o: [0, 0, 0] },
    r = rngDe(semente);
  rocha(m, tp, r, { x: 0, z: 0, esc: 0.75 }, fabricaCor(tp, r));
  return m;
}

function quebrada(tp: TipoPedra, semente: number): Crua {
  const m: Crua = { P: [], C: [], o: [0, 0, 0] },
    r = rngDe(semente),
    corF = fabricaCor(tp, r),
    mostraPadrao = tp.quebra === "geodo" || tp.quebra === "lascas",
    corteEscuro = () => (tp.dentro ?? tp.base).map((q) => Math.min(q, 255) * 0.45 * (0.9 + r() * 0.2)),
    corteMetal = (c: V3) => (r() < 0.35 ? tp.dentro! : corF(c, r)); // o corte do metal mostra o veio
  rocha(
    m,
    tp,
    r,
    { x: 0, z: 0, esc: 0.72, corte: mostraPadrao ? 0.62 : 0.45 },
    corF,
    mostraPadrao ? undefined : tp.quebra === "pepita" ? corteMetal : corteEscuro,
  );
  let topo = 0;
  for (let i = 1; i < m.P.length; i += 3) topo = Math.max(topo, m.P[i]);
  for (let i = 0; i < 3; i++) {
    const a = 0.6 + i * 2.1 + r() * 0.5;
    rocha(m, tp, r, { x: Math.cos(a) * 0.78, z: Math.sin(a) * 0.5, esc: 0.22 + r() * 0.12, alt: 0.7, niveis: 1 }, corF);
  }
  // cascalho
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2,
      d = 0.7 + r() * 0.45,
      t = 0.05 + r() * 0.09,
      cor = r() < 0.25 && tp.cores.length ? tp.cores[0] : tp.base;
    caco(
      m,
      r,
      [Math.cos(a) * d, t * 0.5, Math.sin(a) * d * 0.7],
      t,
      cor.map((q) => Math.min(q, 300)),
    );
  }
  const cor = tp.dentro ?? tp.base;
  if (tp.quebra === "cristal") {
    cristal(m, [0, topo * 0.6, 0], [0.05, 1, 0.1], 1.25, 0.2, cor);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + r() * 0.5,
        inc = 0.45 + r() * 0.35;
      cristal(
        m,
        [Math.cos(a) * 0.18, topo * 0.6, Math.sin(a) * 0.14],
        [Math.cos(a) * inc, 1, Math.sin(a) * inc],
        0.55 + r() * 0.4,
        0.09 + r() * 0.06,
        cor,
      );
    }
  } else if (tp.quebra === "vidro") {
    // lâminas de vidro com uma face bem clara (o reflexo), para não sumirem no escuro
    cristal(m, [0, topo * 0.5, 0], [0.25, 1, 0.1], 1.2, 0.32, cor, 0.55);
    cristal(m, [0.22, topo * 0.5, 0.1], [0.9, 1, 0.3], 0.7, 0.22, cor, 0.55);
    cristal(m, [-0.2, topo * 0.5, -0.05], [-0.8, 1, -0.2], 0.55, 0.18, cor, 0.55);
  } else if (tp.quebra === "pepita") {
    // pedaços de metal grandes saindo do corte e alguns caídos
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r() * 0.6,
        d = 0.08 + r() * 0.28;
      caco(m, r, [Math.cos(a) * d, topo + 0.04, Math.sin(a) * d * 0.7], 0.17 + r() * 0.1, cor, 0.3, 1.1);
    }
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2,
        d = 0.65 + r() * 0.45;
      caco(m, r, [Math.cos(a) * d, 0.07, Math.sin(a) * d * 0.7], 0.08 + r() * 0.05, cor, 0.3, 1);
    }
  }
  return m;
}

const CACHE: Record<string, Crua> = {};
function forma(tipo: string, quebrou: boolean, variante: number) {
  const k = tipo + (quebrou ? ":q:" : ":i:") + variante;
  if (!CACHE[k]) {
    const tp = TIPOS_PEDRA[tipo] || TIPOS_PEDRA.comum,
      s = 1009 + variante * 7919 + Object.keys(TIPOS_PEDRA).indexOf(tipo) * 131;
    CACHE[k] = quebrou ? quebrada(tp, s) : inteira(tp, s);
  }
  return CACHE[k];
}

/** Põe em b a pedra `tipo` (data/pedras.ts) inteira ou quebrada, com a base em (x, 0, z), a maior medida
 *  PEDRA_MINERIO.tam × sc; `semente` escolhe a forma e o giro. */
export function mbPedraMinerio(
  b: MalhaCrua,
  tipo: string,
  x: number,
  z: number,
  sc: number,
  semente: number,
  quebrou = false,
) {
  const h = Math.abs(Math.sin(semente * 12.9898) * 43758.5453) % 1,
    m = forma(tipo, quebrou, Math.floor(h * PEDRA_MINERIO.variantes)),
    k = (PEDRA_MINERIO.tam * sc) / 1.5,
    a = h * 97 * Math.PI,
    ca = Math.cos(a),
    sa = Math.sin(a),
    luz = PEDRA_MINERIO.luz / 255;
  for (let t = 0; t < m.C.length; t++) {
    const v = [0, 1, 2].map((j) => {
      const px = m.P[t * 9 + j * 3] * k,
        py = m.P[t * 9 + j * 3 + 1] * k,
        pz = m.P[t * 9 + j * 3 + 2] * k;
      return [x + px * ca - pz * sa, py, z + px * sa + pz * ca];
    });
    const u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]],
      w = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((q) => q / l);
    const cor = m.C[t];
    for (const q of v) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(n[0], n[1], n[2]);
      b.c.push(cor[0] * luz, cor[1] * luz, cor[2] * luz);
    }
  }
}

/** O tipo de pedra sorteado pelo número h em [0, 1) (pesos de TIPOS_PEDRA). */
export function tipoPedraPorPeso(h: number) {
  const ks = Object.keys(TIPOS_PEDRA).filter((k) => TIPOS_PEDRA[k].peso > 0),
    total = ks.reduce((s, k) => s + TIPOS_PEDRA[k].peso, 0);
  let r = h * total;
  for (const k of ks) {
    r -= TIPOS_PEDRA[k].peso;
    if (r < 0) return k;
  }
  return ks[ks.length - 1];
}
