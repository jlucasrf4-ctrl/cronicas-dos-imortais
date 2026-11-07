/* ==== Fase 4 — desempenho: resolução 3D automática, sombras, menos bichos (v5.7, v6.6) ==== */
import { world, OPT, TELAS, GL3, dungeon } from "../core/state.ts";
import type { ItemDesenhoGL } from "../core/state.ts";
import { campPos } from "../survival/acampamento.ts";
import { sheet } from "../ui/ficha.ts";
import { FG } from "../forja/forja.ts";
import { RA } from "../runas/absorcao.ts";
import { SPECIES } from "../data/especies.ts";
import { VIS_MAPA } from "../data/campo.ts";
import { profLv } from "../hero/proficiencias.ts";
import type { Ponto } from "../core/tipos.ts";
import type { Mat4 } from "./gl/geometria.ts";

export function visCenters() {
  const L = [];
  for (const h of world.heroes) if (h.state !== "indungeon") L.push(h);
  if (!L.length) {
    const p = campPos();
    if (p) L.push(p);
  }
  return L;
}

/* =====================================================================
   v5.7 — OTIMIZAÇÕES DE DESEMPENHO
   1. Resolução 3D automática: se o jogo cair abaixo de ~40 fps, a cena 3D
      é desenhada em resolução menor (até 60%) e esticada; volta ao normal
      quando sobra folga. A interface (textos, números) continua nítida.
   2. Sombra estática em cache: árvores, pedras e cenário são desenhados no
      mapa de sombras UMA vez por masmorra; a cada quadro só os que se mexem.
   3. Menos polígonos no chão longe da arena.
   4. Com mochila/ficha/craft abertos, a cena 3D atualiza a ~15 fps (economiza bateria).
   5. Cores do mapa em cache (menos texto convertido por quadro).
===================================================================== */
export const PERF = { rs: 1, t0: 0, n: 0, low: 0, high: 0, fps: 60, last: 0 };
function perfAuto() {
  return OPT.autoRes !== false;
}
export function perfFrame(now: number) {
  // chamado a cada quadro 3D
  if (!PERF.last) {
    PERF.last = now;
    PERF.t0 = now;
    return;
  }
  PERF.n++;
  PERF.last = now;
  const el = now - PERF.t0;
  if (el < 500) return;
  PERF.fps = (PERF.n * 1000) / el;
  PERF.n = 0;
  PERF.t0 = now;
  if (!perfAuto()) {
    if (PERF.rs !== 1) PERF.rs = 1;
    return;
  }
  if (document.hidden) return;
  if (PERF.fps < 40) {
    PERF.low += el;
    PERF.high = 0;
    if (PERF.low >= 1500 && PERF.rs > 0.6) {
      PERF.rs = Math.max(0.6, +(PERF.rs - 0.15).toFixed(2));
      PERF.low = 0;
    }
  } else if (PERF.fps > 56) {
    PERF.high += el;
    PERF.low = 0;
    if (PERF.high >= 5000 && PERF.rs < 1) {
      PERF.rs = Math.min(1, +(PERF.rs + 0.1).toFixed(2));
      PERF.high = 0;
    }
  } else {
    PERF.low = 0;
    PERF.high = 0;
  }
}
export function perfW() {
  return Math.max(1, Math.round(TELAS.dCanvas.width * PERF.rs));
}
export function perfH() {
  return Math.max(1, Math.round(TELAS.dCanvas.height * PERF.rs));
}
// cena estática marcada (para o cache de sombra)
export function glShadowPass(LV: Mat4) {
  const gl = GL3.gl,
    SM = GL3.SM,
    L = GL3.list;
  const drawCast = (pred: (it: ItemDesenhoGL) => boolean | undefined) => {
    for (const it of L) {
      if (!it.cast || !pred(it)) continue;
      gl.uniformMatrix4fv(GL3.SU.uM, false, it.M);
      gl.bindVertexArray(it.mesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, it.mesh.n);
    }
  };
  const stat = L.filter((it) => it.cast && it.mesh.stat);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(GL3.sprog);
  gl.uniformMatrix4fv(GL3.SU.uL, false, LV);
  if (stat.length && !GL3.noSCache) {
    if (!GL3.sfbo) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SM, SM);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        GL3.noSCache = true;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return glShadowPass(LV);
      }
      GL3.sfbo = f;
      GL3.stexS = t;
      GL3.sKey = "";
    }
    let key = stat.map((it) => it.mesh.uid).join(",");
    for (let i = 0; i < 16; i++) key += "|" + LV[i].toFixed(3);
    if (GL3.sKey !== key) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.sfbo);
      gl.viewport(0, 0, SM, SM);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(2, 4);
      drawCast((it) => it.mesh.stat);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      GL3.sKey = key;
      GL3.sBuilds = (GL3.sBuilds || 0) + 1;
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GL3.sfbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GL3.fbo);
    gl.blitFramebuffer(0, 0, SM, SM, 0, 0, SM, SM, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.fbo);
    gl.viewport(0, 0, SM, SM);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    drawCast((it) => !it.mesh.stat);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.fbo);
    gl.viewport(0, 0, SM, SM);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    drawCast(() => true);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
}
export function perfPausedView() {
  const d = dungeon;
  return !!(
    // v8.0: a mochila ao lado (zoom máximo) deixa a cena à vista: ela anda normal
    (d.invOpen && !document.getElementById("inv-modal")?.classList.contains("lateral")) ||
    d.modalOpen ||
    d.craftOpen ||
    (typeof sheet !== "undefined" && sheet.open) ||
    (typeof FG !== "undefined" && FG.open) ||
    (typeof RA !== "undefined" && RA.open)
  );
}

