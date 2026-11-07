/* ==== v7.7 — heroína low poly a partir dos .glb do Tripo (veio do protótipo de 2026-10-12) ====
   Corpo: a aventureira (1ª da folha) recortada em tronco, braço D/E e perna D/E; cabeça: a de coque de alta
   qualidade no lugar da do corpo. Passos, na ordem (os nomes entre parênteses são os `ajustes` do plano):
     1. máscara da manga + alto do ombro (para alisar depois)            (mfim)
     2. mangas mais justas, em volta do eixo do braço                    (manga, m0, m1)
     3. ombros mais estreitos (o braço só é deslocado)                   (ombro)
     4. tórax de frente: largura do cinto até a axila                    (peito, p0..p3)
     5. pose: abaixa os braços dobrando o ombro com peso suave           (px, py, ini, fim, abre)
     6. corte em peças (faixa de transição do ombro nas duas)            (sob, sobB)
     7. alisa a manga (Taubin)                                           (alisa)
     8. cabeça grande escalada pela altura da cabeça original            (cabEsc)
     9. redução (meshoptimizer) + cor por face; cor lisa na manga e,
        com filtro bilateral, na pele do rosto; pele do corpo no tom
        do rosto (outra cabeça no mesmo corpo)                           (corLisa, rosto, sig, pele; `orcamento`)
    10. peças no espaço das articulações do jogo; tronco mais alto        (tor, tor0)
   Saída: o formato que src/render/gl/heroina.ts lê (Int16 ×64 por vértice, RGB por triângulo, base64). */
import { MeshoptSimplifier } from "meshoptimizer";
import { amostra, soldar, type MalhaTex, type Regiao } from "./glb.ts";

export interface PlanoPersonagem {
  saida: string; // JSON do jogo (src/assets/models/heroina.json)
  previas: string; // pasta das prévias
  cache: string; // pasta do cache dos recortes
  texW: number; // lado da textura decodificada
  corpo: { arquivo: string; regiao: Regiao };
  cabeca: { arquivo: string; regiao: Regiao };
  /** Marcos do modelo, em unidades do .glb (medidos nas prévias com grade). */
  marcos: {
    pe: number; // y da sola
    escala: number; // .glb → jogo (ombro em y=28, quadril em 15, antes de esticar o tronco)
    cx: number; // x do eixo do corpo
    pescoco: number; // acima disto a cabeça do corpo sai
    bracoY: number; // y da axila na pose T
    virilha: number; // abaixo disto (e fora do braço) é perna
    queixoCorpo: number;
    queixoCabeca: number;
    corteCabeca: number; // pescoço da cabeça grande (sobrepõe a gola)
    narizCabecaX: number; // x aproximado do nariz da cabeça grande
    narizCabecaY?: [number, number]; // faixa de y onde procurar a ponta do nariz da cabeça grande (padrão: a da heroína)
    rostoY?: [number, number, number, number]; // máscara da pele do rosto: sobe de [0]→[1], desce de [2]→[3]
    czFaixa?: [number, number]; // faixa de y do tronco que dá o centro de profundidade (z) do corpo
  };
  /** Nome dos arquivos da pose T e altura dela, em metros. */
  nome?: string;
  altura?: number;
  orcamento: Record<"cabeca" | "tronco" | "bracoD" | "bracoE" | "pernaD" | "pernaE", number>; // triângulos
  ajustes: Record<string, number>;
}
/** Uma peça pronta: 3 vértices por triângulo, cor RGB 0..1 repetida nos 3 vértices. */
export interface Peca {
  p: number[];
  c: number[];
}
export interface Personagem {
  ombroY: number;
  ombroZ: number;
  mao: number[];
  pecas: Record<"torso" | "bracoD" | "bracoE" | "pernaD" | "pernaE", Peca>;
  info: string[];
  corpoTris?: number; // pose T: quantos triângulos do começo do torso são corpo (o resto é a cabeça)
}
type MascaraCor = Float32Array & { bilateral?: number };

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Quanto uma cor (RGB 0..1) parece pele: matiz laranja, saturada (a camisa bege fica abaixo), clara a partir de v0. */
const ehPele = (r: number, g: number, b: number, v0 = 0.6) => {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    s = mx ? (mx - mn) / mx : 0;
  if (mx !== r || mx === mn) return 0;
  const h = (60 * (g - b)) / (mx - mn); // graus, vermelho = 0
  return (
    sstep(6, 12, h) *
    (1 - sstep(34, 40, h)) *
    sstep(0.33, 0.4, s) *
    (1 - sstep(0.75, 0.82, s)) *
    sstep(v0, v0 + 0.1, mx)
  );
};

