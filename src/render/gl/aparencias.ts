/* ==== Aparências dos personagens (src/assets/models/aparencias.json, tools/gerar-aparencias.ts).
   Personagens novos sorteiam corpo e cabeça entre todas as opções femininas, incluindo heroína, líder e deusas.
   Cada opção tem a mesma chance, independentemente dos pesos antigos e das notas do Editor. ==== */
import { decodificarAnim, type Anim, type DadosAnim } from "./esqueleto.ts";
import { TINGIR } from "../../data/aparencias.ts";
import { ENCAIXES } from "../../data/encaixes.ts";
import { unirPescoco } from "./unir-pescoco.ts";

/** Onde a cabeça encaixa no corpo (espaço do jogo, pose de bind): frente +x, para cima +y. */
export interface Encaixe {
  nariz: number; // x da ponta do nariz
  queixo: number; // y do queixo
  meio: number; // z do meio do rosto
  u: number; // da linha dos olhos ao queixo
  /** v8.1 — o u das cabeças trocadas, pela altura do corpo (uma proporção só para todos): pelo u da cabeça própria,
   *  na deusa do outono nova (cabeça grande) toda cabeça trocada ficava ~20% maior */
  uTroca?: number;
}
export interface CorpoDados {
  nome: string;
  rotulo: string;
  peso: number;
  /** v8.1 — "m" = masculino (só pega cabeça masculina); ausente = feminino */
  sexo?: string;
  /** peso da cabeça do próprio corpo no sorteio */
  pesoPropria: number;
  /** Cabeça preparada a partir do busto correspondente, usada como aparência própria. */
  cabecaPadrao?: string;
  semCabeca: DadosAnim;
  encaixe: Encaixe;
  /** v8.1 — as cores de referência (rgb 0..255) da pele (o meio do rosto) e do cabelo (o topo da cabeça) do modelo */
  refPele?: number[];
  /** a pele do corpo (braços, barriga), mais clara que a do rosto */
  refPeleCorpo?: number[];
  refCabelo?: number[];
  /** até onde (y) o cabelo do próprio corpo desce (as deusas: até o quadril) */
  cabeloAte?: number;
  /** v8.1 — o que é pele e cabelo, um Uint8 por triângulo (base64; tools/lib/mascara.ts PARTE: 0 outro, 1 pele,
   *  2 cabelo, 3 detalhe do rosto): do corpo sem a cabeça e do corpo inteiro com a cabeça própria */
  mascara?: string;
  mascaraPropria?: string;
}
export interface CabecaDados {
  nome: string;
  rotulo: string;
  peso: number;
  /** v8.1 — "m" = masculina (só vai em corpo masculino); ausente = feminina */
  sexo?: string;
  /** posições Int16 (×1000) na medida da cabeça, vista de frente: x para a direita de quem olha, z para a frente */
  p: string;
  i: string; // Uint16
  c: string; // cor por triângulo, Uint8
  refPele?: number[];
  refCabelo?: number[];
  /** v8.1 — pele e cabelo por triângulo, como CorpoDados.mascara */
  mascara?: string;
  /** v8.1 — a pintura da referência como textura (data URL), onde os cantos de cada triângulo caem nela (Uint16, 6 por
   *  triângulo, ÷65535) e o pixel branco (u, v) dos que não estão nela (a cor deles é a por triângulo) */
  tex?: string;
  uv?: string;
  branco?: number[];
  /** v8.1 — a textura em `AparenciasDados.texturas` (a folha das cabeças masculinas: as cartas de cada uma se espalham
   *  pela imagem inteira, que vai uma vez só no JSON) */
  texDe?: string;
}
export interface AparenciasDados {
  corpos?: CorpoDados[];
  cabecas?: CabecaDados[];
  texturas?: Record<string, string>;
}
/** Uma combinação preparada com cabeça, pescoço, ombros e busto da mesma malha de origem. */
interface BustoIntegralDados {
  corpo: string;
  cabeca: string;
  anim: DadosAnim;
  mascara: string;
  /** Uint8 por triângulo: 0 corpo inferior, 1 busto, 2 união. */
  regiaoPele?: string;
  refPele?: number[];
  refPeleInferior?: number[];
  refCabelo?: number[];
}
interface BustosIntegraisDados {
  combinacoes?: BustoIntegralDados[];
  texturas?: Record<string, string>;
}
export interface Aparencia {
  corpo: string;
  cabeca: string;
  /** v8.1 — a cor da pele e do cabelo ("#rrggbb"; ausente = a do modelo) */
  pele?: string;
  cabelo?: string;
}

// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/aparencias.json */ {} as AparenciasDados;
const BUSTOS = /* @inline-json src/assets/models/bustos-integrais.json */ {} as BustosIntegraisDados;
const FONTES = { aparencias: DADOS, bustos: BUSTOS };

function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/** v8.1 — a cabeça serve no corpo: a própria sempre; as trocadas, do mesmo sexo (mantenedor 2026-11-01: busto
 *  feminino no corpo masculino) */
export const cabeNoCorpo = (corpo: { sexo?: string }, cab: { nome: string; sexo?: string }) =>
  cab.nome === "propria" || (cab.sexo ?? "f") === (corpo.sexo ?? "f");

/** Sorteia corpo e cabeça femininos separadamente, com chances iguais (`rnd` 0..1).
 * Pesos dos modelos e notas do Editor não excluem nem favorecem uma aparência na geração.
 * Sem dados (testes em Node): a heroína de sempre. */
export function sortearAparencia(dados: AparenciasDados = DADOS, rnd: () => number = Math.random): Aparencia {
  const corpos = (dados.corpos ?? []).filter((c) => (c.sexo ?? "f") === "f");
  if (!corpos.length) return { corpo: "heroina", cabeca: "propria" };
  const corpo = corpos[Math.floor(rnd() * corpos.length)];
  const cabecas = ["propria", ...(dados.cabecas ?? []).filter((c) => cabeNoCorpo(corpo, c)).map((c) => c.nome)];
  return { corpo: corpo.nome, cabeca: cabecas[Math.floor(rnd() * cabecas.length)] };
}

/** Valida visuais de recrutáveis ao carregar saves antigos. */
export function aparenciaRecrutavel(ap?: Aparencia, dados: AparenciasDados = DADOS): boolean {
  if (!ap) return false;
  if (!dados.corpos?.length) return ap.corpo === "heroina" && ap.cabeca === "propria";
  const corpo = dados.corpos.find((c) => c.nome === ap.corpo);
  if (!corpo || (corpo.sexo ?? "f") !== "f") return false;
  return ap.cabeca === "propria" || !!dados.cabecas?.some((c) => c.nome === ap.cabeca && cabeNoCorpo(corpo, c));
}

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c: ArrayLike<number>, o: number) => 0.3 * c[o] + 0.59 * c[o + 1] + 0.11 * c[o + 2];
/* rgb 0..1 ⇄ CIELAB (D65), para deslocar os detalhes do rosto junto com a pele */
const M_XYZ = [0.4124, 0.3576, 0.1805, 0.2126, 0.7152, 0.0722, 0.0193, 0.1192, 0.9505],
  M_RGB = [3.2406, -1.5372, -0.4986, -0.9689, 1.8758, 0.0415, 0.0557, -0.204, 1.057],
  BRANCO = [0.95047, 1, 1.08883];
function paraLab(r: number, g: number, b: number) {
  const l = [r, g, b].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)),
    f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29),
    [x, y, z] = [0, 1, 2].map((i) =>
      f((M_XYZ[i * 3] * l[0] + M_XYZ[i * 3 + 1] * l[1] + M_XYZ[i * 3 + 2] * l[2]) / BRANCO[i]),
    );
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function deLab(L: number, a: number, b: number) {
  const y = (L + 16) / 116,
    fi = (t: number) => (t > 6 / 29 ? t ** 3 : (108 / 841) * (t - 4 / 29)),
    xyz = [fi(y + a / 500) * BRANCO[0], fi(y) * BRANCO[1], fi(y - b / 200) * BRANCO[2]];
  return [0, 1, 2].map((i) => {
    const c = M_RGB[i * 3] * xyz[0] + M_RGB[i * 3 + 1] * xyz[1] + M_RGB[i * 3 + 2] * xyz[2];
    return Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  });
}
/**
 * v8.1 — troca a cor da pele e do cabelo de uma pele montada (cor por triângulo). Quem é pele e quem é cabelo vem da
 * máscara feita na ferramenta (tools/lib/mascara.ts: 1 pele, 2 cabelo), não da cor: pela cor, o couro marrom da heroína
 * virava pele e o delineado dos olhos virava cabelo. Cada triângulo marcado passa à cor nova, na luz dele em relação à
 * mediana da parte (a sombra e os reflexos das mechas ficam; TINGIR.contraste). Em triângulos com textura, a cor do
 * vértice multiplica a imagem: usamos a cor-base registrada para trocar o matiz sem apagar a pintura. Os detalhes do
 * rosto (3: pálpebras, sombra, boca) acompanham a pele. Máscara de outro tamanho: não tinge.
 */
