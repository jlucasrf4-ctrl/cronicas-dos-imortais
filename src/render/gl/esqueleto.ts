/* ==== v7.7 — esqueleto animado: decodifica um modelo com animações (src/assets/models/heroina_anim.json, gerado por
   tools/gerar-animacoes.ts) e deforma a malha (skinning linear na CPU, ~2,4 mil vértices). Só matemática: sem WebGL
   nem DOM (o desenho fica em heroina_anim.ts). Matrizes 4×4 em coluna, como as do resto do renderer. ==== */

/** O JSON como o conversor grava. */
export interface DadosAnim {
  versao: number;
  juntas: string[];
  pais: number[];
  repouso: number[][]; // translação local de cada junta (unidades do .glb); a da raiz vem do clip
  raiz: number[]; // matriz acima da raiz: .glb → jogo (escala e eixos)
  ibm: number[][]; // inversa de bind de cada junta, já com a volta do espaço do jogo
  /** uv (v8.0, opcional): coordenadas de textura por canto de triângulo, Uint16 × 65535 */
  malha: { p: string; j: string; w: string; i: string; c: string; uv?: string };
  clips: Record<string, { fps: number; n: number; r: string; q: string }>;
  marcas?: Record<string, number[]>; // v7.7: pontos do modelo em unidades do jogo (o tamanduá: "sela", "boca")
  /** v8.0: a textura (data URL), com malha.uv: a pintura da pele das deusas (tools/juntar-vestidos.ts) */
  tex?: string;
  /** Referência à textura compartilhada no pacote; resolvida pelo carregador dos personagens. */
  texDe?: string;
  /** Triângulos do corpo cobertos pela peça: posições Int16 ×64, nove números por triângulo. */
  coberturaCorpo?: string;
}
interface ClipAnim {
  fps: number;
  n: number;
  r: Float32Array; // n × juntas × 4 (quatérnio local)
  q: Float32Array; // n × 3 (translação local da raiz)
}
export interface Anim {
  juntas: string[];
  pais: number[];
  repouso: Float32Array;
  raiz: Float32Array;
  ibm: Float32Array;
  P: Float32Array; // posições de bind (jogo)
  J: Uint8Array;
  W: Float32Array;
  I: Uint16Array;
  C: Float32Array; // cor por triângulo (0..1)
  clips: Record<string, ClipAnim>;
  /** cantos (índice no array de triângulos) de cada vértice soldado, em CSR: cantos[ini[v] .. ini[v+1]) */
  ini: Uint32Array;
  cantos: Uint32Array;
  /** v8.0: coordenadas de textura por canto (6 por triângulo) e a imagem (data URL); sem elas, só a cor por face */
  UV?: Float32Array;
  tex?: string;
}
/** Pose: rotação local de cada junta + translação da raiz. */
export interface Pose {
  r: Float32Array;
  q: Float32Array;
}
/** Matrizes de uma pose: globais de cada junta (espaço do jogo) e de skinning (global × inversa de bind). */
export interface MatrizesPose {
  glob: Float32Array;
  skin: Float32Array;
}
/** Malha deformada, como o renderer usa: 3 vértices por triângulo. */
export interface MalhaDeformada {
  p: Float32Array;
  n: Float32Array; // normal da face
  c: Float32Array;
}

