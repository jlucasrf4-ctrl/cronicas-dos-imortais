/* ==== v8.1 — Modo Editor: a decoração no campo 3D (renderer.ts glFrame chama), aberta ou fechada a janela do editor ====
   As peças da cena atual (cenaAtual: o campo aberto, a vila, o acampamento, a sala de treino) entram na lista de desenho
   como qualquer modelo: no lugar, giradas, na escala, com a cor por cima; no campo aberto sobem no relevo sozinhas
   (erguerNoRelevo). As luzes vão para as luzes de fogueira do shader (GL3.fogos), os efeitos são partículas
   translúcidas e a prévia de estação pinta o chão e faz cair pétalas, folhas ou neve (só no editor). */
import { GL3, dungeon } from "../core/state.ts";
import { M4 } from "../render/gl/geometria.ts";
import { glPush } from "../render/gl/renderer.ts";
import { gcol } from "../render/gl/malhas.ts";
import { decoFuncional, naVistaCampo } from "../render/gl/mundo_cena.ts";
import { cantoCampo } from "../map/mundo.ts";
import { D3 } from "../field/projecao.ts";
import { luzDoDia } from "../render/luz_do_dia.ts";
import { FOGO_LUZ } from "../data/mapa.ts";
import { CATEGORIAS, EFEITOS, ESTACOES, LUZES } from "../data/editor.ts";
import { ED, dadosVistos, type Deco } from "./estado.ts";
import { infoModelo, malhaModelo } from "./modelos.ts";
import { somAmbiente } from "./som.ts";
import { galeriaGLPush } from "./aparencias_qc.ts";
import type { Mat4 } from "../render/gl/geometria.ts";

/** A cena do campo em que se está agora (a chave em DadosEditor.cenas), ou null (expedições soltas, sem decoração). */
export function cenaAtual(): string | null {
  const d = dungeon;
  if (!d.active) return null;
  if (d.vila) return "vila";
  if (d.origem) return "mundo";
  if (d.camp) return "acamp";
  if (d.training) return "treino";
  return null;
}
/** Quanto tirar das coordenadas guardadas para chegar às do campo (no campo aberto, o canto da janela). */
export function cantoCena() {
  return (cenaAtual() === "mundo" && cantoCampo()) || { x: 0, y: 0 };
}
/** A camada da peça: a dela, ou a da categoria do modelo. */
export function camadaDe(p: Deco) {
  if (p.cam) return p.cam;
  const i = infoModelo(p.m);
  return i ? i.cam : CATEGORIAS.find((c) => c.id === "acamp")!.cam;
}
function pecasDaCena(cena = cenaAtual()) {
  return (cena && dadosVistos().cenas[cena]) || [];
}
/** A matriz da peça no campo (sem a altura do relevo, que o renderizador põe). */
function matrizPeca(p: Deco, c: { x: number; y: number }): Mat4 {
  return M4.ch(M4.T(p.x - c.x, (p.y || 0) + (p.pavimento || 0) * 84, p.z - c.y), M4.RY(p.g || 0), M4.S(p.e || 1));
}

/** Contorno de quem está selecionado (dourado) e de quem está sob o cursor (branco). */
const CONTORNO = { sel: [1, 0.8, 0.25], selEsp: 2.2, sob: [0.96, 0.94, 0.88], sobEsp: 1.3 };
export const SOB = { id: 0 };

