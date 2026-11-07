/* v7.7 — modelos low poly dos itens no chão (src/assets/models/chao.json) a partir das folhas do Tripo.

   Uso:  node tools/gerar-chao.ts [plano.json] [--simular]      (padrão tools/modelos/chao.json)
   O plano diz as folhas, as peças (centro na folha, triângulos, "deitar": a peça está em pé na folha e deita de
   costas no chão; "corte": caixa x/y da folha que fica com só uma parte da ilha) e os itens: cada item usa uma peça com um tamanho no mundo ("tam": a maior medida) e um tom
   opcional ("tom": [r, g, b, f] — mistura a cor da peça com essa cor, f de 0 a 1).
   Saída: as peças normalizadas (maior medida = 1, base em y=0, centradas) em Int16 ×20000 e uma cor por
   triângulo, mais a tabela dos itens. O jogo monta a malha de cada item na carga (src/render/gl/chao.ts).
   Prévia: build/modelos/chao/itens.png, todos na mesma escala, no ângulo da câmera do jogo.
   O mesmo formato serve ao cenário do campo (tools/modelos/cenario.json → src/assets/models/cenario.json); lá o plano
   diz o enquadramento da prévia ("caixa", unidades do mundo) e quantas colunas ela tem. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { recortar, desenhar, subMalha, type MalhaTex, type Regiao } from "./lib/glb.ts";
import { reduzirPeca, type PecaBaixa } from "./lib/peca.ts";

interface PlanoChao {
  saida: string;
  previas: string;
  cache: string;
  texW: number;
  folhas: Record<string, string>;
  pecas: Record<
    string,
    {
      folha: string;
      c?: [number, number];
      /** folha deitada no chão (o diorama do acampamento): centro da ilha em x/z, visto de cima */
      cima?: [number, number];
      tris: number;
      deitar?: boolean;
      corte?: Required<Regiao>;
      /** v8.1 — meia largura da caixa em volta do centro (padrão 0,012): uma peça grande (as colinas, a montanha)
       *  precisa de caixa maior que 1/1,6 da ilha, senão recortar() corta a ilha triângulo a triângulo */
      r?: number;
      /** v8.1 — as folhas laranja (árvores de outono coladas na peça) viram verde: a estação pinta por cima no jogo */
      verdear?: boolean;
    }
  >;
  itens: Record<string, { peca: string; tam: number; tom?: [number, number, number, number] }>;
  caixa?: { mn: number[]; mx: number[] };
  colunas?: number;
}

const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

/** Autovetores de uma matriz 3×3 simétrica (Jacobi), em ordem de autovalor crescente. */
function eixosPrincipais(A: number[][]) {
  const a = A.map((r) => r.slice()),
    V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  for (let it = 0; it < 50; it++) {
    let p = 0,
      q = 1;
    for (const [i, j] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ])
      if (Math.abs(a[i][j]) > Math.abs(a[p][q])) [p, q] = [i, j];
    if (Math.abs(a[p][q]) < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]),
      c = Math.cos(th),
      s = Math.sin(th);
    for (let k = 0; k < 3; k++) {
      const akp = a[k][p],
        akq = a[k][q];
      a[k][p] = c * akp - s * akq;
      a[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < 3; k++) {
      const apk = a[p][k],
        aqk = a[q][k];
      a[p][k] = c * apk - s * aqk;
      a[q][k] = s * apk + c * aqk;
    }
    for (let k = 0; k < 3; k++) {
      const vkp = V[k][p],
        vkq = V[k][q];
      V[k][p] = c * vkp - s * vkq;
      V[k][q] = s * vkp + c * vkq;
    }
  }
  return [0, 1, 2]
    .map((i) => ({ val: a[i][i], vec: [V[0][i], V[1][i], V[2][i]] }))
    .sort((x, y) => x.val - y.val)
    .map((e) => e.vec);
}

/** Deita a peça (o eixo mais fino vira o "para cima", o mais comprido fica em x; o lado que olhava para a câmera
 *  na folha fica para cima), põe a base em y=0, centra e normaliza (maior medida = 1). */
