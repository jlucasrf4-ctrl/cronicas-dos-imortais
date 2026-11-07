/* ==== v8.0 — as armas desenhadas (src/assets/models/armas.json, de tools/gerar-armas.ts: a folha do GPT inflada em 3D) ====
   Mantenedor 2026-10-25: "o modelo das armas melee estão bem feios, nada parecido com o jogo atual". Cada arma vem no
   espaço da mão do jogo (a mesma orientação e o mesmo tamanho das malhas feitas por código que ela substitui: ao longo
   de +x, cabo na origem; o arco em pé ao longo de y; o escudo de frente em x/y). Sem os dados (testes em Node) as
   malhas antigas continuam. Normais suaves (média pelos triângulos em volta de cada vértice). ==== */
import { MB, glMesh } from "./malhas.ts";
import { M4, type Mat4 } from "./geometria.ts";
import { GL3 } from "../../core/state.ts";
import type { GLMesh } from "../../core/tipos.ts";

interface ArmaDados {
  p: string;
  i: string;
  c: string;
}
// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/armas.json */ {} as Record<string, ArmaDados>;

/** O escudo guardado nas costas: deitado de frente para trás (a espessura em x, a face de dentro perto de x = −5,6, a
    altura das costas), no tamanho do disco antigo (raio 5,5 em vez de 6,3). */
export const ESCUDO_COSTAS = M4.ch(M4.T(-6.2, 24, 0), M4.RY(Math.PI / 2), M4.S(5.5 / 6.3));
/** Brilho das cores do desenho (a luz do jogo escurece a cor do vértice). */
const ARMAS3D = { luz: 1.15 };

function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

/** A malha da arma `nome` (chave do item, "eq_espada"…), com `M` aplicada; null sem os dados. `chave` null = sem
    cache: as peças da heroína (glBuildMisc) são liberadas quando ela troca de equipamento — uma malha do cache liberada
    ali deixava o VAO apagado no cache, e a placa reaproveitava o número para outra arma (cópias da arma na mão). */
export function armaModelo(nome: string, M: Mat4 | null = null, chave: string | null = nome): GLMesh | null {
  const id = "a3_" + chave;
  if (chave && GL3.mesh[id]) return GL3.mesh[id];
  const d = DADOS[nome];
  if (!d) return null;
  const P = new Int16Array(bytes(d.p)),
    I = new Uint16Array(bytes(d.i)),
    C = new Uint8Array(bytes(d.c)),
    nv = P.length / 3;
  const pos = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const q = [P[v * 3] / 100, P[v * 3 + 1] / 100, P[v * 3 + 2] / 100];
    const r = M ? M4.ap(M, q[0], q[1], q[2]) : q;
    pos.set(r, v * 3);
  }
  const nor = new Float32Array(nv * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3,
      b = I[t + 1] * 3,
      c = I[t + 2] * 3;
    const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]],
      w = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const k of [a, b, c]) for (let e = 0; e < 3; e++) nor[k + e] += n[e];
  }
  const b = MB();
  for (let t = 0; t < I.length; t++) {
    const k = I[t] * 3,
      l = Math.hypot(nor[k], nor[k + 1], nor[k + 2]) || 1;
    b.p.push(pos[k], pos[k + 1], pos[k + 2]);
    b.n.push(nor[k] / l, nor[k + 1] / l, nor[k + 2] / l);
    b.c.push(...[0, 1, 2].map((e) => Math.min(1, (C[k + e] / 255) * ARMAS3D.luz)));
  }
  const m = glMesh(b);
  m.ol = true;
  if (chave) GL3.mesh[id] = m;
  return m;
}

/** Os vértices da arma `nome` (com `M` aplicada), para medir encostos (heroina_anim.ts); null sem os dados. */
export function armaPontos(nome: string, M: Mat4 | null = null): number[][] | null {
  const d = DADOS[nome];
  if (!d) return null;
  const P = new Int16Array(bytes(d.p)),
    out: number[][] = [];
  for (let v = 0; v < P.length; v += 3) {
    const q = [P[v] / 100, P[v + 1] / 100, P[v + 2] / 100];
    out.push(M ? M4.ap(M, q[0], q[1], q[2]) : q);
  }
  return out;
}
/** As pontas do arco `nome` (onde a corda prende): [x, y] de cima e de baixo, no espaço da mão; null sem os dados. */
export function pontasArco(nome: string): [number[], number[]] | null {
  const pts = armaPontos(nome);
  if (!pts) return null;
  let cima = pts[0],
    baixo = pts[0];
  for (const p of pts) {
    if (p[1] > cima[1]) cima = p;
    if (p[1] < baixo[1]) baixo = p;
  }
  return [
    [cima[0], cima[1] - 0.6],
    [baixo[0], baixo[1] + 0.6],
  ];
}
