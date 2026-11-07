/* ==== Fase 4 — modos Jogo (sala em 3D) ⇄ Mapa pela roda do mouse (v6.5) ==== */
import { world, econ, camera, dungeon } from "../core/state.ts";
import { ZOOM_MAPA } from "../data/mapa.ts";
import { profLv } from "../hero/proficiencias.ts";
import { inMoita, moitaPushRing } from "../field/moitas.ts";
import { inExitZone } from "../field/masmorra.ts";
import { mapHero } from "../map/controle.ts";
import { entrarNoCampo } from "../map/transicao.ts";
import type { Hero, Ponto } from "../core/tipos.ts";

export function mapZoomLimit() {
  const h = world.heroes[0];
  let b = 1;
  try {
    if (h) b += ZOOM_MAPA.perc * profLv(h, "percepcao") + ZOOM_MAPA.cart * profLv(h, "cartografia");
  } catch (_) {}
  b += ZOOM_MAPA.mapa * (econ.mapas! | 0);
  return Math.max(camera.minScale, (camera.minScale * ZOOM_MAPA.base) / b);
}

/* anéis das moitas e da saída no Campo (armasGLPush chama) */
export function campoMoitasGL() {
  const d = dungeon;
  if (!d.active || d.mode !== "campo") return;
  const m = inMoita();
  for (const b of d.bushes || []) moitaPushRing(b.x, b.y, b.r, b.seed, m === b, true);
  if (d.entrance) moitaPushRing(d.entrance.x, d.entrance.y, d.tile * 1.55, 0.3, inExitZone(), false);
}

/* ---------- MODOS: Jogo (sala em 3D) ⇄ Mapa, pela roda do mouse ---------- */
interface EstadoJOGO {
  pending: boolean;
  hero: Hero | null;
  pos: Ponto | null;
  wheel: number;
  wt: number;
  inPush: number;
  inT: number;
  // acrescentados depois
  alvo?: string | null; // v7.7: a heroína do anel da rodinha (selecionada, com o cursor nela)
}
export const JOGO: EstadoJOGO = { pending: false, hero: null, pos: null, wheel: 0, wt: 0, inPush: 0, inT: 0 };
/** Entra no campo com a heroína do mapa (o fim da abertura e os testes). v7.7: a troca é a de map/transicao.ts; pela
    roda e pelo E só vale a heroína selecionada (map/camera.ts, map/selecao.ts). */
export function jogoEnter() {
  const h = mapHero();
  if (h) entrarNoCampo(h);
}
