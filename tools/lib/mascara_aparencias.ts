/* v8.1 — a máscara pele/cabelo das aparências (tools/gerar-aparencias.ts): onde ficam as sementes e quanto cada parte
   pode crescer, nas cabeças trocáveis e nos corpos (com a cabeça própria). Medidas de cabeça: 0 = queixo, 1 = linha dos
   olhos, x para o lado, z para a frente (0 = ponta do nariz). Tabela MASCARA: os limites aprovados nas prévias
   (build/previas/mascara/). ==== */
import type { Anim } from "../../src/render/gl/esqueleto.ts";
import type { CorpoDados } from "../../src/render/gl/aparencias.ts";
import { PARTE, crescerJuntos, dE, fecharIlhas, lab, vizinhos, type Crescimento, type Segmentavel } from "./mascara.ts";

export const MASCARA = {
  /** quase: semente em qualquer lugar a até esse ΔE da referência; ilhaMin: a região que nasceu só dela precisa de
   *  tantos triângulos */
  pele: { tolSemente: 16, tolRef: 34, passo: 9, quase: 9, ilhaMin: 80 },
  /** tolRosto: a mecha que entra no rosto de baixo (bochechas) */
  cabelo: { tolSemente: 22, tolRef: 38, passo: 12, tolRosto: 15 },
  /** a segunda passada do cabelo no corpo (só a partir do cabelo, nas juntas da cabeça/coluna/ombros) */
  cabeloCorpo: { tolSemente: 45, tolRef: 45, passo: 22 },
  /** reflexos soltos no cabelo / manchas na pele: até quantos triângulos e a que ΔE da referência */
  ilhaCabelo: { tris: 40, tol: 40 },
  ilhaPele: { tris: 8, tol: 30 },
  /** no corpo (fora do rosto): restos da pintura projetada cercados de pele (as manchas no quadril da líder) */
  ilhaPeleCorpo: { tris: 150, tol: 75, passo: 15, cerco: 0.6 },
  /** detalhes do rosto: ΔE máximo da pele e quanto mais escuros (L*) que ela ainda podem ser */
  /** maxArea: um detalhe maior que isso (u², medida de cabeça) é pele (a testa da líder, de poucos triângulos grandes) */
  rosto: { tol: 42, escuro: 28, maxArea: 0.35 },
};

/** a cabeça em medidas de cabeça (centro de cada triângulo) */
type Medida = (t: number) => { x: number; y: number; z: number };

const naFace = (q: { x: number; y: number; z: number }) => q.y > 0.2 && q.y < 0.9 && Math.abs(q.x) < 0.3 && q.z > -0.6;
/** a frente do pescoço, logo abaixo do queixo */
const noPescoco = (q: { x: number; y: number; z: number }) =>
  q.y > -0.6 && q.y < -0.1 && Math.abs(q.x) < 0.35 && q.z > -1.3 && q.z < -0.4;
/** o rosto de baixo (bochechas, boca, queixo): o cabelo não entra (a franja fica acima, a mecha solta dos lados) */
const rostoBaixo = (q: { x: number; y: number; z: number }) =>
  q.y > -0.2 && q.y < 1.2 && Math.abs(q.x) < 0.65 && q.z > -0.9;
const noTopo = (q: { y: number }) => q.y > 1.9;
/** o rosto inteiro, da boca à testa, e as orelhas */
const noRosto = (q: { x: number; y: number; z: number }) =>
  q.y > -0.3 && q.y < 1.6 && Math.abs(q.x) < 1.2 && q.z > -1.6;
/** a nuca, atrás das orelhas: cabelo em todas as cabeças que temos (nenhuma é careca) */
const atras = (q: { x: number; y: number; z: number }) => q.y > 0.6 && q.y < 1.9 && q.z < -1.5 && Math.abs(q.x) < 0.6;
/** a faixa dos olhos e sobrancelhas, na frente do rosto: o cabelo não entra, e a pele não fecha ilhas ali */
const nosOlhos = (q: { x: number; y: number; z: number }) =>
  q.y > 0.55 && q.y < 1.3 && Math.abs(q.x) < 0.8 && q.z > -0.55;