function bytes(b64: string) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export function decodificarAnim(d: DadosAnim): Anim {
  const P16 = new Int16Array(bytes(d.malha.p).buffer),
    W8 = bytes(d.malha.w),
    C8 = bytes(d.malha.c),
    I = new Uint16Array(bytes(d.malha.i).buffer);
  const nv = P16.length / 3;
  const ini = new Uint32Array(nv + 1);
  for (let k = 0; k < I.length; k++) ini[I[k] + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const cantos = new Uint32Array(I.length),
    pos = ini.slice(0, nv);
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  const clips: Record<string, ClipAnim> = {};
  for (const [nome, c] of Object.entries(d.clips)) {
    const R = new Int16Array(bytes(c.r).buffer),
      Q = new Int16Array(bytes(c.q).buffer);
    clips[nome] = {
      fps: c.fps,
      n: c.n,
      r: Float32Array.from(R, (v) => v / 32767),
      q: Float32Array.from(Q, (v) => v / 10000),
    };
  }
  return {
    juntas: d.juntas,
    pais: d.pais,
    repouso: Float32Array.from(d.repouso.flat()),
    raiz: Float32Array.from(d.raiz),
    ibm: Float32Array.from(d.ibm.flat()),
    P: Float32Array.from(P16, (v) => v / 64),
    J: bytes(d.malha.j),
    W: Float32Array.from(W8, (v) => v / 255),
    I,
    C: Float32Array.from(C8, (v) => v / 255),
    clips,
    ini,
    cantos,
    UV: d.malha.uv ? Float32Array.from(new Uint16Array(bytes(d.malha.uv).buffer), (v) => v / 65535) : undefined,
    tex: d.tex,
  };
}

export function novaPose(A: Anim): Pose {
  return { r: new Float32Array(A.juntas.length * 4), q: new Float32Array(3) };
}

/** Duração de um clip, em segundos (de laço: até o último quadro, que repete o primeiro). */
export function duracaoClip(A: Anim, nome: string) {
  const c = A.clips[nome];
  return c ? (c.n - 1) / c.fps : 0;
}

/** Pose do clip no tempo t (laço: dá a volta; senão, para no último quadro). Interpola entre quadros. */
export function poseClip(A: Anim, nome: string, t: number, laco: boolean, saida?: Pose): Pose {
  const c = A.clips[nome],
    o = saida ?? novaPose(A),
    nj = A.juntas.length;
  if (!c) return o;
  let f = t * c.fps;
  if (c.n <= 1) f = 0;
  else if (laco) {
    const per = c.n - 1;
    f = ((f % per) + per) % per;
  } else f = Math.max(0, Math.min(c.n - 1, f));
  const a = Math.floor(f),
    b = Math.min(c.n - 1, a + 1),
    w = f - a;
  for (let j = 0; j < nj; j++) {
    const ia = (a * nj + j) * 4,
      ib = (b * nj + j) * 4;
    const s =
      c.r[ia] * c.r[ib] + c.r[ia + 1] * c.r[ib + 1] + c.r[ia + 2] * c.r[ib + 2] + c.r[ia + 3] * c.r[ib + 3] < 0
        ? -1
        : 1;
    let l = 0;
    for (let k = 0; k < 4; k++) {
      const v = c.r[ia + k] * (1 - w) + c.r[ib + k] * w * s;
      o.r[j * 4 + k] = v;
      l += v * v;
    }
    l = Math.sqrt(l) || 1;
    for (let k = 0; k < 4; k++) o.r[j * 4 + k] /= l;
  }
  for (let k = 0; k < 3; k++) o.q[k] = c.q[a * 3 + k] * (1 - w) + c.q[b * 3 + k] * w;
  return o;
}

/** Mistura duas poses (f = 0: a; 1: b), em `saida` (pode ser a própria `a`). */
export function misturarPoses(a: Pose, b: Pose, f: number, saida: Pose): Pose {
  for (let j = 0; j < a.r.length; j += 4) {
    const s =
      a.r[j] * b.r[j] + a.r[j + 1] * b.r[j + 1] + a.r[j + 2] * b.r[j + 2] + a.r[j + 3] * b.r[j + 3] < 0 ? -1 : 1;
    let l = 0;
    for (let k = 0; k < 4; k++) {
      const v = a.r[j + k] * (1 - f) + b.r[j + k] * f * s;
      saida.r[j + k] = v;
      l += v * v;
    }
    l = Math.sqrt(l) || 1;
    for (let k = 0; k < 4; k++) saida.r[j + k] /= l;
  }
  for (let k = 0; k < 3; k++) saida.q[k] = a.q[k] * (1 - f) + b.q[k] * f;
  return saida;
}

/** v8.0 — gira a junta j da pose em `ang` rad em volta de `eixo` (espaço do jogo), com as matrizes `m` da mesma pose:
 *  a rotação vai para o espaço do pai (Rᵀ·eixo; o ângulo troca de sinal se a matriz do pai espelha) e multiplica a
 *  local. As matrizes ficam velhas: quem chama refaz com matrizesPose. */
export function girarJunta(A: Anim, pose: Pose, m: MatrizesPose, j: number, eixo: number[], ang: number) {
  const p = A.pais[j],
    G = p < 0 ? A.raiz : m.glob.subarray(p * 16, p * 16 + 16),
    det =
      G[0] * (G[5] * G[10] - G[9] * G[6]) - G[4] * (G[1] * G[10] - G[9] * G[2]) + G[8] * (G[1] * G[6] - G[5] * G[2]);
  let ax = G[0] * eixo[0] + G[1] * eixo[1] + G[2] * eixo[2],
    ay = G[4] * eixo[0] + G[5] * eixo[1] + G[6] * eixo[2],
    az = G[8] * eixo[0] + G[9] * eixo[1] + G[10] * eixo[2];
  const l = Math.hypot(ax, ay, az);
  if (l < 1e-9) return;
  ax /= l;
  ay /= l;
  az /= l;
  const h = ((det < 0 ? -1 : 1) * ang) / 2,
    s = Math.sin(h),
    qx = ax * s,
    qy = ay * s,
    qz = az * s,
    qw = Math.cos(h),
    r = pose.r,
    i = j * 4,
    [lx, ly, lz, lw] = [r[i], r[i + 1], r[i + 2], r[i + 3]];
  r[i] = qw * lx + qx * lw + qy * lz - qz * ly;
  r[i + 1] = qw * ly - qx * lz + qy * lw + qz * lx;
  r[i + 2] = qw * lz + qx * ly - qy * lx + qz * lw;
  r[i + 3] = qw * lw - qx * lx - qy * ly - qz * lz;
}

/** o = a·b (4×4 em coluna), com deslocamentos nos arrays. */
function mul(o: Float32Array, oi: number, a: Float32Array, ai: number, b: Float32Array, bi: number) {
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[oi + c * 4 + r] =
        a[ai + r] * b[bi + c * 4] +
        a[ai + 4 + r] * b[bi + c * 4 + 1] +
        a[ai + 8 + r] * b[bi + c * 4 + 2] +
        a[ai + 12 + r] * b[bi + c * 4 + 3];
}

const _L = new Float32Array(16);
/** Matrizes globais e de skinning da pose (as juntas vêm em ordem de pai antes de filho). */
export function matrizesPose(A: Anim, pose: Pose, saida?: MatrizesPose): MatrizesPose {
  const nj = A.juntas.length,
    o = saida ?? { glob: new Float32Array(nj * 16), skin: new Float32Array(nj * 16) };
  for (let j = 0; j < nj; j++) {
    const x = pose.r[j * 4],
      y = pose.r[j * 4 + 1],
      z = pose.r[j * 4 + 2],
      w = pose.r[j * 4 + 3];
    _L[0] = 1 - 2 * (y * y + z * z);
    _L[1] = 2 * (x * y + z * w);
    _L[2] = 2 * (x * z - y * w);
    _L[3] = 0;
    _L[4] = 2 * (x * y - z * w);
    _L[5] = 1 - 2 * (x * x + z * z);
    _L[6] = 2 * (y * z + x * w);
    _L[7] = 0;
    _L[8] = 2 * (x * z + y * w);
    _L[9] = 2 * (y * z - x * w);
    _L[10] = 1 - 2 * (x * x + y * y);
    _L[11] = 0;
    const t = j === 0 ? pose.q : A.repouso.subarray(j * 3, j * 3 + 3);
    _L[12] = t[0];
    _L[13] = t[1];
    _L[14] = t[2];
    _L[15] = 1;
    const p = A.pais[j];
    if (p < 0) mul(o.glob, j * 16, A.raiz, 0, _L, 0);
    else mul(o.glob, j * 16, o.glob, p * 16, _L, 0);
    mul(o.skin, j * 16, o.glob, j * 16, A.ibm, j * 16);
  }
  return o;
}

/** Deforma a malha (vértices soldados) e devolve os triângulos com normal de face e cor. */
export function deformarMalha(A: Anim, m: MatrizesPose, saida?: MalhaDeformada, _V?: Float32Array): MalhaDeformada {
  const nv = A.P.length / 3,
    nt = A.I.length / 3;
  const V = _V ?? new Float32Array(nv * 3);
  const o = saida ?? { p: new Float32Array(nt * 9), n: new Float32Array(nt * 9), c: new Float32Array(nt * 9) };
  const S = m.skin;
  for (let v = 0; v < nv; v++) {
    const x = A.P[v * 3],
      y = A.P[v * 3 + 1],
      z = A.P[v * 3 + 2];
    let ox = 0,
      oy = 0,
      oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = A.W[v * 4 + k];
      if (!w) continue;
      const b = A.J[v * 4 + k] * 16;
      ox += w * (S[b] * x + S[b + 4] * y + S[b + 8] * z + S[b + 12]);
      oy += w * (S[b + 1] * x + S[b + 5] * y + S[b + 9] * z + S[b + 13]);
      oz += w * (S[b + 2] * x + S[b + 6] * y + S[b + 10] * z + S[b + 14]);
    }
    V[v * 3] = ox;
    V[v * 3 + 1] = oy;
    V[v * 3 + 2] = oz;
  }
  for (let t = 0; t < nt; t++) {
    const a = A.I[t * 3] * 3,
      b = A.I[t * 3 + 1] * 3,
      c = A.I[t * 3 + 2] * 3;
    const ux = V[b] - V[a],
      uy = V[b + 1] - V[a + 1],
      uz = V[b + 2] - V[a + 2],
      wx = V[c] - V[a],
      wy = V[c + 1] - V[a + 1],
      wz = V[c + 2] - V[a + 2];
    let nx = uy * wz - uz * wy,
      ny = uz * wx - ux * wz,
      nz = ux * wy - uy * wx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (let k = 0; k < 3; k++) {
      const i = t * 9 + k * 3,
        s = A.I[t * 3 + k] * 3;
      o.p[i] = V[s];
      o.p[i + 1] = V[s + 1];
      o.p[i + 2] = V[s + 2];
      o.n[i] = nx;
      o.n[i + 1] = ny;
      o.n[i + 2] = nz;
      o.c[i] = A.C[t * 3];
      o.c[i + 1] = A.C[t * 3 + 1];
      o.c[i + 2] = A.C[t * 3 + 2];
    }
  }
  return o;
}

