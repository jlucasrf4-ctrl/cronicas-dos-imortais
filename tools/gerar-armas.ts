/* v8.0 — as armas do jogo a partir de uma folha de desenhos do GPT (de perfil, fundo branco), sem modelo 3D
   (mantenedor 2026-10-25: "não vou conseguir usar no Tripo, consegue colocar uma imagem do GPT e adaptar?").
   Uso:  node tools/gerar-armas.ts [plano.json]      (padrão tools/modelos/armas.json)

   Cada arma: os pixels não brancos da `caixa` (manchas pequenas e pedaços de vizinhas fora; `abrir` tira linhas finas como a corda do arco)
   viram uma malha "inflada": a espessura cresce da borda para dentro — metal (cinza, pouca saturação) fica uma
   lâmina fina (`metalMeia` de meia espessura, chanfrada na borda), madeira e couro ficam redondos (seção de círculo
   com o raio da largura local × `achatarMadeira`); `plano` = espessura constante (o escudo). A borda tem espessura 0,
   frente e verso se encontram nela. Cor por vértice = a do desenho (os dois lados). Origem na mão: a coluna `cabo`
   (meio da faixa do cabo nessa coluna; nos arcos, a faixa de baixo, a empunhadura) ou o centro (`centro`). Escala:
   a largura da caixa = `comp` (unidades do jogo). Eixos: `x` = para onde vai a horizontal do desenho, `y` = para onde
   vai o "para cima" do desenho ("+x", "-x", "+y", "+z"…); a espessura fica no eixo que sobra.
   Saída src/assets/models/armas.json ({ nome: { p Int16 ×100, i Uint16, c Uint8 por vértice } em base64), lida por
   src/render/gl/armas3d.ts. Prévias em build/modelos/armas/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { MeshoptSimplifier } from "meshoptimizer";
import { desenhar } from "./lib/glb.ts";

interface Arma {
  nome: string;
  caixa: [number, number, number, number];
  cabo?: number;
  comp: number;
  x: string;
  y: string;
  arco?: boolean;
  abrir?: number;
  centro?: boolean;
  metalMeia?: number;
  plano?: number;
  manter?: boolean;
  largY?: number;
  largZ?: number;
  encolher?: { comp: number; larg: number };
  domo?: number;
}
interface Plano {
  folha: string;
  saida: string;
  previas: string;
  tris: number;
  metalMeia: number;
  achatarMadeira: number;
  encolher: { comp: number; larg: number };
  armas: Arma[];
}
const plano = JSON.parse(readFileSync(process.argv[2] ?? "tools/modelos/armas.json", "utf8")) as Plano;
const { data: IMG, info } = await sharp(plano.folha).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const FW = info.width;
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;

const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const eixo = (s: string) => ({ i: "xyz".indexOf(s[1]), s: s[0] === "-" ? -1 : 1 });

/** Distância (chanfro 3-4, em px) de cada pixel de dentro até o de fora mais perto. */
function distancia(m: Uint8Array, w: number, h: number) {
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? 1e9 : 0;
  const passo = (y: number, x: number, dy: number, dx: number, c: number) => {
    const yy = y + dy,
      xx = x + dx;
    return yy < 0 || yy >= h || xx < 0 || xx >= w ? c : d[yy * w + xx] + c;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[y * w + x])
        d[y * w + x] = Math.min(
          d[y * w + x],
          passo(y, x, 0, -1, 3),
          passo(y, x, -1, 0, 3),
          passo(y, x, -1, -1, 4),
          passo(y, x, -1, 1, 4),
        );
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--)
      if (d[y * w + x])
        d[y * w + x] = Math.min(
          d[y * w + x],
          passo(y, x, 0, 1, 3),
          passo(y, x, 1, 0, 3),
          passo(y, x, 1, 1, 4),
          passo(y, x, 1, -1, 4),
        );
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}
/** Máximo numa janela quadrada de raio r (separável). */
function maximo(d: Float32Array, w: number, h: number, r: number) {
  const t = new Float32Array(w * h),
    o = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, d[y * w + k]);
      t[y * w + x] = m;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, t[k * w + x]);
      o[y * w + x] = m;
    }
  return o;
}

