/* v8.0 — as aparências sorteadas dos personagens novos (src/render/gl/aparencias.ts): cada corpo sem a cabeça, no
   esqueleto da heroína, e as cabeças trocáveis, num JSON do jogo (src/assets/models/aparencias.json).
   Uso:  node tools/gerar-aparencias.ts [plano]          (padrão tools/modelos/aparencias.json)
         node tools/gerar-aparencias.ts [plano] --grade  (folhas com grade para ler olhos e queixo; ver abaixo)
   Corpos: a malha animada (gerar-animacoes / vestidos) perde a cabeça — pelas peças do .glb do Tripo (<nome>_pecas.json
   de tools/pintar-modelo.ts, na mesma ordem de triângulos) ou, sem peças, pelo peso da junta Head acima do queixo.
   Cabeças: os .glb de tools/modelos/cabecas.json (já reduzidos) ou uma das 4 cabeças das deusas (o .glb do Tripo com
   textura, reduzido aqui com a cor por vértice). O pescoço e o peito do busto saem (abaixo do queixo, no meio).
   v8.1 — `tripo`: uma cabeça de uma folha do Tripo com textura reduzida guardando o UV (as masculinas); a textura da
   folha vai uma vez só (`texturas`). `sexo: "m"` nos corpos e cabeças masculinos: só se juntam os do mesmo sexo.
   Olhos e queixo: lidos à mão nas folhas do --grade (fração da altura da cabeça; nos corpos, da faixa recortada,
   impressa ao gerar) — a detecção automática se perdia com franja e cabelo na frente do rosto. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { MeshoptSimplifier } from "meshoptimizer";
import { recortar, amostra, desenhar, soldar } from "./lib/glb.ts";
import { reduzirPecaUV } from "./lib/peca.ts";
import { reduzirComPrioridadeRosto } from "./lib/reduzir-rosto.ts";
import { decodificarAnim, type Anim, type DadosAnim } from "../src/render/gl/esqueleto.ts";
import {
  cabeNoCorpo,
  comporPele,
  type CabecaDados,
  type CorpoDados,
  type Encaixe,
} from "../src/render/gl/aparencias.ts";
import { PARTE, alisarPele, dE, lab } from "./lib/mascara.ts";
import { estabilizarBusto } from "./lib/pesos-tronco.ts";
import { refinarOmbrosModelo } from "./lib/refinar-ombros.ts";
import { segmentarCabeca, segmentarCorpo } from "./lib/mascara_aparencias.ts";

import { limparIlhasPescoco, type LimpezaPescoco } from "./lib/limpar-pescoco.ts";

import { limparFragmentosCabeca, type LimpezaFragmentosCabeca } from "./lib/limpar-fragmentos-cabeca.ts";

interface Plano {
  saida: string;
  previas: string;
  trisCabeca: number;
  /** v8.1 — até onde (u abaixo do queixo) o pescoço das cabeças trocáveis vai (padrão 0,5) */
  pescoco?: number;
  /** v8.1 — quantos u (olhos→queixo) da cabeça trocada cabem do chão ao queixo, em todo corpo (sem: o u da cabeça
   *  própria de cada corpo) */
  proporcao?: number;
  /** v8.1 — qualidade (webp) das texturas das cabeças pintadas */
  qualidadeTextura?: number;
  tamanhoTextura?: number;
  /** v8.1 — alisar a pele do rosto das cabeças trocáveis (tools/lib/mascara.ts alisarPele) */
  alisar?: { voltas: number; lambda: number; mu: number; voltasCor: number; pesoCor: number; tolCor: number };
  corpos: {
    nome: string;
    rotulo: string;
    anim: string;
    peso: number;
    pesoPropria: number;
    cabecaPadrao?: string;
    limparIlhasPescoco?: LimpezaPescoco;
    /** v8.1 — "m": corpo masculino (só cabeça masculina) */
    sexo?: string;
    /** peças da cabeça (índices de malha do .glb do Tripo) e o arquivo de peças por triângulo */
    pecas?: string;
    pecasCabeca?: number[];
    /** faixa recortada para a grade (y no espaço do jogo) e as marcas lidas nela (fração da faixa) */
    faixa: number[];
    olhos: number;
    queixo: number;
    /** v8.1 — tira também o cabelo comprido do corpo (pela cor) até tantos `u` abaixo do queixo */
    tirarCabelo?: number;
    /** a cor do cabelo (rgb), quando a do topo da cabeça engana (a coroa dourada da outono nova) */
    corCabelo?: number[];
    /** v8.1 — o cabelo nunca troca de cor (como nas cabeças) */
    cabeloFixo?: boolean;
    /** v8.1 — até quantos u abaixo do queixo o cabelo próprio desce (o tingimento; padrão tirarCabelo ou 1): o rabo
     *  comprido da líder cai até a cintura */
    cabeloDesce?: number;
    /** v8.1 — os restos da pintura projetada (pintar-modelo) cercados de pele viram pele: as manchas no quadril da
     *  líder. Não nas deusas: lá os desenhos no corpo são de propósito */
    limparManchas?: boolean;
    /** v8.1 — as peças do Tripo (`pecas`) que são o cabelo: o que nelas fica a até `pecasCabeloTol` (ΔE) da cor do
     *  cabelo é cabelo (a fita vermelha do rabo da líder fica) */
    pecasCabelo?: number[];
    pecasCabeloTol?: number;
  }[];
  cabecas: {
    nome: string;
    rotulo: string;
    peso: number;
    glb?: string;
    /** uma cabeça do .glb das deusas: o arquivo e a faixa de x */
    deusa?: { arquivo: string; xMin: number; xMax: number };
    /** v8.1 — uma cabeça de uma folha do Tripo com textura, com o UV: o arquivo, a faixa de x e o nome da textura
     *  compartilhada pelas cabeças da mesma folha */
    tripo?: { arquivo: string; xMin: number; xMax: number; yMin?: number; yMax?: number; textura: string };
    /** v8.1 — "m": cabeça masculina (só em corpo masculino) */
    sexo?: string;
    /** v8.1 — estica o pescoço abaixo do queixo (× este fator): o das cabeças masculinas era curto e não chegava à
     *  abertura do pescoço do corpo (um vão escuro na frente) */
    alongarPescoco?: number;
    /** Busto com peito e braços: mantém só cabeça, cabelo e a união do pescoço. */
    busto?: boolean;
    /** Remove só ilhas inteiramente abaixo do queixo, com calibração individual. */
    limparFragmentos?: LimpezaFragmentosCabeca;
    olhos: number;
    queixo: number;
    /** a cor do cabelo (rgb), quando a do topo engana (coroa, flores) */
    corCabelo?: number[];
    /** v8.1 — enfeites da cor do cabelo que o tingimento não pode pegar: [r, g, b, ΔE] (tools/lib/mascara_aparencias.ts) */
    manter?: number[][];
    /** v8.1 — o cabelo nunca troca de cor (a coroa do sol da deusa do verão está soldada nele, da mesma cor) */
    cabeloFixo?: boolean;
  }[];
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const plano = JSON.parse(readFileSync(args[0] ?? "tools/modelos/aparencias.json", "utf8")) as Plano;
const GRADE = process.argv.includes("--grade");
mkdirSync(plano.previas, { recursive: true });
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

