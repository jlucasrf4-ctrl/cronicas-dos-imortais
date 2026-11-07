/* v7.7 — converte o .glb animado da heroína (rig do Tripo/Mixamo) para o jogo (src/assets/models/heroina_anim.json).

   Uso:  node tools/gerar-animacoes.ts [plano.json]      (padrão tools/modelos/heroina_animacoes.json)
   O plano diz o .glb, as juntas que ficam (os dedos e as pontas passam o peso para o osso pai), a altura no jogo e
   os clips: { "<nome no jogo>": { "de": "<animação do .glb>", "t0", "t1" (trecho, s), "noLugar" (tira o avanço
   do quadril em x/z) } }. Também grava "parada": o quadro do andar com os pés mais juntos.
   Saída (lida por src/render/gl/esqueleto.ts): malha soldada (posições Int16 ×64 no espaço do jogo, 4 juntas e 4
   pesos por vértice, índices, uma cor por triângulo), hierarquia, translações de repouso, matrizes inversas de bind
   já convertidas, e por clip a rotação local de cada junta por quadro (Int16) e a translação do quadril.
   Prévias (tiras de quadros de cada clip, desenhadas com o código do jogo) em build/modelos/heroina_anim/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { lerRig, poseLocal, poseGlobal, coresDasFaces, m4mul, type M4, type Rig } from "./lib/esqueleto.ts";
import { desenhar } from "./lib/glb.ts";
import { globaisFbx, lerFbxDe, retargetPose } from "./lib/retarget.ts";
import { vestirRig } from "./lib/vestir.ts";
import { lab } from "./lib/mascara.ts";
import { decodificarAnim, poseClip, matrizesPose, deformarMalha } from "../src/render/gl/esqueleto.ts";

interface PlanoAnim {
  arquivo: string;
  saida: string;
  previas: string;
  alturaJogo: number;
  fps: number;
  juntas: string[];
  /** pose T do esqueleto do Mixamo (FBX), referência para os clips "fbx" (retarget, tools/lib/retarget.ts) */
  bindMixamo?: string;
  /** "de": animação do .glb; "fbx": arquivo FBX do Mixamo ("pacote.zip/arquivo.fbx" também vale); "bind": a pose T
   *  de referência deste clip no lugar de bindMixamo — "proprio" = o repouso do próprio FBX (animação baixada noutro
   *  personagem do Mixamo, ex.: o genérico Ch12, cujo esqueleto não é o da heroína); "quadro0" = a pose T de referência
   *  para as rotações e o 1º quadro do clip para a altura do quadril (o Walking.fbx, baixado noutro personagem) */
  clips: Record<string, { de?: string; fbx?: string; t0?: number; t1?: number; noLugar?: boolean; bind?: string }>;
  /** outra malha em pose T (saída de tools/pintar-modelo.ts) vestida neste esqueleto, no lugar da do .glb */
  vestir?: string;
  /** marco lateral dos pés em metros: mantém a abertura de pernas do rig em modelos de T-pose muito fechada */
  marcoPe?: number;
  /** com "vestir": gira as pernas da malha para fora (no quadril) na direção da abertura dos pés do rig — para
   *  modelos de pernas coladas na pose T (a deusa do outono nova cruzava as pernas ao andar). true ou 1 = a abertura
   *  do rig; 0.5 = metade do caminho (as canelas mais juntas) */
  abrirPernas?: boolean | number;
  /** v8.1 — com "vestir": abaixo da virilha cada vértice só segue a perna do lado dele (coxas encostadas: o M06) */
  pernasPorLado?: boolean;
  /** v8.1 — com "vestir": o ombro do rig medido na malha (a junta do braço acompanha corpos largos); ver lib/vestir.ts */
  ombroMedido?: boolean;
  /** v8.1 — com "vestir": o cotovelo e o pulso da malha nova (distância ao meio do corpo, frações da altura, lidos numa
   *  vista do braço com régua); sem eles, o braço do rig vai à malha pela proporção da heroína */
  bracoMarcos?: { cotovelo: number; pulso: number };
  /** v8.1 — com "vestir": a partir de que distância à malha da heroína (fração da altura; padrão 0,03) um vértice é
   *  "pano solto" (num corpo largo, 0,07: o quadril não é pano) */
  soltoLimite?: number;
  /** v8.1 — com "vestir": passadas de média dos pesos com os vizinhos (sem degrau entre um osso e outro) */
  suavizarPesos?: number;
  /** com "vestir": a pele do pescoço para baixo (sem o cabelo solto) toma a cor `cor` (rgb 0..255), com a luz de cada
   *  triângulo; `mistura` = quanto da cor original fica (as marcas somem aos poucos); `ate` = a altura do pescoço
   *  (fração; acima dela, até o topo da testa, só a pele clara do rosto muda).
   *  A deusa do outono nova tinha manchas vermelhas demais. */
  pele?: { cor: number[]; mistura: number; ate: number };
  /** v8.1 — trocar a cor de uma peça clara da roupa (recolorirRoupa) */
  roupa?: {
    cor: number[];
    yMin: number;
    yMax: number;
    lado: number;
    claroMin: number;
    cromaMax: number;
    contraste: number;
  };
  /** engrossa os braços da malha em volta do osso (pose de bind), pelo peso de cada vértice no osso: `ombro` no
   *  começo do braço (o deltoide), `braco` no cotovelo, `antebraco` no antebraço (× a distância ao eixo) */
  encorpar?: { ombro: number; braco: number; antebraco: number };
  /** busto (pose de bind): duas elevações suaves para a frente do peito, centradas `dy` acima da junta Spine2 e `dx`
   *  para cada lado, de raio `raio`, saindo `quanto` (tudo em fração da altura) */
  busto?: { dx: number; dy: number; raio: number; quanto: number; lado?: number; sombra?: number };
  /** postura em todos os clips: por junta, graus a mais em volta do eixo lateral do corpo (+ = para trás: endireita a
   *  coluna e recua a cabeça; a heroína ficava curvada, com os ombros e a cabeça para a frente) */
  postura?: Record<string, number>;
  /** com "vestir": o pano solto entre as pernas (tabardo) vai só com o quadril */
  panoEntrePernas?: boolean;
}

