/* ==== v8.0 — o cenário do campo aberto vindo do mapa (mundo ligado, passo 3; map/mundo.ts, map/terreno.ts) ====
   No lugar da arena (penhasco, laterais, arco da entrada), o chão e o cenário saem do mapa, em blocos de MUNDO.bloco
   casas presos ao lugar do mundo (coordenadas do campo absolutas = mapa / escala): a janela do campo desliza e os
   blocos ficam onde estão. Cada bloco: o chão em meia casa com a cor da terra do mapa (mais verde na mata, areia na
   beira d'água), a água do mapa (mar, lago, rio) mais funda e azul, as MESMAS árvores que o mapa desenha no zoom máximo
   (pinheiros onde o mapa tem pinheiros), mato baixo pela densidade da floresta e pedras na montanha. Os troncos e as
   pedras grandes vão para as colisões (registrarObstaculos). Só os blocos perto da câmera são desenhados; no máximo
   CENA.porQuadro blocos novos por quadro; os mais antigos saem da memória da placa (CENA.guardar). */
import { GL3, dungeon, world } from "../../core/state.ts";
import { MB, glMesh, glFree, mbIco } from "./malhas.ts";
import { M4, MALHA } from "./geometria.ts";
import { glPush } from "./renderer.ts";
import { mbCenario, mbCenarioItem } from "./cenario.ts";
import { mbPedraMinerio, tipoPedraPorPeso } from "./pedras_minerio.ts";
import { PEDRA_MINERIO } from "../../data/pedras.ts";
import { MUNDO, cantoCampo, registrarObstaculos } from "../../map/mundo.ts";
import { aguaEm, arvoresEm, corTerra, densEm, terrenoPronto } from "../../map/terreno.ts";
import { D3 } from "../../field/projecao.ts";
import { alturaRelevo, brilhoFace, hashRelevo, tremorVertice } from "./relevo.ts";
import { AGUA, aguaPush, malhaAgua } from "./agua.ts";
import { corEstacao } from "./estacao_cor.ts";
import { ED } from "../../editor/estado.ts";
import {
  atualizarCrescimentoArvores,
  etapaRecursoCampo,
  recursoCampoQuebrado,
  registrarRecursosCampo,
  removerRecursosCampo,
} from "../../field/recursos_campo.ts";
import { acampamentoCampoGL, naClareira } from "../../field/acampamento_campo.ts";
import type { GLMesh, MalhaCrua } from "../../core/tipos.ts";
import type { RecursoCampo } from "../../core/tipos.ts";
import type { Mat4 } from "./geometria.ts";

/** porQuadro: blocos novos por quadro; guardar: blocos na memória; leito/leitoFundo: a cor do fundo debaixo da lâmina
 *  d'água (render/gl/agua.ts), do raso ao fundo; fundo: a profundidade do leito (px); mapa: quanto
 *  da cor da terra do mapa entra no chão; mato: chance por casa de um enfeite baixo (aberto, floresta cheia).
 *  v8.0 — chão de floresta: `div` = pedaços do chão por casa; manchas presas ao mundo (`ruido`), cada uma
 *  [tamanho em px do campo, de, até (0..1 do ruído), força]: `terra` batida, capim `seco` (no aberto), `folhas` secas e
 *  `musgo` (na mata); o grão de brilho e a luz das encostas estão em render/gl/relevo.ts. `capim`: tufos por casa [aberto, mata], folhas
 *  por tufo, altura [mín, máx] (px), cores da base e da ponta (verde e seco), `flor` = chance de flor por tufo e cores. */
const CENA = {
  // v8.1 — o machado bate na árvore (mantenedor 2026-10-31, do palco da criação): ela balança para longe de quem bate e
  // solta folhas. dur = s; amp = inclinação máxima (rad, a copa mais que o tronco); vel/amort = o balanço amortecido;
  // folhas = quantas caem; queda = px/s
  golpe: { dur: 1.2, amp: 0.07, vel: 18, amort: 4, folhas: 9, queda: 26 },
  porQuadro: 2,
  guardar: 70,
  leito: [0.66, 0.6, 0.42],
  leitoFundo: [0.24, 0.3, 0.26],
  fundo: -4,
  areia: [0.85, 0.77, 0.55],
  campo: [0.6, 0.7, 0.34],
  mata: [0.36, 0.5, 0.24],
  mapa: 0.25,
  mato: [0.06, 0.32],
  div: 3,
  terra: { cor: [0.55, 0.42, 0.27], m: [150, 0.6, 0.78, 0.9] },
  seco: { cor: [0.78, 0.72, 0.38], m: [230, 0.45, 0.75, 0.75] },
  folhas: { cor: [0.5, 0.36, 0.2], m: [120, 0.5, 0.8, 0.8] },
  musgo: { cor: [0.24, 0.38, 0.17], m: [170, 0.35, 0.7, 0.8] },
  capim: {
    tufos: [5, 2],
    folhas: 6,
    alt: [7, 15],
    base: [0.22, 0.34, 0.12],
    ponta: [0.58, 0.72, 0.3],
    pontaSeca: [0.86, 0.76, 0.36],
    flor: 0.07,
    flores: [
      [0.95, 0.45, 0.18],
      [0.92, 0.28, 0.2],
      [0.96, 0.9, 0.75],
    ],
  },
};
const QUEDAS = new Map<
  string,
  { mesh: GLMesh; x: number; z: number; bloco: string; inicio: number; fim: number; direcao: number }
>();

type TroncoCenario = { id: string; mesh: GLMesh; x: number; z: number };
/** v8.1 — uma árvore de pé dentro da malha do bloco: os vértices dela (ini..fim), as posições originais (para balançar
 *  e voltar), a base (espaço do bloco, y = o chão) e a altura do topo; outono = folhas alaranjadas. */
