/* ==== v7.7 — vinheta de abertura da Voidd World: o Voodi é sugado por um buraco negro que vira o O do logotipo ====
   Toca uma vez ao abrir o jogo, por cima da tela de título (src/inicio/modulos/v7.7_voidd.ts); clique, toque ou tecla
   pula. Enquanto o script carrega, quem cobre a tela é a capa só de CSS (src/styles/48_v7.7_voidd.css); o primeiro
   quadro da vinheta tira a capa (html.voidd-pronto).
   Cena em three.js (só aqui; o jogo usa o próprio WebGL), tudo função do tempo t (0..VINHETA.dur):
     0–2 s     o Voodi entra flutuando, olha em volta (olhos próprios: sacadas, piscadas)
     3,4–5,2 s o buraco negro abre à direita; ele percebe, leva um susto
     5,5–7 s   é puxado: inclina para trás, a cauda escorre para o buraco, nada para trás
     7–9,5 s   espiral para dentro (estica, encolhe, faíscas); clarão
     10–13 s   o disco vira de frente e vira o portal (o O); o V, o IDD e — WORLD — aparecem em HTML presos a ele
     13+ s     os olhos do Voodi aparecem dentro do O e seguem o cursor
   Modelo: src/assets/models/voodi.json (tools/gerar-voodi.ts). O, V e IDD: arte do GPT (src/assets/art/voidd_*.webp,
   tools/gerar-voidd-letras.ts); WORLD em Montserrat embutida. Cor e luz no modo antigo do three.js (sem gestão de
   cor; luzes × π), que é como a vinheta foi aprovada. */
import * as THREE from "three";
import { musicStart } from "../audio/som.ts";

interface ModeloVoodi {
  p: number[];
  n: number[];
  uv: number[];
  i: number[];
  cab: number[];
  olhos: { c: number[]; r: number[] }[];
  cor: string;
  normal: string;
}
const VOODI = /* @inline-json src/assets/models/voodi.json */ {} as ModeloVoodi;
/** O (portal), V e IDD da arte do logotipo (tools/gerar-voidd-letras.ts): furo e borda do O em frações do meio lado
    da imagem; caixa só das letras no V e no IDD (sem a fumaça), em frações da imagem. */
const LETRAS = /* @inline-json src/assets/art/voidd_letras.json */ {} as {
  o: { furo: number; borda: number };
  v: { glifo: [number, number, number, number] };
  idd: { glifo: [number, number, number, number] };
};
const ARTE_O = "/src/assets/art/voidd_o.webp",
  ARTE_V = "/src/assets/art/voidd_v.webp",
  ARTE_IDD = "/src/assets/art/voidd_idd.webp";

const VINHETA = {
  dur: 15, // s: o logo fica pronto
  parado: 2.6, // s com o logo pronto antes de sair
  saida: 800, // ms do esmaecer (= transition de #voidd.saindo)
  // começa depois do engasgo do fim da carga: `estaveis` quadros seguidos de até `quadroOk` s (um PC lento ou sem a
  // placa de vídeo faz quadros de ~0,08 s, e isso não é engasgo), ou depois de `espera` s; até lá a capa fica por cima
  estaveis: 6,
  quadroOk: 0.15,
  espera: 5,
  buraco: [1.9, 0.15, 0] as const,
  inclinacao: 0.3, // do disco na história (rad)
  portal: 2.0, // diâmetro do O, unidades do mundo
  capO: 0.74, // altura das letras ÷ diâmetro do portal
  voodi: 0.95, // escala do modelo
};
/** Cauda do Voodi: véus de peixe-beta feitos de fumaça, no espaço do modelo (a cauda da malha some entre as distâncias
 *  `corte` do centro da cabeça). `eixo` = para onde a cauda pende; cada véu = [lado, cima (abertura do leque, −2..2),
 *  comprimento, largura na ponta, fase]; `segs` = segmentos [ao longo, através]; `onda` corre da raiz à ponta;
 *  `babado` ondula a borda; `arrasto` = quanto a ponta fica para trás no movimento; `fiapos` = fumaça que se solta
 *  das pontas (vida em s, tamanho no mundo início/fim, alfa). */
const VEU = {
  corte: [0.43, 0.6],
  eixo: [-0.05, -0.85, -0.52],
  raiz: 0.34,
  veus: [
    [0, 0.1, 1.55, 1.0, 0],
    [-0.85, 0.15, 1.4, 0.8, 1.3],
    [0.85, 0.15, 1.4, 0.8, 2.6],
    [-1.6, 0.55, 1.05, 0.55, 3.7],
    [1.6, 0.55, 1.05, 0.55, 4.9],
    [0.15, -1.2, 1.1, 0.65, 5.8],
    [-0.2, 1.4, 0.85, 0.45, 0.7],
  ] as [number, number, number, number, number][],
  segs: [32, 12],
  onda: { amp: 0.2, vel: 3.6, num: 4.6 },
  babado: 0.09,
  arrasto: 0.13,
  fiapos: { n: 170, vida: 1.9, tam: [0.06, 0.42], alfa: 0.26 },
};
const GLSL_RUIDO = `
float hash2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ruido(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash2(i), hash2(i + vec2(1., 0.)), u.x), mix(hash2(i + vec2(0., 1.)), hash2(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int k = 0; k < 5; k++) { v += a * ruido(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
const vec3 ROXO = vec3(.36, .2, 1.), LILAS = vec3(.72, .62, 1.), CIANO = vec3(.35, .95, 1.);
`;
const GLSL_VEU_V = `
attribute vec2 aSU;
attribute float aSem;
varying vec2 vSU;
varying float vSem;
void main(){ vSU = aSU; vSem = aSem; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
// s = da raiz (0) à ponta (1), u = através (−0,5..0,5): fumaça que corre para a ponta, bordas e ponta comidas pelo
// ruído, raios finos como os da nadadeira do beta
const GLSL_VEU_F =
  GLSL_RUIDO +
  `
uniform float uT;
varying vec2 vSU;
varying float vSem;
void main(){
  float s = vSU.x, u = vSU.y;
  vec2 q = vec2(u * 1.8 + vSem * 7.13, s * 2.4 - uT * .45);
  vec2 w = vec2(fbm(q * 1.5 + vec2(0., uT * .25)), fbm(q * 1.5 + vec2(5.2, -uT * .2)));
  float f = fbm(q * 2.2 + w * 1.6);
  float borda = 1. - abs(u) * 2.;
  float come = smoothstep(0., .45 + .35 * f, borda * (.8 + .4 * w.x));
  float ponta = 1. - smoothstep(.45 + .35 * w.y, 1., s);
  float raiz = smoothstep(0., .14, s);
  float raios = pow(.5 + .5 * sin(u * 26. + f * 5. + vSem * 3.), 5.);
  float dens = smoothstep(.2, .7, f) * come * ponta * raiz * 1.5;
  vec3 cor = mix(ROXO, LILAS, smoothstep(.4, .9, f));
  cor = mix(cor, CIANO, smoothstep(.55, .85, fbm(q * 3.3 + w * 2. + 7.)) * .7 * (.3 + s));
  gl_FragColor = vec4(cor * (1. + .5 * raios), dens * (.55 + .45 * raios));
}
`;
const GLSL_FIAPO_V = `
attribute float aTam;
attribute float aAlfa;
attribute float aSem;
uniform float uEsc;
varying float vA;
varying float vSem;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aTam * uEsc / max(.1, -mv.z);
  vA = aAlfa;
  vSem = aSem;
}
`;
const GLSL_FIAPO_F =
  GLSL_RUIDO +
  `
