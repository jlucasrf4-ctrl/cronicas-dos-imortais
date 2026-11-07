/* ==== v7.7 — itens no chão em low poly (src/assets/models/chao.json, gerado por tools/gerar-chao.ts) ====
   Cada item do jogo usa uma peça das folhas do Tripo (normalizada: maior medida = 1, base em y=0) com um tamanho no
   mundo e um tom de cor; a malha de cada item é montada na primeira vez que ele aparece. Itens sem modelo ainda
   usam as malhas antigas (GL3.mesh, o saco). Também: o brilho de qualidade (A+ e SS), um anel fino no chão. */
import { GL3 } from "../../core/state.ts";
import { MB, glMesh } from "./malhas.ts";
import type { GLMesh } from "../../core/tipos.ts";

interface DadosChao {
  versao: number;
  pecas: Record<string, { p: string; c: string }>;
  itens: Record<string, { peca: string; tam: number; tom?: number[] }>;
}
// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/chao.json */ {} as DadosChao;

/** Brilho de qualidade: raio do anel em relação ao tamanho do item, espessura e pulsação. */
const BRILHO = { raio: 0.55, min: 7, esp: 0.18, pulso: 0.07 };

const CACHE = {
  gl: null as WebGL2RenderingContext | null,
  malhas: {} as Record<string, GLMesh | null>,
  anel: null as GLMesh | null,
  anelFino: null as GLMesh | null,
};

export function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
function confereGL() {
  if (CACHE.gl !== GL3.gl) {
    CACHE.gl = GL3.gl;
    CACHE.malhas = {};
    CACHE.anel = null;
    CACHE.anelFino = null;
  }
}

/** A malha do item no chão (espaço do mundo, base em y=0), ou null se ele não tem modelo novo. */
export function malhaChao(key: string): GLMesh | null {
  confereGL();
  if (key in CACHE.malhas) return CACHE.malhas[key];
  const b = itemCru(key);
  if (!b) return (CACHE.malhas[key] = null);
  const m = glMesh(b);
  m.ol = true;
  return (CACHE.malhas[key] = m);
}

/** v8.1 — os itens com modelo, para a biblioteca do Modo Editor. */
export function itensChao() {
  return Object.keys(DADOS.itens || {});
}
/** A malha crua do item (espaço do mundo, base em y=0), ou null sem modelo. */
export function itemCru(key: string) {
  const it = DADOS.itens && DADOS.itens[key],
    pc = it && DADOS.pecas[it.peca];
  if (!it || !pc) return null;
  const P = new Int16Array(bytes(pc.p).buffer),
    C = bytes(pc.c),
    k = it.tam / 20000,
    tom = it.tom,
    b = MB();
  for (let t = 0; t < P.length / 9; t++) {
    const v = [0, 1, 2].map((j) => [P[t * 9 + j * 3] * k, P[t * 9 + j * 3 + 1] * k, P[t * 9 + j * 3 + 2] * k]);
    const u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]],
      w = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((x) => x / l);
    const cor = [0, 1, 2].map((e) => {
      const c = C[t * 3 + e] / 255;
      return tom ? c * (1 - tom[3]) + tom[e] * tom[3] : c;
    });
    for (const q of v) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(n[0], n[1], n[2]);
      b.c.push(cor[0], cor[1], cor[2]);
    }
  }
  return b;
}

/** Tamanho do item no chão (maior medida, unidades do mundo). */
function tamChao(key: string) {
  return (DADOS.itens && DADOS.itens[key] && DADOS.itens[key].tam) || 10;
}

/** O anel do brilho de qualidade (raio 1, no chão), branco: a cor vem do tint. */
export function anelChao(fino = false): GLMesh {
  confereGL();
  const chave = fino ? "anelFino" : "anel";
  if (CACHE[chave]) return CACHE[chave];
  const b = MB(),
    N = 28,
    r0 = 1 - (fino ? 0.045 : BRILHO.esp),
    y = 0.25;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2,
      a2 = ((i + 1) / N) * Math.PI * 2;
    const p = (r: number, ang: number) => [Math.cos(ang) * r, y, Math.sin(ang) * r];
    const A = p(r0, a),
      B = p(1, a),
      Cc = p(1, a2),
      D = p(r0, a2);
    for (const q of [A, Cc, B, A, D, Cc]) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(0, 1, 0);
      b.c.push(1, 1, 1);
    }
  }
  return (CACHE[chave] = glMesh(b));
}

/** Anel no chão com raio e espessura de verdade (unidades do mundo), sem escala: a linha fica fina em qualquer raio
 *  (o alcance do Alt). Guardado por raio inteiro. */
export function anelLinha(raio: number, esp = 1.2): GLMesh {
  confereGL();
  const r = Math.max(2, Math.round(raio)),
    chave = "linha:" + r + ":" + esp;
  const pronto = CACHE.malhas[chave];
  if (pronto) return pronto;
  const b = MB(),
    N = Math.min(160, Math.max(48, Math.round(r / 3))),
    r0 = r - esp,
    y = 0.3;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2,
      a2 = ((i + 1) / N) * Math.PI * 2;
    const p = (rr: number, ang: number) => [Math.cos(ang) * rr, y, Math.sin(ang) * rr];
    const A = p(r0, a),
      B = p(r, a),
      Cc = p(r, a2),
      D = p(r0, a2);
    for (const q of [A, Cc, B, A, D, Cc]) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(0, 1, 0);
      b.c.push(1, 1, 1);
    }
  }
  return (CACHE.malhas[chave] = glMesh(b));
}

/** Raio do anel de um item, com a pulsação (t em segundos). */
export function raioBrilho(key: string, t: number) {
  return Math.max(BRILHO.min, tamChao(key) * BRILHO.raio) * (1 + BRILHO.pulso * Math.sin(t * 3));
}
