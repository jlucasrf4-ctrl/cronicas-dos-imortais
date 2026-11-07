/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.13_carpintaria.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarCarpintaria() na ordem do antigo manifesto. */
import { ITEM_DEFS } from "../../data/itens.ts";
import { KG } from "../../data/sobrevivencia.ts";
import { chestFit, mesaApply } from "../../forja/carpintaria.ts";

export function iniciarCarpintaria() {
  /* ==== carpintaria: tratar madeira em tábuas → caixa, baú, mesa ==== */
  ITEM_DEFS.tabua = {
    key: "tabua",
    name: "Tábua",
    emoji: "🪵",
    color: "#b08850",
    shape: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ],
    val: 4,
    w: 0,
    desc: "Madeira tratada (aplainada). Usada na carpintaria: caixas, baú e mesa.",
  };
  try {
    KG.tabua = 0.6;
  } catch (_) {}
  setInterval(chestFit, 3000);
  setTimeout(function _ma() {
    mesaApply();
    setTimeout(_ma, 5000);
  }, 1500);
  /* desenho no mapa: avisos de coleta + mesa e caixas no acampamento */
}
