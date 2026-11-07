/** Busto integral no rig de um corpo: conserva pescoço/ombros originais e costura abdômen e braços.
 * node tools/integrar-busto.ts [plano] [--corpo=corpo_f02] [--cabeca=busto_02] [--publicar]
 * O padrão só gera em build/modelos. Publicar é uma etapa explícita após revisão das capturas. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { Matrix4 } from "three";
import { decodificarAnim, type Anim, type DadosAnim } from "../src/render/gl/esqueleto.ts";
import type { AparenciasDados, CabecaDados, CorpoDados } from "../src/render/gl/aparencias.ts";
import { caixa, recortar, subMalha, type Regiao } from "./lib/glb.ts";
import { reduzirPecaUV, type PecaBaixa } from "./lib/peca.ts";
import { reduzirComPrioridadeRosto } from "./lib/reduzir-rosto.ts";
import { segmentarCabeca } from "./lib/mascara_aparencias.ts";
import { reposicionarJuntas, transferirPesosBusto } from "./lib/rig-busto.ts";
import { ErroUniaoBusto, unirBustoIntegral } from "./lib/uniao-busto.ts";
import {
  harmonizarPeleInferior,
  suavizarTransicoes,
  type HarmonizacaoBusto,
  type SuavizacaoBusto,
} from "./lib/refinar-busto.ts";

type V3 = [number, number, number];
type V2 = [number, number];
interface Combinacao {
  corpo: string;
  cabeca: string;
  tris: number;
  proporcaoRosto: number;
  abaixoQueixoRosto: number;
  fonte: { eixoX: number; bracoY: number; bracoZ: number; narizZ: number; pescocoZ: number };
  destino: { bracoX: number; bracoY: number; eixoZ: number };
  esticarBase: { distancia: number; inicio: number; fim: number };
  cortes: { corpoY: number; bustoY: number; corpoBraco: number; bustoBraco: number; fimAjusteBase: number };
  amostrasAnel: number;
  harmonizarPele?: HarmonizacaoBusto;
  suavizar?: SuavizacaoBusto;
  preservarCabelo?: boolean;
}
interface Plano {
  aparencias: string;
  planoAparencias: string;
  saida: string;
  publicarEm: string;
  tamanhoTextura: number;
  rodapeTextura: number;
  qualidadeTextura: number;
  combinacoes: Combinacao[];
}
interface FonteCabeca {
  nome: string;
  tripo?: Regiao & { arquivo: string; textura?: string };
  olhos: number;
  queixo: number;
  manter?: number[][];
}
interface Pacote {
  corpo: string;
  cabeca: string;
  anim: DadosAnim;
  mascara: string;
  regiaoPele: string;
  refPele?: number[];
  refPeleInferior?: number[];
  refCabelo?: number[];
  relatorio: ReturnType<typeof unirBustoIntegral>["relatorio"];
  alinhamento: Record<string, unknown>;
}
const args = process.argv.slice(2);
const planoArquivo = args.find((a) => !a.startsWith("--")) ?? "tools/modelos/bustos-integrais.json";
const plano = JSON.parse(readFileSync(planoArquivo, "utf8")) as Plano;
const opcao = (nome: string) => args.find((a) => a.startsWith("--" + nome + "="))?.slice(nome.length + 3);
const dados = JSON.parse(readFileSync(plano.aparencias, "utf8")) as AparenciasDados;
const fontes = JSON.parse(readFileSync(plano.planoAparencias, "utf8")) as { cabecas: FonteCabeca[] };
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const suave = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Seção horizontal nas duas coordenadas restantes (x,z). */
function limitesCorte(P: ArrayLike<number>, I: ArrayLike<number>, altura: number) {
  const min: V2 = [Infinity, Infinity],
    max: V2 = [-Infinity, -Infinity];
  let cruzamentos = 0;
  for (let t = 0; t < I.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = I[t + k] * 3,
        b = I[t + ((k + 1) % 3)] * 3,
        ya = P[a + 1],
        yb = P[b + 1];
      if (ya < altura === yb < altura || ya === yb) continue;
      const f = (altura - ya) / (yb - ya);
      for (const [i, e] of [0, 2].entries()) {
        const v = P[a + e] + (P[b + e] - P[a + e]) * f;
        min[i] = Math.min(min[i], v);
        max[i] = Math.max(max[i], v);
      }
      cruzamentos++;
    }
  if (!cruzamentos) throw new Error("Corte sem seção em y=" + altura);
  return { min, max, cruzamentos };
}