/** triângulos soltos (9 números cada, vista de frente: x à direita de quem olha, z para a frente) e cor (0..255) */
interface Solta {
  P: number[];
  C: number[][];
  /** v8.1 — a pintura como textura (tools/pintar-modelo.ts `textura`): onde os cantos de cada triângulo caem nela
   *  (0..1; null = só a cor por triângulo) e a imagem */
  uv?: (number[] | null)[];
  tex?: Buffer;
  /** v8.1 — a textura é a da folha inteira do Tripo (rgb cru, lado × lado), compartilhada pela `chave` */
  folha?: { chave: string; raw: Buffer; lado: number };
}
const ctr = (P: ArrayLike<number>, t: number, e: number) => (P[t * 9 + e] + P[t * 9 + 3 + e] + P[t * 9 + 6 + e]) / 3;
const faixaY = (P: ArrayLike<number>) => {
  let a = Infinity,
    b = -Infinity;
  for (let i = 1; i < P.length; i += 3) {
    a = Math.min(a, P[i]);
    b = Math.max(b, P[i]);
  }
  return [a, b];
};
const mediana = (a: number[]) => a.slice().sort((p, q) => p - q)[a.length >> 1];

/** folha com grade: cada item na altura 1, lado a lado; linhas a cada 0,05 (as de 0,1 vermelhas) */
async function folhaGrade(arq: string, itens: Solta[]) {
  const P: number[] = [],
    C: number[][] = [];
  itens.forEach((it, q) => {
    const [y0, y1] = faixaY(it.P),
      h = y1 - y0,
      xs: number[] = [];
    for (let i = 0; i < it.P.length; i += 3) xs.push(it.P[i]);
    const x0 = mediana(xs);
    for (let i = 0; i < it.P.length; i += 3) P.push((it.P[i] - x0) / h + q, (it.P[i + 1] - y0) / h, it.P[i + 2] / h);
    C.push(...it.C);
  });
  const n = itens.length,
    quad = (x0: number, y0: number, x1: number, y1: number, cor: number[]) => {
      P.push(x0, y0, 5, x1, y0, 5, x1, y1, 5, x0, y0, 5, x1, y1, 5, x0, y1, 5);
      C.push(cor, cor);
    };
  for (let k = 0; k <= 20; k++) {
    const e = k % 2 ? 0.0015 : 0.003;
    quad(-0.5, k * 0.05 - e, n - 0.5, k * 0.05 + e, k % 2 ? [120, 200, 255] : [255, 60, 60]);
  }
  for (let q = 0; q < n; q++) quad(q - 0.0015, 0, q + 0.0015, 1, [255, 255, 0]);
  const I = Array.from({ length: P.length / 3 }, (_, i) => i);
  await desenhar(arq, P, I, (t) => C[t], { W: 600 * n, caixaFixa: { mn: [-0.5, 0, -10], mx: [n - 0.5, 1, 10] } });
  console.log(arq);
}

