/* ==== v7.7 — uma peça de uma folha do Tripo em low poly: reduz e passa a textura para uma cor por triângulo ====
   Usado por tools/gerar-chao.ts (itens no chão). Mesma ideia da heroína (tools/lib/personagem.ts, passo 9): solda os
   vértices, dá a cada um a média da textura, reduz com o meshoptimizer levando a cor em conta, e a cor de cada
   triângulo é a média dos vértices originais mais próximos de 10 pontos espalhados nele. */
import { MeshoptSimplifier } from "meshoptimizer";
import { amostra, soldar, type MalhaTex } from "./glb.ts";

/** Triângulos soltos (3 vértices cada) e uma cor RGB 0..1 por triângulo. */
export interface PecaBaixa {
  p: number[];
  c: number[];
}

const BAR = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1 / 3, 1 / 3, 1 / 3],
  [0.6, 0.2, 0.2],
  [0.2, 0.6, 0.2],
  [0.2, 0.2, 0.6],
  [0.5, 0.5, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
];

/** O ponto do triângulo abc mais perto de p (Ericson, "Real-Time Collision Detection" 5.1.5): coordenadas
 *  baricêntricas e a distância ao quadrado. */
function pertoNoTriangulo(p: number[], a: number[], b: number[], c: number[]): [number, number, number, number] {
  const sub = (x: number[], y: number[]) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]],
    dot = (x: number[], y: number[]) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const ab = sub(b, a),
    ac = sub(c, a),
    ap = sub(p, a);
  let u = 1,
    v = 0,
    w = 0;
  const d1 = dot(ab, ap),
    d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) [u, v, w] = [1, 0, 0];
  else {
    const bp = sub(p, b),
      d3 = dot(ab, bp),
      d4 = dot(ac, bp);
    const cp = sub(p, c),
      d5 = dot(ab, cp),
      d6 = dot(ac, cp);
    const vc = d1 * d4 - d3 * d2,
      vb = d5 * d2 - d1 * d6,
      va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) [u, v, w] = [0, 1, 0];
    else if (d6 >= 0 && d5 <= d6) [u, v, w] = [0, 0, 1];
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const t = d1 / (d1 - d3);
      [u, v, w] = [1 - t, t, 0];
    } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const t = d2 / (d2 - d6);
      [u, v, w] = [1 - t, 0, t];
    } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const t = (d4 - d3) / (d4 - d3 + (d5 - d6));
      [u, v, w] = [0, 1 - t, t];
    } else {
      const den = 1 / (va + vb + vc);
      v = vb * den;
      w = vc * den;
      u = 1 - v - w;
    }
  }
  const q = [0, 1, 2].map((k) => u * a[k] + v * b[k] + w * c[k]);
  return [u, v, w, (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2];
}

/**
 * v8.1 — como reduzirPeca (solda e reduz: a forma lisa de sempre), e dá a cada canto o UV da textura do Tripo, para ela
 * valer na malha reduzida — o cabelo com as mechas e o rosto com os olhos (mantenedor, 2026-11-01: "o cabelo não está
 * pintado"). O UV respeita as cartas da textura (ilhas de UV: os triângulos do .glb ligados pelos vértices não
 * soldados): se os 3 cantos têm um vértice original na mesma carta, valem os UVs deles; se o triângulo atravessa uma
 * costura, a carta é a do triângulo original mais perto do centro dele, e o canto que não está nela é projetado no
 * triângulo dessa carta mais perto (o UV desliza até a borda da carta, sem pular para outra parte da imagem). Reduzir sem
 * soldar preservava as costuras, mas deixava triângulos finos ao longo delas: um vinco na barriga.
 * A cor por triângulo (a média da textura em 10 pontos dele) segue servindo às máscaras.
 */
