/* ==== Fase 4 — câmera do mapa: mundo -> tela, zoom, limites, seguir o personagem (base/01, v5.8, v7.6) ==== */
import { mapHero } from "./controle.ts";
import { mapZoomLimit, JOGO } from "../ui/modos.ts";
import { heroiParaEntrar, avisoEntrar, entrarNoCampo } from "./transicao.ts";
import { econ, TELAS, camera, dungeon } from "../core/state.ts";
import { visCenters } from "../render/desempenho.ts";
import { campPos } from "../survival/acampamento.ts";
import { musgoCity } from "./vila_musgo.ts";
import { clamp } from "../core/util.ts";
import { CONFIG } from "../core/config.ts";
import { mapTip } from "../intro/cena.ts";
import { QUAD } from "./quadrantes.ts";
import { camadaLadrilhos } from "./vetorial.ts";

/* ==== v7.6 — mapa: câmera segue o personagem · névoa no lugar do limite de zoom · anel da rodinha para entrar no campo · caminho até o destino ==== */
export const SEGUIR = { k: 6, solto: false, btn: null as HTMLButtonElement | null };
export function segueHeroi() {
  const h = mapHero();
  return h && h.state !== "indungeon" ? h : null;
}
export function segueBtn(show: boolean) {
  let b = SEGUIR.btn;
  if (!b) {
    b = SEGUIR.btn = document.createElement("button");
    b.id = "segue-btn";
    b.className = "btn";
    b.textContent = "📍 Seguir a heroína (F)";
    b.onclick = (e) => {
      e.stopPropagation();
      SEGUIR.solto = false;
      segueBtn(false);
    };
    const vp = document.getElementById("viewport");
    (vp || document.body).appendChild(b);
  }
  b.classList.toggle("on", !!show);
}
export const vp0 = () => document.getElementById("viewport");
/* sem parede de zoom: dá para afastar até o mapa todo, mas o que está longe fica na névoa */
export const zoomLimitOff = true;
export function nevoaRaio() {
  const vp = document.getElementById("viewport"),
    lim = mapZoomLimit();
  return Math.hypot(vp!.clientWidth, vp!.clientHeight) / 2 / lim;
}
export function nevoaCentros() {
  const L = visCenters().map((p) => ({ x: p.x, y: p.y }));
  const c = campPos();
  if (c) L.push({ x: c.x, y: c.y });
  try {
    const v = musgoCity();
    if (v && econ.musgoVisto) L.push({ x: v.x, y: v.y });
  } catch (_) {}
  return L;
}
/* camada de cima do mapa: névoa, caminho e anel da rodinha */
interface EstadoMAPFX2 {
  cv: HTMLCanvasElement | null;
  c: CanvasRenderingContext2D | null;
  // acrescentados depois
  t?: number;
}
export const MAPFX2: EstadoMAPFX2 = { cv: null, c: null };
export function mapfx2Cv() {
  if (MAPFX2.cv) return MAPFX2.c;
  const vp = document.getElementById("viewport");
  if (!vp) return null;
  const cv = document.createElement("canvas");
  cv.id = "map-nevoa";
  vp.appendChild(cv);
  MAPFX2.cv = cv;
  MAPFX2.c = cv.getContext("2d");
  return MAPFX2.c;
}