/* ---------- corpos ---------- */
/** a malha animada na vista de frente (jogo: frente +x, direita de quem olha -z) */
function vistaDeFrente(A: Anim, tris: number[]): Solta {
  const P: number[] = [],
    C: number[][] = [];
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const v = A.I[t * 3 + k];
      P.push(-A.P[v * 3 + 2], A.P[v * 3 + 1], A.P[v * 3]);
    }
    C.push([A.C[t * 3] * 255, A.C[t * 3 + 1] * 255, A.C[t * 3 + 2] * 255]);
  }
  return { P, C };
}
const corposSaida: CorpoDados[] = [];
const corposA: { nome: string; A: Anim }[] = [];
const mascarasCorpo: { nome: string; A: Anim; mask: Uint8Array }[] = [];
const gradesCorpo: Solta[] = [];
for (const c of plano.corpos) {
  const d = JSON.parse(readFileSync(c.anim, "utf8")) as DadosAnim;
  if (d.tex && d.malha.uv) {
    // Referências e máscaras precisam da cor pintada; nas malhas texturizadas C é branco.
    const tex = await sharp(Buffer.from(d.tex.split(",")[1], "base64"))
      .resize(1024, 1024, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer();
    const uvBytes = Uint8Array.from(Buffer.from(d.malha.uv, "base64"));
    const uv = new Uint16Array(uvBytes.buffer),
      cores = Buffer.from(d.malha.c, "base64");
    for (let t = 0; t < cores.length / 3; t++) {
      const cor = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        const x = Math.min(1023, Math.floor((uv[t * 6 + k * 2] / 65535) * 1024));
        const y = Math.min(1023, Math.floor((uv[t * 6 + k * 2 + 1] / 65535) * 1024));
        for (let e = 0; e < 3; e++) cor[e] += tex[(y * 1024 + x) * 3 + e] / 3;
      }
      for (let e = 0; e < 3; e++) cores[t * 3 + e] = Math.round((cor[e] * cores[t * 3 + e]) / 255);
    }
    d.malha.c = cores.toString("base64");
  }
  if (/^corpo_f0[1-6]$/.test(c.nome)) estabilizarBusto(d);
  refinarOmbrosModelo(c.nome, d);
  const A = decodificarAnim(d),
    nt = A.I.length / 3,
    todos = [...Array(nt).keys()];
  const [f0, f1] = c.faixa;
  if (GRADE) {
    // só os vértices dentro da faixa: a folha vai de f0 a f1 (as marcas lidas nela são frações dessa faixa)
    const s = vistaDeFrente(
      A,
      todos.filter((t) =>
        [0, 1, 2].every((k) => A.P[A.I[t * 3 + k] * 3 + 1] >= f0 && A.P[A.I[t * 3 + k] * 3 + 1] <= f1),
      ),
    );
    s.P.push(0, f0, -100, 0, f1, -100, 0.001, f0, -100); // marca a faixa inteira (atrás de tudo)
    s.C.push([38, 38, 38]);
    gradesCorpo.push(s);
    continue;
  }
  const yO = f0 + c.olhos * (f1 - f0),
    yQ = f0 + c.queixo * (f1 - f0),
    u = yO - yQ;
  // meio do rosto (z) e ponta do nariz (x): entre o queixo e os olhos
  const zs: number[] = [];
  for (let v = 0; v < A.P.length / 3; v++) if (A.P[v * 3 + 1] > yQ && A.P[v * 3 + 1] < yO) zs.push(A.P[v * 3 + 2]);
  const meio = mediana(zs);
  let nariz = -Infinity;
  for (let v = 0; v < A.P.length / 3; v++)
    if (A.P[v * 3 + 1] > yQ && A.P[v * 3 + 1] < yO && Math.abs(A.P[v * 3 + 2] - meio) < 0.25 * u)
      nariz = Math.max(nariz, A.P[v * 3]);
  // v8.1 — o tamanho das cabeças trocadas pela altura do chão ao queixo (plano.proporcao u), igual em todo corpo
  let chao = Infinity;
  for (let v = 0; v < A.P.length / 3; v++) chao = Math.min(chao, A.P[v * 3 + 1]);
  const encaixe: Encaixe = {
    nariz,
    queixo: yQ,
    meio,
    u,
    ...(plano.proporcao ? { uTroca: (yQ - chao) / plano.proporcao } : {}),
  };
  // a cabeça que sai
  const head = A.juntas.indexOf("Head"),
    neck = A.juntas.indexOf("Neck");
  let sai: (t: number) => boolean;
  if (c.pecas) {
    const pecas = JSON.parse(readFileSync(c.pecas, "utf8")) as number[];
    if (pecas.length !== nt) throw new Error(`${c.nome}: ${pecas.length} peças para ${nt} triângulos`);
    // v8.1 — e o que sobe acima do queixo perto do rosto (as abas do lenço da líder, que ficavam espetadas embaixo da
    // orelha da cabeça trocada)
    const yT = (t: number) => (A.P[A.I[t * 3] * 3 + 1] + A.P[A.I[t * 3 + 1] * 3 + 1] + A.P[A.I[t * 3 + 2] * 3 + 1]) / 3,
      zT = (t: number) => (A.P[A.I[t * 3] * 3 + 2] + A.P[A.I[t * 3 + 1] * 3 + 2] + A.P[A.I[t * 3 + 2] * 3 + 2]) / 3;
    sai = (t) => c.pecasCabeca!.includes(pecas[t]) || (yT(t) > yQ && Math.abs(zT(t) - meio) < 1.6 * u);
  } else {
    // sem peças: o que é da cabeça e do pescoço (peso) acima do meio do pescoço
    const corte = yQ - 0.5 * u;
    sai = (t) => {
      let w = 0,
        y = 0;
      for (let k = 0; k < 3; k++) {
        const v = A.I[t * 3 + k];
        y += A.P[v * 3 + 1] / 3;
        for (let q = 0; q < 4; q++) if (A.J[v * 4 + q] === head || A.J[v * 4 + q] === neck) w += A.W[v * 4 + q] / 3;
      }
      return y > corte && w > 0.5;
    };
  }
  // v8.1 — as cores de referência para trocar a pele e o cabelo no jogo: a pele no meio do rosto, o cabelo no topo
  const corDeT = (t: number) => [A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]].map((v) => v * 255),
    meioT = (t: number, e: number) =>
      (A.P[A.I[t * 3] * 3 + e] + A.P[A.I[t * 3 + 1] * 3 + e] + A.P[A.I[t * 3 + 2] * 3 + e]) / 3,
    rosto = todos
      .filter(
        (t) =>
          sai(t) &&
          meioT(t, 1) > yQ + 0.2 * u &&
          meioT(t, 1) < yO - 0.1 * u &&
          Math.abs(meioT(t, 2) - meio) < 0.3 * u &&
          meioT(t, 0) > nariz - 0.6 * u,
      )
      .map(corDeT),
    topoCab = todos.filter((t) => sai(t) && meioT(t, 1) > yO + 0.9 * u).map(corDeT);
  const refPele = [0, 1, 2].map((e) => Math.round(mediana(rosto.map((q) => q[e])))),
    refCabelo = c.corCabelo ?? [0, 1, 2].map((e) => Math.round(mediana(topoCab.map((q) => q[e]))));
  // v8.1 — `tirarCabelo` (corpos das deusas): o cabelo comprido abaixo do pescoço pesa na coluna, não na cabeça, e
  // ficava por baixo da cabeça trocada. Sai o que tem a cor do cabelo (a mediana do topo da cabeça que saiu) até
  // `tirarCabelo` × u abaixo do queixo.
  if (c.tirarCabelo) {
    const corDe = (t: number) => [A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]].map((v) => v * 255),
      yT = (t: number) => (A.P[A.I[t * 3] * 3 + 1] + A.P[A.I[t * 3 + 1] * 3 + 1] + A.P[A.I[t * 3 + 2] * 3 + 1]) / 3,
      topo = todos.filter((t) => sai(t) && yT(t) > yO + 0.6 * u).map(corDe),
      cab = c.corCabelo ?? [0, 1, 2].map((e) => mediana(topo.map((q) => q[e]))),
      limite = yQ - c.tirarCabelo * u,
      saiCabeca = sai;
    sai = (t) => {
      if (saiCabeca(t)) return true;
      if (yT(t) < limite) return false;
      const q = corDe(t);
      return Math.hypot(q[0] - cab[0], q[1] - cab[1], q[2] - cab[2]) < 55;
    };
    console.log(`${c.nome}: cabelo ${cab.map(Math.round).join(",")}, sai até y ${limite.toFixed(1)}`);
  }
  let fica = todos.filter((t) => !sai(t));
  // sem o cabelo, os reflexos de outra cor ficavam soltos no ar: saem as ilhas (ligadas por vértice) com menos de 1,5%
  // dos triângulos que ficam
  if (c.tirarCabelo) {
    const pai = new Int32Array(A.P.length / 3).map((_, i) => i),
      raiz = (v: number): number => (pai[v] === v ? v : (pai[v] = raiz(pai[v])));
    for (const t of fica) {
      const a = raiz(A.I[t * 3]);
      for (let k = 1; k < 3; k++) pai[raiz(A.I[t * 3 + k])] = a;
    }
    const tam = new Map<number, number>();
    for (const t of fica) tam.set(raiz(A.I[t * 3]), (tam.get(raiz(A.I[t * 3])) ?? 0) + 1);
    const antes = fica.length;
    fica = fica.filter((t) => tam.get(raiz(A.I[t * 3]))! >= antes * 0.015);
    console.log(`${c.nome}: ${antes - fica.length} triângulos em ilhas soltas`);
  }
  if (c.limparIlhasPescoco) {
    const limpo = limparIlhasPescoco(A, fica, encaixe, c.limparIlhasPescoco);
    fica = limpo.tris;
    console.log(c.nome + ": " + limpo.removidos.length + " fragmentos do recorte retirados");
  }
  // malha sem a cabeça, compactada, no formato de gerar-animacoes (posição Int16 ×64, pesos Uint8)
  const novo = new Map<number, number>(),
    P16: number[] = [],
    J8: number[] = [],
    W8: number[] = [],
    I16: number[] = [],
    C8: number[] = [];
  const P16o = new Int16Array(Buffer.from(d.malha.p, "base64").buffer.slice(0)),
    J8o = Buffer.from(d.malha.j, "base64"),
    W8o = Buffer.from(d.malha.w, "base64"),
    C8o = Buffer.from(d.malha.c, "base64");
  for (const t of fica) {
    for (let k = 0; k < 3; k++) {
      const v = A.I[t * 3 + k];
      let n = novo.get(v);
      if (n === undefined) {
        novo.set(v, (n = novo.size));
        P16.push(P16o[v * 3], P16o[v * 3 + 1], P16o[v * 3 + 2]);
        for (let q = 0; q < 4; q++) {
          J8.push(J8o[v * 4 + q]);
          W8.push(W8o[v * 4 + q]);
        }
      }
      I16.push(n);
    }
    C8.push(C8o[t * 3], C8o[t * 3 + 1], C8o[t * 3 + 2]);
  }
  const semCabeca: DadosAnim = {
    ...d,
    malha: {
      p: b64(Int16Array.from(P16)),
      j: b64(Uint8Array.from(J8)),
      w: b64(Uint8Array.from(W8)),
      i: b64(Uint16Array.from(I16)),
      c: b64(Uint8Array.from(C8)),
    },
    clips: {},
  };
  // a pele do corpo (braços, barriga) costuma ser mais clara que a do rosto: a mediana do que fica parecido com ela
  const parecidas = fica.map(corDeT).filter(
    (q) =>
      Math.hypot(q[0] - refPele[0], q[1] - refPele[1], q[2] - refPele[2]) < 95 &&
      q[0] > q[2] &&
      // pelo menos tão clara quanto o rosto: o colete marrom da heroína também é "parecido"
      0.3 * q[0] + 0.59 * q[1] + 0.11 * q[2] >= 0.95 * (0.3 * refPele[0] + 0.59 * refPele[1] + 0.11 * refPele[2]),
  );
  const refPeleCorpo = [0, 1, 2].map((e) => Math.round(mediana(parecidas.map((q) => q[e]))));
  const saidaCorpo: CorpoDados = {
    nome: c.nome,
    rotulo: c.rotulo,
    peso: c.peso,
    ...(c.sexo ? { sexo: c.sexo } : {}),
    pesoPropria: c.pesoPropria,
    ...(c.cabecaPadrao ? { cabecaPadrao: c.cabecaPadrao } : {}),
    semCabeca,
    encaixe,
    refPele,
    refPeleCorpo,
    refCabelo,
    cabeloAte: yQ - (c.cabeloDesce ?? c.tirarCabelo ?? 1) * u,
  };
  // v8.1 — a máscara pele/cabelo do corpo inteiro (a cabeça própria) e a do corpo sem a cabeça (os mesmos triângulos)
  const mascaraInteira = segmentarCorpo(A, saidaCorpo, !!c.limparManchas);
  // v8.1 — as peças do Tripo que são o cabelo (a líder: peça 0): o que tem a cor do cabelo vira cabelo. As mechas que
  // cruzam o rosto são escuras como o delineado e grudadas na pele; pela cor não se separam, pela peça sim
  if (c.pecas && c.pecasCabelo) {
    const pecas = JSON.parse(readFileSync(c.pecas, "utf8")) as number[],
      ref = lab(refCabelo[0], refCabelo[1], refCabelo[2]);
    for (let t = 0; t < nt; t++)
      if (
        mascaraInteira[t] === PARTE.outro &&
        c.pecasCabelo.includes(pecas[t]) &&
        dE(lab(A.C[t * 3] * 255, A.C[t * 3 + 1] * 255, A.C[t * 3 + 2] * 255), ref) <= c.pecasCabeloTol!
      )
        mascaraInteira[t] = PARTE.cabelo;
  }
  if (c.cabeloFixo)
    for (let t = 0; t < mascaraInteira.length; t++)
      if (mascaraInteira[t] === PARTE.cabelo) mascaraInteira[t] = PARTE.outro;
  saidaCorpo.mascaraPropria = b64(mascaraInteira);
  saidaCorpo.mascara = b64(Uint8Array.from(fica, (t) => mascaraInteira[t]));
  corposSaida.push(saidaCorpo);
  mascarasCorpo.push({ nome: c.nome, A, mask: mascaraInteira });
  console.log(`${c.nome}: pele ${refPele.join(",")} (corpo ${refPeleCorpo.join(",")}), cabelo ${refCabelo.join(",")}`);
  corposA.push({ nome: c.nome, A: decodificarAnim(semCabeca) });
  console.log(
    `${c.nome}: ${nt} → ${fica.length} triângulos sem a cabeça; olhos y ${yO.toFixed(2)}, queixo y ${yQ.toFixed(2)}, ` +
      `nariz x ${nariz.toFixed(2)}, meio z ${meio.toFixed(2)}`,
  );
}