type CopaCenario = {
  id: string;
  ini: number;
  orig: Float32Array;
  x: number;
  z: number;
  y0: number;
  topo: number;
  raio: number;
  outono: boolean;
};
/** As árvores balançando agora: a direção (de quem bateu para a árvore) e o golpe que começou o balanço. */
const BALANCOS = new Map<string, { dx: number; dz: number; golpe: number }>();
/** v8.1 — uma peça que o mapa pôs no bloco (árvore, pedra, mato), para o Modo Editor achar e apagar (`id` vai para
 *  ED.dados.removidos). x/z absolutos, r = o raio no chão. */
export interface PecaMapa {
  id: string;
  x: number;
  z: number;
  r: number;
  tipo: "arvore" | "pedra" | "mato";
}
type BlocoCenario = {
  mesh: GLMesh | null;
  agua: GLMesh | null;
  usado: number;
  recursos: RecursoCampo[];
  troncos: TroncoCenario[];
  mapa: PecaMapa[];
  copas: CopaCenario[];
};
const BLOCOS = new Map<string, BlocoCenario>();
const QUADRO = { n: 0, faltam: -1 };

/** O cenário em volta da câmera já está todo montado (no último quadro desenhado do campo aberto). */
export function cenaPronta() {
  return QUADRO.faltam === 0;
}

