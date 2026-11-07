/* v8.1 — orçamento, integridade das malhas e custo do skinning no mesmo código usado pelo jogo. */
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  decodificarAnim,
  poseClip,
  matrizesPose,
  deformarMalha,
  normaisSuaves,
  type DadosAnim,
  type Anim,
} from "../src/render/gl/esqueleto.ts";
import { peleDaAparencia, cabeNoCorpo, type AparenciasDados } from "../src/render/gl/aparencias.ts";
import { SMOOTH_COS } from "../src/render/gl/geometria.ts";
import { ORCAMENTO_PERSONAGEM } from "./lib/orcamento-personagem.ts";

const pacote = JSON.parse(readFileSync("src/assets/models/vestidos.json", "utf8")) as {
  modelos: {
    nome: string;
    rotulo: string;
    interno?: boolean;
    anim?: DadosAnim;
    proprio?: boolean;
    partes?: Record<string, DadosAnim>;
  }[];
  texturas?: Record<string, string>;
};
const aparencias = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
const bustos = JSON.parse(readFileSync("src/assets/models/bustos-integrais.json", "utf8")) as NonNullable<
  Parameters<typeof peleDaAparencia>[2]
>["bustos"];
const heroina = JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim;
const cacador = JSON.parse(readFileSync("src/assets/models/cacador_anim.json", "utf8")) as DadosAnim;
const problemas: string[] = [],
  linhas: object[] = [];