if (process.argv.includes("--corpos")) {
  const anterior = JSON.parse(readFileSync(plano.saida, "utf8"));
  writeFileSync(plano.saida, JSON.stringify({ ...anterior, corpos: corposSaida }));
  console.log("Corpos, encaixes e máscaras atualizados; cabeças e texturas preservadas.");
  process.exit(0);
}
/* ---------- cabeças ---------- */
/** .glb do exportador (pose T, frente +Z; triângulos soltos, cor por face numa paleta) */
async function lerExportado(arq: string): Promise<Solta> {
  const b = readFileSync(arq),
    jl = b.readUInt32LE(12),
    g = JSON.parse(b.subarray(20, 20 + jl).toString("utf8")),
    bin = Buffer.from(b.subarray(28 + jl));
  const vista = (i: number) => {
    const v = g.bufferViews[i];
    return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  };
  const f32 = (acc: number) => {
    const s = vista(g.accessors[acc].bufferView);
    return new Float32Array(s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength));
  };
  const pr = g.meshes[0].primitives[0],
    P = f32(pr.attributes.POSITION),
    UV = f32(pr.attributes.TEXCOORD_0);
  const img = sharp(vista(g.images[0].bufferView)),
    lado = (await img.metadata()).width ?? 1,
    tex = await img.removeAlpha().raw().toBuffer();
  const C: number[][] = [];
  for (let t = 0; t < P.length / 9; t++) {
    const x = Math.min(lado - 1, Math.floor(UV[t * 6] * lado)),
      y = Math.min(lado - 1, Math.floor(UV[t * 6 + 1] * lado)),
      o = (y * lado + x) * 3;
    C.push([tex[o], tex[o + 1], tex[o + 2]]);
  }
  // v8.1 — a textura ao lado do .glb (mesma ordem de triângulos)
  const arqUv = arq.replace(/\.glb$/, "_uv.json"),
    arqTex = arq.replace(/\.glb$/, "_tex.png");
  if (existsSync(arqUv) && existsSync(arqTex)) {
    const uv = JSON.parse(readFileSync(arqUv, "utf8")) as (number[] | null)[];
    if (uv.length !== P.length / 9) throw new Error(`${arqUv}: ${uv.length} triângulos para ${P.length / 9}`);
    return { P: Array.from(P), C, uv, tex: readFileSync(arqTex) };
  }
  return { P: Array.from(P), C };
}
/** cabeça das deusas: recorte do .glb com textura, reduzida com a cor por vértice */
async function lerDeusa(dz: { arquivo: string; xMin: number; xMax: number }): Promise<Solta> {
  const m = await recortar(
    dz.arquivo,
    { xMin: dz.xMin, xMax: dz.xMax, yMin: -100, yMax: 100 },
    2048,
    "build/modelos/cache",
  );
  const { id, n } = soldar(m.P),
    P = new Float32Array(n * 3),
    cor = new Float32Array(n * 3);
  for (let v = 0; v < m.P.length / 3; v++) {
    const s = id[v];
    for (let e = 0; e < 3; e++) P[s * 3 + e] = m.P[v * 3 + e];
    const c = amostra(m, m.T[v * 2], m.T[v * 2 + 1]);
    for (let e = 0; e < 3; e++) cor[s * 3 + e] = c[e] / 255;
  }
  const I = Uint32Array.from(m.I, (v) => id[v]);
  await MeshoptSimplifier.ready;
  MeshoptSimplifier.useExperimentalFeatures = true; // simplifyWithAttributes
  const [lo] = MeshoptSimplifier.simplifyWithAttributes(I, P, 3, cor, 3, [10, 10, 10], null, plano.trisCabeca * 3, 1);
  const out: number[] = [],
    C: number[][] = [];
  for (let t = 0; t < lo.length; t += 3) {
    const c = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      for (let e = 0; e < 3; e++) {
        out.push(P[lo[t + k] * 3 + e]);
        c[e] += (cor[lo[t + k] * 3 + e] * 255) / 3;
      }
    }
    C.push(c);
  }
  return { P: out, C };
}