const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

/** Inversa de uma matriz rígida com escala uniforme (rotação·escala + translação). */
function inversaRigida(m: M4): M4 {
  const s2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
  const o = new Float64Array(16);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c] / s2;
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  o[15] = 1;
  return o;
}

/** Ajuste `encorpar`: cada vértice preso ao braço (ou antebraço) se afasta do eixo do osso, ombro→cotovelo (ou
 *  cotovelo→mão), pelo fator do trecho × o peso dele naquele osso. A malha muda só na pose de bind; os pesos e o
 *  esqueleto ficam. */
function encorparBracos(
  rig: Rig,
  idxNo: (nome: string) => number,
  f: { ombro: number; braco: number; antebraco: number },
) {
  const pos = (no: number) => {
    const m = inversaRigida(rig.ibm[rig.juntas.indexOf(no)]);
    return [m[12], m[13], m[14]];
  };
  for (const lado of ["Left", "Right"]) {
    const S = pos(idxNo(lado + "Arm")),
      E = pos(idxNo(lado + "ForeArm")),
      H = pos(idxNo(lado + "Hand")),
      jBraco = rig.juntas.indexOf(idxNo(lado + "Arm")),
      jAnte = rig.juntas.indexOf(idxNo(lado + "ForeArm"));
    const trechos: [number[], number[], number, (t: number) => number][] = [
      [S, E, jBraco, (t) => f.ombro + (f.braco - f.ombro) * t],
      [E, H, jAnte, () => f.antebraco],
    ];
    for (let v = 0; v < rig.P.length / 3; v++)
      for (const [A, B, j, fator] of trechos) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (rig.J[v * 4 + k] === j) w += rig.W[v * 4 + k];
        if (w <= 0) continue;
        const ab = [0, 1, 2].map((c) => B[c] - A[c]),
          av = [0, 1, 2].map((c) => rig.P[v * 3 + c] - A[c]),
          t = Math.min(
            1,
            Math.max(0, (av[0] * ab[0] + av[1] * ab[1] + av[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)),
          ),
          k = 1 + (fator(t) - 1) * w;
        for (let c = 0; c < 3; c++) {
          const centro = A[c] + ab[c] * t;
          rig.P[v * 3 + c] = centro + (rig.P[v * 3 + c] - centro) * k;
        }
      }
  }
}