function segmentar(
  m: Segmentavel,
  med: Medida,
  refsPele: number[][],
  refsCabelo: number[][],
  extra: {
    semPele?: number[];
    podeCabelo?: (t: number) => boolean;
    manter?: number[][];
    corpo?: boolean;
    /** os restos da pintura projetada cercados de pele viram pele (a líder; nas deusas são desenhos de propósito) */
    limparManchas?: boolean;
    /** área de cada triângulo em u² (medida de cabeça) */
    area?: (t: number) => number;
  } = {},
) {
  const nt = m.I.length / 3,
    viz = vizinhos(m),
    mask = new Uint8Array(nt),
    todos = [...Array(nt).keys()];
  // enfeites da cor do cabelo (a coroa dourada, os cristais): [r, g, b, ΔE] no plano; ficam fora antes de crescer
  const fixo = new Uint8Array(nt);
  if (extra.manter?.length) {
    const L = todos.map((t) => lab(m.C[t * 3], m.C[t * 3 + 1], m.C[t * 3 + 2])),
      M = extra.manter.map((q) => ({ l: lab(q[0], q[1], q[2]), tol: q[3] }));
    for (const t of todos) if (M.some((q) => dE(L[t], q.l) <= q.tol)) fixo[t] = 1;
  }
  const livre = (t: number) => !fixo[t];
  // a pele começa no rosto, no pescoço, nas juntas de pele do corpo e onde a cor é quase a da referência (a barriga e as
  // coxas da líder: o lenço e o cinto cortam o caminho a partir dos braços)
  const Lpele = refsPele.map((r) => lab(r[0], r[1], r[2])),
    quasePele = (t: number) => {
      const L = lab(m.C[t * 3], m.C[t * 3 + 1], m.C[t * 3 + 2]);
      return Lpele.some((r) => dE(L, r) <= MASCARA.pele.quase);
    };
  const confiaveis = [...todos.filter((t) => naFace(med(t)) || noPescoco(med(t))), ...(extra.semPele ?? [])];
  const pele: Crescimento = {
    ...MASCARA.pele,
    // só abaixo do pescoço: na cabeça o rosto já semeia, e o loiro da loira de tranças é quase a cor da pele dela
    sementes: [...confiaveis, ...(extra.corpo ? todos.filter((t) => med(t).y < -1 && quasePele(t)) : [])],
    refs: refsPele,
    pode: livre,
  };
  // no rosto de baixo, só a mecha bem da cor do cabelo (a que cruza a bochecha); nos olhos, nunca — liberada com
  // tolerância, a mecha encostada levava junto o olho da marinho_coque e o delineado da morena_argolas
  const Lcab = refsCabelo.map((r) => lab(r[0], r[1], r[2])),
    bemCabelo = (t: number) => {
      const L = lab(m.C[t * 3], m.C[t * 3 + 1], m.C[t * 3 + 2]);
      return Lcab.some((r) => dE(L, r) <= MASCARA.cabelo.tolRosto);
    };
  const podeCabelo = (t: number) =>
    livre(t) &&
    !nosOlhos(med(t)) &&
    (!rostoBaixo(med(t)) || bemCabelo(t)) &&
    (!extra.podeCabelo || extra.podeCabelo(t));
  crescerJuntos(m, viz, mask, [
    [PARTE.pele, pele],
    [
      PARTE.cabelo,
      {
        ...MASCARA.cabelo,
        sementes: todos.filter((t) => noTopo(med(t)) || atras(med(t))),
        refs: refsCabelo,
        pode: podeCabelo,
      },
    ],
  ]);
  // a pele que nasceu só da cor (sem rosto, pescoço nem braço) vale se for grande: o reflexo no couro da bolsa e da
  // bota da heroína é uma mancha pequena; a barriga da líder, não
  {
    const confia = new Uint8Array(nt);
    for (const t of confiaveis) confia[t] = 1;
    const visto = new Uint8Array(nt);
    for (const t0 of todos) {
      if (mask[t0] !== PARTE.pele || visto[t0]) continue;
      const grupo = [t0],
        fila = [t0];
      visto[t0] = 1;
      let ok = !!confia[t0];
      while (fila.length) {
        const t = fila.pop()!;
        for (const v of viz[t])
          if (mask[v] === PARTE.pele && !visto[v]) {
            visto[v] = 1;
            if (confia[v]) ok = true;
            grupo.push(v);
            fila.push(v);
          }
      }
      if (!ok && grupo.length < MASCARA.pele.ilhaMin) for (const t of grupo) mask[t] = PARTE.outro;
    }
  }
  // no corpo, uma segunda passada mais tolerante a partir do cabelo já marcado: a camada de dentro do rabo comprido
  // (mais escura, deitada nas costas) ficava com a cor antiga no meio do cabelo novo
  if (extra.corpo)
    crescerJuntos(m, viz, mask, [
      [
        PARTE.cabelo,
        {
          ...MASCARA.cabeloCorpo,
          sementes: todos.filter((t) => mask[t] === PARTE.cabelo).flatMap((t) => viz[t]),
          refs: refsCabelo,
          // só nas costas, abaixo dos ombros e atrás do corpo: na frente, o lenço vermelho-escuro da líder virava cabelo
          pode: (t) => podeCabelo(t) && med(t).y < -1.6 && med(t).z < -1.2,
        },
      ],
    ]);
  fecharIlhas(m, viz, mask, PARTE.cabelo, refsCabelo, MASCARA.ilhaCabelo.tol, MASCARA.ilhaCabelo.tris, podeCabelo);
  fecharIlhas(
    m,
    viz,
    mask,
    PARTE.pele,
    refsPele,
    MASCARA.ilhaPele.tol,
    MASCARA.ilhaPele.tris,
    (t) => livre(t) && !nosOlhos(med(t)),
  );
  if (extra.limparManchas)
    fecharIlhas(
      m,
      viz,
      mask,
      PARTE.pele,
      refsPele,
      MASCARA.ilhaPeleCorpo.tol,
      MASCARA.ilhaPeleCorpo.tris,
      // abaixo da clavícula: o lenço da líder no pescoço também é uma "ilha" cercada de pele
      (t) => livre(t) && med(t).y < -2.5,
      MASCARA.ilhaPeleCorpo,
    );
  // os detalhes do rosto no tom da pele (pálpebras, sombra, boca): sem eles, a maquiagem do modelo ficava em anéis da
  // cor da pele antiga. Fora: o delineado escuro, o branco do olho e a íris colorida (longe da pele).
  for (const t of todos) {
    if (mask[t] !== PARTE.outro || !livre(t) || !noRosto(med(t))) continue;
    const L = lab(m.C[t * 3], m.C[t * 3 + 1], m.C[t * 3 + 2]),
      perto = Lpele.reduce((a, r) => (dE(L, r) < dE(L, a) ? r : a), Lpele[0]);
    if (perto && dE(L, perto) <= MASCARA.rosto.tol && L[0] >= perto[0] - MASCARA.rosto.escuro) mask[t] = PARTE.rosto;
  }
  // só os detalhes ligados à pele: o brinco de argola e a flor no cabelo também têm "tom de pele"
  const visto = new Uint8Array(nt);
  for (const t0 of todos) {
    if (mask[t0] !== PARTE.rosto || visto[t0]) continue;
    const grupo = [t0],
      fila = [t0];
    visto[t0] = 1;
    let naPele = false;
    while (fila.length) {
      const t = fila.pop()!;
      for (const v of viz[t]) {
        if (mask[v] === PARTE.pele) naPele = true;
        else if (mask[v] === PARTE.rosto && !visto[v]) {
          visto[v] = 1;
          grupo.push(v);
          fila.push(v);
        }
      }
    }
    if (!naPele) for (const t of grupo) mask[t] = PARTE.outro;
    // grande demais para ser pálpebra ou boca: é pele que o crescimento não alcançou (a testa da líder, que deslocada
    // ficava quase branca e amarelada)
    else if (extra.area && grupo.reduce((s, t) => s + extra.area!(t), 0) > MASCARA.rosto.maxArea)
      for (const t of grupo) mask[t] = PARTE.pele;
  }
  return mask;
}

