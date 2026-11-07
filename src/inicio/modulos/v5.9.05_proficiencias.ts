/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.05_proficiencias.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarProficiencias() na ordem do antigo manifesto. */
import { dungeon } from "../../core/state.ts";
import { PROFS } from "../../data/atributos.ts";
import { SKILL_LABELS } from "../../data/herois.ts";
import { gainSkill } from "../../hero/nivel.ts";
import { centerCamp, centerHero } from "../../hero/proficiencias.ts";

export function iniciarProficiencias() {
  /* =====================================================================
     v5.9.05 — PROFICIÊNCIAS POR HERÓI (todas no mesmo padrão: XP → nível 1 a 10)
     Armas: Espada, Clava, Machado, Lança, Arco — cada uma sobe só usando ela.
     Ofícios: Domador, Coletor, Pesquisador, Ferreiro, Artesão, Lapidário, Sobrevivência.
     Cada nível deixa o minigame/arma mais fácil ou mais forte. Atalhos no mapa:
     C centraliza o acampamento · V centraliza o personagem (e alterna entre eles).
  ===================================================================== */
  Object.assign(SKILL_LABELS, Object.fromEntries(PROFS.map((p) => [p.id, p.n])));

  /* ---- armas ---- */
  /* ---- domador ---- */
  setInterval(() => {
    try {
      const d = dungeon;
      if (d.active && d.mount && d.mount.mounted && d.mount.mv > 0.3) {
        d._rideT = (d._rideT || 0) + 1;
        if (d._rideT % 15 === 0) gainSkill(d.hero!, "domador", 1);
      }
    } catch (_) {}
  }, 1000);
  /* ---- sobrevivência (fogueira e assar) ---- */

  /* ---- atalhos: centralizar personagem e acampamento ---- */
  window.addEventListener("keydown", (e) => {
    if (dungeon.active || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (document.querySelector(".v3-modal.open,#fg-modal.open,#mg-modal.open,#wm-modal.open")) return;
    if (e.code === "KeyC") centerCamp();
    else if (e.code === "KeyV") centerHero();
  });
  setTimeout(function zb() {
    const z = document.getElementById("zoom-controls");
    if (!z) {
      setTimeout(zb, 800);
      return;
    }
    if (document.getElementById("zoom-hero")) return;
    const a = document.createElement("button");
    a.className = "zoom-btn";
    a.id = "zoom-hero";
    a.title = "Centralizar no personagem (V) — de novo alterna entre eles";
    a.textContent = "👤";
    a.onclick = () => centerHero();
    const b = document.createElement("button");
    b.className = "zoom-btn";
    b.id = "zoom-camp";
    b.title = "Centralizar no acampamento (C)";
    b.textContent = "⛺";
    b.onclick = () => centerCamp();
    z.prepend(b);
    z.prepend(a);
  }, 500);
}