/** v8.1 — uma cabeça de uma folha do Tripo com textura, reduzida guardando o UV (tools/lib/peca.ts reduzirPecaUV): os
 *  olhos, as sobrancelhas e a barba pintados ficam — pela cor por vértice (lerDeusa) viravam borrões. As cartas de cada
 *  cabeça se espalham pela textura inteira da folha: ela vai uma vez só no JSON (`texturas`) */
async function lerTripo(tr: {
  arquivo: string;
  xMin: number;
  xMax: number;
  yMin?: number;
  yMax?: number;
  textura: string;
}, marcos?: {busto?: boolean; queixo:number; olhos:number}): Promise<Solta> {
  const m = await recortar(
    tr.arquivo,
    { xMin: tr.xMin, xMax: tr.xMax, yMin: tr.yMin ?? -100, yMax: tr.yMax ?? 100 },
    2048,
    "build/modelos/cache",
  );
  const [minY,maxY]=faixaY(Array.from(m.P));
  const r = marcos?.busto ? await reduzirComPrioridadeRosto(m,plano.trisCabeca,{
      queixo:minY+marcos.queixo*(maxY-minY),olhos:minY+marcos.olhos*(maxY-minY),
    }) : await reduzirPecaUV(m, plano.trisCabeca),
    C: number[][] = [],
    uv: number[][] = [];
  for (let t = 0; t < r.p.length / 9; t++) {
    C.push([0, 1, 2].map((e) => r.c[t * 3 + e] * 255));
    uv.push(r.uv.slice(t * 6, t * 6 + 6));
  }
  return { P: r.p, C, uv, folha: { chave: tr.textura, raw: m.tex, lado: m.texW } };
}