export function popTrim() {
  try {
    for (const k of ["rabbit", "deer", "wolf", "boar"]) {
      const sp = SPECIES[k];
      if (!sp) continue;
      const L = world.animals.filter((a) => a.alive && a.species === k);
      let over = L.length - sp.carryingCapacity;
      while (over-- > 0) {
        const a = L.splice(Math.floor(Math.random() * L.length), 1)[0];
        a.alive = false;
      }
    }
    world.animals = world.animals.filter((a) => a.alive);
  } catch (_) {}
}
export function visK(x: number, y: number, C: Ponto[]) {
  let best = 1e9;
  for (const c of C) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < best) best = d;
  }
  const R = VIS_MAPA.perto + 6 * (world.heroes[0] ? profLv(world.heroes[0], "percepcao") : 0);
  return best <= R
    ? 1
    : best >= R + (VIS_MAPA.some - VIS_MAPA.perto)
      ? 0
      : 1 - (best - R) / (VIS_MAPA.some - VIS_MAPA.perto);
}
/* v7.7 — o retângulo do mundo que aparece na tela, medido uma vez por quadro (renderFrame): quem desenha no mapa pula
   o que está fora (antes, as 1.330 plantas e todos os bichos eram desenhados a cada quadro, na tela ou não) */
const VISTA = { x0: 0, y0: 0, x1: 0, y1: 0 };
export function medirVista(vw: number, vh: number, s: number, tx: number, ty: number) {
  VISTA.x0 = -tx / s;
  VISTA.y0 = -ty / s;
  VISTA.x1 = VISTA.x0 + vw / s;
  VISTA.y1 = VISTA.y0 + vh / s;
}
/** O ponto (com margem m, em unidades do mundo) aparece na tela? */
export function naVista(x: number, y: number, m = 24) {
  return x > VISTA.x0 - m && x < VISTA.x1 + m && y > VISTA.y0 - m && y < VISTA.y1 + m;
}
export function farDot(x: number, y: number, col: string) {
  TELAS.ctx.save();
  TELAS.ctx.globalAlpha = 0.55;
  TELAS.ctx.fillStyle = col || "#cfc6a8";
  TELAS.ctx.beginPath();
  TELAS.ctx.arc(x, y, 1.8, 0, 6.283);
  TELAS.ctx.fill();
  TELAS.ctx.restore();
}
