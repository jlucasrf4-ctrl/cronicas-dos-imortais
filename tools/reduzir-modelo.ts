/* v8.0 — personagem do Tripo COM textura (um modelo só, ou um de uma folha lado a lado) em low poly e pose T, para
   vestir no esqueleto da heroína (plano de animações com "vestir", tools/lib/vestir.ts). O par de
   tools/pintar-modelo.ts (que é para os modelos que vêm sem textura). Mantenedor 2026-10-25: "tem outros personagens
   que só precisa alinhar o rig" (o samurai, os cavaleiros).

   Uso:  node tools/reduzir-modelo.ts <plano.json>
   Plano: { nome, glb, regiao? { xMin, xMax } (unidades do .glb; entra a ilha cujo centro cai dentro; uma ilha larga
   demais — dois personagens soldados pelas mãos — vai por triângulo), altura (m), triangulos, cabeca? { y, triangulos }
   (a cabeça reduz à parte com a sua cota, as duas com a borda do corte travada), texW, pasta }.
   Reduz com a cor levada em conta e passa a textura para uma cor por triângulo (tools/lib/peca.ts), centra em x/z com
   os pés em y=0 e exporta como o --tpose (frente +Z). Prévias de frente, costas e rosto em <pasta>/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { lerGLB, subMalha, desenhar, ilhas, type MalhaTex } from "./lib/glb.ts";
import { lerMalhaFbx } from "./lib/fbx.ts";
import { reduzirPeca, reduzirPecaUV } from "./lib/peca.ts";
import { exportarMalha } from "./lib/exportar.ts";
import { afinarTraseiro } from "./lib/afinar-traseiro.ts";

interface Plano {
  nome: string;
  /** .glb, ou .fbx (com `textura`: a imagem de cor que vem na pasta .fbm) */
  glb: string;
  textura?: string;
  /** y: folhas com mais de uma fileira (a dos aventureiros: o caçador embaixo, o explorador em cima) */
  regiao?: { xMin?: number; xMax?: number; yMin?: number; yMax?: number };
  altura: number;
  triangulos: number;
  /** Correção multiplicativa da imagem de cor; não altera a geometria ou os UVs. */
  cor?: [number, number, number];
  /** a cabeça: acima de y × altura do modelo, com `triangulos` só dela (dentro do total) */
  cabeca?: { y: number; triangulos: number };
  bracos?: { ombro: number; rampa?: number; acima?: number; grossura: number };
  /** fator de profundidade na parte traseira do quadril (1 = sem ajuste; 0.9 = reduz 10%) */
  afinarBunda?: number;
  /** v8.1 — achatar abas na cintura (frações da altura), ver abaixo */
  abas?: { de: number; ate: number; x?: number };
  /** v8.1 — tirar os triângulos que ligam as duas pernas (frações da altura), ver abaixo */
  separarPernas?: { de: number; ate: number };
  /** v8.1 — centrar em x pelo meio das pernas, ver abaixo */
  centrarPernas?: boolean;
  /** v8.1 — guarda a textura do Tripo (UV por canto, tools/lib/peca.ts reduzirPecaUV): <nome>_tpose_uv.bin (Float32, 6
   *  por triângulo, na ordem do .glb exportado) e <nome>_tpose_tex.webp com este lado em px. tools/juntar-vestidos.ts
   *  liga os dois ao personagem: o cabelo e o rosto pintados de verdade, não uma cor por triângulo */
  texturaSaida?: number;
  /** v8.1 — espelha a metade do corpo do lado `manter` (sinal do x do .glb) no lugar da outra, abaixo de `ate` (fração
   *  da altura; padrão a `cabeca.y`). Nos pares de mãos dadas o Tripo esticou o braço da mão dada (o M06: 0,415 da
   *  altura do ombro à ponta, o outro 0,250) e o corte passou entre os dedos */
  espelhar?: { manter: number; ate?: number };
  /** v8.1 — alonga o antebraço na pose T: de `de` (o cotovelo) a `ate` (o pulso), distâncias ao meio do corpo em
   *  frações da altura lidas numa vista do braço com régua, estica `fator` vezes; a mão só anda. O M06 do par: o braço
   *  de cima normal, o antebraço e o punho do Tripo curtos (0,088 da altura; a heroína tem 0,22) */
  alongarBracos?: { fator: number; de: number; ate: number };
  texW: number;
  pasta: string;
}

