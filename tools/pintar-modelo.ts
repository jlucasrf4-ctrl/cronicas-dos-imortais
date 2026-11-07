/* v8.0 — pinta um .glb do Tripo que veio SEM textura (só a forma, em peças: o download "em partes") projetando a
   imagem de referência de frente, reduz cada peça e exporta em pose T para o rigging no Mixamo (o mesmo formato do
   --tpose de tools/gerar-personagem.ts: .glb + .obj/.mtl/.png, cor por face, frente +Z, `altura` em metros).
   Primeiro caso: a líder dos bandidos (tools/modelos/lider_bandidos.json, mantenedor 2026-10-25).

   Uso:  node tools/pintar-modelo.ts [plano.json]      (padrão tools/modelos/lider_bandidos.json)
   1. Reduz cada peça (malha do .glb) para a sua parte de `triangulos`, pela área da superfície × `prioridade` da
      peça (índice da malha no .glb; o rosto leva mais triângulos para os olhos e a boca).
   2. Encaixa a silhueta de frente do modelo na da referência (fundo branco): parte das caixas e ajusta escala e
      deslocamento para a maior sobreposição; `ajusteRef` { sx, sy, dx, dy } soma por cima, se precisar.
   3. Triângulo visível de frente (e virado para a câmera) = média da referência em 10 pontos dele. Os outros (costas,
      lados, o que fica escondido) = mediana dos 8 triângulos visíveis mais próximos em x/y da MESMA peça: as costas da
      bota pegam a cor da bota, as do cabelo a do cabelo. Peça sem nada visível pega o visível mais próximo em 3D.
   Prévias (frente, costas, lado, e a referência ao lado da frente) em <pasta>/.
   Folha com vários modelos (as 12 cabeças, tools/modelos/cabecas.json): `separar` [{ nome, malhas }] encaixa cada grupo
   de peças na sua mancha da referência (depois do encaixe da folha toda) e exporta cada um sozinho, centrado, base em
   y=0, `escala` metros por unidade do .glb; `fundo: "cinza"` para referência em fundo cinza liso em vez de branco.
   `tirar` [peças]: pintadas com as outras (escondem o que fica atrás delas) e tiradas antes de exportar (a faixa da
   saia da líder). Ao lado do .glb vai <nome>_pecas.json: a peça de cada triângulo, na ordem do .glb. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { MeshoptSimplifier } from "meshoptimizer";
import { soldar, desenhar } from "./lib/glb.ts";
import { exportarMalha } from "./lib/exportar.ts";

interface Plano {
  nome: string;
  glb: string;
  referencia: string;
  altura: number;
  triangulos: number;
  prioridade?: Record<string, number>;
  ajusteRef?: { sx?: number; sy?: number; dx?: number; dy?: number };
  pasta: string;
  fundo?: "branco" | "cinza";
  separar?: {
    nome: string;
    malhas: number[];
    refinar?: number;
    /** v8.1 — o recorte da pintura como textura (lado em px) e o mapa dos triângulos de frente nele */
    textura?: number;
    olhos?: number[][];
    raioOlho?: number;
    queixo?: number;
    nuca?: number;
  }[];
  /** v8.1 — `corpo`: corpo de malha única (o Tripo sem partes); ver colorir() */
  preencher?: "xy" | "superficie" | "corpo";
  /** v8.1 — com `preencher: "corpo"`: altura do pescoço (fração da altura, dos pés; padrão 0,85) */
  pescoco?: number;
  /** v8.1 — com `preencher: "corpo"`: o queixo, fração da altura da cabeça (do pescoço ao topo) — abaixo dele o
   *  escondido pode ser pele (a nuca), acima é cabelo */
  queixo?: number;
  /** v8.1 — fator das pernas (abaixo de `virilha`, fração da altura; padrão 0,47), ver exportar() */
  pernas?: number;
  virilha?: number;
  /** v8.1 — ajustes de forma no export, ver exportar() */
  forma?: {
    afinar?: { de: number; ate: number; fator: number }[];
    busto?: { dy: number; raio: number; de: number; ate: number };
  };
  denso?: number;
  pesoCor?: number;
  escala?: number;
  tirar?: number[];
}

const plano = JSON.parse(readFileSync(process.argv[2] ?? "tools/modelos/lider_bandidos.json", "utf8")) as Plano;

/* ---- 1. as peças do .glb, reduzidas ---- */
const arq = readFileSync(plano.glb);
const jl = arq.readUInt32LE(12),
  gltf = JSON.parse(arq.subarray(20, 20 + jl).toString("utf8")),
  bin = arq.subarray(20 + jl + 8);
const acessor = <T>(i: number, Tipo: new (b: ArrayBufferLike, o: number, n: number) => T, k: number) => {
  const a = gltf.accessors[i],
    bv = gltf.bufferViews[a.bufferView];
  const o = bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  // cópia alinhada (o pedaço binário do .glb nem sempre começa em múltiplo de 4 dentro do Buffer)
  const copia = bin.buffer.slice(o, o + a.count * k * (a.componentType === 5123 ? 2 : 4));
  return new Tipo(copia, 0, a.count * k);
};
if (
  gltf.nodes.some(
    (n: { matrix?: unknown; rotation?: unknown; scale?: unknown; translation?: unknown }) =>
      n.matrix || n.rotation || n.scale || n.translation,
  )
)
  throw new Error("o .glb tem transformações nos nós; esta ferramenta espera as peças já no lugar");

await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true; // "Prune": tira mechas soltas pequenas do cabelo
interface PecaCrua {
  P: Float32Array;
  I: Uint32Array;
  area: number;
}
const cruas: PecaCrua[] = gltf.meshes.map(
  (m: { primitives: { attributes: { POSITION: number }; indices: number }[] }) => {
    const pr = m.primitives[0],
      P0 = acessor(pr.attributes.POSITION, Float32Array, 3),
      I0: ArrayLike<number> =
        gltf.accessors[pr.indices].componentType === 5125
          ? acessor(pr.indices, Uint32Array, 1)
          : acessor(pr.indices, Uint16Array, 1);
    const sol = soldar(P0, 1e-6),
      P = new Float32Array(sol.n * 3),
      I = new Uint32Array(I0.length);
    for (let v = 0; v < P0.length / 3; v++) for (let e = 0; e < 3; e++) P[sol.id[v] * 3 + e] = P0[v * 3 + e];
    let area = 0;
    for (let t = 0; t < I0.length; t += 3) {
      const a = (I[t] = sol.id[I0[t]]),
        b = (I[t + 1] = sol.id[I0[t + 1]]),
        c = (I[t + 2] = sol.id[I0[t + 2]]);
      const u = [0, 1, 2].map((e) => P[b * 3 + e] - P[a * 3 + e]),
        w = [0, 1, 2].map((e) => P[c * 3 + e] - P[a * 3 + e]);
      area += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
    }
    return { P, I, area };
  },
);
const peso = (i: number) => cruas[i].area * (plano.prioridade?.[i] ?? 1);
const somaPeso = cruas.reduce((s, _, i) => s + peso(i), 0);

/** triângulos soltos (9 números cada) e a peça de cada um */
let T: number[] = [],
  pecaDe: number[] = [];
