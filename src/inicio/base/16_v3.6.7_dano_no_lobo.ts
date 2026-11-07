/* ==== Fase 4 — código de carga do antigo src/js/base/16_v3.6.7_dano_no_lobo.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarDanoNoLobo() na ordem do antigo manifesto. */
import { ART, ITEM_DEFS } from "../../data/itens.ts";

export function iniciarDanoNoLobo() {
  /* ===== v3.6.7: sensação de dano no lobo (visual + sonoro) ===== */

  for (const k in ART) ITEM_DEFS[k].shape = ART[k].map((r) => Array.from(r, (ch) => (ch === "#" ? 1 : 0)));
}
