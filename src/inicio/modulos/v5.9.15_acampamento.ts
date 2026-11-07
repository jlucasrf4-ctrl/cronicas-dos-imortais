/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.15_acampamento.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarAcampamento() na ordem do antigo manifesto. */
import { dungeon } from "../../core/state.ts";
import { TIERS } from "../../items/inventario.ts";
import { CAMP } from "../../survival/acampamento.ts";
import { sizzle } from "../../survival/cozinha.ts";

export function iniciarAcampamento() {
  /* ==== v5.9.15 — maleta de ferramentas (carpintaria) e mesa dentro do acampamento; carne assada com brilho, som e animação ==== */
  setInterval(() => {
    try {
      const d = dungeon;
      if (d.active && d._campUi && !document.querySelector("#carp-modal.open, #ana-modal.open")) {
        d._campUi = null;
        d.modalOpen = false;
      }
    } catch (_) {}
  }, 250);
  /* ==== carne assada: brilho, chiado e animação ==== */
  /* chiado leve enquanto a carne está no fogo */
  setInterval(() => {
    try {
      const k = CAMP.cook;
      if (k && CAMP.open && !k.up && Math.random() < 0.55) sizzle(0.35, 0.06 + Math.min(0.12, (k.a + k.b) * 0.06));
    } catch (_) {}
  }, 600);
  setTimeout(() => {
    try {
      if (!TIERS[3]) TIERS[3] = TIERS[2];
    } catch (_) {}
  }, 0); // itens antigos com qualidade acima de SS
}
