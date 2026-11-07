/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.03_inventario.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarInventario() na ordem do antigo manifesto. */
import { invLayout3 } from "../../ui/inventario.ts";

export function iniciarInventario() {
  /* ---- layout contínuo da mochila na masmorra ---- */
  setTimeout(function il3() {
    if (!invLayout3()) setTimeout(il3, 500);
  }, 600);
}
