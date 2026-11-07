/* ==== Fase 4 — bornFromSeed: a semente decide afinidade, genética e atributos. Saiu de base/01 (v3.8) ==== */
import { rng32 } from "../core/rng.ts";
import { ATTR_DEFS, BIRTH, AFFINITIES, GENETICS } from "../data/nascimento.ts";
import type { Attrs, Nascimento } from "../core/tipos.ts";

export function bornFromSeed(seed: number): Nascimento {
  // determinístico: a mesma semente sempre nasce igual
  const r = rng32(seed),
    affIds = Object.keys(AFFINITIES),
    aff = affIds[Math.floor(r() * affIds.length)];
  const gl = Object.keys(GENETICS).filter((k) => GENETICS[k].aff === aff),
    gen = gl[Math.floor(r() * gl.length)],
    G = GENETICS[gen];
  const attrs = {} as Attrs,
    w: Record<string, number> = {};
  ATTR_DEFS.forEach((a) => {
    attrs[a.id] = BIRTH.base;
    w[a.id] = 1 + (G.bias[a.id] || 0) + r() * 0.8;
  });
  for (let p = BIRTH.pool; p > 0; p--) {
    const open = ATTR_DEFS.filter((a) => attrs[a.id]! < BIRTH.max),
      tot = open.reduce((s, a) => s + w[a.id], 0);
    let x = r() * tot,
      pick = open[open.length - 1];
    for (const a of open) {
      x -= w[a.id];
      if (x <= 0) {
        pick = a;
        break;
      }
    }
    attrs[pick.id]!++;
  }
  return { seed, aff, gen, attrs };
}
