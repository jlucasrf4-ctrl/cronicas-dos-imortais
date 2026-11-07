/* ==== v8.1 — Modo Editor: a biblioteca de modelos (editor/editor.ts) e as malhas das peças postas (editor/cena.ts) ====
   A biblioteca se monta sozinha com o que o jogo já tem: as árvores, plantas, pedras e o acampamento do cenário
   (render/gl/cenario.ts), os prédios e enfeites da vila com textura (render/gl/vila_tex.ts), os itens do chão
   (render/gl/chao.ts) e os modelos que o mantenedor joga na pasta modelos-novos/ (o servidor ao vivo converte cada .glb
   para src/assets/editor/, tools/lib/importar.ts). Mais as peças invisíveis: luzes, efeitos e sons. Cada modelo vira
   uma malha na primeira vez que aparece (guardada por contexto de GL) e uma miniatura desenhada em software. */
import { GL3 } from "../core/state.ts";
import { MB, glMesh } from "../render/gl/malhas.ts";
import { glSmoothNormals } from "../render/gl/estilo.ts";
import { itensCenario, mbCenarioItem } from "../render/gl/cenario.ts";
import { itemCru, itensChao } from "../render/gl/chao.ts";
import { mbPedraMinerio } from "../render/gl/pedras_minerio.ts";
import { TIPOS_PEDRA } from "../data/pedras.ts";
import { pecasVila, vilaCrua, vtMalha, vtPor, VILA_TEX_URL } from "../render/gl/vila_tex.ts";
import {
  CATEGORIAS,
  EFEITOS,
  ESTACOES,
  ITENS_ESTACAO,
  LUZES,
  NOMES,
  SONS,
  TAM_IMPORTADO,
  TAM_VILA,
} from "../data/editor.ts";
import type { GLMesh, MalhaCrua } from "../core/tipos.ts";

/** Um modelo importado (src/assets/editor/modelos.json): o mesmo formato das peças da vila (maior medida = 1, base em
 *  y=0, centro em x/z), com textura (`uv` + `tex`) ou cor por vértice (`c`, Uint8 rgb). */
interface Importado {
  nome?: string;
  tam: number[];
  p: string;
  i: string;
  uv?: string;
  c?: string;
  tex?: string;
}
const EMBUTIDOS = /* @inline-json src/assets/editor/modelos.json */ {} as { modelos?: Record<string, Importado> };
const IMP = { modelos: { ...(EMBUTIDOS.modelos || {}) } as Record<string, Importado> };

interface InfoModelo {
  id: string;
  nome: string;
  cat: string;
  cam: string;
  /** invisível no jogo (luz, efeito, som): o editor mostra um ícone */
  tipo?: "luz" | "fx" | "som";
  ico?: string;
  /** o grupo (variantes do mesmo tipo, para o pincel sortear) */
  grupo: string;
}