export async function reduzirPecaUV(
  m: MalhaTex,
  alvo: number,
  travarBorda = false,
): Promise<PecaBaixa & { uv: number[] }> {
  await MeshoptSimplifier.ready;
  MeshoptSimplifier.useExperimentalFeatures = true;
  const nvo = m.P.length / 3,
    nto = m.I.length / 3,
    sol = soldar(m.P, 1e-6),
    nv = sol.n,
    P = new Float32Array(nv * 3),
    C = new Float32Array(nv * 3),
    N = new Uint32Array(nv),
    I = new Uint32Array(m.I.length);
  for (let k = 0; k < m.I.length; k++) {
    const v = m.I[k],
      j = sol.id[v];
    I[k] = j;
    for (let e = 0; e < 3; e++) P[j * 3 + e] = m.P[v * 3 + e];
    const c = amostra(m, m.T[v * 2], m.T[v * 2 + 1]);
    for (let e = 0; e < 3; e++) C[j * 3 + e] += c[e] / 255;
    N[j]++;
  }
  for (let j = 0; j < nv; j++) for (let e = 0; e < 3; e++) C[j * 3 + e] /= N[j] || 1;
  let mn = Infinity,
    mx = -Infinity;
  for (let i = 0; i < P.length; i++) {
    mn = Math.min(mn, P[i]);
    mx = Math.max(mx, P[i]);
  }
  const [lo] = MeshoptSimplifier.simplifyWithAttributes(
    I,
    P,
    3,
    C,
    3,
    [0.5, 0.5, 0.5],
    null,
    Math.min(alvo * 3, I.length),
    (mx - mn) * 0.05,
    travarBorda ? ["ErrorAbsolute", "LockBorder"] : ["ErrorAbsolute"],
  );

  // as cartas: vértices originais ligados pelos triângulos (união-busca)
  const pai = Int32Array.from({ length: nvo }, (_, i) => i);
  const raiz = (a: number) => {
    while (pai[a] !== a) a = pai[a] = pai[pai[a]];
    return a;
  };
  for (let t = 0; t < nto; t++)
    for (const k of [1, 2]) {
      const a = raiz(m.I[t * 3]),
        b = raiz(m.I[t * 3 + k]);
      if (a !== b) pai[a] = b;
    }
  const carta = Int32Array.from({ length: nvo }, (_, v) => raiz(v));
  // os vértices originais de cada soldado (CSR)
  const ini = new Uint32Array(nv + 1);
  for (let v = 0; v < nvo; v++) ini[sol.id[v] + 1]++;
  for (let j = 0; j < nv; j++) ini[j + 1] += ini[j];
  const dups = new Uint32Array(nvo),
    pos = ini.slice(0, nv);
  for (let v = 0; v < nvo; v++) dups[pos[sol.id[v]]++] = v;
  const naCarta = (j: number, c: number) => {
    for (let k = ini[j]; k < ini[j + 1]; k++) if (carta[dups[k]] === c) return dups[k];
    return -1;
  };
  // os triângulos originais numa grade (pelo centro), para achar o mais perto de um ponto
  const cel = (mx - mn) / 80 || 1e-3,
    grade = new Map<string, number[]>(),
    ch = (x: number, y: number, z: number) => `${Math.floor(x / cel)},${Math.floor(y / cel)},${Math.floor(z / cel)}`;
  const vo = (v: number) => [m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]];
  for (let t = 0; t < nto; t++) {
    const a = vo(m.I[t * 3]),
      b = vo(m.I[t * 3 + 1]),
      c = vo(m.I[t * 3 + 2]);
    const k = ch((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3);
    const l = grade.get(k) ?? [];
    l.push(t);
    grade.set(k, l);
  }
  /** o triângulo original mais perto de p (só da carta `c`, se dada): [triângulo, u, v, w] */
  const maisPerto = (p: number[], c = -1) => {
    const gx = Math.floor(p[0] / cel),
      gy = Math.floor(p[1] / cel),
      gz = Math.floor(p[2] / cel);
    let melhor: [number, number, number, number] = [-1, 0, 0, 0],
      md = Infinity;
    for (let r = 1; r <= 6 && melhor[0] < 0; r++)
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          for (let d = -r; d <= r; d++)
            for (const t of grade.get(`${gx + a},${gy + b},${gz + d}`) ?? []) {
              if (c >= 0 && carta[m.I[t * 3]] !== c) continue;
              const [u, v, w, d2] = pertoNoTriangulo(p, vo(m.I[t * 3]), vo(m.I[t * 3 + 1]), vo(m.I[t * 3 + 2]));
              if (d2 < md) {
                md = d2;
                melhor = [t, u, v, w];
              }
            }
    return melhor;
  };
  const uvDe = (t: number, u: number, v: number, w: number) => {
    const a = m.I[t * 3],
      b = m.I[t * 3 + 1],
      c = m.I[t * 3 + 2];
    return [
      u * m.T[a * 2] + v * m.T[b * 2] + w * m.T[c * 2],
      u * m.T[a * 2 + 1] + v * m.T[b * 2 + 1] + w * m.T[c * 2 + 1],
    ];
  };

  const out = { p: [] as number[], c: [] as number[], uv: [] as number[] };
  let projetados = 0;
  for (let t = 0; t < lo.length; t += 3) {
    const js = [lo[t], lo[t + 1], lo[t + 2]],
      pj = js.map((j) => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]);
    // uma carta comum aos 3 cantos?
    let vs: number[] | null = null;
    for (let k = ini[js[0]]; k < ini[js[0] + 1] && !vs; k++) {
      const c = carta[dups[k]],
        v1 = naCarta(js[1], c),
        v2 = naCarta(js[2], c);
      if (v1 >= 0 && v2 >= 0) vs = [dups[k], v1, v2];
    }
    let uvs: number[][];
    if (vs) uvs = vs.map((v) => [m.T[v * 2], m.T[v * 2 + 1]]);
    else {
      const ctr = [0, 1, 2].map((e) => (pj[0][e] + pj[1][e] + pj[2][e]) / 3),
        [t0] = maisPerto(ctr),
        c = t0 >= 0 ? carta[m.I[t0 * 3]] : carta[dups[ini[js[0]]]];
      uvs = js.map((j, k) => {
        const v = naCarta(j, c);
        if (v >= 0) return [m.T[v * 2], m.T[v * 2 + 1]];
        const [tt, u, vv, w] = maisPerto(pj[k], c);
        projetados++;
        if (tt < 0) {
          const v0 = dups[ini[j]];
          return [m.T[v0 * 2], m.T[v0 * 2 + 1]];
        }
        return uvDe(tt, u, vv, w);
      });
    }
    const cor = [0, 0, 0];
    for (const w of BAR) {
      const c = amostra(
        m,
        w[0] * uvs[0][0] + w[1] * uvs[1][0] + w[2] * uvs[2][0],
        w[0] * uvs[0][1] + w[1] * uvs[1][1] + w[2] * uvs[2][1],
      );
      for (let e = 0; e < 3; e++) cor[e] += c[e] / 255 / BAR.length;
    }
    for (let k = 0; k < 3; k++) {
      out.p.push(...pj[k]);
      out.uv.push(...uvs[k]);
    }
    out.c.push(...cor);
  }
  console.log(`  reduzirPecaUV: ${lo.length / 3} triângulos, ${projetados} cantos projetados na carta do vizinho`);
  return out;
}