uniform float uT;
varying float vA;
varying float vSem;
void main(){
  vec2 p = gl_PointCoord - .5;
  float n = fbm(p * 3. + vSem * 11. + uT * .3);
  float a = smoothstep(1., 0., length(p) * 2. + (n - .5) * 1.3) * vA;
  vec3 cor = mix(mix(ROXO, LILAS, n), CIANO, step(.72, vSem) * .75);
  gl_FragColor = vec4(cor, a * (.4 + n));
}
`;
// olhar do Voodi: [tempo, guinada, inclinação]; cada troca é uma sacada rápida (0,09 s)
const OLHAR: [number, number, number][] = [
  [0, 0.5, 0],
  [1.9, 0, 0],
  [2.45, -0.55, 0.3],
  [3.0, 0.15, -0.12],
  [3.3, 0, 0],
  [3.6, 0.75, 0.05],
  [4.75, 0.6, 0.25],
  [5.45, -0.65, 0.18],
  [6.15, 0.55, 0],
  [6.45, -0.7, 0.12],
  [7, 0, 0],
];
const PISCADAS = [1.3, 2.95, 4.35, 6.0, 6.22];

/** Estado da vinheta (o gancho de teste lê). */
export const VOIDD = {
  aberta: false,
  pular: null as null | (() => void),
  /** Leva a vinheta aberta ao tempo t (s); para os testes e as prévias. */
  ir: null as null | ((t: number) => void),
};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const sm = (s: number) => s * s * (3 - 2 * s);
const lerp = (a: number, b: number, s: number) => a + (b - a) * s;
const saidaVolta = (s: number, c = 1.9) => 1 + (c + 1) * (s - 1) ** 3 + c * (s - 1) ** 2;
const sino = (t: number, a: number, b: number) => Math.sin(Math.PI * seg(t, a, b));
function gerador(semente: number) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/* ---------- texturas desenhadas em canvas ---------- */
function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}
function texturaRadial(paradas: [number, string][]) {
  const [c, g] = canvas2d(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [p, cor] of paradas) gr.addColorStop(p, cor);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
/** Fumaça roxa e ciano atrás do logo (borda some aos poucos). */
function texturaFumaca() {
  const [c, g] = canvas2d(512, 256);
  const r = gerador(99);
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 90; i++) {
    const x = 256 + (r() - 0.5) * 440,
      y = 128 + (r() - 0.5) * 170 * (1 - Math.abs(x - 256) / 300);
    const rad = 20 + r() * 60,
      ciano = r() < 0.3;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, ciano ? "rgba(80,220,230,.10)" : "rgba(130,80,255,.13)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = "destination-in";
  g.setTransform(2, 0, 0, 1, 0, 0);
  const borda = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  borda.addColorStop(0, "rgba(0,0,0,1)");
  borda.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = borda;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
/* ---------- a cena ---------- */
function montarCena(raiz: HTMLElement) {
  const rnd = gerador(7);
  const H = new THREE.Vector3(...VINHETA.buraco);
  const FI = VINHETA.inclinacao,
    OW = VINHETA.portal;
  const TANH = Math.tan((35 * Math.PI) / 360);
  THREE.ColorManagement.enabled = false;
  const cv = raiz.querySelector("canvas")!;
  const ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  ren.outputColorSpace = THREE.LinearSRGBColorSpace;
  ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const cena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 120);
  const PI = Math.PI; // luzes no modo antigo: intensidade × π
  cena.add(new THREE.AmbientLight(0x8070ff, 0.55 * PI));
  const sol = new THREE.DirectionalLight(0xffffff, 0.95 * PI);
  sol.position.set(-3, 4, 5);
  cena.add(sol);
  const contraluz = new THREE.DirectionalLight(0x6ff3ff, 0.5 * PI);
  contraluz.position.set(2, 1, -4);
  cena.add(contraluz);
  const luzBuraco = new THREE.PointLight(0x8d6bff, 0, 7, 1);
  luzBuraco.position.copy(H);
  cena.add(luzBuraco);
  const texPonto = texturaRadial([
    [0, "rgba(255,255,255,1)"],
    [0.35, "rgba(255,255,255,.55)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const texAureola = texturaRadial([
    [0, "rgba(0,0,0,0)"],
    [0.27, "rgba(0,0,0,0)"],
    [0.31, "rgba(200,190,255,.9)"],
    [0.4, "rgba(141,107,255,.45)"],
    [0.7, "rgba(80,50,200,.12)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  const aditivo = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

  // estrelas
  {
    const n = 1400,
      p = new Float32Array(n * 3),
      c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (rnd() - 0.5) * 70;
      p[i * 3 + 1] = (rnd() - 0.5) * 44;
      p[i * 3 + 2] = -12 - rnd() * 20;
      const b = 0.45 + rnd() * 0.55,
        azul = rnd();
      c[i * 3] = b * (0.8 + 0.2 * (1 - azul));
      c[i * 3 + 1] = b * 0.85;
      c[i * 3 + 2] = b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    const estrelas = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 0.11, map: texPonto, vertexColors: true, ...aditivo }),
    );
    estrelas.renderOrder = -2;
    cena.add(estrelas);
  }

  // ---- Voodi ----
  const nV = VOODI.p.length / 3;
  const base = new Float32Array(VOODI.p);
  const cab = VOODI.cab.slice();
  const olhosDados = VOODI.olhos.map((o) => ({ c: o.c.slice(), r: o.r }));
  {
    const mn = [1e9, 1e9, 1e9],
      mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < nV; i++)
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], base[i * 3 + k]);
        mx[k] = Math.max(mx[k], base[i * 3 + k]);
      }
    for (let k = 0; k < 3; k++) {
      const c = (mn[k] + mx[k]) / 2;
      for (let i = 0; i < nV; i++) base[i * 3 + k] -= c;
      cab[k] -= c;
      for (const o of olhosDados) o.c[k] -= c;
    }
  }
  const posV = new Float32Array(base);
  // peso = quanto balança (cabeça firme); alfa0 = transparência da cauda; antena = acima da cabeça
  const peso = new Float32Array(nV),
    alfa0 = new Float32Array(nV),
    antena = new Uint8Array(nV);
  for (let i = 0; i < nV; i++) {
    const bx = base[i * 3],
      by = base[i * 3 + 1],
      bz = base[i * 3 + 2];
    const d = Math.hypot(bx - cab[0], by - cab[1], bz - cab[2]);
    peso[i] = sm(clamp((d - 0.42) / 0.75));
    antena[i] = by > cab[1] + 0.3 && d > 0.4 ? 1 : 0;
    // v7.7: a cauda da malha some logo abaixo da cabeça; no lugar dela entram os véus (VEU)
    alfa0[i] = antena[i] ? 1 : 1 - sm(clamp((d - VEU.corte[0]) / (VEU.corte[1] - VEU.corte[0])));
  }
  const alfa = new Float32Array(alfa0);
  const geoV = new THREE.BufferGeometry();
  const atrPos = new THREE.BufferAttribute(posV, 3).setUsage(THREE.DynamicDrawUsage);
  const atrAlfa = new THREE.BufferAttribute(alfa, 1).setUsage(THREE.DynamicDrawUsage);
  geoV.setAttribute("position", atrPos);
  geoV.setAttribute("alfa", atrAlfa);
  geoV.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(VOODI.n), 3));
  geoV.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(VOODI.uv), 2));
  geoV.setIndex(VOODI.i);
  const carregar = new THREE.TextureLoader();
  const texCor = carregar.load(VOODI.cor),
    texNormal = carregar.load(VOODI.normal);
  texCor.anisotropy = texNormal.anisotropy = 4;
  const matV = new THREE.MeshStandardMaterial({
    map: texCor,
    normalMap: texNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.5,
    metalness: 0.05,
    emissive: 0xffffff,
    emissiveMap: texCor,
    emissiveIntensity: 0.45,
    transparent: true,
    depthWrite: false, // quem grava a profundidade é o pré-passe (sem a cauda apagada, que esconderia os véus)
    depthFunc: THREE.LessEqualDepth,
  });
  // alfa por vértice (a cauda some aos poucos)
  const comAlfa = (frag: string) => (sh: THREE.WebGLProgramParametersWithUniforms) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float alfa;\nvarying float vAlfa;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAlfa = alfa;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vAlfa;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + frag);
  };
  matV.onBeforeCompile = comAlfa("diffuseColor.a *= vAlfa;");
  const voodi = new THREE.Mesh(geoV, matV);
  voodi.renderOrder = 2;
  // pré-passe de profundidade: a cauda translúcida mostra só a superfície da frente; a parte apagada não grava
  // profundidade (senão esconderia os véus)
  const matFundo = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
  matFundo.onBeforeCompile = comAlfa("if (vAlfa < 0.5) discard;");
  const voodiFundo = new THREE.Mesh(geoV, matFundo);
  voodiFundo.renderOrder = 1;
  const vExt = new THREE.Group(),
    vMeio = new THREE.Group(),
    vIn = new THREE.Group();
  vExt.add(vMeio);
  vMeio.add(vIn);
  vIn.add(voodiFundo, voodi);
  cena.add(vExt);
  // olhos animados (os pintados foram apagados da malha e das texturas pelo gerador)
  const centroCab = new THREE.Vector3(cab[0], cab[1], cab[2]);
  const Z = new THREE.Vector3(0, 0, 1);
  const olhos3D = olhosDados.map((o) => {
    const d0 = new THREE.Vector3(o.c[0], o.c[1], o.c[2]).sub(centroCab);
    const raio = d0.length() - 0.018; // afundado: a bolha sai da superfície sem fresta
    d0.normalize();
    const grupo = new THREE.Group();
    const malha = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: 0xf6f3ff }));
    grupo.add(malha);
    vIn.add(grupo);
    return { d0, raio, grupo, malha, rx: o.r[0] * 1.22, ry: o.r[1] * 1.14 };
  });

  // trajeto (função pura do tempo)
  const onda = (t: number) =>
    0.07 * Math.sin(t * 1.9) + 0.04 * Math.sin(t * 3.1 + 1.3) + 0.018 * Math.sin(t * 5.3 + 2.1);
  function voodiAntes(t: number, alvo: THREE.Vector3) {
    const ent = saidaVolta(seg(t, 0, 2.1), 1.2);
    let x = lerp(-4.6, -1.4, ent);
    let y = onda(t) + 0.3 * sino(t, 0, 2.1);
    y += 0.32 * sino(t, 4.75, 5.3) - 0.06 * sino(t, 5.3, 5.7);
    const puxa = seg(t, 5.5, 7);
    x = lerp(x, -0.55, puxa * puxa) - 0.07 * Math.max(0, Math.sin(t * 7.5)) * puxa;
    return alvo.set(x, y, 0);
  }
  const P7 = voodiAntes(7, new THREE.Vector3());
  const R0 = Math.hypot(P7.x - H.x, P7.z - H.z);
  function voodiPos(t: number, alvo: THREE.Vector3) {
    if (t < 7) return voodiAntes(t, alvo);
    const e = seg(t, 7, 9.5) ** 1.6;
    const a = Math.PI + Math.PI * 2 * 1.9 * e,
      r = R0 * (1 - e) ** 1.3;
    return alvo.set(
      H.x + r * Math.cos(a) * (Math.cos(a) > 0 ? 0.6 : 1),
      H.y + (P7.y - H.y) * (1 - e) - r * Math.sin(a) * Math.sin(FI),
      H.z + r * Math.sin(a) * Math.cos(FI),
    );
  }
  const tmp = new THREE.Vector3(),
    tmp2 = new THREE.Vector3();
  function velocidade(t: number, alvo: THREE.Vector3, h = 0.05) {
    voodiPos(Math.max(0, t), alvo);
    voodiPos(Math.max(0, t - h), tmp2);
    alvo.sub(tmp2).divideScalar(h);
    const l = alvo.length();
    return l > 4 ? alvo.multiplyScalar(4 / l) : alvo;
  }
  function olhar(t: number): [number, number] {
    let g = OLHAR[0][1],
      p = OLHAR[0][2];
    for (const [tk, gk, pk] of OLHAR) {
      if (t < tk) break;
      const s = sm(seg(t, tk, tk + 0.09));
      g = lerp(g, gk, s);
      p = lerp(p, pk, s);
    }
    return [g + 0.025 * Math.sin(t * 13.1) * Math.sin(t * 2.3), p + 0.02 * Math.sin(t * 11.7 + 1)];
  }
  function formaOlhos(t: number): [number, number] {
    let sx = 1,
      sy = 1;
    const susto = sino(t, 4.75, 5.7);
    sy *= 1 + 0.35 * susto;
    sx *= 1 + 0.15 * susto;
    const medo = sm(seg(t, 5.45, 5.7)) * (1 - sm(seg(t, 6.9, 7.1)));
    sy *= 1 - 0.12 * medo + 0.04 * medo * Math.sin(t * 60);
    const aperta = sm(seg(t, 7, 7.35));
    sy *= 1 - 0.72 * aperta;
    sx *= 1 + 0.12 * aperta;
    for (const b of PISCADAS) {
      const f = 1 - Math.abs(t - b) / 0.075;
      if (f > 0) sy *= 1 - 0.92 * sm(f);
    }
    return [sx, sy];
  }

  const dir = new THREE.Vector3(),
    X = new THREE.Vector3(1, 0, 0);
  const qDir = new THREE.Quaternion(),
    qInv = new THREE.Quaternion(),
    qOlhar = new THREE.Quaternion(),
    eOlhar = new THREE.Euler();
  const vA = new THREE.Vector3(),
    vB = new THREE.Vector3(),
    vC = new THREE.Vector3();
  function atualizarVoodi(t: number) {
    vExt.visible = fiapos.visible = t < 9.5;
    if (!vExt.visible) return;
    voodiPos(t, vExt.position);
    const s = seg(t, 7, 9.5),
      e = s ** 1.6,
      puxa = seg(t, 5.5, 7);
    // o corpo segue o olhar com atraso e inclina na direção do movimento
    const [gOlho, pOlho] = olhar(t);
    const [gAtras] = olhar(Math.max(0, t - 0.22));
    velocidade(t, vA);
    const yaw = 0.55 * gAtras - 0.25 * sm(puxa);
    const roll =
      -0.1 * vA.x + 0.05 * Math.sin(t * 1.3 + 0.5) + 0.38 * sm(puxa) + 0.045 * Math.sin(t * 38) * puxa * (1 - s);
    const pitch = -0.08 * vA.y + 0.04 * Math.sin(t * 1.7);
    vIn.rotation.set(pitch, yaw, roll + 5 * e);
    vIn.scale.setScalar(VINHETA.voodi * (1 - e) ** 0.55);
    dir.subVectors(H, vExt.position);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    dir.normalize();
    qDir.setFromUnitVectors(X, dir);
    const est = 1 + 0.35 * puxa + 2.6 * e;
    vExt.quaternion.copy(qDir);
    vExt.scale.set(est, 1 / Math.sqrt(est), 1 / Math.sqrt(est));
    vMeio.quaternion.copy(qDir).invert();
    // olhos
    const [sx, sy] = formaOlhos(t);
    eOlhar.set(-pOlho * 0.18, (gOlho - 0.55 * gAtras) * 0.3 + gOlho * 0.08, 0);
    qOlhar.setFromEuler(eOlhar);
    for (const o of olhos3D) {
      tmp.copy(o.d0).applyQuaternion(qOlhar);
      o.grupo.position.copy(centroCab).addScaledVector(tmp, o.raio);
      o.grupo.quaternion.setFromUnitVectors(Z, tmp);
      o.malha.scale.set(o.rx * sx, o.ry * sy, o.rx * 0.62);
    }
    // cauda e antenas: arrasto atrasado (as pontas atrasam mais), ondulação, escorrer para o buraco, cintilação
    qInv.copy(vIn.quaternion).invert();
    velocidade(t - 0.06, vB).applyQuaternion(qInv);
    velocidade(t - 0.32, vC).applyQuaternion(qInv);
    const fluxo = 0.22 * puxa + 0.3 * e;
    for (let i = 0; i < nV; i++) {
      const w = peso[i];
      if (w === 0) continue;
      const i3 = i * 3,
        bx = base[i3],
        by = base[i3 + 1],
        bz = base[i3 + 2];
      const k = antena[i] ? 0.07 * w : 0.1 * w * w;
      const lx = lerp(vB.x, vC.x, w),
        ly = lerp(vB.y, vC.y, w),
        lz = lerp(vB.z, vC.z, w);
      const mola = antena[i] ? 0.035 * Math.sin(t * 6.5 - by * 4) * w : 0;
      posV[i3] =
        bx -
        k * lx +
        w * (0.045 * Math.sin(t * 3.1 + by * 4 + bz * 2) + fluxo * (0.6 + 0.4 * Math.sin(t * 6 + by * 5))) +
        mola;
      posV[i3 + 1] = by - k * ly + w * 0.04 * Math.sin(t * 2.3 + bx * 5 + bz * 3);
      posV[i3 + 2] = bz - k * lz + w * 0.045 * Math.sin(t * 2.7 + by * 3 + bx * 2) + mola * 0.5;
      alfa[i] = alfa0[i] * (antena[i] ? 1 : 0.85 + 0.15 * Math.sin(t * 5 + by * 7 + bx * 3));
    }
    atrPos.needsUpdate = atrAlfa.needsUpdate = true;
    atualizarVeus(t, fluxo);
    atualizarFiapos(t, puxa, e);
  }

  // ---- véus da cauda (VEU): fitas em leque, uma malha só; a onda corre da raiz à ponta, a ponta fica para trás ----
  const eixoV = new THREE.Vector3(...(VEU.eixo as [number, number, number])).normalize(),
    ladoV = new THREE.Vector3().crossVectors(eixoV, new THREE.Vector3(0, 1, 0)).normalize(),
    cimaV = new THREE.Vector3().crossVectors(ladoV, eixoV).normalize();
  const [NS, NW] = VEU.segs,
    porVeu = (NS + 1) * (NW + 1);
  const veus = VEU.veus.map(([la, ci, comp, larg, fase], k) => {
    const d = eixoV
      .clone()
      .addScaledVector(ladoV, la * 0.7)
      .addScaledVector(cimaV, ci * 0.5)
      .normalize();
    const saida = eixoV
      .clone()
      .addScaledVector(ladoV, la * 0.35)
      .addScaledVector(cimaV, ci * 0.3)
      .normalize();
    const raiz = centroCab.clone().addScaledVector(saida, VEU.raiz);
    const ref = Math.abs(la) > 1.5 ? cimaV : ladoV; // a largura do véu vai para o lado do leque
    const b = ref.clone().addScaledVector(d, -ref.dot(d)).normalize();
    return { d, raiz, b, n: new THREE.Vector3().crossVectors(d, b), comp, larg, fase, sem: (k * 0.618) % 1 };
  });
  const posVeu = new Float32Array(veus.length * porVeu * 3),
    suVeu = new Float32Array(veus.length * porVeu * 2),
    semVeu = new Float32Array(veus.length * porVeu),
    idxVeu: number[] = [];
  veus.forEach((v, k) => {
    for (let i = 0; i <= NS; i++)
      for (let j = 0; j <= NW; j++) {
        const q = k * porVeu + i * (NW + 1) + j;
        suVeu[q * 2] = i / NS;
        suVeu[q * 2 + 1] = j / NW - 0.5;
        semVeu[q] = v.sem;
        if (i < NS && j < NW) idxVeu.push(q, q + NW + 1, q + 1, q + 1, q + NW + 1, q + NW + 2);
      }
  });
  const geoVeu = new THREE.BufferGeometry();
  const atrVeu = new THREE.BufferAttribute(posVeu, 3).setUsage(THREE.DynamicDrawUsage);
  geoVeu.setAttribute("position", atrVeu);
  geoVeu.setAttribute("aSU", new THREE.BufferAttribute(suVeu, 2));
  geoVeu.setAttribute("aSem", new THREE.BufferAttribute(semVeu, 1));
  geoVeu.setIndex(idxVeu);
  const uniVeu = { uT: { value: 0 } };
  const malhaVeu = new THREE.Mesh(
    geoVeu,
    new THREE.ShaderMaterial({
      uniforms: uniVeu,
      vertexShader: GLSL_VEU_V,
      fragmentShader: GLSL_VEU_F,
      side: THREE.DoubleSide,
      ...aditivo,
    }),
  );
  malhaVeu.renderOrder = 3; // depois do pré-passe: a cabeça esconde a raiz e o que fica atrás dela
  malhaVeu.frustumCulled = false;
  vIn.add(malhaVeu);
  const pE = new THREE.Vector3(),
    arr = new THREE.Vector3();
  function atualizarVeus(t: number, fluxo: number) {
    const { amp, vel, num } = VEU.onda;
    veus.forEach((v, k) => {
      for (let i = 0; i <= NS; i++) {
        const s = i / NS,
          ph = vel * t - num * s + v.fase;
        // velocidades (vB recente, vC atrasada) no espaço do modelo: a ponta segue a mais velha
        arr
          .copy(vB)
          .lerp(vC, s)
          .multiplyScalar(-VEU.arrasto * s ** 1.5);
        pE.copy(v.raiz)
          .addScaledVector(v.d, v.comp * s)
          .add(arr)
          .addScaledVector(v.n, amp * s ** 1.3 * Math.sin(ph))
          .addScaledVector(v.b, 0.35 * amp * s ** 1.6 * Math.sin(0.7 * ph + 1.1));
        pE.x += fluxo * s * (0.6 + 0.4 * Math.sin(t * 6 + s * 5));
        const w = v.larg * (0.12 + 0.88 * sm(Math.min(1, s * 1.25))) * (1 + 0.12 * Math.sin(t * 1.6 + v.fase));
        for (let j = 0; j <= NW; j++) {
          const u = j / NW - 0.5,
            q = (k * porVeu + i * (NW + 1) + j) * 3;
          const bab = VEU.babado * s * Math.sin(vel * 1.4 * t - num * 1.5 * s + u * 8 + v.fase) * Math.abs(2 * u);
          posVeu[q] = pE.x + v.b.x * u * w + v.n.x * bab;
          posVeu[q + 1] = pE.y + v.b.y * u * w + v.n.y * bab;
          posVeu[q + 2] = pE.z + v.b.z * u * w + v.n.z * bab;
        }
      }
    });
    atrVeu.needsUpdate = true;
    uniVeu.uT.value = t;
  }
  // fiapos: fumaça que se solta das pontas dos véus e fica para trás (no mundo), crescendo e sumindo; sorteio próprio
  // (o `rnd` da cena é o do disco e dos cristais aprovados)
  const FP = VEU.fiapos,
    rndF = gerador(31);
  const fpPos = new Float32Array(FP.n * 3),
    fpTam = new Float32Array(FP.n),
    fpAlfa = new Float32Array(FP.n),
    fpSem = new Float32Array(FP.n);
  const fpR = Array.from({ length: FP.n }, () => [rndF(), rndF(), rndF(), rndF(), rndF(), rndF(), rndF()]);
  for (let i = 0; i < FP.n; i++) fpSem[i] = fpR[i][6];
  const geoFp = new THREE.BufferGeometry();
  const atrFpPos = new THREE.BufferAttribute(fpPos, 3).setUsage(THREE.DynamicDrawUsage),
    atrFpTam = new THREE.BufferAttribute(fpTam, 1).setUsage(THREE.DynamicDrawUsage),
    atrFpAlfa = new THREE.BufferAttribute(fpAlfa, 1).setUsage(THREE.DynamicDrawUsage);
  geoFp.setAttribute("position", atrFpPos);
  geoFp.setAttribute("aTam", atrFpTam);
  geoFp.setAttribute("aAlfa", atrFpAlfa);
  geoFp.setAttribute("aSem", new THREE.BufferAttribute(fpSem, 1));
  const uniFp = { uT: { value: 0 }, uEsc: { value: 400 } };
  const fiapos = new THREE.Points(
    geoFp,
    new THREE.ShaderMaterial({
      uniforms: uniFp,
      vertexShader: GLSL_FIAPO_V,
      fragmentShader: GLSL_FIAPO_F,
      ...aditivo,
    }),
  );
  fiapos.renderOrder = 3;
  fiapos.frustumCulled = false;
  cena.add(fiapos);
  const agoraP = new THREE.Vector3(),
    nasceuP = new THREE.Vector3();
  function atualizarFiapos(t: number, puxa: number, e: number) {
    vExt.updateMatrixWorld(true);
    voodiPos(t, agoraP);
    const suga = clamp(0.5 * sm(puxa) + e);
    for (let i = 0; i < FP.n; i++) {
      const r = fpR[i],
        vida = FP.vida * (0.75 + 0.5 * r[0]),
        idade = (t + r[1] * vida) % vida,
        k = idade / vida,
        i3 = i * 3;
      // nasce na ponta de um véu (posição de agora, levada para onde o Voodi estava quando ela nasceu)
      const q = (i % veus.length) * porVeu + Math.round((0.6 + 0.4 * r[2]) * NS) * (NW + 1) + Math.round(r[3] * NW);
      pE.fromArray(posVeu, q * 3).applyMatrix4(malhaVeu.matrixWorld);
      voodiPos(Math.max(0, t - idade), nasceuP);
      pE.add(nasceuP).sub(agoraP);
      pE.x += (r[4] - 0.5) * 0.3 * idade;
      pE.y += (0.03 + (r[5] - 0.5) * 0.2) * idade;
      pE.z += (r[6] - 0.5) * 0.2 * idade;
      pE.lerp(H, suga * k);
      pE.toArray(fpPos, i3);
      fpTam[i] = lerp(FP.tam[0], FP.tam[1], Math.sqrt(k));
      fpAlfa[i] = FP.alfa * Math.sin(Math.PI * k) ** 1.5 * (t > 0.2 ? 1 : 0);
    }
    atrFpPos.needsUpdate = atrFpTam.needsUpdate = atrFpAlfa.needsUpdate = true;
    uniFp.uT.value = t;
  }

  // ---- buraco negro, portal, fumaça, cristais ----
  const buraco = new THREE.Group();
  buraco.position.copy(H);
  cena.add(buraco);
  const horizonte = new THREE.Mesh(new THREE.CircleGeometry(0.5, 72), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  buraco.add(horizonte);
  const aureola = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAureola, ...aditivo }));
  aureola.position.set(0, 0, -0.06);
  buraco.add(aureola);
  // o portal (o O da arte): a borda da imagem vai até o diâmetro OW; por cima, a mesma imagem somada, girando ao
  // contrário, dá o brilho que pulsa. No fim o horizonte encolhe para caber no furo do O.
  const texO = carregar.load(ARTE_O);
  const ladoO = OW / (LETRAS.o?.borda || 1),
    furoO = ((LETRAS.o?.furo || 0.5) / (LETRAS.o?.borda || 1)) * (OW / 2);
  const portais = [0, 1].map((i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(ladoO * (1 + 0.04 * i), ladoO * (1 + 0.04 * i)),
      new THREE.MeshBasicMaterial(
        i ? { map: texO, opacity: 0, ...aditivo } : { map: texO, opacity: 0, transparent: true, depthWrite: false },
      ),
    );
    m.position.z = 0.003 + i * 0.001;
    m.renderOrder = 3;
    buraco.add(m);
    return m;
  });
  const fumaca = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.5),
    new THREE.MeshBasicMaterial({ map: texturaFumaca(), opacity: 0, ...aditivo }),
  );
  fumaca.renderOrder = -1;
  cena.add(fumaca);
  const olhosO = [-1, 1].map((lado) => {
    const o = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 32),
      new THREE.MeshBasicMaterial({ color: 0xf2f0ff, transparent: true, opacity: 0 }),
    );
    o.position.set(lado * 0.13, 0.03, 0.004);
    buraco.add(o);
    return o;
  });
  const matCristal = new THREE.MeshStandardMaterial({
    color: 0x1c1434,
    roughness: 0.6,
    metalness: 0.25,
    emissive: 0x2a1060,
    emissiveIntensity: 0.35,
    flatShading: true,
  });
  const cristais = Array.from({ length: 16 }, () => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 + rnd() * 0.13, 0), matCristal);
    const a = rnd() * Math.PI * 2,
      r = 1 + rnd() * 0.35;
    const dados = {
      x: Math.cos(a) * r * 2.9,
      y: Math.sin(a) * r * 1.15,
      z: -0.6 + rnd() * 1.1,
      giro: 0.3 + rnd() * 0.8,
      fase: rnd() * 6,
      alto: 1.3 + rnd() * 0.8,
    };
    m.visible = false;
    cena.add(m);
    return { m, ...dados };
  });

  // disco de acreção (plano XZ do grupo; o grupo inclina e, no fim, fica de frente)
  const disco = new THREE.Group();
  disco.position.copy(H);
  cena.add(disco);
  const ND = 3600;
  const dR = new Float32Array(ND),
    dRO = new Float32Array(ND),
    dA = new Float32Array(ND),
    dW = new Float32Array(ND),
    dY = new Float32Array(ND);
  const dPos = new Float32Array(ND * 3),
    dCor = new Float32Array(ND * 3),
    dCorA = new Float32Array(ND * 3),
    dCorB = new Float32Array(ND * 3);
  const PAL_A = [
    [0.92, 0.9, 1],
    [0.6, 0.72, 1],
    [0.48, 0.36, 1],
    [1, 0.82, 0.7],
  ];
  const PAL_B = [
    [0.44, 0.95, 1],
    [0.55, 0.42, 1],
    [0.77, 0.55, 1],
    [0.95, 0.93, 1],
  ];
  for (let i = 0; i < ND; i++) {
    dR[i] = 0.6 + 1.1 * rnd() ** 1.7;
    dRO[i] = 0.66 + 0.34 * rnd();
    dA[i] = rnd() * Math.PI * 2;
    dW[i] = 1.5 / dR[i] ** 1.5;
    dY[i] = (rnd() - 0.5) * 0.06 * dR[i];
    const a = PAL_A[(rnd() * 4) | 0],
      b = PAL_B[(rnd() * 4) | 0],
      br = 0.55 + 0.45 * rnd();
    for (let e = 0; e < 3; e++) {
      dCorA[i * 3 + e] = a[e] * br;
      dCorB[i * 3 + e] = b[e] * br;
    }
  }
  const geoD = new THREE.BufferGeometry();
  geoD.setAttribute("position", new THREE.BufferAttribute(dPos, 3).setUsage(THREE.DynamicDrawUsage));
  geoD.setAttribute("color", new THREE.BufferAttribute(dCor, 3).setUsage(THREE.DynamicDrawUsage));
  const matD = new THREE.PointsMaterial({ size: 0.055, map: texPonto, vertexColors: true, ...aditivo });
  const pontosD = new THREE.Points(geoD, matD);
  pontosD.renderOrder = 3;
  disco.add(pontosD);
  const qHist = new THREE.Quaternion().setFromAxisAngle(X, FI);
  const qX90 = new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2);
  const qFace = new THREE.Quaternion();

  // faíscas que saem do Voodi e espiralam para dentro
  const NF = 260;
  const fT = new Float32Array(NF),
    fJ = new Float32Array(NF * 3);
  const fPos = new Float32Array(NF * 3),
    fCor = new Float32Array(NF * 3),
    fBase = new Float32Array(NF * 3);
  for (let i = 0; i < NF; i++) {
    fT[i] = 6 + 3.4 * (i / NF) + 0.1 * rnd();
    for (let e = 0; e < 3; e++) fJ[i * 3 + e] = (rnd() - 0.5) * 0.5;
    const c = PAL_B[(rnd() * 4) | 0];
    for (let e = 0; e < 3; e++) fBase[i * 3 + e] = c[e];
  }
  const geoF = new THREE.BufferGeometry();
  geoF.setAttribute("position", new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage));
  geoF.setAttribute("color", new THREE.BufferAttribute(fCor, 3).setUsage(THREE.DynamicDrawUsage));
  const pontosF = new THREE.Points(
    geoF,
    new THREE.PointsMaterial({ size: 0.07, map: texPonto, vertexColors: true, ...aditivo }),
  );
  pontosF.renderOrder = 3;
  cena.add(pontosF);
  const nDisco = new THREE.Vector3(0, Math.cos(FI), Math.sin(FI));
  const rel = new THREE.Vector3(),
    cruz = new THREE.Vector3();
  function atualizarFaiscas(t: number) {
    for (let i = 0; i < NF; i++) {
      const k = (t - fT[i]) / 1.1,
        i3 = i * 3;
      if (k < 0 || k > 1) {
        fPos[i3 + 2] = -999;
        fCor[i3] = fCor[i3 + 1] = fCor[i3 + 2] = 0;
        continue;
      }
      voodiPos(fT[i], tmp);
      rel.set(tmp.x + fJ[i3] - H.x, tmp.y + fJ[i3 + 1] - H.y, tmp.z + fJ[i3 + 2] - H.z);
      const ang = -k * 5,
        c = Math.cos(ang),
        s = Math.sin(ang),
        d = nDisco.dot(rel);
      cruz.crossVectors(nDisco, rel);
      rel
        .multiplyScalar(c)
        .addScaledVector(cruz, s)
        .addScaledVector(nDisco, d * (1 - c))
        .multiplyScalar((1 - k) ** 1.3);
      fPos[i3] = H.x + rel.x;
      fPos[i3 + 1] = H.y + rel.y;
      fPos[i3 + 2] = H.z + rel.z;
      const luz = Math.sin(Math.PI * k);
      for (let e = 0; e < 3; e++) fCor[i3 + e] = fBase[i3 + e] * luz;
    }
    geoF.attributes.position.needsUpdate = geoF.attributes.color.needsUpdate = true;
  }

  // ---- logotipo em HTML, preso ao portal ----
  const logo = raiz.querySelector<HTMLElement>("#voidd-logo")!,
    oslot = raiz.querySelector<HTMLElement>("#voidd-oslot")!,
    mundo = raiz.querySelector<HTMLElement>("#voidd-mundo")!;
  const letraV = raiz.querySelector<HTMLImageElement>("#voidd-v")!,
    letrasIDD = raiz.querySelector<HTMLImageElement>("#voidd-idd")!;
  /** Uma imagem de letras da arte: a caixa só das letras (`glifo`, frações) fica com a altura `alt`, centrada na linha
      do meio; a fumaça sobra para os lados e para cima (margens negativas); `antes`/`depois` = espaço até o vizinho. */
  function encaixar(img: HTMLImageElement, glifo: number[], alt: number, antes: number, depois: number) {
    const [g0, g1, g2, g3] = glifo;
    const h = alt / (g3 - g1),
      w = h * (img.naturalWidth / (img.naturalHeight || 1) || 1);
    img.style.height = h + "px";
    img.style.marginLeft = -g0 * w + antes + "px";
    img.style.marginRight = -(1 - g2) * w + depois + "px";
    img.style.transform = `translateY(${(0.5 - (g1 + g3) / 2) * h}px)`;
  }
  let razaoX = 0.9,
    razaoY = 0.3,
    razaoL = 4.2;
  const proj = new THREE.Vector3(),
    proj2 = new THREE.Vector3(),
    lado = new THREE.Vector3();
  function posicionarLogo(t: number) {
    if (t < 10.2) {
      logo.style.visibility = "hidden";
      return;
    }
    logo.style.visibility = "visible";
    const W = raiz.clientWidth,
      Hh = raiz.clientHeight;
    proj.copy(H).project(cam);
    lado.set(1, 0, 0).applyQuaternion(cam.quaternion);
    proj2
      .copy(H)
      .addScaledVector(lado, OW / 2)
      .project(cam);
    const cx = (proj.x * 0.5 + 0.5) * W,
      cy = (-proj.y * 0.5 + 0.5) * Hh;
    const D = Math.abs(proj2.x - proj.x) * W;
    const cap = D * VINHETA.capO;
    encaixar(letraV, LETRAS.v?.glifo ?? [0, 0, 1, 1], cap, 0, D * 0.02);
    encaixar(letrasIDD, LETRAS.idd?.glifo ?? [0, 0, 1, 1], cap, D * 0.03, 0);
    oslot.style.width = D * 0.9 + "px";
    oslot.style.height = D + "px";
    mundo.style.fontSize = D * 0.15 + "px";
    mundo.style.marginTop = D * 0.06 + "px";
    mundo.style.gap = lerp(2.2, 1, sm(seg(t, 12, 13.4))) + "em";
    const rl = logo.getBoundingClientRect(),
      ro = oslot.getBoundingClientRect();
    const ox = ro.left + ro.width / 2 - rl.left,
      oy = ro.top + ro.height / 2 - rl.top;
    logo.style.transform = `translate(${cx - ox}px, ${cy - oy}px)`;
    if (ro.height > 0) {
      razaoX = (rl.width / 2 - ox) / ro.height;
      razaoY = (rl.height / 2 - oy) / ro.height;
      razaoL = rl.width / ro.height;
    }
    letraV.style.opacity = String(sm(seg(t, 10.9, 11.4)));
    letrasIDD.style.opacity = String(sm(seg(t, 11.15, 11.9)));
    mundo.style.opacity = String(sm(seg(t, 12.1, 13)));
  }

  // ---- câmera: na história enquadra o Voodi e o buraco; no fim, o logo inteiro ----
  const alvoCam = new THREE.Vector3();
  function enquadrar(t: number) {
    const W = raiz.clientWidth,
      Hh = raiz.clientHeight,
      asp = W / Hh;
    const zH = Math.max(8, 6.6 / (2 * TANH * asp));
    const Dpx = Math.min(Hh * 0.3, (W * 0.86) / razaoL);
    const zL = (OW * Hh) / (2 * TANH * Dpx);
    const lx = H.x + razaoX * OW,
      ly = H.y - razaoY * OW;
    const m = sm(seg(t, 9.7, 12.2));
    const tremor = 0.035 * Math.exp(-(((t - 9.5) / 0.22) ** 2));
    alvoCam.set(lerp(0.55, lx, m) + tremor * Math.sin(t * 90), lerp(0.12, ly, m) + tremor * Math.cos(t * 77), 0);
    cam.position.set(alvoCam.x, alvoCam.y, lerp(zH, zL, m));
    cam.lookAt(alvoCam);
  }

  const ponteiro = { x: raiz.clientWidth / 2, y: raiz.clientHeight / 2 };
  const olharO = { x: 0, y: 0 };
  function piscarO(ta: number) {
    if (ta < 14) return 1;
    const f = (ta - 14) % 3.6;
    let k = 1;
    for (const b of [0.1, 0.32]) {
      const q = 1 - Math.abs(f - b) / 0.075;
      if (q > 0 && (b === 0.1 || Math.floor((ta - 14) / 3.6) % 2 === 1)) k *= 1 - 0.92 * sm(q);
    }
    return k;
  }
  function desenhar(t: number, ta: number, dt: number) {
    enquadrar(t);
    atualizarVoodi(t);
    atualizarFaiscas(t);
    const abre = t < 3.4 ? 0 : saidaVolta(seg(t, 3.4, 5.2));
    const flash = Math.exp(-(((t - 9.5) / 0.28) ** 2));
    const m = sm(seg(t, 9.9, 11.8));
    buraco.quaternion.copy(cam.quaternion);
    buraco.scale.setScalar(Math.max(0.0001, abre * (1 + 0.16 * flash + 0.02 * Math.sin(ta * 2.4) * (1 - m))));
    aureola.scale.setScalar(lerp(3.3, 2.6, m) * (1 + 0.5 * flash));
    aureola.material.opacity = (0.85 + 0.6 * flash) * (1 - 0.75 * m);
    luzBuraco.intensity = (2.4 * abre * (1 - seg(t, 9.5, 10.5)) + 4 * flash + 1.5 * m) * PI;
    const vp = sm(seg(t, 10.3, 11.6));
    portais.forEach((p, i) => {
      p.rotation.z = (i ? 0.08 : -0.14) * ta + (1 - vp) * (i ? -1.2 : 2.4); // entra girando e assenta
      p.scale.setScalar(lerp(0.6, 1, saidaVolta(vp, 1.2)));
      p.material.opacity = i ? vp * (0.22 + 0.1 * Math.sin(ta * 2.3)) : vp;
    });
    horizonte.scale.setScalar(lerp(1, (furoO * 1.04) / 0.5, m));
    // fumaça e cristais em volta do logo
    const lx = H.x + razaoX * OW,
      ly = H.y - razaoY * OW,
      vf = sm(seg(t, 10.6, 12.6));
    fumaca.position.set(lx, ly, -0.8);
    fumaca.quaternion.copy(cam.quaternion);
    fumaca.scale.set(OW * razaoL * 1.5, OW * razaoL * 1.5, 1);
    fumaca.material.opacity = vf;
    for (const c of cristais) {
      c.m.visible = vf > 0.01;
      c.m.position.set(lx + c.x * OW * razaoL * 0.2, ly + c.y * OW * 0.9 + 0.05 * Math.sin(ta * 0.8 + c.fase), c.z);
      c.m.rotation.set(ta * c.giro * 0.5, ta * c.giro, c.fase);
      c.m.scale.set(vf, c.alto * vf, vf);
    }
    // olhos do Voodi dentro do O: aparecem no fim e seguem o cursor (com atraso)
    const vo = sm(seg(t, 13.1, 13.8)),
      pis = piscarO(ta);
    proj.copy(H).project(cam);
    const px = (proj.x * 0.5 + 0.5) * raiz.clientWidth,
      py = (-proj.y * 0.5 + 0.5) * raiz.clientHeight;
    const dx = ponteiro.x - px,
      dy = py - ponteiro.y,
      dl = Math.hypot(dx, dy) || 1;
    const alc = Math.min(1, dl / 300) * 0.06,
      k = 1 - Math.exp(-dt * 9);
    olharO.x += ((dx / dl) * alc - olharO.x) * k;
    olharO.y += ((dy / dl) * alc - olharO.y) * k;
    olhosO.forEach((o, i) => {
      o.material.opacity = vo;
      o.scale.set(1, 1.35 * pis, 1);
      o.position.set((i ? 1 : -1) * 0.13 + olharO.x, 0.03 + olharO.y, 0.004);
    });
    // disco
    disco.scale.setScalar(Math.max(0.0001, abre * (1 + 0.1 * flash)));
    qFace.copy(cam.quaternion).multiply(qX90);
    disco.quaternion.copy(qHist).slerp(qFace, m);
    matD.opacity = clamp(abre) * lerp(1, 0.18, m);
    const cm = sm(seg(t, 9.3, 10.6)),
      puxa = 1 + 1.4 * seg(t, 5.5, 9.5) * (1 - cm);
    for (let i = 0; i < ND; i++) {
      const r = lerp(dR[i], dRO[i], m),
        a = dA[i] + dW[i] * ta * puxa * (1 - 0.6 * m) + ta * 0.9 * m;
      const i3 = i * 3;
      dPos[i3] = r * Math.cos(a);
      dPos[i3 + 1] = dY[i] * (1 - m);
      dPos[i3 + 2] = r * Math.sin(a);
      for (let e = 0; e < 3; e++) dCor[i3 + e] = lerp(dCorA[i3 + e], dCorB[i3 + e], cm) * (1 + 1.5 * flash);
    }
    geoD.attributes.position.needsUpdate = geoD.attributes.color.needsUpdate = true;
    ren.render(cena, cam);
    posicionarLogo(t);
  }
  function dimensionar() {
    ren.setSize(raiz.clientWidth, raiz.clientHeight, false);
    cam.aspect = raiz.clientWidth / Math.max(1, raiz.clientHeight);
    cam.updateProjectionMatrix();
    // tamanho dos fiapos em pixels = tamanho no mundo × uEsc ÷ distância
    uniFp.uEsc.value = ren.getDrawingBufferSize(new THREE.Vector2()).y / (2 * TANH);
  }
  function descartar() {
    cena.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Sprite) {
        o.geometry.dispose();
        for (const m of [o.material].flat()) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
          m.dispose();
        }
      }
    });
    ren.dispose();
    ren.forceContextLoss();
  }
  dimensionar();
  return { desenhar, dimensionar, descartar, ponteiro };
}

/* ---------- tocar ---------- */
/** Toca a vinheta por cima de tudo e chama `fim` quando ela sai (no fim ou ao pular). Sem o modelo (Node) ou sem
    WebGL, só tira a capa de carregamento e chama `fim`. */
export function tocarVinhetaVoidd(fim: () => void) {
  const pronto = () => document.documentElement.classList.add("voidd-pronto");
  if (!VOODI.p || VOIDD.aberta) {
    pronto();
    fim();
    return;
  }
  const raiz = document.createElement("div");
  raiz.id = "voidd";
  raiz.setAttribute("aria-label", "Voodi aguarda o jogador. Clique nele para começar.");
  raiz.innerHTML =
    '<canvas></canvas><div id="voidd-logo" aria-hidden="true"><div id="voidd-marca">' +
    `<img id="voidd-v" src="${ARTE_V}" alt=""><span id="voidd-oslot"></span><img id="voidd-idd" src="${ARTE_IDD}" alt="">` +
    '</div><div id="voidd-mundo"><span>WORLD</span></div></div><div id="voidd-pular">Clique no Voodi para começar</div>';
  document.body.appendChild(raiz);
  let cena: ReturnType<typeof montarCena>;
  try {
    cena = montarCena(raiz);
  } catch (e) {
    console.warn("vinheta Voidd sem WebGL:", e);
    raiz.remove();
    pronto();
    fim();
    return;
  }
  VOIDD.aberta = true;
  // a tela de título fica escondida enquanto a vinheta toca: as animações dela (fundo, neblina, brilhos) custam
  // quadros, e a vinheta só começa com quadros estáveis (48_v7.7_voidd.css, html.voidd-tocando)
  document.documentElement.classList.add("voidd-tocando");
  let raf = 0,
    antes = -1,
    esperou = 0,
    estaveis = 0,
    ta = -1, // tempo da vinheta (s); -1 = ainda esperando o jogo acabar de carregar
    saindo = false,
    iniciou = false,
    ocioso = 0,
    ultimoQuadroOcioso = 0;
  const aoMover = (e: PointerEvent) => {
    cena.ponteiro.x = e.clientX;
    cena.ponteiro.y = e.clientY;
  };
  const aoTecla = (e: KeyboardEvent) => {
    // por cima da tela de título: a tecla só pula a vinheta (não acorda o menu nem chega ao jogo)
    // antes de começar (capa de carregamento por cima) a tecla é engolida mas não pula: quem aperta algo enquanto o
    // jogo carrega não perde a vinheta
    e.stopImmediatePropagation();
    e.preventDefault();
    if (!e.repeat && ta >= 0) acionar();
  };
  const aoClicar = (e: PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (ta >= 0) acionar();
  };
  function acionar() {
    if (saindo) return;
    if (!iniciou) {
      iniciou = true;
      ta = 0;
      musicStart("calm");
      raiz.classList.add("iniciando");
      raiz.querySelector<HTMLElement>("#voidd-pular")!.textContent = "Clique para pular";
    } else sair();
  }
  function sair() {
    if (saindo) return;
    saindo = true;
    raiz.classList.add("saindo");
    document.documentElement.classList.remove("voidd-tocando"); // o título aparece por baixo do esmaecer
    window.removeEventListener("keydown", aoTecla, true);
    setTimeout(() => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", cena.dimensionar);
      removeEventListener("pointermove", aoMover);
      cena.descartar();
      raiz.remove();
      VOIDD.aberta = false;
      VOIDD.pular = VOIDD.ir = null;
      fim();
    }, VINHETA.saida);
  }
  VOIDD.pular = sair;
  VOIDD.ir = (t) => {
    if (ta < 0) pronto();
    ta = t;
    iniciou = true;
  };
  addEventListener("resize", cena.dimensionar);
  addEventListener("pointermove", aoMover);
  window.addEventListener("keydown", aoTecla, true);
  raiz.addEventListener("pointerdown", aoClicar);
  function quadro(agora: number) {
    raf = requestAnimationFrame(quadro);
    const real = antes < 0 ? 0 : (agora - antes) / 1000;
    antes = agora;
    if (ta < 0) {
      // depois do script, o jogo ainda segura o processador (imagens do mapa, shaders): a capa de CSS continua por
      // cima, desenhando o quadro 0 embaixo, até VINHETA.estaveis quadros seguidos sem engasgo (ou VINHETA.espera s)
      esperou += real;
      estaveis = real > 0 && real < VINHETA.quadroOk ? estaveis + 1 : 0;
      cena.desenhar(0, 0, 0);
      if (estaveis < VINHETA.estaveis && esperou < VINHETA.espera) return;
      ta = 0;
      pronto();
      musicStart("calm"); // tenta tocar enquanto o Voodi aguarda; o clique retoma se o navegador bloquear autoplay
      return;
    }
    if (!iniciou) {
      // Olhar em sacadas curtas, no pulso de seis segundos da música; a tela fica econômica enquanto aguarda.
      ocioso += real;
      if (agora - ultimoQuadroOcioso >= 66) {
        const fase = ((ocioso % 6) / 6) * Math.PI * 2,
          olhar = 2.45 + 0.45 * (0.5 + 0.5 * Math.sin(fase));
        cena.desenhar(olhar, ocioso, Math.min(0.1, Math.max(real, 1 / 60)));
        ultimoQuadroOcioso = agora;
      }
      return;
    }
    // o tempo anda por quadro (no máximo 1/10 s): um engasgo pausa a vinheta em vez de pular cenas
    const dt = Math.min(0.1, real);
    ta += dt;
    cena.desenhar(Math.min(VINHETA.dur, ta), ta, dt);
    if (ta > VINHETA.dur + VINHETA.parado) sair();
  }
  raf = requestAnimationFrame(quadro);
}