function hash(i: number, j: number, k: number) {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
const misturar = (a: number[], b: number[], t: number) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** Ruído suave (0..1) preso ao mundo: duas oitavas de ruído de valor, manchas de ~`esc` px do campo. */
function ruido(x: number, z: number, esc: number, k: number) {
  const um = (u: number, v: number, q: number) => {
    const i = Math.floor(u),
      j = Math.floor(v),
      fu = u - i,
      fv = v - j,
      su = fu * fu * (3 - 2 * fu),
      sv = fv * fv * (3 - 2 * fv),
      a = hash(i, j, q),
      b = hash(i + 1, j, q),
      c = hash(i, j + 1, q),
      d = hash(i + 1, j + 1, q);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
  return um(x / esc, z / esc, k) * 0.65 + um(x / (esc * 0.4), z / (esc * 0.4), k + 7) * 0.35;
}
/** Quanto da mancha `m` ([tamanho, de, até, força]) há no ponto (0..força). */
function mancha(x: number, z: number, m: number[], k: number) {
  const t = Math.min(1, Math.max(0, (ruido(x, z, m[0], k) - m[1]) / (m[2] - m[1])));
  return t * t * (3 - 2 * t) * m[3];
}
/** A cor do chão firme no ponto (px do campo), sem a água: floresta, cor do mapa e as manchas. */
function corChao(fx: number, fz: number, f: number, m: number[] | null) {
  let c = misturar(CENA.campo, CENA.mata, Math.min(1, f * 1.3));
  if (m) c = misturar(c, m, CENA.mapa);
  c = misturar(c, CENA.seco.cor, mancha(fx, fz, CENA.seco.m, 11) * (1 - f));
  c = misturar(c, CENA.musgo.cor, mancha(fx, fz, CENA.musgo.m, 12) * f);
  c = misturar(c, CENA.folhas.cor, mancha(fx, fz, CENA.folhas.m, 13) * f);
  return misturar(c, CENA.terra.cor, mancha(fx, fz, CENA.terra.m, 14));
}

/** Um tufo de capim em (x, z) do bloco: `n` folhas finas (um triângulo cada, escura na base e clara na ponta), abertas
 *  em leque; `seco` (0..1) puxa a ponta para o amarelo; às vezes uma flor no alto. */
function tufo(b: MalhaCrua, x: number, z: number, h0: number, seco: number, sem: number) {
  const C = CENA.capim,
    ponta = corEstacao(misturar(C.ponta, C.pontaSeca, seco), "capim", 1, 0), // v8.1: a estação
    base = corEstacao(C.base, "capim", 1, 0),
    n = C.folhas,
    h = C.alt[0] + (C.alt[1] - C.alt[0]) * h0;
  const tri = (p: number[][], c: number[][]) => {
    for (let t = 0; t < 3; t++) {
      b.p.push(p[t][0], p[t][1], p[t][2]);
      b.n.push(0, 1, 0);
      b.c.push(c[t][0], c[t][1], c[t][2]);
    }
  };
  let topo: number[] | null = null;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + hash(sem, i, 21) * 1.2,
      ca = Math.cos(a),
      sa = Math.sin(a),
      inc = 0.35 + hash(sem, i, 22) * 0.55,
      hh = h * (0.6 + hash(sem, i, 23) * 0.5),
      w = 1.1,
      bx = x + ca * 1.2,
      bz = z + sa * 1.2,
      tp = [bx + ca * hh * inc, hh, bz + sa * hh * inc];
    tri(
      [[bx - sa * w, 0, bz + ca * w], [bx + sa * w, 0, bz - ca * w], tp],
      [base, base, misturar(ponta, base, hash(sem, i, 24) * 0.3)],
    );
    if (!topo || hh > topo[1]) topo = tp;
  }
  if (topo && hash(sem, 0, 25) < C.flor * (1 - seco * 0.5)) {
    const c = C.flores[Math.floor(hash(sem, 0, 26) * C.flores.length)],
      [tx, ty, tz] = topo,
      r = 1.6;
    for (let q = 0; q < 4; q++) {
      const a0 = q * 1.571,
        a1 = a0 + 1.571;
      tri(
        [
          [tx + Math.cos(a0) * r, ty, tz + Math.sin(a0) * r],
          [tx + Math.cos(a1) * r, ty, tz + Math.sin(a1) * r],
          [tx, ty + 1.4, tz],
        ],
        [c, c, misturar(c, [1, 1, 1], 0.3)],
      );
    }
  }
}

const suave = (t: number) => t * t * (3 - 2 * t);
/** Quanto de água há em volta do ponto (px do campo, absoluto): `w`, 9 pontos na meia casa (lado `s`); `anel`, 8 pontos
 *  a uma casa. */
function medirAgua(fx: number, fz: number, s: number, T: number) {
  const e = MUNDO.escala,
    em = (dx: number, dz: number) => (aguaEm((fx + dx) * e, (fz + dz) * e) ? 1 : 0);
  let w = 0,
    anel = 0;
  for (let a = -1; a <= 1; a++) for (let c2 = -1; c2 <= 1; c2++) w += em(a * s * 0.5, c2 * s * 0.5);
  for (let q = 0; q < 8; q++) anel += em(Math.cos(q * 0.785) * T, Math.sin(q * 0.785) * T);
  return { w: w / 9, anel: anel / 8 };
}
/** A altura do chão com a água já medida: o relevo (render/gl/relevo.ts) some perto da água (a margem fica rente à
 *  lâmina) e o leito afunda devagar até CENA.fundo. */
function alturaCom(fx: number, fz: number, w: number, anel: number) {
  return alturaRelevo(fx, fz) * (1 - Math.min(1, anel * 1.6 + w)) + CENA.fundo * suave(w) * (0.4 + 0.6 * anel);
}
/** v8.0 — a altura do chão do campo aberto no ponto absoluto (px do campo + canto): onde as coisas pisam
 *  (renderer.ts erguerNoRelevo; as árvores e o mato dos blocos). */
export function alturaChao(fx: number, fz: number) {
  const T = dungeon.tile,
    { w, anel } = medirAgua(fx, fz, T / CENA.div, T);
  return alturaCom(fx, fz, w, anel);
}

/** O chão do bloco (v8.0, com relevo): a grade de meia casa com os vértices fora do lugar (tremorVertice, o mesmo nos
 *  blocos vizinhos) e a diagonal de cada casa sorteada; altura pelo relevo e pela água; cada triângulo com UMA cor (a
 *  média dos cantos × a luz da encosta × um grão), como as árvores low poly. A cor de cada canto: a terra do lugar,
 *  areia na beira, e dentro d'água o leito (areia molhada que escurece no fundo) — a água mesmo é a lâmina `ag`, à
 *  parte (render/gl/agua.ts): por vértice, [profundidade, espuma, 0], na grade sem tremor, no AGUA.nivel. */
function chao(b: MalhaCrua, ag: MalhaCrua, ax0: number, az0: number, B: number, T: number) {
  const e = MUNDO.escala,
    N = MUNDO.bloco * CENA.div,
    s = B / N,
    cor: number[][] = [],
    pos: number[][] = [],
    wb: number[] = [],
    hb: number[] = [];
  const gi0 = Math.round(ax0 / s),
    gj0 = Math.round(az0 / s);
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const [tx, tz] = tremorVertice(gi0 + i, gj0 + j, s),
        fx = ax0 + i * s + tx,
        fz = az0 + j * s + tz,
        mx = fx * e,
        my = fz * e,
        { w, anel } = medirAgua(fx, fz, s, T);
      let terra = corChao(fx, fz, densEm(mx, my)[0] / 255, corTerra(mx, my));
      terra = misturar(corEstacao(terra, "chao", 1, 0), CENA.areia, Math.min(1, anel * 2 + w)); // v8.1: a estação
      const leito = misturar(CENA.leito, CENA.leitoFundo, anel * anel);
      cor.push(misturar(terra, leito, suave(w)));
      pos.push([fx - ax0, alturaCom(fx, fz, w, anel), fz - az0]);
      // a lâmina: na grade sem tremor (a beira dela some debaixo da margem)
      const lw = medirAgua(ax0 + i * s, az0 + j * s, s, T);
      wb.push(lw.w);
      hb.push(alturaCom(ax0 + i * s, az0 + j * s, lw.w, lw.anel));
    }
  const v = (i: number, j: number) => j * (N + 1) + i;
  const tri = (a: number, c: number, d: number, sem: number) => {
    const A = pos[a],
      C = pos[c],
      D = pos[d],
      u = [C[0] - A[0], C[1] - A[1], C[2] - A[2]],
      w = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (n[1] < 0) n = n.map((x) => -x);
    const l = Math.hypot(n[0], n[1], n[2]) || 1,
      k = brilhoFace(n[0], n[1], n[2], sem),
      cc = [0, 1, 2].map((q) => ((cor[a][q] + cor[c][q] + cor[d][q]) / 3) * k);
    for (const p of [A, C, D]) {
      b.p.push(p[0], p[1], p[2]);
      b.n.push(n[0] / l, n[1] / l, n[2] / l);
      b.c.push(cc[0], cc[1], cc[2]);
    }
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const g = (gi0 + i) * 7919 + (gj0 + j) * 104729,
        a = v(i, j),
        r = v(i + 1, j),
        rr = v(i + 1, j + 1),
        d = v(i, j + 1);
      if (hashRelevo(gi0 + i, gj0 + j, 64) < 0.5) {
        tri(a, rr, r, g);
        tri(a, d, rr, g + 1);
      } else {
        tri(a, d, r, g);
        tri(r, d, rr, g + 1);
      }
      // a lâmina d'água: a casa entra se algum canto tem água por perto
      const q = [a, r, rr, d];
      if (!q.some((n) => wb[n] > 0.02)) continue;
      const P = q.map((n, t) => [(i + (t === 1 || t === 2 ? 1 : 0)) * s, AGUA.nivel, (j + (t >= 2 ? 1 : 0)) * s]);
      for (const t of [0, 2, 1, 0, 3, 2]) {
        const n = q[t],
          prof = Math.min(1, Math.max(0, (AGUA.nivel - hb[n]) / (AGUA.nivel - CENA.fundo))),
          esp = Math.exp(-(((wb[n] - 0.5) / 0.26) ** 2));
        ag.p.push(P[t][0], P[t][1], P[t][2]);
        ag.n.push(0, 1, 0);
        ag.c.push(prof, esp, 0);
      }
    }
}