/** Ajuste `busto`: os vértices da frente do peito (na frente da junta Spine2, +Z do .glb) avançam por duas cúpulas
 *  (uma de cada lado) e se abrem para o lado (`lado` × o avanço: a silhueta de frente muda); o quanto some para trás,
 *  para as costas e os braços não mexerem. Devolve, por vértice, o peso do busto e a altura relativa ao centro (em
 *  raios), para as cores (sombraBusto). */
function fazerBusto(
  rig: Rig,
  idxNo: (nome: string) => number,
  b: { dx: number; dy: number; raio: number; quanto: number; lado?: number },
) {
  const nv = rig.P.length / 3,
    peso = new Float32Array(nv),
    rel = new Float32Array(nv),
    relX = new Float32Array(nv);
  let y0 = Infinity,
    y1 = -Infinity;
  for (let i = 1; i < rig.P.length; i += 3) {
    y0 = Math.min(y0, rig.P[i]);
    y1 = Math.max(y1, rig.P[i]);
  }
  const h = y1 - y0,
    m = inversaRigida(rig.ibm[rig.juntas.indexOf(idxNo("Spine2"))]),
    [sx, sy, sz] = [m[12], m[13], m[14]],
    cy = sy + b.dy * h,
    R2 = (b.raio * h) ** 2;
  let n = 0;
  for (let v = 0; v < nv; v++) {
    const x = rig.P[v * 3],
      y = rig.P[v * 3 + 1],
      z = rig.P[v * 3 + 2];
    // para a frente só a face da frente; para o lado, também a lateral do peito (um pouco atrás da junta)
    const frente = Math.min(1, Math.max(0, (z - sz) / (0.04 * h))),
      lateral = Math.min(1, Math.max(0, (z - sz + 0.03 * h) / (0.05 * h)));
    if (lateral <= 0) continue;
    // cúpula (1 − d²/R²)^1,5: topo arredondado e base suave (a gaussiana estreita fazia um cone)
    const cupula = (dx: number) => {
        const q = 1 - ((x - sx - dx) ** 2 + (y - cy) ** 2) / R2;
        return q > 0 ? q ** 1.5 : 0;
      },
      gD = cupula(b.dx * h),
      gE = cupula(-b.dx * h),
      g = Math.max(gD, gE);
    if (g < 0.01) continue;
    rig.P[v * 3 + 2] = z + b.quanto * h * g * frente;
    // abre para fora de cada lado (o lado da cúpula que manda)
    rig.P[v * 3] = x + (b.lado ?? 0) * b.quanto * h * (gD - gE) * lateral;
    peso[v] = g * frente;
    rel[v] = (y - cy) / (b.raio * h);
    relX[v] = (x - sx) / (b.dx * h);
    n++;
  }
  return { texto: `busto: ${n} vértices`, peso, rel, relX };
}

/** As cores do busto (`forca`), pelo peso médio de cada triângulo: em cima mais claro (onde bate a luz da câmera de
 *  cima), a dobra de baixo e o vão do meio mais escuros — de frente, no colete escuro, é o que mostra o volume. */
function sombraBusto(
  rig: Rig,
  C8: Uint8Array,
  B: { peso: Float32Array; rel: Float32Array; relX: Float32Array },
  forca: number,
) {
  for (let t = 0; t < C8.length / 3; t++) {
    const vs = [rig.I[t * 3], rig.I[t * 3 + 1], rig.I[t * 3 + 2]],
      w = (B.peso[vs[0]] + B.peso[vs[1]] + B.peso[vs[2]]) / 3;
    if (w < 0.05) continue;
    const r = (B.rel[vs[0]] + B.rel[vs[1]] + B.rel[vs[2]]) / 3,
      ax = Math.abs((B.relX[vs[0]] + B.relX[vs[1]] + B.relX[vs[2]]) / 3),
      // como uma esfera iluminada: o centro de cada cúpula claro, a borda escura; a dobra de baixo (r < −0,6) e o vão
      // do meio (|x| < metade do afastamento) escuros
      vao = ax < 0.5 && r > -1 && r < 0.6 ? 0.6 * (1 - ax / 0.5) : 0,
      dobra = r < -0.6 ? Math.min(1, (-r - 0.6) / 0.6) : 0,
      k = 0.9 * (w - 0.35) - dobra - vao,
      f = 1 + forca * k;
    for (let c = 0; c < 3; c++) C8[t * 3 + c] = Math.round(Math.min(255, C8[t * 3 + c] * f));
  }
}