/** altura e x do meio das pernas (faixa 10–40% da altura) de uma malha */
function medidas(P: ArrayLike<number>) {
  let y0 = Infinity,
    y1 = -Infinity;
  for (let i = 1; i < P.length; i += 3) {
    y0 = Math.min(y0, P[i]);
    y1 = Math.max(y1, P[i]);
  }
  const H = y1 - y0;
  let xa = Infinity,
    xb = -Infinity;
  for (let i = 0; i < P.length; i += 3)
    if (P[i + 1] > y0 + 0.1 * H && P[i + 1] < y0 + 0.4 * H) {
      xa = Math.min(xa, P[i]);
      xb = Math.max(xb, P[i]);
    }
  return { y0, H, xc: (xa + xb) / 2 };
}

/**
 * v8.1 — `espelhar`: recorta (Sutherland–Hodgman) cada triângulo no plano do meio do corpo e na altura `yTop`; acima de
 * `yTop` tudo fica (a cabeça e o cabelo como são), abaixo só o lado `manter`, mais o espelho dele (ordem dos cantos
 * invertida: a face continua para fora). A costura do meio fecha sozinha — o vértice cortado no plano é o mesmo dos dois
 * lados, posição e UV —; a de `yTop`, do lado espelhado, é colada levando cada vértice espelhado dessa borda ao vértice
 * da borda de cima mais perto.
 */
function espelharMetade(m: MalhaTex, manter: number, yTopFrac: number): MalhaTex {
  const { y0, H, xc } = medidas(m.P),
    yTop = y0 + H * yTopFrac,
    eps = H * 1e-6;
  type V = number[]; // x, y, z, u, v
  const P: number[] = [],
    T: number[] = [],
    I: number[] = [],
    tipo: number[] = [],
    chaves = new Map<string, number>();
  const vert = (q: V, bit: number) => {
    const k = q.map((v) => Math.round(v * 1e7)).join(",");
    let i = chaves.get(k);
    if (i === undefined) {
      chaves.set(k, (i = P.length / 3));
      P.push(q[0], q[1], q[2]);
      T.push(q[3], q[4]);
      tipo.push(0);
    }
    tipo[i] |= bit;
    return i;
  };
  const cortar = (pol: V[], f: (q: V) => number) => {
    const out: V[] = [];
    for (let i = 0; i < pol.length; i++) {
      const a = pol[i],
        b = pol[(i + 1) % pol.length],
        fa = f(a),
        fb = f(b);
      if (fa >= 0) out.push(a);
      if (fa >= 0 !== fb >= 0) {
        const t = fa / (fa - fb);
        out.push(a.map((v, k) => v + (b[k] - v) * t));
      }
    }
    return out;
  };
  const emitir = (pol: V[], espelho: boolean, bit: number) => {
    if (pol.length < 3) return;
    const ids = (espelho ? pol.map((v) => [2 * xc - v[0], v[1], v[2], v[3], v[4]]) : pol).map((v) => vert(v, bit));
    for (let i = 1; i + 1 < ids.length; i++) {
      const tri = espelho ? [ids[0], ids[i + 1], ids[i]] : [ids[0], ids[i], ids[i + 1]];
      if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) I.push(...tri);
    }
  };
  for (let t = 0; t < m.I.length; t += 3) {
    const pol: V[] = [0, 1, 2].map((k) => {
      const v = m.I[t + k];
      return [m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2], m.T[v * 2], m.T[v * 2 + 1]];
    });
    emitir(
      cortar(pol, (q) => q[1] - yTop),
      false,
      1,
    );
    const lado = cortar(
      cortar(pol, (q) => yTop - q[1]),
      (q) => (q[0] - xc) * manter,
    );
    emitir(lado, false, 0);
    emitir(lado, true, 2);
  }
  // a borda de `yTop` do lado espelhado: o vértice espelhado vai ao de cima mais perto (em x/z)
  const naBorda = (i: number, bit: number) =>
    (tipo[i] & bit) !== 0 && Math.abs(P[i * 3 + 1] - yTop) < eps && (P[i * 3] - xc) * manter < -eps;
  const cima: number[] = [],
    esp: number[] = [];
  for (let i = 0; i < P.length / 3; i++) {
    if (naBorda(i, 1)) cima.push(i);
    else if (naBorda(i, 2)) esp.push(i);
  }
  let colados = 0;
  for (const i of esp) {
    let melhor = -1,
      md = (H * 0.03) ** 2;
    for (const j of cima) {
      const d = (P[i * 3] - P[j * 3]) ** 2 + (P[i * 3 + 2] - P[j * 3 + 2]) ** 2;
      if (d < md) {
        md = d;
        melhor = j;
      }
    }
    if (melhor < 0) continue;
    P[i * 3] = P[melhor * 3];
    P[i * 3 + 2] = P[melhor * 3 + 2];
    colados++;
  }
  console.log(
    `espelhar: lado ${manter > 0 ? "+x" : "-x"} até ${yTopFrac} da altura (meio x ${xc.toFixed(4)}); ${I.length / 3} triângulos, ${colados} de ${esp.length} vértices da costura colados`,
  );
  return { P: new Float32Array(P), T: new Float32Array(T), I: new Uint32Array(I), tex: m.tex, texW: m.texW };
}

