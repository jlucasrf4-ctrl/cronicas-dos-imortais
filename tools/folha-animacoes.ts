/* v8.0 — folha de conferência de animações do Mixamo: o mantenedor manda pacotes (.zip de FBX, ou FBX soltos) baixados
   num personagem riggado no Mixamo (o FBX "com pele" vem junto em cada pacote) e não dá para abrir um por um
   ("demora muito pra visualizar"). Esta ferramenta desenha cada animação NO personagem do pacote, 4 quadros, e mede:
   duração, quanto o quadril anda (no lugar ou com deslocamento), quanto sobe/desce (pulo, agachar, sentar), se o fim
   emenda no começo (dá para repetir em laço) e quantos ossos batem com o esqueleto do personagem.

   Uso:  node tools/folha-animacoes.ts <pasta> <saida>
   Grava <saida>/<pacote>_<n>.png (até 24 animações por folha; lado esquerdo do corpo em azul, direito em laranja,
   centrado no quadril) e <saida>/resumo.json. Sem dependência do jogo: só tools/lib (fbx.ts, retarget.ts, glb.ts). */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import { lerFbx, lerMalhaFbx, type Fbx } from "./lib/fbx.ts";
import { globaisFbx, qmul, qinv } from "./lib/retarget.ts";
import { desenhar } from "./lib/glb.ts";

const [pasta, saida] = process.argv.slice(2);
if (!pasta || !saida) throw new Error("uso: node tools/folha-animacoes.ts <pasta> <saida>");
mkdirSync(saida, { recursive: true });

/* ---- as entradas: FBX soltos e os FBX de cada .zip (método 0 ou 8) ---- */
function entradasZip(arq: string) {
  const zip = readFileSync(arq),
    out: { nome: string; dados: () => Buffer }[] = [];
  let fim = zip.length - 22;
  while (fim > 0 && zip.readUInt32LE(fim) !== 0x06054b50) fim--;
  const n = zip.readUInt16LE(fim + 10);
  let p = zip.readUInt32LE(fim + 16);
  for (let k = 0; k < n; k++) {
    const metodo = zip.readUInt16LE(p + 10),
      tam = zip.readUInt32LE(p + 20),
      ln = zip.readUInt16LE(p + 28),
      le = zip.readUInt16LE(p + 30),
      lc = zip.readUInt16LE(p + 32),
      off = zip.readUInt32LE(p + 42),
      nome = zip.subarray(p + 46, p + 46 + ln).toString("utf8");
    out.push({
      nome,
      dados: () => {
        const lnl = zip.readUInt16LE(off + 26),
          lel = zip.readUInt16LE(off + 28),
          ini = off + 30 + lnl + lel,
          bruto = zip.subarray(ini, ini + tam);
        return metodo === 8 ? inflateRawSync(bruto) : Buffer.from(bruto);
      },
    });
    p += 46 + ln + le + lc;
  }
  return out;
}
interface Entrada {
  pacote: string;
  nome: string;
  dados: () => Buffer;
}
const entradas: Entrada[] = [];
for (const f of readdirSync(pasta).sort()) {
  const arq = join(pasta, f);
  if (f.toLowerCase().endsWith(".zip"))
    for (const e of entradasZip(arq))
      if (e.nome.toLowerCase().endsWith(".fbx"))
        entradas.push({ pacote: f.replace(/\.zip$/i, ""), nome: e.nome, dados: e.dados });
  if (f.toLowerCase().endsWith(".fbx")) entradas.push({ pacote: "soltos", nome: f, dados: () => readFileSync(arq) });
}
// o personagem com pele: o FBX que tem malha (o mesmo em todos os pacotes); o primeiro que achar
const ehPele = (e: Entrada) => /tpose/i.test(e.nome);
const pele = entradas.find(ehPele);
if (!pele) throw new Error("nenhum FBX com pele (…tpose.fbx) nos pacotes");
const M = lerMalhaFbx(pele.dados());
console.log(
  `personagem: ${pele.nome} (${pele.pacote}): ${M.P.length / 3} pontos, ${M.poli.length} polígonos, ${M.ossos.length} ossos`,
);

