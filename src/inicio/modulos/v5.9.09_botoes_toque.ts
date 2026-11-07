/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.09_botoes_toque.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarBotoesToque() na ordem do antigo manifesto. */
import { Q_FRAME } from "../../data/icones.ts";
import { tblApply, tblInit, tblRoot, tblTip } from "../../ui/botoes_toque.ts";

export function iniciarBotoesToque() {
  /* ==== v5.9.09 — botões de toque reposicionáveis: ✥ ajustar → arrasta cada botão, muda o tamanho, 🔒 trava.
     Layout salvo no aparelho, separado para celular deitado e em pé. ==== */
  /* arrastar: captura antes dos botões, para não atacar/defender enquanto edita */
  setInterval(() => {
    try {
      tblInit();
    } catch (_) {}
  }, 800);
  addEventListener("resize", () => {
    setTimeout(() => {
      try {
        if (tblRoot()) {
          tblApply();
          tblTip();
        }
      } catch (_) {}
    }, 120);
  });

  Q_FRAME[11] = null;
  Q_FRAME[12] = null; // materiais raros: a cor do fundo já mostra a raridade
}