/**
 * v8.1 — `alongarBracos`: na linha dos braços (pose T), de cada lado, o trecho entre `de` e `ate` (distâncias ao meio
 * do corpo, frações da altura) estica `fator` vezes no comprimento e o que vem depois (a mão) só anda.
 */
function alongarBracos(m: MalhaTex, fator: number, de: number, ate: number) {
  const { H, xc } = medidas(m.P);
  let mao = 0;
  for (let i = 0; i < m.P.length; i += 3) mao = Math.max(mao, Math.abs(m.P[i] - xc));
  const ys: number[] = [];
  for (let i = 0; i < m.P.length; i += 3) if (Math.abs(m.P[i] - xc) > mao * 0.7) ys.push(m.P[i + 1]);
  ys.sort((a, b) => a - b);
  const yb = ys[ys.length >> 1],
    ini = de * H,
    fim = ate * H;
  for (let i = 0; i < m.P.length; i += 3) {
    const d = Math.abs(m.P[i] - xc);
    if (d <= ini || Math.abs(m.P[i + 1] - yb) > H * 0.1) continue;
    const nd = d <= fim ? ini + (d - ini) * fator : d + (fim - ini) * (fator - 1);
    m.P[i] = xc + Math.sign(m.P[i] - xc) * nd;
  }
  console.log(
    `alongarBracos: ${de}–${ate} da altura × ${fator}; a ponta anda ${((fim - ini) * (fator - 1)) / H > 0 ? "+" : ""}${(((fim - ini) * (fator - 1)) / H).toFixed(3)} da altura`,
  );
}

const plano = JSON.parse(readFileSync(process.argv[2], "utf8")) as Plano;

/** .fbx do Tripo (a textura vem numa imagem à parte, `textura` no plano): triângulos com UV por canto. */
async function lerFbxTex(arquivo: string, textura: string, W: number): Promise<MalhaTex> {
  const f = lerMalhaFbx(readFileSync(arquivo));
  const P: number[] = [],
    T: number[] = [],
    I: number[] = [];
  f.poli.forEach((pl, k) => {
    const base = P.length / 3;
    pl.forEach((v, c) => {
      P.push(f.P[v * 3], f.P[v * 3 + 1], f.P[v * 3 + 2]);
      T.push(f.uv[k][c][0], 1 - f.uv[k][c][1]); // o v do FBX cresce para cima; o da imagem, para baixo
    });
    for (let c = 1; c + 1 < pl.length; c++) I.push(base, base + c, base + c + 1);
  });
  const tex = await sharp(textura).resize(W, W, { fit: "fill" }).removeAlpha().raw().toBuffer();
  return { P: new Float32Array(P), T: new Float32Array(T), I: new Uint32Array(I), tex, texW: W };
}

const m0 = plano.glb.toLowerCase().endsWith(".fbx")
  ? await lerFbxTex(plano.glb, plano.textura!, plano.texW)
  : await lerGLB(plano.glb, plano.texW);
let m = m0;
if (plano.cor)
  for (let i = 0; i < m0.tex.length; i++) m0.tex[i] = Math.min(255, Math.round(m0.tex[i] * plano.cor[i % 3]));