/** Põe as peças da cena atual na lista de desenho e as luzes nas luzes de fogueira (renderer.ts glFrame). */
export function decoGLPush() {
  const cena = cenaAtual();
  if (!cena || !GL3.gl) return;
  const c = cantoCena(),
    lista = pecasDaCena(cena).filter((p) => !ED.on || (p.pavimento || 0) === ED.pavimento),
    ocultas = ED.on ? ED.camadasOcultas : null;
  for (const p of lista) {
    if (ocultas && ocultas.has(camadaDe(p))) continue;
    if (!naVistaCampo(p.x - c.x, p.z - c.y)) continue;
    luzDaPeca(p, c);
    if (p.m.startsWith("luz:") || p.m.startsWith("fx:") || p.m.startsWith("som:")) continue;
    if (!ED.on && cena === "mundo" && decoFuncional(p.m)) continue; // v8.1: dentro do cenário, cortável (mundo_cena.ts)
    empurrar(p, c, null);
  }
  if (ED.on) for (const f of ED.fantasmas) if (!/^(luz|fx|som):/.test(f.m)) empurrar(f, c, [0.55, 0.85, 1, 0.35]);
  if (ED.on) galeriaGLPush(c);
  if (ED.on && ED.estacao && cena !== "mundo") tingirEstacao();
  const agora = performance.now(),
    dt = Math.min(0.1, (agora - (SOM.ultimo || agora)) / 1000);
  SOM.ultimo = agora;
  somAmbiente(ED.on && ED.camadasOcultas.has("sons") ? [] : lista, c.x + D3.cx, c.y + D3.cz, dt);
}
/** quando o campo desenhou pela última vez (sem campo, iniciarEditor cala os sons de área) */
export const SOM = { ultimo: 0 };
function empurrar(p: Deco, c: { x: number; y: number }, tintFixo: number[] | null) {
  const mm = malhaModelo(p.m);
  if (!mm) return;
  const tom = p.tom && (p.tomK ?? 0.5) > 0 ? [...gcol(p.tom), p.tomK ?? 0.5] : null;
  glPush(mm.mesh, matrizPeca(p, c), tintFixo || tom);
  const it = GL3.list[GL3.list.length - 1];
  if (ED.on && ED.selecionados.has(p.id)) {
    it.olCor = CONTORNO.sel;
    it.olEsp = CONTORNO.selEsp;
  } else if (ED.on && SOB.id === p.id) {
    it.olCor = CONTORNO.sob;
    it.olEsp = CONTORNO.sobEsp;
  } else it.noOl = true;
}
/** A luz de uma peça de luz (ou de uma peça com `luz`): o raio vira a força do ponto de luz da fogueira. */
function luzDaPeca(p: Deco, c: { x: number; y: number }) {
  const tipo = p.m.startsWith("luz:") ? p.m.slice(4) : null;
  const raio = p.luz || (tipo ? p.raio || LUZES[tipo]?.raio || 120 : 0);
  if (!raio) return;
  const k = Math.max(0.05, Math.min(1.6, (raio / FOGO_LUZ.raio - 0.4) / 0.6)) * (p.forca ?? 1);
  GL3.fogos.push([p.x - c.x, p.z - c.y, k]);
}
/** Prévia da estação nas arenas (vila, acampamento): o chão e o cenário fixo puxam para a cor da estação. No campo
 *  aberto o cenário é repintado de verdade (render/gl/estacao_cor.ts). */
function tingirEstacao() {
  const E = ESTACOES[ED.estacao];
  if (!E) return;
  for (const it of GL3.list) if (it.mesh.stat && !it.tint) it.tint = E.tom;
}

/* ---------- partículas: efeitos postos e o que cai do céu na prévia da estação ---------- */
interface Particula {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  vida: number;
  tam: number;
  cor: number[];
  brilha?: boolean;
  fase: number;
}
const PART = { lista: [] as Particula[], acum: new Map<number, number>(), ceu: 0, ultimo: 0, max: 1500 };