export function tingir(
  A: Anim,
  mascara: ArrayLike<number>,
  pele?: string,
  cabelo?: string,
  refs: { pele?: number[]; cabelo?: number[] } = {},
): Anim {
  const nt = A.I.length / 3;
  if ((!pele && !cabelo) || mascara.length !== nt) return A;
  const C = Float32Array.from(A.C);
  const texturizado = (t: number) => {
    const o = t * 3;
    return !!A.tex && A.C[o] >= 0.999 && A.C[o + 1] >= 0.999 && A.C[o + 2] >= 0.999;
  };
  const multiplicarTextura = (t: number, cor: string, base?: number[]) => {
    const alvo = hexRgb(cor),
      origem = base?.length === 3 ? base : [255, 255, 255];
    for (let e = 0; e < 3; e++) C[t * 3 + e] = Math.min(4, alvo[e] / Math.max(1, origem[e]));
  };
  if (pele) {
    const canal: number[][] = [[], [], []];
    for (let t = 0; t < nt; t++)
      if (mascara[t] === 1 && !texturizado(t)) for (let e = 0; e < 3; e++) canal[e].push(A.C[t * 3 + e]);
    const med = canal[0].length
      ? canal.map((l) => l.sort((a, b) => a - b)[l.length >> 1])
      : refs.pele?.length === 3
        ? refs.pele.map((v) => v / 255)
        : null;
    if (med) {
      const de = paraLab(med[0], med[1], med[2]),
        alvo = hexRgb(pele).map((v) => v / 255),
        para = paraLab(alvo[0], alvo[1], alvo[2]),
        d = [0, 1, 2].map((e) => para[e] - de[e]);
      for (let t = 0; t < nt; t++) {
        if (mascara[t] !== 3 || texturizado(t)) continue;
        const q = paraLab(A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]);
        C.set(deLab(q[0] + d[0], q[1] + d[1], q[2] + d[2]), t * 3);
      }
    }
    for (let t = 0; t < nt; t++) if (mascara[t] === 3 && texturizado(t)) multiplicarTextura(t, pele, refs.pele);
  }
  for (const [parte, cor, k, refCor] of [
    [1, pele, TINGIR.contraste.pele, refs.pele],
    [2, cabelo, TINGIR.contraste.cabelo, refs.cabelo],
  ] as const) {
    if (!cor) continue;
    const ls: number[] = [];
    for (let t = 0; t < nt; t++) if (mascara[t] === parte && !texturizado(t)) ls.push(lum(A.C, t * 3));
    const ref = ls.sort((a, b) => a - b)[ls.length >> 1] || 1,
      alvo = hexRgb(cor);
    for (let t = 0; t < nt; t++) {
      if (mascara[t] !== parte) continue;
      if (texturizado(t)) {
        multiplicarTextura(t, cor, refCor ?? undefined);
        continue;
      }
      const f = Math.max(TINGIR.luz[0], Math.min(TINGIR.luz[1], 1 + (lum(A.C, t * 3) / ref - 1) * k));
      for (let e = 0; e < 3; e++) C[t * 3 + e] = Math.min(1, (alvo[e] * f) / 255);
    }
  }
  return { ...A, C };
}

/** v8.1 — os corpos e as cabeças que existem (o controle de qualidade do Modo Editor, editor/aparencias_qc.ts);
 *  "propria" = a cabeça do próprio corpo. */
