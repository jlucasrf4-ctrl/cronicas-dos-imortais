/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.1.1_celular_dialogo.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarCelularDialogo() na ordem do antigo manifesto. */
import { ISC, dlgAdvance } from "../../intro/cena.ts";

export function iniciarCelularDialogo() {
  /* ==== v6.1.1 — celular: tocar em qualquer lugar avança o diálogo; tocar acelera a revelação do personagem ==== */
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!ISC.dlg) return;
      const t = e.target as HTMLElement;
      if (t && t.closest && (t.closest("#isc-skip") || t.closest("#isc-craft") || t.closest("#isc-ana"))) return;
      e.preventDefault();
      e.stopPropagation();
      if (performance.now() - (ISC._tap || 0) < 180) return;
      ISC._tap = performance.now();
      dlgAdvance();
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      if (!ISC.dlg && !(performance.now() - (ISC._tap || 0) < 400)) return;
      const t = e.target as HTMLElement;
      if (t && t.closest && (t.closest("#isc-skip") || t.closest("#isc-craft") || t.closest("#isc-ana"))) return;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
}