const cabecasSaida: CabecaDados[] = [];
const mascarasCabeca: { nome: string; p: Int16Array; I: Uint16Array; C: Uint8Array; mask: Uint8Array }[] = [];
const gradesCab: Solta[] = [];
/** as texturas compartilhadas (folhas do Tripo): a imagem (com a faixa branca embaixo), a escala do v e o branco */
const folhas = new Map<string, { url: string; fv: number; branco: number[] }>();
/** a cor por triângulo de cada cabeça antes de virar branca onde a textura manda (as prévias desenham com ela) */
const coresPrevia = new Map<string, string>();
for (const c of plano.cabecas) {
  const m = c.glb ? await lerExportado(c.glb) : c.tripo ? await lerTripo(c.tripo,c) : await lerDeusa(c.deusa!);
  if (GRADE) {
    gradesCab.push(m);
    continue;
  }
  const [y0, y1] = faixaY(m.P),
    h = y1 - y0,
    yO = y0 + c.olhos * h,
    yQ = y0 + c.queixo * h,
    u = yO - yQ;
  if (c.alongarPescoco)
    for (let i = 1; i < m.P.length; i += 3) if (m.P[i] < yQ) m.P[i] = yQ + (m.P[i] - yQ) * c.alongarPescoco;
  const xs: number[] = [];
  for (let i = 0; i < m.P.length; i += 3) xs.push(m.P[i]);
  const x0 = mediana(xs);
  let zN = -Infinity;
  for (let i = 0; i < m.P.length; i += 3)
    if (Math.abs(m.P[i] - x0) < 0.15 * u && m.P[i + 1] > yQ && m.P[i + 1] < yO) zN = Math.max(zN, m.P[i + 2]);
  // na medida da cabeça; abaixo da base do pescoço (plano.pescoco), o que fica no meio (o peito do busto) sai: o cabelo
  // dos lados fica. v8.1 — o pescoço vai inteiro (era até o meio: ao dobrar na corrida abria um vão entre a cabeça e o
  // corpo, e na líder, que perde o pescoço com a cabeça, ficava um buraco embaixo do queixo); ele entra por dentro do
  // pescoço e da gola do corpo, e comporPele o dobra junto com a junta Neck.
  const chave = new Map<string, number>(),
    p: number[] = [],
    I: number[] = [],
    C: number[] = [],
    uvT: (number[] | null)[] = [];
  const amostrasPele = m.C.filter((_, t) => {
    const y = ctr(m.P, t, 1),
      x = ctr(m.P, t, 0),
      z = ctr(m.P, t, 2);
    return y > yQ + 0.2 * u && y < yO - 0.1 * u && Math.abs(x - x0) < 0.3 * u && z > zN - 0.6 * u;
  });
  const peleLab = lab(...([0, 1, 2].map((k) => mediana(amostrasPele.map((q) => q[k]))) as [number, number, number]));
  for (let t = 0; t < m.C.length; t++) {
    const y = (ctr(m.P, t, 1) - yQ) / u,
      x = (ctr(m.P, t, 0) - x0) / u;
    if (y < -(plano.pescoco ?? 0.5) && Math.abs(x) < 0.9) continue;
    if (c.busto && y < -0.15 && Math.abs(x) > 0.58 && dE(lab(...(m.C[t] as [number, number, number])), peleLab) < 36)
      continue;
    uvT.push(m.uv?.[t] ?? null);
    for (let k = 0; k < 3; k++) {
      const q = [
        (m.P[t * 9 + k * 3] - x0) / u,
        (m.P[t * 9 + k * 3 + 1] - yQ) / u,
        (m.P[t * 9 + k * 3 + 2] - zN) / u,
      ].map((v) => Math.round(v * 1000));
      const kk = q.join(",");
      let v = chave.get(kk);
      if (v === undefined) {
        chave.set(kk, (v = chave.size));
        p.push(...q);
      }
      I.push(v);
    }
    C.push(...m.C[t].map((v) => Math.round(Math.min(255, v))));
  }
  if (c.busto) {
    // Restos escuros das emendas entre os braços não são cabelo: ficam soltos abaixo do queixo.
    const pai = Int32Array.from({ length: p.length / 3 }, (_, k) => k);
    const raiz = (v: number): number => {
      while (pai[v] !== v) v = pai[v] = pai[pai[v]];
      return v;
    };
    for (let t = 0; t < I.length; t += 3) {
      pai[raiz(I[t + 1])] = raiz(I[t]);
      pai[raiz(I[t + 2])] = raiz(I[t]);
    }
    const grupos = new Map<number, { tris: number[]; topo: number; x0: number; x1: number }>();
    for (let t = 0; t < I.length / 3; t++) {
      const r = raiz(I[t * 3]);
      let g = grupos.get(r);
      if (!g) grupos.set(r, (g = { tris: [], topo: -Infinity, x0: Infinity, x1: -Infinity }));
      g.tris.push(t);
      for (let k = 0; k < 3; k++) {
        const v = I[t * 3 + k];
        g.topo = Math.max(g.topo, p[v * 3 + 1]);
        g.x0 = Math.min(g.x0, p[v * 3]);
        g.x1 = Math.max(g.x1, p[v * 3]);
      }
    }
    const maior = Math.max(...[...grupos.values()].map((g) => g.tris.length));
    const manter = new Set<number>();
    for (const g of grupos.values()) {
      if (g.tris.length < Math.max(6, maior * 0.003) || (g.topo < 0 && (g.x0 > 1600 || g.x1 < -1600))) continue;
      for (const t of g.tris) manter.add(t);
    }
    const novosP: number[] = [],
      novosI: number[] = [],
      novasC: number[] = [],
      novosUV: (number[] | null)[] = [];
    const mapa = new Map<number, number>();
    for (let t = 0; t < I.length / 3; t++)
      if (manter.has(t)) {
        for (let k = 0; k < 3; k++) {
          const v = I[t * 3 + k];
          let n = mapa.get(v);
          if (n == null) {
            n = mapa.size;
            mapa.set(v, n);
            novosP.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
          }
          novosI.push(n);
        }
        novasC.push(C[t * 3], C[t * 3 + 1], C[t * 3 + 2]);
        novosUV.push(uvT[t]);
      }
    console.log(`${c.nome}: ${I.length / 3 - novosI.length / 3} triângulos soltos removidos do busto`);
    p.splice(0, p.length, ...novosP);
    I.splice(0, I.length, ...novosI);
    C.splice(0, C.length, ...novasC);
    uvT.splice(0, uvT.length, ...novosUV);
  }
  if (c.limparFragmentos) {
    const limpo = limparFragmentosCabeca(p, I, c.limparFragmentos);
    if (limpo.removidos.length) {
      const indices = limpo.tris.flatMap((t) => [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]]);
      const cores = limpo.tris.flatMap((t) => C.slice(t * 3, t * 3 + 3));
      const uvs = limpo.tris.map((t) => uvT[t]);
      I.splice(0, I.length, ...indices);
      C.splice(0, C.length, ...cores);
      uvT.splice(0, uvT.length, ...uvs);
    }
    console.log(c.nome + ": " + limpo.removidos.length + " fragmentos inferiores removidos individualmente");
  }
  // as cores de referência (pele no meio do rosto, cabelo no topo da cabeça)
  const rostoC: number[][] = [],
    topoC: number[][] = [];
  for (let t = 0; t < m.C.length; t++) {
    const y = ctr(m.P, t, 1),
      x = ctr(m.P, t, 0),
      z = ctr(m.P, t, 2);
    if (y > yQ + 0.2 * u && y < yO - 0.1 * u && Math.abs(x - x0) < 0.3 * u && z > zN - 0.6 * u) rostoC.push(m.C[t]);
    if (y > yO + 0.9 * u) topoC.push(m.C[t]);
  }
  const refs = {
    refPele: [0, 1, 2].map((e) => Math.round(mediana(rostoC.map((q) => q[e])))),
    refCabelo: c.corCabelo ?? [0, 1, 2].map((e) => Math.round(mediana(topoC.map((q) => q[e])))),
  };
  // v8.1 — a máscara pele/cabelo (o cabelo fixo vira "outro": não troca de cor)
  const mascara = segmentarCabeca(Int16Array.from(p), I, C, refs, c.manter);
  if (c.cabeloFixo) for (let t = 0; t < mascara.length; t++) if (mascara[t] === PARTE.cabelo) mascara[t] = PARTE.outro;
  // v8.1 — a pele do rosto alisada (forma e cor; tools/lib/mascara.ts alisarPele)
  const pF = Float32Array.from(p, (v) => v / 1000),
    C8 = Uint8Array.from(C);
  if (plano.alisar) alisarPele(pF, I, C8, mascara, plano.alisar);
  const p16 = Int16Array.from(pF, (v) => Math.round(v * 1000));
  // v8.1 — com a textura: os triângulos dela ficam brancos (a cor vem da imagem; o jogo multiplica as duas) e os outros
  // apontam para o pixel (0, 0), branco, e ficam com a cor por triângulo. A cor por triângulo segue servindo à máscara
  let comTextura: { tex?: string; texDe?: string; uv: string; branco: number[] } | null = null;
  const cSaida = Uint8Array.from(C8);
  coresPrevia.set(c.nome, b64(C8));
  if (m.folha && m.uv) {
    // a folha inteira, uma vez: 1024², com uma faixa branca embaixo para o corpo (a cor dele é a por triângulo)
    let f = folhas.get(m.folha.chave);
    if (!f) {
      const L = plano.tamanhoTextura ?? 1024,
        FAIXA = 8,
        img = await sharp(m.folha.raw, { raw: { width: m.folha.lado, height: m.folha.lado, channels: 3 } })
          .resize(L, L)
          .extend({ bottom: FAIXA, background: { r: 255, g: 255, b: 255 } })
          .webp({ quality: plano.qualidadeTextura ?? 88 })
          .toBuffer();
      f = {
        url: "data:image/webp;base64," + img.toString("base64"),
        fv: L / (L + FAIXA),
        branco: [0.5, (L + FAIXA / 2) / (L + FAIXA)],
      };
      folhas.set(m.folha.chave, f);
      console.log(`textura ${m.folha.chave}: ${L}×${L + FAIXA}, ${(img.length / 1024).toFixed(0)} KB`);
    }
    const uv16 = new Uint16Array(uvT.length * 6),
      q16 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 65535);
    uvT.forEach((q, t) => {
      for (let k = 0; k < 6; k++) uv16[t * 6 + k] = q16(q ? (k % 2 ? q[k] * f.fv : q[k]) : f.branco[k % 2]);
      if (q) cSaida.fill(255, t * 3, t * 3 + 3);
    });
    comTextura = { texDe: m.folha.chave, uv: b64(uv16), branco: f.branco };
  } else if (m.tex && m.uv) {
    const meta = await sharp(m.tex).metadata(),
      W = meta.width!,
      H = meta.height!,
      branco = [0.5 / W, 0.5 / H],
      uv16 = new Uint16Array(uvT.length * 6);
    uvT.forEach((q, t) => {
      for (let k = 0; k < 6; k++) uv16[t * 6 + k] = Math.round((q ? q[k] : branco[k % 2]) * 65535);
      if (q) cSaida.fill(255, t * 3, t * 3 + 3);
    });
    const img = await sharp(m.tex)
      .composite([{ input: Buffer.from([255, 255, 255]), raw: { width: 1, height: 1, channels: 3 }, left: 0, top: 0 }])
      .webp({ quality: plano.qualidadeTextura ?? 88 })
      .toBuffer();
    comTextura = { tex: "data:image/webp;base64," + img.toString("base64"), uv: b64(uv16), branco };
    console.log(
      `${c.nome}: textura ${W}×${H}, ${(img.length / 1024).toFixed(0)} KB, ${uvT.filter((q) => q).length} triângulos nela`,
    );
  }
  cabecasSaida.push({
    nome: c.nome,
    rotulo: c.rotulo,
    peso: c.peso,
    ...(c.sexo ? { sexo: c.sexo } : {}),
    ...refs,
    p: b64(p16),
    i: b64(Uint16Array.from(I)),
    c: b64(cSaida),
    mascara: b64(mascara),
    ...(comTextura ?? {}),
  });
  mascarasCabeca.push({
    nome: c.nome,
    p: p16,
    I: Uint16Array.from(I),
    C: C8,
    mask: mascara,
  });
  console.log(`${c.nome}: ${I.length / 3} triângulos, ${p.length / 3} vértices`);
}

