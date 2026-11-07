/* ==== Fase 4 — código de carga do antigo src/js/base/18_v3.16_meta.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarMeta() na ordem do antigo manifesto. */
import { OPT, OPT_KEY } from "../../core/state.ts";
import { lsGet } from "../../core/storage.ts";
import { D3 } from "../../field/projecao.ts";

export function iniciarMeta() {
  /* =====================================================================
     v3.16 — META: opções, salvar/carregar, tela de título, menu de pausa, HUD do mapa, minimapa
  ===================================================================== */
  try {
    const _m = localStorage.getItem("mv_d3");
    if (_m != null && !lsGet(OPT_KEY)) OPT.d3 = _m !== "0";
  } catch (e) {}
  D3.on = OPT.d3;
}
