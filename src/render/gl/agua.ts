/* ==== v8.0 — a água do campo aberto como superfície de verdade (mantenedor 2026-10-25: "a água também não tem nenhum
   atrativo") ====
   Antes a água era o chão afundado e pintado de azul. Agora o chão vira o leito (areia molhada que escurece no fundo) e
   por cima vai uma lâmina translúcida no NÍVEL, desenhada depois da cena opaca (glFrame → desenharAgua), com shader
   próprio: cor do raso ao fundo pela profundidade do leito, ondinhas que se mexem, reflexo do sol cintilando, linhas
   claras de marola e espuma na beira (onde a lâmina encontra a margem). A malha de cada bloco (mundo_cena.ts) leva por
   vértice a profundidade e a espuma; o resto sai do shader. Sem WebGL (testes em Node) nada disso roda. ==== */
import { GL3 } from "../../core/state.ts";
import type { GLMesh, MalhaCrua } from "../../core/tipos.ts";
import type { Mat4 } from "./geometria.ts";

/** nivel: altura da lâmina (px; o chão firme fica em ~0 na beira); raso/fundo: cores; alfa: [raso, fundo];
 *  onda: altura (px) e velocidade das ondinhas; brilho: força do reflexo do sol; marola: força das linhas claras;
 *  espuma: força e cor da espuma da beira. */
export const AGUA = {
  nivel: -1.4,
  raso: [0.42, 0.72, 0.74],
  fundo: [0.13, 0.36, 0.5],
  alfa: [0.42, 0.86],
  onda: { alt: 0.22, vel: 1.0 },
  brilho: 0.75,
  marola: 0.3,
  espuma: { forca: 1, cor: [0.95, 0.98, 1] },
};

