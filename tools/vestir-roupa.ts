/* v8.1 — veste uma roupa (malha à parte, gerada num manequim: tools/pintar-modelo.ts com `separar`) por cima de um
   corpo já no esqueleto da heroína (build/modelos/<corpo>_anim.json) e grava corpo + roupa num _anim.json do mesmo
   esqueleto (mantenedor, 2026-11-01: "uma malha que veste por cima do corpo, não um novo modelo 3D").
   Uso:  node tools/vestir-roupa.ts <plano.json> [--corpo=nome]
   1. Lê a roupa (pose T do exportador; cor por face pela paleta) e tira o manequim: as peças `manequim` inteiras e as
      manchas grandes de cinza frio (`cinza`) em qualquer peça — as pequenas (fivelas, rebites) ficam.
   2. Encaixe por marcos (chão, virilha, linha dos braços, ombro, mão, abertura dos pés), como tools/lib/vestir.ts,
      medidos com o manequim (a silhueta inteira) e no corpo.
   3. Caixas por fatia: em cada fatia (tronco e pernas por altura, braços pelo comprimento) a caixa da roupa (sem os
      `acessorios` e sem as pontas: percentis 4–96) vai à do corpo + `margem`. Num eixo em que a roupa cobre pouco do
      corpo (a alça no alto do ombro) ela só encosta no lado dela, sem esticar; o que passa da caixa (a adaga, as
      bolsas) segue a borda sem mudar de tamanho. Desvio suavizado pela malha.
   4. `pes`: a bota aperta para o pé. 5. Nada dentro da pele (empurra pela normal do vértice do corpo mais perto).
   6. Pesos: os 6 vértices do corpo mais perto (só do mesmo lado nas pernas e nos braços); o que fica longe da pele
      (`solto`: penduricalhos) e as `acessorios` copiam o peso do vértice preso mais perto andando pela malha — a adaga
      e as bolsas vão inteiras com o quadril, sem entortar entre o quadril e a coxa.
   7. A pele coberta some: triângulo do corpo cujos 3 vértices têm a roupa ao longo da normal (até `cobre`).
   8. Pintura: com `textura`/`uv` (o `textura` do pintar-modelo), os triângulos bem de frente levam a própria imagem
      (o cinza do manequim nela é repintado com a roupa em volta) e os outros uma cor lisa, a mediana dos vizinhos da
      mesma peça (a cor por triângulo da projeção variava a cada triângulo: um confete). O corpo aponta para uma faixa
      branca da textura e fica com a cor dele (o jogo multiplica cor × textura); se ele tem textura (reduzir-modelo
      `texturaSaida`: <corpo>_tpose/<corpo>_tpose_uv.bin + _tex.webp), ela entra na imagem embaixo da roupa.
   Prévia: as animações do corpo ficam (o mesmo esqueleto). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { decodificarAnim, type DadosAnim } from "../src/render/gl/esqueleto.ts";
import { reduzirAnimado } from "./lib/reduzir-animado.ts";
import { orcamentoRoupa } from "./lib/orcamento-personagem.ts";
import { ajustarCos, type AjusteCos } from "./lib/ajustar-cos.ts";
import { coberturaPorPeca, gradeTris, normaisVertice } from "./lib/cobertura-roupa.ts";

interface Plano {
  nome: string;
  roupa: string;
  pecas: string;
  /** o recorte da referência e, por triângulo (ordem do .glb), onde os cantos caem nele (pintar-modelo `textura`) */
  textura?: string;
  uv?: string;
  manequim: number[];
  /** tirar o cinza do manequim (false na armadura de placa: o aço também é cinza) */
  cinza?: boolean;
  /** o pescoço do manequim preso numa peça: sai acima de `acima` e a menos de `largura` do meio (frações da altura) */
  pescoco?: { acima: number; largura: number };
  /** peças com a mão do manequim junto (luva sem dedos): o cinza depois do pulso sai mesmo em mancha pequena */
  maos?: number[];
  acessorios?: number[];
  /** `ignorarCabelo`: o cabelo comprido do corpo fica fora das medidas e dos pesos (máscara de aparencias.json) */
  corpos: { nome: string; anim: string; ignorarCabelo?: boolean; cos?: AjusteCos }[];
  pasta: string;
  /** frações da altura do corpo */
  margem?: number;
  cobre?: number;
  solto?: number;
  orcamento?: Partial<Record<"peito" | "pernas" | "pes", number>>;
  /** Altura do cós (fração da altura); pecas restringe a faixa adicional à calça, sem levar a blusa. */
  cintura?: { altura: number; pecas?: number[] };
  /** aperto dos pés (bota): abaixo de `ate` (fração da altura), × `fator` para o centro do pé, folga × `folga` */
  pes?: { ate: number; fator: number; folga: number };
}
const plano = JSON.parse(readFileSync(process.argv[2], "utf8")) as Plano;
mkdirSync(plano.pasta, { recursive: true });

/* ---------- 1. a roupa ---------- */
async function lerRoupa() {
  const b = readFileSync(plano.roupa),
    jl = b.readUInt32LE(12),
    g = JSON.parse(b.subarray(20, 20 + jl).toString("utf8"));
  const bin = Buffer.from(b.subarray(28 + jl));
  const vista = (i: number) => {
    const v = g.bufferViews[i];
    return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  };
  const f32 = (acc: number) => {
    const s = vista(g.accessors[acc].bufferView);
    return new Float32Array(s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength));
  };
  const at = g.meshes[0].primitives[0].attributes;
  const P = f32(at.POSITION),
    UV = f32(at.TEXCOORD_0);
  const { data, info } = await sharp(vista(g.images[0].bufferView))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const nt = P.length / 9;
  const cor = new Uint8Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const x = Math.min(info.width - 1, Math.floor(UV[t * 6] * info.width)),
      y = Math.min(info.height - 1, Math.floor(UV[t * 6 + 1] * info.height));
    for (let k = 0; k < 3; k++) cor[t * 3 + k] = data[(y * info.width + x) * 3 + k];
  }
  // .glb (frente +Z, X lateral) → espaço do jogo (frente +x, direita +z), como tools/gerar-animacoes.ts
  const G = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    G[i] = P[i + 2];
    G[i + 1] = P[i + 1];
    G[i + 2] = -P[i];
  }
  return { P: G, cor, nt, peca: JSON.parse(readFileSync(plano.pecas, "utf8")) as number[] };
}
/** o cinza do manequim: na imagem ele pega o tom quente da cena (200,180,180), mas o verde fica igual ao azul; no couro,
 *  na blouse creme, na corda e na calça o verde passa do azul (os escuros demais, a calça, ficam de fora pelo brilho) */
const cinzaManequim = (r: number, g: number, b: number) => {
  const m = (r + g + b) / 3;
  return Math.abs(g - b) <= 8 && r - g <= 30 && r >= g - 6 && m >= 80 && m < 245;
};