/**
 * Ajuste `pele`: leva a pele do corpo para o tom do rosto da cabeça (média das cores na máscara do rosto ÷ média
 * da pele do corpo, por canal), com força k. Devolve a função que `reduzir` aplica a cada cor de vértice.
 */
function tingirPele(corpo: MalhaTex, cab: MalhaTex, mascRosto: Float32Array, k: number, info: string[]) {
  const media = (m: MalhaTex, peso: (v: number, c: number[]) => number) => {
    const s = [0, 0, 0];
    let n = 0;
    for (let v = 0; v < m.P.length / 3; v++) {
      const c = amostra(m, m.T[v * 2], m.T[v * 2 + 1]).map((q) => q / 255),
        w = peso(v, c);
      if (!w) continue;
      for (let i = 0; i < 3; i++) s[i] += w * c[i];
      n += w;
    }
    return s.map((q) => q / n);
  };
  // no rosto, só a pele (sem as mechas escuras na testa nem olhos e sobrancelhas)
  const rosto = media(cab, (v, c) => (mascRosto[v] > 0.5 ? ehPele(c[0], c[1], c[2], 0.4) : 0)),
    pele = media(corpo, (_, c) => ehPele(c[0], c[1], c[2]));
  const fator = rosto.map((q, i) => q / pele[i]);
  info.push(
    `pele: rosto ${rosto.map((q) => Math.round(q * 255)).join("/")}, corpo ${pele.map((q) => Math.round(q * 255)).join("/")}`,
  );
  return (C: number[], i: number) => {
    const w = k * ehPele(C[i], C[i + 1], C[i + 2]);
    for (let j = 0; j < 3; j++) C[i + j] *= 1 + w * (fator[j] - 1);
  };
}

/**
 * `tpose`: em vez das peças do jogo, uma malha só (corpo inteiro + cabeça) com os braços na pose T, para rigging
 * (Mixamo/Blender): sem o passo 5 (giro dos braços) nem o corte em peças; o tronco é esticado já no .glb, com os
 * braços só deslocados. Vem em `pecas.torso` (as outras peças ficam vazias), no espaço do jogo (pés em y=0, frente +x).
 */