const LISTA = { cache: null as InfoModelo[] | null };
const grupoDe = (item: string) => item.replace(/_\d+$/, "");
const nomeDe = (g: string) => NOMES[g] || g.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Todos os modelos da biblioteca, por categoria. */
export function listarModelos(): InfoModelo[] {
  if (LISTA.cache) return LISTA.cache;
  const L: InfoModelo[] = [],
    catDeGrupo = new Map<string, (typeof CATEGORIAS)[number]>();
  for (const c of CATEGORIAS) for (const g of c.grupos || []) catDeGrupo.set(g, c);
  const cat = (id: string) => CATEGORIAS.find((c) => c.id === id)!;
  const contagem: Record<string, number> = {};
  for (const it of itensCenario()) contagem[grupoDe(it)] = (contagem[grupoDe(it)] || 0) + 1;
  for (const it of itensCenario()) {
    const g = grupoDe(it),
      c = catDeGrupo.get(g) || cat("acamp"),
      n = it.match(/_(\d+)$/)?.[1];
    L.push({
      id: "cen:" + it,
      nome: nomeDe(g) + (contagem[g] > 1 && n ? " " + n : ""),
      cat: c.id,
      cam: c.cam,
      grupo: "cen:" + g,
    });
  }
  for (const [k, tp] of Object.entries(TIPOS_PEDRA))
    for (const q of [false, true])
      L.push({
        id: "min:" + k + (q ? ":q" : ""),
        nome: tp.n + (q ? " (quebrada)" : ""),
        cat: "minerios",
        cam: "natureza",
        grupo: "min:" + k + (q ? ":q" : ""),
      });
  for (const [g, ests] of Object.entries(ITENS_ESTACAO))
    for (const est of ests) {
      const it = itensCenario().find((i) => grupoDe(i) === g);
      if (it)
        L.push({
          id: "cen:" + it + "@" + est,
          nome: nomeDe(g) + " (" + (ESTACOES[est]?.nome.toLowerCase() || est) + ")",
          cat: "estacoes",
          cam: "natureza",
          grupo: "cen:" + g + "@" + est,
        });
    }
  for (const p of pecasVila())
    L.push({ id: "vila:" + p, nome: nomeDe(p), cat: "vila", cam: "objetos", grupo: "vila:" + p });
  for (const it of itensChao())
    L.push({
      id: "item:" + it,
      nome: it.replace(/^eq_/, "").replace(/_/g, " "),
      cat: "itens",
      cam: "objetos",
      grupo: "item:" + it,
    });
  for (const [k, v] of Object.entries(IMP.modelos))
    L.push({ id: "imp:" + k, nome: v.nome || k, cat: "importados", cam: "objetos", grupo: "imp:" + k });
  for (const [k, v] of Object.entries(LUZES))
    L.push({ id: "luz:" + k, nome: v.nome, cat: "luzes", cam: "luzes", tipo: "luz", ico: v.ico, grupo: "luz:" + k });
  for (const [k, v] of Object.entries(EFEITOS))
    L.push({ id: "fx:" + k, nome: v.nome, cat: "efeitos", cam: "efeitos", tipo: "fx", ico: v.ico, grupo: "fx:" + k });
  for (const [k, v] of Object.entries(SONS))
    L.push({ id: "som:" + k, nome: v.nome, cat: "sons", cam: "sons", tipo: "som", ico: v.ico, grupo: "som:" + k });
  return (LISTA.cache = L);
}
export function infoModelo(id: string) {
  return listarModelos().find((m) => m.id === id) || null;
}
/** As variantes do mesmo grupo (o pincel sorteia entre elas). */
export function variantes(id: string) {
  // de estação: todas as variantes do grupo, pintadas na mesma estação
  const m = id.match(/^cen:(.+)_\d+@(\w+)$/);
  if (m)
    return itensCenario()
      .filter((i) => grupoDe(i) === m[1])
      .map((i) => ({ id: "cen:" + i + "@" + m[2] }));
  const g = infoModelo(id)?.grupo;
  return g ? listarModelos().filter((m) => m.grupo === g) : [];
}

/** v8.1 — a estação mudou (prévia): as malhas do cenário são refeitas com as cores dela. */
export function esquecerMalhas(prefixo: string) {
  for (const k of Object.keys(MALHAS.m)) if (k.startsWith(prefixo) && !k.includes("@")) delete MALHAS.m[k];
  for (const k of Object.keys(CRUAS)) if (k.startsWith(prefixo) && !k.includes("@")) delete CRUAS[k];
}
/** Troca os modelos importados (o servidor ao vivo avisou que a pasta mudou). */
export function trocarImportados(novos: Record<string, Importado>) {
  IMP.modelos = { ...novos };
  LISTA.cache = null;
  for (const k of Object.keys(MALHAS.m)) if (k.startsWith("imp:")) delete MALHAS.m[k];
  for (const k of Object.keys(CRUAS)) if (k.startsWith("imp:")) delete CRUAS[k];
}

function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let k = 0; k < s.length; k++) u[k] = s.charCodeAt(k);
  return u.buffer;
}

/** A malha crua de um modelo na escala 1 (px do campo, base em y=0): triângulos soltos, cor por vértice, e o UV com a
 *  textura quando tem. */