/** Anda as partículas e põe as novas (dt em segundos; tudo em px do campo absolutos). */
function passoParticulas(dt: number, c: { x: number; y: number }) {
  const L = PART.lista;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    q.t += dt;
    if (q.t >= q.vida) {
      L.splice(i, 1);
      continue;
    }
    q.x += q.vx * dt + Math.sin(q.t * 1.7 + q.fase) * dt * 4;
    q.y += q.vy * dt;
    q.z += q.vz * dt;
    if (q.y < 0) q.y = 0;
  }
  const [escuro] = luzDoDia();
  for (const p of pecasDaCena()) {
    if (!p.m.startsWith("fx:") || L.length > PART.max) continue;
    if (ED.on && ED.camadasOcultas.has(camadaDe(p))) continue;
    const F = EFEITOS[p.m.slice(3)];
    if (!F || !naVistaCampo(p.x - c.x, p.z - c.y)) continue;
    if (F.noite && escuro < 0.3 && !ED.on) continue;
    const r = p.raio ?? F.raio,
      n = (PART.acum.get(p.id) || 0) + F.porSeg * dt * (p.forca ?? 1) * Math.max(1, (r / F.raio) ** 2);
    let k = Math.floor(n);
    PART.acum.set(p.id, n - k);
    while (k-- > 0) {
      const a = Math.random() * Math.PI * 2,
        d = Math.sqrt(Math.random()) * r,
        vento = F.vento || 0;
      L.push({
        x: p.x + Math.cos(a) * d,
        y:
          (p.y || 0) +
          (F.sobe < 0 ? 40 + Math.random() * 30 : F.sobe === 0 ? 4 + Math.random() * 8 : 3 + Math.random() * 6),
        z: p.z + Math.sin(a) * d,
        vx: (Math.random() - 0.3) * vento,
        vy: F.sobe * (0.7 + Math.random() * 0.6),
        vz: (Math.random() - 0.5) * vento * 0.6,
        t: 0,
        vida: F.vida * (0.7 + Math.random() * 0.6),
        tam: F.tam[0] + Math.random() * (F.tam[1] - F.tam[0]),
        cor: F.cor,
        brilha: F.brilha,
        fase: Math.random() * 6.28,
      });
    }
  }
  // a estação: cai do céu em volta da câmera
  const E = ED.on && ED.estacao ? ESTACOES[ED.estacao] : null;
  if (E?.cai) {
    const vw = D3.cw / (D3.s || 1),
      vh = D3.ch / ((D3.SIN || 1) * (D3.s || 1));
    PART.ceu += E.cai.n * dt;
    while (PART.ceu >= 1 && L.length < PART.max) {
      PART.ceu--;
      L.push({
        x: c.x + D3.cx + (Math.random() - 0.5) * vw * 1.2,
        y: 90 + Math.random() * 60,
        z: c.y + D3.cz + (Math.random() - 0.5) * vh * 1.4,
        vx: 6 + Math.random() * 6,
        vy: -E.cai.vel * (0.7 + Math.random() * 0.6),
        vz: (Math.random() - 0.5) * 6,
        t: 0,
        vida: 6,
        tam: E.cai.tam[0] + Math.random() * (E.cai.tam[1] - E.cai.tam[0]),
        cor: E.cai.cor,
        fase: Math.random() * 6.28,
      });
    }
  }
}

/** Desenha as partículas (depois da cena opaca, renderer.ts glFrame), quadradinhos virados para a câmera. */
export function efeitosGL(VP: Mat4) {
  const gl = GL3.gl,
    vao = GL3.tvao,
    tb = GL3.tb;
  if (!gl || !GL3.tprog || !vao || !tb || !cenaAtual()) return;
  const agora = performance.now(),
    dt = Math.min(0.05, (agora - (PART.ultimo || agora)) / 1000);
  PART.ultimo = agora;
  const c = cantoCena();
  passoParticulas(dt, c);
  if (!PART.lista.length) return;
  const [escuro] = luzDoDia(),
    P: number[] = [],
    C: number[] = [],
    // para a câmera: x da tela = x do mundo; "para cima" da tela = (0, cos, −sen) do mundo
    up = [0, D3.COS || 0.7, -(D3.SIN || 0.7)];
  for (const q of PART.lista) {
    const x = q.x - c.x,
      z = q.z - c.y,
      s = q.tam,
      vida = q.t / q.vida,
      fade = Math.min(1, q.t * 3) * Math.min(1, (1 - vida) * 2.5),
      pisca = q.brilha ? 0.6 + 0.4 * Math.sin(agora / 180 + q.fase * 5) : 1,
      a = q.cor[3] * fade * pisca * (q.brilha ? 1 : 1 - escuro * 0.5),
      luz = q.brilha ? 1 : 1 - escuro * 0.55;
    const canto = (sx: number, sy: number) => {
      P.push(x + sx * s, q.y + up[1] * sy * s, z + up[2] * sy * s);
      C.push(Math.min(1, q.cor[0] * luz), Math.min(1, q.cor[1] * luz), Math.min(1, q.cor[2] * luz), a);
    };
    canto(-1, -1);
    canto(1, -1);
    canto(1, 1);
    canto(-1, -1);
    canto(1, 1);
    canto(-1, 1);
  }
  gl.useProgram(GL3.tprog);
  gl.uniformMatrix4fv(GL3.tVP!, false, VP);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, tb[0]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, tb[1]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(C), gl.DYNAMIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES, 0, P.length / 3);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}
