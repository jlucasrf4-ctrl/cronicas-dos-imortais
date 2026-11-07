/* v8.1 — mais detalhe na heroína, Caçador e líder; deusas até 15.500, reservando espaço para equipamentos. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { reduzirPecaUV } from "./lib/peca.ts";
import type { DadosAnim } from "../src/render/gl/esqueleto.ts";

const ler = (nome: string) => JSON.parse(readFileSync(`tools/modelos/${nome}.json`, "utf8"));
const salvar = (nome: string, p: object) =>
  writeFileSync(`tools/modelos/${nome}.json`, JSON.stringify(p, null, 2) + "\n");
const rodar = (arq: string, ...args: string[]) =>
  execFileSync(process.execPath, ["--max-old-space-size=6144", arq, ...args], { stdio: "inherit" });
for (const nome of process.argv.includes("--so-deusas") ? [] : ["heroina", "cacador"]) {
  const plano = ler(nome);
  plano.orcamento = { cabeca: 4000, tronco: 4500, bracoD: 1500, bracoE: 1500, pernaD: 1750, pernaE: 1750 };
  salvar(nome, plano);
  rodar("tools/gerar-personagem.ts", `tools/modelos/${nome}.json`, "--tpose", `build/modelos/${nome}_detalhado_tpose`);
  const a = ler(nome + "_animacoes");
  a.vestir = `build/modelos/${nome}_detalhado_tpose/${nome}_tpose.glb`;
  a.ombroMedido = true;
  delete a.busto;
  salvar(nome + "_animacoes", a);
  rodar("tools/gerar-animacoes.ts", `tools/modelos/${nome}_animacoes.json`);
}
if (!process.argv.includes("--so-deusas")) {
  const lider = ler("lider_bandidos");
  lider.triangulos = 15000;
  salvar("lider_bandidos", lider);
  rodar("tools/pintar-modelo.ts", "tools/modelos/lider_bandidos.json");
  rodar("tools/gerar-animacoes.ts", "tools/modelos/lider_bandidos_animacoes.json");
}

mkdirSync("assets/fontes-personagens", { recursive: true });
const fonte = "assets/fontes-personagens/deusas.json";
if (!existsSync(fonte)) {
  const vestidos = JSON.parse(readFileSync("backups/personagens-2026-11-03/src/assets/models/vestidos.json", "utf8"));
  writeFileSync(fonte, JSON.stringify(vestidos.modelos.filter((v: { nome: string }) => v.nome.startsWith("deusa_"))));
}
const deusas = JSON.parse(readFileSync(fonte, "utf8")) as { nome: string; anim: DadosAnim }[];
const b64 = (v: ArrayBufferView) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
for (const { nome, anim: d } of deusas) {
  const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64")).buffer;
  const P = new Int16Array(bytes(d.malha.p)),
    I = new Uint16Array(bytes(d.malha.i));
  const J = new Uint8Array(bytes(d.malha.j)),
    W = new Uint8Array(bytes(d.malha.w)),
    C = new Uint8Array(bytes(d.malha.c));
  const UV = d.malha.uv ? new Uint16Array(bytes(d.malha.uv)) : null;
  const ids = new Map<string, number>(),
    origem: number[] = [],
    pos: number[] = [],
    attr: number[] = [],
    uv: number[] = [],
    cor: number[] = [];
  const indices = new Uint32Array(I.length);
  for (let k = 0; k < I.length; k++) {
    const v = I[k],
      t = Math.floor(k / 3),
      u = UV?.[k * 2] ?? 0,
      vv = UV?.[k * 2 + 1] ?? 0;
    const chave = `${v}|${u}|${vv}|${C[t * 3]},${C[t * 3 + 1]},${C[t * 3 + 2]}`;
    let id = ids.get(chave);
    if (id == null) {
      id = origem.length;
      ids.set(chave, id);
      origem.push(v);
      pos.push(P[v * 3] / 64, P[v * 3 + 1] / 64, P[v * 3 + 2] / 64);
      uv.push(u, vv);
      cor.push(C[t * 3], C[t * 3 + 1], C[t * 3 + 2]);
      attr.push(u / 65535, vv / 65535);
      for (let c = 0; c < 4; c++) attr.push(J[v * 4 + c] / 255, W[v * 4 + c] / 255);
      for (let c = 0; c < 3; c++) attr.push(C[t * 3 + c] / 255);
    }
    indices[k] = id;
  }
  const [lo] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    Float32Array.from(pos),
    3,
    Float32Array.from(attr),
    13,
    [1, 1, 4, 2, 4, 2, 4, 2, 4, 2, 1, 1, 1],
    null,
    15500 * 3,
    1,
  );
  const remap = new Map<number, number>(),
    pp: number[] = [],
    jj: number[] = [],
    ww: number[] = [],
    cc: number[] = [],
    uu: number[] = [],
    ii: number[] = [];
  for (let k = 0; k < lo.length; k++) {
    const id = lo[k],
      v = origem[id];
    let n = remap.get(id);
    if (n == null) {
      n = remap.size;
      remap.set(id, n);
      pp.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      for (let c = 0; c < 4; c++) {
        jj.push(J[v * 4 + c]);
        ww.push(W[v * 4 + c]);
      }
    }
    ii.push(n);
    uu.push(uv[id * 2], uv[id * 2 + 1]);
    if (k % 3 === 0) cc.push(cor[id * 3], cor[id * 3 + 1], cor[id * 3 + 2]);
  }
  const anterior = JSON.parse(readFileSync(`build/modelos/${nome}_anim.json`, "utf8")) as DadosAnim;
  if (lo.length / 3 > 15500) {
    // Costuras demais podem travar a redução. A projeção recupera os UVs sobre a superfície original.
    const np = new Float32Array(I.length * 3),
      nt = new Float32Array(I.length * 2);
    const porPosicao = new Map<string, number>();
    for (let v = 0; v < P.length / 3; v++) porPosicao.set(`${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`, v);
    for (let k = 0; k < I.length; k++) {
      for (let e = 0; e < 3; e++) np[k * 3 + e] = P[I[k] * 3 + e] / 64;
      const t = Math.floor(k / 3);
      nt[k * 2] = UV && d.tex ? UV[k * 2] / 65535 : ((t % 256) + 0.5) / 256;
      nt[k * 2 + 1] = UV && d.tex ? UV[k * 2 + 1] / 65535 : (Math.floor(t / 256) + 0.5) / 256;
    }
    const tex = d.tex
      ? await sharp(Buffer.from(d.tex.split(",")[1], "base64"))
          .resize(2048, 2048)
          .removeAlpha()
          .raw()
          .toBuffer()
      : Buffer.alloc(256 * 256 * 3);
    if (!d.tex) tex.set(C);
    const r = await reduzirPecaUV(
      { P: np, T: nt, I: Uint32Array.from(I, (_, k) => k), tex, texW: d.tex ? 2048 : 256 },
      15500,
    );
    pp.length = jj.length = ww.length = cc.length = uu.length = ii.length = 0;
    const mapa = new Map<number, number>();
    for (let k = 0; k < r.p.length / 3; k++) {
      const ponto = r.p.slice(k * 3, k * 3 + 3).map((v) => Math.round(v * 64));
      const v = porPosicao.get(ponto.join(","));
      if (v == null) throw new Error(`${nome}: vértice sem pesos na superfície original`);
      let n = mapa.get(v);
      if (n == null) {
        n = mapa.size;
        mapa.set(v, n);
        pp.push(...ponto);
        for (let e = 0; e < 4; e++) {
          jj.push(J[v * 4 + e]);
          ww.push(W[v * 4 + e]);
        }
      }
      ii.push(n);
      uu.push(Math.round(r.uv[k * 2] * 65535), Math.round(r.uv[k * 2 + 1] * 65535));
      if (k % 3 === 0) cc.push(...(d.tex ? [255, 255, 255] : r.c.slice(k, k + 3).map((v) => Math.round(v * 255))));
    }
  }
  if (pp.length / 3 > 65535 || ii.length / 3 > 15500) throw new Error(`${nome}: orçamento excedido (${ii.length / 3})`);
  const saida: DadosAnim = {
    ...d,
    clips: anterior.clips,
    malha: {
      p: b64(Int16Array.from(pp)),
      j: b64(Uint8Array.from(jj)),
      w: b64(Uint8Array.from(ww)),
      i: b64(Uint16Array.from(ii)),
      c: b64(Uint8Array.from(cc)),
      ...(UV ? { uv: b64(Uint16Array.from(uu)) } : {}),
    },
  };
  writeFileSync(`build/modelos/${nome}_anim.json`, JSON.stringify(saida));
  console.log(`${nome}: ${I.length / 3} → ${ii.length / 3} triângulos`);
}