const validar = (nome: string, dados: DadosAnim | Anim) => {
  const bruto = "P" in dados ? null : dados;
  const A =
      "P" in dados
        ? dados
        : decodificarAnim(dados.texDe ? { ...dados, tex: pacote.texturas?.[dados.texDe] ?? dados.tex } : dados),
    nv = A.P.length / 3,
    nt = A.I.length / 3;
  if (nt > ORCAMENTO_PERSONAGEM.total) problemas.push(`${nome}: ${nt} triângulos`);
  if (A.C.length !== A.I.length || A.J.length !== nv * 4 || A.W.length !== nv * 4)
    problemas.push(`${nome}: dimensões inválidas`);
  if (A.UV && A.UV.length !== nt * 6) problemas.push(`${nome}: UVs inválidos`);
  if (bruto?.texDe && !A.tex) problemas.push(`${nome}: textura ausente`);
  if (!A.P.every(Number.isFinite)) problemas.push(`${nome}: posição de repouso inválida`);
  for (const i of A.I)
    if (i >= nv) {
      problemas.push(`${nome}: índice fora da malha`);
      break;
    }
  for (let v = 0; v < nv; v++) {
    let soma = 0;
    for (let k = 0; k < 4; k++) {
      soma += A.W[v * 4 + k];
      if (A.W[v * 4 + k] && A.J[v * 4 + k] >= A.juntas.length) problemas.push(`${nome}: junta inválida`);
    }
    if (Math.abs(soma - 1) > 0.005) {
      problemas.push(`${nome}: pesos não normalizados (${soma})`);
      break;
    }
  }
  const clips = Object.keys(A.clips).length ? A : decodificarAnim(heroina);
  for (const clip of Object.keys(clips.clips)) {
    const pose = poseClip(clips, clip, Math.min(0.3, (clips.clips[clip].n - 1) / clips.clips[clip].fps / 2), false);
    const def = deformarMalha(A, matrizesPose(A, pose));
    if (!def.p.every(Number.isFinite)) problemas.push(`${nome}: posição inválida em ${clip}`);
  }
  linhas.push({ nome, triangulos: nt, vertices: nv, movimentos: Object.keys(clips.clips).length });
  return A;
};
validar("heroina", heroina);
validar("cacador", cacador);
for (const v of pacote.modelos) {
  if (v.anim) validar(v.nome, v.anim);
  for (const [nome, d] of Object.entries(v.partes ?? {})) validar(v.nome + "/" + nome, d);
}
const armas = JSON.parse(readFileSync("src/assets/models/armas.json", "utf8")) as Record<string, { i: string }>;
const trisArma = (nome: string) => Buffer.from(armas[nome].i, "base64").length / 6;
const armaMax = Math.max(
  ...Object.keys(armas)
    .filter((n) => n !== "eq_escudo")
    .map(trisArma),
);
const equipamento = armaMax + trisArma("eq_escudo") + trisArma("eq_arco_longo");
for (const v of pacote.modelos) {
  if (!v.anim || v.proprio) continue;
  const total = Buffer.from(v.anim.malha.i, "base64").length / 6 + equipamento;
  if (total > ORCAMENTO_PERSONAGEM.total)
    problemas.push(`${v.nome}: modelo vestido com armas excede o teto (${total})`);
}
const combinacoes = [];
for (const c of aparencias.corpos ?? []) {
  if (!c.cabecaPadrao) continue;
  const combinacoesCorpo = [];
  for (const h of aparencias.cabecas ?? []) {
    if (!cabeNoCorpo(c, h)) continue;
    const visual = { corpo: c.nome, cabeca: h.nome };
    const pele = peleDaAparencia(visual, () => null, { aparencias, bustos });
    if (!pele) {
      problemas.push(`${c.nome}/${h.nome}: montagem ausente`);
      continue;
    }
    const A = validar(`${c.nome}/${h.nome}`, pele);
    const roupa = { peito: 0, pernas: 0, pes: 0 };
    for (const estilo of ["aventureira", "deserto", "patrulheira", "placa"]) {
      const especifica = pacote.modelos.find((v) => v.nome === `${c.nome}__${h.nome}__${estilo}`);
      const v = especifica?.partes ? especifica : pacote.modelos.find((v) => v.nome === `${c.nome}__${estilo}`);
      for (const p of ["peito", "pernas", "pes"] as const)
        if (v?.partes?.[p]) roupa[p] = Math.max(roupa[p], Buffer.from(v.partes[p].malha.i, "base64").length / 6);
    }
    combinacoesCorpo.push({
      cabeca: h.nome,
      corpoECabeca: A.I.length / 3,
      roupa,
      maximoCompleto: A.I.length / 3 + roupa.peito + roupa.pernas + roupa.pes + equipamento,
    });
  }
  const propria = combinacoesCorpo.find((v) => v.cabeca === c.cabecaPadrao);
  if (!propria) {
    problemas.push(`${c.nome}: cabeça padrão ausente`);
    continue;
  }
  const { roupa, maximoCompleto: total } = propria;
  const qualquerCabeca = Math.max(...combinacoesCorpo.map((v) => v.maximoCompleto));
  combinacoes.push({
    corpo: c.nome,
    corpoECabeca: propria.corpoECabeca,
    roupa,
    equipamento,
    maximoCompleto: total,
    maximoComQualquerCabeca: qualquerCabeca,
    cabecasConferidas: combinacoesCorpo.length,
    detalhes: combinacoesCorpo,
  });
  if (total > ORCAMENTO_PERSONAGEM.total) problemas.push(`${c.nome}: combinação máxima ${total} triângulos`);
  if (qualquerCabeca > ORCAMENTO_PERSONAGEM.total)
    problemas.push(`${c.nome}: cabeça alternativa excede o orçamento (${qualquerCabeca})`);
}
function medir(A: Anim, clips: Anim) {
  let def: ReturnType<typeof deformarMalha> | undefined;
  const V = new Float32Array(A.P.length),
    NS = new Float32Array(A.I.length * 3),
    HS = new Float32Array(A.I.length * 3),
    tempos: number[] = [];
  for (let f = 0; f < 50; f++) {
    const pose = poseClip(clips, "andar", f / 30, true),
      inicio = performance.now();
    def = deformarMalha(A, matrizesPose(A, pose), def, V);
    normaisSuaves(A, def.n, SMOOTH_COS, NS, HS);
    if (f > 9) tempos.push(performance.now() - inicio);
  }
  tempos.sort((a, b) => a - b);
  return { medianaMs: +tempos[20].toFixed(3), p95Ms: +tempos[38].toFixed(3) };
}
const anterior = JSON.parse(readFileSync("backups/personagens-2026-11-03/src/assets/models/vestidos.json", "utf8"));
const clips = decodificarAnim(heroina);
const desempenho = {
  antes: medir(decodificarAnim(anterior.modelos.find((v: { nome: string }) => v.nome === "corpo_f01").anim), clips),
  depois: medir(decodificarAnim(pacote.modelos.find((v) => v.nome === "corpo_f01")!.anim!), clips),
  observacao: "Skinning e normais na CPU; não mede FPS, renderização WebGL ou desempenho em outros computadores.",
};
const relatorio = { modelos: linhas, combinacoes, desempenho, problemas };
writeFileSync("build/personagens/auditoria.json", JSON.stringify(relatorio, null, 2));
console.log(JSON.stringify({ malhas: linhas.length, combinacoes, desempenho, problemas }, null, 2));
if (problemas.length) process.exitCode = 1;