/** v8.1 — ajuste `roupa` (mantenedor: "a blusa da heroína às vezes se confunde com a pele"): cada triângulo claro e
 *  pouco saturado (L* ≥ `claroMin`, croma ≤ `cromaMax`) na faixa de altura [`yMin`, `yMax`] (fração da altura) e a até
 *  `lado` (fração da altura) do meio passa à cor `cor`, na luz dele em relação à mediana dos escolhidos (× `contraste`). */
function recolorirRoupa(
  rig: Rig,
  C8: Uint8Array,
  p: { cor: number[]; yMin: number; yMax: number; lado: number; claroMin: number; cromaMax: number; contraste: number },
) {
  let y0 = Infinity,
    y1 = -Infinity;
  for (let i = 1; i < rig.P.length; i += 3) {
    y0 = Math.min(y0, rig.P[i]);
    y1 = Math.max(y1, rig.P[i]);
  }
  const h = y1 - y0,
    lum = (t: number) => 0.3 * C8[t * 3] + 0.59 * C8[t * 3 + 1] + 0.11 * C8[t * 3 + 2],
    alvos: number[] = [];
  for (let t = 0; t < C8.length / 3; t++) {
    const vs = [rig.I[t * 3], rig.I[t * 3 + 1], rig.I[t * 3 + 2]],
      y = (vs.reduce((s, v) => s + rig.P[v * 3 + 1], 0) / 3 - y0) / h,
      x = vs.reduce((s, v) => s + rig.P[v * 3], 0) / 3 / h,
      L = lab(C8[t * 3], C8[t * 3 + 1], C8[t * 3 + 2]);
    if (y > p.yMin && y < p.yMax && Math.abs(x) < p.lado && L[0] >= p.claroMin && Math.hypot(L[1], L[2]) <= p.cromaMax)
      alvos.push(t);
  }
  const ls = alvos.map(lum).sort((a, b) => a - b),
    ref = ls[ls.length >> 1] || 1;
  for (const t of alvos) {
    const f = Math.max(0.6, Math.min(1.3, 1 + (lum(t) / ref - 1) * p.contraste));
    for (let c = 0; c < 3; c++) C8[t * 3 + c] = Math.round(Math.min(255, p.cor[c] * f));
  }
  return `roupa: ${alvos.length} de ${C8.length / 3} triângulos recoloridos`;
}

/** Ajuste `pele`: cada triângulo do corpo (abaixo de `ate` da altura, fora do cabelo solto) com cor de pele ou de
 *  tinta vermelha (matiz −20°–45°; o dourado forte dos enfeites fica; o cabelo sai por ser solto) passa à
 *  cor `cor`, na luz dele (o valor relativo à mediana dos recoloridos), misturada com a original. */
function recolorirPele(
  rig: Rig,
  C8: Uint8Array,
  soltos: Uint8Array | null,
  p: { cor: number[]; mistura: number; ate: number },
) {
  let y0 = Infinity,
    y1 = -Infinity;
  for (let i = 1; i < rig.P.length; i += 3) {
    y0 = Math.min(y0, rig.P[i]);
    y1 = Math.max(y1, rig.P[i]);
  }
  const corte = y0 + (y1 - y0) * p.ate,
    pernas = y0 + (y1 - y0) * 0.5,
    rosto = y0 + (y1 - y0) * 0.95,
    alvos: number[] = [],
    valor = (t: number) => Math.max(C8[t * 3], C8[t * 3 + 1], C8[t * 3 + 2]) / 255;
  for (let t = 0; t < C8.length / 3; t++) {
    const vs = [rig.I[t * 3], rig.I[t * 3 + 1], rig.I[t * 3 + 2]];
    const y = (rig.P[vs[0] * 3 + 1] + rig.P[vs[1] * 3 + 1] + rig.P[vs[2] * 3 + 1]) / 3;
    if (y > rosto) continue;
    // solto = longe do corpo do rig: só as mechas soltas do cabelo acima do pescoço (o busto e a perna aberta também
    // ficam longe do corpo da heroína; o cabelo nas costas sai pela cor, abaixo)
    if (y > corte && soltos && vs.some((v) => soltos[v])) continue;
    const [r, g, b] = [C8[t * 3], C8[t * 3 + 1], C8[t * 3 + 2]].map((q) => q / 255),
      mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      s = mx ? (mx - mn) / mx : 0,
      clara = s < 0.2 && mx > 0.45; // pele clara acinzentada (qualquer matiz)
    if (!clara && (mx === mn || mx !== r)) continue; // pele e tinta: o vermelho manda
    const h = clara ? 20 : ((g - b) / (mx - mn)) * 60; // −20° (carmim puxando para o roxo) a 45°
    if (h < -20 || h > 45) continue;
    if (h > 30 && s > 0.5 && mx > 0.6) continue; // dourado dos enfeites
    // acima do pescoço só a pele clara (lábios, olhos e cabelo ficam); no tronco, o carmim forte é o cabelo nas
    // costas (encostado, não conta como solto); nas pernas, todo vermelho é tinta
    if (y > corte && s > 0.4) continue;
    if (y > pernas && h < 8 && s > 0.8) continue;
    alvos.push(t);
  }
  const vals = alvos.map(valor).sort((a, b) => a - b),
    ref = vals[vals.length >> 1] || 1;
  for (const t of alvos) {
    const luz = Math.max(0.7, Math.min(1.2, valor(t) / ref));
    for (let c = 0; c < 3; c++)
      C8[t * 3 + c] = Math.round(Math.min(255, p.cor[c] * luz * (1 - p.mistura) + C8[t * 3 + c] * p.mistura));
  }
  return `pele: ${alvos.length} de ${C8.length / 3} triângulos recoloridos`;
}

