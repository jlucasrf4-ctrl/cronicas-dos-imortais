/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.01_ajustes.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarAjustes() na ordem do antigo manifesto. */
import { fixLongShapes } from "../../items/inventario.ts";

export function iniciarAjustes() {
  /* ---------- armas longas: corrige o tamanho de itens antigos ---------- */
  setInterval(() => {
    try {
      fixLongShapes();
    } catch (_) {}
  }, 3000);
}
