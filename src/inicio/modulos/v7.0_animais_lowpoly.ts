/* ==== Fase 4 — código de carga do antigo src/js/modulos/v7.0_animais_lowpoly.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarAnimaisLowpoly() na ordem do antigo manifesto. */
import { CRIT_SP } from "../../data/campo.ts";
import { DANO } from "../../data/combate.ts";

export function iniciarAnimaisLowpoly() {
  /* ---------- cervo: uma flechada não derruba — ele foge ferido, gasta fôlego correndo e cai depois ---------- */
  // v8.0: ferido, fugir cansa (corridaFol): a flecha debilita e ele cai quando o fôlego zera (mantenedor, 2026-10-24:
  // "acertar uma flecha num animal de caça deve debilitar ele pra ele cair"); caído, recupera um pouco e foge de novo
  Object.assign(CRIT_SP.deer, { hp: 24, tiroMax: 0.3, folHitMax: 0.3, ferido: 14, corridaFol: 0.8 });
  DANO.PERFIS.cervo.fol = 12;
}