/* ---- a pele: por vértice, os ossos e pesos; por osso, inversa do bind × malha no bind ---- */
type M4 = number[];
const mul = (a: M4, b: M4): M4 => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function inv(m: M4): M4 {
  // inversa geral 4×4 (coluna)
  const a = m.slice(),
    o = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const at = (r: number, c: number) => a[c * 4 + r],
    set = (A: number[], r: number, c: number, v: number) => (A[c * 4 + r] = v);
  for (let c = 0; c < 4; c++) {
    let piv = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(at(r, c)) > Math.abs(at(piv, c))) piv = r;
    for (let k = 0; k < 4; k++) {
      const t1 = at(c, k);
      set(a, c, k, at(piv, k));
      set(a, piv, k, t1);
      const t2 = o[k * 4 + c];
      o[k * 4 + c] = o[k * 4 + piv];
      o[k * 4 + piv] = t2;
    }
    const d = at(c, c) || 1e-12;
    for (let k = 0; k < 4; k++) {
      set(a, c, k, at(c, k) / d);
      o[k * 4 + c] /= d;
    }
    for (let r = 0; r < 4; r++)
      if (r !== c) {
        const f = at(r, c);
        for (let k = 0; k < 4; k++) {
          set(a, r, k, at(r, k) - f * at(c, k));
          o[k * 4 + r] -= f * o[k * 4 + c];
        }
      }
  }
  return o;
}
const nomeOsso = (s: string) => s.replace(/^mixamorig\d*:/, "");
const ossos = M.ossos.filter((o) => o.link.length === 16);
// a malha no bind: a da BindPose (o "Transform" do cluster do Mixamo já vem como inversa do osso × malha: usá-lo
// de novo invertia duas vezes e a malha explodia)
const malhaBind = M.bindMalha ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const preB = ossos.map((o) => mul(inv(o.link), malhaBind));
const nv = M.P.length / 3,
  vb: number[][] = Array.from({ length: nv }, () => []),
  vw: number[][] = Array.from({ length: nv }, () => []);
ossos.forEach((o, b) => o.idx.forEach((v, k) => (vb[v].push(b), vw[v].push(o.peso[k]))));
// triângulos (leque) e o lado de cada um pelo osso de maior peso do 1º vértice
const tri: number[] = [];
for (const pl of M.poli) for (let k = 1; k + 1 < pl.length; k++) tri.push(pl[0], pl[k], pl[k + 1]);
const lado = (v: number) => {
  let mb = -1,
    mw = 0;
  vb[v].forEach((b, k) => vw[v][k] > mw && ((mw = vw[v][k]), (mb = b)));
  const n = mb >= 0 ? nomeOsso(ossos[mb].nome) : "";
  return /^Left/.test(n) ? 1 : /^Right/.test(n) ? 2 : 0;
};
const ladoTri = Array.from({ length: tri.length / 3 }, (_, t) => lado(tri[t * 3]));
const COR = [
  [222, 186, 160],
  [120, 165, 230],
  [236, 150, 80],
];

/* ---- a pose: matriz global de cada osso do personagem no tempo t da animação (por nome) ---- */
function globaisPorNome(F: Fbx, t: number | null) {
  const { gq, gp } = globaisFbx(F, t),
    m = new Map<string, M4>();
  F.ossos.forEach((o, i) => {
    const [x, y, z, w] = gq[i];
    // rotação do quatérnio + translação (coluna)
    m.set(o.nome, [
      1 - 2 * (y * y + z * z),
      2 * (x * y + z * w),
      2 * (x * z - y * w),
      0,
      2 * (x * y - z * w),
      1 - 2 * (x * x + z * z),
      2 * (y * z + x * w),
      0,
      2 * (x * z + y * w),
      2 * (y * z - x * w),
      1 - 2 * (x * x + y * y),
      0,
      gp[i][0],
      gp[i][1],
      gp[i][2],
      1,
    ]);
  });
  return m;
}
function deformar(F: Fbx, t: number | null) {
  const G = globaisPorNome(F, t),
    S = ossos.map((o, b) => {
      const g = G.get(nomeOsso(o.nome));
      return g ? mul(g, preB[b]) : null;
    });
  const P = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const x = M.P[v * 3],
      y = M.P[v * 3 + 1],
      z = M.P[v * 3 + 2];
    let ox = 0,
      oy = 0,
      oz = 0,
      wt = 0;
    vb[v].forEach((b, k) => {
      const s = S[b];
      if (!s) return;
      const w = vw[v][k];
      ox += w * (s[0] * x + s[4] * y + s[8] * z + s[12]);
      oy += w * (s[1] * x + s[5] * y + s[9] * z + s[13]);
      oz += w * (s[2] * x + s[6] * y + s[10] * z + s[14]);
      wt += w;
    });
    if (wt > 0) {
      P[v * 3] = ox / wt;
      P[v * 3 + 1] = oy / wt;
      P[v * 3 + 2] = oz / wt;
    }
  }
  return { P, hips: G.get("Hips") };
}

