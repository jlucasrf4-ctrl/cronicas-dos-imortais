/* ==== Fase 4 — código de carga do antigo src/js/base/17_v3.10_qualidade_itens.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarQualidadeItens() na ordem do antigo manifesto. */

export function iniciarQualidadeItens() {
  /* ---- chão da masmorra: itens perto do herói aparecem como uma grade ao abrir a mochila ---- */
  try {
    if (document.fonts && document.fonts.load) document.fonts.load('900 24px "Cinzel Decorative"');
  } catch (e) {}

  /* ---------------------------------------------------------------------
     16. BOOTSTRAP
  --------------------------------------------------------------------- */
}
