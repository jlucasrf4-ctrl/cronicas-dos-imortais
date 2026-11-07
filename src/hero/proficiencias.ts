/* ==== Fase 4 — proficiências por herói (v5.9.05) ==== */
import { PROF_MAX, PROFS } from "../data/atributos.ts";
import { KNIFE_KEYS } from "../data/combate.ts";
import { dungeon, econ, world, camera, SEL } from "../core/state.ts";
import { wpnKey } from "../field/armas.ts";
import { isLanca } from "../items/galho.ts";
import { mnt } from "../creatures/tamandua.ts";
import { campPos, camZoomTo } from "../survival/acampamento.ts";
import { camPing } from "../map/camera.ts";
import { mvToast } from "../ui/avisos.ts";
import type { Hero } from "../core/tipos.ts";

export function profLv(h: Hero | null | undefined, id: string) {
  const s = h && h.skills && h.skills[id];
  return s ? Math.min(PROF_MAX, s.level || 1) : 0;
}

/* =====================================================================
   v5.9.05 — PROFICIÊNCIAS POR HERÓI (todas no mesmo padrão: XP → nível 1 a 10)
   Armas: Espada, Clava, Machado, Lança, Arco — cada uma sobe só usando ela.
   Ofícios: Domador, Coletor, Pesquisador, Ferreiro, Artesão, Lapidário, Sobrevivência.
   Cada nível deixa o minigame/arma mais fácil ou mais forte. Atalhos no mapa:
   C centraliza o acampamento · V centraliza o personagem (e alterna entre eles).
===================================================================== */
export function profNeed(lv: number) {
  return 5 * (lv - 1) * (lv + 2);
} // XP total para chegar ao nível lv (2: 20 · 5: 140 · 10: 540)
export function profLvOfXp(xp: number) {
  let l = 1;
  while (l < PROF_MAX && xp >= profNeed(l + 1)) l++;
  return l;
}
export function profWeapon(h: Hero) {
  /* v6.1 */
  {
    const k = wpnKey(h);
    if (k && KNIFE_KEYS.includes(k)) return "faca";
  }
  const k = wpnKey(h);
  return k === "eq_clava"
    ? "clava"
    : k === "eq_machado" || k === "eq_picareta" // v8.1: a picareta treina como o machado (ferramenta de golpe pesado)
      ? "machado"
      : isLanca(k!)
        ? "lanca"
        : !k && dungeon.active && dungeon.hero === h && dungeon.spearOut
          ? "lanca"
          : "espada";
}
export function profMigrate(h: Hero) {
  if (!h || h._profV) return;
  h._profV = 1;
  if (!h.skills) h.skills = {};
  for (const id in h.skills) {
    const s = h.skills[id];
    s.level = profLvOfXp(s.xp || 0);
  }
  const sw = h.skills.espada;
  if (sw && sw.xp)
    for (const k of ["clava", "machado", "lanca"])
      if (!h.skills[k]) h.skills[k] = { xp: Math.floor(sw.xp * 0.5), level: profLvOfXp(Math.floor(sw.xp * 0.5)) };
  const fx = econ.forgeXp || 0;
  if (fx)
    for (const k of ["ferreiro", "artesao"]) if (!h.skills[k]) h.skills[k] = { xp: fx * 3, level: profLvOfXp(fx * 3) };
  const fl = econ.fireLv! | 0;
  if (fl && !h.skills.sobrevivencia) {
    const xp = profNeed(Math.min(PROF_MAX, 1 + fl * 2));
    h.skills.sobrevivencia = { xp, level: profLvOfXp(xp) };
  }
}
export function profSheetHtml(h: Hero) {
  let out = "";
  for (const g of ["Armas", "Ofícios"]) {
    out += "<div class='pf-g'>" + g + "</div>";
    for (const P of PROFS.filter((p) => p.g === g)) {
      const s = h.skills && h.skills[P.id],
        lv = s ? Math.min(PROF_MAX, s.level) : 0,
        a = s ? profNeed(lv) : 0,
        b = lv < PROF_MAX ? profNeed(lv + 1) : a,
        pct = s ? (lv >= PROF_MAX ? 100 : Math.round(((s.xp - a) / (b - a)) * 100)) : 0;
      out +=
        '<div class="sh-prof pf" title="' +
        P.d +
        (s && lv < PROF_MAX ? " · " + Math.floor(s.xp) + "/" + b + " XP para o nível " + (lv + 1) : "") +
        '"><span>' +
        P.i +
        " " +
        P.n +
        "</span>" +
        (s
          ? "<b>Nv." +
            lv +
            (lv >= PROF_MAX ? " ★" : "") +
            '</b><div class="sh-bar"><i style="width:' +
            pct +
            '%"></i></div>'
          : "<em>ainda não treinada</em>") +
        "</div>";
    }
  }
  return out;
}

/* ---- armas ---- */
/* ---- domador ---- */
export function bestHero(id: string, pool?: Hero[]) {
  const L = (pool || world.heroes).filter(Boolean);
  return L.sort((a, b) => profLv(b, id) - profLv(a, id))[0] || null;
}
export function mountHero() {
  const m = mnt();
  return (
    (dungeon.active && dungeon.hero) ||
    (m && m.with && world.heroes.find((h) => h.id === m.with)) ||
    bestHero("domador")
  );
}

/* ---- ferreiro / artesão ---- */
export function fgProf(g: { craft?: string } | null) {
  return g && (g.craft === "metal" || g.craft === "malha") ? "ferreiro" : "artesao";
}

/* ---- atalhos: centralizar personagem e acampamento ---- */
export function centerCamp() {
  const p = campPos();
  if (!p) return;
  camZoomTo(p.x, p.y, Math.max(camera.scale, camera.minScale * 6), 450);
  try {
    camPing(p.x, p.y);
  } catch (_) {}
}
export function centerHero() {
  const L = world.heroes;
  if (!L.length) return;
  let h;
  if (typeof SEL.selectedHero !== "undefined" && SEL.selectedHero && SEL.CENTER_I < 0) h = SEL.selectedHero;
  else {
    SEL.CENTER_I = (SEL.CENTER_I + 1) % L.length;
    h = L[SEL.CENTER_I];
  }
  camZoomTo(h.x, h.y, Math.max(camera.scale, camera.minScale * 6), 450);
  try {
    camPing(h.x, h.y);
  } catch (_) {}
  mvToast(
    "👤 " + h.name + (h.state === "idle" ? " — no acampamento" : h.state === "indungeon" ? " — na masmorra" : ""),
  );
}