/* ---- conferência: a pose de repouso do 1º pacote deve bater com a pele (mesmo esqueleto) ---- */
const anims = entradas.filter((e) => !ehPele(e));
{
  const F = lerFbx(anims[0].dados()),
    G = globaisPorNome(F, null);
  let erro = 0,
    n = 0;
  for (const o of ossos) {
    const g = G.get(nomeOsso(o.nome));
    if (!g) continue;
    erro += Math.hypot(g[12] - o.link[12], g[13] - o.link[13], g[14] - o.link[14]);
    n++;
  }
  console.log(
    `conferência do esqueleto (${anims[0].nome}): ${n} ossos, distância média do repouso ao bind ${(erro / (n || 1)).toFixed(2)}`,
  );
}

/* ---- enquadramento fixo: a caixa do personagem no bind, com folga ---- */
const bind = deformar(lerFbx(anims[0].dados()), null).P;
let y0 = Infinity,
  y1 = -Infinity;
for (let v = 0; v < nv; v++) {
  y0 = Math.min(y0, bind[v * 3 + 1]);
  y1 = Math.max(y1, bind[v * 3 + 1]);
}
const altura = y1 - y0,
  xr = altura * 0.42;
const CAIXA = { mn: [-xr, y0 - altura * 0.04, -1e5], mx: [xr, y1 + altura * 0.06, 1e5] };
const YAW = (30 * Math.PI) / 180;

/* ---- cada animação: medidas e 4 quadros ---- */
interface Info {
  pacote: string;
  nome: string;
  duracao: number;
  ossos: number;
  anda: number; // deslocamento horizontal do quadril, do começo ao fim (m)
  sobe: number; // altura máxima − mínima do quadril (m)
  desce: number; // quanto o quadril fica abaixo do de pé, no ponto mais baixo (m)
  emenda: number; // diferença média (graus) entre o primeiro e o último quadro
}
const infos: Info[] = [];
const L = 150,
  H = 210,
  Q = 4;
