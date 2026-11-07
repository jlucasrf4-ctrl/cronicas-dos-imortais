/* ==== Fase 4 — caçar no mapa: área em volta do personagem, andar livre, alvos (v5.9.11, v5.9.13) ==== */
import { MEAT_SH } from "../data/arte.ts";
import { dungeon, econ, world, CACA, SEL } from "../core/state.ts";
import { ensureInv, canPlace } from "../items/inventario.ts";
import { meatDecor } from "../items/arte.ts";
import { formaA2 } from "../items/grade_a2.ts";
import { nodeReady } from "./recursos.ts";
import { HUNT_AREA_R, HUNT_MAX_START } from "../data/mapa.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mvToast } from "../ui/avisos.ts";
import { snapToLand } from "../sim/animais.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { huntLabel } from "../render/sprites.ts";
import { fishSpot, askWork, workVerb } from "../minijogos/trabalho.ts";
import type { Hero, Ponto } from "../core/tipos.ts";

/* mapa: círculo da área de caça e o caminho de quem está andando */
/* carnes menores: tamanho pelo animal e cresce um pouco com a raridade */
export function meatShape(an: string, t: number) {
  const a = (MEAT_SH[an] || MEAT_SH.lobo).map((r) => Array.from(r, (ch) => (ch === "#" ? 1 : 0)));
  let sh = formaA2("carne", a, false); // v7.7: sem dentes (items/grade_a2.ts)
  t = Math.min(2, t | 0);
  if (t >= 1) sh = sh.map((r) => r.concat([r[r.length - 1]]));
  if (t >= 2) sh = sh.concat([sh[sh.length - 1].slice()]);
  return sh;
}
/* aviso visual no mapa quando coleta/caça algo */
export const MAPFX: { h: Hero; x: number; y: number; txt: string; ico: string; t0: number }[] = [];
export function mapFloat(h: Hero, txt: string, ico: string) {
  if (!h || (typeof dungeon !== "undefined" && dungeon.active && dungeon.hero === h) || h.state === "indungeon") return;
  const n = MAPFX.filter((f) => f.h === h && performance.now() - f.t0 < 400).length;
  MAPFX.push({ h, x: h.x, y: h.y - 6 - n * 7, txt, ico, t0: performance.now() });
  if (MAPFX.length > 40) MAPFX.shift();
}

/* carnes antigas (grandes) encolhem quando cabem no lugar */
export function meatShrinkAll() {
  try {
    const invs = [econ.stash, ...world.heroes.map((h) => h.inv)].filter(Boolean);
    if (typeof dungeon !== "undefined" && dungeon.active && dungeon.hero) invs.push(ensureInv(dungeon.hero));
    for (const inv of invs)
      for (const it of inv!.items) {
        if (it.def.key !== "carne" || it._msh === 2) continue;
        meatDecor(it);
        const ns = meatShape(it.an!, it.tier);
        if (canPlace(inv!, ns, it.x, it.y, it)) {
          it.shape = ns;
          it._msh = 2;
        }
      }
  } catch (_) {}
}

