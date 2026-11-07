/* ==== Fase 4 — código de carga do antigo src/js/modulos/v4.7_icones.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarIcones() na ordem do antigo manifesto. */
import { dungeon } from "../../core/state.ts";
import { hudCompact, iconInit } from "../../ui/avisos.ts";

export function iniciarIcones() {
  /* =====================================================================
     v4.7 — MENOS TEXTO NA TELA: avisos de combate viram ícones com efeito,
     faixas (banners) com subtítulos curtos em ícones, prompt "E" compacto,
     maestrias em pílulas e o texto de controles só nas primeiras partidas.
     Opções → "🔤 Avisos em texto" volta ao jeito antigo.
  ===================================================================== */
  setTimeout(iconInit, 0);
  /* barra de botões da masmorra: ícone + tecla (o texto completo fica no "title") */
  setInterval(() => {
    if (dungeon.active) hudCompact();
  }, 400);
}
