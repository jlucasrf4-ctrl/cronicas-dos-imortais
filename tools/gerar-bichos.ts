/* v7.7 — animais do campo (lobo, javali, cervo macho/fêmea, coelho; v8.0: raposa) a partir do pacote craftpix (FBX com malha,
   esqueleto e pele, sem animações) para o formato animado do jogo (src/assets/models/<bicho>_anim.json, lido por
   src/render/gl/esqueleto.ts como o da heroína).

   Uso:  node tools/gerar-bichos.ts [plano.json] [--simular]      (padrão tools/modelos/bichos.json)
   O plano diz, por bicho: o FBX ("pacote.zip/fbx/unity/wolf.fbx"), o comprimento no jogo (focinho ao rabo), os ossos
   da cabeça e do rabo (a frente do bicho) e os conjuntos de clips. Os clips são feitos aqui: cada movimento gira os
   ossos cujo nome casa com `re` em torno de um eixo do bicho ("lado" = balançar a perna para a frente/levantar a
   cabeça, "cima" = virar, "frente" = inclinar de lado), em graus: media + amp × forma(2π(freq·t/dur + fase)), forma
   "seno" ou "meia" (só a metade positiva). `raizY` sobe e desce o corpo (fração do comprimento).
   Prévias (tiras de quadros de perfil e de frente, desenhadas com o código do jogo) em build/modelos/bichos/, e
   todos.png: os bichos lado a lado na escala do jogo, com a altura da heroína (barra cinza) para comparar. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { lerMalhaFbx } from "./lib/fbx.ts";
import { lerArquivoDe, qmul, qinv, qrot, quatMat } from "./lib/retarget.ts";
import { m4mul, m4trs, type M4 } from "./lib/esqueleto.ts";
import { desenhar } from "./lib/glb.ts";
import { decodificarAnim, poseClip, matrizesPose, deformarMalha } from "../src/render/gl/esqueleto.ts";

type Forma = "seno" | "meia";
interface Mov {
  re: string;
  eixo: "lado" | "cima" | "frente";
  amp?: number;
  media?: number;
  fase?: number;
  freq?: number;
  forma?: Forma;
}
interface ClipPlano {
  dur: number; // 0 = pose fixa (1 quadro)
  ossos: Mov[];
  raizY?: { amp: number; freq?: number; fase?: number; forma?: Forma };
}
interface PlanoBichos {
  previas: string;
  fps: number;
  textura: string;
  alturaHeroina: number;
  conjuntos: Record<string, Record<string, ClipPlano>>;
  bichos: Record<
    string,
    { fbx: string; saida: string; comprimento: number; cabeca: string; rabo: string; clips: string[] }
  >;
}

const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: number[]) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** m·(x, y, z, 1) (4×4 em coluna). */
const ap = (m: ArrayLike<number>, v: number[]) =>
  [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
function inversaRigida(m: M4): M4 {
  const s2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
  const o = new Float64Array(16);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c] / s2;
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  o[15] = 1;
  return o;
}
const eixoAngulo = (e: number[], graus: number) => {
  const h = (graus * Math.PI) / 360,
    s = Math.sin(h);
  return [e[0] * s, e[1] * s, e[2] * s, Math.cos(h)];
};
const onda = (forma: Forma | undefined, x: number) => (forma === "meia" ? Math.max(0, Math.sin(x)) : Math.sin(x));