export async function gerarPersonagem(
  plano: PlanoPersonagem,
  corpo: MalhaTex,
  cab: MalhaTex,
  opc: { tpose?: boolean } = {},
): Promise<Personagem> {
  await MeshoptSimplifier.ready;
  MeshoptSimplifier.useExperimentalFeatures = true; // simplifyWithAttributes
  const aj = (k: string, padrao: number) => plano.ajustes[k] ?? padrao;
  const info: string[] = [];
  const { pe: PE, escala: S, cx: CX, pescoco: PESCOCO, bracoY: BRACO_Y, virilha: VIRILHA } = plano.marcos;
  const P = corpo.P;
  const CZF = plano.marcos.czFaixa ?? [0.5, 0.6];
  let CZ = 0;
  {
    let a = 0,
      n = 0;
    for (let i = 0; i < P.length; i += 3)
      if (P[i + 1] > CZF[0] && P[i + 1] < CZF[1] && Math.abs(P[i] - CX) < 0.04) {
        a += P[i + 2];
        n++;
      }
    CZ = a / n;
  }
  const OMBRO_Y = PE + 28 / S,
    OMBRO_X = 7.6 / S;
  // .glb (frente +z) → jogo (frente +x, direita +z)
  const jogo = (x: number, y: number, z: number) => [(z - CZ) * S, (y - PE) * S, -(x - CX) * S];
  const PX0 = aj("px", OMBRO_X);

  /* 1. máscara da manga + alto do ombro (coordenadas originais) */
  const mascManga: MascaraCor = new Float32Array(P.length / 3);
  for (let v = 0; v < mascManga.length; v++) {
    const x = P[v * 3],
      y = P[v * 3 + 1],
      a = Math.abs(x - CX),
      th = Math.atan2(y - OMBRO_Y, a - OMBRO_X);
    mascManga[v] =
      sstep(0.03, 0.05, a) *
      (1 - sstep(aj("mfim", 0.118), aj("mfim", 0.118) + 0.012, a)) *
      sstep(0.578, 0.595, y) *
      (1 - sstep(0.7, 1.2, -th)) *
      (y < PESCOCO - 0.002 ? 1 : 0);
  }
  /* 2. mangas mais justas */
  const K_MANGA = aj("manga", 1);
  if (K_MANGA !== 1) {
    const M0 = aj("m0", 0.05),
      M1 = aj("m1", 0.125),
      BIN = 0.004;
    const ehBraco = (x: number, y: number) => {
      const a = Math.abs(x - CX),
        th = Math.atan2(y - OMBRO_Y, a - OMBRO_X);
      return sstep(0.05, 0.072, a) * (1 - sstep(0.5, 1.0, -th)) * sstep(0.575, 0.59, y);
    };
    const eixo = new Map<string, number[]>(); // (lado, faixa) → soma y, soma z, n
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i],
        y = P[i + 1];
      if (ehBraco(x, y) < 0.5) continue;
      const k = `${Math.sign(x - CX)},${Math.floor(Math.abs(x - CX) / BIN)}`;
      let e = eixo.get(k);
      if (!e) eixo.set(k, (e = [0, 0, 0]));
      e[0] += y;
      e[1] += P[i + 2];
      e[2]++;
    }
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i],
        y = P[i + 1],
        a = Math.abs(x - CX);
      const w = ehBraco(x, y) * sstep(M0, M0 + 0.02, a) * (1 - sstep(M1 - 0.02, M1, a));
      if (w <= 0) continue;
      const e = eixo.get(`${Math.sign(x - CX)},${Math.floor(a / BIN)}`);
      if (!e) continue;
      const s = 1 - (1 - K_MANGA) * w,
        cy = e[0] / e[2],
        cz = e[1] / e[2];
      P[i + 1] = cy + (y - cy) * s;
      P[i + 2] = cz + (P[i + 2] - cz) * s;
    }
  }
  /* 3. ombros mais estreitos */
  const K_OMBRO = aj("ombro", 1);
  if (K_OMBRO !== 1)
    for (let i = 0; i < P.length; i += 3) {
      const y = P[i + 1];
      if (y > PESCOCO + 0.004) continue;
      const f = 1 + (K_OMBRO - 1) * sstep(0.56, 0.625, y),
        dx = P[i] - CX,
        a = Math.abs(dx);
      const na = a < PX0 + 0.02 ? a * f : a - (PX0 + 0.02) * (1 - f);
      P[i] = CX + Math.sign(dx) * na;
    }
  /* 4. tórax de frente (só a largura; a vista de lado não muda) */
  const K_PEITO = aj("peito", 1);
  if (K_PEITO !== 1)
    for (let i = 0; i < P.length; i += 3) {
      const y = P[i + 1],
        dx = P[i] - CX,
        a = Math.abs(dx);
      const lim = PX0 * K_OMBRO + 0.01,
        braco = sstep(lim, lim + 0.02, a) * sstep(0.596, 0.606, y);
      const b =
        (1 - braco) * sstep(aj("p0", 0.553), aj("p1", 0.568), y) * (1 - sstep(aj("p2", 0.6), aj("p3", 0.628), y));
      P[i] = CX + dx * (1 - (1 - K_PEITO) * b);
    }
  /* 5. pose: pesos do braço e giro em torno do ombro */
  const PX = PX0 * K_OMBRO,
    PY = OMBRO_Y + aj("py", 0);
  // inclinação do braço na pose T: centro do pulso em relação ao pivô
  const INCL = (() => {
    let ys = 0,
      n = 0;
    for (let i = 0; i < P.length; i += 3) {
      const a = Math.abs(P[i] - CX);
      if (a > 0.165 && a < 0.175 && P[i + 1] > 0.58) {
        ys += P[i + 1];
        n++;
      }
    }
    return n ? Math.atan2(PY - ys / n, 0.17 - PX) : 0; // sem pulso na faixa (outro modelo): só a pose T usa
  })();
  const GIRO = Math.PI / 2 - INCL - (aj("abre", 8) * Math.PI) / 180;
  const pesoBraco = (x: number, y: number) => {
    const a = Math.abs(x - CX),
      th = Math.atan2(y - PY, a - PX); // 0 = para fora; -π/2 = para baixo
    const wA = sstep(PX - aj("ini", 0.014), PX + aj("fim", 0.02), a) * (1 - sstep(0.6, 1.15, -th));
    return Math.max(wA, sstep(PX + 0.02, PX + 0.04, a) * sstep(BRACO_Y - 0.015, BRACO_Y + 0.005, y));
  };
  info.push(`braço na pose T: ${((INCL * 180) / Math.PI).toFixed(1)}°, giro ${((GIRO * 180) / Math.PI).toFixed(1)}°`);
  const pesos = new Float32Array(P.length / 3);
  for (let v = 0; v < pesos.length; v++)
    pesos[v] = P[v * 3 + 1] > PESCOCO - 0.01 && Math.abs(P[v * 3] - CX) < 0.05 ? 0 : pesoBraco(P[v * 3], P[v * 3 + 1]);

  /* 6. corte em peças (pesos da pose original) */
  const partes: Record<"tronco" | "bracoD" | "bracoE" | "pernaD" | "pernaE", number[]> = {
    tronco: [],
    bracoD: [],
    bracoE: [],
    pernaD: [],
    pernaE: [],
  };
  for (let t = 0; t < corpo.I.length / 3; t++) {
    let x = 0,
      y = 0,
      w = 0;
    for (let k = 0; k < 3; k++) {
      const v = corpo.I[t * 3 + k];
      x += P[v * 3] / 3;
      y += P[v * 3 + 1] / 3;
      w += pesos[v] / 3;
    }
    if (y > PESCOCO) continue; // a cabeça do corpo sai; entra a de alta qualidade
    if (opc.tpose) {
      partes.tronco.push(t); // pose T: corpo inteiro numa malha só
      continue;
    }
    const braco = x - CX < 0 ? "bracoD" : "bracoE"; // dx < 0 = lado direito da personagem
    if (w > 0.5) partes[braco].push(t);
    if (w > 0.5 && w < aj("sob", 0.85))
      partes.tronco.push(t); // faixa de transição nas duas peças
    else if (w > 0.5) continue;
    else if (w > aj("sobB", 0.25)) {
      partes[braco].push(t);
      partes.tronco.push(t);
    } else if (y < VIRILHA) partes[x - CX < 0 ? "pernaD" : "pernaE"].push(t);
    else partes.tronco.push(t);
  }
  // medidas das cabeças (antes de mexer nas posições)
  const caixaY = (Q: Float32Array, y0: number) => {
    const mn = [1e9, 1e9, 1e9],
      mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < Q.length; i += 3)
      if (Q[i + 1] > y0)
        for (let k = 0; k < 3; k++) {
          mn[k] = Math.min(mn[k], Q[i + k]);
          mx[k] = Math.max(mx[k], Q[i + k]);
        }
    return mx.map((v, k) => v - mn[k]);
  };
  const { queixoCorpo: QUEIXO_B, queixoCabeca: QUEIXO_H } = plano.marcos;
  const tamB = caixaY(P, QUEIXO_B),
    tamH = caixaY(cab.P, QUEIXO_H);
  // pontas do nariz (corpo e cabeça grande): medidas aqui, antes de a pose T esticar o tronco e subir a cabeça
  const pontaNariz = (Q: Float32Array, y0: number, y1: number, xc: number, dxm: number) => {
    let best = -1e9,
      bx = 0,
      by = 0;
    for (let i = 0; i < Q.length; i += 3) {
      const y = Q[i + 1];
      if (y > y0 && y < y1 && Math.abs(Q[i] - xc) < dxm && Q[i + 2] > best) {
        best = Q[i + 2];
        bx = Q[i];
        by = y;
      }
    }
    return [bx, by, best];
  };
  const nB = pontaNariz(P, QUEIXO_B + 0.007, QUEIXO_B + 0.027, CX, 0.02),
    NY = plano.marcos.narizCabecaY ?? [0.41, 0.44],
    nH = pontaNariz(cab.P, NY[0], NY[1], plano.marcos.narizCabecaX, 0.03);
  // tronco mais alto (passo 10): na pose T é aplicado aqui, no .glb, porque os braços (horizontais) só sobem
  const E = aj("tor", 1),
    T0 = aj("tor0", 20.5),
    T1 = (PESCOCO - PE) * S;
  const esticaTronco = (y: number) => (y <= T0 ? y : y <= T1 ? T0 + (y - T0) * E : y + (E - 1) * (T1 - T0));
  // pernas mais longas (ajuste `perna`): da sola até a virilha; o resto do corpo sobe junto.
  // Só a pose T usa (no jogo as pernas são peças com o quadril fixo em y=15).
  const KP = aj("perna", 1),
    LP = (VIRILHA - PE) * S;
  const esticaY = (y: number) => {
    const e = esticaTronco(y);
    return KP === 1 ? e : e <= LP ? e * KP : e + (KP - 1) * LP;
  };
  if (opc.tpose)
    for (let v = 0; v < pesos.length; v++) {
      // só o braço (além do ombro) é deslocado; gola, pescoço e tronco são esticados como no jogo
      const yG = (P[v * 3 + 1] - PE) * S,
        w = sstep(PX + 0.01, PX + 0.04, Math.abs(P[v * 3] - CX)) * sstep(BRACO_Y - 0.02, BRACO_Y, P[v * 3 + 1]);
      P[v * 3 + 1] += ((1 - w) * (esticaY(yG) - yG) + w * (esticaY(28) - 28)) / S;
    }
  // aplica a pose
  for (let v = 0; v < pesos.length; v++) {
    const w = pesos[v];
    if (!w || opc.tpose) continue;
    const x = P[v * 3],
      y = P[v * 3 + 1],
      lado = x < CX ? -1 : 1;
    const px = CX + lado * PX,
      ang = -GIRO * w * lado; // para fora → para baixo
    const rx = x - px,
      ry = y - PY,
      c = Math.cos(ang),
      s = Math.sin(ang);
    P[v * 3] = px + rx * c - ry * s;
    P[v * 3 + 1] = PY + rx * s + ry * c;
  }

  /* 7. alisa a manga (Taubin: suaviza sem encolher), só na máscara */
  const ALISA = aj("alisa", 0);
  if (ALISA > 0) {
    const sol = soldar(P, 1e-6),
      n = sol.n,
      grau = new Uint32Array(n + 1);
    for (let t = 0; t < corpo.I.length; t += 3) for (let k = 0; k < 3; k++) grau[sol.id[corpo.I[t + k]]] += 2;
    const ini = new Uint32Array(n + 1);
    for (let i = 0; i < n; i++) ini[i + 1] = ini[i] + grau[i];
    const viz = new Uint32Array(ini[n]),
      pos = ini.slice(0, n);
    for (let t = 0; t < corpo.I.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = sol.id[corpo.I[t + k]];
        viz[pos[a]++] = sol.id[corpo.I[t + ((k + 1) % 3)]];
        viz[pos[a]++] = sol.id[corpo.I[t + ((k + 2) % 3)]];
      }
    const Q = new Float64Array(n * 3),
      W = new Float32Array(n),
      T = new Float64Array(n * 3);
    for (let v = 0; v < sol.id.length; v++) {
      const j = sol.id[v];
      for (let k = 0; k < 3; k++) Q[j * 3 + k] = P[v * 3 + k];
      W[j] = Math.max(W[j], mascManga[v]);
    }
    for (let it = 0; it < ALISA * 2; it++) {
      const f = it % 2 ? -0.53 : 0.5;
      for (let j = 0; j < n; j++) {
        if (!W[j]) {
          T[j * 3] = Q[j * 3];
          T[j * 3 + 1] = Q[j * 3 + 1];
          T[j * 3 + 2] = Q[j * 3 + 2];
          continue;
        }
        let sx = 0,
          sy = 0,
          sz = 0;
        const c = ini[j + 1] - ini[j];
        for (let e = ini[j]; e < ini[j + 1]; e++) {
          const b = viz[e];
          sx += Q[b * 3];
          sy += Q[b * 3 + 1];
          sz += Q[b * 3 + 2];
        }
        const k = f * W[j];
        T[j * 3] = Q[j * 3] + k * (sx / c - Q[j * 3]);
        T[j * 3 + 1] = Q[j * 3 + 1] + k * (sy / c - Q[j * 3 + 1]);
        T[j * 3 + 2] = Q[j * 3 + 2] + k * (sz / c - Q[j * 3 + 2]);
      }
      Q.set(T);
    }
    for (let v = 0; v < sol.id.length; v++) {
      const j = sol.id[v];
      for (let k = 0; k < 3; k++) P[v * 3 + k] = Q[j * 3 + k];
    }
  }

  /* 8. cabeça de alta qualidade: escala pela altura da cabeça original, alinhada pela ponta do nariz (nB/nH,
     medidos antes de esticar o tronco) */
  const razoes = [0, 1, 2].map((k) => tamB[k] / tamH[k]);
  const ESC_CAB = razoes[1] * (aj("cabEsc", 1) || 1);
  info.push(`cabeça: escala ${ESC_CAB.toFixed(3)} (razões x/y/z ${razoes.map((v) => v.toFixed(3)).join("/")})`);
  const cabTris: number[] = [];
  for (let t = 0; t < cab.I.length / 3; t++) {
    let y = 0;
    for (let k = 0; k < 3; k++) y += cab.P[cab.I[t * 3 + k] * 3 + 1] / 3;
    if (y > plano.marcos.corteCabeca) cabTris.push(t);
  }
  const cabParaCorpo = (x: number, y: number, z: number) =>
    [
      nB[0] + (x - nH[0]) * ESC_CAB,
      QUEIXO_B + (y - QUEIXO_H) * ESC_CAB - 0.002,
      nB[2] + (z - nH[2]) * ESC_CAB,
    ] as const;

  /* 9. redução + cor por face */
  const reduzir = (
    m: MalhaTex,
    tris: number[],
    alvo: number,
    mapear: (x: number, y: number, z: number) => number[],
    masc: MascaraCor,
    tom?: (C: number[], i: number) => void,
  ): Peca => {
    // malha indexada soldada só com os triângulos da peça (posições já no espaço do jogo)
    const sub = new Map<number, number>(),
      Pv: number[] = [],
      Cv: number[] = [],
      Ns: number[] = [],
      I: number[] = [],
      Mv: number[] = [];
    const sol = soldar(m.P, 1e-6);
    for (const t of tris)
      for (let k = 0; k < 3; k++) {
        const v = m.I[t * 3 + k],
          w = sol.id[v];
        let j = sub.get(w);
        if (j === undefined) {
          sub.set(w, (j = Pv.length / 3));
          Pv.push(...mapear(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]));
          Cv.push(0, 0, 0);
          Ns.push(0);
          Mv.push(0);
        }
        Mv[j] = Math.max(Mv[j], masc[v]);
        const c = amostra(m, m.T[v * 2], m.T[v * 2 + 1]);
        Cv[j * 3] += c[0] / 255;
        Cv[j * 3 + 1] += c[1] / 255;
        Cv[j * 3 + 2] += c[2] / 255;
        Ns[j]++;
        I.push(j);
      }
    for (let j = 0; j < Ns.length; j++) for (let k = 0; k < 3; k++) Cv[j * 3 + k] /= Ns[j];
    if (tom) for (let j = 0; j < Ns.length; j++) tom(Cv, j * 3);
    // cor lisa na máscara: média dos vizinhos; no rosto, com peso pela semelhança de cor (bilateral)
    const CS = masc.bilateral ? aj("rosto", 0) : aj("corLisa", 0);
    if (CS > 0) {
      const sig2 = (masc.bilateral || 1e9) ** 2;
      const nb: number[][] = Array.from({ length: Ns.length }, () => []);
      for (let t = 0; t < I.length; t += 3)
        for (let k = 0; k < 3; k++) nb[I[t + k]].push(I[t + ((k + 1) % 3)], I[t + ((k + 2) % 3)]);
      for (let it = 0; it < CS; it++) {
        const nv = Cv.slice();
        for (let j = 0; j < Ns.length; j++) {
          if (!Mv[j]) continue;
          const s = [0, 0, 0];
          let ws = 0;
          for (const b of nb[j]) {
            const d2 =
              (Cv[b * 3] - Cv[j * 3]) ** 2 +
              (Cv[b * 3 + 1] - Cv[j * 3 + 1]) ** 2 +
              (Cv[b * 3 + 2] - Cv[j * 3 + 2]) ** 2;
            const w = Math.exp(-d2 / sig2);
            ws += w;
            for (let k = 0; k < 3; k++) s[k] += w * Cv[b * 3 + k];
          }
          for (let k = 0; k < 3; k++) nv[j * 3 + k] = Cv[j * 3 + k] + Mv[j] * 0.8 * (s[k] / ws - Cv[j * 3 + k]);
        }
        for (let i = 0; i < nv.length; i++) Cv[i] = nv[i];
      }
    }
    const Pf = Float32Array.from(Pv),
      C = Float32Array.from(Cv);
    const [lo] = MeshoptSimplifier.simplifyWithAttributes(
      Uint32Array.from(I),
      Pf,
      3,
      C,
      3,
      [0.6, 0.6, 0.6],
      null,
      alvo * 3,
      0.5,
      ["ErrorAbsolute"],
    );
    // cor da face: média das cores dos vértices originais mais próximos de 10 pontos espalhados nela
    const cel = 0.6,
      grade = new Map<string, number[]>();
    for (let j = 0; j < Pf.length / 3; j++) {
      const k = `${Math.floor(Pf[j * 3] / cel)},${Math.floor(Pf[j * 3 + 1] / cel)},${Math.floor(Pf[j * 3 + 2] / cel)}`;
      let a = grade.get(k);
      if (!a) grade.set(k, (a = []));
      a.push(j);
    }
    const perto = (x: number, y: number, z: number) => {
      let best = -1,
        bd = 1e9;
      const gx = Math.floor(x / cel),
        gy = Math.floor(y / cel),
        gz = Math.floor(z / cel);
      for (let r = 1; r <= 3 && best < 0; r++)
        for (let a = -r; a <= r; a++)
          for (let b = -r; b <= r; b++)
            for (let c = -r; c <= r; c++) {
              const l = grade.get(`${gx + a},${gy + b},${gz + c}`);
              if (l)
                for (const j of l) {
                  const d = (Pf[j * 3] - x) ** 2 + (Pf[j * 3 + 1] - y) ** 2 + (Pf[j * 3 + 2] - z) ** 2;
                  if (d < bd) {
                    bd = d;
                    best = j;
                  }
                }
            }
      return best;
    };
    const BAR = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1 / 3, 1 / 3, 1 / 3],
      [0.6, 0.2, 0.2],
      [0.2, 0.6, 0.2],
      [0.2, 0.2, 0.6],
      [0.5, 0.5, 0],
      [0, 0.5, 0.5],
      [0.5, 0, 0.5],
    ];
    const out: Peca = { p: [], c: [] };
    for (let t = 0; t < lo.length; t += 3) {
      const a = lo[t],
        b = lo[t + 1],
        c = lo[t + 2];
      const cor = [0, 0, 0];
      for (const [wa, wb, wc] of BAR) {
        const q = [0, 1, 2].map((k) => wa * Pf[a * 3 + k] + wb * Pf[b * 3 + k] + wc * Pf[c * 3 + k]);
        const j = perto(q[0], q[1], q[2]);
        for (let k = 0; k < 3; k++) cor[k] += C[j * 3 + k] / BAR.length;
      }
      for (const v of [a, b, c]) {
        out.p.push(Pf[v * 3], Pf[v * 3 + 1], Pf[v * 3 + 2]);
        out.c.push(...cor);
      }
    }
    return out;
  };
  const O = plano.orcamento;
  const res: Record<string, Peca> = {};
  // pose T: o corpo inteiro (no "tronco") leva o orçamento de todas as peças do corpo
  const orcCorpo = O.tronco + O.bracoD + O.bracoE + O.pernaD + O.pernaE;
  // rosto: pele da frente da cabeça (queixo → testa)
  const mascRosto: MascaraCor = new Float32Array(cab.P.length / 3),
    RY = plano.marcos.rostoY ?? [0.345, 0.365, 0.49, 0.51];
  mascRosto.bilateral = aj("sig", 0.1);
  for (let v = 0; v < mascRosto.length; v++) {
    const x = cab.P[v * 3],
      y = cab.P[v * 3 + 1],
      z = cab.P[v * 3 + 2];
    mascRosto[v] =
      sstep(RY[0], RY[1], y) *
      (1 - sstep(RY[2], RY[3], y)) *
      (1 - sstep(0.06, 0.08, Math.abs(x - nH[0]))) *
      sstep(nH[2] - 0.11, nH[2] - 0.08, z);
  }
  // pele do corpo no tom do rosto (ajuste `pele`, outra cabeça com o mesmo corpo)
  const tomPele = aj("pele", 0) > 0 ? tingirPele(corpo, cab, mascRosto, aj("pele", 0), info) : undefined;
  for (const [nome, tris] of Object.entries(partes))
    if (tris.length)
      res[nome] = reduzir(corpo, tris, opc.tpose ? orcCorpo : O[nome as keyof typeof O], jogo, mascManga, tomPele);
  res.cabeca = reduzir(cab, cabTris, O.cabeca, (x, y, z) => jogo(...cabParaCorpo(x, y, z)), mascRosto);

  /* 10. peças no espaço das articulações do jogo */
  if (opc.tpose) {
    // o corpo já foi esticado no .glb; a cabeça só sobe
    for (let i = 1; i < res.cabeca.p.length; i += 3) res.cabeca.p[i] = esticaY(res.cabeca.p[i]);
    const torso = { p: [...res.tronco.p, ...res.cabeca.p], c: [...res.tronco.c, ...res.cabeca.c] };
    const vazia = () => ({ p: [], c: [] });
    info.push(`pose T: ${res.tronco.p.length / 9} triângulos de corpo + ${res.cabeca.p.length / 9} de cabeça`);
    return {
      ombroY: esticaY(28),
      ombroZ: 0,
      mao: [],
      pecas: { torso, bracoD: vazia(), bracoE: vazia(), pernaD: vazia(), pernaE: vazia() },
      info,
      corpoTris: res.tronco.p.length / 9,
    };
  }
  const Oy = 28;
  const paraLocal = (m: Peca, piv: number[]) => {
    for (let i = 0; i < m.p.length; i += 3) for (let k = 0; k < 3; k++) m.p[i + k] -= piv[k];
  };
  const centro = (m: Peca, f: (y: number) => boolean) => {
    const s = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < m.p.length; i += 3)
      if (f(m.p[i + 1])) {
        for (let k = 0; k < 3; k++) s[k] += m.p[i + k];
        n++;
      }
    return s.map((v) => v / n);
  };
  // ombro real (z): centro do braço logo abaixo do ombro; mão: centro das 4 unidades mais baixas do braço
  const zD = centro(res.bracoD, (y) => y < Oy - 2 && y > Oy - 6)[2],
    zE = centro(res.bracoE, (y) => y < Oy - 2 && y > Oy - 6)[2];
  const OMBRO_Z = Math.round(((zD - zE) / 2) * 10) / 10;
  paraLocal(res.bracoD, [0, Oy, OMBRO_Z]);
  paraLocal(res.bracoE, [0, Oy, -OMBRO_Z]);
  const fundo = Math.min(...res.bracoD.p.filter((_, i) => i % 3 === 1));
  const MAO = centro(res.bracoD, (y) => y < fundo + 4);
  paraLocal(res.pernaD, [0, 15, 2.8]);
  paraLocal(res.pernaE, [0, 15, -2.8]);
  // tronco mais alto: estica do cinto (T0) até a base do pescoço (T1); a cabeça só sobe
  for (const m of [res.tronco, res.cabeca]) for (let i = 1; i < m.p.length; i += 3) m.p[i] = esticaY(m.p[i]);
  const OMBRO_JOGO = esticaY(28);
  const altura = Math.max(...res.cabeca.p.filter((_, i) => i % 3 === 1));
  info.push(
    `ombro (${OMBRO_JOGO.toFixed(2)}, ±${OMBRO_Z}), mão (${MAO.map((v) => v.toFixed(1)).join(", ")}), altura ${altura.toFixed(1)}`,
  );
  const torso = { p: [...res.tronco.p, ...res.cabeca.p], c: [...res.tronco.c, ...res.cabeca.c] };
  const pecas = { torso, bracoD: res.bracoD, bracoE: res.bracoE, pernaD: res.pernaD, pernaE: res.pernaE };
  const nt = Object.fromEntries(Object.entries(pecas).map(([k, v]) => [k, v.p.length / 9]));
  info.push(`triângulos: ${JSON.stringify(nt)} — total ${Object.values(nt).reduce((a, b) => a + b, 0)}`);
  return { ombroY: OMBRO_JOGO, ombroZ: OMBRO_Z, mao: MAO, pecas, info };
}

/** O JSON que o jogo lê (src/render/gl/heroina.ts): posições Int16 ×64, uma cor RGB por triângulo, base64. */
export function jsonDoJogo(h: Personagem) {
  const partes: Record<string, { p: string; c: string }> = {};
  for (const [k, m] of Object.entries(h.pecas)) {
    const nt = m.p.length / 9;
    const P16 = new Int16Array(m.p.length);
    for (let i = 0; i < m.p.length; i++) P16[i] = Math.round(m.p[i] * 64);
    const C8 = new Uint8Array(nt * 3);
    for (let t = 0; t < nt; t++)
      for (let c = 0; c < 3; c++) C8[t * 3 + c] = Math.round(Math.min(1, Math.max(0, m.c[t * 9 + c])) * 255);
    partes[k] = { p: Buffer.from(P16.buffer).toString("base64"), c: Buffer.from(C8.buffer).toString("base64") };
  }
  return JSON.stringify({
    versao: 1,
    ombroY: +h.ombroY.toFixed(2),
    ombroZ: h.ombroZ,
    mao: h.mao.map((v) => +v.toFixed(2)),
    partes,
  });
}