/** `travarBorda`: a borda aberta não se mexe (uma peça cortada de outra — a cabeça do corpo — não abre fresta). */
export async function reduzirPeca(m: MalhaTex, alvo: number, travarBorda = false): Promise<PecaBaixa> {
  await MeshoptSimplifier.ready;
  MeshoptSimplifier.useExperimentalFeatures = true;
  const sol = soldar(m.P, 1e-6),
    nv = sol.n,
    P = new Float32Array(nv * 3),
    C = new Float32Array(nv * 3),
    N = new Uint32Array(nv),
    I = new Uint32Array(m.I.length);
  for (let k = 0; k < m.I.length; k++) {
    const v = m.I[k],
      j = sol.id[v];
    I[k] = j;
    for (let e = 0; e < 3; e++) P[j * 3 + e] = m.P[v * 3 + e];
    const c = amostra(m, m.T[v * 2], m.T[v * 2 + 1]);
    for (let e = 0; e < 3; e++) C[j * 3 + e] += c[e] / 255;
    N[j]++;
  }
  for (let j = 0; j < nv; j++) for (let e = 0; e < 3; e++) C[j * 3 + e] /= N[j] || 1;
  // erro em unidades da folha: um pouco do tamanho da peça
  let mn = Infinity,
    mx = -Infinity;
  for (let i = 0; i < P.length; i++) {
    mn = Math.min(mn, P[i]);
    mx = Math.max(mx, P[i]);
  }
  const [lo] = MeshoptSimplifier.simplifyWithAttributes(
    I,
    P,
    3,
    C,
    3,
    [0.5, 0.5, 0.5],
    null,
    Math.min(alvo * 3, I.length), // um modelo que já vem com menos (o .fbx low poly) fica como está
    (mx - mn) * 0.05,
    travarBorda ? ["ErrorAbsolute", "LockBorder"] : ["ErrorAbsolute"],
  );
  // vizinho mais próximo numa grade
  const cel = (mx - mn) / 60 || 1e-3,
    grade = new Map<string, number[]>();
  const chave = (x: number, y: number, z: number) =>
    `${Math.floor(x / cel)},${Math.floor(y / cel)},${Math.floor(z / cel)}`;
  for (let j = 0; j < nv; j++) {
    const k = chave(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
    let a = grade.get(k);
    if (!a) grade.set(k, (a = []));
    a.push(j);
  }
  const perto = (x: number, y: number, z: number) => {
    let best = 0,
      bd = Infinity;
    const gx = Math.floor(x / cel),
      gy = Math.floor(y / cel),
      gz = Math.floor(z / cel);
    for (let r = 1; r <= 4 && bd === Infinity; r++)
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          for (let c = -r; c <= r; c++)
            for (const j of grade.get(`${gx + a},${gy + b},${gz + c}`) ?? []) {
              const d = (P[j * 3] - x) ** 2 + (P[j * 3 + 1] - y) ** 2 + (P[j * 3 + 2] - z) ** 2;
              if (d < bd) {
                bd = d;
                best = j;
              }
            }
    return best;
  };
  const out: PecaBaixa = { p: [], c: [] };
  for (let t = 0; t < lo.length; t += 3) {
    const v = [lo[t], lo[t + 1], lo[t + 2]],
      cor = [0, 0, 0];
    for (const w of BAR) {
      const q = [0, 1, 2].map((e) => w[0] * P[v[0] * 3 + e] + w[1] * P[v[1] * 3 + e] + w[2] * P[v[2] * 3 + e]);
      const j = perto(q[0], q[1], q[2]);
      for (let e = 0; e < 3; e++) cor[e] += C[j * 3 + e] / BAR.length;
    }
    for (const x of v) out.p.push(P[x * 3], P[x * 3 + 1], P[x * 3 + 2]);
    out.c.push(...cor);
  }
  return out;
}