/**
 * Normais suaves por canto, como glSmoothNormals (render/gl/estilo.ts) faz na carga, mas por quadro e usando a
 * solda da malha: NS = média das faces do vértice com ângulo pequeno (luz); HS = média de todas (contorno).
 */
export function normaisSuaves(
  A: Pick<Anim, "ini" | "cantos">,
  n: Float32Array,
  cosLimite: number,
  NS: Float32Array,
  HS: Float32Array,
) {
  const nv = A.ini.length - 1;
  for (let v = 0; v < nv; v++) {
    const i0 = A.ini[v],
      i1 = A.ini[v + 1];
    let hx = 0,
      hy = 0,
      hz = 0;
    for (let a = i0; a < i1; a++) {
      const k = A.cantos[a] * 3;
      hx += n[k];
      hy += n[k + 1];
      hz += n[k + 2];
    }
    const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
    for (let a = i0; a < i1; a++) {
      const k = A.cantos[a] * 3;
      HS[k] = hx / hl;
      HS[k + 1] = hy / hl;
      HS[k + 2] = hz / hl;
      let sx = 0,
        sy = 0,
        sz = 0;
      for (let b = i0; b < i1; b++) {
        const q = A.cantos[b] * 3;
        if (n[k] * n[q] + n[k + 1] * n[q + 1] + n[k + 2] * n[q + 2] > cosLimite) {
          sx += n[q];
          sy += n[q + 1];
          sz += n[q + 2];
        }
      }
      const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      NS[k] = sx / sl;
      NS[k + 1] = sy / sl;
      NS[k + 2] = sz / sl;
    }
  }
}

/** Matriz global (16 números, espaço do jogo) de uma junta pelo nome, ou null. */
export function juntaGlobal(A: Anim, m: MatrizesPose, nome: string) {
  const j = A.juntas.indexOf(nome);
  return j < 0 ? null : m.glob.subarray(j * 16, j * 16 + 16);
}