/** Monta o bloco (bi, bj): malha no espaço do bloco, a lâmina d'água dele e as colisões (absolutas). */
function construir(bi: number, bj: number): Omit<BlocoCenario, "usado"> {
  const T = dungeon.tile,
    B = MUNDO.bloco * T,
    e = MUNDO.escala,
    ax0 = bi * B,
    az0 = bj * B,
    b = MB(),
    ag = MB(),
    obst: number[] = [],
    recursos: RecursoCampo[] = [],
    troncos: TroncoCenario[] = [],
    mapa: PecaMapa[] = [],
    copas: CopaCenario[] = [],
    removidos = new Set(ED.dados.removidos || []),
    bloco = bi + "," + bj;
  chao(b, ag, ax0, az0, B, T);
  // v8.0: o que é posto no bloco a partir do índice `desde` sobe até o chão do ponto (fx, fz) absoluto
  const erguer = (desde: number, fx: number, fz: number) => {
    const h = alturaChao(fx, fz);
    if (h) for (let k = desde + 1; k < b.p.length; k += 3) b.p[k] += h;
  };
  const seco = (fx: number, fz: number, r: number) =>
    !aguaEm(fx * e, fz * e) &&
    ![0, 1, 2, 3].some((q) => aguaEm((fx + Math.cos(q * 1.57) * r) * e, (fz + Math.sin(q * 1.57) * r) * e));
  // as árvores do mapa (as mesmas do zoom máximo) e, v8.1, as postas no Modo Editor: as duas cortam, viram toco e
  // crescem de novo do mesmo jeito (`inteira` desenha a árvore de pé; t = o porte 0..1)
  const postas: number[] = [];
  const arvore = (
    fx: number,
    fz: number,
    grupo: string,
    sc: number,
    id: string,
    t: number,
    semente: number,
    inteira: () => boolean,
  ) => {
    const etapa = etapaRecursoCampo(id),
      n0 = b.p.length;
    if (etapa !== "arvore") {
      if (etapa === "toco" || etapa === "tronco" || etapa === "lascado")
        if (mbCenario(b, "tocos", fx - ax0, fz - az0, sc * 0.55, { semente })) erguer(n0, fx, fz);
      if (etapa === "tronco" || etapa === "lascado") {
        const estado = world.recursosCampo?.[id];
        if (estado?.quedaAteMs != null && estado.quedaAteMs > Date.now()) {
          if (D3.gl && !QUEDAS.has(id)) {
            const malha = MB();
            if (mbCenario(malha, grupo, 0, 0, sc, { semente })) {
              const agora = Date.now();
              QUEDAS.set(id, {
                mesh: glMesh(malha),
                x: fx,
                z: fz,
                bloco,
                inicio: estado.quedaInicioMs || agora,
                fim: estado.quedaAteMs,
                direcao: estado.quedaDirecao || 1,
              });
            }
          }
        } else {
          const x = fx - ax0 + T * 0.35,
            z = fz - az0,
            madeira = MB();
          if (mbCenario(madeira, "tronco", x, z, sc * 0.85, { semente, giro: 0.6 }) && madeira.p.length) {
            const malha = glMesh(madeira);
            malha.ol = true;
            malha.relevo = true; // a altura do ponto vai na matriz ao desenhar a peça
            troncos.push({ id, mesh: malha, x: fx, z: fz });
          }
        }
        recursos.push({
          id,
          bloco,
          tipo: "arvore",
          x: fx,
          z: fz,
          porte: t > 0.66 ? "large" : t > 0.33 ? "medium" : "small",
          raio: T * 0.22 * sc,
          maxHp: t > 0.66 ? 4 : t > 0.33 ? 3 : 2,
        });
      }
      if (
        (etapa === "toco" || etapa === "tronco" || etapa === "lascado") &&
        world.recursosCampo?.[id]?.sementeAte != null
      )
        mbIco(
          b,
          M4.ch(M4.T(fx - ax0 - T * 0.3, 1.5, fz - az0 + T * 0.35), M4.S(2.8, 2.2, 2.8)),
          "#82bd55",
          0,
          0.12,
          0.05,
        );
      if (etapa === "broto" || etapa === "muda")
        mbCenario(b, "moita", fx - ax0, fz - az0, sc * (etapa === "broto" ? 0.18 : 0.34), { semente });
      return;
    }
    if (inteira()) {
      erguer(n0, fx, fz);
      // v8.1: guarda onde ela está na malha, para balançar quando o machado bate (balancarCopas)
      const orig = Float32Array.from(b.p.slice(n0)),
        y0 = alturaChao(fx, fz);
      let topo = y0,
        raio = 0;
      for (let k = 1; k < orig.length; k += 3) topo = Math.max(topo, orig[k]);
      // o raio da copa (as folhas caem da borda dela, não de dentro)
      for (let k = 0; k < orig.length; k += 3)
        if (orig[k + 1] > y0 + (topo - y0) * 0.4)
          raio = Math.max(raio, Math.hypot(orig[k] - (fx - ax0), orig[k + 2] - (fz - az0)));
      copas.push({
        id,
        ini: n0 / 3,
        orig,
        x: fx - ax0,
        z: fz - az0,
        y0,
        topo,
        raio: raio || T * 0.3 * sc,
        outono: grupo === "outono",
      });
      obst.push(fx, fz, T * 0.2 * sc);
      postas.push(fx, fz);
      recursos.push({
        id,
        bloco,
        tipo: "arvore",
        x: fx,
        z: fz,
        porte: t > 0.66 ? "large" : t > 0.33 ? "medium" : "small",
        raio: T * 0.2 * sc,
        maxHp: t > 0.66 ? 4 : t > 0.33 ? 3 : 2,
      });
    }
  };
  for (const a of arvoresEm(ax0 * e, az0 * e, (ax0 + B) * e, (az0 + B) * e)) {
    const fx = a.x / e,
      fz = a.y / e;
    if (!seco(fx, fz, T * 0.45) || naClareira(fx, fz, T * 0.5)) continue; // v8.1: a clareira do acampamento
    const grupo = a.pinho ? "pinheiro" : a.h < 0.14 ? "outono" : "folhosa",
      sc = 0.8 + 0.4 * a.t + a.f * 0.2,
      id = "arvore:" + Math.round(fx * 100) + ":" + Math.round(fz * 100),
      semente = Math.floor(a.x * 7.13 + a.y * 13.7);
    if (removidos.has(id)) continue; // v8.1: apagada no Modo Editor
    mapa.push({ id, x: fx, z: fz, r: T * 0.25 * sc, tipo: "arvore" });
    arvore(fx, fz, grupo, sc, id, a.t, semente, () => mbCenario(b, grupo, fx - ax0, fz - az0, sc, { semente }));
  }
  // v8.1 — as árvores postas no Modo Editor (com ele fechado; aberto, editor/cena.ts as desenha soltas)
  for (const p of decoFuncionais(ax0, az0, B, "arvore")) {
    const [item, est] = p.m.slice(4).split("@"),
      sc = p.e || 1;
    arvore(
      p.x,
      p.z,
      item.replace(/_\d+$/, ""),
      sc,
      "deco:" + p.id,
      Math.min(1, Math.max(0, (sc - 0.8) / 0.6)),
      p.id * 7919,
      () => mbCenarioItem(b, item, est || "", p.x - ax0, p.z - az0, sc, -(p.g || 0)),
    );
  }
  // mato baixo, troncos caídos e pedras: uma chance por casa, pela floresta e pela montanha
  const n0 = Math.floor(ax0 / T),
    m0 = Math.floor(az0 / T);
  for (let i = n0; i < n0 + MUNDO.bloco; i++)
    for (let j = m0; j < m0 + MUNDO.bloco; j++) {
      const fx = (i + 0.2 + 0.6 * hash(i, j, 2)) * T,
        fz = (j + 0.2 + 0.6 * hash(i, j, 3)) * T,
        d = densEm(fx * e, fz * e),
        f = d[0] / 255,
        monte = d[1] >= 10,
        p = monte ? 0.22 : CENA.mato[0] + (CENA.mato[1] - CENA.mato[0]) * f;
      if (hash(i, j, 4) > p || !seco(fx, fz, T * 0.3) || naClareira(fx, fz)) continue;
      let perto = false;
      for (let k = 0; k < postas.length && !perto; k += 2)
        perto = Math.hypot(postas[k] - fx, postas[k + 1] - fz) < T * 0.7;
      if (perto) continue;
      const r = hash(i, j, 5),
        grupo = monte
          ? r < 0.6
            ? "pedra"
            : "moita"
          : r < 0.45
            ? "samambaia"
            : r < 0.75
              ? "moita"
              : r < 0.88 && f > 0.4
                ? "tronco"
                : "pedra",
        sc =
          grupo === "pedra"
            ? monte
              ? 0.8 + hash(i, j, 6) * 0.7
              : 0.45 + hash(i, j, 6) * 0.35
            : grupo === "samambaia"
              ? 0.6 + hash(i, j, 6) * 0.35
              : 0.5 + hash(i, j, 6) * 0.3;
      // v8.1: apagada no Modo Editor (pedra ou mato)
      if (removidos.has((grupo === "pedra" ? "pedra:" : "mato:") + i + ":" + j)) continue;
      mapa.push({
        id: (grupo === "pedra" ? "pedra:" : "mato:") + i + ":" + j,
        x: fx,
        z: fz,
        r: T * 0.3 * sc,
        tipo: grupo === "pedra" ? "pedra" : "mato",
      });
      const id = grupo === "pedra" ? "pedra:" + i + ":" + j : "",
        quebrada = !!id && recursoCampoQuebrado(id),
        n0 = b.p.length,
        semente = i * 733 + j * 911;
      // v8.1 — pedras de minério feitas em código (data/pedras.ts): o tipo sai da posição
      if (id && PEDRA_MINERIO.campo) {
        mbPedraMinerio(b, tipoPedraPorPeso(hash(i, j, 7)), fx - ax0, fz - az0, sc, semente, quebrada);
        erguer(n0, fx, fz);
        if (quebrada) continue;
      } else if (quebrada) {
        if (mbCenario(b, "pedra", fx - ax0, fz - az0, sc * 0.32, { semente })) erguer(n0, fx, fz);
        continue;
      } else if (!mbCenario(b, grupo, fx - ax0, fz - az0, sc, { semente })) continue;
      else erguer(n0, fx, fz);
      if (grupo === "pedra") {
        const raio = T * 0.3 * sc;
        if (sc > 0.9) obst.push(fx, fz, raio);
        recursos.push({
          id,
          bloco,
          tipo: "pedra",
          x: fx,
          z: fz,
          porte: sc > 0.9 ? "large" : "small",
          raio: Math.max(raio, T * 0.12),
          maxHp: sc > 0.9 ? 4 : 2,
        });
      }
    }
  // v8.1 — as pedras postas no Modo Editor (as de minério também): quebram como as do mapa
  for (const p of decoFuncionais(ax0, az0, B, "pedra")) {
    const id = "deco:" + p.id,
      jaQuebrada = p.m.endsWith(":q"),
      quebrada = jaQuebrada || recursoCampoQuebrado(id),
      sc = p.e || 1,
      n0 = b.p.length,
      x = p.x - ax0,
      z = p.z - az0;
    if (p.m.startsWith("min:")) mbPedraMinerio(b, p.m.slice(4).split(":")[0], x, z, sc, p.id * 733, quebrada);
    else if (quebrada) mbCenario(b, "pedra", x, z, sc * 0.32, { semente: p.id * 733 });
    else {
      const [item, est] = p.m.slice(4).split("@");
      mbCenarioItem(b, item, est || "", x, z, sc, -(p.g || 0));
    }
    erguer(n0, p.x, p.z);
    if (quebrada) continue;
    const raio = T * 0.3 * sc;
    if (sc > 0.9) obst.push(p.x, p.z, raio);
    recursos.push({
      id,
      bloco,
      tipo: "pedra",
      x: p.x,
      z: p.z,
      porte: sc > 0.9 ? "large" : "small",
      raio: Math.max(raio, T * 0.12),
      maxHp: sc > 0.9 ? 4 : 2,
    });
  }
  // v8.0 — tufos de capim: mais no aberto, menos na mata; nada na terra batida, na água e colado nos troncos
  const C = CENA.capim;
  for (let i = n0; i < n0 + MUNDO.bloco; i++)
    for (let j = m0; j < m0 + MUNDO.bloco; j++) {
      const f = densEm((i + 0.5) * T * e, (j + 0.5) * T * e)[0] / 255,
        q = C.tufos[0] + (C.tufos[1] - C.tufos[0]) * f;
      for (let k = 0; k < Math.ceil(q); k++) {
        const sem = i * 7919 + j * 104729 + k * 31,
          fx = (i + hash(sem, 1, 30)) * T,
          fz = (j + hash(sem, 2, 30)) * T;
        if (hash(sem, 3, 30) > q - k) continue;
        const terra = mancha(fx, fz, CENA.terra.m, 14) / CENA.terra.m[3];
        if (hash(sem, 4, 30) < terra * 1.3 || !seco(fx, fz, T * 0.15) || naClareira(fx, fz, -T * 1.2)) continue;
        let perto = false;
        for (let p = 0; p < postas.length && !perto; p += 2)
          perto = Math.hypot(postas[p] - fx, postas[p + 1] - fz) < T * 0.25;
        if (perto) continue;
        const sec = mancha(fx, fz, CENA.seco.m, 11) / CENA.seco.m[3],
          n0 = b.p.length;
        tufo(b, fx - ax0, fz - az0, hash(sem, 5, 30) * (1 - f * 0.4), sec * (1 - f), sem);
        erguer(n0, fx, fz);
      }
    }
  registrarObstaculos(bloco, obst);
  const agua = malhaAgua(ag);
  if (agua) agua.relevo = true;
  if (!b.p.length) return { mesh: null, agua, recursos, troncos, mapa, copas };
  const mesh = glMesh(b);
  mesh.stat = true;
  mesh.uid = ++MALHA._statUid;
  return { mesh, agua, recursos, troncos, mapa, copas };
}

