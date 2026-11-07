/* ==== Fase 4 — código de carga do antigo src/js/modulos/v7.4_cravar_arremesso.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarCravarArremesso() na ordem do antigo manifesto. */
import { DANO } from "../../data/combate.ts";

export function iniciarCravarArremesso() {
  /* ==== v7.4 — cravar: estocada da lança só 20% · arremesso com 3 níveis (fraco 50% · médio 65% · cheio 80%) · E de finalizar sem poluição ==== */
  DANO.CRAVAR.lanca.chance = 0.2; // estocada corpo a corpo da lança
}