export function constrainCamera() {
  // reescrita na v6.5
  const vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight,
    mw = TELAS.worldW * camera.scale,
    mh = TELAS.worldH * camera.scale,
    mx = Math.min(vw, vh) * 0.38;
  camera.tx = mw + 2 * mx <= vw ? (vw - mw) / 2 : clamp(camera.tx, vw - mw - mx, mx);
  camera.ty = mh + 2 * mx <= vh ? (vh - mh) / 2 : clamp(camera.ty, vh - mh - mx, mx);
}
export function applyCameraTransform() {
  const tr = "translate(" + camera.tx + "px," + camera.ty + "px) scale(" + camera.scale + ")";
  TELAS.stage.style.transform = tr;
  const lad = camadaLadrilhos(); // v7.7: os ladrilhos do mapa vetorial andam com o palco (map/vetorial.ts)
  if (lad) lad.style.transform = tr;
}
export const CAMF = {
  last: {} as Record<string, string>,
  anim: null as {
    s0: number;
    x0: number;
    y0: number;
    s1: number;
    x1: number;
    y1: number;
    t0?: number;
    t?: number;
  } | null,
};
/* v7.7 — as animações da câmera (zoom suave, centralizar, ir ao acampamento) andam no começo do quadro do laço
   principal (core/laco.ts), antes do desenho. Cada uma tinha o seu requestAnimationFrame, que rodava depois do desenho:
   os ladrilhos (CSS) já iam para a câmera nova e os bichos, a névoa e os nomes ficavam um quadro atrás, escorregando
   sobre o mapa no zoom. Uma animação devolve false quando termina. */
const ANIM_CAM = new Set<(now: number) => boolean>();
export function animarCamera(passo: (now: number) => boolean) {
  ANIM_CAM.add(passo);
}
export function passoCamera(now: number) {
  for (const f of [...ANIM_CAM]) if (!f(now)) ANIM_CAM.delete(f);
}
export function camPing(wx: number, wy: number) {
  const st = document.getElementById("stage");
  if (!st) return;
  const p = document.createElement("div");
  p.className = "cam-ping";
  p.style.left = wx + "px";
  p.style.top = wy + "px";
  p.innerHTML = "<i></i><b>📍</b>";
  p.style.setProperty("--k", (1 / Math.max(0.2, Math.max(camera.scale, camera.minScale * 2.2))).toFixed(3));
  st.appendChild(p);
  setTimeout(() => p.remove(), 3200);
}

/* ---------------------------------------------------------------------
   11. CÂMERA (mundo -> tela), idêntica em espírito ao Atlas
--------------------------------------------------------------------- */
export function resizeCanvas() {
  if (!TELAS.canvas || !TELAS.viewport) return;
  // v7.7: no máximo 2 pixels por ponto (era 3: numa tela de densidade 3, 2,25× os pixels a desenhar todo quadro, sem
  // diferença visível a essa densidade; a névoa já era limitada a 2)
  TELAS.canvasDpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(TELAS.viewport.clientWidth * TELAS.canvasDpr)),
    h = Math.max(1, Math.round(TELAS.viewport.clientHeight * TELAS.canvasDpr));
  if (TELAS.canvas.width !== w || TELAS.canvas.height !== h) {
    TELAS.canvas.width = w;
    TELAS.canvas.height = h;
  }
}