/** v8.1 — as peças do Modo Editor que o campo trata como as do mapa (cortar, quebrar, barrar): árvores e pedras postas
 *  no campo aberto. Com o editor aberto, nenhuma (ele as desenha soltas, para mexer). */
const ARVORE_DECO = /^cen:(folhosa|pinheiro|outono|seca)_\d+(@\w+)?$/,
  PEDRA_DECO = /^cen:pedra_\d+(@\w+)?$|^min:/;
export function decoFuncional(m: string) {
  return ARVORE_DECO.test(m) || PEDRA_DECO.test(m);
}
function decoFuncionais(ax0: number, az0: number, B: number, tipo: "arvore" | "pedra") {
  if (ED.on) return [];
  const re = tipo === "arvore" ? ARVORE_DECO : PEDRA_DECO;
  return (ED.dados.cenas.mundo || []).filter(
    (p) => re.test(p.m) && p.x >= ax0 && p.x < ax0 + B && p.z >= az0 && p.z < az0 + B,
  );
}
/** v8.1 — as peças do mapa (árvores, pedras, mato) dos blocos montados que encostam no retângulo (px absolutos). */
export function pecasDoMapa(x0: number, z0: number, x1: number, z1: number) {
  const out: PecaMapa[] = [];
  for (const bl of BLOCOS.values())
    for (const p of bl.mapa) if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) out.push(p);
  return out;
}