function serializar(A: Anim, rig: DadosAnim): DadosAnim {
  const W = new Uint8Array(A.W.length);
  for (let v = 0; v < A.P.length / 3; v++) {
    const ps = [0, 1, 2, 3].map((k) => Math.round(A.W[v * 4 + k] * 255));
    // Corrige no maior peso: arredondar quatro pesos pequenos nunca estoura o Uint8.
    const maior = ps.indexOf(Math.max(...ps));
    ps[maior] += 255 - ps.reduce((a, b) => a + b, 0);
    if (ps.some((p) => p < 0 || p > 255)) throw new Error("Peso fora do intervalo no vértice " + v);
    W.set(ps, v * 4);
  }
  const P = Int16Array.from(A.P, (p) => {
    const q = Math.round(p * 64);
    if (q < -32768 || q > 32767) throw new Error("Posição excede Int16×64");
    return q;
  });
  return {
    ...rig,
    tex: A.tex,
    clips: {},
    malha: {
      p: b64(P),
      j: b64(A.J),
      w: b64(W),
      i: b64(A.I),
      c: b64(Uint8Array.from(A.C, (c) => Math.round(Math.max(0, Math.min(1, c)) * 255))),
      uv: A.UV ? b64(Uint16Array.from(A.UV, (u) => Math.round(Math.max(0, Math.min(1, u)) * 65535))) : undefined,
    },
  };
}

