/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9_sobrevivencia.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarSobrevivencia() na ordem do antigo manifesto. */
import { TOAST_ICONS } from "../../data/icones.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { prepHero } from "../../expedicao/preparo.ts";
import { WORLD_SAVE_KEYS } from "../../save/salvar.ts";
import { enterCamp } from "../../survival/acampamento.ts";

export function iniciarSobrevivencia() {
  /* =====================================================================
     v5.9 — ACAMPAMENTO E SOBREVIVÊNCIA
     · Acampamento desenhado no mapa (barraca, fogueira, bigorna, baú). Clique nele para abrir.
     · A forja agora é a BIGORNA do acampamento (os botões de Forja levam até lá).
     · Fogueira: minigame de assar carne → Carne Assada (comida boa, cura ferimentos).
     · Fome, temperatura e peso da mochila passam a importar (na masmorra e no mapa).
     · Ferimentos: parte do dano vira ferimento; fora de combate a vida volta só até
       o limite (ex.: 100 → 80 → volta a 87). Ervas, carne assada e descanso no acampamento curam.
     · Lobos batem mais forte.
  ===================================================================== */
  /* ---- itens novos ---- */
  ITEM_DEFS.carne_assada = {
    key: "carne_assada",
    name: "Carne Assada",
    emoji: "🍖",
    color: "#9a5a2a",
    val: 6,
    w: 0,
    shape: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    desc: "Comida de verdade: mata a fome e ajuda a fechar ferimentos. Clique para comer.",
  };
  /* ---- minigame: assar a carne ---- */
  setTimeout(function fb() {
    const a = document.getElementById("btn-forge"),
      b = document.getElementById("prep-forge");
    if (a) a.onclick = () => enterCamp();
    if (b) b.onclick = () => enterCamp(prepHero());
    if (!a || !b) setTimeout(fb, 1000);
  }, 500);
  /* ---- vida no mapa: descanso e comida no acampamento ---- */
  TOAST_ICONS.unshift([/^Comeu /, "🍖", "#ffd08a"]);
  /* ---- CUPINZEIROS espalhados pelo mapa (comida dos futuros tamanduás: montaria / baú que anda) ---- */
  setTimeout(() => {
    try {
      if (!WORLD_SAVE_KEYS.includes("termites")) WORLD_SAVE_KEYS.push("termites");
    } catch (_) {}
  }, 0);
}