export function opcoesAparencia() {
  return {
    corpos: (DADOS.corpos ?? []).map((c) => ({ nome: c.nome, rotulo: c.rotulo, peso: c.peso, sexo: c.sexo })),
    cabecas: [
      { nome: "propria", rotulo: "Própria do corpo", peso: 0, sexo: undefined as string | undefined },
      ...(DADOS.cabecas ?? []).map((c) => ({ nome: c.nome, rotulo: c.rotulo, peso: c.peso, sexo: c.sexo })),
    ],
  };
}

/** v8.1 — o pescoço da cabeça trocada: a quantos u abaixo do queixo ele já é todo da junta Neck, e quanto ele
 *  engrossa até lá (fração da largura) */
const PESCOCO = { dobra: 1.3, alarga: 0.35 };
/**
 * O corpo sem cabeça com a cabeça presa à junta Head (pose de bind, espaço do jogo). Puro: usado no jogo e por
 * tools/gerar-aparencias.ts nas prévias.
 */
export function comporPele(corpo: Anim, cab: CabecaDados, enc: Encaixe): Anim {
  const hp = new Int16Array(bytes(cab.p).buffer),
    hi = new Uint16Array(bytes(cab.i).buffer),
    hc = bytes(cab.c);
  const nvC = corpo.P.length / 3,
    nvH = hp.length / 3,
    nv = nvC + nvH;
  const head = corpo.juntas.indexOf("Head"),
    neck = corpo.juntas.indexOf("Neck");
  const P = new Float32Array(nv * 3),
    J = new Uint8Array(nv * 4),
    W = new Float32Array(nv * 4);
  P.set(corpo.P);
  J.set(corpo.J);
  W.set(corpo.W);
  // A máscara é por triângulo; compartilhamentos pele/cabelo ficam fora do pescoço.
  // Cabelo comprido não pode deslocar o eixo nem dobrar como a pele do pescoço.
  const mascara = cab.mascara ? bytes(cab.mascara) : null,
    comMascara = !!mascara && mascara.length === hi.length / 3,
    partes = new Uint8Array(nvH);
  if (comMascara) {
    for (let t = 0; t < hi.length / 3; t++) {
      const parte = mascara![t] === 1 ? 1 : mascara![t] === 2 ? 2 : 0;
      for (let k = 0; k < 3; k++) partes[hi[t * 3 + k]] |= parte;
    }
  }
  const pelePescoco = (v: number) => !comMascara || ((partes[v] & 1) !== 0 && (partes[v] & 2) === 0);
  // O eixo vem somente da pele central abaixo do queixo; o cabelo não alarga junto com ele.
  let ex = 0,
    ez = 0,
    en = 0;
  for (let v = 0; v < nvH; v++) {
    const y = hp[v * 3 + 1] / 1000;
    if (pelePescoco(v) && y < -0.2 && Math.abs(hp[v * 3] / 1000) < 0.9) {
      ex += hp[v * 3] / 1000;
      ez += hp[v * 3 + 2] / 1000;
      en++;
    }
  }
  if (en) {
    ex /= en;
    ez /= en;
  }
  const u = enc.u,
    uT = enc.uTroca ?? u,
    baseX = enc.nariz + ez * u,
    baseZ = enc.meio - ex * u;
  for (let v = 0; v < nvH; v++) {
    let x = hp[v * 3] / 1000,
      z = hp[v * 3 + 2] / 1000;
    const y = hp[v * 3 + 1] / 1000,
      o = (nvC + v) * 3;
    // v8.1 — abaixo do queixo o pescoço engrossa até a base (PESCOCO.alarga): preenche a abertura do pescoço do
    // corpo, em vez de deixar um vão escuro entre os dois
    if (pelePescoco(v) && y < 0 && en) {
      const k = 1 + PESCOCO.alarga * Math.min(1, -y / PESCOCO.dobra);
      x = ex + (x - ex) * k;
      z = ez + (z - ez) * k;
    }
    // vista de frente → jogo: a frente (z) vai para +x, a direita de quem olha (x) para -z. v8.1 — no tamanho padrão
    // (uT), preservando a referência de encaixe definida para cada corpo
    P[o] = baseX + (z - ez) * uT;
    P[o + 1] = enc.queixo + y * uT;
    P[o + 2] = baseZ - (x - ex) * uT;
    // v8.1 — abaixo do queixo o pescoço passa da cabeça para a junta Neck (PESCOCO.dobra u até ser todo dela): dobra
    // junto com o pescoço do corpo, em vez de ficar rígido e abrir um vão
    const wn = neck < 0 || y >= 0 || !pelePescoco(v) ? 0 : Math.min(1, -y / PESCOCO.dobra);
    J[(nvC + v) * 4] = head;
    W[(nvC + v) * 4] = 1 - wn;
    if (wn) {
      J[(nvC + v) * 4 + 1] = neck;
      W[(nvC + v) * 4 + 1] = wn;
    }
  }
  const I = new Uint16Array(corpo.I.length + hi.length);
  I.set(corpo.I);
  for (let k = 0; k < hi.length; k++) I[corpo.I.length + k] = hi[k] + nvC;
  const C = new Float32Array(corpo.C.length + hc.length);
  C.set(corpo.C);
  for (let k = 0; k < hc.length; k++) C[corpo.C.length + k] = hc[k] / 255;
  // v8.1 — a cabeça com textura (a pintura das estilizadas, a do Tripo nas masculinas): ela vai pelo UV dela e o corpo
  // aponta para o pixel branco (fica com a cor por triângulo). Sem isso a cor dela, branca onde a textura manda, saía
  // branca no jogo. A textura do corpo, se houver, não entra (uma só por malha)
  let UV: Float32Array | undefined;
  if (cab.tex && cab.uv && cab.branco) {
    const huv = new Uint16Array(bytes(cab.uv).buffer),
      ntC = corpo.I.length / 3;
    UV = new Float32Array((I.length / 3) * 6);
    for (let t = 0; t < ntC; t++) for (let k = 0; k < 6; k++) UV[t * 6 + k] = cab.branco[k % 2];
    for (let k = 0; k < huv.length; k++) UV[ntC * 6 + k] = huv[k] / 65535;
  }
  // cantos de cada vértice (CSR), como decodificarAnim
  const ini = new Uint32Array(nv + 1);
  for (let k = 0; k < I.length; k++) ini[I[k] + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const cantos = new Uint32Array(I.length),
    pos = ini.slice(0, nv);
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  return { ...corpo, P, J, W, I, C, ini, cantos, UV, tex: UV ? cab.tex : undefined };
}

/** Resolve o alias da cabeça própria também na seleção das roupas feitas para cada combinação. */
export function cabecaDaAparencia(ap: Aparencia, dados: AparenciasDados = DADOS) {
  return ap.cabeca === "propria"
    ? (dados.corpos?.find((c) => c.nome === ap.corpo)?.cabecaPadrao ?? ap.cabeca)
    : ap.cabeca;
}

/* ---------- no jogo: a pele de cada aparência, montada uma vez ---------- */
const PELES = new Map<string, Anim | DadosAnim | null>();
/**
 * A pele de uma aparência para trocarPele (animado.ts): null = a heroína de sempre; `propria` de outro corpo pede os
 * dados dele a `dadosPropria` (a líder e as deusas vêm de vestidos.json; "heroina" = a heroína, para tingir). v8.1 —
 * com `pele`/`cabelo`, as cores trocadas (tingir).
 */
export function peleDaAparencia(
  ap: Aparencia | undefined,
  dadosPropria: (corpo: string) => DadosAnim | null,
  fontes = FONTES,
) {
  if (!ap) return null;
  const dados = fontes.aparencias;
  const cabeca = cabecaDaAparencia(ap, dados);
  if (cabeca !== ap.cabeca) ap = { ...ap, cabeca };
  const k = ap.corpo + "|" + ap.cabeca + "|" + (ap.pele ?? "") + "|" + (ap.cabelo ?? "");
  // Fontes alternativas permitem conferir a montagem sem misturar o cache dos dados do jogo.
  const guardar = fontes === FONTES;
  if (guardar && PELES.has(k)) return PELES.get(k)!;
  const integral = fontes.bustos.combinacoes?.find((v) => v.corpo === ap.corpo && v.cabeca === ap.cabeca);
  if (integral) {
    const d = integral.anim;
    let pele: Anim | DadosAnim = d.texDe ? { ...d, tex: fontes.bustos.texturas?.[d.texDe] ?? d.tex } : d;
    if (ap.pele || ap.cabelo) {
      const anim = decodificarAnim(pele),
        mascara = bytes(integral.mascara);
      const regiao = integral.regiaoPele ? bytes(integral.regiaoPele) : null;
      if (regiao?.length === mascara.length) {
        const inferior = Uint8Array.from(mascara, (v, t) => (regiao[t] === 0 ? v : 0));
        const superior = Uint8Array.from(mascara, (v, t) => (regiao[t] !== 0 ? v : 0));
        pele = tingir(
          tingir(anim, inferior, ap.pele, ap.cabelo, {
            pele: integral.refPeleInferior ?? integral.refPele,
            cabelo: integral.refCabelo,
          }),
          superior,
          ap.pele,
          ap.cabelo,
          { pele: integral.refPele, cabelo: integral.refCabelo },
        );
      } else pele = tingir(anim, mascara, ap.pele, ap.cabelo, { pele: integral.refPele, cabelo: integral.refCabelo });
    }
    if (guardar) PELES.set(k, pele);
    return pele;
  }
  let pele: Anim | DadosAnim | null = null;
  const corpo = dados.corpos?.find((c) => c.nome === ap.corpo),
    cab0 = dados.cabecas?.find((c) => c.nome === ap.cabeca),
    // v8.1 — a textura compartilhada (texDe) entra como a da cabeça
    cab = cab0?.texDe ? { ...cab0, tex: dados.texturas?.[cab0.texDe] } : cab0,
    peleEscolhida = ap.pele,
    cor = !!(peleEscolhida || ap.cabelo);
  if (ap.cabeca === "propria") pele = ap.corpo === "heroina" && !cor ? null : dadosPropria(ap.corpo);
  else if (corpo && cab) pele = comporPele(decodificarAnim({ ...corpo.semCabeca, clips: {} }), cab, corpo.encaixe);
  if (pele && cor && corpo) {
    // a máscara: a do corpo inteiro com a cabeça própria, ou a do corpo sem cabeça seguida da cabeça (comporPele)
    const m =
      ap.cabeca === "propria"
        ? corpo.mascaraPropria && bytes(corpo.mascaraPropria)
        : corpo.mascara && cab?.mascara && Uint8Array.from([...bytes(corpo.mascara), ...bytes(cab.mascara)]);
    const refs =
      ap.cabeca === "propria"
        ? { pele: corpo.refPeleCorpo ?? corpo.refPele, cabelo: corpo.refCabelo }
        : {
            pele: cab?.refPele ?? corpo.refPeleCorpo ?? corpo.refPele,
            cabelo: cab?.refCabelo ?? corpo.refCabelo,
          };
    if (m) {
      const anim = "ini" in pele ? pele : decodificarAnim(pele);
      if (ap.cabeca !== "propria" && cab && corpo.mascara) {
        // Cada região usa a referência da sua própria malha.
        const limite = bytes(corpo.mascara).length;
        const mascaraCorpo = Uint8Array.from(m, (v, i) => (i < limite ? v : 0));
        const mascaraCabeca = Uint8Array.from(m, (v, i) => (i >= limite ? v : 0));
        const corpoTingido = tingir(anim, mascaraCorpo, peleEscolhida, ap.cabelo, {
          pele: corpo.refPeleCorpo ?? corpo.refPele,
          cabelo: corpo.refCabelo,
        });
        pele = tingir(corpoTingido, mascaraCabeca, peleEscolhida, ap.cabelo, refs);
      } else pele = tingir(anim, m, peleEscolhida, ap.cabelo, refs);
    }
  }
  const ajuste = ENCAIXES[ap.corpo + "|" + ap.cabeca];
  if (pele && corpo && cab?.mascara && ajuste) {
    const anim = "ini" in pele ? pele : decodificarAnim(pele);
    const corCabeca = ap.pele
      ? [1, 3, 5].map((i) => parseInt(ap.pele!.slice(i, i + 2), 16) / 255)
      : (cab.refPele ?? corpo.refPele ?? [220, 140, 100]).map((v) => v / 255);
    pele = unirPescoco(
      anim,
      bytes(corpo.semCabeca.malha.i).length / 6,
      bytes(cab.mascara),
      ajuste,
      corCabeca,
      cab.branco,
    ).malha;
  }
  if (guardar) PELES.set(k, pele);
  return pele;
}
