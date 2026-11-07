/* v7.7 — gera um personagem low poly a partir dos .glb do Tripo (corpo de uma folha + cabeça de alta qualidade).
   Planos em tools/modelos/: heroina.json (o herói do jogo → src/assets/models/heroina.json) e cacador.json.

   Uso:  node tools/gerar-personagem.ts [plano.json] [--ajuste k=v,k=v] [--simular] [--tpose [pasta]]
   `--tpose`: em vez das peças do jogo, o personagem inteiro numa malha só em pose T (para rigging no Mixamo/Blender),
   em .glb e .obj/.mtl/.png, com a `altura` do plano em metros, frente +Z (padrão: build/modelos/<nome>_tpose).
   O plano (padrão tools/modelos/heroina.json) diz de onde vêm o corpo e a cabeça, os marcos do modelo, quantos
   triângulos cada peça leva e os `ajustes` aprovados (o que cada um faz: cabeçalho de tools/lib/personagem.ts).
   `--ajuste` sobrepõe ajustes só nesta rodada, para experimentar (ex.: --ajuste ombro=0.58,abre=13);
   `--simular` gera as prévias sem gravar o JSON do jogo. Prévias (frente, lado, andando, rosto) e cache dos recortes
   ficam em build/modelos/. A 1ª rodada lê os .glb (~1 min); as seguintes usam o cache (segundos). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recortar, desenhar } from "./lib/glb.ts";
import { gerarPersonagem, jsonDoJogo, type Personagem, type PlanoPersonagem } from "./lib/personagem.ts";
import { exportarMalha } from "./lib/exportar.ts";

/** Monta as peças na pose dada (como o renderer) e desenha frente/lado; "parada" também desenha o rosto. */
async function previas(h: Personagem, pasta: string) {
  mkdirSync(pasta, { recursive: true });
  const rz = (a: number, x: number, y: number, z: number) => [
    x * Math.cos(a) - y * Math.sin(a),
    x * Math.sin(a) + y * Math.cos(a),
    z,
  ];
  for (const [nome, pose] of [
    ["parada", { perna: 0, braco: 0.08 }],
    ["andando", { perna: 0.45, braco: 0.5 }],
  ] as const) {
    const G: number[] = [],
      C: number[] = [];
    const add = (m: { p: number[]; c: number[] }, f: (x: number, y: number, z: number) => number[]) => {
      for (let i = 0; i < m.p.length; i += 3) {
        const q = f(m.p[i], m.p[i + 1], m.p[i + 2]);
        G.push(-q[2], q[1], q[0]); // jogo (frente +x) → vista da prévia (frente +z)
        C.push(m.c[i], m.c[i + 1], m.c[i + 2]);
      }
    };
    const { torso, bracoD, bracoE, pernaD, pernaE } = h.pecas;
    add(torso, (x, y, z) => [x, y, z]);
    add(pernaD, (x, y, z) => rz(pose.perna, x, y, z).map((v, k) => v + [0, 15, 2.8][k]));
    add(pernaE, (x, y, z) => rz(-pose.perna, x, y, z).map((v, k) => v + [0, 15, -2.8][k]));
    add(bracoD, (x, y, z) => rz(-pose.braco, x, y, z).map((v, k) => v + [0, h.ombroY, h.ombroZ][k]));
    add(bracoE, (x, y, z) => rz(pose.braco, x, y, z).map((v, k) => v + [0, h.ombroY, -h.ombroZ][k]));
    const I = Array.from({ length: G.length / 3 }, (_, i) => i);
    const cor = (t: number) => [C[t * 9] * 255, C[t * 9 + 1] * 255, C[t * 9 + 2] * 255];
    await desenhar(join(pasta, `${nome}_frente.png`), G, I, cor, { vista: "frente", W: 500 });
    await desenhar(join(pasta, `${nome}_lado.png`), G, I, cor, { vista: "lado", W: 500 });
    if (nome === "parada") {
      const sel: number[] = [];
      for (let t = 0; t < I.length / 3; t++)
        if (Math.min(G[t * 9 + 1], G[t * 9 + 4], G[t * 9 + 7]) > h.ombroY + 1) sel.push(t * 3, t * 3 + 1, t * 3 + 2);
      await desenhar(join(pasta, "rosto.png"), G, sel, (t) => cor(sel[t * 3] / 3), {
        vista: "frente",
        W: 500,
        caixaFixa: { mn: [-7, h.ombroY + 1, -50], mx: [7, h.ombroY + 13, 50] },
      });
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const ia = args.indexOf("--ajuste");
  const valorDe = (i: number) => i > 0 && ["--ajuste", "--tpose"].includes(args[i - 1]);
  const arqPlano = args.find((a, i) => !a.startsWith("--") && !valorDe(i)) ?? "tools/modelos/heroina.json";
  const plano = JSON.parse(readFileSync(arqPlano, "utf8")) as PlanoPersonagem;
  if (ia >= 0)
    for (const kv of (args[ia + 1] ?? "").split(",").filter(Boolean)) {
      const [k, v] = kv.split("=");
      plano.ajustes[k] = Number(v);
    }
  const t0 = Date.now();
  const corpo = await recortar(plano.corpo.arquivo, plano.corpo.regiao, plano.texW, plano.cache);
  const cab = await recortar(plano.cabeca.arquivo, plano.cabeca.regiao, plano.texW, plano.cache);
  console.log(`recortes: corpo ${corpo.I.length / 3} e cabeça ${cab.I.length / 3} triângulos (${Date.now() - t0} ms)`);
  const it = args.indexOf("--tpose");
  if (it >= 0) {
    // pose T para rigging: uma malha só, exportada em .glb e .obj (+ .mtl/.png) na pasta dada
    const nome = (plano.nome ?? "heroina") + "_tpose";
    const pasta = args[it + 1] && !args[it + 1].startsWith("--") ? args[it + 1] : `build/modelos/${nome}`;
    const h = await gerarPersonagem(plano, corpo, cab, { tpose: true });
    for (const l of h.info) console.log(l);
    mkdirSync(pasta, { recursive: true });
    const r = await exportarMalha(h.pecas.torso, pasta, nome, plano.altura ?? 1.7);
    const G: number[] = [],
      m = h.pecas.torso;
    for (let i = 0; i < m.p.length; i += 3) G.push(-m.p[i + 2], m.p[i + 1], m.p[i]);
    const I = Array.from({ length: G.length / 3 }, (_, i) => i);
    const cor = (t: number) => [m.c[t * 9] * 255, m.c[t * 9 + 1] * 255, m.c[t * 9 + 2] * 255];
    await desenhar(join(pasta, "previa_frente.png"), G, I, cor, { W: 700 });
    const busto = { mn: [-9, h.ombroY - 6, -50], mx: [9, h.ombroY + 13, 50] };
    await desenhar(join(pasta, "previa_busto.png"), G, I, cor, { W: 500, caixaFixa: busto });
    return console.log(`pose T em ${pasta}: ${JSON.stringify(r)}`);
  }
  const h = await gerarPersonagem(plano, corpo, cab);
  for (const l of h.info) console.log(l);
  await previas(h, plano.previas);
  console.log(`prévias em ${plano.previas}`);
  if (args.includes("--simular")) return console.log("(simulação: o JSON do jogo não foi gravado)");
  const json = jsonDoJogo(h);
  writeFileSync(plano.saida, json);
  console.log(`${plano.saida}: ${(json.length / 1024).toFixed(0)} KB (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

await main();