if (GRADE) {
  await folhaGrade(join(plano.previas, "grade_corpos.png"), gradesCorpo);
  await folhaGrade(join(plano.previas, "grade_cabecas.png"), gradesCab);
  process.exit(0);
}

const json = JSON.stringify({
  corpos: corposSaida,
  cabecas: cabecasSaida,
  ...(folhas.size ? { texturas: Object.fromEntries([...folhas].map(([k, f]) => [k, f.url])) } : {}),
});
writeFileSync(plano.saida, json);
console.log(`${plano.saida}: ${(json.length / 1024).toFixed(0)} KB`);
if (process.argv.includes("--sem-previas")) process.exit(0);

/* ---------- v8.1 — prévias da máscara: original em cima, pele laranja / cabelo azul / o resto apagado embaixo ---------- */
const corFalsa = (c: ArrayLike<number>, parte: number) => {
  const l = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
  if (parte === PARTE.pele) return [255, 150, 60].map((v) => v * (0.4 + 0.8 * l));
  if (parte === PARTE.cabelo) return [60, 130, 255].map((v) => v * (0.4 + 0.8 * l));
  if (parte === PARTE.rosto) return [255, 80, 200].map((v) => v * (0.4 + 0.8 * l));
  return [c[0], c[1], c[2]].map((v) => v * 0.35 + l * 255 * 0.25);
};
{
  const P: number[] = [],
    C: number[][] = [];
  mascarasCabeca.forEach(({ p, I, C: cor, mask }, q) => {
    for (const lin of [0, 1])
      for (let t = 0; t < I.length / 3; t++) {
        for (let k = 0; k < 3; k++) {
          const v = I[t * 3 + k];
          P.push(p[v * 3] / 1000 + q * 3.2, p[v * 3 + 1] / 1000 - lin * 4.2, p[v * 3 + 2] / 1000);
        }
        const c = cor.subarray(t * 3, t * 3 + 3);
        C.push(lin ? corFalsa(c, mask[t]) : [c[0], c[1], c[2]]);
      }
  });
  await desenhar(
    join(plano.previas, "mascara_cabecas.png"),
    P,
    P.map((_, i) => i).slice(0, P.length / 3),
    (t) => C[t],
    {
      W: 300 * mascarasCabeca.length,
      caixaFixa: { mn: [-1.6, -5.6, -10], mx: [mascarasCabeca.length * 3.2 - 1.6, 3.2, 10] },
    },
  );
  console.log(join(plano.previas, "mascara_cabecas.png"));
}
{
  const P: number[] = [],
    C: number[][] = [];
  mascarasCorpo.forEach(({ A, mask }, q) => {
    for (const lin of [0, 1])
      for (let t = 0; t < A.I.length / 3; t++) {
        for (let k = 0; k < 3; k++) {
          const v = A.I[t * 3 + k];
          P.push(-A.P[v * 3 + 2] + q * 120 + lin * 58, A.P[v * 3 + 1], A.P[v * 3]);
        }
        const c = [A.C[t * 3] * 255, A.C[t * 3 + 1] * 255, A.C[t * 3 + 2] * 255];
        C.push(lin ? corFalsa(c, mask[t]) : c);
      }
  });
  await desenhar(join(plano.previas, "mascara_corpos.png"), P, P.map((_, i) => i).slice(0, P.length / 3), (t) => C[t], {
    W: 600 * mascarasCorpo.length,
    caixaFixa: { mn: [-30, 0, -100], mx: [mascarasCorpo.length * 120 - 30, 50, 100] },
  });
  console.log(join(plano.previas, "mascara_corpos.png"));
}

