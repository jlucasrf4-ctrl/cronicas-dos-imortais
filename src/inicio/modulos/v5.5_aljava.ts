/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.5_aljava.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarAljava() na ordem do antigo manifesto. */
import { ITEM_DEFS } from "../../data/itens.ts";

export function iniciarAljava() {
  /* =====================================================================
     v5.5 — FLECHAS COMO ITEM NA ALJAVA
     As flechas viram feixes (até 10 cada) que ocupam 1×2 casas e podem ser
     arrastados livremente dentro da aljava (R gira). O total continua sendo
     econ.quiver.n (loja, craft e tiro não mudam); os feixes só acompanham:
     atirou → o último feixe diminui; ganhou flechas → enche os feixes e cria
     novos onde houver espaço. Sem espaço, o resto vai para a reserva.
     Feixes não saem da aljava (nem para a mochila, nem para o chão/baú).
  ===================================================================== */
  ITEM_DEFS.flecha = {
    key: "flecha",
    name: "Pacote de Flechas",
    emoji: "🏹",
    color: "#6b4a1f",
    val: 0,
    w: 0,
    shape: Array.from({ length: 9 }, () => [1, 1]),
    desc: "Pacote de até 10 flechas (2×9; com 1 flecha só fica 1×9). Arraste para organizar a aljava (R gira). Os pacotes não saem da aljava.",
  };
}