async function converter(plano: PlanoBichos, nome: string, tex: { d: Buffer; w: number; h: number }) {
  const B = plano.bichos[nome];
  const F = lerMalhaFbx(lerArquivoDe(B.fbx));
  // juntas em ordem de pai antes de filho
  const ordem: number[] = [],
    feito = new Set<number>();
  const visita = (i: number) => {
    if (feito.has(i)) return;
    if (F.ossos[i].pai >= 0) visita(F.ossos[i].pai);
    feito.add(i);
    ordem.push(i);
  };
  F.ossos.forEach((_, i) => visita(i));
  const novo = new Map(ordem.map((o, j) => [o, j]));
  const ossos = ordem.map((o) => F.ossos[o]),
    pais = ossos.map((o) => (o.pai >= 0 ? novo.get(o.pai)! : -1)),
    nj = ossos.length;
  if (ossos.some((o) => o.link.length !== 16)) throw new Error(nome + ": osso sem cluster");
  // malha no mundo do FBX: a global da malha na BindPose (neste pacote o "Transform" dos clusters traz a matriz do osso
  // da raiz, não a da malha); por garantia, usa a candidata que deixa cada osso mais perto do vértice que ele mais move
  const Tm = Float64Array.from(ossos[0].malha),
    candidatos = [...(F.bindMalha ? [Float64Array.from(F.bindMalha)] : []), Tm, inversaRigida(Tm)].map((M) => {
      const W: number[][] = [];
      for (let i = 0; i < F.P.length; i += 3) W.push(ap(M, [F.P[i], F.P[i + 1], F.P[i + 2]]));
      let erro = 0;
      for (const o of ossos) {
        if (!o.idx.length) continue;
        const v = o.idx[o.peso.indexOf(Math.max(...o.peso))];
        erro += Math.hypot(...sub(W[v], [o.link[12], o.link[13], o.link[14]]));
      }
      return { W, erro };
    });
  const W = candidatos.reduce((a, b) => (b.erro < a.erro ? b : a)).W;
  // eixos do bicho: frente = cabeça − rabo (no chão), cima = +y, lado = frente × cima
  const pos = (n: string) => {
    const o = ossos.find((x) => x.nome === n);
    if (!o) throw new Error(`${nome}: osso ${n} não existe`);
    return [o.link[12], o.link[13], o.link[14]];
  };
  // (o "para cima" do FBX não é confiável: mede pelo bicho — da média dos pés até a raiz da coluna)
  const pes = ossos.filter((o) => /Foot|Fooot|Hoof/i.test(o.nome)).map((o) => [o.link[12], o.link[13], o.link[14]]),
    mp = [0, 1, 2].map((k) => pes.reduce((a, p) => a + p[k], 0) / pes.length),
    cima = norm(sub([ossos[0].link[12], ossos[0].link[13], ossos[0].link[14]], mp)),
    fr0 = sub(pos(B.cabeca), pos(B.rabo)),
    frente = norm(
      sub(
        fr0,
        cima.map((v) => v * dot(fr0, cima)),
      ),
    ),
    lado = cross(frente, cima);
  let fMin = Infinity,
    fMax = -Infinity,
    lMin = Infinity,
    lMax = -Infinity,
    yMin = Infinity;
  for (const v of W) {
    fMin = Math.min(fMin, dot(v, frente));
    fMax = Math.max(fMax, dot(v, frente));
    lMin = Math.min(lMin, dot(v, lado));
    lMax = Math.max(lMax, dot(v, lado));
    yMin = Math.min(yMin, dot(v, cima));
  }
  const L = fMax - fMin,
    S = B.comprimento; // espaço normalizado: mundo do FBX ÷ L; o jogo: × S
  const C = new Float64Array([
    S * frente[0],
    S * cima[0],
    S * lado[0],
    0,
    S * frente[1],
    S * cima[1],
    S * lado[1],
    0,
    S * frente[2],
    S * cima[2],
    S * lado[2],
    0,
    (-S * (fMin + fMax)) / 2 / L,
    (-S * yMin) / L,
    (-S * (lMin + lMax)) / 2 / L,
    1,
  ]);
  const Cinv = inversaRigida(C);
  // globais de bind normalizadas (rotação pura + posição ÷ L) → locais
  const Qg = ossos.map((o) => quatMat(o.link)),
    Tg = ossos.map((o) => [o.link[12] / L, o.link[13] / L, o.link[14] / L]);
  const Ql = ossos.map((_, j) => (pais[j] < 0 ? Qg[j] : qmul(qinv(Qg[pais[j]]), Qg[j])));
  const repouso = ossos.map((_, j) => (pais[j] < 0 ? Tg[j] : qrot(qinv(Qg[pais[j]]), sub(Tg[j], Tg[pais[j]]))));
  const ibm = ossos.map((_, j) => m4mul(inversaRigida(m4trs(Tg[j], Qg[j], [1, 1, 1])), Cinv));
  // malha: posições no jogo, 4 maiores pesos, triângulos (leque), uma cor por triângulo (centro do UV na textura)
  const nv = W.length,
    P16 = new Int16Array(nv * 3),
    J8 = new Uint8Array(nv * 4),
    W8 = new Uint8Array(nv * 4);
  W.forEach((v, i) => {
    const g = ap(C, [v[0] / L, v[1] / L, v[2] / L]);
    for (let k = 0; k < 3; k++) P16[i * 3 + k] = Math.round(g[k] * 64);
  });
  {
    const mn = [0, 1, 2].map((k) => Math.min(...Array.from(P16).filter((_, i) => i % 3 === k)) / 64),
      mx = [0, 1, 2].map((k) => Math.max(...Array.from(P16).filter((_, i) => i % 3 === k)) / 64);
    console.log(`  caixa no jogo [${mn.map((v) => v.toFixed(1))}] → [${mx.map((v) => v.toFixed(1))}]`);
  }
  const pesos: [number, number][][] = W.map(() => []);
  ossos.forEach((o, j) => o.idx.forEach((v, k) => pesos[v].push([j, o.peso[k]])));
  pesos.forEach((ps, v) => {
    const top = ps.sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (!top.length) top.push([0, 1]);
    // arredonda e põe a sobra (±) no maior: a soma dá 255 sem nenhum passar de 0..255
    const tot = top.reduce((a, b) => a + b[1], 0) || 1,
      q = top.map(([, w]) => Math.round((w / tot) * 255));
    q[0] += 255 - q.reduce((a, b) => a + b, 0);
    top.forEach(([j], k) => {
      J8[v * 4 + k] = j;
      W8[v * 4 + k] = q[k];
    });
  });
  const I: number[] = [],
    Cor: number[] = [];
  F.poli.forEach((pl, p) => {
    let u = 0,
      vv = 0;
    for (const c of F.uv[p]) {
      u += c[0] / pl.length;
      vv += c[1] / pl.length;
    }
    const x = Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w))),
      y = Math.min(tex.h - 1, Math.max(0, Math.floor((1 - vv) * tex.h))),
      o = (y * tex.w + x) * 3;
    for (let k = 1; k + 1 < pl.length; k++) {
      I.push(pl[0], pl[k], pl[k + 1]);
      Cor.push(tex.d[o], tex.d[o + 1], tex.d[o + 2]);
    }
  });
  // clips
  const clipsPlano: Record<string, ClipPlano> = {};
  for (const c of B.clips) Object.assign(clipsPlano, plano.conjuntos[c]);
  const eixos = { lado, cima, frente };
  const clips: Record<string, { fps: number; n: number; r: string; q: string }> = {};
  for (const [cn, cp] of Object.entries(clipsPlano)) {
    const n = cp.dur > 0 ? Math.round(cp.dur * plano.fps) + 1 : 1,
      R = new Int16Array(n * nj * 4),
      Q = new Int16Array(n * 3);
    const movs = cp.ossos.map((m) => ({ m, re: new RegExp(m.re) }));
    for (const { m, re } of movs)
      if (!ossos.some((o) => re.test(o.nome))) console.warn(`  ${nome}/${cn}: nenhum osso casa com ${m.re}`);
    for (let f = 0; f < n; f++) {
      const ph = cp.dur > 0 ? f / (n - 1) : 0;
      const val = (m: { amp?: number; media?: number; fase?: number; freq?: number; forma?: Forma }) =>
        (m.media ?? 0) + (m.amp ?? 0) * onda(m.forma, 2 * Math.PI * ((m.freq ?? 1) * ph + (m.fase ?? 0)));
      ossos.forEach((o, j) => {
        let q = Ql[j];
        for (const { m, re } of movs)
          if (re.test(o.nome)) q = qmul(q, eixoAngulo(norm(qrot(qinv(Qg[j]), eixos[m.eixo])), val(m)));
        for (let k = 0; k < 4; k++) R[(f * nj + j) * 4 + k] = Math.round(q[k] * 32767);
      });
      const dy = cp.raizY ? val(cp.raizY) : 0;
      const t0 = repouso[0];
      for (let k = 0; k < 3; k++) Q[f * 3 + k] = Math.round((t0[k] + cima[k] * dy) * 10000);
    }
    clips[cn] = { fps: plano.fps, n, r: b64(R), q: b64(Q) };
  }
  const saida = {
    versao: 1,
    juntas: ossos.map((o) => o.nome),
    pais,
    repouso: repouso.map((t) => t.map((v) => +v.toFixed(6))),
    raiz: Array.from(C, (v) => +v.toFixed(6)),
    ibm: ibm.map((m) => Array.from(m, (v) => +v.toFixed(6))),
    malha: {
      p: b64(P16),
      j: b64(J8),
      w: b64(W8),
      i: b64(Uint16Array.from(I)),
      c: b64(Uint8Array.from(Cor)),
    },
    clips,
  };
  const json = JSON.stringify(saida);
  console.log(
    `${nome}: ${nv} vértices, ${I.length / 3} triângulos, ${nj} juntas, clips ${Object.keys(clips).join(", ")} — ${(json.length / 1024).toFixed(0)} KB`,
  );
  return json;
}