if (plano.regiao) {
  // por ilha (a ponta dos dedos do vizinho, cortada por triângulo, vinha junto e esticava a medida da mão); uma ilha
  // larga demais (dois personagens soldados pelas mãos) vai por triângulo
  const r = plano.regiao,
    x0 = r.xMin ?? -Infinity,
    x1 = r.xMax ?? Infinity,
    y0 = r.yMin ?? -Infinity,
    y1 = r.yMax ?? Infinity,
    dentro = (x: number, y: number) => x > x0 && x < x1 && y > y0 && y < y1,
    tris: number[] = [];
  let fx0 = Infinity,
    fx1 = -Infinity;
  for (let i = 0; i < m0.P.length; i += 3) {
    fx0 = Math.min(fx0, m0.P[i]);
    fx1 = Math.max(fx1, m0.P[i]);
  }
  // a faixa deste personagem (presa às bordas da folha); um personagem de braços abertos ocupa a faixa toda
  const largura = Math.min(x1, fx1) - Math.max(x0, fx0);
  let larga = 0;
  for (const g of ilhas(m0)) {
    if (g.max[0] - g.min[0] > 1.6 * largura) {
      larga++;
      for (const t of g.tris) {
        const c = [0, 1].map(
          (e) => (m0.P[m0.I[t * 3] * 3 + e] + m0.P[m0.I[t * 3 + 1] * 3 + e] + m0.P[m0.I[t * 3 + 2] * 3 + e]) / 3,
        );
        if (dentro(c[0], c[1])) tris.push(t);
      }
    } else if (dentro((g.min[0] + g.max[0]) / 2, (g.min[1] + g.max[1]) / 2)) for (const t of g.tris) tris.push(t); // push(...) estoura a pilha numa ilha de 450 mil
  }
  if (larga) console.log(`aviso: ${larga} ilha(s) larga(s) cortada(s) por triângulo`);
  m = subMalha(m0, tris);
}
if (plano.espelhar)
  m = espelharMetade(m, Math.sign(plano.espelhar.manter), plano.espelhar.ate ?? plano.cabeca?.y ?? 0.84);
if (plano.alongarBracos) alongarBracos(m, plano.alongarBracos.fator, plano.alongarBracos.de, plano.alongarBracos.ate);
// a cabeça (acima de `cabeca.y` × altura) reduz à parte, com a sua cota: o rosto precisa de olhos e boca
let baixa: { p: number[]; c: number[]; uv?: number[] };
const reduzir = (s: MalhaTex, alvo: number, travar = false): Promise<{ p: number[]; c: number[]; uv?: number[] }> =>
  plano.texturaSaida ? reduzirPecaUV(s, alvo, travar) : reduzirPeca(s, alvo, travar);
if (plano.cabeca) {
  let y0 = Infinity,
    y1 = -Infinity;
  for (let i = 1; i < m.P.length; i += 3) {
    y0 = Math.min(y0, m.P[i]);
    y1 = Math.max(y1, m.P[i]);
  }
  const corte = y0 + (y1 - y0) * plano.cabeca.y,
    cima: number[] = [],
    baixo: number[] = [];
  for (let t = 0; t < m.I.length / 3; t++) {
    const cy = (m.P[m.I[t * 3] * 3 + 1] + m.P[m.I[t * 3 + 1] * 3 + 1] + m.P[m.I[t * 3 + 2] * 3 + 1]) / 3;
    (cy > corte ? cima : baixo).push(t);
  }
  const a = await reduzir(subMalha(m, baixo), plano.triangulos - plano.cabeca.triangulos, true),
    b = await reduzir(subMalha(m, cima), plano.cabeca.triangulos, true);
  baixa = { p: [...a.p, ...b.p], c: [...a.c, ...b.c] };
  if (a.uv && b.uv) baixa.uv = [...a.uv, ...b.uv];
} else baixa = await reduzir(m, plano.triangulos);
const nt = baixa.p.length / 9;

// centro em x/z, pés em y=0
const mn = [Infinity, Infinity, Infinity],
  mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < baixa.p.length; i += 3)
  for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], baixa.p[i + k]);
    mx[k] = Math.max(mx[k], baixa.p[i + k]);
  }