interface Crua extends MalhaCrua {
  uv?: number[];
  tex?: string;
}
const CRUAS: Record<string, Crua | null> = {};
function crua(id: string): Crua | null {
  if (id in CRUAS) return CRUAS[id];
  const [fonte, nome] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  let b: Crua | null = null;
  if (fonte === "cen") {
    // "folhosa_1@inverno": o item pintado na estação (render/gl/estacao_cor.ts)
    const [item, est] = nome.split("@");
    b = MB();
    if (!(est ? mbCenarioItem(b, item, est) : mbCenarioItem(b, item))) b = null;
  } else if (fonte === "min") {
    const [tipo, q] = nome.split(":");
    if (TIPOS_PEDRA[tipo]) {
      b = MB();
      mbPedraMinerio(b, tipo, 0, 0, 1, 0, q === "q");
    }
  } else if (fonte === "item") b = itemCru(nome);
  else if (fonte === "vila") {
    const pc = vilaCrua(nome);
    if (pc)
      b = indexada(pc.tam, pc.p, pc.i, (TAM_VILA[nome] || 60) / Math.max(...pc.tam), pc.uv, null, VILA_TEX_URL, 1.3);
  } else if (fonte === "imp") {
    const im = IMP.modelos[nome];
    if (im)
      b = indexada(
        im.tam,
        new Int16Array(bytes(im.p)),
        new Uint16Array(bytes(im.i)),
        TAM_IMPORTADO,
        im.uv ? new Uint16Array(bytes(im.uv)) : null,
        im.c ? new Uint8Array(bytes(im.c)) : null,
        im.tex,
        1.15,
      );
  }
  return (CRUAS[id] = b);
}
/** Peça indexada (Int16 × 32000, maior medida = 1) → triângulos soltos na escala `s`. */
function indexada(
  _tam: number[],
  P: Int16Array,
  I: Uint16Array,
  s: number,
  UV: Uint16Array | null,
  C: Uint8Array | null,
  tex: string | undefined,
  luz: number,
): Crua {
  const b: Crua = { p: [], n: [], c: [] };
  if (UV && tex) {
    b.uv = [];
    b.tex = tex;
  }
  const pos = (v: number) => [(P[v * 3] / 32000) * s, (P[v * 3 + 1] / 32000) * s, (P[v * 3 + 2] / 32000) * s];
  for (let t = 0; t < I.length; t += 3) {
    const vs = [I[t], I[t + 1], I[t + 2]],
      Q = vs.map(pos),
      a = [0, 1, 2].map((e) => Q[1][e] - Q[0][e]),
      c = [0, 1, 2].map((e) => Q[2][e] - Q[0][e]),
      n = [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]],
      ln = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let k = 0; k < 3; k++) {
      b.p.push(Q[k][0], Q[k][1], Q[k][2]);
      b.n.push(n[0] / ln, n[1] / ln, n[2] / ln);
      if (C) b.c.push((C[vs[k] * 3] / 255) * luz, (C[vs[k] * 3 + 1] / 255) * luz, (C[vs[k] * 3 + 2] / 255) * luz);
      else b.c.push(luz, luz, luz);
      if (b.uv && UV) b.uv.push(UV[vs[k] * 2] / 65535, UV[vs[k] * 2 + 1] / 65535);
    }
  }
  return b;
}

/** A malha de GL do modelo e a caixa dela (raio em x/z, altura), guardadas por contexto de GL. */
interface MalhaModelo {
  mesh: GLMesh;
  r: number;
  h: number;
}
const MALHAS = { gl: null as WebGL2RenderingContext | null, m: {} as Record<string, MalhaModelo | null> };
export function malhaModelo(id: string): MalhaModelo | null {
  if (MALHAS.gl !== GL3.gl) {
    MALHAS.gl = GL3.gl;
    MALHAS.m = {};
  }
  if (id in MALHAS.m) return MALHAS.m[id];
  const b = crua(id);
  if (!b || !b.p.length || !GL3.gl) return (MALHAS.m[id] = null);
  let mesh: GLMesh;
  if (id.startsWith("vila:")) {
    // a vila usa a textura e o caminho de montagem dela (vtPor + vtMalha)
    const tam = TAM_VILA[id.slice(5)] || 60;
    vtPor(id.slice(5), 0, 0, tam, tam);
    mesh = vtMalha()!;
  } else if (b.uv && b.tex) mesh = malhaComTextura(b, b.uv, b.tex);
  else mesh = glMesh(b);
  mesh.ol = true;
  let r = 0,
    h = 0;
  for (let k = 0; k < b.p.length; k += 3) {
    r = Math.max(r, Math.hypot(b.p[k], b.p[k + 2]));
    h = Math.max(h, b.p[k + 1]);
  }
  return (MALHAS.m[id] = { mesh, r: Math.max(r, 3), h: Math.max(h, 3) });
}

const TEXTURAS = new Map<string, WebGLTexture>();
function texturaDe(url: string) {
  const gl = GL3.gl;
  let t = TEXTURAS.get(url);
  if (t) return t;
  t = gl.createTexture()!;
  const tt = t;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 190, 170, 255]));
  gl.bindTexture(gl.TEXTURE_2D, null);
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tt);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  img.src = url;
  TEXTURAS.set(url, t);
  return t;
}
function malhaComTextura(b: MalhaCrua, uv: number[], tex: string): GLMesh {
  const gl = GL3.gl,
    vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const sm = glSmoothNormals(b),
    bufs: WebGLBuffer[] = [];
  const attrs: [Float32Array, number, number][] = [
    [new Float32Array(b.p), 0, 3],
    [sm.NS, 1, 3],
    [new Float32Array(b.c), 2, 3],
    [sm.HS, 3, 3],
    [new Float32Array(uv), 4, 2],
  ];
  for (const [arr, loc, k] of attrs) {
    const buf = gl.createBuffer()!;
    bufs.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0);
  }
  gl.bindVertexArray(null);
  return { vao, n: b.p.length / 3, bufs, tex: texturaDe(tex) };
}