async function integrar(c: Combinacao, corpo: CorpoDados, cab: CabecaDados, fonteCab: FonteCabeca): Promise<Pacote> {
  if (!fonteCab.tripo) throw new Error("A cabeça precisa de uma fonte Tripo: " + c.cabeca);
  const cache = join(plano.saida, "cache-busto-integral", c.cabeca);
  mkdirSync(cache, { recursive: true });
  const { arquivo, ...regiao } = fonteCab.tripo;
  delete regiao.textura;
  const fonte = await recortar(arquivo, regiao, plano.tamanhoTextura, cache);
  const box = caixa(fonte.P),
    qRaw = box.mn[1] + fonteCab.queixo * (box.mx[1] - box.mn[1]);
  const olhoRaw = box.mn[1] + fonteCab.olhos * (box.mx[1] - box.mn[1]),
    uRaw = olhoRaw - qRaw;
  if (!(uRaw > 0)) throw new Error("Marcos inválidos de olhos/queixo: " + c.cabeca);
  const hash = createHash("sha256")
    .update(fonte.P)
    .update(fonte.I)
    .update(fonte.T)
    .update(fonte.tex)
    .digest("hex")
    .slice(0, 16);
  const cacheBaixo = join(cache, `rosto-prioritario-${hash}-${c.tris}-${c.proporcaoRosto}-${c.abaixoQueixoRosto}.json`);
  let baixo: PecaBaixa & { uv: number[] };
  if (existsSync(cacheBaixo)) baixo = JSON.parse(readFileSync(cacheBaixo, "utf8")) as typeof baixo;
  else {
    const cima: number[] = [],
      baixoTris: number[] = [],
      limite = qRaw - c.abaixoQueixoRosto;
    for (let t = 0; t < fonte.I.length / 3; t++) {
      const y =
        (fonte.P[fonte.I[t * 3] * 3 + 1] + fonte.P[fonte.I[t * 3 + 1] * 3 + 1] + fonte.P[fonte.I[t * 3 + 2] * 3 + 1]) /
        3;
      (y >= limite ? cima : baixoTris).push(t);
    }
    const cabeca = await reduzirComPrioridadeRosto(subMalha(fonte, cima), Math.round(c.tris * c.proporcaoRosto), {
      queixo:qRaw,olhos:olhoRaw,eixoX:c.fonte.eixoX,narizZ:c.fonte.narizZ,
    });
    const tronco = await reduzirPecaUV(subMalha(fonte, baixoTris), Math.round(c.tris * (1 - c.proporcaoRosto)), true);
    baixo = { p: [...cabeca.p, ...tronco.p], c: [...cabeca.c, ...tronco.c], uv: [...cabeca.uv, ...tronco.uv] };
    writeFileSync(cacheBaixo, JSON.stringify(baixo));
  }
  const escala = (corpo.encaixe.uTroca ?? corpo.encaixe.u) / uRaw;
  const TX = c.destino.bracoX - c.fonte.bracoZ * escala,
    TY = c.destino.bracoY - c.fonte.bracoY * escala;
  const queixoY = TY + qRaw * escala,
    olhosY = TY + olhoRaw * escala;
  const globais = corpo.semCabeca.ibm.map((m) => new Matrix4().fromArray(m).invert().elements);
  const junta = (nome: string): V3 => {
    const i = corpo.semCabeca.juntas.indexOf(nome);
    if (i < 0) throw new Error("Junta ausente: " + nome);
    return globais[i].slice(12, 15) as V3;
  };
  const head = junta("Head"),
    neck = junta("Neck"),
    narizX = TX + c.fonte.narizZ * escala;
  const alvos: Record<string, V3> = {
    Head: [
      narizX - ((corpo.encaixe.nariz - head[0]) * escala * uRaw) / corpo.encaixe.u,
      olhosY + head[1] - (corpo.encaixe.queixo + corpo.encaixe.u),
      c.destino.eixoZ,
    ],
    Neck: [TX + c.fonte.pescocoZ * escala, neck[1], c.destino.eixoZ],
  };
  for (const nome of ["LeftArm", "RightArm"]) {
    const p = junta(nome);
    alvos[nome] = [c.destino.bracoX, p[1], p[2]];
  }
  const rig = reposicionarJuntas(corpo.semCabeca, alvos);
  let A = decodificarAnim(rig);
  if (c.harmonizarPele && cab.refPele && corpo.mascara)
    A = harmonizarPeleInferior(A, Buffer.from(corpo.mascara, "base64"), cab.refPele, c.harmonizarPele);
  const pRaw: number[] = [],
    P: number[] = [],
    I: number[] = [],
    chaves = new Map<string, number>();
  for (let k = 0; k < baixo.p.length; k += 3) {
    const raw = baixo.p.slice(k, k + 3),
      chave = raw.map((v) => Math.round(v * 1e7)).join(",");
    let v = chaves.get(chave);
    if (v == null) {
      v = chaves.size;
      chaves.set(chave, v);
      pRaw.push(...raw);
      const y = TY + raw[1] * escala;
      P.push(
        TX + raw[2] * escala,
        y - c.esticarBase.distancia * (1 - suave(c.esticarBase.inicio, c.esticarBase.fim, y)),
        c.destino.eixoZ - (raw[0] - c.fonte.eixoX) * escala,
      );
    }
    I.push(v);
  }
  const normalizadas = Int16Array.from(pRaw, (p, i) =>
    Math.round(((i % 3 === 0 ? p - c.fonte.eixoX : i % 3 === 1 ? p - qRaw : p - c.fonte.narizZ) / uRaw) * 1000),
  );
  const mascaraBusto = segmentarCabeca(
    normalizadas,
    I,
    Uint8Array.from(baixo.c, (v) => Math.round(v * 255)),
    cab,
    fonteCab.manter,
  );
  // A máscara de cabeça não semeia todo o peito. Fora da região facial, só completa cores próximas à pele.
  // Olhos, delineado, enfeites e os demais zeros continuam intactos.
  if (cab.refPele)
    for (let t = 0; t < I.length / 3; t++) {
      if (mascaraBusto[t] !== 0) continue;
      const y = (pRaw[I[t * 3] * 3 + 1] + pRaw[I[t * 3 + 1] * 3 + 1] + pRaw[I[t * 3 + 2] * 3 + 1]) / 3;
      const distanciaCor = Math.hypot(...[0, 1, 2].map((e) => baixo.c[t * 3 + e] * 255 - cab.refPele![e]));
      if (y < qRaw - 0.035 && distanciaCor < 95) mascaraBusto[t] = 1;
    }
  const partes = new Uint8Array(P.length / 3);
  for (let t = 0; t < I.length / 3; t++)
    for (let k = 0; k < 3; k++) partes[I[t * 3 + k]] |= mascaraBusto[t] === 2 ? 2 : 1;
  // O alongamento da base pertence à pele. Cabelo comprido mantém a altura original.
  for (let v = 0; v < P.length / 3; v++)
    if (partes[v] & 2) P[v * 3 + 1] = TY + pRaw[v * 3 + 1] * escala;
  const indicesPele: number[] = [];
  for (let t = 0; t < I.length / 3; t++)
    if (mascaraBusto[t] !== 2) indicesPele.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
  const bb = limitesCorte(A.P, A.I, c.cortes.corpoY),
    nb = limitesCorte(P, indicesPele, c.cortes.bustoY);
  for (let v = 0; v < P.length / 3; v++) {
    if (partes[v] & 2) continue;
    const f = 1 - suave(c.cortes.bustoY, c.cortes.fimAjusteBase, P[v * 3 + 1]);
    for (const [i, e] of [0, 2].entries()) {
      const destino = bb.min[i] + ((P[v * 3 + e] - nb.min[i]) / (nb.max[i] - nb.min[i])) * (bb.max[i] - bb.min[i]);
      P[v * 3 + e] += (destino - P[v * 3 + e]) * f;
    }
  }
  const pesos = transferirPesosBusto(
    A,
    P,
    { queixoY, basePescocoY: neck[1], eixoZ: c.destino.eixoZ },
    Uint8Array.from(partes, (p) => (p === 2 ? 1 : 0)),
  );
  const lado = plano.tamanhoTextura,
    altura = lado + plano.rodapeTextura,
    atlas = Buffer.alloc(lado * altura * 3, 255);
  fonte.tex.copy(atlas);
  const imagem = await sharp(atlas, { raw: { width: lado, height: altura, channels: 3 } })
    .webp({ quality: plano.qualidadeTextura })
    .toBuffer();
  const textura = "data:image/webp;base64," + imagem.toString("base64"),
    branco: V2 = [0.5, (lado + plano.rodapeTextura / 2) / altura];
  A.UV = Float32Array.from({ length: A.I.length * 2 }, (_, i) => branco[i % 2]);
  A.tex = textura;
  const nv = P.length / 3,
    ini = new Uint32Array(nv + 1);
  for (const v of I) ini[v + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const pos = ini.slice(0, nv),
    cantos = new Uint32Array(I.length);
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  const B: Anim = {
    ...A,
    P: Float32Array.from(P),
    I: Uint16Array.from(I),
    J: pesos.J,
    W: pesos.W,
    C: new Float32Array(I.length).fill(1),
    UV: Float32Array.from(baixo.uv, (u, i) => (i % 2 ? (u * lado) / altura : u)),
    ini,
    cantos,
  };
  const uniao = unirBustoIntegral(A, B, {
    cinturaCorpo: c.cortes.corpoY,
    cinturaBusto: c.cortes.bustoY,
    bracoCorpo: c.cortes.corpoBraco,
    bracoBusto: c.cortes.bustoBraco,
    branco,
    corBusto: cab.refPele?.map((v) => v / 255) as V3 | undefined,
    amostrasAnel: c.amostrasAnel,
    alturaMinBracos: c.destino.bracoY - 3.5,
    preservarTriangulosBusto: c.preservarCabelo === false ? undefined : Uint8Array.from(mascaraBusto, (p) => (p === 2 ? 1 : 0)),
  });
  const mascaraCorpo = corpo.mascara ? Buffer.from(corpo.mascara, "base64") : new Uint8Array(A.I.length / 3);
  const mascara = Uint8Array.from(uniao.origemTriangulos, (origem, t) =>
    origem === 0 ? mascaraCorpo[uniao.triangulosFonte[t]] : origem === 1 ? mascaraBusto[uniao.triangulosFonte[t]] : 1,
  );
  const malha = c.suavizar ? suavizarTransicoes(uniao.malha, c.suavizar) : uniao.malha;
  return {
    corpo: c.corpo,
    cabeca: c.cabeca,
    anim: serializar(malha, rig),
    mascara: b64(mascara),
    regiaoPele: b64(uniao.origemTriangulos),
    refPele: cab.refPele,
    refPeleInferior: c.harmonizarPele ? cab.refPele : (corpo.refPeleCorpo ?? corpo.refPele),
    refCabelo: cab.refCabelo,
    relatorio: uniao.relatorio,
    alinhamento: { escala, TX, TY, queixoY, olhosY, alvos, limitesCorpo: bb, limitesBustoAntes: nb },
  };
}

const selecionadas = plano.combinacoes.filter(
  (c) => (!opcao("corpo") || c.corpo === opcao("corpo")) && (!opcao("cabeca") || c.cabeca === opcao("cabeca")),
);
if (!selecionadas.length) throw new Error("Nenhuma combinação do plano corresponde à seleção.");
if (new Set(selecionadas.map(c=>c.corpo+"|"+c.cabeca)).size !== selecionadas.length)
  throw new Error("O plano contém combinações duplicadas.");
mkdirSync(plano.saida, { recursive: true });
for (const c of selecionadas) {
  const corpo = dados.corpos?.find((x) => x.nome === c.corpo),
    cab = dados.cabecas?.find((x) => x.nome === c.cabeca),
    fonte = fontes.cabecas.find((x) => x.nome === c.cabeca);
  if (!corpo || !cab || !fonte) throw new Error("Corpo/cabeça ausente: " + c.corpo + "/" + c.cabeca);
  const destino = join(plano.saida, `busto_integral_${c.corpo}__${c.cabeca}.json`);
  try {
    const pacote = await integrar(c, corpo, cab, fonte);
    writeFileSync(destino, JSON.stringify(pacote));
    console.log(
      destino +
        ": " +
        pacote.relatorio.triangulos +
        " triângulos; " +
        pacote.relatorio.contornos.length +
        " contornos fechados.",
    );
    if (args.includes("--publicar")) {
      const caminho = resolve(plano.publicarEm);
      const atual = existsSync(caminho)
        ? (JSON.parse(readFileSync(caminho, "utf8")) as { combinacoes: Pacote[] })
        : { combinacoes: [] };
      atual.combinacoes = atual.combinacoes.filter((v) => v.corpo !== c.corpo || v.cabeca !== c.cabeca);
      atual.combinacoes.push(pacote);
      mkdirSync(dirname(caminho), { recursive: true });
      writeFileSync(caminho, JSON.stringify(atual));
      console.log("Publicado: " + caminho);
    }
  } catch (erro) {
    if (erro instanceof ErroUniaoBusto)
      writeFileSync(destino.replace(/\.json$/, "-falha.json"), JSON.stringify(erro.relatorio, null, 2));
    throw erro;
  }
}
