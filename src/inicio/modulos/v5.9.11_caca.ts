/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.11_caca.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarCaca() na ordem do antigo manifesto. */
import { SEL, world } from "../../core/state.ts";
import { HERO_STATE_LABEL } from "../../data/herois.ts";
import { HUNT_TARGETS } from "../../data/recursos.ts";
import { heroBack, heroWalkArm, huntHere } from "../../map/caca.ts";
import { updateHeroPanelUI } from "../../ui/painel.ts";

export function iniciarCaca() {
  /* ==== v5.9.11 — caçar em volta do personagem, andar livre pelo mapa, mineração e carnes menores ==== */
  Object.assign(HERO_STATE_LABEL, { walking: "Andando", field: "Em campo" });
  /* mineração: pedra + chance de minério */
  {
    const i = HUNT_TARGETS.findIndex((t) => t[0] === "rock");
    if (i >= 0) HUNT_TARGETS[i][1] = "⛏ Mineração (pedra e minério)";
  }
  /* área de caça: só procura presa/pedra/árvore dentro do círculo em volta de onde mandou caçar */
  document.addEventListener(
    "click",
    (e) => {
      const b = ((e.target as HTMLElement).closest &&
        (e.target as HTMLElement).closest("button[data-act]")) as HTMLElement;
      if (!b) return;
      const a = b.dataset.act;
      if (a !== "huntz" && a !== "walk" && a !== "back") return;
      e.stopPropagation();
      const h = world.heroes.find((x) => x.id === b.dataset.hero);
      if (!h) return;
      if (a === "huntz") huntHere(h);
      else if (a === "walk") {
        if (SEL.commandMode === h.id) {
          SEL.commandMode = null;
          h._walkArm = false;
          document.getElementById("command-hint")!.style.display = "none";
          updateHeroPanelUI();
        } else heroWalkArm(h);
      } else heroBack(h);
    },
    true,
  );
}
