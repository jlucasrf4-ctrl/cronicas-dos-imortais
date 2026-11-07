/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.9_laco_cravar.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarLacoCravar() na ordem do antigo manifesto. */
import { TELAS, dungeon } from "../../core/state.ts";
import { cravRip } from "../../field/tipos.ts";

export function iniciarLacoCravar() {
  /* ==== v6.9 — laço em bicho marcado · cravar mais impactante (ponta presa, zoom, sons, debate, puxão) · stamina em círculo ==== */
  /* clique esquerdo com a arma cravada: só segura/empurra (nunca ataca de novo) */
  /* botão direito (ou 🛡/⚡ no celular): descrava/arranca */
  window.addEventListener(
    "pointerdown",
    (e) => {
      const d = dungeon;
      if (!d.active || !d.crav || e.button !== 2 || e.target !== TELAS.dCanvas) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cravRip();
    },
    true,
  );
}