/** Desenha cada tronco como peça própria para aplicar o contorno de interação. */
function troncosGLPush(bl: BlocoCenario, bi: number, bj: number, c: { x: number; y: number }, B: number) {
  for (const tronco of bl.troncos) {
    const estado = world.recursosCampo?.[tronco.id],
      podeDesgalhar = estado?.qualidade === "verde",
      podeColetar = !!estado && !estado.madeiraRecolhida,
      recurso = bl.recursos.find((n) => n.id === tronco.id),
      distancia = Math.hypot(tronco.x - c.x - dungeon.px, tronco.z - c.y - dungeon.py);
    const M = M4.T(bi * B - c.x, alturaChao(tronco.x, tronco.z), bj * B - c.y);
    glPush(tronco.mesh, M);
    const desenhado = GL3.list[GL3.list.length - 1];
    const perto = distancia <= dungeon.tile * 1.7 + (recurso?.raio || 0);
    desenhado.noOl = !perto || (!podeColetar && !podeDesgalhar);
    if (!desenhado.noOl) {
      desenhado.olCor = podeDesgalhar ? [0.38, 0.94, 0.34] : [0.96, 0.94, 0.88];
      desenhado.olEsp = 1.15;
    }
  }
}

/** v8.1 — as árvores do bloco que o machado acabou de acertar (RecursoCampo golpeEm, field/recursos_campo.ts):
 *  inclina a árvore para longe de quem bateu, num balanço amortecido (a copa mais que o tronco), mexendo só nos
 *  vértices dela na malha do bloco; no fim, as posições originais voltam. E caem folhas da copa. */