/* ---------- miniaturas: desenho em software (pintor), na inclinação da câmera do jogo ---------- */
const PIXELS = new Map<string, Promise<ImageData | null>>();
function pixelsDe(url: string) {
  let p = PIXELS.get(url);
  if (!p) {
    p = new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = Math.min(256, img.width);
        cv.height = Math.min(256, img.height);
        const c = cv.getContext("2d")!;
        c.drawImage(img, 0, 0, cv.width, cv.height);
        ok(c.getImageData(0, 0, cv.width, cv.height));
      };
      img.onerror = () => ok(null);
      img.src = url;
    });
    PIXELS.set(url, p);
  }
  return p;
}
const MINIS = new Map<string, Promise<string>>();
/** A miniatura do modelo (data URL de um png), feita uma vez. Invisíveis: "" (o editor mostra o ícone). */
export function miniatura(id: string, lado = 84): Promise<string> {
  let p = MINIS.get(id);
  if (p) return p;
  p = (async () => {
    const b = crua(id);
    if (!b || !b.p.length) return "";
    const px = b.uv && b.tex ? await pixelsDe(b.tex) : null;
    const cv = document.createElement("canvas");
    cv.width = cv.height = lado;
    const c = cv.getContext("2d")!,
      ang = (47 * Math.PI) / 180,
      ca = Math.cos(ang),
      sa = Math.sin(ang),
      // vista girada um pouco (3/4), como no jogo de cima
      rot = -0.5,
      cr = Math.cos(rot),
      sr = Math.sin(rot);
    const proj: number[][] = [];
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (let k = 0; k < b.p.length; k += 3) {
      const x = b.p[k] * cr - b.p[k + 2] * sr,
        z = b.p[k] * sr + b.p[k + 2] * cr,
        y = b.p[k + 1],
        sx = x,
        sy = -(y * ca - z * sa),
        d = y * sa + z * ca;
      proj.push([sx, sy, d]);
      x0 = Math.min(x0, sx);
      x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy);
      y1 = Math.max(y1, sy);
    }
    const esc = (lado * 0.86) / Math.max(x1 - x0, y1 - y0, 1e-6),
      ox = lado / 2 - ((x0 + x1) / 2) * esc,
      oy = lado / 2 - ((y0 + y1) / 2) * esc;
    const tris: { d: number; t: number }[] = [];
    for (let t = 0; t < proj.length / 3; t++)
      tris.push({ d: (proj[t * 3][2] + proj[t * 3 + 1][2] + proj[t * 3 + 2][2]) / 3, t });
    tris.sort((a, q) => a.d - q.d);
    const L = [0.45, 0.75, 0.48];
    for (const { t } of tris) {
      const i = t * 3,
        nx = b.n[i * 3] * cr - b.n[i * 3 + 2] * sr,
        ny = b.n[i * 3 + 1],
        nz = b.n[i * 3] * sr + b.n[i * 3 + 2] * cr,
        luz = 0.55 + 0.55 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      let r = (b.c[i * 3] + b.c[i * 3 + 3] + b.c[i * 3 + 6]) / 3,
        g = (b.c[i * 3 + 1] + b.c[i * 3 + 4] + b.c[i * 3 + 7]) / 3,
        bl = (b.c[i * 3 + 2] + b.c[i * 3 + 5] + b.c[i * 3 + 8]) / 3;
      if (px && b.uv) {
        const u = (b.uv[i * 2] + b.uv[i * 2 + 2] + b.uv[i * 2 + 4]) / 3,
          v = (b.uv[i * 2 + 1] + b.uv[i * 2 + 3] + b.uv[i * 2 + 5]) / 3,
          tx = Math.min(px.width - 1, Math.max(0, Math.floor(u * px.width))),
          ty = Math.min(px.height - 1, Math.max(0, Math.floor(v * px.height))),
          o = (ty * px.width + tx) * 4;
        r *= px.data[o] / 255;
        g *= px.data[o + 1] / 255;
        bl *= px.data[o + 2] / 255;
      }
      const cor = `rgb(${Math.min(255, r * luz * 255) | 0},${Math.min(255, g * luz * 255) | 0},${Math.min(255, bl * luz * 255) | 0})`;
      c.fillStyle = c.strokeStyle = cor;
      c.lineWidth = 0.6;
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const [sx, sy] = proj[i + k];
        if (k) c.lineTo(ox + sx * esc, oy + sy * esc);
        else c.moveTo(ox + sx * esc, oy + sy * esc);
      }
      c.closePath();
      c.fill();
      c.stroke();
    }
    return cv.toDataURL("image/png");
  })();
  MINIS.set(id, p);
  return p;
}
