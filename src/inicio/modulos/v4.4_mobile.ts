/* ==== Fase 4 — código de carga do antigo src/js/modulos/v4.4_mobile.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarMobile() na ordem do antigo manifesto. */
import { mobInit } from "../../ui/celular.ts";

export function iniciarMobile() {
  /* ---- masmorra: joystick + botões ---- */
  setTimeout(mobInit, 0);
}
