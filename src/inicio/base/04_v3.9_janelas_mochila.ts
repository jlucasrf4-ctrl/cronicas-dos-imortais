/* ==== Fase 4 — código de carga do antigo src/js/base/04_v3.9_janelas_mochila.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarJanelasMochila() na ordem do antigo manifesto. */
import { JANELAS } from "../../core/state.ts";
import { WIN_KEY } from "../../ui/janelas.ts";

export function iniciarJanelasMochila() {
  /* ===== v3.9: janelas arrastáveis/fecháveis, mochila do personagem e clique no personagem ===== */
  try {
    JANELAS.winSt = JSON.parse(localStorage.getItem(WIN_KEY) || "{}");
  } catch (e) {
    JANELAS.winSt = {};
  }

  /* ---------------------------------------------------------------------
     15. LOOP PRINCIPAL — tick de simulação desacoplado do frame de render
  --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     16b. MASMORRA — motor à parte, estilo Tibia: grade de tiles, movimento
     por clique, combate corpo a corpo real contra um monstro. É um "outro
     jogo" de propósito — câmera e renderização completamente separadas do
     Mapa Vivo, só compartilhando o personagem (atributos/perícias/loot).
  --------------------------------------------------------------------- */
}
