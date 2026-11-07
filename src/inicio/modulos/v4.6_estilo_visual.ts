/* ==== Fase 4 — código de carga do antigo src/js/modulos/v4.6_estilo_visual.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarEstiloVisual() na ordem do antigo manifesto. */
import { GL3 } from "../../core/state.ts";

export function iniciarEstiloVisual() {
  /* =====================================================================
     v4.6 — VISUAL ESTILIZADO: normais suaves (auto-smooth), personagens com
     esferas mais detalhadas, sombreamento em faixas (toon), luz quente /
     sombra fria, brilho de borda e contorno escuro (casca invertida).
  ===================================================================== */
  GL3.OU = {};
}