export function fitToScreen() {
  camera.zt = null;
  const vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight;
  camera.minScale = Math.max(vw / TELAS.worldW, vh / TELAS.worldH);
  const b = CONFIG.SIM_BOUNDS,
    pad = 16;
  camera.scale = clamp(Math.min((vw - pad * 2) / b.w, (vh - pad * 2) / b.h), camera.minScale, camera.maxScale);
  camera.tx = vw / 2 - (b.x + b.w / 2) * camera.scale;
  camera.ty = vh / 2 - (b.y + b.h / 2) * camera.scale;
  constrainCamera();
  applyCameraTransform();
}
export function zoomAt(factor: number, cx: number, cy: number) {
  // zoom suave: acumula um alvo e anima até ele (mantendo o ponto do cursor fixo)
  /* v6.5 */
  if (!dungeon.active && econ.introDone) {
    const cur = camera.zt || camera.scale,
      lo = mapZoomLimit();
    if (factor > 1 && cur >= camera.maxScale * 0.97) {
      // v7.7: só entra pela heroína selecionada com o cursor nela (map/transicao.ts)
      const alvo = heroiParaEntrar(cx, cy),
        now = performance.now();
      if (!alvo) {
        JOGO.inPush = 0;
        avisoEntrar();
        return;
      }
      if (now - JOGO.inT > 700 || JOGO.alvo !== alvo.id) JOGO.inPush = 0;
      JOGO.inT = now;
      JOGO.alvo = alvo.id;
      JOGO.inPush += factor - 1;
      if (JOGO.inPush > 0.45) {
        JOGO.inPush = 0;
        entrarNoCampo(alvo);
      }
      return;
    }
    if (!zoomLimitOff && cur * factor < lo) factor = lo / cur;
    if (!zoomLimitOff && Math.abs(factor - 1) < 1e-4 && factor <= 1) {
      mapTip("🗺 Este é o limite do seu mapa — Percepção, Cartografia ou mapas comprados deixam ver mais longe");
      return;
    }
  }
  camera.zt = clamp((camera.zt || camera.scale) * factor, camera.minScale, camera.maxScale);
  camera.zx = cx;
  camera.zy = cy;
  if (!camera.zanim) {
    camera.zanim = true;
    camera.zlast = null;
    animarCamera(zoomStep);
  }
}
function zoomStep(now: number) {
  if (!camera.zt) {
    camera.zanim = false;
    return false;
  }
  const dt = camera.zlast == null ? 0.016 : Math.min(0.05, (now - camera.zlast) / 1000);
  camera.zlast = now;
  const ls = Math.log(camera.scale),
    lt = Math.log(camera.zt),
    k = 1 - Math.exp(-dt * 13),
    ns = Math.abs(lt - ls) < 0.002 ? camera.zt : Math.exp(ls + (lt - ls) * k);
  applyZoom(ns, camera.zx!, camera.zy!);
  if (ns === camera.zt) {
    camera.zt = null;
    camera.zanim = false;
    return false;
  }
  return true;
}
export function applyZoom(newScale: number, cx: number, cy: number) {
  if (newScale === camera.scale) return;
  const rect = TELAS.viewport.getBoundingClientRect();
  const px = (cx - rect.left - camera.tx) / camera.scale;
  const py = (cy - rect.top - camera.ty) / camera.scale;
  camera.scale = newScale;
  camera.tx = cx - rect.left - px * camera.scale;
  camera.ty = cy - rect.top - py * camera.scale;
  constrainCamera();
  applyCameraTransform();
}
export function mapOverview() {
  return camera.scale < camera.minScale * 1.35;
}
export function camFocus(wx: number, wy: number) {
  const vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight,
    s1 = Math.max(camera.scale, Math.min(camera.maxScale, camera.minScale * 2.2));
  const a = {
    s0: camera.scale,
    x0: camera.tx,
    y0: camera.ty,
    s1,
    x1: vw / 2 - wx * s1,
    y1: vh / 2 - wy * s1,
    t: 0,
    t0: undefined as number | undefined,
  };
  CAMF.anim = a;
  camera.zt = null;
  // v7.7: 0,83 s pelo relógio (antes 1/50 por quadro: com o jogo a 20 fps, demorava 2,5 s)
  const step = (now: number) => {
    if (CAMF.anim !== a) return false;
    if (a.t0 == null) a.t0 = now;
    a.t = Math.min(1, (now - a.t0) / 830);
    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
    camera.scale = a.s0 + (a.s1 - a.s0) * e;
    camera.tx = a.x0 + (a.x1 - a.x0) * e;
    camera.ty = a.y0 + (a.y1 - a.y0) * e;
    constrainCamera();
    applyCameraTransform();
    if (a.t < 1) return true;
    CAMF.anim = null;
    return false;
  };
  animarCamera(step);
  camPing(wx, wy);
}
export function qValid(k: string) {
  if (!k) return null;
  const a = String(k).split(",").map(Number);
  return a[0] >= 0 && a[1] >= 0 && a[0] < QUAD.cols && a[1] < QUAD.rows ? k : null;
}