/* ---------- prévias: cada corpo com cada cabeça, do peito para cima e de corpo inteiro ---------- */
for (const { nome, A: corpoA } of corposA) {
  const corpo = corposSaida.find((c) => c.nome === nome)!;
  // só as cabeças que servem no corpo (o mesmo sexo), com a cor por triângulo de antes da textura (o desenho daqui
  // não usa a textura: a cor branca de onde ela manda saía branca)
  const peles = cabecasSaida
    .filter((cab) => cabeNoCorpo(corpo, cab))
    .map((cab) => comporPele(corpoA, { ...cab, c: coresPrevia.get(cab.nome) ?? cab.c }, corpo.encaixe));
  for (const [arq, inteiro] of [
    [`${nome}_bustos.png`, false],
    [`${nome}_corpos.png`, true],
  ] as const) {
    const P: number[] = [],
      C: number[][] = [];
    const passo = inteiro ? 60 : 12;
    peles.forEach((pl, q) => {
      const s = vistaDeFrente(pl, [...Array(pl.I.length / 3).keys()]);
      for (let t = 0; t < s.C.length; t++) {
        // nos bustos, sem os braços (a pose T alargava a folha)
        if (!inteiro && Math.abs(ctr(s.P, t, 0)) > passo * 0.45) continue;
        for (let i = t * 9; i < t * 9 + 9; i += 3) P.push(s.P[i] + q * passo, s.P[i + 1], s.P[i + 2]);
        C.push(s.C[t]);
      }
    });
    const e = corpo.encaixe,
      y0 = inteiro ? 0 : e.queixo - 4 * e.u,
      y1 = inteiro ? faixaY(P)[1] + 1 : e.queixo + 4.5 * e.u;
    const I = Array.from({ length: P.length / 3 }, (_, i) => i);
    await desenhar(join(plano.previas, arq), P, I, (t) => C[t], {
      W: inteiro ? 2600 : 2600,
      caixaFixa: { mn: [-passo / 2, y0, -100], mx: [peles.length * passo - passo / 2, y1, 100] },
    });
    console.log(join(plano.previas, arq));
  }
}