/* ---------- marcos (espaço do jogo: lateral = z) ---------- */
interface Marcos {
  chao: number;
  virilha: number;
  braco: number;
  ombro: number;
  mao: number;
  pe: number;
  cx: number;
  h: number;
}
function marcos(P: ArrayLike<number>): Marcos {
  let chao = Infinity,
    topo = -Infinity,
    mao = 0;
  for (let i = 0; i < P.length; i += 3) {
    chao = Math.min(chao, P[i + 1]);
    topo = Math.max(topo, P[i + 1]);
    mao = Math.max(mao, Math.abs(P[i + 2]));
  }
  const h = topo - chao,
    med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1] ?? 0;
  const ys: number[] = [],
    pes: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    if (Math.abs(P[i + 2]) > mao * 0.7) ys.push(P[i + 1]);
    if (P[i + 1] - chao < h * 0.04) pes.push(Math.abs(P[i + 2]));
  }
  const braco = med(ys),
    virilha = chao + (braco - chao) * 0.64;
  const faixa: number[] = [],
    xs: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const y = P[i + 1],
      z = Math.abs(P[i + 2]);
    if (Math.abs(y - braco) < (braco - chao) * 0.016 && z > (braco - chao) * 0.07) faixa.push(z);
    if (y > virilha && y < braco && z < (braco - chao) * 0.12) xs.push(P[i]);
  }
  faixa.sort((a, b) => a - b);
  const ombro = faixa[Math.floor(faixa.length * 0.02)] ?? (braco - chao) * 0.12;
  return { chao, virilha, braco, ombro, mao, pe: med(pes), cx: xs.reduce((a, b) => a + b, 0) / (xs.length || 1), h };
}
const partes = (de: number[], para: number[]) => (v: number) => {
  let k = 0;
  while (k < de.length - 2 && v > de[k + 1]) k++;
  return para[k] + ((v - de[k]) * (para[k + 1] - para[k])) / (de[k + 1] - de[k]);
};

