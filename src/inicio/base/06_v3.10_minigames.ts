/* ==== Fase 4 — código de carga do antigo src/js/base/06_v3.10_minigames.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarMinigames() na ordem do antigo manifesto. */
import { JANELAS } from "../../core/state.ts";
import { mgClose, mgHit, startMinigame, wmClose } from "../../minijogos/trabalho.ts";

export function iniciarMinigames() {
  /* ===== v3.10: MINIGAMES (mineração, coleta de madeira, pesca) — opcionais: jogue você mesmo ou mande o personagem fazer sozinho ===== */
  (function wireWork() {
    const $ = (i: string) => document.getElementById(i);
    $("wm-play")!.onclick = () => {
      if (!JANELAS.wmCb) return;
      const c = JANELAS.wmCb;
      JANELAS.wmCb = null;
      wmClose();
      startMinigame(c.h, c.kind);
    };
    $("wm-auto")!.onclick = () => {
      if (!JANELAS.wmCb) return;
      const c = JANELAS.wmCb;
      JANELAS.wmCb = null;
      wmClose();
      c.auto();
    };
    $("wm-cancel")!.onclick = () => {
      JANELAS.wmCb = null;
      wmClose();
    };
    $("mg-hit")!.onclick = mgHit;
    $("mg-track")!.addEventListener("pointerdown", () => {
      if (JANELAS.mg && JANELAS.mg.on) mgHit();
    });
    window.addEventListener("keydown", (e) => {
      if (JANELAS.mg && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        mgHit();
      } else if (JANELAS.mg && e.code === "Escape" && !JANELAS.mg.on) mgClose();
    });
  })();
}
