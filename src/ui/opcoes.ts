/* ==== Fase 4 — opções: salvar e aplicar (base/18) ==== */
import { OPT, OPT_KEY, SOM, dungeon } from "../core/state.ts";
import { lsSet } from "../core/storage.ts";
import { D3 } from "../field/projecao.ts";
import { fitDungeonCanvas, updateWeaponUI } from "../field/masmorra.ts";
import { MAPART, maApplyMode } from "../map/vetorial.ts";
import { MUS } from "../audio/som.ts";

export function gfxDpr() {
  const d = window.devicePixelRatio || 1;
  return OPT.gfx === "baixa" ? 1 : OPT.gfx === "media" ? Math.min(d, 1.5) : Math.min(d, 3);
}

/* =====================================================================
   v3.16 — META: opções, salvar/carregar, tela de título, menu de pausa, HUD do mapa, minimapa
===================================================================== */
export const MV_VER = "v8.1";

export function optSave() {
  lsSet(OPT_KEY, OPT);
  try {
    localStorage.setItem("mv_d3", OPT.d3 ? "1" : "0");
  } catch (e) {}
  optApply();
}
export function optApply() {
  if (!OPT.ataqueAutomatico) {
    if (dungeon.alvoAutomatico && dungeon.hv?.kind === "clubL") dungeon.hv = null;
    dungeon.alvoAutomatico = null;
  }
  if (SOM._mg) SOM._mg.gain.value = OPT.sfx;
  if (MUS.g) MUS.g.gain.value = OPT.music * 0.22;
  if (D3.on !== OPT.d3) {
    D3.on = OPT.d3;
    if (dungeon.active) fitDungeonCanvas();
  }
  if (typeof MAPART !== "undefined" && MAPART.on !== (OPT.mapNew !== false)) {
    MAPART.on = OPT.mapNew !== false;
    maApplyMode();
  }
  // v8.1: o HUD do campo "Traço solto" (styles/63_v8.1_hud_traco.css)
  // 2026-11-08: virou o padrão (o mantenedor pediu); a opção antiga salva é ignorada
  document.documentElement.classList.add("hud-traco");
  for (const id of ["empty-hint", "dungeon-hint"]) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = OPT.hints ? "" : "hidden";
  }
  if (dungeon.active) {
    fitDungeonCanvas();
    updateWeaponUI();
  }
}