/** Uma cabeça trocável (CabecaDados: posições Int16 ×1000 já na medida de cabeça). */
export function segmentarCabeca(
  p: Int16Array,
  I: ArrayLike<number>,
  c: ArrayLike<number>,
  cab: { refPele?: number[]; refCabelo?: number[] },
  manter?: number[][],
) {
  const med: Medida = (t) => {
    const q = { x: 0, y: 0, z: 0 };
    for (let k = 0; k < 3; k++) {
      const v = I[t * 3 + k];
      q.x += p[v * 3] / 3000;
      q.y += p[v * 3 + 1] / 3000;
      q.z += p[v * 3 + 2] / 3000;
    }
    return q;
  };
  return segmentar({ I, C: c }, med, cab.refPele ? [cab.refPele] : [], cab.refCabelo ? [cab.refCabelo] : [], {
    manter,
    area: (t) => areaTri(p, I, t, 1000),
  });
}

/** área do triângulo t (posições ÷ `escala`) */
function areaTri(P: ArrayLike<number>, I: ArrayLike<number>, t: number, escala: number) {
  const q = [0, 1, 2].map((k) => [0, 1, 2].map((e) => P[I[t * 3 + k] * 3 + e] / escala)),
    a = q[1].map((v, e) => v - q[0][e]),
    b = q[2].map((v, e) => v - q[0][e]);
  return Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / 2;
}