const T = baixa.p.map((v, i) => (i % 3 === 1 ? v - mn[1] : v - (mn[i % 3] + mx[i % 3]) / 2));
// v8.1 — `centrarPernas`: o x = 0 no meio das pernas (faixa 10–40% da altura), não da caixa. Num personagem cortado de
// um par de mãos dadas, a caixa leva dedos do vizinho e o corpo saía 8% da altura para o lado: o vestir (que supõe as
// pernas em volta de x = 0) punha os ossos de uma perna perto da outra
if (plano.centrarPernas) {
  const H = mx[1] - mn[1];
  let xa = Infinity,
    xb = -Infinity;
  for (let i = 0; i < T.length; i += 3)
    if (T[i + 1] > 0.1 * H && T[i + 1] < 0.4 * H) {
      xa = Math.min(xa, T[i]);
      xb = Math.max(xb, T[i]);
    }
  const d = (xa + xb) / 2;
  for (let i = 0; i < T.length; i += 3) T[i] -= d;
  console.log(`centrarPernas: x ${(-d / H).toFixed(4)} da altura`);
}
if (plano.afinarBunda != null) afinarTraseiro(T, plano.afinarBunda);

// `bracos`: afina os braços da pose T (o explorador estilizado tinha braço da grossura da coxa; mantenedor
// 2026-10-25: "use como comparação a líder"). Cada fatia de x do braço (|x| > ombro, acima de `acima`, frações da
// altura) encolhe em y/z em volta do centro da fatia; entre `ombro` e `ombro + rampa` o fator vai de 1 a `grossura`.
if (plano.bracos) {
  const H = mx[1] - mn[1],
    b = plano.bracos,
    x0 = b.ombro * H,
    rampa = (b.rampa ?? 0.05) * H,
    yMin = (b.acima ?? 0.6) * H,
    passo = 0.01 * H,
    centros = new Map<number, number[]>(); // fatia (com sinal do lado) → soma y, soma z, n
  const fatia = (x: number) => Math.sign(x) * Math.floor(Math.abs(x) / passo);
  const noBraco = (i: number) => Math.abs(T[i]) > x0 && T[i + 1] > yMin;
  for (let i = 0; i < T.length; i += 3)
    if (noBraco(i)) {
      const f = fatia(T[i]),
        s = centros.get(f) ?? [0, 0, 0];
      s[0] += T[i + 1];
      s[1] += T[i + 2];
      s[2]++;
      centros.set(f, s);
    }
  for (let i = 0; i < T.length; i += 3)
    if (noBraco(i)) {
      const s = centros.get(fatia(T[i]))!,
        k = 1 - (1 - b.grossura) * Math.min(1, (Math.abs(T[i]) - x0) / rampa);
      T[i + 1] = s[0] / s[2] + (T[i + 1] - s[0] / s[2]) * k;
      T[i + 2] = s[1] / s[2] + (T[i + 2] - s[1] / s[2]) * k;
    }
}

// v8.1 — `abas`: achata o que sai para os lados na faixa da cintura (`de`–`ate`, frações da altura): nenhum ponto passa
// da largura do tronco logo acima e logo abaixo da faixa (a menor das duas), ou de `x` (fração da altura). O M04 dos corpos novos tinha "abas" ali,
// sobra do degrau da montagem da imagem de referência que o Tripo virou volume
if (plano.abas) {
  const H = mx[1] - mn[1],
    { de, ate } = plano.abas;
  const largura = (f: number) => {
    let l = 0;
    for (let i = 0; i < T.length; i += 3) if (Math.abs(T[i + 1] / H - f) < 0.01) l = Math.max(l, Math.abs(T[i]));
    return l;
  };
  const meio = plano.abas.x != null ? plano.abas.x * H : Math.min(largura(de - 0.02), largura(ate + 0.02)),
    lde = largura(de),
    late = largura(ate),
    R = 0.025;
  // o limite é `meio` no miolo da faixa e sobe suave (smoothstep em R) até a largura real em cada borda
  const lim = (f: number) => {
    const sobe = (t: number) => t * t * (3 - 2 * t);
    if (f < de + R) return meio + (lde - meio) * sobe(1 - (f - de) / R);
    if (f > ate - R) return meio + (late - meio) * sobe(1 - (ate - f) / R);
    return meio;
  };
  let n = 0;
  for (let i = 0; i < T.length; i += 3) {
    const f = T[i + 1] / H;
    if (f < de || f > ate || Math.abs(T[i]) <= lim(f)) continue;
    T[i] = Math.sign(T[i]) * lim(f);
    n++;
  }
  console.log(`abas: ${n} pontos achatados (meio |x| ≤ ${(meio / H).toFixed(3)} da altura)`);
}