cruas.forEach((c, i) => {
  const alvo = Math.max(16, Math.round((plano.triangulos * peso(i)) / somaPeso));
  const [lo] = MeshoptSimplifier.simplify(c.I, c.P, 3, Math.min(c.I.length, alvo * 3), 0.2, ["Prune"]);
  for (let t = 0; t < lo.length; t += 3) {
    for (let k = 0; k < 3; k++) T.push(c.P[lo[t + k] * 3], c.P[lo[t + k] * 3 + 1], c.P[lo[t + k] * 3 + 2]);
    pecaDe.push(i);
  }
});
let nt = pecaDe.length;
console.log(`${cruas.length} peças → ${nt} triângulos`);

/* ---- 2. a referência: fundo, borda estendida, encaixe ---- */
const ref = sharp(plano.referencia).removeAlpha();
const { width: RW, height: RH } = await ref.metadata();
const img = await ref.raw().toBuffer();
// fundo = branco ligado às bordas da imagem (o branco da roupa fica, porque não toca a borda)
const fundo = new Uint8Array(RW * RH),
  fila: number[] = [];
// fundo cinza: neutro e de brilho médio (cabelo branco, azul-marinho e castanho escuro ficam de fora)
const branco =
  plano.fundo === "cinza"
    ? (o: number) => {
        const r = img[o * 3],
          g = img[o * 3 + 1],
          b = img[o * 3 + 2];
        // a sombra no chão é um pouco azulada (65,68,75), o cabelo azul-marinho também, mas mais escuro (52,44,55)
        const croma = Math.max(r, g, b) - Math.min(r, g, b),
          mx = Math.max(r, g, b);
        return (croma < 6 || (croma < 12 && mx >= 66)) && mx < 130 && Math.min(r, g, b) > 35;
      }
    : (o: number) => Math.min(img[o * 3], img[o * 3 + 1], img[o * 3 + 2]) > 232;
for (let x = 0; x < RW; x++) fila.push(x, (RH - 1) * RW + x);
for (let y = 0; y < RH; y++) fila.push(y * RW, y * RW + RW - 1);
for (let q = 0; q < fila.length; q++) {
  const o = fila[q];
  if (fundo[o] || !branco(o)) continue;
  fundo[o] = 1;
  const x = o % RW;
  if (x > 0) fila.push(o - 1);
  if (x < RW - 1) fila.push(o + 1);
  if (o >= RW) fila.push(o - RW);
  if (o < RW * (RH - 1)) fila.push(o + RW);
}
// buracos brancos pequenos presos dentro da silhueta (entre mechas, entre o cabelo e o braço) também são fundo; um
// brilho branco pequeno da roupa que caia aqui só vira a cor do vizinho
{
  const visto = new Uint8Array(RW * RH);
  for (let o0 = 0; o0 < RW * RH; o0++) {
    if (visto[o0] || fundo[o0] || !branco(o0)) continue;
    const comp = [o0];
    visto[o0] = 1;
    for (let q = 0; q < comp.length; q++) {
      const o = comp[q],
        x = o % RW;
      for (const n of [x > 0 ? o - 1 : -1, x < RW - 1 ? o + 1 : -1, o - RW, o + RW])
        if (n >= 0 && n < RW * RH && !visto[n] && !fundo[n] && branco(n)) {
          visto[n] = 1;
          comp.push(n);
        }
    }
    if (comp.length < 3000) for (const o of comp) fundo[o] = 1;
  }
}
// fundo cinza: manchinhas soltas (a ponta da sombra no chão) também são fundo; esticavam a caixa do encaixe
if (plano.fundo === "cinza") {
  const visto = new Uint8Array(RW * RH);
  for (let o0 = 0; o0 < RW * RH; o0++) {
    if (visto[o0] || fundo[o0]) continue;
    const comp = [o0];
    visto[o0] = 1;
    for (let q = 0; q < comp.length; q++) {
      const o = comp[q],
        x = o % RW;
      for (const n of [x > 0 ? o - 1 : -1, x < RW - 1 ? o + 1 : -1, o - RW, o + RW])
        if (n >= 0 && n < RW * RH && !visto[n] && !fundo[n]) {
          visto[n] = 1;
          comp.push(n);
        }
    }
    if (comp.length < 2000) for (const o of comp) fundo[o] = 1;
  }
}
// cor estendida para fora da silhueta (as bordas do modelo que caem um pouco fora não pegam branco); os 3 px da borda
// da silhueta saem antes (a borda suavizada mistura branco: dava pontas de cabelo cinza)
const cor = Buffer.from(img),
  feito = Uint8Array.from(fundo, (f) => 1 - f);
for (let r = 0; r < 3; r++) {
  const tira: number[] = [];
  for (let o = 0; o < RW * RH; o++)
    if (feito[o]) {
      const x = o % RW;
      if (
        (x > 0 && !feito[o - 1]) ||
        (x < RW - 1 && !feito[o + 1]) ||
        (o >= RW && !feito[o - RW]) ||
        (o < RW * (RH - 1) && !feito[o + RW])
      )
        tira.push(o);
    }
  for (const o of tira) feito[o] = 0;
}
let frente = [...Array(RW * RH).keys()].filter((o) => feito[o]);
while (frente.length) {
  const prox: number[] = [];
  for (const o of frente) {
    const x = o % RW;
    for (const n of [x > 0 ? o - 1 : -1, x < RW - 1 ? o + 1 : -1, o - RW, o + RW])
      if (n >= 0 && n < RW * RH && !feito[n]) {
        feito[n] = 1;
        for (let e = 0; e < 3; e++) cor[n * 3 + e] = cor[o * 3 + e];
        prox.push(n);
      }
  }
  frente = prox;
}