const saida: Record<string, { p: string; i: string; c: string }> = {};
const previas: { nome: string; P: number[]; I: number[]; C: number[][] }[] = [];
for (const a of plano.armas) {
  const [x0, y0, x1, y1] = a.caixa,
    w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  const px = (x: number, y: number) => ((y + y0) * FW + x + x0) * 3;
  // máscara: não branco; `abrir` (erosão + dilatação) tira linhas finas; manchas < 150 px fora
  let m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = px(x, y);
      m[y * w + x] = IMG[i] + IMG[i + 1] + IMG[i + 2] < 3 * 236 ? 1 : 0;
    }
  if (a.abrir) {
    const r = a.abrir,
      ero = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let ok = 1;
        for (let dy = -r; dy <= r && ok; dy++)
          for (let dx = -r; dx <= r && ok; dx++) {
            const yy = y + dy,
              xx = x + dx;
            if (yy < 0 || yy >= h || xx < 0 || xx >= w || !m[yy * w + xx]) ok = 0;
          }
        ero[y * w + x] = ok;
      }
    const dil = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (ero[y * w + x])
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              const yy = y + dy,
                xx = x + dx;
              if (yy >= 0 && yy < h && xx >= 0 && xx < w && m[yy * w + xx]) dil[yy * w + xx] = 1;
            }
    m = dil;
  }
  {
    const rot = new Int32Array(w * h).fill(-1),
      tam: number[] = [];
    for (let s = 0; s < w * h; s++) {
      if (!m[s] || rot[s] >= 0) continue;
      const id = tam.length,
        pilha = [s];
      let n = 0;
      rot[s] = id;
      while (pilha.length) {
        const q = pilha.pop()!;
        n++;
        for (const r of [q - 1, q + 1, q - w, q + w])
          if (r >= 0 && r < w * h && m[r] && rot[r] < 0 && Math.abs((r % w) - (q % w)) <= 1) {
            rot[r] = id;
            pilha.push(r);
          }
      }
      tam.push(n);
    }
    // pedaços de armas vizinhas que caem na caixa: só ficam as manchas de pelo menos 20% da maior (as partes de uma arma se tocam)
    const maior = Math.max(...tam);
    for (let s = 0; s < w * h; s++) if (m[s] && tam[rot[s]] < Math.max(150, 0.2 * maior)) m[s] = 0;
  }
  // caixa real do desenho e a escala
  let bx0 = w,
    bx1 = 0,
    by0 = h,
    by1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        bx0 = Math.min(bx0, x);
        bx1 = Math.max(bx1, x);
        by0 = Math.min(by0, y);
        by1 = Math.max(by1, y);
      }
  const esc = a.comp / (bx1 - bx0 + 1);
  // origem
  let ox: number, oy: number;
  if (a.centro) {
    ox = (bx0 + bx1) / 2;
    oy = (by0 + by1) / 2;
  } else {
    ox = (a.cabo ?? x0 + (bx0 + bx1) / 2) - x0;
    const corridas: [number, number][] = [];
    let ini = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && m[y * w + Math.round(ox)];
      if (on && ini < 0) ini = y;
      if (!on && ini >= 0) {
        corridas.push([ini, y - 1]);
        ini = -1;
      }
    }
    const c = a.arco ? corridas[corridas.length - 1] : corridas.sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
    oy = c ? (c[0] + c[1]) / 2 : (by0 + by1) / 2;
  }
  // espessura
  const d = distancia(m, w, h),
    R = maximo(d, w, h, 24),
    meiaMetal = (a.metalMeia ?? plano.metalMeia) / esc;
  const meia = (x: number, y: number) => {
    const i = y * w + x;
    if (a.plano) {
      // domo: o centro (de ferro) em relevo, uma calota até domo do raio do desenho
      let extra = 0;
      if (a.domo) {
        const rr = Math.min(bx1 - bx0, by1 - by0) / 2,
          dc = Math.hypot(x - ox, y - oy) / (a.domo * rr);
        if (dc < 1) extra = Math.sqrt(1 - dc * dc) * a.domo * rr * 0.55;
      }
      return Math.min(d[i] * 0.6, a.plano / esc) + extra;
    }
    const c = px(x, y),
      r = IMG[c],
      g = IMG[c + 1],
      b = IMG[c + 2],
      mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      metal = mx > 60 && (mx - mn) / mx < 0.24;
    if (metal) return Math.min(d[i] * 0.35, meiaMetal);
    const rr = Math.max(R[i], d[i]);
    return Math.sqrt(Math.max(0, d[i] * (2 * rr - d[i]))) * plano.achatarMadeira;
  };
  // grade: passo g px; vértices de frente e de trás; a borda (vizinho fora) com espessura 0
  const g = Math.max(2, Math.round((bx1 - bx0) / 220));
  const gw = Math.floor(w / g) + 1,
    gh = Math.floor(h / g) + 1;
  const dentro = (gx: number, gy: number) =>
    gx >= 0 && gy >= 0 && gx < gw && gy < gh && m[Math.min(h - 1, gy * g) * w + Math.min(w - 1, gx * g)] === 1;
  const ex = eixo(a.x),
    ey = eixo(a.y),
    ez = 3 - ex.i - ey.i;
  const P: number[] = [],
    C: number[] = [],
    I: number[] = [],
    idF = new Int32Array(gw * gh).fill(-1),
    idB = new Int32Array(gw * gh).fill(-1);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      if (!dentro(gx, gy)) continue;
      const x = Math.min(w - 1, gx * g),
        y = Math.min(h - 1, gy * g);
      const borda = !dentro(gx - 1, gy) || !dentro(gx + 1, gy) || !dentro(gx, gy - 1) || !dentro(gx, gy + 1);
      const t = borda ? 0 : meia(x, y);
      // cor: média do bloco g×g (só pixels de dentro)
      const cor = [0, 0, 0];
      let n = 0;
      for (let yy = Math.max(0, y - (g >> 1)); yy <= Math.min(h - 1, y + (g >> 1)); yy++)
        for (let xx = Math.max(0, x - (g >> 1)); xx <= Math.min(w - 1, x + (g >> 1)); xx++)
          if (m[yy * w + xx]) {
            const c = px(xx, yy);
            for (let e = 0; e < 3; e++) cor[e] += IMG[c + e];
            n++;
          }
      for (const lado of [1, -1]) {
        const v = [0, 0, 0];
        // `encolher` (mantenedor 2026-10-25: "estão muito grossas e grandes, roubando a atenção"): o comprimento × comp,
        // a largura do desenho × larg (ou × `largY` da arma: o arco e o escudo seguem o comprimento) e a espessura × larg;
        // `manter` (as facas, já pequenas) fica como desenhada
        const k = a.manter ? { comp: 1, larg: 1 } : (a.encolher ?? plano.encolher);
        v[ex.i] = ex.s * (x - ox) * esc * k.comp;
        v[ey.i] = ey.s * (oy - y) * esc * (a.manter ? 1 : (a.largY ?? k.larg));
        v[ez] = lado * t * esc * (a.largZ ?? k.larg);
        (lado > 0 ? idF : idB)[gy * gw + gx] = P.length / 3;
        P.push(...v);
        C.push(...cor.map((c) => c / Math.max(1, n) / 255));
        if (borda) break; // na borda frente e verso são o mesmo vértice
      }
      if (borda) idB[gy * gw + gx] = idF[gy * gw + gx];
    }
  // triângulos: cada célula com os 4 cantos dentro (ou 3) — frente e verso com a ordem invertida
  const tri = (a1: number, b1: number, c1: number) => {
    if (a1 < 0 || b1 < 0 || c1 < 0) return;
    I.push(a1, b1, c1);
  };
  // o sentido da frente depende da troca de eixos: confere pela normal de um triângulo de teste
  const sinal = (() => {
    const u = [0, 0, 0],
      v = [0, 0, 0];
    u[ex.i] = ex.s;
    v[ey.i] = -ey.s; // y da grade cresce para baixo
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    return n[ez] > 0 ? 1 : -1;
  })();
  for (let gy = 0; gy < gh - 1; gy++)
    for (let gx = 0; gx < gw - 1; gx++) {
      const q = [gy * gw + gx, gy * gw + gx + 1, (gy + 1) * gw + gx + 1, (gy + 1) * gw + gx];
      const ok = q.map((k) => idF[k] >= 0);
      const tris: number[][] = [];
      if (ok.every(Boolean)) tris.push([0, 1, 2], [0, 2, 3]);
      else if (ok.filter(Boolean).length === 3) tris.push(q.map((_, i) => i).filter((i) => ok[i]));
      for (const t of tris) {
        const [p0, p1, p2] = t.map((i) => q[i]);
        if (sinal > 0) {
          tri(idF[p0], idF[p1], idF[p2]);
          tri(idB[p0], idB[p2], idB[p1]);
        } else {
          tri(idF[p0], idF[p2], idF[p1]);
          tri(idB[p0], idB[p1], idB[p2]);
        }
      }
    }
  // redução com a cor como atributo
  const alvo = Math.min(plano.tris, I.length / 3);
  const [lo] = MeshoptSimplifier.simplifyWithAttributes(
    Uint32Array.from(I),
    Float32Array.from(P),
    3,
    Float32Array.from(C),
    3,
    [2, 2, 2],
    null,
    alvo * 3,
    0.05,
  );
  // compacta os vértices usados
  const novo = new Map<number, number>(),
    P2: number[] = [],
    C2: number[] = [],
    I2: number[] = [];
  for (const v of lo) {
    let j = novo.get(v);
    if (j === undefined) {
      novo.set(v, (j = P2.length / 3));
      P2.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      C2.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]);
    }
    I2.push(j);
  }
  saida[a.nome] = {
    p: b64(Int16Array.from(P2, (v) => Math.round(v * 100))),
    i: b64(Uint16Array.from(I2)),
    c: b64(Uint8Array.from(C2, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255))),
  };
  previas.push({
    nome: a.nome,
    P: P2,
    I: I2,
    C: Array.from({ length: I2.length / 3 }, (_, t) =>
      [0, 1, 2].map((e) => ((C2[I2[t * 3] * 3 + e] + C2[I2[t * 3 + 1] * 3 + e] + C2[I2[t * 3 + 2] * 3 + e]) / 3) * 255),
    ),
  });
  console.log(
    `${a.nome.padEnd(17)} ${I.length / 3} → ${I2.length / 3} triângulos, ${P2.length / 3} vértices, escala ${esc.toFixed(4)}`,
  );
}
writeFileSync(plano.saida, JSON.stringify(saida));
console.log(`${plano.saida}: ${(JSON.stringify(saida).length / 1024).toFixed(0)} KB`);

// prévias: cada arma de frente (o desenho) e girada (para ver a espessura), lado a lado
mkdirSync(plano.previas, { recursive: true });
for (const pv of previas) {
  // gira para a vista: o plano do desenho de frente para a câmera (desenhar olha de +z)
  const a = plano.armas.find((q) => q.nome === pv.nome)!,
    ex = eixo(a.x),
    ey = eixo(a.y),
    ez = 3 - ex.i - ey.i;
  for (const [vista, giro] of [
    ["frente", 0],
    ["giro", 0.9],
  ] as const) {
    const Q: number[] = [];
    for (let i = 0; i < pv.P.length; i += 3) {
      const X = pv.P[i + ex.i] * ex.s,
        Y = pv.P[i + ey.i] * ey.s,
        Z = pv.P[i + ez];
      Q.push(X * Math.cos(giro) + Z * Math.sin(giro), Y, -X * Math.sin(giro) + Z * Math.cos(giro));
    }
    await desenhar(`${plano.previas}/${pv.nome}_${vista}.png`, Q, pv.I, (t) => pv.C[t], { W: 500 });
  }
}
console.log(`prévias em ${plano.previas}`);
