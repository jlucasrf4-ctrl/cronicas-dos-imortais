/* ==== Fase 4 — moitas: esconderijos dos lobos (v6.4) ==== */
import { dungeon, GL3 } from "../core/state.ts";
import { MB, mbIco, glMesh } from "../render/gl/malhas.ts";
import { M4 } from "../render/gl/geometria.ts";
import { glPush } from "../render/gl/renderer.ts";
import { inExitZone } from "./masmorra.ts";
import { MOITA } from "../data/campo.ts";

export function inMoita() {
  const d = dungeon;
  return (d.bushes || []).find((b) => Math.hypot(d.px - b.x, d.py - b.y) <= b.r) || null;
}
function moitaMesh() {
  if (GL3.mesh.moita) return GL3.mesh.moita;
  const b = MB(),
    G = ["#3f6b2a", "#4f7d33", "#5f8f3a", "#36602a", "#6a9a40"];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283,
      r = i ? 5 + (i % 3) * 1.5 : 0;
    mbIco(
      b,
      M4.ch(
        M4.T(Math.cos(a) * r, 5 + (i % 2) * 2.5, Math.sin(a) * r),
        M4.S(7.5 + (i % 3) * 1.6, 6.5 + (i % 4), 7.5 + (i % 2) * 1.8),
      ),
      G[i % G.length],
      0,
      0.45,
      0.06,
    );
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.283 + 0.4;
    mbIco(
      b,
      M4.ch(M4.T(Math.cos(a) * 9, 10 + (i % 2) * 2, Math.sin(a) * 9), M4.S(3.2, 2.6, 3.2)),
      i % 2 ? "#86b34e" : "#7aa847",
      0,
      0.5,
      0.05,
    );
  }
  return (GL3.mesh.moita = glMesh(b));
}
export function moitaPushRing(cx: number, cy: number, R: number, seed: number, inside: boolean, full: boolean) {
  const n = full ? 7 : 8,
    ms = moitaMesh(),
    t = performance.now() / 1000;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + seed,
      rr = full ? (i ? R * 0.62 : 0) : R * 0.92,
      s = 0.95 + ((i * 37 + seed * 10) % 7) / 18,
      sway = Math.sin(t * 1.3 + i + seed) * 0.04;
    glPush(
      ms,
      M4.ch(M4.T(cx + Math.cos(a) * rr, 0, cy + Math.sin(a) * rr), M4.RY(a * 2 + seed), M4.RZ(sway), M4.S(s)),
      inside ? [1, 1, 1, 0.45] : null,
      !inside,
    );
  }
}
/* anéis das moitas e da saída na expedição (armasGLPush chama) */
export function moitasGL() {
  const d = dungeon;
  if (!d.active || d.camp || d.mode !== "expedition") return;
  const T = d.tile,
    m = inMoita();
  for (const b of d.bushes || []) moitaPushRing(b.x, b.y, b.r, b.seed, m === b, true);
  if (d.entrance) moitaPushRing(d.entrance.x, d.entrance.y, T * 1.55, 0.3, inExitZone(), false);
}

/* ==== v6.4 — moitas (zona segura), cena própria na criação, saída da cena inicial para o mapa, mapa com clique/WASD, balão que executa, tutorial do acampamento ==== */
/* ---------- MOITAS: esconderijos (os lobos não te veem); só a moita da entrada leva de volta ao mapa ---------- */
export function moitaSpawn() {
  const d = dungeon,
    T = d.tile;
  d.bushes = [];
  let tries = 0;
  while (d.bushes.length < MOITA.n && tries++ < 200) {
    const x = T * 2.5 + Math.random() * (d.cols * T - T * 5),
      y = T * 2.2 + Math.random() * (d.rows * T - T * 4.4);
    if (Math.hypot(x - d.entrance.x, y - d.entrance.y) < T * 6) continue;
    if (d.bushes.some((b) => Math.hypot(b.x - x, b.y - y) < T * 5)) continue;
    if ((d.runes || []).some((r) => r && Math.hypot((r.x || 0) - x, (r.y || 0) - y) < T * 4)) continue;
    d.bushes.push({ x, y, r: T * MOITA.r, seed: Math.random() * 99 });
  }
}