/** Desenha os triângulos de frente na grade da referência (escala s, deslocamento d): id e profundidade por pixel. */
let todos = [...Array(nt).keys()];
function rasterizar(sx: number, sy: number, dx: number, dy: number, esc = 1, tris: number[] = todos) {
  const W = Math.round(RW * esc),
    H = Math.round(RH * esc),
    id = new Int32Array(W * H).fill(-1),
    zb = new Float32Array(W * H).fill(-1e9);
  for (const t of tris) {
    const Q = [0, 1, 2].map((k) => [
      (dx + T[t * 9 + k * 3] * sx) * esc,
      (dy - T[t * 9 + k * 3 + 1] * sy) * esc,
      T[t * 9 + k * 3 + 2],
    ]);
    const area = (Q[1][0] - Q[0][0]) * (Q[2][1] - Q[0][1]) - (Q[2][0] - Q[0][0]) * (Q[1][1] - Q[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(Q[0][0], Q[1][0], Q[2][0]))),
      x1 = Math.min(W - 1, Math.ceil(Math.max(Q[0][0], Q[1][0], Q[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(Q[0][1], Q[1][1], Q[2][1]))),
      y1 = Math.min(H - 1, Math.ceil(Math.max(Q[0][1], Q[1][1], Q[2][1])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5,
          qy = y + 0.5;
        const w0 = ((Q[1][0] - qx) * (Q[2][1] - qy) - (Q[2][0] - qx) * (Q[1][1] - qy)) / area,
          w1 = ((Q[2][0] - qx) * (Q[0][1] - qy) - (Q[0][0] - qx) * (Q[2][1] - qy)) / area,
          w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * Q[0][2] + w1 * Q[1][2] + w2 * Q[2][2],
          o = y * W + x;
        if (z > zb[o]) {
          zb[o] = z;
          id[o] = t;
        }
      }
  }
  return { id, zb, W, H };
}

// encaixe: começa pelas caixas e sobe a sobreposição (interseção / união) mexendo um parâmetro por vez
let mn = [Infinity, Infinity],
  mx = [-Infinity, -Infinity];
for (let i = 0; i < T.length; i += 3) {
  mn = [Math.min(mn[0], T[i]), Math.min(mn[1], T[i + 1])];
  mx = [Math.max(mx[0], T[i]), Math.max(mx[1], T[i + 1])];
}
let rmn = [RW, RH],
  rmx = [0, 0];
for (let o = 0; o < RW * RH; o++)
  if (!fundo[o]) {
    const x = o % RW,
      y = Math.floor(o / RW);
    rmn = [Math.min(rmn[0], x), Math.min(rmn[1], y)];
    rmx = [Math.max(rmx[0], x), Math.max(rmx[1], y)];
  }
let par = [(rmx[0] - rmn[0]) / (mx[0] - mn[0]), (rmx[1] - rmn[1]) / (mx[1] - mn[1]), 0, 0];
par[2] = rmn[0] - mn[0] * par[0];
par[3] = rmx[1] + mn[1] * par[1];
const ESC = 0.4,
  fundoP = new Uint8Array(Math.round(RW * ESC) * Math.round(RH * ESC));
{
  const W = Math.round(RW * ESC);
  for (let o = 0; o < fundoP.length; o++)
    fundoP[o] =
      fundo[Math.min(RH - 1, Math.floor(Math.floor(o / W) / ESC)) * RW + Math.min(RW - 1, Math.floor((o % W) / ESC))];
}
/** sobe a sobreposição (interseção / união) dos triângulos `tris` com a silhueta `alvo` (grade ESC) */
function encaixar(par: number[], tris: number[], alvo: ArrayLike<number>) {
  const sobreposicao = (p: number[]) => {
    const r = rasterizar(p[0], p[1], p[2], p[3], ESC, tris);
    let i = 0,
      u = 0;
    for (let o = 0; o < r.id.length; o++) {
      const a = r.id[o] >= 0,
        b = alvo[o] > 0;
      if (a && b) i++;
      if (a || b) u++;
    }
    return i / u;
  };
  let melhor = sobreposicao(par);
  const inicial = melhor;
  for (const passo of [0.02, 0.01, 0.005, 0.0025])
    for (let volta = 0, mudou = true; mudou && volta < 8; volta++) {
      mudou = false;
      for (let k = 0; k < 4; k++)
        for (const sinal of [1, -1]) {
          const p = [...par];
          p[k] += sinal * passo * (k < 2 ? par[k] : RW);
          const s = sobreposicao(p);
          if (s > melhor) {
            melhor = s;
            par = p;
            mudou = true;
          }
        }
    }
  return { par, inicial, melhor };
}
const enc = encaixar(
  par,
  todos,
  Uint8Array.from(fundoP, (f) => 1 - f),
);
par = enc.par;
const aj = plano.ajusteRef ?? {};
par = [par[0] * (aj.sx ?? 1), par[1] * (aj.sy ?? 1), par[2] + (aj.dx ?? 0), par[3] + (aj.dy ?? 0)];
const txtEncaixe = (e: { inicial: number; melhor: number }, p: number[]) =>
  `sobreposição ${(e.inicial * 100).toFixed(1)}% → ${(e.melhor * 100).toFixed(1)}% ` +
  `(escala ${p[0].toFixed(1)} × ${p[1].toFixed(1)}, origem ${p[2].toFixed(1)}, ${p[3].toFixed(1)})`;
console.log(`encaixe na referência: ${txtEncaixe(enc, par)}`);

// folha com vários modelos: cada grupo encaixa de novo só na silhueta da referência dentro de uma janela em volta de
// onde caiu (as manchas vizinhas se encostam pelo cabelo, então a mancha inteira pegava a cabeça do lado)
let grupoDe = new Int32Array(nt).fill(0);
const grupos: { tris: number[]; par: number[] }[] = [];
if (plano.separar) {
  const W = Math.round(RW * ESC);
  plano.separar.forEach((g, gi) => {
    const tris = todos.filter((t) => g.malhas.includes(pecaDe[t]));
    for (const t of tris) grupoDe[t] = gi;
    const r = rasterizar(par[0], par[1], par[2], par[3], ESC, tris);
    let x0 = W,
      y0 = r.H,
      x1 = 0,
      y1 = 0;
    for (let o = 0; o < r.id.length; o++)
      if (r.id[o] >= 0) {
        x0 = Math.min(x0, o % W);
        x1 = Math.max(x1, o % W);
        y0 = Math.min(y0, Math.floor(o / W));
        y1 = Math.max(y1, Math.floor(o / W));
      }
    const mx = (x1 - x0) * 0.06,
      my = (y1 - y0) * 0.06;
    const alvo = Uint8Array.from(fundoP, (f, o) => {
      const x = o % W,
        y = Math.floor(o / W);
      return !f && x >= x0 - mx && x <= x1 + mx && y >= y0 - my && y <= y1 + my ? 1 : 0;
    });
    const e = encaixar(par, tris, alvo);
    grupos.push({ tris, par: e.par });
    console.log(`  ${g.nome}: ${txtEncaixe(e, e.par)}`);
  });
} else grupos.push({ tris: todos, par });

/* ---- 3. cor por triângulo ---- */
let C = new Float32Array(0);
/** v8.1 — os triângulos que pegaram a cor da referência (de frente e à vista), do último colorir() */
let VIS = new Uint8Array(0);
function colorir() {
  const BAR = [
    [1 / 3, 1 / 3, 1 / 3],
    [0.6, 0.2, 0.2],
    [0.2, 0.6, 0.2],
    [0.2, 0.2, 0.6],
    [0.45, 0.45, 0.1],
    [0.1, 0.45, 0.45],
    [0.45, 0.1, 0.45],
    [0.8, 0.1, 0.1],
    [0.1, 0.8, 0.1],
    [0.1, 0.1, 0.8],
  ];
  C = new Float32Array(nt * 3);
  const visivel = new Uint8Array(nt),
    centro = new Float32Array(nt * 3),
    frontal = new Float32Array(nt),
    baixo = new Uint8Array(nt);
  for (const { tris, par } of grupos) {
    const vis = rasterizar(par[0], par[1], par[2], par[3], 1, tris);
    for (const t of tris) {
      const v = (k: number, e: number) => T[t * 9 + k * 3 + e];
      for (let e = 0; e < 3; e++) centro[t * 3 + e] = (v(0, e) + v(1, e) + v(2, e)) / 3;
      const u = [0, 1, 2].map((e) => v(1, e) - v(0, e)),
        w = [0, 1, 2].map((e) => v(2, e) - v(0, e));
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      frontal[t] = n[2] / (Math.hypot(n[0], n[1], n[2]) || 1);
      baixo[t] = n[1] / (Math.hypot(n[0], n[1], n[2]) || 1) < -0.6 ? 1 : 0;
      if (frontal[t] < 0.2) continue; // de lado ou de costas para a referência
      const soma = [0, 0, 0];
      let k = 0;
      for (const b of BAR) {
        const q = [0, 1, 2].map((e) => b[0] * v(0, e) + b[1] * v(1, e) + b[2] * v(2, e));
        const x = Math.floor(par[2] + q[0] * par[0]),
          y = Math.floor(par[3] - q[1] * par[1]);
        if (x < 0 || y < 0 || x >= RW || y >= RH) continue;
        const o = y * RW + x;
        if (vis.id[o] !== t && vis.zb[o] - q[2] > 0.002) continue; // outra coisa na frente
        // v8.1 — corpo inteiro: o encaixe é ~94%, e na lateral a amostra caía no fundo branco (as manchas brancas da F02)
        if (plano.preencher === "corpo" && fundo[o]) continue;
        for (let e = 0; e < 3; e++) soma[e] += cor[o * 3 + e];
        k++;
      }
      if (k < 4) continue;
      visivel[t] = 1;
      for (let e = 0; e < 3; e++) C[t * 3 + e] = soma[e] / k / 255;
    }
  }
  // v8.1 — corpo inteiro: a altura do pescoço; abaixo dele só o que está bem de frente pega a referência (de raspão
  // a pintura esticava na lateral), o resto vem da pele de frente mais perto (ver abaixo)
  let ySoPele = Infinity;
  if (plano.preencher === "corpo") {
    let y0 = Infinity,
      y1 = -Infinity;
    for (let t = 0; t < nt; t++) {
      y0 = Math.min(y0, centro[t * 3 + 1]);
      y1 = Math.max(y1, centro[t * 3 + 1]);
    }
    // o pescoço: o ponto mais fino do corpo acima da linha dos braços (o coque alto da F04 subia o topo, e 85% da altura
    // caía nos ombros: a lógica do cabelo pintava as costas de cabelo)
    const H = y1 - y0;
    let mao = 0;
    for (let t = 0; t < nt; t++) mao = Math.max(mao, Math.abs(centro[t * 3]));
    const ys: number[] = [];
    for (let t = 0; t < nt; t++) if (Math.abs(centro[t * 3]) > mao * 0.7) ys.push(centro[t * 3 + 1]);
    ys.sort((a, b) => a - b);
    const yb = ys[ys.length >> 1];
    const fatia = (y: number) => {
      let l = 0;
      for (let t = 0; t < nt; t++)
        if (Math.abs(centro[t * 3 + 1] - y) < H * 0.005) l = Math.max(l, Math.abs(centro[t * 3]));
      return l;
    };
    // só até a fatia mais larga da cabeça: no topo, o prendedor do coque da F02 era mais fino que o pescoço
    let yCab = y1,
      maior = 0;
    for (let y = yb + H * 0.06; y < y1; y += H * 0.005) {
      const l = fatia(y);
      if (l > maior) {
        maior = l;
        yCab = y;
      }
    }
    let pescoco = y0 + H * 0.85,
      menor = Infinity;
    for (let y = yb + H * 0.02; y < yCab; y += H * 0.005) {
      const l = fatia(y);
      if (l > 0 && l < menor) {
        menor = l;
        pescoco = y;
      }
    }
    ySoPele = plano.pescoco != null ? y0 + H * plano.pescoco : pescoco;
    console.log(`corpo: o pescoço em ${((ySoPele - y0) / H).toFixed(3)} da altura`);
    for (let t = 0; t < nt; t++) if (centro[t * 3 + 1] < ySoPele && frontal[t] < 0.4) visivel[t] = 0;
  }
  VIS = visivel;
  const visiveis = [...Array(nt).keys()].filter((t) => visivel[t]);
  const porPeca = new Map<number, number[]>();
  for (const t of visiveis) {
    const l = porPeca.get(pecaDe[t]) ?? [];
    l.push(t);
    porPeca.set(pecaDe[t], l);
  }
  /** mediana (por canal) dos k candidatos mais próximos (d = distância ao quadrado); a mediana não deixa um enfeite
    vizinho (a fita vermelha do rabo de cavalo) manchar o cabelo das costas */
  const mediaPerto = (t: number, cands: number[], d: (a: number, b: number) => number, kmax = 8) => {
    const melhores: [number, number][] = [];
    for (const c of cands) {
      const dd = d(t, c);
      if (melhores.length < kmax || dd < melhores[melhores.length - 1][0]) {
        melhores.push([dd, c]);
        melhores.sort((a, b) => a[0] - b[0]);
        if (melhores.length > kmax) melhores.pop();
      }
    }
    for (let e = 0; e < 3; e++) {
      const vs = melhores.map(([, c]) => C[c * 3 + e]).sort((a, b) => a - b);
      C[t * 3 + e] = vs[vs.length >> 1];
    }
  };
  const dXY = (a: number, b: number) =>
    (centro[a * 3] - centro[b * 3]) ** 2 + (centro[a * 3 + 1] - centro[b * 3 + 1]) ** 2;
  const d3 = (a: number, b: number) => dXY(a, b) + (centro[a * 3 + 2] - centro[b * 3 + 2]) ** 2;
  // `preencher: "superficie"`: o escondido pega a cor do visível mais perto andando pela superfície da peça (cabeça de
  // malha única, rosto e cabelo juntos: em x/y a nuca caía no rosto, que fica bem na frente dela)
  const feitoSup = new Uint8Array(nt);
  // v8.1 — no corpo inteiro (`corpo`) o mesmo vale para a cabeça (acima do pescoço), com as faixas do cabelo e do rosto
  // medidas nela: sem isso a nuca pegava a cor do rosto (em x/y fica bem atrás dele) — a nuca de pele da F02
  const naRegiao = (t: number) => plano.preencher !== "corpo" || centro[t * 3 + 1] >= ySoPele;
  if (plano.preencher === "superficie" || plano.preencher === "corpo") {
    const chave = (i: number) => `${T[i]},${T[i + 1]},${T[i + 2]}`,
      porVert = new Map<string, number[]>();
    for (let t = 0; t < nt; t++)
      for (let k = 0; k < 3; k++) {
        const c = chave(t * 9 + k * 3),
          l = porVert.get(c) ?? [];
        l.push(t);
        porVert.set(c, l);
      }
    const vizinhos = (t: number) => {
      const s = new Set<number>();
      for (let k = 0; k < 3; k++)
        for (const u of porVert.get(chave(t * 9 + k * 3))!) if (u !== t && pecaDe[u] === pecaDe[t]) s.add(u);
      return s;
    };
    // Dijkstra a partir de várias fontes (fila de prioridade em heap binário)
    const heap: [number, number][] = [];
    const empurra = (d: number, t: number) => {
      heap.push([d, t]);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const tira = () => {
      const topo = heap[0],
        ult = heap.pop()!;
      if (heap.length) {
        heap[0] = ult;
        for (let i = 0; ;) {
          const a = i * 2 + 1,
            b = a + 1;
          let m = i;
          if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
          if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return topo;
    };
    const geodesica = (fontes: number[]) => {
      const dist = new Float64Array(nt).fill(Infinity),
        fonte = new Int32Array(nt).fill(-1);
      for (const t of fontes) {
        dist[t] = 0;
        fonte[t] = t;
        empurra(0, t);
      }
      while (heap.length) {
        const [d, t] = tira();
        // a base cortada do busto (virada para baixo) recebe cor mas não passa adiante: levava a camiseta e a pele
        // da frente por baixo até as costas do cabelo
        if (d > dist[t] || (baixo[t] && d > 0)) continue;
        for (const u of vizinhos(t)) {
          const du = d + Math.sqrt(d3(t, u));
          if (du < dist[u]) {
            dist[u] = du;
            fonte[u] = fonte[t];
            empurra(du, u);
          }
        }
      }
      return { dist, fonte };
    };
    // a cor vem da mediana do alto da cabeça (cabelo; no careca, pele) ou do meio do rosto, com um pouco da luz da
    // fonte. A cor da fonte direto variava demais (sombra entre as mechas)
    const rep = grupos.map(({ tris: todosDoGrupo }, gi) => {
      const tris = todosDoGrupo.filter(naRegiao),
        mn = [Infinity, Infinity],
        mx = [-Infinity, -Infinity];
      for (const t of tris) {
        mn[0] = Math.min(mn[0], centro[t * 3]);
        mx[0] = Math.max(mx[0], centro[t * 3]);
        mn[1] = Math.min(mn[1], centro[t * 3 + 1]);
        mx[1] = Math.max(mx[1], centro[t * 3 + 1]);
      }
      const w = mx[0] - mn[0],
        h = mx[1] - mn[1],
        cx = (mn[0] + mx[0]) / 2;
      const mediana = (ok: (x: number, y: number) => boolean) => {
        const sel = tris.filter((t) => visivel[t] && frontal[t] > 0.5 && ok(centro[t * 3], centro[t * 3 + 1]));
        return [0, 1, 2].map((e) => {
          const vs = sel.map((t) => C[t * 3 + e]).sort((a, b) => a - b);
          return vs[vs.length >> 1] ?? 0.5;
        });
      };
      return {
        // fração da altura; o coque alto puxa a altura e o queixo padrão subia até o nariz
        queixo: mn[1] + h * (plano.separar?.[gi].queixo ?? plano.queixo ?? 0.42),
        cabelo: mediana((x, y) => y > mx[1] - h * 0.12 && Math.abs(x - cx) < w * 0.25),
        pele: mediana((x, y) => y > mn[1] + h * 0.5 && y < mn[1] + h * 0.62 && Math.abs(x - cx) < w * 0.08),
      };
    });
    const lum = (c: ArrayLike<number>, o = 0) => c[o] * 0.3 + c[o + 1] * 0.59 + c[o + 2] * 0.11 + 1e-6;
    // fontes só o que está bem de frente (o triângulo de raspão na borda da silhueta pega a sombra escura entre as
    // mechas), separadas em pele e cabelo pela cor; uma geodésica para cada
    const ehPele = (t: number) => {
      const r = rep[grupoDe[t]],
        d = (c: number[]) => (C[t * 3] - c[0]) ** 2 + (C[t * 3 + 1] - c[1]) ** 2 + (C[t * 3 + 2] - c[2]) ** 2;
      return d(r.pele) < d(r.cabelo);
    };
    const frente = visiveis.filter((t) => frontal[t] >= 0.5 && naRegiao(t));
    const gP = geodesica(frente.filter(ehPele)),
      gC = geodesica(frente.filter((t) => !ehPele(t)));
    const esc = [...Array(nt).keys()].filter(
      (t) => !visivel[t] && naRegiao(t) && (gP.fonte[t] >= 0 || gC.fonte[t] >= 0),
    );
    for (const t of esc) {
      const r = rep[grupoDe[t]];
      // acima do queixo o escondido é cabelo (a sombra castanha do loiro ficava mais perto da pele que do loiro);
      // abaixo (pescoço, mechas caídas) vence a pele ou o cabelo mais perto pela superfície. Com uma fonte só, uma
      // mecha escura ao lado do pescoço pintava a nuca toda
      // `nuca` (padrão 1) dá vantagem à pele: no coque a nuca encosta na linha do cabelo e a pele visível do pescoço
      // fica do outro lado; as mechas finas seguem cabelo porque o verso delas está colado na frente visível
      const pele =
          gC.fonte[t] < 0 ||
          (centro[t * 3 + 1] < r.queixo && gP.dist[t] < gC.dist[t] * (plano.separar?.[grupoDe[t]].nuca ?? 1)),
        alvo = pele ? r.pele : r.cabelo,
        f = (pele ? gP : gC).fonte[t] * 3,
        luz = Math.min(1.1, Math.max(0.85, lum(C, f) / lum(alvo)));
      for (let e = 0; e < 3; e++) C[t * 3 + e] = Math.min(1, alvo[e] * luz);
      feitoSup[t] = 1;
    }
    // passadas de mediana com os vizinhos já pintados (a fronteira entre duas fontes fica serrilhada); o vizinho sem
    // cor ainda (a base do busto, pintada depois) entrava como preto
    for (let passo = 0; passo < 4; passo++) {
      const C0 = Float32Array.from(C);
      for (const t of esc) {
        const viz = [t, ...vizinhos(t)].filter((u) => visivel[u] || feitoSup[u]);
        for (let e = 0; e < 3; e++) {
          const vs = viz.map((u) => C0[u * 3 + e]).sort((a, b) => a - b);
          C[t * 3 + e] = vs[vs.length >> 1];
        }
      }
    }
  }
  // v8.1 — `preencher: "corpo"` (corpo inteiro numa peça só): em x/y as costas copiavam a frente (os seios no cabelo
  // das costas, o biquíni no bumbum) e pela superfície o cabelo descia pela nuca e pintava as costas todas. Abaixo do
  // pescoço o escondido pega a mediana da PELE visível mais perto em 3D (sem cabelo nem biquíni); acima, a cabeça vai
  // pela superfície (o bloco de cima)
  const ehPele = (t: number) => {
    const r = C[t * 3],
      g = C[t * 3 + 1],
      b = C[t * 3 + 2];
    // o tom: na pele o verde fica entre 48% e 80% do vermelho; o cabelo ruivo/rosa escuro fica abaixo
    return r > 0.45 && g > r * 0.48 && g < r * 0.8 && g > b && r - b > 0.2;
  };
  const peleVis =
    plano.preencher === "corpo"
      ? visiveis.filter((t) => frontal[t] >= 0.5 && centro[t * 3 + 1] < ySoPele && ehPele(t))
      : [];
  // a cor das costas e das laterais: a mediana de toda a pele de frente, com só um pouco da luz da pele de frente mais
  // perto — a mais perto em 3D, sozinha, trazia o brilho pintado no peito para as costas (as manchas claras da F02)
  const luz3 = (c: ArrayLike<number>, o: number) => c[o] * 0.3 + c[o + 1] * 0.59 + c[o + 2] * 0.11 + 1e-6;
  const peleMed = [0, 1, 2].map(
      (e) => peleVis.map((t) => C[t * 3 + e]).sort((a, b) => a - b)[peleVis.length >> 1] ?? 0.5,
    ),
    luzMed = luz3(peleMed, 0);
  // abaixo do pescoço, o visível desbotado fora do tom da pele (o fundo misturado na borda) vira escondido: de lado era
  // uma faixa branca/cinza na cintura e em cima dos ombros. O escuro fica (os traços do umbigo, do abdome), e o saturado
  // também (biquíni, mamilo). O brilho de contorno da pintura é tom de pele claro: sai só de raspão (o de frente é
  // o brilho do seio, do ombro)
  const sat3 = (c: ArrayLike<number>, o: number) => {
    const M = Math.max(c[o], c[o + 1], c[o + 2]);
    return M > 0 ? (M - Math.min(c[o], c[o + 1], c[o + 2])) / M : 0;
  };
  const satMed = sat3(peleMed, 0);
  if (peleVis.length)
    for (const t of visiveis)
      if (
        centro[t * 3 + 1] < ySoPele &&
        ((!ehPele(t) && luz3(C, t * 3) > luzMed * 0.75 && (luz3(C, t * 3) > luzMed || sat3(C, t * 3) < satMed * 0.7)) ||
          (frontal[t] < 0.75 && luz3(C, t * 3) > luzMed * 1.1))
      )
        visivel[t] = 0;
  let semVisivel = 0;
  for (let t = 0; t < nt; t++) {
    if (visivel[t] || feitoSup[t]) continue;
    if (peleVis.length && centro[t * 3 + 1] < ySoPele) {
      mediaPerto(t, peleVis, d3, 24);
      const f = Math.min(1.04, Math.max(0.92, luz3(C, t * 3) / luzMed));
      for (let e = 0; e < 3; e++) C[t * 3 + e] = Math.min(1, peleMed[e] * f);
      continue;
    }
    const mesma = porPeca.get(pecaDe[t]);
    if (mesma) mediaPerto(t, mesma, dXY);
    else {
      mediaPerto(
        t,
        visiveis.filter((c) => grupoDe[c] === grupoDe[t]),
        d3,
        1,
      );
      semVisivel++;
    }
  }
  console.log(
    `${visiveis.length} triângulos com cor da referência, ${nt - visiveis.length} pela peça (${semVisivel} sem peça visível)`,
  );
}
colorir();

/** troca a malha de trabalho (triângulos soltos, peça e grupo de cada um) */
function trocarMalha(nT: number[], nPeca: number[], nGrupo: number[]) {
  T = nT;
  pecaDe = nPeca;
  nt = nPeca.length;
  todos = [...Array(nt).keys()];
  grupoDe = Int32Array.from(nGrupo);
  for (const g of grupos) g.tris = [];
  for (let t = 0; t < nt; t++) grupos[grupoDe[t]].tris.push(t);
}

/* ---- 4. refinar (por grupo de `separar` com `refinar`: triângulos finais) ----
   O encaixe acima foi na malha leve. Aqui o grupo volta denso (`denso` triângulos), é pintado, cada vértice leva a
   cor média dos triângulos em volta e a redução (simplifyWithAttributes) usa essa cor: os vértices ficam nas bordas
   do olho, da boca e da linha do cabelo em vez de sumir com elas. Depois a malha final é pintada de novo. */
const refinados = (plano.separar ?? []).map((g, gi) => (g.refinar ? gi : -1)).filter((gi) => gi >= 0);
if (refinados.length) {
  const nT: number[] = [],
    nPeca: number[] = [],
    nGrupo: number[] = [];
  const manter = (t: number) => {
    for (let i = t * 9; i < t * 9 + 9; i++) nT.push(T[i]);
    nPeca.push(pecaDe[t]);
    nGrupo.push(grupoDe[t]);
  };
  for (let t = 0; t < nt; t++) if (!refinados.includes(grupoDe[t])) manter(t);
  for (const gi of refinados) {
    const malhas = plano.separar![gi].malhas,
      areaG = malhas.reduce((s, i) => s + cruas[i].area, 0);
    for (const i of malhas) {
      const c = cruas[i],
        alvo = Math.round(((plano.denso ?? 40000) * c.area) / areaG);
      const [lo] = MeshoptSimplifier.simplify(c.I, c.P, 3, Math.min(c.I.length, alvo * 3), 0.2, ["Prune"]);
      for (let t = 0; t < lo.length; t += 3) {
        for (let k = 0; k < 3; k++) nT.push(c.P[lo[t + k] * 3], c.P[lo[t + k] * 3 + 1], c.P[lo[t + k] * 3 + 2]);
        nPeca.push(i);
        nGrupo.push(gi);
      }
    }
  }
  trocarMalha(nT, nPeca, nGrupo);
  console.log(`refinar: malha densa ${nt} triângulos`);
  colorir();

  const fT: number[] = [],
    fPeca: number[] = [],
    fGrupo: number[] = [];
  for (let t = 0; t < nt; t++)
    if (!refinados.includes(grupoDe[t])) {
      for (let i = t * 9; i < t * 9 + 9; i++) fT.push(T[i]);
      fPeca.push(pecaDe[t]);
      fGrupo.push(grupoDe[t]);
    }
  for (const gi of refinados) {
    // solda por posição exata (os triângulos soltos vieram dos mesmos vértices da peça)
    const id = new Map<string, number>(),
      P: number[] = [],
      cor: number[] = [],
      pesoV: number[] = [],
      pecaV: number[] = [],
      I: number[] = [];
    for (const t of grupos[gi].tris) {
      const a = [0, 1, 2].map((e) => T[t * 9 + 3 + e] - T[t * 9 + e]),
        b = [0, 1, 2].map((e) => T[t * 9 + 6 + e] - T[t * 9 + e]),
        area = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) + 1e-12;
      for (let k = 0; k < 3; k++) {
        const o = t * 9 + k * 3,
          ch = `${T[o]},${T[o + 1]},${T[o + 2]}`;
        let v = id.get(ch);
        if (v === undefined) {
          id.set(ch, (v = P.length / 3));
          P.push(T[o], T[o + 1], T[o + 2]);
          cor.push(0, 0, 0);
          pesoV.push(0);
          pecaV.push(pecaDe[t]);
        }
        for (let e = 0; e < 3; e++) cor[v * 3 + e] += C[t * 3 + e] * area;
        pesoV[v] += area;
        I.push(v);
      }
    }
    for (let v = 0; v < pesoV.length; v++) for (let e = 0; e < 3; e++) cor[v * 3 + e] /= pesoV[v];
    // `olhos` (pixels da referência): os vértices da frente em volta de cada olho ficam travados, densos. O Tripo fez
    // olhos semicerrados e a pintura é de olho aberto; reduzido, o olho virava um borrão de pálpebra e íris
    const trava = new Uint8Array(pesoV.length),
      g = plano.separar![gi],
      p = grupos[gi].par,
      raio = g.raioOlho ?? 11;
    for (const [ox, oy] of g.olhos ?? []) {
      const dentro: number[] = [];
      for (let v = 0; v < pesoV.length; v++) {
        const dx = (p[2] + P[v * 3] * p[0] - ox) / raio,
          dy = (p[3] - P[v * 3 + 1] * p[1] - oy) / (raio * 0.7);
        if (dx * dx + dy * dy <= 1) dentro.push(v);
      }
      const zf = Math.max(...dentro.map((v) => P[v * 3 + 2]));
      for (const v of dentro) if (P[v * 3 + 2] > zf - 0.012) trava[v] = 1;
    }
    const pc = plano.pesoCor ?? 1,
      [lo] = MeshoptSimplifier.simplifyWithAttributes(
        Uint32Array.from(I),
        Float32Array.from(P),
        3,
        Float32Array.from(cor),
        3,
        [pc, pc, pc],
        g.olhos ? trava : null,
        Math.min(I.length, plano.separar![gi].refinar! * 3),
        1,
      );
    for (let t = 0; t < lo.length; t += 3) {
      for (let k = 0; k < 3; k++) fT.push(P[lo[t + k] * 3], P[lo[t + k] * 3 + 1], P[lo[t + k] * 3 + 2]);
      fPeca.push(pecaV[lo[t]]);
      fGrupo.push(gi);
    }
    console.log(`  ${plano.separar![gi].nome}: ${grupos[gi].tris.length} → ${lo.length / 3} triângulos`);
  }
  trocarMalha(fT, fPeca, fGrupo);
  colorir();
}

/* ---- `tirar`: peças que só servem para esconder o que fica atrás delas na pintura (a faixa da saia esconde a coxa,
   que assim pega a cor da coxa e não a do pano) e saem depois de pintadas ---- */
if (plano.tirar?.length && !plano.separar) {
  const fica = todos.filter((t) => !plano.tirar!.includes(pecaDe[t]));
  T = fica.flatMap((t) => T.slice(t * 9, t * 9 + 9));
  C = Float32Array.from(fica.flatMap((t) => [C[t * 3], C[t * 3 + 1], C[t * 3 + 2]]));
  pecaDe = fica.map((t) => pecaDe[t]);
  nt = fica.length;
  todos = [...Array(nt).keys()];
  console.log(`tirar ${plano.tirar.join(",")}: ficam ${nt} triângulos`);
}

/* ---- saída: espaço do jogo (frente +x, direita +z) para o exportador; prévias ---- */
mkdirSync(plano.pasta, { recursive: true });
/** um grupo no espaço do jogo; `separar` centra em x/z e põe a base em y=0 */
const exportar = async (tris: number[], nome: string) => {
  let c = [0, 0, 0];
  if (plano.separar) {
    const mn = [Infinity, Infinity, Infinity],
      mx = [-Infinity, -Infinity, -Infinity];
    for (const t of tris)
      for (let i = t * 9; i < t * 9 + 9; i++) {
        mn[i % 3] = Math.min(mn[i % 3], T[i]);
        mx[i % 3] = Math.max(mx[i % 3], T[i]);
      }
    c = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  }
  // v8.1 — `pernas`: estica as pernas (abaixo da `virilha`, fração da altura) por esse fator. O vestir leva toda malha
  // à altura do rig, então pernas mais longas deixam o tronco e o quadril proporcionalmente mais estreitos: a F06
  // "alta e corpulenta, não gorda" (mantenedor, 2026-11-01); a altura maior no jogo vem do `alturaJogo` do plano de
  // animações
  let y0 = Infinity,
    y1 = -Infinity;
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      y0 = Math.min(y0, T[t * 9 + k * 3 + 1]);
      y1 = Math.max(y1, T[t * 9 + k * 3 + 1]);
    }
  const h = y1 - y0;
  let yc = 0,
    sobe = 0;
  if (plano.pernas) {
    yc = y0 + h * (plano.virilha ?? 0.47);
    sobe = (yc - y0) * (plano.pernas - 1); // os pés ficam onde estavam; o resto sobe
  }
  const yEsticado = (y: number) => (plano.pernas ? (y < yc ? yc - (yc - y) * plano.pernas : y) + sobe : y);
  // v8.1 — `forma` (a F06: "menos lateral da silhueta e o peito mais para cima", mantenedor 2026-11-01), antes das
  // pernas, em frações da altura a partir dos pés:
  //  afinar [{ de, ate, fator }]: x × fator (para o meio) entre `de` e `ate`, com 0,06 de rampa em cada borda
  //  busto { dy, raio, de, ate }: a frente de cada seio (o ponto mais à frente de cada lado entre `de` e `ate`) sobe dy,
  //  caindo em gaussiana de `raio`; só o que fica à frente do meio do tronco
  const f = plano.forma;
  const rampa = (y: number, a: number, b: number) =>
    Math.min(1, Math.max(0, (y - a) / 0.06), Math.max(0, (b - y) / 0.06));
  const seios: number[][] = [];
  if (f?.busto)
    for (const lado of [-1, 1]) {
      let m: number[] | null = null;
      for (const t of tris)
        for (let k = 0; k < 3; k++) {
          const i = t * 9 + k * 3,
            fy = (T[i + 1] - y0) / h;
          if (fy < f.busto.de || fy > f.busto.ate || T[i] * lado <= h * 0.01 || Math.abs(T[i]) > h * 0.15) continue;
          if (!m || T[i + 2] > m[2]) m = [T[i], T[i + 1], T[i + 2]];
        }
      if (m) seios.push(m);
    }
  const formar = (x: number, y: number, z: number) => {
    if (!f) return [x, y, z];
    const fy = (y - y0) / h;
    let nx = x,
      ny = y;
    for (const a of f.afinar ?? []) nx *= 1 - (1 - a.fator) * rampa(fy, a.de, a.ate);
    for (const s of seios) {
      const r = f.busto!.raio * h,
        d2 = (x - s[0]) ** 2 + (y - s[1]) ** 2 + Math.max(0, s[2] - z - r) ** 2;
      if (z > s[2] - 2 * r) ny += f.busto!.dy * h * Math.exp(-d2 / (2 * r * r));
    }
    return [nx, ny, z];
  };
  const peca = { p: [] as number[], c: [] as number[] };
  let ymax = 0;
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      const i = t * 9 + k * 3,
        q = formar(T[i], T[i + 1], T[i + 2]);
      peca.p.push(q[2] - c[2], yEsticado(q[1]) - c[1], -(q[0] - c[0]));
      peca.c.push(C[t * 3], C[t * 3 + 1], C[t * 3 + 2]);
      ymax = Math.max(ymax, T[i + 1] - c[1]);
    }
  const altura = plano.separar ? ymax * (plano.escala ?? 1) : plano.altura;
  const r = await exportarMalha(peca, plano.pasta, nome, altura);
  console.log(`${plano.pasta}/${nome}.glb/.obj: ${r.triangulos} triângulos, ${r.vertices} vértices, ${r.cores} cores`);
  // a peça do .glb de cada triângulo, na ordem do exportador (que o vestir e o gerar-animacoes mantêm): é por ela que
  // tools/gerar-aparencias.ts tira a cabeça da malha já vestida no esqueleto
  writeFileSync(join(plano.pasta, nome + "_pecas.json"), JSON.stringify(tris.map((t) => pecaDe[t])));
  // v8.1 — `textura` (lado em px): além da cor por triângulo, o recorte da pintura e, para cada triângulo de frente à
  // vista (na ordem do .glb), onde os cantos caem nele (0..1); os outros, null (ficam com a cor por triângulo). A cor por
  // triângulo não guarda o olho da pintura (a íris tem ~5 px: virava o delineado), a textura guarda
  const g = plano.separar?.find((q) => q.nome === nome);
  if (g?.textura) {
    const par = grupos[plano.separar!.indexOf(g)].par,
      px = (t: number, k: number) => [par[2] + T[t * 9 + k * 3] * par[0], par[3] - T[t * 9 + k * 3 + 1] * par[1]];
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const t of tris)
      if (VIS[t])
        for (let k = 0; k < 3; k++) {
          const [x, y] = px(t, k);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    const m = 6;
    x0 = Math.max(0, Math.floor(x0) - m);
    y0 = Math.max(0, Math.floor(y0) - m);
    x1 = Math.min(RW, Math.ceil(x1) + m);
    y1 = Math.min(RH, Math.ceil(y1) + m);
    const w = x1 - x0,
      h = y1 - y0,
      lado = g.textura,
      esc = lado / Math.max(w, h);
    await sharp(cor, { raw: { width: RW, height: RH, channels: 3 } })
      .extract({ left: x0, top: y0, width: w, height: h })
      .resize({ width: Math.round(w * esc), height: Math.round(h * esc), kernel: "lanczos3" })
      .png()
      .toFile(join(plano.pasta, nome + "_tex.png"));
    const uv = tris.map((t) =>
      VIS[t]
        ? [0, 1, 2].flatMap((k) => {
            const [x, y] = px(t, k);
            return [+((x - x0) / w).toFixed(5), +((y - y0) / h).toFixed(5)];
          })
        : null,
    );
    writeFileSync(join(plano.pasta, nome + "_uv.json"), JSON.stringify(uv));
    console.log(
      `  ${nome}: textura ${Math.round(w * esc)}×${Math.round(h * esc)}, ${uv.filter((q) => q).length} triângulos nela`,
    );
  }
};
if (plano.separar) for (const [gi, g] of plano.separar.entries()) await exportar(grupos[gi].tris, g.nome);
else await exportar(todos, plano.nome + "_tpose");

const I = Array.from({ length: nt * 3 }, (_, i) => i),
  corTri = (t: number) => [C[t * 3] * 255, C[t * 3 + 1] * 255, C[t * 3 + 2] * 255];
const costas = T.map((v, i) => (i % 3 === 1 ? v : -v)),
  WP = plano.separar ? 1600 : 700;
await desenhar(join(plano.pasta, "previa_frente.png"), T, I, corTri, { W: WP });
await desenhar(join(plano.pasta, "previa_costas.png"), costas, I, corTri, { W: WP });
await desenhar(join(plano.pasta, "previa_lado.png"), T, I, corTri, { W: 700, vista: "lado" });
if (!plano.separar) {
  const rosto = { mn: [-0.09, 0.78, -1], mx: [0.09, 0.95, 1] };
  await desenhar(join(plano.pasta, "previa_rosto.png"), T, I, corTri, { W: 500, caixaFixa: rosto });
}
// cabeça refinada de perto: frente, costas e o recorte da referência ao lado
for (const gi of refinados) {
  const g = plano.separar![gi],
    tris = grupos[gi].tris,
    p = grupos[gi].par;
  const Pg: number[] = [];
  for (const t of tris) for (let i = t * 9; i < t * 9 + 9; i++) Pg.push(T[i]);
  const Ig = Array.from({ length: tris.length * 3 }, (_, i) => i),
    corG = (t: number) => corTri(tris[t]);
  const fF = join(plano.pasta, `${g.nome}_frente.png`),
    fC = join(plano.pasta, `${g.nome}_costas.png`);
  await desenhar(fF, Pg, Ig, corG, { W: 600 });
  await desenhar(
    fC,
    Pg.map((v, i) => (i % 3 === 1 ? v : -v)),
    Ig,
    corG,
    { W: 600 },
  );
  const mn = [Infinity, Infinity],
    mx = [-Infinity, -Infinity];
  for (let i = 0; i < Pg.length; i += 3) {
    mn[0] = Math.min(mn[0], Pg[i]);
    mx[0] = Math.max(mx[0], Pg[i]);
    mn[1] = Math.min(mn[1], Pg[i + 1]);
    mx[1] = Math.max(mx[1], Pg[i + 1]);
  }
  const left = Math.max(0, Math.floor(p[2] + mn[0] * p[0])),
    top = Math.max(0, Math.floor(p[3] - mx[1] * p[1]));
  const m = await sharp(fF).metadata();
  const recorte = await sharp(plano.referencia)
    .extract({
      left,
      top,
      width: Math.min(RW - left, Math.ceil((mx[0] - mn[0]) * p[0])),
      height: Math.min(RH - top, Math.ceil((mx[1] - mn[1]) * p[1])),
    })
    .resize({ height: m.height - 60 })
    .png()
    .toBuffer();
  const rw = (await sharp(recorte).metadata()).width;
  await sharp({ create: { width: m.width * 2 + rw, height: m.height, channels: 3, background: "#262626" } })
    .composite([
      { input: fF, left: 0, top: 0 },
      { input: fC, left: m.width, top: 0 },
      { input: recorte, left: m.width * 2, top: 30 },
    ])
    .png()
    .toFile(join(plano.pasta, `${g.nome}_comparar.png`));
  // o rosto de perto, modelo e referência na mesma caixa
  const cx = (mn[0] + mx[0]) / 2,
    w = mx[0] - mn[0],
    h = mx[1] - mn[1];
  // quadrada: a prévia mantém a proporção
  const lado = Math.max(w * 0.5, h * 0.3),
    cy = mn[1] + h * 0.56;
  const caixa = { mn: [cx - lado / 2, cy - lado / 2, -1], mx: [cx + lado / 2, cy + lado / 2, 1] };
  const fR = join(plano.pasta, `${g.nome}_rosto.png`);
  await desenhar(fR, Pg, Ig, corG, { W: 500, caixaFixa: caixa });
  const mr = await sharp(fR).metadata();
  const l2 = Math.floor(p[2] + caixa.mn[0] * p[0]),
    t2 = Math.floor(p[3] - caixa.mx[1] * p[1]);
  const refR = await sharp(plano.referencia)
    .extract({
      left: l2,
      top: t2,
      width: Math.ceil((caixa.mx[0] - caixa.mn[0]) * p[0]),
      height: Math.ceil((caixa.mx[1] - caixa.mn[1]) * p[1]),
    })
    .resize({ width: mr.width - 60, height: mr.height - 60, fit: "fill", kernel: "nearest" })
    .png()
    .toBuffer();
  const modR = await sharp(fR).png().toBuffer();
  await sharp({ create: { width: mr.width * 2, height: mr.height, channels: 3, background: "#262626" } })
    .composite([
      { input: modR, left: 0, top: 0 },
      { input: refR, left: mr.width + 30, top: 30 },
    ])
    .png()
    .toFile(fR);
}
// a referência ao lado da frente, na mesma altura
const fr = await sharp(join(plano.pasta, "previa_frente.png")).metadata();
const refP = await sharp(plano.referencia).resize({ height: fr.height }).png().toBuffer();
const refW = (await sharp(refP).metadata()).width;
await sharp({ create: { width: fr.width + refW, height: fr.height, channels: 3, background: "#262626" } })
  .composite([
    { input: join(plano.pasta, "previa_frente.png"), left: 0, top: 0 },
    { input: refP, left: fr.width, top: 0 },
  ])
  .png()
  .toFile(join(plano.pasta, "previa_comparar.png"));
console.log(`prévias em ${plano.pasta}/`);
