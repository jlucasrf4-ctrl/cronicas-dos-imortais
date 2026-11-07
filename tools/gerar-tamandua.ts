/* v7.7 — o tamanduá-bandeira (montaria) a partir da folha do Tripo (uma malha só, sem esqueleto) para o formato animado
   do jogo (src/assets/models/tamandua_anim.json, lido por src/render/gl/esqueleto.ts como o dos outros bichos).

   Uso:  node tools/gerar-tamandua.ts [plano.json] [--simular]      (padrão tools/modelos/tamandua.json)
   Passos: recorta a pose escolhida da folha (centro "c"), tira a língua pela cor ("lingua": vermelho alto, verde e azul
   bem abaixo), reduz para "tris" triângulos com uma cor cada (tools/lib/peca.ts) e solda de novo os vértices. Na folha,
   a frente do bicho é +x, o alto é +y e o lado é z: o comprimento (rabo ao focinho) vira "comprimento" no jogo, pés em
   y=0. O esqueleto é feito aqui, sem rotação no repouso: raiz (no corpo), cabeça (do pescoço para a frente), cauda e as
   quatro pernas (pivô no alto da perna). Os pés são os vértices mais baixos ("esqueleto.pes", fração da altura),
   separados em frente/trás e esquerda/direita; o alto da perna é "pernaTopo" da altura das costas. Pesos: perna para
   quem está abaixo do pivô e perto do pé (raio "pernaRaio"), cabeça à frente do pescoço, cauda atrás do início do rabo,
   com uma passagem suave ("suave"); o resto é da raiz. Os clips são como os de tools/gerar-bichos.ts (eixos "lado",
   "cima", "frente" do bicho; graus: media + amp × seno). Marcas no JSON: "sela" (o alto das costas sobre a raiz) e
   "boca" (a ponta do focinho), em unidades do jogo.
   Prévias em build/modelos/tamandua/: tiras de quadros de cada clip (perfil e de frente) e todos.png com a altura da
   heroína para comparar. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { recortar, subMalha, amostra, desenhar } from "./lib/glb.ts";
import { reduzirPeca } from "./lib/peca.ts";
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
interface Plano {
  folha: string;
  c: [number, number];
  tris: number;
  texW: number;
  cache: string;
  saida: string;
  previas: string;
  comprimento: number;
  alturaHeroina: number;
  fps: number;
  lingua: { rMin: number; rg: number; rb: number; frente: number; alto: number; chaoX: number; chaoY: number };
  temCarga?: boolean; // o modelo já vem com as mochilas: o jogo não põe a sela por cima (marca "carga")
  esqueleto: { pes: number; pernaTopo: number; pernaRaio: number; pescoco: number; rabo: number; suave: number };
  clips: Record<string, { dur: number; ossos: Mov[]; raizY?: { amp: number; freq?: number; fase?: number } }>;
}

const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const onda = (forma: Forma | undefined, x: number) => (forma === "meia" ? Math.max(0, Math.sin(x)) : Math.sin(x));
const liso = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const eixoAngulo = (e: number[], graus: number) => {
  const h = (graus * Math.PI) / 360,
    s = Math.sin(h);
  return [e[0] * s, e[1] * s, e[2] * s, Math.cos(h)];
};

async function converter(P0: Plano) {
  const E = P0.esqueleto,
    d = 0.01;
  // 1) a pose da folha, sem a língua
  const m = await recortar(
    P0.folha,
    { xMin: P0.c[0] - d, xMax: P0.c[0] + d, yMin: P0.c[1] - d, yMax: P0.c[1] + d },
    P0.texW,
    P0.cache,
  );
  // a língua (e o disco no chão embaixo dela): avermelhado na frente e na metade de baixo, ou bem na frente e rente ao
  // chão. As frações são do comprimento (x) e da altura (y) da pose.
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let i = 0; i < m.P.length; i += 3) {
    x0 = Math.min(x0, m.P[i]);
    x1 = Math.max(x1, m.P[i]);
    y0 = Math.min(y0, m.P[i + 1]);
    y1 = Math.max(y1, m.P[i + 1]);
  }
  const fica: number[] = [];
  let tirados = 0;
  const Lg = P0.lingua;
  for (let t = 0; t < m.I.length / 3; t++) {
    const cor = [0, 0, 0];
    let fx = 0,
      fy = 0;
    for (let k = 0; k < 3; k++) {
      const v = m.I[t * 3 + k],
        c = amostra(m, m.T[v * 2], m.T[v * 2 + 1]);
      for (let e = 0; e < 3; e++) cor[e] += c[e] / 3;
      fx += (m.P[v * 3] - x0) / (x1 - x0) / 3;
      fy += (m.P[v * 3 + 1] - y0) / (y1 - y0) / 3;
    }
    const vermelho = cor[0] >= Lg.rMin && cor[0] >= cor[1] * Lg.rg && cor[0] >= cor[2] * Lg.rb;
    if ((vermelho && fx > Lg.frente && fy < Lg.alto) || (fx > Lg.chaoX && fy < Lg.chaoY)) tirados++;
    else fica.push(t);
  }
  console.log(`  língua: ${tirados} de ${m.I.length / 3} triângulos tirados`);
  const sem = subMalha(m, fica);
  // 2) low poly com uma cor por triângulo; solda de novo
  const baixa = await reduzirPeca(sem, P0.tris);
  const mapa = new Map<string, number>(),
    V: number[][] = [],
    I: number[] = [];
  for (let i = 0; i < baixa.p.length; i += 3) {
    const k = baixa.p
      .slice(i, i + 3)
      .map((x) => x.toFixed(6))
      .join(",");
    let j = mapa.get(k);
    if (j === undefined) {
      j = V.length;
      mapa.set(k, j);
      V.push(baixa.p.slice(i, i + 3));
    }
    I.push(j);
  }
  // 3) normaliza: comprimento 1, pés em y=0, centrado em x e z
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    zMin = Infinity,
    zMax = -Infinity;
  for (const v of V) {
    xMin = Math.min(xMin, v[0]);
    xMax = Math.max(xMax, v[0]);
    yMin = Math.min(yMin, v[1]);
    zMin = Math.min(zMin, v[2]);
    zMax = Math.max(zMax, v[2]);
  }
  const Lc = xMax - xMin,
    N = V.map((v) => [(v[0] - (xMin + xMax) / 2) / Lc, (v[1] - yMin) / Lc, (v[2] - (zMin + zMax) / 2) / Lc]);
  const H = Math.max(...N.map((v) => v[1]));
  // 4) marcas do esqueleto: os pés (os mais baixos) em quatro grupos
  const pes = N.filter((v) => v[1] < E.pes * H);
  const xm = pes.reduce((a, v) => a + v[0], 0) / pes.length;
  const grupo = (frente: boolean, esq: boolean) => {
    const par = pes.filter((v) => v[0] > xm === frente),
      zm = par.reduce((a, v) => a + v[2], 0) / (par.length || 1);
    const g = par.filter((v) => v[2] > zm === esq);
    if (!g.length) throw new Error("perna sem pé: frente=" + frente + " esq=" + esq);
    return [0, 1, 2].map((k) => g.reduce((a, v) => a + v[k], 0) / g.length);
  };
  const pe = { fe: grupo(true, true), fd: grupo(true, false), te: grupo(false, true), td: grupo(false, false) };
  const costas = (x: number) => Math.max(...N.filter((v) => Math.abs(v[0] - x) < 0.04).map((v) => v[1]));
  const xF = (pe.fe[0] + pe.fd[0]) / 2,
    xT = (pe.te[0] + pe.td[0]) / 2,
    xR = (xF + xT) / 2,
    alto = (x: number) => costas(x) * E.pernaTopo;
  const juntas = ["raiz", "cabeca", "cauda", "perna_fe", "perna_fd", "perna_te", "perna_td"];
  const pos: number[][] = [
    [xR, alto(xR), 0],
    [xF + E.pescoco, alto(xF), 0],
    [xT - E.rabo, alto(xT), 0],
    [pe.fe[0], alto(xF), pe.fe[2]],
    [pe.fd[0], alto(xF), pe.fd[2]],
    [pe.te[0], alto(xT), pe.te[2]],
    [pe.td[0], alto(xT), pe.td[2]],
  ];
  const pais = [-1, 0, 0, 0, 0, 0, 0];
  // 5) pesos
  const nv = N.length,
    J8 = new Uint8Array(nv * 4),
    W8 = new Uint8Array(nv * 4);
  N.forEach((v, i) => {
    const w = new Array(juntas.length).fill(0);
    // perna mais perto (no chão: x e z), se estiver abaixo do pivô
    let pk = -1,
      pd = Infinity;
    for (let k = 3; k < 7; k++) {
      const q = Math.hypot(v[0] - pos[k][0], v[2] - pos[k][2]);
      if (q < pd) {
        pd = q;
        pk = k;
      }
    }
    // (a cabeça desce rente ao chão perto das patas da frente: à frente do pescoço nada é perna)
    const wPerna =
      pd < E.pernaRaio && v[0] < pos[1][0] - E.suave * 0.4
        ? liso(pos[pk][1] + E.suave * 0.3, pos[pk][1] - E.suave, v[1])
        : 0;
    const wCab = liso(pos[1][0] - E.suave * 0.4, pos[1][0] + E.suave, v[0]),
      wCau = liso(pos[2][0] + E.suave * 0.4, pos[2][0] - E.suave, v[0]);
    const resto = 1 - wPerna;
    if (wPerna > 0) w[pk] = wPerna;
    w[1] = resto * wCab;
    w[2] = resto * wCau;
    w[0] = Math.max(0, resto - w[1] - w[2]);
    const top = w
      .map((p, j) => [j, p] as [number, number])
      .filter(([, p]) => p > 0.002)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const tot = top.reduce((a, b) => a + b[1], 0) || 1,
      q = top.map(([, p]) => Math.round((p / tot) * 255));
    q[0] += 255 - q.reduce((a, b) => a + b, 0);
    top.forEach(([j], k) => {
      J8[i * 4 + k] = j;
      W8[i * 4 + k] = q[k];
    });
  });
  // 6) malha no jogo, matrizes
  const S = P0.comprimento,
    P16 = new Int16Array(nv * 3);
  N.forEach((v, i) => v.forEach((x, k) => (P16[i * 3 + k] = Math.round(x * S * 64))));
  const raiz = [S, 0, 0, 0, 0, S, 0, 0, 0, 0, S, 0, 0, 0, 0, 1];
  const ibm = pos.map((p) => [1 / S, 0, 0, 0, 0, 1 / S, 0, 0, 0, 0, 1 / S, 0, -p[0], -p[1], -p[2], 1]);
  const repouso = pos.map((p, j) => (j === 0 ? p : [p[0] - pos[0][0], p[1] - pos[0][1], p[2] - pos[0][2]]));
  // 7) clips
  const eixos = { lado: [0, 0, 1], cima: [0, 1, 0], frente: [1, 0, 0] };
  const nj = juntas.length,
    clips: Record<string, { fps: number; n: number; r: string; q: string }> = {};
  for (const [cn, cp] of Object.entries(P0.clips)) {
    const n = cp.dur > 0 ? Math.round(cp.dur * P0.fps) + 1 : 1,
      R = new Int16Array(n * nj * 4),
      Q = new Int16Array(n * 3);
    const movs = cp.ossos.map((mv) => ({ mv, re: new RegExp(mv.re) }));
    for (const { mv, re } of movs)
      if (!juntas.some((o) => re.test(o))) console.warn(`  ${cn}: nenhuma junta casa com ${mv.re}`);
    for (let f = 0; f < n; f++) {
      const ph = cp.dur > 0 ? f / (n - 1) : 0;
      const val = (mv: { amp?: number; media?: number; fase?: number; freq?: number; forma?: Forma }) =>
        (mv.media ?? 0) + (mv.amp ?? 0) * onda(mv.forma, 2 * Math.PI * ((mv.freq ?? 1) * ph + (mv.fase ?? 0)));
      juntas.forEach((o, j) => {
        let q = [0, 0, 0, 1];
        for (const { mv, re } of movs)
          if (re.test(o)) {
            const a = eixoAngulo(eixos[mv.eixo], val(mv));
            q = [
              q[3] * a[0] + q[0] * a[3] + q[1] * a[2] - q[2] * a[1],
              q[3] * a[1] - q[0] * a[2] + q[1] * a[3] + q[2] * a[0],
              q[3] * a[2] + q[0] * a[1] - q[1] * a[0] + q[2] * a[3],
              q[3] * a[3] - q[0] * a[0] - q[1] * a[1] - q[2] * a[2],
            ];
          }
        for (let k = 0; k < 4; k++) R[(f * nj + j) * 4 + k] = Math.round(q[k] * 32767);
      });
      const dy = cp.raizY ? val(cp.raizY) : 0;
      Q[f * 3] = Math.round(pos[0][0] * 10000);
      Q[f * 3 + 1] = Math.round((pos[0][1] + dy) * 10000);
      Q[f * 3 + 2] = Math.round(pos[0][2] * 10000);
    }
    clips[cn] = { fps: P0.fps, n, r: b64(R), q: b64(Q) };
  }
  const boca = N.reduce((a, v) => (v[0] > a[0] ? v : a), N[0]);
  const saida = {
    versao: 1,
    juntas,
    pais,
    repouso: repouso.map((t) => t.map((x) => +x.toFixed(6))),
    raiz,
    ibm: ibm.map((mm) => mm.map((x) => +x.toFixed(6))),
    malha: {
      p: b64(P16),
      j: b64(J8),
      w: b64(W8),
      i: b64(Uint16Array.from(I)),
      c: b64(Uint8Array.from(baixa.c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255)))),
    },
    clips,
    marcas: {
      sela: [+(xR * S).toFixed(2), +(costas(xR) * S).toFixed(2), 0],
      boca: boca.map((x) => +(x * S).toFixed(2)),
      ...(P0.temCarga ? { carga: [1] } : {}),
    },
  };
  const json = JSON.stringify(saida);
  console.log(
    `tamandua: ${nv} vértices, ${I.length / 3} triângulos, ${nj} juntas, clips ${Object.keys(clips).join(", ")} — ${(json.length / 1024).toFixed(0)} KB`,
  );
  console.log(`  altura das costas ${(H * S).toFixed(1)} · sela ${saida.marcas.sela} · boca ${saida.marcas.boca}`);
  return json;
}

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
    readFileSync(args.find((a) => !a.startsWith("--")) ?? "tools/modelos/tamandua.json", "utf8"),
  ) as Plano;
  mkdirSync(plano.previas, { recursive: true });
  const json = await converter(plano);
  if (!args.includes("--simular")) writeFileSync(plano.saida, json);
  const A = decodificarAnim(JSON.parse(json));
  const S = plano.comprimento,
    L = 320,
    caixa = { mn: [-S * 0.6, -2, -S * 0.6], mx: [S * 0.6, S * 0.6, S * 0.6] },
    arq = join(plano.previas, "_q.png");
  for (const cn of Object.keys(A.clips)) {
    const c = A.clips[cn],
      nq = c.n > 1 ? 6 : 1,
      tiles: { input: Buffer; left: number; top: number }[] = [];
    for (let k = 0; k < nq; k++)
      for (const [v, vista] of (["frente", "lado"] as const).entries()) {
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
      .toFile(join(plano.previas, `${cn}.png`));
  }
  // de perfil, grande, com a altura da heroína
  await quadro(json, "parada", 0, "frente", 700, caixa, arq);
  const s = (700 - 60) / (caixa.mx[0] - caixa.mn[0]),
    hb = plano.alturaHeroina * s,
    base = 30 + caixa.mx[1] * s;
  const alt = (await sharp(arq).metadata()).height!;
  const barra = Buffer.from(
    `<svg width="700" height="${alt}"><rect x="20" y="${base - hb}" width="10" height="${hb}" fill="#888"/><text x="36" y="${base - hb + 14}" font-size="14" fill="#ff0" font-family="sans-serif">heroína</text></svg>`,
  );
  await sharp(arq)
    .composite([{ input: barra, left: 0, top: 0 }])
    .png()
    .toFile(join(plano.previas, "todos.png"));
  console.log(`prévias em ${plano.previas}`);
}

await main();
