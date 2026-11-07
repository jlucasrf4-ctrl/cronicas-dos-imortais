/* ==== v7.7 — dicas no quadradinho (src/ui/dicas.ts): escuta as teclas que concluem cada dica e o ❔ ==== */
import { dicaTecla, dicaAjudaVista } from "../../ui/dicas.ts";

export function iniciarDicas() {
  window.addEventListener("keydown", (e) => {
    if (!e.repeat) dicaTecla(e.code);
  });
  window.addEventListener("mousedown", (e) => dicaTecla("mouse" + e.button));
  document.addEventListener("click", (e) => {
    if ((e.target as Element | null)?.closest?.("#dungeon-help")) dicaAjudaVista();
  });
}
