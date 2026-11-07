/* ==== Fase 4 — código de carga do antigo src/js/base/19_v3.16_historia_cinematica.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarHistoriaCinematica() na ordem do antigo manifesto. */
import { init } from "../../intro/cinematica.ts";
import { metaInit } from "../../ui/titulo.ts";

export function iniciarHistoriaCinematica() {
  /* ---------- motor: reaproveita o WebGL da masmorra (mesmo canvas, movido para a tela da cinemática) ---------- */

  document.addEventListener("DOMContentLoaded", () => {
    init();
    metaInit();
  });
}
