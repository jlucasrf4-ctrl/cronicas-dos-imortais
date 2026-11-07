/* ==== Fase 4 — cupinzeiros espalhados pelo mapa (v5.9) ==== */
import { TELAS, world, camera } from "../core/state.ts";
import { isWaterCell } from "../map/agua.ts";
import type { Cupinzeiro } from "../core/tipos.ts";

/* ---- CUPINZEIROS espalhados pelo mapa (comida dos futuros tamanduás: montaria / baú que anda) ---- */
function termiteSeed() {
  const b = { x: 0, y: 0, w: TELAS.worldW, h: TELAS.worldH },
    out: Cupinzeiro[] = [];
  let tries = 0;
  const W = (x: number, y: number) =>
    isWaterCell(x, y) ||
    isWaterCell(x + 10, y) ||
    isWaterCell(x - 10, y) ||
    isWaterCell(x, y + 10) ||
    isWaterCell(x, y - 10);
  while (out.length < 34 && tries++ < 4000) {
    const x = b.x + 50 + Math.random() * (b.w - 100),
      y = b.y + 50 + Math.random() * (b.h - 100);
    if (W(x, y)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.y - y) < Math.min(b.w, b.h) / 9)) continue;
    if ((world.heroes || []).some((h) => h.camp && Math.hypot(h.camp.x - x, h.camp.y - y) < 60)) continue;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const xx = x + (i ? (Math.random() - 0.5) * 34 : 0),
        yy = y + (i ? (Math.random() - 0.5) * 24 : 0);
      if (!W(xx, yy))
        out.push({
          x: Math.round(xx),
          y: Math.round(yy),
          s: +(0.75 + Math.random() * 0.6).toFixed(2),
          k: Math.floor(Math.random() * 1000),
        });
    }
  }
  world.termites = out;
  return out;
}
export function termiteList() {
  return world.termites && world.termites.length ? world.termites : TELAS.worldW ? termiteSeed() : [];
}
export function termiteDraw() {
  const c = TELAS.ctx,
    L = termiteList(),
    sc = camera.scale,
    vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight,
    x0 = -camera.tx / sc - 20,
    y0 = -camera.ty / sc - 20,
    x1 = x0 + vw / sc + 40,
    y1 = y0 + vh / sc + 40;
  for (const t of L) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    const s = t.s,
      x = t.x,
      y = t.y,
      r = (i: number) => ((t.k * 9301 + i * 49297) % 233280) / 233280;
    c.fillStyle = "rgba(40,28,14,.28)";
    c.beginPath();
    c.ellipse(x + 1.5 * s, y + 0.6 * s, 6.5 * s, 2.4 * s, 0, 0, 6.283);
    c.fill();
    c.fillStyle = "#a0683a";
    c.beginPath();
    c.moveTo(x - 5.5 * s, y);
    c.quadraticCurveTo(x - 5 * s, y - 6 * s, x - 2.2 * s, y - 8 * s - r(1) * 2 * s);
    c.quadraticCurveTo(x - 0.6 * s, y - 13 * s - r(2) * 3 * s, x + 0.9 * s, y - 9.5 * s);
    c.quadraticCurveTo(x + 2.8 * s, y - 11 * s - r(3) * 2 * s, x + 3.6 * s, y - 6.5 * s);
    c.quadraticCurveTo(x + 5.6 * s, y - 3 * s, x + 5.5 * s, y);
    c.closePath();
    c.fill();
    c.fillStyle = "#7d4e2a";
    c.beginPath();
    c.moveTo(x + 0.9 * s, y - 9.5 * s);
    c.quadraticCurveTo(x + 2.8 * s, y - 11 * s - r(3) * 2 * s, x + 3.6 * s, y - 6.5 * s);
    c.quadraticCurveTo(x + 5.6 * s, y - 3 * s, x + 5.5 * s, y);
    c.lineTo(x + 1.5 * s, y);
    c.closePath();
    c.fill();
    c.fillStyle = "#3a2414";
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(x + (r(4 + i) - 0.5) * 6 * s, y - (2 + r(7 + i) * 6) * s, 0.55 * s, 0, 6.283);
      c.fill();
    }
  }
}
export function termiteAt(wx: number, wy: number) {
  return termiteList().find((t) => Math.hypot(t.x - wx, t.y - wy + 5 * t.s) < Math.max(7 * t.s, 10 / camera.scale));
}
