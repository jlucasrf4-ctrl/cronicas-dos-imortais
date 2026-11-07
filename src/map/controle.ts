/* ==== Fase 4 — controle no mapa: clique para andar, WASD, balão (v6.4) ==== */
import { world, econ, TELAS, camera } from "../core/state.ts";
import { campPos, nearCamp, enterCamp } from "../survival/acampamento.ts";
import { docaCaca } from "./vila_musgo.ts";
import { termiteAt } from "../sim/cupinzeiros.ts";
import { CITIES } from "../data/economia.ts";
import { wildAnteaters } from "../creatures/tamandua.ts";
import { runePickAt } from "../runas/runas.ts";
import { pickWildAt, pickNodeAt } from "../sim/fauna.ts";
import { pickAnimalAt } from "./render.ts";
import { mapTip } from "../intro/cena.ts";
import type { Hero, Ponto } from "../core/tipos.ts";

/* ---------- MAPA: clique para andar, WASD, balão que já executa ---------- */
export const MAPCTL = {
  sel: null as string | null,
  keys: {} as Record<string, boolean>,
  last: 0,
  down: null as Ponto | null,
  clickT: 0,
  bal: null as { x: number; y: number; w: number; h: number; t: number; kind: string; hero: string | undefined } | null,
};
export function mapHero() {
  const ok = (h: Hero | undefined) => h && (h.state === "idle" || h.state === "field" || h.state === "walking");
  let h = world.heroes.find((x) => x.id === MAPCTL.sel);
  if (ok(h)) return h;
  h = world.heroes.find((x) => x.state === "field" || x.state === "walking");
  if (h) return h;
  return world.heroes.find((x) => x.state === "idle") || null;
}

/* balão sobre o acampamento no tutorial ("Entrar no acampamento") — tocar no balão já executa */
/* balão do acampamento no tutorial e alvo do clique (MAPCTL.bal) (campDraw chama); v7.7: depois do tutorial
   o balão é o de avisos (campDrawExpedicao em ui/menu_base.ts), que cuida do MAPCTL.bal */
export function campDrawBalao() {
  const p = campPos();
  if (!p || econ.campTut !== 1) return;
  const hf = mapHero();
  const c = TELAS.ctx,
    t = performance.now() / 1000,
    k = Math.max(0.6, Math.min(1.6, 1.2 / Math.sqrt(camera.scale / camera.minScale / 4))),
    y = p.y - 26 * k + Math.sin(t * 2.4) * 2 * k;
  const txt = "⛺ Entrar no acampamento";
  c.save();
  c.font = "600 " + 9 * k + "px Cinzel, Lora, serif";
  const w = c.measureText(txt).width + 10 * k,
    hh = 14 * k;
  c.fillStyle = "rgba(40,26,10,.92)";
  c.strokeStyle = "#7dff9a";
  c.lineWidth = 1.2 * k;
  c.beginPath();
  c.roundRect(p.x - w / 2, y - hh / 2, w, hh, 6 * k);
  c.fill();
  c.stroke();
  c.fillStyle = "#d8ffd8";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(txt, p.x, y + 0.5 * k);
  c.restore();
  MAPCTL.bal = { x: p.x, y, w, h: hh, t: performance.now(), kind: "camp", hero: hf ? hf.id : undefined };
}

export function mapW(e: PointerEvent) {
  const vp = document.getElementById("viewport"),
    r = vp!.getBoundingClientRect();
  return { x: (e.clientX - r.left - camera.tx) / camera.scale, y: (e.clientY - r.top - camera.ty) / camera.scale };
}
export function mapHitsSomething(wx: number, wy: number) {
  /* v7.5 — clique na doca da área de caça: atravessa (ou anda até ela) */
  {
    const D = docaCaca();
    if (D && Math.hypot(D.x - wx, D.y - wy) < Math.max(12, 18 / camera.scale)) return true;
  }
  try {
    if (
      world.heroes.some(
        (h) => h.state !== "indungeon" && Math.hypot(h.x - wx, h.y - wy) < Math.max(12, 18 / camera.scale),
      )
    )
      return true;
    if (nearCamp(wx, wy)) return true;
    if (termiteAt(wx, wy)) return true;
    if (runePickAt(wx, wy) || pickWildAt(wx, wy) || pickNodeAt(wx, wy) || pickAnimalAt(wx, wy)) return true;
    if (CITIES.find((c) => Math.hypot(c.x - wx, c.y - 12 - wy) < Math.max(14, 22 / camera.scale))) return true;
    {
      const L = wildAnteaters() || [];
      if (L.some((a) => Math.hypot(a.x! - wx, a.y! - wy) < 12)) return true;
    }
  } catch (_) {}
  return false;
}
export function mapGoCamp(h: Hero) {
  if (!h || !h.camp) return;
  if (h.state === "idle") {
    enterCamp(h);
    return;
  }
  h.walkTo = { x: h.camp.x, y: h.camp.y };
  h.task = null;
  h.state = "walking";
  h._enterCamp = true;
  mapTip("⛺ " + h.name + " está indo para o acampamento");
}
export function balHit(wx: number, wy: number) {
  const B = MAPCTL.bal;
  return (
    B &&
    performance.now() - B.t < 600 &&
    wx >= B.x - B.w / 2 - 2 &&
    wx <= B.x + B.w / 2 + 2 &&
    wy >= B.y - B.h / 2 - 3 &&
    wy <= B.y + B.h / 2 + 3
  );
}
