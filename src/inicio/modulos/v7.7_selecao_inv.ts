/* ==== v7.7 — seleção de vários itens na mochila (src/items/selecao_inv.ts): Esc limpa antes de fechar a mochila; fechar
   a mochila/baú limpa ==== */
import { selLimpar, selVigiar } from "../../items/selecao_inv.ts";

export function iniciarSelecaoInv() {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Escape" && selLimpar()) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );
  setInterval(selVigiar, 400);
}
