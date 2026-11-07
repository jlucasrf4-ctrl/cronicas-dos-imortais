/* ==== v7.7 — heroína low poly: o modelo 3D da aventureira (Tripo) reduzido para ~4,8 mil triângulos ====
   src/assets/models/heroina.json: tronco (com a cabeça de alta qualidade), braço e perna direitos/esquerdos, cada um
   no espaço da sua articulação (perna: quadril em (0, 15, ±2,8); braço: ombro em (0, ombroY, ±ombroZ)), frente +x.
   Posições em Int16 (×64), 3 vértices por triângulo, e uma cor RGB por triângulo, em base64. */
import { glMesh } from "./malhas.ts";
import type { GLMesh, MalhaCrua } from "../../core/tipos.ts";

interface DadosHeroina {
  versao: number;
  ombroY: number;
  ombroZ: number;
  mao: [number, number, number]; // centro da mão direita, no espaço do braço
  partes: Record<string, { p: string; c: string }>;
}
// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/heroina.json */ {} as DadosHeroina;

/** Articulações da heroína (sem o JSON, as do herói antigo). */
export const HEROINA = {
  ombroY: DADOS.ombroY ?? 28,
  ombroZ: DADOS.ombroZ ?? 7.6,
  mao: DADOS.mao ?? ([0, -12, 0] as [number, number, number]),
};
/** v8.0 — o centro do escudo (P.escudo, glBuildMisc em modelos.ts) no espaço do braço esquerdo da heroína de peças:
    8,5 abaixo do ombro, na linha da mão. A heroína animada usa para pôr o centro no meio do antebraço. */
export function centroEscudo() {
  const f = 8.5 / -HEROINA.mao[1];
  return [1.2 + HEROINA.mao[0] * f, -8.5, -1.2 - HEROINA.mao[2] * f];
}

function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
const _cruas: Record<string, MalhaCrua> = {};
function malhaCrua(nome: string): MalhaCrua {
  if (_cruas[nome]) return _cruas[nome];
  const pt = DADOS.partes[nome],
    P = new Int16Array(bytes(pt.p).buffer),
    C = bytes(pt.c),
    b: MalhaCrua = { p: [], n: [], c: [] };
  for (let t = 0; t < P.length / 9; t++) {
    const v = [0, 1, 2].map((k) => [P[t * 9 + k * 3] / 64, P[t * 9 + k * 3 + 1] / 64, P[t * 9 + k * 3 + 2] / 64]);
    const ux = v[1][0] - v[0][0],
      uy = v[1][1] - v[0][1],
      uz = v[1][2] - v[0][2],
      wx = v[2][0] - v[0][0],
      wy = v[2][1] - v[0][1],
      wz = v[2][2] - v[0][2];
    let nx = uy * wz - uz * wy,
      ny = uz * wx - ux * wz,
      nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const q of v) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(nx, ny, nz);
      b.c.push(C[t * 3] / 255, C[t * 3 + 1] / 255, C[t * 3 + 2] / 255);
    }
  }
  return (_cruas[nome] = b);
}

/** As peças da heroína como malhas WebGL (tronco, braços e pernas direitos/esquerdos). */
export function glBuildHeroina(): Record<string, GLMesh> {
  return {
    torsoH: glMesh(malhaCrua("torso")),
    bracoD: glMesh(malhaCrua("bracoD")),
    bracoE: glMesh(malhaCrua("bracoE")),
    pernaD: glMesh(malhaCrua("pernaD")),
    pernaE: glMesh(malhaCrua("pernaE")),
  };
}