/** Desenha a malha deformada de um clip no instante t: perfil ("frente" da prévia = de +z do jogo) ou de frente. */
async function quadro(
  json: string,
  clip: string,
  t: number,
  vista: "frente" | "lado",
  lado: number,
  caixa: { mn: number[]; mx: number[] },
  arq: string,
) {
  const A = decodificarAnim(JSON.parse(json));
  const { p, c } = deformarMalha(A, matrizesPose(A, poseClip(A, clip, t, false)));
  const I = Array.from({ length: p.length / 3 }, (_, i) => i);
  await desenhar(arq, p, I, (k) => [c[k * 9] * 255, c[k * 9 + 1] * 255, c[k * 9 + 2] * 255], {
    vista,
    W: lado,
    caixaFixa: caixa,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const plano = JSON.parse(
    readFileSync(args.find((a) => !a.startsWith("--")) ?? "tools/modelos/bichos.json", "utf8"),
  ) as PlanoBichos;
  const png = sharp(lerArquivoDe(plano.textura)).removeAlpha();
  const { data, info } = await png.raw().toBuffer({ resolveWithObject: true });
  const tex = { d: data, w: info.width, h: info.height };
  mkdirSync(plano.previas, { recursive: true });
  const L = 180,
    todos: { input: Buffer; left: number; top: number }[] = [];
  const nomes = Object.keys(plano.bichos);
  const caixaTodos = { mn: [-30, -2, -40], mx: [30, 50, 40] };
  for (const [i, nome] of nomes.entries()) {
    const json = await converter(plano, nome, tex);
    if (!args.includes("--simular")) writeFileSync(plano.bichos[nome].saida, json);
    const A = decodificarAnim(JSON.parse(json));
    const comp = plano.bichos[nome].comprimento,
      caixa = { mn: [-comp * 0.65, -2, -comp], mx: [comp * 0.65, comp * 1.1, comp] };
    for (const cn of Object.keys(A.clips)) {
      const c = A.clips[cn],
        nq = c.n > 1 ? 8 : 1,
        tiles: { input: Buffer; left: number; top: number }[] = [];
      for (let k = 0; k < nq; k++)
        for (const [v, vista] of (["frente", "lado"] as const).entries()) {
          const arq = join(plano.previas, "_q.png");
          await quadro(json, cn, ((c.n - 1) / c.fps) * (k / nq), vista, L, caixa, arq);
          tiles.push({
            input: await sharp(arq).resize(L, L, { fit: "contain", background: "#262626" }).toBuffer(),
            left: k * L,
            top: v * L,
          });
        }
      await sharp({ create: { width: L * nq, height: L * 2, channels: 3, background: "#262626" } })
        .composite(tiles)
        .png()
        .toFile(join(plano.previas, `${nome}_${cn}.png`));
    }
    // todos na mesma escala, com a barra da heroína
    const arq = join(plano.previas, "_q.png");
    await quadro(json, "parada", 0, "frente", 260, caixaTodos, arq);
    const s = 200 / (caixaTodos.mx[0] - caixaTodos.mn[0]),
      hb = plano.alturaHeroina * s,
      base = 30 + (caixaTodos.mx[1] - 0) * s;
    const barra = Buffer.from(
      `<svg width="260" height="300"><rect x="4" y="${base - hb}" width="6" height="${hb}" fill="#888"/><text x="14" y="18" font-size="15" fill="#ff0" font-family="sans-serif">${nome}</text></svg>`,
    );
    todos.push({
      input: await sharp(arq)
        .resize(260, 300, { fit: "contain", position: "top", background: "#262626" })
        .composite([{ input: barra, left: 0, top: 0 }])
        .toBuffer(),
      left: i * 260,
      top: 0,
    });
  }
  await sharp({ create: { width: 260 * nomes.length, height: 300, channels: 3, background: "#262626" } })
    .composite(todos)
    .png()
    .toFile(join(plano.previas, "todos.png"));
  console.log(`prévias em ${plano.previas}`);
}

await main();