const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=2) in vec3 aC;
uniform mat4 uVP, uM; uniform float uT, uOnda, uVel;
out vec3 vW; out vec3 vC;
void main(){
  vec4 w = uM * vec4(aP, 1.0);
  float t = uT * uVel;
  w.y += (sin(w.x * 0.045 + t * 1.3) * 0.6 + sin(w.z * 0.061 - t * 1.05) * 0.4) * uOnda;
  vW = w.xyz; vC = aC; gl_Position = uVP * w;
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vC;
uniform float uT, uVel, uBrilho, uMarola, uEspuma; uniform vec3 uRaso, uFundo, uEspCor, uLd, uVD, uNoite; uniform vec2 uAlfa;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
void main(){
  float t = uT * uVel, prof = clamp(vC.r, 0.0, 1.0), esp = clamp(vC.g, 0.0, 1.0);
  vec2 p = vW.xz;
  // normal da superfície: duas camadas de ruído que escorrem em direções diferentes
  float e = 1.5;
  float a0 = vn(p * 0.035 + vec2(t * 0.11, t * 0.07)) + 0.5 * vn(p * 0.09 - vec2(t * 0.16, -t * 0.05));
  float ax = vn((p + vec2(e, 0)) * 0.035 + vec2(t * 0.11, t * 0.07)) + 0.5 * vn((p + vec2(e, 0)) * 0.09 - vec2(t * 0.16, -t * 0.05));
  float az = vn((p + vec2(0, e)) * 0.035 + vec2(t * 0.11, t * 0.07)) + 0.5 * vn((p + vec2(0, e)) * 0.09 - vec2(t * 0.16, -t * 0.05));
  vec3 n = normalize(vec3((a0 - ax) * 2.2, 1.0, (a0 - az) * 2.2));
  vec3 L = -normalize(uLd), V = normalize(uVD);
  vec3 col = mix(uRaso, uFundo, smoothstep(0.0, 1.0, prof));
  // céu refletido (mais claro de lado) e sol
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  col = mix(col, vec3(0.78, 0.88, 0.95), fres * 0.35);
  float sol = pow(max(dot(reflect(-L, n), V), 0.0), 60.0);
  // cintilado: pontinhos que acendem e apagam (ruído fino rápido), mais onde o reflexo do sol bate
  float cint = smoothstep(0.93, 0.99, vn(p * 0.5 + vec2(t * 0.9, -t * 0.7)) * vn(p * 0.23 - vec2(t * 0.4, t * 0.3)) * 1.6)
    * (0.35 + 0.65 * pow(max(dot(reflect(-L, n), V), 0.0), 3.0));
  col += vec3(1.0, 0.96, 0.85) * (sol * uBrilho + cint * uBrilho * 0.8);
  // marola: tracinhos claros e curtos que andam devagar (a onda recortada por manchas de ruído, não linhas inteiras)
  float m = sin((p.x * 0.7 + p.y) * 0.11 + t * 1.4 + vn(p * 0.03) * 5.0);
  float corte = smoothstep(0.55, 0.75, vn(p * 0.045 + vec2(-t * 0.05, t * 0.04)));
  col += vec3(1.0) * smoothstep(0.965, 1.0, m) * corte * uMarola * (0.4 + 0.6 * prof);
  // espuma na beira: faixa que pulsa, recortada por ruído
  float pul = 0.5 + 0.5 * sin(t * 1.6 - esp * 4.0);
  float fe = esp * smoothstep(0.35, 0.75, vn(p * 0.18 + vec2(t * 0.2, 0.0)) * 0.6 + pul * 0.5);
  col = mix(col, uEspCor, clamp(fe * uEspuma, 0.0, 1.0));
  float a = mix(uAlfa.x, uAlfa.y, prof);
  a = max(a, fe * uEspuma * 0.9);
  o = vec4(col * uNoite, a);
}`;

interface ProgAgua {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}
let PROG: ProgAgua | null = null;
function programa(gl: WebGL2RenderingContext) {
  if (PROG && PROG.gl === gl) return PROG;
  const mk = (t: number, s: string) => {
    const sh = gl.createShader(t)!;
    gl.shaderSource(sh, s);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)!);
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)!);
  const u: ProgAgua["u"] = {};
  for (const n of [
    "uVP",
    "uM",
    "uT",
    "uOnda",
    "uVel",
    "uBrilho",
    "uMarola",
    "uEspuma",
    "uRaso",
    "uFundo",
    "uEspCor",
    "uLd",
    "uVD",
    "uNoite",
    "uAlfa",
  ])
    u[n] = gl.getUniformLocation(prog, n);
  return (PROG = { gl, prog, u });
}

/** A malha da lâmina de um bloco: posição (local do bloco) e, no lugar da cor, [profundidade, espuma, 0]. */
export function malhaAgua(b: MalhaCrua): GLMesh | null {
  const gl = GL3.gl;
  if (!gl || !b.p.length) return null;
  const vao = gl.createVertexArray()!,
    bufs: WebGLBuffer[] = [];
  gl.bindVertexArray(vao);
  for (const [loc, arr] of [
    [0, b.p],
    [2, b.c],
  ] as const) {
    const buf = gl.createBuffer()!;
    bufs.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  }
  gl.bindVertexArray(null);
  return { vao, n: b.p.length / 3, bufs };
}

/** As lâminas do quadro (mundo_cena.ts empurra junto com os blocos; glFrame desenha e esvazia). */
const LISTA: { mesh: GLMesh; M: Mat4 }[] = [];
export function aguaPush(mesh: GLMesh, M: Mat4) {
  LISTA.push({ mesh, M });
}

/** Desenha as lâminas por cima da cena opaca (depois de glRender): translúcidas, sem escrever profundidade. `vd`: a
 *  direção para a câmera; `noite`: a luz da hora. */
export function desenharAgua(VP: Mat4, Ld: number[], vd: number[], noite: number[]) {
  const gl = GL3.gl;
  if (!gl || !LISTA.length) {
    LISTA.length = 0;
    return;
  }
  const P = programa(gl),
    u = P.u,
    A = AGUA;
  gl.useProgram(P.prog);
  gl.uniformMatrix4fv(u.uVP, false, VP);
  gl.uniform1f(u.uT, performance.now() / 1000);
  gl.uniform1f(u.uOnda, A.onda.alt);
  gl.uniform1f(u.uVel, A.onda.vel);
  gl.uniform1f(u.uBrilho, A.brilho);
  gl.uniform1f(u.uMarola, A.marola);
  gl.uniform1f(u.uEspuma, A.espuma.forca);
  gl.uniform3fv(u.uRaso, A.raso);
  gl.uniform3fv(u.uFundo, A.fundo);
  gl.uniform3fv(u.uEspCor, A.espuma.cor);
  gl.uniform3fv(u.uLd, Ld);
  gl.uniform3fv(u.uVD, vd);
  gl.uniform3fv(u.uNoite, noite);
  gl.uniform2fv(u.uAlfa, A.alfa);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  for (const it of LISTA) {
    gl.uniformMatrix4fv(u.uM, false, it.M);
    gl.bindVertexArray(it.mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, it.mesh.n);
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
  LISTA.length = 0;
}