/** Um corpo inteiro com a cabeça dele (espaço do jogo: frente +x). A pele começa também nos braços, mãos e pescoço;
 *  o cabelo não desce abaixo de `cabeloAte`. */
export function segmentarCorpo(A: Anim, corpo: CorpoDados, limparManchas = false) {
  const e = corpo.encaixe,
    nt = A.I.length / 3,
    C = new Uint8Array(nt * 3);
  for (let i = 0; i < C.length; i++) C[i] = Math.round(A.C[i] * 255);
  const ctr = (t: number, k: number) =>
    (A.P[A.I[t * 3] * 3 + k] + A.P[A.I[t * 3 + 1] * 3 + k] + A.P[A.I[t * 3 + 2] * 3 + k]) / 3;
  const med: Medida = (t) => ({
    x: (ctr(t, 2) - e.meio) / e.u,
    y: (ctr(t, 1) - e.queixo) / e.u,
    z: (ctr(t, 0) - e.nariz) / e.u,
  });
  // a junta que mais pesa no triângulo
  const pele = new Set(
    A.juntas.map((n, j) => (/Neck|Arm|Hand/.test(n) && !/Shoulder/.test(n) ? j : -1)).filter((j) => j >= 0),
  );
  const juntaDe = (t: number) => {
    const w = new Map<number, number>();
    for (let k = 0; k < 3; k++) {
      const v = A.I[t * 3 + k];
      for (let q = 0; q < 4; q++) w.set(A.J[v * 4 + q], (w.get(A.J[v * 4 + q]) ?? 0) + A.W[v * 4 + q]);
    }
    return [...w.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  const semPele = [...Array(nt).keys()].filter((t) => pele.has(juntaDe(t)));
  const ate = corpo.cabeloAte ?? -Infinity,
    // o cabelo do corpo só na cabeça, na coluna e nos ombros (onde pesa o rabo comprido da líder): o castanho dela é
    // quase o do couro do cinto, das luvas e das botas
    juntaCabelo = new Set(
      A.juntas.map((n, j) => (/^(Head|Neck|Spine\d*|\w+Shoulder)$/.test(n) ? j : -1)).filter((j) => j >= 0),
    );
  return segmentar(
    { I: A.I, C },
    med,
    [corpo.refPele, corpo.refPeleCorpo].filter((r): r is number[] => !!r),
    corpo.refCabelo ? [corpo.refCabelo] : [],
    {
      semPele,
      podeCabelo: (t) => ctr(t, 1) >= ate && juntaCabelo.has(juntaDe(t)),
      corpo: true,
      limparManchas,
      area: (t) => areaTri(A.P, A.I, t, e.u),
    },
  );
}