/* ---------- grade de pontos (vizinhos mais perto) ---------- */
function grade(P: ArrayLike<number>, cel: number) {
  const m = new Map<string, number[]>();
  const ch = (x: number, y: number, z: number) =>
    `${Math.floor(x / cel)},${Math.floor(y / cel)},${Math.floor(z / cel)}`;
  for (let v = 0; v < P.length / 3; v++) {
    const k = ch(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    const l = m.get(k) ?? [];
    l.push(v);
    m.set(k, l);
  }
  /** os k mais perto de q (que passam no filtro), procurando em cubos até `raioMax` células */
  return (q: number[], k: number, ok: (v: number) => boolean = () => true, raioMax = 8) => {
    const gx = Math.floor(q[0] / cel),
      gy = Math.floor(q[1] / cel),
      gz = Math.floor(q[2] / cel);
    let achados: [number, number][] = [];
    for (let r = 1; r <= raioMax && achados.length < k; r++) {
      achados = [];
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          for (let c = -r; c <= r; c++)
            for (const v of m.get(`${gx + a},${gy + b},${gz + c}`) ?? [])
              if (ok(v))
                achados.push([(P[v * 3] - q[0]) ** 2 + (P[v * 3 + 1] - q[1]) ** 2 + (P[v * 3 + 2] - q[2]) ** 2, v]);
    }
    return achados.sort((a, b) => a[0] - b[0]).slice(0, k);
  };
}

/* ---------- 7. o raio ao longo da normal acerta a roupa? (Möller–Trumbore numa grade de triângulos) ---------- */
/** suaviza um desvio por vértice pela malha (média com os vizinhos, `passos` vezes) */
function suavizar(D: Float64Array, viz: Set<number>[], passos: number) {
  for (let p = 0; p < passos; p++) {
    const D0 = Float64Array.from(D);
    for (let v = 0; v < viz.length; v++) {
      if (!viz[v].size) continue;
      for (let k = 0; k < 3; k++) {
        let s = D0[v * 3 + k];
        for (const u of viz[v]) s += D0[u * 3 + k];
        D[v * 3 + k] = s / (viz[v].size + 1);
      }
    }
  }
}

/* ---------- a roupa, uma vez: solda, tira o manequim, textura ---------- */
const roupa = await lerRoupa();
const nt0 = roupa.nt;
// solda os cantos (o exportador separa as faces; as peças do Tripo se tocam nas bordas: é uma superfície só)
const chaveV = new Map<string, number>(),
  VT = new Int32Array(nt0 * 3),
  PW: number[] = [];
for (let c = 0; c < nt0 * 3; c++) {
  const i = c * 3,
    ch = `${Math.round(roupa.P[i] * 1e5)},${Math.round(roupa.P[i + 1] * 1e5)},${Math.round(roupa.P[i + 2] * 1e5)}`;
  let v = chaveV.get(ch);
  if (v === undefined) {
    chaveV.set(ch, (v = PW.length / 3));
    PW.push(roupa.P[i], roupa.P[i + 1], roupa.P[i + 2]);
  }
  VT[c] = v;
}
const trisDoVert: number[][] = Array.from({ length: PW.length / 3 }, () => []);
for (let t = 0; t < nt0; t++) for (let k = 0; k < 3; k++) trisDoVert[VT[t * 3 + k]].push(t);
const areaTri = (t: number) => {
  const a = VT[t * 3] * 3,
    b = VT[t * 3 + 1] * 3,
    c = VT[t * 3 + 2] * 3;
  const u = [PW[b] - PW[a], PW[b + 1] - PW[a + 1], PW[b + 2] - PW[a + 2]],
    w = [PW[c] - PW[a], PW[c + 1] - PW[a + 1], PW[c + 2] - PW[a + 2]];
  return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
};

// 1. o manequim: as peças dele e as manchas grandes de cinza (as pequenas são fivelas e rebites)
const tirar = new Uint8Array(nt0),
  pecasManequim = new Set(plano.manequim);
for (let t = 0; t < nt0; t++) if (pecasManequim.has(roupa.peca[t])) tirar[t] = 1;
const ehCinza = (t: number) => cinzaManequim(roupa.cor[t * 3], roupa.cor[t * 3 + 1], roupa.cor[t * 3 + 2]);
let areaTotal = 0;
for (let t = 0; t < nt0; t++) if (!tirar[t]) areaTotal += areaTri(t);
let manchasTiradas = 0,
  trisCinza = 0;
const maos = new Set(plano.maos ?? []),
  mManequim = marcos(roupa.P),
  depoisDoPulso = (t: number) => {
    let z = 0;
    for (let k = 0; k < 3; k++) z += Math.abs(roupa.P[t * 9 + k * 3 + 2]) / 3;
    return z > mManequim.mao * 0.82;
  };
// `pescoco`: o pescoço do manequim colado numa peça da roupa (o peitoral da placa), onde o cinza não serve (o aço
// também é cinza: tirava pedaços da armadura) — sai o que tem o centro acima de `acima` e a menos de `largura` do meio
if (plano.pescoco)
  for (let t = 0; t < nt0; t++) {
    let y = 0,
      z = 0;
    for (let k = 0; k < 3; k++) {
      y += roupa.P[t * 9 + k * 3 + 1] / 3;
      z += roupa.P[t * 9 + k * 3 + 2] / 3;
    }
    if (y - mManequim.chao > plano.pescoco.acima * mManequim.h && Math.abs(z) < plano.pescoco.largura * mManequim.h)
      tirar[t] = 1;
  }
if (plano.cinza !== false) {
  const visto = new Uint8Array(nt0);
  for (let t0 = 0; t0 < nt0; t0++) {
    if (visto[t0] || tirar[t0] || !ehCinza(t0)) continue;
    const comp: number[] = [],
      fila = [t0];
    visto[t0] = 1;
    while (fila.length) {
      const t = fila.pop()!;
      comp.push(t);
      for (let k = 0; k < 3; k++)
        for (const u of trisDoVert[VT[t * 3 + k]])
          if (!visto[u] && !tirar[u] && ehCinza(u)) {
            visto[u] = 1;
            fila.push(u);
          }
    }
    const area = comp.reduce((s, t) => s + areaTri(t), 0);
    // `maos`: nas peças com a mão do manequim junto (a luva sem dedos), o cinza depois do pulso são os dedos, cada um
    // uma mancha pequena como uma fivela; as fivelas da braçadeira ficam antes do pulso
    const naMao = comp.every((t) => maos.has(roupa.peca[t])) && comp.some((t) => depoisDoPulso(t));
    if (area > areaTotal * 0.003 || naMao) {
      for (const t of comp) tirar[t] = 1;
      manchasTiradas++;
      trisCinza += comp.length;
    }
  }
}

// a roupa que fica, compactada
const novoV = new Int32Array(PW.length / 3).fill(-1),
  RP: number[] = [],
  RI: number[] = [],
  RC: number[] = [],
  RT: number[] = [],
  RPecaT: number[] = [];
for (let t = 0; t < nt0; t++) {
  if (tirar[t]) continue;
  for (let k = 0; k < 3; k++) {
    const w = VT[t * 3 + k];
    if (novoV[w] < 0) {
      novoV[w] = RP.length / 3;
      RP.push(PW[w * 3], PW[w * 3 + 1], PW[w * 3 + 2]);
    }
    RI.push(novoV[w]);
  }
  RC.push(roupa.cor[t * 3], roupa.cor[t * 3 + 1], roupa.cor[t * 3 + 2]);
  RT.push(t);
  RPecaT.push(roupa.peca[t]);
}
const nvR = RP.length / 3,
  ntR = RI.length / 3;
const vizR: Set<number>[] = Array.from({ length: nvR }, () => new Set<number>()),
  trisDeR: number[][] = Array.from({ length: nvR }, () => []);
for (let t = 0; t < ntR; t++)
  for (let k = 0; k < 3; k++) {
    vizR[RI[t * 3 + k]].add(RI[t * 3 + ((k + 1) % 3)]);
    vizR[RI[t * 3 + ((k + 1) % 3)]].add(RI[t * 3 + k]);
    trisDeR[RI[t * 3 + k]].push(t);
  }
const acess = new Set(plano.acessorios ?? []),
  acessV = new Uint8Array(nvR);
for (let t = 0; t < ntR; t++) if (acess.has(RPecaT[t])) for (let k = 0; k < 3; k++) acessV[RI[t * 3 + k]] = 1;
console.log(
  `${plano.nome}: ${ntR} de ${nt0} triângulos são roupa (${trisCinza} em ${manchasTiradas} manchas de cinza do manequim tirados)`,
);

// 8. a textura: o cinza do manequim repintado com a roupa em volta (a imagem de cada corpo é montada no laço dele)
let textura: { px: Buffer; W: number; H: number; uv: (number[] | null)[] } | null = null;
if (plano.textura && plano.uv) {
  const { data, info } = await sharp(plano.textura).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    px = Buffer.from(data);
  const fundo = (p: number) => px[p * 3] + px[p * 3 + 1] + px[p * 3 + 2] > 245 * 3;
  const cand = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) cand[p] = !fundo(p) && cinzaManequim(px[p * 3], px[p * 3 + 1], px[p * 3 + 2]) ? 1 : 0;
  // só as manchas grandes (a fivela de prata fica)
  const furo = new Uint8Array(W * H),
    visto = new Uint8Array(W * H);
  for (let p0 = 0; p0 < W * H; p0++) {
    if (!cand[p0] || visto[p0]) continue;
    const comp: number[] = [],
      fila = [p0];
    visto[p0] = 1;
    while (fila.length) {
      const p = fila.pop()!;
      comp.push(p);
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W])
        if (q >= 0 && q < W * H && cand[q] && !visto[q]) {
          visto[q] = 1;
          fila.push(q);
        }
    }
    if (comp.length > 400) for (const p of comp) furo[p] = 1;
  }
  // repinta de fora para dentro com a média dos vizinhos já pintados (sem o fundo branco)
  let falta = 0;
  for (let passo = 0; passo < 80; passo++) {
    const pinta: [number, number[]][] = [];
    for (let p = 0; p < W * H; p++) {
      if (!furo[p]) continue;
      const x = p % W,
        s = [0, 0, 0];
      let n = 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W])
        if (q >= 0 && q < W * H && !furo[q] && !fundo(q)) {
          for (let k = 0; k < 3; k++) s[k] += px[q * 3 + k];
          n++;
        }
      if (n) pinta.push([p, s.map((v) => v / n)]);
    }
    if (!pinta.length) break;
    for (const [p, c] of pinta) {
      for (let k = 0; k < 3; k++) px[p * 3 + k] = Math.round(c[k]);
      furo[p] = 0;
    }
  }
  for (let p = 0; p < W * H; p++) falta += furo[p];
  textura = { px, W, H, uv: JSON.parse(readFileSync(plano.uv, "utf8")) as (number[] | null)[] };
  if (textura.uv.length !== nt0) throw new Error(`${plano.uv}: ${textura.uv.length} triângulos para ${nt0}`);
  console.log(`textura ${W}×${H}; ${falta} px de manequim sem repintar`);
}
// de frente: só os bem de frente levam a imagem (os de raspão a esticavam); o sinal da normal vem dos que têm imagem
const frontal = new Float64Array(ntR);
{
  let soma = 0;
  for (let t = 0; t < ntR; t++) {
    const a = RI[t * 3] * 3,
      b = RI[t * 3 + 1] * 3,
      c = RI[t * 3 + 2] * 3;
    const u = [RP[b] - RP[a], RP[b + 1] - RP[a + 1], RP[b + 2] - RP[a + 2]],
      w = [RP[c] - RP[a], RP[c + 1] - RP[a + 1], RP[c + 2] - RP[a + 2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    frontal[t] = n[0] / (Math.hypot(n[0], n[1], n[2]) || 1);
    if (textura?.uv[RT[t]]) soma += frontal[t];
  }
  if (soma < 0) for (let t = 0; t < ntR; t++) frontal[t] = -frontal[t];
}
const comImagem = (t: number) => !!textura?.uv[RT[t]] && frontal[t] >= 0.3;
// cor lisa dos outros: mediana dos vizinhos da mesma peça (3 passadas); os de imagem entram só como vizinhos
const corLisa = Float64Array.from(RC);
for (let p = 0; p < 3; p++) {
  const C0 = Float64Array.from(corLisa);
  for (let t = 0; t < ntR; t++) {
    if (comImagem(t)) continue;
    const viz = new Set<number>([t]);
    for (let k = 0; k < 3; k++) for (const u of trisDeR[RI[t * 3 + k]]) if (RPecaT[u] === RPecaT[t]) viz.add(u);
    for (let k = 0; k < 3; k++) {
      const vs = [...viz].map((u) => C0[u * 3 + k]).sort((a, b) => a - b);
      corLisa[t * 3 + k] = vs[vs.length >> 1];
    }
  }
}

/* ---------- por corpo ---------- */
const m0 = marcos(roupa.P); // com o manequim: a silhueta inteira
const filtroCorpo = process.argv.find((arg) => arg.startsWith("--corpo="))?.slice("--corpo=".length);
if (filtroCorpo && !plano.corpos.some((corpo) => corpo.nome === filtroCorpo))
  throw new Error(`Corpo ausente no plano: ${filtroCorpo}`);
for (const corpo of plano.corpos.filter((corpo) => !filtroCorpo || corpo.nome === filtroCorpo)) {
  const dados = JSON.parse(readFileSync(corpo.anim, "utf8")) as DadosAnim;
  const A = decodificarAnim({ ...dados, clips: {} });
  // `ignorarCabelo` (cabelo comprido: a F03): os vértices só de cabelo (a máscara de tools/gerar-aparencias.ts) ficam
  // fora das medidas, das caixas, do empurrão para fora da pele e dos pesos — o cabelo nas costas puxava o centro do
  // tronco para trás e a blusa afundava amassada no peito
  const cabeloV = new Uint8Array(A.P.length / 3);
  if (corpo.ignorarCabelo) {
    const ap = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as {
        corpos: { nome: string; mascaraPropria?: string }[];
      },
      mp = ap.corpos.find((c) => c.nome === corpo.nome)?.mascaraPropria;
    if (!mp) throw new Error(`${corpo.nome}: sem a máscara em aparencias.json (rode tools/gerar-aparencias.ts)`);
    const mask = Buffer.from(mp, "base64");
    if (mask.length !== A.I.length / 3)
      throw new Error(`${corpo.nome}: máscara de ${mask.length} para ${A.I.length / 3}`);
    const emCabelo = new Uint8Array(cabeloV.length),
      emOutro = new Uint8Array(cabeloV.length);
    for (let t = 0; t < mask.length; t++)
      for (let k = 0; k < 3; k++) (mask[t] === 2 ? emCabelo : emOutro)[A.I[t * 3 + k]] = 1;
    for (let v = 0; v < cabeloV.length; v++) cabeloV[v] = emCabelo[v] && !emOutro[v] ? 1 : 0;
    console.log(`${corpo.nome}: ${cabeloV.reduce((s, x) => s + x, 0)} vértices de cabelo fora das medidas`);
  }
  const mb = marcos(A.P.filter((_, i) => !cabeloV[Math.floor(i / 3)])),
    hb = mb.braco - mb.chao,
    margem = (plano.margem ?? 0.006) * mb.h;

  /* 2. marcos */
  const fy = partes([m0.chao, m0.virilha, m0.braco], [mb.chao, mb.virilha, mb.braco]);
  const escT = hb / (m0.braco - m0.chao);
  const fyAcima = (y: number) => mb.braco + (y - m0.braco) * escT;
  const fBraco = partes([0, m0.ombro, m0.mao], [0, mb.ombro, mb.mao]);
  const V = new Float64Array(nvR * 3);
  for (let v = 0; v < nvR; v++) {
    const x = RP[v * 3],
      y = RP[v * 3 + 1],
      z = RP[v * 3 + 2],
      az = Math.abs(z),
      s = Math.sign(z);
    const tp = Math.min(1, Math.max(0, (y - m0.virilha) / ((m0.braco - m0.virilha) * 0.5)));
    const sz = (mb.pe / m0.pe) * (1 - tp) + escT * tp;
    const noBraco = Math.abs(y - m0.braco) < (m0.braco - m0.chao) * 0.1 && az > m0.ombro;
    V[v * 3] = mb.cx + (x - m0.cx) * escT;
    V[v * 3 + 1] = y > m0.braco ? fyAcima(y) : fy(y);
    V[v * 3 + 2] = noBraco ? s * fBraco(az) : z * sz;
  }

  /* 3. caixas por fatia */
  const seg = (x: number, y: number, z: number) => {
    if (Math.abs(z) > mb.ombro * 1.05 && Math.abs(y - mb.braco) < hb * 0.14) return z < 0 ? 3 : 4;
    if (y < mb.virilha) return z < 0 ? 1 : 2;
    return 0;
  };
  const passo = hb * 0.025,
    chave = (s: number, y: number, z: number) => `${s}:${Math.floor((s >= 3 ? Math.abs(z) : y) / passo)}`;
  const eixos = (s: number, x: number, y: number, z: number) => [x, s >= 3 ? y : z];
  /** caixa de cada fatia: percentis `p`–(1 − p) de cada eixo da seção */
  const caixas = (P: ArrayLike<number>, n: number, ok: (v: number) => boolean, p: number) => {
    const vals = new Map<string, [number[], number[]]>();
    for (let v = 0; v < n; v++) {
      if (!ok(v)) continue;
      const x = P[v * 3],
        y = P[v * 3 + 1],
        z = P[v * 3 + 2],
        s = seg(x, y, z);
      // fora dos ombros só na altura dos braços (no quadril, mais largo que os ombros, tudo conta)
      if (s === 0 && Math.abs(z) > mb.ombro && y > mb.braco - hb * 0.2) continue;
      const [a, b] = eixos(s, x, y, z),
        k = chave(s, y, z),
        l = vals.get(k) ?? [[], []];
      l[0].push(a);
      l[1].push(b);
      vals.set(k, l);
    }
    const m = new Map<string, number[]>();
    for (const [k, [as, bs]] of vals) {
      as.sort((x, y) => x - y);
      bs.sort((x, y) => x - y);
      const q = (l: number[], f: number) => l[Math.min(l.length - 1, Math.max(0, Math.round(f * (l.length - 1))))];
      m.set(k, [q(as, p), q(as, 1 - p), q(bs, p), q(bs, 1 - p), as.length]);
    }
    return m;
  };
  const cB = caixas(A.P, A.P.length / 3, (v) => !cabeloV[v], 0),
    cR = caixas(V, nvR, (v) => !acessV[v], 0.04);
  // mediana das fatias vizinhas (±2): uma fatia magra (a ponta de uma tira) não puxa a roupa
  const mediana = (m: Map<string, number[]>, k: string) => {
    const [s, f] = k.split(":").map(Number),
      vs: number[][] = [];
    for (let d = -2; d <= 2; d++) {
      const c = m.get(`${s}:${f + d}`);
      if (c && c[4] >= 4) vs.push(c);
    }
    if (vs.length < 2) return null;
    return [0, 1, 2, 3].map((i) => vs.map((c) => c[i]).sort((a, b) => a - b)[vs.length >> 1]);
  };
  /** leva `val` da caixa [g0, g1] da roupa à [b0, b1] do corpo (+ margem). Cobrindo pouco do corpo nesse eixo, só
   *  encosta no lado em que está (a alça no alto do ombro não vira uma manga); fora da caixa, anda junto com a borda */
  const mapa = (val: number, g0: number, g1: number, b0: number, b1: number, contrairBusto = 0) => {
    const gw = g1 - g0,
      bw = b1 - b0;
    if (gw < 1e-6 || bw < 1e-6) return val;
    let f: (u: number) => number;
    const centralizar = (u: number, e: number) => {
      const meio = (b0 + b1) / 2,
        inicio = meio - (gw * e) / 2,
        fim = meio + (gw * e) / 2;
      if (u < g0) return inicio - (g0 - u);
      if (u > g1) return fim + (u - g1);
      return inicio + (u - g0) * e;
    };
    if (gw / bw >= 0.6) {
      const e = (bw + 2 * margem) / gw;
      f = (u) => b0 - margem + (u - g0) * e;
    } else {
      const d = (g0 + g1) / 2 >= (b0 + b1) / 2 ? b1 + margem - g1 : b0 - margem - g0;
      f = (u) => u + d;
    }
    const encaixe = val < g0 ? f(g0) - (g0 - val) : val > g1 ? f(g1) + (val - g1) : f(val);
    if (contrairBusto <= 0 || gw <= bw + 2 * margem) return encaixe;
    const escala = Math.min(1, (bw + 2 * margem) / gw),
      justo = centralizar(val, escala);
    return encaixe + (justo - encaixe) * contrairBusto;
  };
  /** o desvio de um ponto pelas caixas da seção `s` (null sem caixa ali) */
  const suave = (t: number) => {
    const q = Math.min(1, Math.max(0, t));
    return q * q * (3 - 2 * q);
  };
  const desvio = (s: number, x: number, y: number, z: number) => {
    const k = chave(s, y, z),
      b = mediana(cB, k),
      r = mediana(cR, k);
    if (!b || !r) return null;
    const [a, c] = eixos(s, x, y, z),
      tPeito = (y - mb.virilha) / (mb.braco - mb.virilha),
      pesoBusto = s === 0 ? 0.35 * suave((tPeito - 0.52) / 0.14) * (1 - suave((tPeito - 0.92) / 0.09)) : 0,
      d = [mapa(a, r[0], r[1], b[0], b[1], pesoBusto) - x, 0, 0];
    if (s >= 3) d[1] = c - y;
    else d[2] = mapa(c, r[2], r[3], b[2], b[3], pesoBusto) - z;
    return d;
  };
  // A transição tronco/braço usa a mesma curva nos dois lados e também suaviza a borda de altura. Sem essa segunda
  // curva, uma fileira de vértices da alça cai na caixa do braço e a fileira vizinha volta ao tronco: o degrau torce
  // a alça e abre triângulos na junção com o busto, sobretudo sob uma ombreira assimétrica.
  const D = new Float64Array(nvR * 3);
  for (let v = 0; v < nvR; v++) {
    const x = V[v * 3],
      y = V[v * 3 + 1],
      z = V[v * 3 + 2];
    let d = desvio(seg(x, y, z), x, y, z);
    const lateral = suave((Math.abs(z) / mb.ombro - 1.0) / 0.85),
      altura = 1 - suave((Math.abs(y - mb.braco) / hb - 0.06) / 0.24),
      w = lateral * altura;
    if (w > 0 && w < 1) {
      const dt = desvio(0, x, y, z),
        da = desvio(z < 0 ? 3 : 4, x, y, z),
        ws = w;
      if (dt && da) d = dt.map((e, i) => e * (1 - ws) + da[i] * ws);
    }
    if (d) for (let e = 0; e < 3; e++) D[v * 3 + e] = d[e];
  }
  suavizar(D, vizR, 4);
  for (let i = 0; i < V.length; i++) V[i] += D[i];

  // O molde tem bojos próprios e o encaixe por caixas não acompanha bem o relevo de cada peito. Limita a folga
  // frontal da roupa à distância medida da pele deste corpo; assim os bojos diminuem nos corpos menores e mantêm
  // volume nos corpos mais cheios. A correção é local e suavizada para não achatar alças, laterais ou abdômen.
  const NB = normaisVertice(A.P, A.I),
    pertoTodos = grade(A.P, mb.h / 60),
    pertoCorpo = (q: number[], k: number, ok: (v: number) => boolean = () => true, raioMax = 8) =>
      pertoTodos(q, k, (v) => !cabeloV[v] && ok(v), raioMax),
    faixaPeito = (y: number) => y > mb.virilha + (mb.braco - mb.virilha) * 0.45 && y < mb.braco + hb * 0.02,
    folgaPeito = margem,
    passoBusto = mb.h / 60,
    faixaFrontal = new Map<string, [number, number, number][]>(),
    apertaPeito = new Float64Array(V.length);
  for (let b = 0; b < A.P.length / 3; b++) {
    const x = A.P[b * 3],
      y = A.P[b * 3 + 1],
      z = A.P[b * 3 + 2];
    if (cabeloV[b] || !faixaPeito(y) || NB[b * 3] <= 0.2 || Math.abs(z) > mb.ombro * 1.2) continue;
    const k = `${Math.floor(y / passoBusto)}:${Math.floor(z / passoBusto)}`,
      l = faixaFrontal.get(k) ?? [];
    l.push([x, y, z]);
    faixaFrontal.set(k, l);
  }
  const frenteNaSecao = (y: number, z: number) => {
    let menor = Infinity,
      frente = -Infinity;
    const gy = Math.floor(y / passoBusto),
      gz = Math.floor(z / passoBusto);
    for (let a = -6; a <= 6; a++)
      for (let b = -6; b <= 6; b++)
        for (const [x, yy, zz] of faixaFrontal.get(`${gy + a}:${gz + b}`) ?? []) {
          const d2 = (yy - y) ** 2 + (zz - z) ** 2;
          if (d2 < menor) {
            menor = d2;
            frente = x;
          } else if (d2 <= menor + passoBusto * passoBusto) frente = Math.max(frente, x);
        }
    return menor <= (passoBusto * 6) ** 2 ? frente : null;
  };
  for (let v = 0; v < nvR; v++) {
    const q = [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]];
    if (!faixaPeito(q[1]) || Math.abs(q[2]) < mb.ombro * 0.18 || Math.abs(q[2]) > mb.ombro * 1.1) continue;
    const frente = frenteNaSecao(q[1], q[2]);
    if (frente == null || q[0] <= frente + folgaPeito) continue;
    // A frente do bojo acompanha o ponto mais próximo da pele em altura e lateral; o corpo maior conserva volume.
    apertaPeito[v * 3] = -(q[0] - frente - folgaPeito);
  }
  suavizar(apertaPeito, vizR, 2);
  for (let i = 0; i < V.length; i++) V[i] += apertaPeito[i];

  /* Colo e alças: a projeção por caixas deixa a parte alta reta e larga quando o corpo de destino muda.
     Estreita a largura lateral só no alto do tronco e limita a distância da roupa à superfície deste corpo.
     A transição suave preserva o bojo abaixo e não mexe em bolsas, bainhas ou outros acessórios. */
  const ajusteColo = new Float64Array(V.length),
    maxFolgaColo = margem * 1.7;
  for (let v = 0; v < nvR; v++) {
    if (acessV[v]) continue;
    const x = V[v * 3],
      y = V[v * 3 + 1],
      z = V[v * 3 + 2],
      t = (y - mb.virilha) / (mb.braco - mb.virilha),
      peso = suave((t - 0.62) / 0.18) * (1 - suave((t - 1.12) / 0.14)),
      segmento = seg(x, y, z),
      tampaOmbro = (segmento === 3 || segmento === 4) && Math.abs(y - mb.braco) < mb.h * 0.08;
    if (peso <= 0 || Math.abs(z) > mb.ombro * 1.25 || (segmento !== 0 && !tampaOmbro)) continue;

    // Alças e laterais do decote ficam mais estreitas sem deslocar o centro do peito.
    if (segmento === 0) ajusteColo[v * 3 + 2] = -z * 0.16 * peso;

    // Segue a curvatura real do ombro/peito: reduz folga frontal excessiva, mantendo uma camada sobre a pele.
    const q = [x, y, z],
      [m] = pertoCorpo(q, 1);
    if (!m || Math.sqrt(m[0]) > mb.h * 0.09) continue;
    const b = m[1],
      distancia =
        (q[0] - A.P[b * 3]) * NB[b * 3] +
        (q[1] - A.P[b * 3 + 1]) * NB[b * 3 + 1] +
        (q[2] - A.P[b * 3 + 2]) * NB[b * 3 + 2],
      excesso = Math.max(0, distancia - maxFolgaColo) * peso;
    for (let k = 0; k < 3; k++) ajusteColo[v * 3 + k] -= NB[b * 3 + k] * excesso;
  }
  suavizar(ajusteColo, vizR, 2);
  for (let i = 0; i < V.length; i++) V[i] += ajusteColo[i];

  /* 4. `pes`: abaixo de `ate` (fração da altura) a roupa aperta para o centro do pé de cada lado, por `fator`, e a
     folga ali é `folga` × margem (a bota saía 35% mais larga que o pé; mantenedor 2026-11-01: "pés muito grandes") */
  const naPe = (y: number) => plano.pes && y - mb.chao < plano.pes.ate * mb.h;
  if (plano.pes) {
    const centro = new Map<number, number[]>();
    for (let v = 0; v < A.P.length / 3; v++) {
      if (!naPe(A.P[v * 3 + 1])) continue;
      const s = Math.sign(A.P[v * 3 + 2]),
        c = centro.get(s) ?? [0, 0, 0];
      c[0] += A.P[v * 3];
      c[1] += A.P[v * 3 + 2];
      c[2]++;
      centro.set(s, c);
    }
    for (let v = 0; v < nvR; v++) {
      const y = V[v * 3 + 1];
      if (!naPe(y)) continue;
      const c = centro.get(Math.sign(V[v * 3 + 2]));
      if (!c) continue;
      // o aperto some suavemente perto do tornozelo (sem degrau no cano da bota)
      const t = Math.min(1, ((plano.pes.ate * mb.h - (y - mb.chao)) / (plano.pes.ate * mb.h)) * 3),
        f = 1 - (1 - plano.pes.fator) * t;
      V[v * 3] = c[0] / c[2] + (V[v * 3] - c[0] / c[2]) * f;
      V[v * 3 + 2] = c[1] / c[2] + (V[v * 3 + 2] - c[1] / c[2]) * f;
    }
  }

  /* 5. para fora da pele */
  let empurrados = 0;
  for (let it = 0; it < 2; it++)
    for (let v = 0; v < nvR; v++) {
      const q = [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]];
      const [m] = pertoCorpo(q, 1);
      if (!m) continue;
      const b = m[1],
        d =
          (q[0] - A.P[b * 3]) * NB[b * 3] +
          (q[1] - A.P[b * 3 + 1]) * NB[b * 3 + 1] +
          (q[2] - A.P[b * 3 + 2]) * NB[b * 3 + 2];
      const mg = naPe(q[1]) ? margem * plano.pes!.folga : margem;
      if (d >= mg) continue;
      for (let k = 0; k < 3; k++) V[v * 3 + k] += NB[b * 3 + k] * (mg - d);
      if (!it) empurrados++;
    }

  /* 6. pesos: os presos pelo corpo; os soltos (longe da pele) e os acessórios pelo preso mais perto andando pela malha */
  const limSolto = (plano.solto ?? 0.025) * mb.h,
    solto = new Uint8Array(nvR);
  for (let v = 0; v < nvR; v++) {
    const [m] = pertoCorpo([V[v * 3], V[v * 3 + 1], V[v * 3 + 2]], 1);
    solto[v] = acessV[v] || !m || Math.sqrt(m[0]) > limSolto ? 1 : 0;
  }
  const J = new Uint8Array(nvR * 4),
    W = new Uint8Array(nvR * 4);
  for (let v = 0; v < nvR; v++) {
    if (solto[v]) continue;
    const q = [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]],
      s = seg(q[0], q[1], q[2]);
    const mesmoLado = (b: number) =>
      s === 0
        ? true
        : Math.sign(A.P[b * 3 + 2]) === Math.sign(q[2]) && (s < 3 || Math.abs(A.P[b * 3 + 2]) > mb.ombro * 0.7);
    const viz = pertoCorpo(q, 6, mesmoLado, 12);
    const soma = new Map<number, number>();
    for (const [d2, b] of viz) {
      const f = 1 / (Math.sqrt(d2) + mb.h * 0.002);
      for (let k = 0; k < 4; k++)
        if (A.W[b * 4 + k] > 0) soma.set(A.J[b * 4 + k], (soma.get(A.J[b * 4 + k]) ?? 0) + A.W[b * 4 + k] * f);
    }
    const top = [...soma].sort((a, b) => b[1] - a[1]).slice(0, 4),
      tot = top.reduce((a, b) => a + b[1], 0) || 1,
      qs = top.map(([, w]) => Math.round((w / tot) * 255));
    if (qs.length) qs[0] += 255 - qs.reduce((a, b) => a + b, 0);
    top.forEach(([j], k) => {
      J[v * 4 + k] = j;
      W[v * 4 + k] = qs[k];
    });
  }
  // Dijkstra de todos os presos ao mesmo tempo; o solto copia o peso do preso que chegou primeiro
  const dist = new Float64Array(nvR).fill(Infinity),
    origem = new Int32Array(nvR).fill(-1),
    fila: [number, number][] = [];
  const sobe = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fila[p][0] <= fila[i][0]) break;
      [fila[p], fila[i]] = [fila[i], fila[p]];
      i = p;
    }
  };
  const tira = () => {
    const topo = fila[0],
      ult = fila.pop()!;
    if (fila.length) {
      fila[0] = ult;
      for (let i = 0; ;) {
        const a = i * 2 + 1,
          b = a + 1;
        let m = i;
        if (a < fila.length && fila[a][0] < fila[m][0]) m = a;
        if (b < fila.length && fila[b][0] < fila[m][0]) m = b;
        if (m === i) break;
        [fila[m], fila[i]] = [fila[i], fila[m]];
        i = m;
      }
    }
    return topo;
  };
  for (let v = 0; v < nvR; v++)
    if (!solto[v]) {
      dist[v] = 0;
      origem[v] = v;
      fila.push([0, v]);
      sobe(fila.length - 1);
    }
  while (fila.length) {
    const [d, v] = tira();
    if (d > dist[v]) continue;
    for (const u of vizR[v]) {
      const du = d + Math.hypot(V[u * 3] - V[v * 3], V[u * 3 + 1] - V[v * 3 + 1], V[u * 3 + 2] - V[v * 3 + 2]);
      if (du < dist[u]) {
        dist[u] = du;
        origem[u] = origem[v];
        fila.push([du, u]);
        sobe(fila.length - 1);
      }
    }
  }
  let soltos = 0;
  for (let v = 0; v < nvR; v++) {
    if (!solto[v]) continue;
    soltos++;
    const o = origem[v];
    if (o < 0) continue;
    for (let k = 0; k < 4; k++) {
      J[v * 4 + k] = J[o * 4 + k];
      W[v * 4 + k] = W[o * 4 + k];
    }
  }

  /* 7. a pele coberta */
  const acerta = gradeTris(V, RI, mb.h / 40),
    nvB = A.P.length / 3,
    coberto = new Uint8Array(nvB),
    ate = (plano.cobre ?? 0.04) * mb.h;
  for (let b = 0; b < nvB; b++) {
    const p = [A.P[b * 3], A.P[b * 3 + 1], A.P[b * 3 + 2]],
      n = [NB[b * 3], NB[b * 3 + 1], NB[b * 3 + 2]],
      peito = p[1] > mb.virilha + (mb.braco - mb.virilha) * 0.45 && p[1] < mb.braco + hb * 0.02,
      paraDentro = p[2] > 0 ? [0, 0, -1] : [0, 0, 1];
    // também para dentro, perto: a pele que fura a roupa (o seio grande entre os triângulos da blusa, que são mais
    // grossos que a curva dele) tem a roupa logo atrás. Na bota (`pes`) até `cobre`: o aperto dela deixava o calcanhar
    // do corpo inteiro para fora
    // No tórax, um busto mais saliente pode pôr a pele à frente do peitoral. A normal curva da pele passa ao lado
    // da placa; também verificamos para dentro, no eixo frente/costas, e só apagamos onde há roupa nessa faixa.
    const sobRoupaNoTorax = peito && Math.abs(p[2]) > mb.ombro * 0.18 && acerta(p, paraDentro, ate);
    coberto[b] =
      acerta(p, n, ate) || acerta(p, [-n[0], -n[1], -n[2]], naPe(p[1]) ? ate : ate * 0.5) || sobRoupaNoTorax ? 1 : 0;
  }
  const ficaB: number[] = [];
  for (let t = 0; t < A.I.length / 3; t++)
    if (!(coberto[A.I[t * 3]] && coberto[A.I[t * 3 + 1]] && coberto[A.I[t * 3 + 2]])) ficaB.push(t);

  /* a imagem deste corpo: a da roupa em cima; embaixo a do corpo, se ele tem textura (sem ela o rosto pintado da F06
     virava a cor média de cada triângulo); e uma faixa branca no fim, para a cor lisa */
  const baseCorpo = join(dirname(corpo.anim), `${corpo.nome}_tpose`, `${corpo.nome}_tpose`);
  let img: {
    dataUrl: string;
    uvCorpo: Float32Array | null;
    roupa: number[];
    corpo: number[];
    branco: number[];
  } | null = null;
  if (textura) {
    let pc: Buffer | null = null,
      Wc = 0,
      Hc = 0,
      uvCorpo: Float32Array | null = null;
    if (existsSync(baseCorpo + "_uv.bin") && existsSync(baseCorpo + "_tex.webp")) {
      const b = readFileSync(baseCorpo + "_uv.bin");
      uvCorpo = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
      if (uvCorpo.length !== A.I.length * 2)
        throw new Error(`${baseCorpo}_uv.bin: ${uvCorpo.length / 6} triângulos para ${A.I.length / 3}`);
      const r = await sharp(baseCorpo + "_tex.webp")
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      pc = r.data;
      Wc = r.info.width;
      Hc = r.info.height;
    }
    const { px, W: Wr, H: Hr } = textura,
      FAIXA = 16,
      W2 = Math.max(Wr, Wc),
      H2 = Hr + Hc + FAIXA,
      atlas = Buffer.alloc(W2 * H2 * 3, 255);
    for (let y = 0; y < Hr; y++) px.copy(atlas, y * W2 * 3, y * Wr * 3, (y + 1) * Wr * 3);
    if (pc) for (let y = 0; y < Hc; y++) pc.copy(atlas, (Hr + y) * W2 * 3, y * Wc * 3, (y + 1) * Wc * 3);
    const webp = await sharp(atlas, { raw: { width: W2, height: H2, channels: 3 } })
      .webp({ quality: 88 })
      .toBuffer();
    img = {
      dataUrl: "data:image/webp;base64," + webp.toString("base64"),
      uvCorpo,
      // [escala u, escala v, início v] de cada pedaço na imagem
      roupa: [Wr / W2, Hr / H2, 0],
      corpo: [Wc / W2, Hc / H2, Hr / H2],
      branco: [0.5, (Hr + Hc + FAIXA / 2) / H2],
    };
    console.log(
      `${corpo.nome}: imagem ${W2}×${H2}${pc ? " (com a textura do corpo)" : ""}, ${(webp.length / 1024).toFixed(0)} KB`,
    );
  }
  const q16 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 65535),
    naImg = (uv: ArrayLike<number>, o: number, k: number, p: number[]) => {
      const v = Math.min(1, Math.max(0, uv[o + k]));
      return q16(k % 2 ? p[2] + v * p[1] : v * p[0]);
    };

  /* junta: corpo (sem o coberto) + roupa, no formato do _anim.json */
  const nv = nvB + nvR;
  if (nv > 65535) throw new Error(`${corpo.nome}: ${nv} vértices (máximo 65535)`);
  const P16 = new Int16Array(nv * 3),
    J8 = new Uint8Array(nv * 4),
    W8 = new Uint8Array(nv * 4);
  for (let i = 0; i < nvB * 3; i++) P16[i] = Math.round(A.P[i] * 64);
  for (let i = 0; i < nvB * 4; i++) {
    J8[i] = A.J[i];
    W8[i] = Math.round(A.W[i] * 255);
  }
  for (let v = 0; v < nvR; v++) {
    for (let k = 0; k < 3; k++) P16[(nvB + v) * 3 + k] = Math.round(V[v * 3 + k] * 64);
    for (let k = 0; k < 4; k++) {
      J8[(nvB + v) * 4 + k] = J[v * 4 + k];
      W8[(nvB + v) * 4 + k] = W[v * 4 + k];
    }
  }
  const nt = ficaB.length + ntR,
    I16 = new Uint16Array(nt * 3),
    C8 = new Uint8Array(nt * 3),
    UV16 = img ? new Uint16Array(nt * 6) : null;
  const uvBranco = (n: number) => {
    if (UV16) for (let k = 0; k < 6; k++) UV16[n * 6 + k] = q16(img!.branco[k % 2]);
  };
  ficaB.forEach((t, n) => {
    for (let k = 0; k < 3; k++) I16[n * 3 + k] = A.I[t * 3 + k];
    if (img?.uvCorpo) {
      for (let k = 0; k < 6; k++) UV16![n * 6 + k] = naImg(img.uvCorpo, t * 6, k, img.corpo);
      C8.fill(255, n * 3, n * 3 + 3);
    } else {
      for (let k = 0; k < 3; k++) C8[n * 3 + k] = Math.round(A.C[t * 3 + k] * 255);
      uvBranco(n);
    }
  });
  let naImagem = 0;
  for (let t = 0; t < ntR; t++) {
    const n = ficaB.length + t;
    for (let k = 0; k < 3; k++) I16[n * 3 + k] = nvB + RI[t * 3 + k];
    if (comImagem(t)) {
      const q = textura!.uv[RT[t]]!;
      for (let k = 0; k < 6; k++) UV16![n * 6 + k] = naImg(q, 0, k, img!.roupa);
      C8.fill(255, n * 3, n * 3 + 3);
      naImagem++;
    } else {
      for (let k = 0; k < 3; k++) C8[n * 3 + k] = Math.round(corLisa[t * 3 + k]);
      uvBranco(n);
    }
  }
  const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
  const saida: DadosAnim = { ...dados, malha: { p: b64(P16), j: b64(J8), w: b64(W8), i: b64(I16), c: b64(C8) } };
  delete saida.tex;
  if (img && UV16) {
    saida.malha.uv = b64(UV16);
    saida.tex = img.dataUrl;
  }
  const arq = join(plano.pasta, `${corpo.nome}__${plano.nome}_anim.json`);
  writeFileSync(arq, JSON.stringify(saida));
  // Peças independentes: o tronco termina na cintura; a calça leva quadril e pernas até o tornozelo;
  // os triângulos dos pés ficam separados para respeitar o encaixe de botas. Nenhuma parte troca o corpo-base.
  const cinturaOriginal = mb.chao + mb.h * 0.56,
    cintura = mb.chao + mb.h * (plano.cintura?.altura ?? 0.56),
    pecasCos = plano.cintura?.pecas && new Set(plano.cintura.pecas),
    limitePes = mb.chao + mb.h * (plano.pes?.ate ?? 0.06),
    porPeca: Record<"peito" | "pernas" | "pes", number[]> = { peito: [], pernas: [], pes: [] };
  for (let t = 0; t < ntR; t++) {
    const y = (V[RI[t * 3] * 3 + 1] + V[RI[t * 3 + 1] * 3 + 1] + V[RI[t * 3 + 2] * 3 + 1]) / 3;
    // O cós sobe só na peça da calça: cinto, adaga e barra da blusa mantêm a divisão anterior.
    const naCalca = y < cintura && (y < cinturaOriginal || !pecasCos || pecasCos.has(RPecaT[t]));
    const parte = y < limitePes ? "pes" : naCalca ? "pernas" : "peito";
    porPeca[parte].push(t);
  }
  for (const parte of ["peito", "pernas", "pes"] as const) {
    const tris = porPeca[parte];
    if (!tris.length) continue;
    const PI = new Uint16Array(tris.length * 3),
      PC = new Uint8Array(tris.length * 3),
      PUV = img ? new Uint16Array(tris.length * 6) : null;
    tris.forEach((t, i) => {
      const fonte = ficaB.length + t;
      PI.set(I16.subarray(fonte * 3, fonte * 3 + 3), i * 3);
      PC.set(C8.subarray(fonte * 3, fonte * 3 + 3), i * 3);
      if (PUV && UV16) PUV.set(UV16.subarray(fonte * 6, fonte * 6 + 6), i * 6);
    });
    const remap = new Map<number, number>(),
      vertices: number[] = [];
    for (let i = 0; i < PI.length; i++) {
      const origem = PI[i];
      let destino = remap.get(origem);
      if (destino == null) {
        destino = vertices.length;
        vertices.push(origem);
        remap.set(origem, destino);
      }
      PI[i] = destino;
    }
    const PP = new Int16Array(vertices.length * 3),
      PJ = new Uint8Array(vertices.length * 4),
      PW = new Uint8Array(vertices.length * 4);
    vertices.forEach((origem, i) => {
      PP.set(P16.subarray(origem * 3, origem * 3 + 3), i * 3);
      PJ.set(J8.subarray(origem * 4, origem * 4 + 4), i * 4);
      PW.set(W8.subarray(origem * 4, origem * 4 + 4), i * 4);
    });
    const malha: DadosAnim["malha"] = { p: b64(PP), j: b64(PJ), w: b64(PW), i: b64(PI), c: b64(PC) };
    if (PUV) malha.uv = b64(PUV);
    const camada: DadosAnim = { ...dados, malha, ...(img ? { tex: img.dataUrl } : {}) };
    const destino = join(plano.pasta, `${corpo.nome}__${plano.nome}_${parte}_anim.json`);
    const limites = plano.orcamento
      ? orcamentoRoupa(corpo.nome, {
          peito: plano.orcamento.peito ?? 1700,
          pernas: plano.orcamento.pernas ?? 1800,
          pes: plano.orcamento.pes ?? 400,
        })
      : null;
    const alvo = limites?.[parte];
    let reduzida = alvo ? await reduzirAnimado(camada, alvo) : camada;
    if (parte === "pernas" && corpo.cos) {
      const pecas = new Set(corpo.cos.pecas);
      const verticesCalca = new Set<string>();
      for (let t = 0; t < ntR; t++)
        if (pecas.has(RPecaT[t]))
          for (let k = 0; k < 3; k++) {
            const v = RI[t * 3 + k];
            verticesCalca.add([0, 1, 2].map((e) => Math.round(V[v * 3 + e] * 64)).join(","));
          }
      reduzida = ajustarCos(reduzida, A, corpo.cos, verticesCalca, mb.chao, mb.h);
    }
    reduzida.coberturaCorpo = coberturaPorPeca(A, decodificarAnim(reduzida), ate, parte === "pes");
    writeFileSync(destino, JSON.stringify(reduzida));
    console.log(
      `${destino}: ${Buffer.from(reduzida.malha.i, "base64").length / 6} triângulos independentes (${parte})`,
    );
  }
  console.log(
    `${arq}: ${nt} triângulos (${ficaB.length} do corpo, ${A.I.length / 3 - ficaB.length} da pele cobertos; ${ntR} da roupa, ${naImagem} com a imagem), ${nv} vértices; ${empurrados} empurrados para fora da pele, ${soltos} soltos pelo preso mais perto`,
  );
}
