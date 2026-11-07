/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.1.2_ataque_sem_arma.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarAtaqueSemArma() na ordem do antigo manifesto. */
import { TELAS, dungeon } from "../../core/state.ts";
import { knifeIn } from "../../field/faca_corda.ts";

export function iniciarAtaqueSemArma() {
  /* ==== v6.1.2 — sem arma corpo a corpo não ataca; faca na mochila vira o ataque básico se for a única arma; tremor travado no diálogo ==== */
  setInterval(() => {
    try {
      const b = document.getElementById("tb-knife");
      if (b && dungeon.active) b.style.display = knifeIn(dungeon.hero!) ? "" : "none";
    } catch (_) {}
  }, 500);
  /* tremor da câmera não fica preso quando o jogo pausa (diálogos, janelas) */
  (function shakeGuard() {
    try {
      const d = dungeon;
      if (d.active && d.modalOpen && d.shake! > 0) {
        d.shake = 0;
        if (typeof TELAS.dCanvas !== "undefined" && TELAS.dCanvas.style.transform) TELAS.dCanvas.style.transform = "";
      }
    } catch (_) {}
    requestAnimationFrame(shakeGuard);
  })();
}
