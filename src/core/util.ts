/* ==== Fase 4 ====
   utilitários puros: clamp, angDiff (diferença de ângulos), esc (escapa HTML), hexToRgba (com cache), fmtClock
   (minutos -> HH:MM). Saíram de base/01, base/05 e base/16 */

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
const CACHE_RGBA = new Map(); // v5.7: cores do mapa em cache (até 5000)
export function hexToRgba(hex: string, alpha: string | number) {
  const k = hex + "|" + alpha;
  let v = CACHE_RGBA.get(k);
  if (v === undefined) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    v = "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    if (CACHE_RGBA.size < 5000) CACHE_RGBA.set(k, v);
  }
  return v;
}
export function fmtClock(min: number) {
  const h = Math.floor(min / 60) % 24,
    m = Math.floor(min % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
export function esc(x: string | number) {
  return String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
export function angDiff(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