function balancarCopas(bl: BlocoCenario, bi: number, bj: number, c: { x: number; y: number }, B: number) {
  if (!bl.mesh?.bufs || !bl.copas.length) return;
  const G = CENA.golpe,
    agora = Date.now(),
    gl = GL3.gl;
  for (const cp of bl.copas) {
    const estado = world.recursosCampo?.[cp.id],
      golpe = estado?.golpeEm || 0,
      g = (agora - golpe) / 1000,
      ativo = BALANCOS.get(cp.id),
      emPe = !estado?.quebrado;
    if (g >= G.dur || !emPe) {
      if (ativo) {
        // acabou: as posições originais de volta
        BALANCOS.delete(cp.id);
        gl.bindBuffer(gl.ARRAY_BUFFER, bl.mesh.bufs[0]);
        gl.bufferSubData(gl.ARRAY_BUFFER, cp.ini * 12, cp.orig);
      }
      continue;
    }
    let bal = ativo;
    if (!bal || bal.golpe !== golpe) {
      // a direção de quem bateu (a heroína) para a árvore
      const dx = bi * B + cp.x - (dungeon.px + c.x),
        dz = bj * B + cp.z - (dungeon.py + c.y),
        n = Math.hypot(dx, dz) || 1;
      bal = { dx: dx / n, dz: dz / n, golpe };
      BALANCOS.set(cp.id, bal);
    }
    const ang = Math.sin(g * G.vel) * Math.exp(-g * G.amort) * G.amp,
      alt = Math.max(1, cp.topo - cp.y0),
      p = new Float32Array(cp.orig.length);
    for (let k = 0; k < p.length; k += 3) {
      const y = cp.orig[k + 1] - cp.y0,
        s = ang * y * Math.min(1, Math.max(0, y / alt) + 0.3);
      p[k] = cp.orig[k] + bal.dx * s;
      p[k + 1] = cp.orig[k + 1];
      p[k + 2] = cp.orig[k + 2] + bal.dz * s;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, bl.mesh.bufs[0]);
    gl.bufferSubData(gl.ARRAY_BUFFER, cp.ini * 12, p);
    // as folhas: saem da copa, girando, abrindo e caindo até o chão
    if (!GL3.mesh.folhaCampo || !GL3.mesh.folhaOutono) {
      MALHA._gs = 13;
      for (const [k, cor] of [
        ["folhaCampo", "#79a843"],
        ["folhaOutono", "#d8892f"],
      ]) {
        const fb = MB();
        mbIco(fb, M4.S(4, 1, 2.8), cor, 0, 0.25, 0.1);
        GL3.mesh[k] = glMesh(fb);
      }
    }
    const folha = cp.outono ? GL3.mesh.folhaOutono : GL3.mesh.folhaCampo,
      ox = bi * B - c.x + cp.x,
      oz = bj * B - c.y + cp.z;
    for (let i = 0; i < G.folhas; i++) {
      const a = (i / G.folhas) * 6.283 + (golpe % 7),
        y = cp.y0 + alt * (0.45 + (i % 3) * 0.1) - g * G.queda * (0.8 + (i % 4) * 0.15),
        r = cp.raio * (1.05 + (i % 2) * 0.15) + g * cp.raio * 0.5; // por fora da copa: de cima, ela as esconderia
      if (y <= cp.y0) continue;
      glPush(
        folha,
        M4.ch(
          M4.T(ox + Math.cos(a) * r + Math.sin(g * 6 + i) * 2, y, oz + Math.sin(a) * r),
          M4.RY(a + g * 4),
          M4.RX(Math.sin(g * 7 + i) * 0.9),
        ),
      );
    }
  }
}

/** A parte do campo (px do campo) que a câmera mostra, com uma folga. */
function retanguloVisto() {
  const T = dungeon.tile,
    vw = D3.cw / (D3.s || 1),
    vh = D3.ch / ((D3.SIN || 1) * (D3.s || 1));
  return {
    x0: D3.cx - vw / 2 - T * 2,
    x1: D3.cx + vw / 2 + T * 2,
    z0: D3.cz - vh / 2 - T * 4,
    z1: D3.cz + vh / 2 + T * 2,
  };
}