function normalizar(pc: PecaBaixa, deitar: boolean) {
  let p = pc.p.slice();
  if (deitar) {
    const n = p.length / 3,
      m = [0, 0, 0];
    for (let i = 0; i < p.length; i++) m[i % 3] += p[i] / n;
    const C = [0, 1, 2].map(() => [0, 0, 0]);
    for (let i = 0; i < p.length; i += 3)
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += (p[i + a] - m[a]) * (p[i + b] - m[b]);
    const [fino, , longo] = eixosPrincipais(C);
    if (fino[2] < 0) for (let k = 0; k < 3; k++) fino[k] = -fino[k]; // a frente da folha (+z) para cima
    // base da rotação: x = longo, y = fino, z = longo × fino (mão direita)
    const z = [
      longo[1] * fino[2] - longo[2] * fino[1],
      longo[2] * fino[0] - longo[0] * fino[2],
      longo[0] * fino[1] - longo[1] * fino[0],
    ];
    const q: number[] = [];
    for (let i = 0; i < p.length; i += 3) {
      const v = [p[i] - m[0], p[i + 1] - m[1], p[i + 2] - m[2]];
      q.push(
        v[0] * longo[0] + v[1] * longo[1] + v[2] * longo[2],
        v[0] * fino[0] + v[1] * fino[1] + v[2] * fino[2],
        v[0] * z[0] + v[1] * z[1] + v[2] * z[2],
      );
    }
    p = q;
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
  return { p, c: pc.c };
}

/** Só os triângulos com o centro dentro da caixa (x, y da folha): separa uma parte de uma ilha que junta vários
 *  objetos (a fogueira do acampamento vem grudada no espeto, no caldeirão e no tripé). */
function cortar(m: MalhaTex, c: Required<Regiao>) {
  const tris: number[] = [];
  for (let t = 0; t < m.I.length / 3; t++) {
    let x = 0,
      y = 0;
    for (let k = 0; k < 3; k++) {
      x += m.P[m.I[t * 3 + k] * 3] / 3;
      y += m.P[m.I[t * 3 + k] * 3 + 1] / 3;
    }
    if (x > c.xMin && x < c.xMax && y > c.yMin && y < c.yMax) tris.push(t);
  }
  return subMalha(m, tris);
}

/** v8.1 — folha laranja/vermelha/amarela (a mesma regra de "laranja" de src/render/gl/estacao_cor.ts, com o amarelo
 *  do outono) vira o verde do pinheiro da mesma peça, com o brilho dela. */
function verdear(c: number[]) {
  for (let t = 0; t < c.length; t += 3) {
    const [r, g, b] = [c[t], c[t + 1], c[t + 2]];
    if (!(r > 0.4 && r > g * 1.18 && r > b * 1.6)) continue;
    const l = (r + g + b) / 3;
    c[t] = l * 0.55;
    c[t + 1] = l * 1.05;
    c[t + 2] = l * 0.45;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const plano = JSON.parse(
    readFileSync(args.find((a) => !a.startsWith("--")) ?? "tools/modelos/chao.json", "utf8"),
  ) as PlanoChao;
  const pecas: Record<string, PecaBaixa> = {};
  for (const [id, pc] of Object.entries(plano.pecas)) {
    const r = pc.r ?? 0.012;
    let m = await recortar(
      plano.folhas[pc.folha],
      pc.cima
        ? { xMin: pc.cima[0] - r, xMax: pc.cima[0] + r, zMin: pc.cima[1] - r, zMax: pc.cima[1] + r }
        : { xMin: pc.c![0] - r, xMax: pc.c![0] + r, yMin: pc.c![1] - r, yMax: pc.c![1] + r },
      plano.texW,
      plano.cache,
    );
    if (pc.corte) m = cortar(m, pc.corte);
    pecas[id] = normalizar(await reduzirPeca(m, pc.tris), !!pc.deitar);
    if (pc.verdear) verdear(pecas[id].c);
    console.log(`${id}: ${m.I.length / 3} → ${pecas[id].c.length / 3} triângulos`);
  }
  // prévia: cada item no ângulo da câmera do jogo (de cima, ~50°), todos na mesma escala
  mkdirSync(plano.previas, { recursive: true });
  const L = 210,
    COL = plano.colunas ?? 7,
    nomes = Object.keys(plano.itens),
    tiles: { input: Buffer; left: number; top: number }[] = [];
  const el = (50 * Math.PI) / 180,
    yaw = (25 * Math.PI) / 180;
  for (const [i, nome] of nomes.entries()) {
    const it = plano.itens[nome],
      pc = pecas[it.peca],
      G: number[] = [];
    for (let k = 0; k < pc.p.length; k += 3) {
      let x = pc.p[k] * it.tam,
        y = pc.p[k + 1] * it.tam,
        z = pc.p[k + 2] * it.tam;
      [x, z] = [x * Math.cos(yaw) - z * Math.sin(yaw), x * Math.sin(yaw) + z * Math.cos(yaw)];
      [y, z] = [y * Math.cos(el) - z * Math.sin(el), y * Math.sin(el) + z * Math.cos(el)];
      G.push(x, y, z);
    }
    const tom = it.tom,
      cor = (t: number) =>
        [0, 1, 2].map((e) => 255 * (tom ? pc.c[t * 3 + e] * (1 - tom[3]) + tom[e] * tom[3] : pc.c[t * 3 + e]));
    const arq = join(plano.previas, "_q.png");
    await desenhar(
      arq,
      G,
      Array.from({ length: G.length / 3 }, (_, k) => k),
      cor,
      {
        W: L,
        caixaFixa: plano.caixa ?? { mn: [-17, -14, -50], mx: [17, 20, 50] },
      },
    );
    const lbl = Buffer.from(
      `<svg width="${L}" height="22"><text x="4" y="15" font-size="13" fill="#fff" font-family="sans-serif">${nome}</text></svg>`,
    );
    tiles.push({
      input: await sharp(arq)
        .resize(L, L, { fit: "contain", background: "#262626" })
        .composite([{ input: lbl, left: 0, top: 0 }])
        .toBuffer(),
      left: (i % COL) * L,
      top: Math.floor(i / COL) * L,
    });
  }
  await sharp({
    create: { width: L * COL, height: L * Math.ceil(nomes.length / COL), channels: 3, background: "#262626" },
  })
    .composite(tiles)
    .png()
    .toFile(join(plano.previas, "itens.png"));
  console.log(`prévia em ${join(plano.previas, "itens.png")}`);
  if (args.includes("--simular")) return;
  const saida = {
    versao: 1,
    pecas: Object.fromEntries(
      Object.entries(pecas).map(([id, pc]) => [
        id,
        {
          p: b64(Int16Array.from(pc.p, (v) => Math.round(v * 20000))),
          c: b64(Uint8Array.from(pc.c, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255))),
        },
      ]),
    ),
    itens: plano.itens,
  };
  const json = JSON.stringify(saida);
  writeFileSync(plano.saida, json);
  console.log(`${plano.saida}: ${(json.length / 1024).toFixed(0)} KB`);
}

await main();