/* ==== v5.9.13 — área de caça que acha a presa e acompanha a perseguição, aviso visual de coleta no mapa, carpintaria ==== */
export function huntTargets(kind: string) {
  if (kind === "tree" || kind === "rock") return world.nodes!.filter((n) => n.kind === kind && nodeReady(n));
  if (kind === "duck" || kind === "eagle") return world.wild!.filter((w) => w.alive && w.species === kind);
  if (kind === "fish") return world.waterPoints || [];
  return world.animals.filter((a) => a.alive !== false && a.species === kind && !(a.health <= 0));
}
export function nearestTarget(kind: string, x: number, y: number, maxD: number) {
  let best = null,
    bd = maxD;
  for (const o of huntTargets(kind)) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/* área de caça: só procura presa/pedra/árvore dentro do círculo em volta de onde mandou caçar */
export const inArea = (o: Ponto) =>
  !CACA.HUNT_AREA || Math.hypot(o.x - CACA.HUNT_AREA.x, o.y - CACA.HUNT_AREA.y) <= CACA.HUNT_AREA.r;
export function huntHere(h: Hero) {
  // reescrita na v5.9.13
  if (!h || (h.state !== "idle" && h.state !== "field")) return;
  const kind = h.huntSpecies || "rabbit",
    hrs = h.huntHours || 6,
    fld = h.state === "field",
    R = HUNT_AREA_R(hrs);
  if (kind === "runa") return;
  const o = fld ? { x: h.x, y: h.y } : { x: h.camp.x, y: h.camp.y };
  const t = nearestTarget(kind, o.x, o.y, HUNT_MAX_START + R * 0.5);
  let p;
  if (!t) {
    pushEvent(
      "🔎 Nenhum(a) " +
        huntLabel(kind) +
        " num raio de " +
        HUNT_MAX_START +
        " " +
        (fld ? "de onde " + h.name + " está" : "da base") +
        ". Use 🚶 Andar para ir a outro lugar.",
    );
    mvToast("Nada de " + huntLabel(kind) + " por perto");
    return;
  }
  if (kind === "fish") {
    p = fishSpot(t.x, t.y) || { x: t.x, y: t.y };
  } else if (Math.hypot(t.x - o.x, t.y - o.y) <= R * 0.6) p = { x: o.x, y: o.y };
  else {
    const d = Math.hypot(t.x - o.x, t.y - o.y),
      k = Math.max(0, (d - R * 0.4) / d);
    p = snapToLand(o.x + (t.x - o.x) * k, o.y + (t.y - o.y) * k) || { x: t.x, y: t.y };
  }
  askWork(h, kind, () => {
    if (h.state !== "idle" && h.state !== "field") return;
    h.task = {
      x: p.x,
      y: p.y,
      ox: o.x,
      oy: o.y,
      targetSpecies: kind,
      killsWanted: 99999,
      killsDone: 0,
      maxMin: hrs * 60,
      r: R,
      field: fld,
    };
    h.state = "traveling";
    h.targetEntity = null;
    h.localTarget = null;
    const far = Math.round(Math.hypot(p.x - o.x, p.y - o.y));
    pushEvent(
      h.name +
        " foi " +
        workVerb(kind) +
        huntLabel(kind) +
        " por " +
        hrs +
        "h" +
        (far > 10 ? " — achou rastro a " + far + " passos " + (fld ? "dali" : "da base") : " ali perto") +
        " (área " +
        R +
        ").",
    );
    updateHeroPanelUI();
  });
}
export function heroWalkArm(h: Hero) {
  SEL.commandMode = h.id;
  h._walkArm = true;
  const hint = document.getElementById("command-hint");
  if (hint) {
    hint.textContent = "🚶 Toque no mapa para onde " + h.name + " deve andar";
    hint.style.display = "block";
  }
  updateHeroPanelUI();
}
export function walkClick(id: string, wx: number, wy: number) {
  const h = world.heroes.find((x) => x.id === id);
  if (!h || !h._walkArm) return false;
  h._walkArm = false;
  if (h.state !== "idle" && h.state !== "field") return true;
  const p = snapToLand(wx, wy);
  if (!p) {
    pushEvent("Escolha um ponto em terra.");
    return true;
  }
  h.walkTo = { x: p.x, y: p.y };
  h.task = null;
  h.targetEntity = null;
  h.state = "walking";
  pushEvent("🚶 " + h.name + " está andando até lá.");
  return true;
}
export function heroBack(h: Hero) {
  if (!h || h.state !== "field") return;
  h.task = { x: h.x, y: h.y, targetSpecies: "none", killsDone: 0, back: true };
  h.state = "returning";
  pushEvent("⛺ " + h.name + " está voltando ao acampamento.");
  updateHeroPanelUI();
}