const folhas = new Map<string, { input: Buffer; left: number; top: number }[][]>();
const tmp = join(saida, "_q.png");
const hipsBind = (() => {
  const G = globaisPorNome(lerFbx(anims[0].dados()), null).get("Hips")!;
  return [G[12], G[13], G[14]];
})();
for (const [k, e] of anims.entries()) {
  const F = lerFbx(e.dados());
  const nomesF = new Set(F.ossos.map((o) => o.nome));
  const bateram = ossos.filter((o) => nomesF.has(nomeOsso(o.nome))).length;
  const dur = F.duracao || 0;
  // quadril ao longo do tempo (30 amostras)
  const hp: number[][] = [];
  for (let i = 0; i <= 30; i++) {
    const g = globaisPorNome(F, (dur * i) / 30).get("Hips");
    if (g) hp.push([g[12], g[13], g[14]]);
  }
  // metros: UnitScaleFactor = cm por unidade do arquivo (o Mixamo da deusa: 100, o arquivo já está em metros)
  const m = (F.unidade || 1) / 100,
    ys = hp.map((p) => p[1] * m),
    anda = hp.length ? Math.hypot(hp[hp.length - 1][0] - hp[0][0], hp[hp.length - 1][2] - hp[0][2]) * m : 0;
  // emenda: ângulo médio entre as rotações globais do 1º e do último quadro
  const A = globaisFbx(F, 0),
    B = globaisFbx(F, dur);
  let ang = 0;
  A.gq.forEach((q, i) => {
    const d = qmul(qinv(q), B.gq[i]);
    ang += 2 * Math.acos(Math.min(1, Math.abs(d[3])));
  });
  const info: Info = {
    pacote: e.pacote,
    nome: e.nome.replace(/\.fbx$/i, ""),
    duracao: +dur.toFixed(2),
    ossos: bateram,
    anda: +anda.toFixed(2),
    sobe: +(Math.max(...ys) - Math.min(...ys)).toFixed(2),
    desce: +(hipsBind[1] * m - Math.min(...ys)).toFixed(2),
    emenda: +((ang / (A.gq.length || 1)) * (180 / Math.PI)).toFixed(1),
  };
  infos.push(info);
  // 4 quadros, centrados no quadril (x/z), girados 30° para ler frente e lado
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  for (let q = 0; q < Q; q++) {
    const t = dur > 0 ? (dur * q) / Q : null,
      { P, hips } = deformar(F, t),
      cx = hips ? hips[12] : 0,
      cz = hips ? hips[14] : 0,
      G: number[] = [];
    for (let v = 0; v < nv; v++) {
      const x = P[v * 3] - cx,
        z = P[v * 3 + 2] - cz;
      G.push(x * Math.cos(YAW) + z * Math.sin(YAW), P[v * 3 + 1], -x * Math.sin(YAW) + z * Math.cos(YAW));
    }
    await desenhar(tmp, G, tri, (tt) => COR[ladoTri[tt]], { W: 330, caixaFixa: CAIXA });
    tiles.push({
      // a margem fixa de 30 px do desenhar sai (a mesma escala em todos os quadros)
      input: await (async () => {
        const md = await sharp(tmp).metadata();
        return sharp(tmp)
          .extract({ left: 30, top: 30, width: md.width! - 60, height: md.height! - 60 })
          .resize(L, H, { fit: "contain", background: "#262626" })
          .png()
          .toBuffer();
      })(),
      left: q * L,
      top: 22,
    });
  }
  const flags = [
    `${info.duracao}s`,
    info.anda > 0.25 ? `anda ${info.anda} m` : "no lugar",
    info.desce > 0.35 ? (info.desce > 0.6 ? "senta/deita" : "agacha") : info.sobe > 0.25 ? "pula/sobe" : "",
    info.emenda < 6 ? "repete" : "",
    info.ossos < ossos.length ? `ossos ${info.ossos}/${ossos.length}` : "",
  ].filter(Boolean);
  const rot = Buffer.from(
    `<svg width="${L * Q}" height="22"><rect width="100%" height="100%" fill="#1b1b1b"/>` +
      `<text x="5" y="15" font-size="12.5" fill="#ffd27a" font-family="sans-serif" font-weight="bold">${info.nome
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</text>` +
      `<text x="${L * Q - 5}" y="15" font-size="11" fill="#cfcfcf" font-family="sans-serif" text-anchor="end">${flags.join(" · ")}</text></svg>`,
  );
  tiles.push({ input: rot, left: 0, top: 0 });
  const bloco = await sharp({ create: { width: L * Q, height: H + 22, channels: 3, background: "#262626" } })
    .composite(tiles)
    .png()
    .toBuffer();
  const lista = folhas.get(e.pacote) ?? [];
  if (!lista.length || lista[lista.length - 1].length >= 24) lista.push([]);
  const pag = lista[lista.length - 1],
    i = pag.length;
  pag.push({ input: bloco, left: (i % 3) * (L * Q + 12), top: Math.floor(i / 3) * (H + 22 + 12) });
  folhas.set(e.pacote, lista);
  if (k % 10 === 0) console.log(`${k + 1}/${anims.length} ${e.pacote}/${e.nome}`);
}
for (const [pacote, paginas] of folhas)
  for (const [n, pag] of paginas.entries()) {
    const linhas = Math.ceil(pag.length / 3);
    await sharp({
      create: { width: 3 * (L * Q + 12) - 12, height: linhas * (H + 22 + 12) - 12, channels: 3, background: "#121212" },
    })
      .composite(pag)
      .png()
      .toFile(join(saida, `${pacote.replace(/[^\w\- ]/g, "_")}_${n + 1}.png`));
  }
writeFileSync(join(saida, "resumo.json"), JSON.stringify(infos, null, 1));
console.log(`${infos.length} animações; folhas e resumo em ${saida}`);
void basename;
