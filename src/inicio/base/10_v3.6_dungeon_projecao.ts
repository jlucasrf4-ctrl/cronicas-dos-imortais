/* ==== Fase 4 — código de carga do antigo src/js/base/10_v3.6_dungeon_projecao.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarDungeonProjecao() na ordem do antigo manifesto. */
import { D3 } from "../../field/projecao.ts";

export function iniciarDungeonProjecao() {
  /* ===== 3D da dungeon: projeção ortográfica inclinada (câmera de cima, ~58°) com sprites em pé ===== */
  D3.SIN = Math.sin(D3.TH);
  D3.COS = Math.cos(D3.TH);
  try {
    if (localStorage.getItem("mv_d3") === "0") D3.on = false;
  } catch (e) {}
}
