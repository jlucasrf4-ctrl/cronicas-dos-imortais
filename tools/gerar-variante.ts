/* v8.0 — variante de um personagem animado com outra cabeça (ou outro tom), sem refazer o rig.

   Uso:  node tools/gerar-variante.ts <plano.json> [--simular]
   O plano é um plano de personagem (tools/modelos/heroina_dreads.json) com um bloco "variante":
     { "base": plano do personagem que foi riggado (tools/modelos/heroina.json),
       "anim": o JSON animado dele (src/assets/models/heroina_anim.json),
       "saidaAnim": o JSON animado da variante,
       "cabecaJuntas": juntas que podem passar peso para a cabeça nova (padrão Head, Neck) }
   Passos: gera a pose T da base e da variante (tools/lib/personagem.ts); encaixa a da base nos vértices de bind do
   animado (escala pela altura, centro em x/z) e mede o erro; cada vértice da variante copia juntas e pesos do vértice
   de bind mais próximo (os da cabeça nova, só entre os vértices cujo peso maior é de `cabecaJuntas`, para as mechas
   compridas não seguirem o ombro). Esqueleto, bind e clips ficam os do animado. Também grava as peças rígidas da
   variante (plano.saida, como tools/gerar-personagem.ts) e prévias em <plano.previas>/anim/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { recortar, desenhar } from "./lib/glb.ts";
import { gerarPersonagem, jsonDoJogo, type PlanoPersonagem } from "./lib/personagem.ts";
import { decodificarAnim, poseClip, matrizesPose, deformarMalha, type DadosAnim } from "../src/render/gl/esqueleto.ts";

interface PlanoVariante extends PlanoPersonagem {
  variante: { base: string; anim: string; saidaAnim: string; cabecaJuntas?: string[] };
}

const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

async function poseT(plano: PlanoPersonagem) {
  const corpo = await recortar(plano.corpo.arquivo, plano.corpo.regiao, plano.texW, plano.cache);
  const cab = await recortar(plano.cabeca.arquivo, plano.cabeca.regiao, plano.texW, plano.cache);
  return { h: await gerarPersonagem(plano, corpo, cab, { tpose: true }), corpo, cab };
}

async function main() {
  const args = process.argv.slice(2);
  const plano = JSON.parse(
    readFileSync(
      args.find((a) => !a.startsWith("--"))!,
      "utf8",
    ),
  ) as PlanoVariante;
  const V = plano.variante;
  const base = JSON.parse(readFileSync(V.base, "utf8")) as PlanoPersonagem;
  const dados = JSON.parse(readFileSync(V.anim, "utf8")) as DadosAnim;
  const A = decodificarAnim(dados);
  const nA = A.P.length / 3;

  /* encaixe: pose T da base (espaço do jogo, sem escala do rig) → vértices de bind do animado */
  const tb = (await poseT(base)).h.pecas.torso.p;
  const maxY = (p: ArrayLike<number>) => {
    let m = -1e9;
    for (let i = 1; i < p.length; i += 3) m = Math.max(m, p[i]);
    return m;
  };
  const media = (p: ArrayLike<number>, k: number) => {
    let s = 0;
    for (let i = k; i < p.length; i += 3) s += p[i];
    return s / (p.length / 3);
  };
  const S = maxY(A.P) / maxY(tb);
  const dx = media(A.P, 0) - media(tb, 0) * S,
    dz = media(A.P, 2) - media(tb, 2) * S;
  const enc = (p: ArrayLike<number>, i: number) => [p[i] * S + dx, p[i + 1] * S, p[i + 2] * S + dz];
  const maisPerto = (q: number[], ok?: (v: number) => boolean) => {
    let best = 0,
      bd = Infinity;
    for (let v = 0; v < nA; v++) {
      if (ok && !ok(v)) continue;
      const d = (A.P[v * 3] - q[0]) ** 2 + (A.P[v * 3 + 1] - q[1]) ** 2 + (A.P[v * 3 + 2] - q[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return { v: best, d: Math.sqrt(bd) };
  };
  {
    let soma = 0,
      pior = 0;
    const n = tb.length / 3;
    for (let i = 0; i < tb.length; i += 3 * 7) {
      const { d } = maisPerto(enc(tb, i));
      soma += d;
      pior = Math.max(pior, d);
    }
    console.log(
      `encaixe base → animado: escala ${S.toFixed(4)}, x ${dx.toFixed(2)}, z ${dz.toFixed(2)}; distância média ${(soma / Math.ceil(n / 7)).toFixed(3)}, pior ${pior.toFixed(3)} (altura ${maxY(A.P).toFixed(1)})`,
    );
  }

  /* variante: malha soldada com juntas e pesos copiados */
  const { h } = await poseT(plano);
  for (const l of h.info) console.log(l);
  const m = h.pecas.torso,
    nt = m.p.length / 9,
    corpoTris = h.corpoTris ?? nt;
  const domina = (v: number) => {
    let j = 0;
    for (let k = 1; k < 4; k++) if (A.W[v * 4 + k] > A.W[v * 4 + j]) j = k;
    return A.juntas[A.J[v * 4 + j]];
  };
  const juntasCab = new Set(V.cabecaJuntas ?? ["Head", "Neck"]);
  const daCabeca = (v: number) => juntasCab.has(domina(v));
  const chave = new Map<string, number>(),
    P: number[] = [],
    J: number[] = [],
    W: number[] = [],
    I: number[] = [];
  let somaCorpo = 0,
    nCorpo = 0;
  for (let t = 0; t < nt; t++)
    for (let k = 0; k < 3; k++) {
      const i = (t * 3 + k) * 3,
        q = enc(m.p, i);
      const ch = q.map((x) => Math.round(x * 1e3)).join(",");
      let u = chave.get(ch);
      if (u === undefined) {
        chave.set(ch, (u = P.length / 3));
        P.push(...q);
        const cab = t >= corpoTris,
          r = maisPerto(q, cab ? daCabeca : undefined);
        if (!cab) {
          somaCorpo += r.d;
          nCorpo++;
        }
        for (let a = 0; a < 4; a++) {
          J.push(A.J[r.v * 4 + a]);
          W.push(Math.round(A.W[r.v * 4 + a] * 255));
        }
        const s = W.slice(-4).reduce((a, b) => a + b, 0);
        W[W.length - 4] += 255 - s; // soma exata 255 (arredondamento)
      }
      I.push(u);
    }
  const nv = P.length / 3;
  if (nv > 65535) throw new Error("vértices demais para índice Uint16: " + nv);
  console.log(
    `variante: ${nv} vértices, ${nt} triângulos (${corpoTris} de corpo); distância média corpo → animado ${(somaCorpo / nCorpo).toFixed(3)}`,
  );
  const P16 = Int16Array.from(P, (x) => Math.round(x * 64)),
    C8 = new Uint8Array(nt * 3);
  for (let t = 0; t < nt; t++)
    for (let c = 0; c < 3; c++) C8[t * 3 + c] = Math.round(Math.min(1, Math.max(0, m.c[t * 9 + c])) * 255);
  const saida: DadosAnim = {
    ...dados,
    malha: {
      p: b64(P16),
      j: b64(Uint8Array.from(J)),
      w: b64(Uint8Array.from(W)),
      i: b64(Uint16Array.from(I)),
      c: b64(C8),
    },
  };
  const json = JSON.stringify(saida);

  /* prévias: alguns clips, 6 quadros de frente e de lado, com o código do jogo */
  const pasta = join(plano.previas, "anim");
  mkdirSync(pasta, { recursive: true });
  const B = decodificarAnim(JSON.parse(json) as DadosAnim);
  const N = 6,
    lado = 200,
    caixa = { mn: [-34, -2, -34], mx: [34, 46, 34] };
  // busto: caixa em volta da junta da cabeça em cada quadro (frente, lado e costas)
  for (const [nome, busto] of ["parada", "andar", "correr", "espada_0", "arco_puxar", "rolar"].flatMap((c) =>
    B.clips[c] ? ([[c, false], ...(c === "rolar" ? [] : [[c, true]])] as [string, boolean][]) : [],
  )) {
    const clip = B.clips[nome],
      tiles: { input: Buffer; left: number; top: number }[] = [];
    const nq = clip.n > 1 ? N : 1;
    for (let k = 0; k < nq; k++) {
      const pose = poseClip(B, nome, ((clip.n - 1) / clip.fps) * (k / Math.max(1, nq - 1)), false);
      const mp = matrizesPose(B, pose);
      const { p, c } = deformarMalha(B, mp);
      const G: number[] = [];
      for (let i = 0; i < p.length; i += 3) G.push(-p[i + 2], p[i + 1], p[i]);
      const Iq = Array.from({ length: G.length / 3 }, (_, i) => i);
      const cor = (t: number) => [c[t * 9] * 255, c[t * 9 + 1] * 255, c[t * 9 + 2] * 255];
      const j = B.juntas.indexOf("Head") * 16,
        cab = [-mp.glob[j + 14], mp.glob[j + 13] + 3, mp.glob[j + 12]];
      const caixaBusto = { mn: cab.map((q) => q - 9), mx: cab.map((q) => q + 9) };
      const vistas = busto ? (["frente", "lado", "costas"] as const) : (["frente", "lado"] as const);
      for (const [v, vista] of vistas.entries()) {
        const arq = join(pasta, "_q.png");
        // costas: gira a prévia 180° em volta do eixo vertical da cabeça
        const Gv = vista === "costas" ? G.map((q, i) => (i % 3 === 1 ? q : 2 * cab[i % 3] - q)) : G;
        await desenhar(arq, Gv, Iq, cor, {
          vista: vista === "costas" ? "frente" : vista,
          W: lado,
          caixaFixa: busto ? caixaBusto : caixa,
        });
        tiles.push({
          input: await sharp(arq).resize(lado, lado, { fit: "contain", background: "#262626" }).toBuffer(),
          left: k * lado,
          top: v * lado,
        });
      }
    }
    await sharp({ create: { width: lado * nq, height: lado * (busto ? 3 : 2), channels: 3, background: "#262626" } })
      .composite(tiles)
      .png()
      .toFile(join(pasta, nome + (busto ? "_busto" : "") + ".png"));
  }
  console.log(`prévias em ${pasta}`);
  if (args.includes("--simular")) return console.log("(simulação: os JSON do jogo não foram gravados)");
  writeFileSync(V.saidaAnim, json);
  console.log(`${V.saidaAnim}: ${(json.length / 1024).toFixed(0)} KB`);
  // peças rígidas da variante (o jogo usa nos estados sem clip e no retrato)
  const corpo = await recortar(plano.corpo.arquivo, plano.corpo.regiao, plano.texW, plano.cache);
  const cab = await recortar(plano.cabeca.arquivo, plano.cabeca.regiao, plano.texW, plano.cache);
  const rigida = jsonDoJogo(await gerarPersonagem(plano, corpo, cab));
  writeFileSync(plano.saida, rigida);
  console.log(`${plano.saida}: ${(rigida.length / 1024).toFixed(0)} KB`);
}

await main();