/** O ponto (x, z) do campo está na tela (com folga): para não desenhar bicho, pássaro e item longe dela. */
export function naVistaCampo(x: number, z: number) {
  if (!dungeon.origem) return true;
  const r = retanguloVisto();
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

/** Desenha os blocos do cenário perto da câmera (renderer.ts glFrame, no campo aberto). */
export function mundoGLPush() {
  const c = cantoCampo();
  if (!c || !terrenoPronto()) return;
  atualizarCrescimentoArvores();
  const T = dungeon.tile,
    B = MUNDO.bloco * T,
    r = retanguloVisto(),
    agora = ++QUADRO.n;
  for (const k of dungeon.recursosCampoSujo || []) {
    const bl = BLOCOS.get(k);
    if (!bl) continue;
    if (bl.mesh) glFree(bl.mesh);
    if (bl.agua) glFree(bl.agua);
    for (const tronco of bl.troncos) glFree(tronco.mesh);
    BLOCOS.delete(k);
    registrarObstaculos(k, null);
    removerRecursosCampo(k);
  }
  dungeon.recursosCampoSujo = [];
  const faltam: number[][] = [];
  let tem = 0;
  for (let bj = Math.floor((r.z0 + c.y) / B) - 1; bj <= Math.floor((r.z1 + c.y) / B) + 1; bj++)
    for (let bi = Math.floor((r.x0 + c.x) / B) - 1; bi <= Math.floor((r.x1 + c.x) / B) + 1; bi++) {
      const bl = BLOCOS.get(bi + "," + bj);
      if (!bl) {
        faltam.push([bi, bj]);
        continue;
      }
      tem++;
      bl.usado = agora;
      registrarRecursosCampo(bi + "," + bj, bl.recursos);
      if (bl.mesh) glPush(bl.mesh, M4.T(bi * B - c.x, 0, bj * B - c.y));
      if (bl.agua) aguaPush(bl.agua, M4.T(bi * B - c.x, 0, bj * B - c.y));
      troncosGLPush(bl, bi, bj, c, B);
      balancarCopas(bl, bi, bj, c, B); // v8.1: a árvore em que o machado bateu
    }
  // os que faltam, do mais perto da câmera para o mais longe; faltando muito (acabou de abrir), mais por quadro
  const cx = D3.cx + c.x,
    cz = D3.cz + c.y,
    perto = (p: number[]) => Math.hypot((p[0] + 0.5) * B - cx, (p[1] + 0.5) * B - cz);
  faltam.sort((p, q) => perto(p) - perto(q));
  const n = Math.min(faltam.length, tem < faltam.length ? CENA.porQuadro * 4 : CENA.porQuadro);
  for (const [bi, bj] of faltam.slice(0, n)) {
    const bl = { ...construir(bi, bj), usado: agora };
    BLOCOS.set(bi + "," + bj, bl);
    registrarRecursosCampo(bi + "," + bj, bl.recursos);
    if (bl.mesh) glPush(bl.mesh, M4.T(bi * B - c.x, 0, bj * B - c.y));
    if (bl.agua) aguaPush(bl.agua, M4.T(bi * B - c.x, 0, bj * B - c.y));
    troncosGLPush(bl, bi, bj, c, B);
  }
  const agoraMs = Date.now();
  for (const [id, queda] of QUEDAS) {
    if (agoraMs >= queda.fim) {
      glFree(queda.mesh);
      QUEDAS.delete(id);
      dungeon.recursosCampoSujo = [...new Set([...(dungeon.recursosCampoSujo || []), queda.bloco])];
      continue;
    }
    const progresso = Math.max(0, Math.min(1, (agoraMs - queda.inicio) / (queda.fim - queda.inicio))),
      angulo = queda.direcao * progresso * Math.PI * 0.48;
    glPush(
      queda.mesh,
      M4.ch(M4.T(queda.x - c.x, 0, queda.z - c.y), M4.RY(queda.direcao < 0 ? Math.PI : 0), M4.RZ(-angulo)),
    );
  }
  QUADRO.faltam = faltam.length - n;
  acampamentoCampoGL(); // v8.1: o acampamento visto do campo aberto
  // v8.1: com a câmera bem afastada (Modo Editor) a tela pede mais blocos que CENA.guardar: guardar só esse tanto
  // jogava fora blocos da tela e os refazia sem parar (o cenário piscava)
  const guardar = Math.max(CENA.guardar, Math.ceil((tem + faltam.length) * 1.3));
  if (BLOCOS.size > guardar) {
    const velhos = [...BLOCOS.entries()].sort((a, b) => a[1].usado - b[1].usado);
    for (const [k, bl] of velhos.slice(0, BLOCOS.size - guardar)) {
      if (bl.mesh) glFree(bl.mesh);
      if (bl.agua) glFree(bl.agua);
      for (const tronco of bl.troncos) glFree(tronco.mesh);
      registrarObstaculos(k, null);
      removerRecursosCampo(k);
      BLOCOS.delete(k);
    }
  }
}

/** v8.1 — o terreno mudou (pincel de terreno do Modo Editor) na área (px do campo absolutos; sem área = tudo): os
 *  blocos que encostam nela são refeitos no próximo quadro. */
export function refazerBlocos(area?: { x0: number; z0: number; x1: number; z1: number }) {
  const B = MUNDO.bloco * dungeon.tile,
    sujos = new Set(dungeon.recursosCampoSujo || []);
  for (const k of BLOCOS.keys()) {
    const [bi, bj] = k.split(",").map(Number);
    // folga de um bloco: a areia da margem e o leito olham a água em volta
    if (
      !area ||
      (bi * B < area.x1 + B && (bi + 1) * B > area.x0 - B && bj * B < area.z1 + B && (bj + 1) * B > area.z0 - B)
    )
      sujos.add(k);
  }
  dungeon.recursosCampoSujo = [...sujos];
}

/** A luz da sombra no campo aberto: centrada perto da câmera, presa à grade dos blocos (o cache da sombra estática só
    refaz quando ela troca de bloco). */
export function mundoLuz(Ld: number[]): Mat4 {
  const T = dungeon.tile,
    B = MUNDO.bloco * T,
    c = cantoCampo()!,
    cx = Math.round((D3.cx + c.x) / B) * B - c.x,
    cz = Math.round((D3.cz + c.y) / B) * B - c.y,
    R = Math.max(MUNDO.vista.cols, MUNDO.vista.rows) * T * 0.5 + 6 * T + B;
  return M4.mul(
    M4.ortho(-R, R, -R, R, 1, 1600),
    M4.look([cx - Ld[0] * 800, -Ld[1] * 800, cz - Ld[2] * 800], [cx, 0, cz], [0, 1, 0]),
  );
}