// v8.1 — `separarPernas`: tira os triângulos que ligam uma perna à outra (atravessam o meio, x = 0) entre `de` e `ate`
// (frações da altura, abaixo da virilha). As coxas do M06 se encostam: a malha soldada no meio pegava peso das duas
// pernas e virava uma teia esticada entre elas ao andar
const fora = new Uint8Array(nt);
if (plano.separarPernas) {
  const H = mx[1] - mn[1],
    { de, ate } = plano.separarPernas;
  // o meio entre as pernas: o meio da largura das duas pernas juntas na faixa (a caixa, com os braços, nem sempre o
  // centra em x = 0; a mediana dos x pendia para a perna com mais vértices)
  let xa = Infinity,
    xb = -Infinity;
  for (let i = 0; i < T.length; i += 3)
    if (T[i + 1] > de * H && T[i + 1] < ate * H) {
      xa = Math.min(xa, T[i]);
      xb = Math.max(xb, T[i]);
    }
  const meio = Number.isFinite(xa) ? (xa + xb) / 2 : 0;
  let n = 0;
  for (let t = 0; t < nt; t++) {
    let a = Infinity,
      b = -Infinity,
      y = 0;
    for (let k = 0; k < 3; k++) {
      a = Math.min(a, T[t * 9 + k * 3]);
      b = Math.max(b, T[t * 9 + k * 3]);
      y += T[t * 9 + k * 3 + 1] / 3;
    }
    if (a < meio && b > meio && y > de * H && y < ate * H) {
      fora[t] = 1;
      n++;
    }
  }
  console.log(`separarPernas: ${n} triângulos entre as pernas tirados (meio x ${(meio / H).toFixed(4)} da altura)`);
}

mkdirSync(plano.pasta, { recursive: true });
const peca = { p: [] as number[], c: [] as number[] };
for (let t = 0; t < nt; t++)
  for (let k = 0; k < 3 && !fora[t]; k++) {
    const i = t * 9 + k * 3;
    peca.p.push(T[i + 2], T[i + 1], -T[i]); // espaço do jogo (frente +x, direita +z) para o exportador
    peca.c.push(baixa.c[t * 3], baixa.c[t * 3 + 1], baixa.c[t * 3 + 2]);
  }
const r = await exportarMalha(peca, plano.pasta, plano.nome + "_tpose", plano.altura);
console.log(`${plano.pasta}/${plano.nome}_tpose.glb/.obj: ${r.triangulos} triângulos, ${r.vertices} vértices`);
// v8.1 — a textura do Tripo e o UV de cada canto, na ordem dos triângulos exportados
if (plano.texturaSaida && baixa.uv) {
  const uv: number[] = [];
  for (let t = 0; t < nt; t++) if (!fora[t]) for (let k = 0; k < 6; k++) uv.push(baixa.uv[t * 6 + k]);
  const base = join(plano.pasta, plano.nome + "_tpose");
  writeFileSync(base + "_uv.bin", Buffer.from(new Float32Array(uv).buffer));
  const webp = await sharp(m0.tex, { raw: { width: m0.texW, height: m0.texW, channels: 3 } })
    .resize(plano.texturaSaida, plano.texturaSaida, { kernel: "lanczos3" })
    .webp({ quality: 86 })
    .toBuffer();
  writeFileSync(base + "_tex.webp", webp);
  console.log(
    `textura ${plano.texturaSaida}² (${(webp.length / 1024).toFixed(0)} KB) e UV de ${uv.length / 6} triângulos`,
  );
}

const I = Array.from({ length: nt * 3 }, (_, i) => i),
  corTri = (t: number) => [baixa.c[t * 3] * 255, baixa.c[t * 3 + 1] * 255, baixa.c[t * 3 + 2] * 255];
const h = mx[1] - mn[1];
await desenhar(join(plano.pasta, "previa_frente.png"), T, I, corTri, { W: 700 });
await desenhar(
  join(plano.pasta, "previa_costas.png"),
  T.map((v, i) => (i % 3 === 1 ? v : -v)),
  I,
  corTri,
  { W: 700 },
);
const rosto = { mn: [-h * 0.09, h * 0.8, -1], mx: [h * 0.09, h * 1.0, 1] };
await desenhar(join(plano.pasta, "previa_rosto.png"), T, I, corTri, { W: 500, caixaFixa: rosto });
console.log(`prévias em ${plano.pasta}/`);