async function main() {
  const arqPlano = process.argv[2] ?? "tools/modelos/heroina_animacoes.json";
  const plano = JSON.parse(readFileSync(arqPlano, "utf8")) as PlanoAnim;
  const rig: Rig = await lerRig(plano.arquivo);
  const nomeNo = (i: number) => (rig.nos[i].name ?? "").replace(/^mixamorig:/, "");
  const idxNo = (nome: string) => {
    const i = rig.nos.findIndex((_, k) => nomeNo(k) === nome);
    if (i < 0) throw new Error("junta não encontrada: " + nome);
    return i;
  };
  const nos = plano.juntas.map(idxNo); // nó de cada junta mantida
  // outra malha no mesmo esqueleto (tools/lib/vestir.ts): ajusta as juntas a ela e escala a altura do quadril
  let fq = 1,
    soltos: Uint8Array | null = null;
  if (plano.vestir) {
    const v = await vestirRig(
      rig,
      plano.vestir,
      nos,
      idxNo("LeftArm"),
      !!plano.panoEntrePernas,
      plano.marcoPe,
      plano.abrirPernas === true ? 1 : plano.abrirPernas || 0,
      plano.pernasPorLado,
      plano.ombroMedido,
      plano.bracoMarcos,
      plano.soltoLimite,
      plano.suavizarPesos,
    );
    fq = v.fatorQuadril;
    soltos = v.soltos;
    for (const l of v.info) console.log(l);
  }
  if (plano.encorpar) encorparBracos(rig, idxNo, plano.encorpar);
  const busto = plano.busto ? fazerBusto(rig, idxNo, plano.busto) : null;
  if (busto) console.log(busto.texto);
  const jm = new Map(nos.map((no, j) => [no, j]));
  const paiMantido = (no: number) => {
    let p = rig.pais[no];
    while (p >= 0 && !jm.has(p)) p = rig.pais[p];
    return p >= 0 ? jm.get(p)! : -1;
  };
  const pais = nos.map(paiMantido);
  // junta mantida que recebe o peso de cada junta da skin (ela mesma ou o ancestral mantido mais próximo)
  const destino = rig.juntas.map((no) => {
    let p = no;
    while (p >= 0 && !jm.has(p)) p = rig.pais[p];
    if (p < 0) throw new Error("junta sem ancestral mantido: " + nomeNo(no));
    return jm.get(p)!;
  });

  /* conversão .glb → jogo: frente +Z → +x, direita (-X) → +z, altura 1 → alturaJogo */
  let ymax = 0;
  for (let i = 1; i < rig.P.length; i += 3) ymax = Math.max(ymax, rig.P[i]);
  const S = plano.alturaJogo / ymax;
  const C = new Float64Array([0, 0, -S, 0, 0, S, 0, 0, S, 0, 0, 0, 0, 0, 0, 1]); // colunas: X→(0,0,-S), Y→(0,S,0), Z→(S,0,0)
  const Cinv = inversaRigida(C);
  const raiz = nos[0],
    acimaDaRaiz = rig.pais[raiz] >= 0 ? poseGlobal(rig, null, 0)[rig.pais[raiz]] : null;
  const Craiz = acimaDaRaiz ? m4mul(C, acimaDaRaiz) : C;
  const ibm = nos.map((no) => m4mul(rig.ibm[rig.juntas.indexOf(no)], Cinv));
  const repouso = nos.map((no) => rig.nos[no].translation ?? [0, 0, 0]);

  /* malha: solda por posição, junta os pesos nas juntas mantidas (4 maiores), cor por triângulo */
  const chave = new Map<string, number>(),
    uniq: number[] = [];
  const mapa = new Uint32Array(rig.P.length / 3);
  for (let v = 0; v < mapa.length; v++) {
    const k = `${Math.round(rig.P[v * 3] * 1e5)},${Math.round(rig.P[v * 3 + 1] * 1e5)},${Math.round(rig.P[v * 3 + 2] * 1e5)}`;
    let u = chave.get(k);
    if (u === undefined) chave.set(k, (u = uniq.push(v) - 1));
    mapa[v] = u;
  }
  const nv = uniq.length,
    P16 = new Int16Array(nv * 3),
    J8 = new Uint8Array(nv * 4),
    W8 = new Uint8Array(nv * 4);
  uniq.forEach((v, u) => {
    const x = rig.P[v * 3],
      y = rig.P[v * 3 + 1],
      z = rig.P[v * 3 + 2];
    P16[u * 3] = Math.round(z * S * 64);
    P16[u * 3 + 1] = Math.round(y * S * 64);
    P16[u * 3 + 2] = Math.round(-x * S * 64);
    const soma = new Map<number, number>();
    for (let k = 0; k < 4; k++) {
      const w = rig.W[v * 4 + k];
      if (w > 0) soma.set(destino[rig.J[v * 4 + k]], (soma.get(destino[rig.J[v * 4 + k]]) ?? 0) + w);
    }
    const top = [...soma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = top.reduce((a, b) => a + b[1], 0) || 1;
    // arredonda e acerta a soma em 255 no maior peso (o "resto" no último podia dar -1 e virar 255 no Uint8)
    const qs = top.map(([, w]) => Math.round((w / tot) * 255));
    if (qs.length) qs[0] += 255 - qs.reduce((a, b) => a + b, 0);
    top.forEach(([j], k) => {
      J8[u * 4 + k] = j;
      W8[u * 4 + k] = qs[k];
    });
  });
  const nt = rig.I.length / 3,
    I16 = new Uint16Array(nt * 3);
  for (let i = 0; i < rig.I.length; i++) I16[i] = mapa[rig.I[i]];
  const C8 = coresDasFaces(rig);
  if (plano.pele) console.log(recolorirPele(rig, C8, soltos, plano.pele));
  if (plano.roupa) console.log(recolorirRoupa(rig, C8, plano.roupa));
  if (busto && plano.busto?.sombra) sombraBusto(rig, C8, busto, plano.busto.sombra);

  /* clips: rotação local de cada junta por quadro + translação do quadril */
  const clipsSaida: Record<string, { fps: number; n: number; r: string; q: string }> = {};
  // postura: um giro fixo no espaço da junta (o eixo lateral do corpo, +X do .glb, levado ao repouso dela), depois
  // da rotação do clip
  const correcao = new Map<number, number[]>();
  for (const [nome, graus] of Object.entries(plano.postura ?? {})) {
    const j = nos.indexOf(idxNo(nome)),
      m = inversaRigida(rig.ibm[rig.juntas.indexOf(idxNo(nome))]),
      col = [0, 1, 2].map((c) => {
        const v = [m[c * 4], m[c * 4 + 1], m[c * 4 + 2]],
          l = Math.hypot(v[0], v[1], v[2]) || 1;
        return v.map((q) => q / l);
      }),
      eixo = [col[0][0], col[1][0], col[2][0]], // Rᵀ · (1, 0, 0)
      a = (-graus * Math.PI) / 180 / 2;
    correcao.set(j, [eixo[0] * Math.sin(a), eixo[1] * Math.sin(a), eixo[2] * Math.sin(a), Math.cos(a)]);
  }
  const corrigir = (j: number, q: ArrayLike<number>) => {
    const c = correcao.get(j);
    if (!c) return q;
    const [ax, ay, az, aw] = [q[0], q[1], q[2], q[3]],
      [bx, by, bz, bw] = c;
    return [
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    ];
  };
  const amostrarClip = (nomeGlb: string, t0: number, t1: number, noLugar: boolean, quadros?: number[]) => {
    const clip = rig.clips.find((c) => c.nome === nomeGlb);
    if (!clip) throw new Error("animação não encontrada no .glb: " + nomeGlb);
    const tempos =
      quadros ??
      Array.from({ length: Math.round((t1 - t0) * plano.fps) + 1 }, (_, k) => Math.min(t1, t0 + k / plano.fps));
    const R = new Int16Array(tempos.length * nos.length * 4),
      Q = new Int16Array(tempos.length * 3);
    let desvio = 0;
    tempos.forEach((t, f) => {
      const loc = poseLocal(rig, clip, t);
      nos.forEach((no, j) => {
        const r = corrigir(j, loc[no].r);
        for (let k = 0; k < 4; k++) R[(f * nos.length + j) * 4 + k] = Math.round(r[k] * 32767);
        if (j > 0) for (let k = 0; k < 3; k++) desvio = Math.max(desvio, Math.abs(loc[no].t[k] - repouso[j][k]));
      });
      const tq = loc[raiz].t.map((v) => v * fq);
      const q = noLugar ? [repouso[0][0], tq[1], repouso[0][2]] : tq;
      for (let k = 0; k < 3; k++) Q[f * 3 + k] = Math.round(q[k] * 10000);
    });
    return { fps: plano.fps, n: tempos.length, r: b64(R), q: b64(Q), desvio };
  };
  // clip do Mixamo (FBX): retarget para o esqueleto do Tripo, quadro a quadro
  const bind = plano.bindMixamo ? lerFbxDe(plano.bindMixamo) : null;
  const amostrarFbx = (arq: string, t0: number, t1: number | undefined, noLugar: boolean, bindClip?: string) => {
    const F = lerFbxDe(arq),
      B = bindClip === "proprio" ? F : bindClip && bindClip !== "quadro0" ? lerFbxDe(bindClip) : bind,
      fim = Math.min(t1 ?? F.duracao, F.duracao);
    if (!B) throw new Error("clip fbx sem bindMixamo no plano");
    // "quadro0": rotações pela pose T de referência, o quadril pelo 1º quadro do próprio clip (ver retargetPose)
    const ih = F.ossos.findIndex((o) => o.nome === "Hips"),
      quadril0 = bindClip === "quadro0" && ih >= 0 ? globaisFbx(F, t0).gp[ih] : undefined;
    const tempos = Array.from({ length: Math.round((fim - t0) * plano.fps) + 1 }, (_, k) =>
      Math.min(fim, t0 + k / plano.fps),
    );
    const R = new Int16Array(tempos.length * nos.length * 4),
      Q = new Int16Array(tempos.length * 3);
    tempos.forEach((t, f) => {
      const p = retargetPose(rig, nos, B, F, t, quadril0);
      p.r.forEach((q0, j) => {
        const q = corrigir(j, q0);
        for (let k = 0; k < 4; k++) R[(f * nos.length + j) * 4 + k] = Math.round(q[k] * 32767);
      });
      const q = noLugar ? [repouso[0][0], p.t[1], repouso[0][2]] : p.t; // já na altura do quadril do rig (vestido ou não)
      for (let k = 0; k < 3; k++) Q[f * 3 + k] = Math.round(q[k] * 10000);
    });
    return { fps: plano.fps, n: tempos.length, r: b64(R), q: b64(Q), dur: fim - t0 };
  };
  for (const [nome, c] of Object.entries(plano.clips)) {
    if (c.fbx) {
      const r = amostrarFbx(c.fbx, c.t0 ?? 0, c.t1, !!c.noLugar, c.bind);
      clipsSaida[nome] = { fps: r.fps, n: r.n, r: r.r, q: r.q };
      console.log(
        `${nome} ← ${c.fbx.replace(/^.*[\\/]/, "")} (Mixamo, retarget): ${r.n} quadros, ${r.dur.toFixed(2)} s`,
      );
      continue;
    }
    const dur = rig.clips.find((x) => x.nome === c.de)?.duracao ?? 0;
    const r = amostrarClip(c.de!, c.t0 ?? 0, c.t1 ?? dur, !!c.noLugar);
    clipsSaida[nome] = { fps: r.fps, n: r.n, r: r.r, q: r.q };
    console.log(
      `${nome} ← ${c.de} [${(c.t0 ?? 0).toFixed(2)}–${(c.t1 ?? dur).toFixed(2)} s]: ${r.n} quadros (osso fora do repouso: ${r.desvio.toFixed(4)})`,
    );
  }
  // parada: o quadro do andar com os pés mais juntos (e no chão), se o plano não trouxer uma
  if (!plano.clips.parada) {
    const walk = rig.clips.find((c) => c.nome === plano.clips.andar.de)!; // "andar" vem do .glb
    const pe = [idxNo("LeftFoot"), idxNo("RightFoot")];
    let melhor = 0,
      mm = Infinity;
    for (let t = 0; t <= walk.duracao; t += 1 / plano.fps) {
      const g = poseGlobal(rig, walk, t);
      const m =
        Math.abs(g[pe[0]][14] - g[pe[1]][14]) +
        Math.abs(g[pe[0]][12] - g[pe[1]][12]) * 0.5 +
        2 * Math.abs(g[pe[0]][13] - g[pe[1]][13]);
      if (m < mm) {
        mm = m;
        melhor = t;
      }
    }
    const r = amostrarClip(walk.nome, 0, 0, true, [melhor]);
    clipsSaida.parada = { fps: r.fps, n: 1, r: r.r, q: r.q };
    console.log(`parada ← ${walk.nome} em ${melhor.toFixed(2)} s`);
  }
  const saida = {
    versao: 1,
    juntas: plano.juntas,
    pais,
    repouso: repouso.map((t) => t.map((v) => +v.toFixed(6))),
    raiz: Array.from(Craiz, (v) => +v.toFixed(6)),
    ibm: ibm.map((m) => Array.from(m, (v) => +v.toFixed(6))),
    malha: { p: b64(P16), j: b64(J8), w: b64(W8), i: b64(I16), c: b64(C8) },
    clips: clipsSaida,
  };
  const json = JSON.stringify(saida);
  writeFileSync(plano.saida, json);
  console.log(
    `${plano.saida}: ${(json.length / 1024).toFixed(0)} KB — ${nv} vértices, ${nt} triângulos, ${nos.length} juntas`,
  );

  /* prévias com o código do jogo: 8 quadros de cada clip, de frente e de lado */
  mkdirSync(plano.previas, { recursive: true });
  const A = decodificarAnim(JSON.parse(json));
  const N = 8,
    lado = 200;
  const caixa = { mn: [-34, -2, -34], mx: [34, 46, 34] };
  for (const nome of Object.keys(A.clips)) {
    const clip = A.clips[nome],
      tiles: { input: Buffer; left: number; top: number }[] = [];
    const nq = clip.n > 1 ? N : 1;
    for (let k = 0; k < nq; k++) {
      const pose = poseClip(A, nome, ((clip.n - 1) / clip.fps) * (k / Math.max(1, nq - 1)), false);
      const { p, c } = deformarMalha(A, matrizesPose(A, pose));
      const G: number[] = [];
      for (let i = 0; i < p.length; i += 3) G.push(-p[i + 2], p[i + 1], p[i]); // jogo (frente +x) → prévia (frente +z)
      const I = Array.from({ length: G.length / 3 }, (_, i) => i);
      const cor = (t: number) => [c[t * 9] * 255, c[t * 9 + 1] * 255, c[t * 9 + 2] * 255];
      for (const [v, vista] of (["frente", "lado"] as const).entries()) {
        const arq = join(plano.previas, "_q.png");
        await desenhar(arq, G, I, cor, { vista, W: lado, caixaFixa: caixa });
        tiles.push({
          input: await sharp(arq).resize(lado, lado, { fit: "contain", background: "#262626" }).toBuffer(),
          left: k * lado,
          top: v * lado,
        });
      }
    }
    await sharp({ create: { width: lado * nq, height: lado * 2, channels: 3, background: "#262626" } })
      .composite(tiles)
      .png()
      .toFile(join(plano.previas, nome + ".png"));
  }
  console.log(`prévias em ${plano.previas}`);
}

await main();
