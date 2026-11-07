/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.08_celular.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarCelular() na ordem do antigo manifesto. */
import { zoomBtnsEnsure } from "../../ui/celular.ts";

export function iniciarCelular() {
  /* ==== v5.9.08 — correções de celular ==== */
  /* atalhos de centralizar (personagem / acampamento): garante que os botões existam sempre */
  setInterval(zoomBtnsEnsure, 1500);
}
