/* ==== v8.1 — Modo Editor: o que roda no carregamento (src/editor/editor.ts) ====
   Lê a decoração embutida, prende os atalhos (F2 abre no campo) e o botão de entrar do modo ao vivo. */
import { instalarEditor } from "../../editor/editor.ts";

export function iniciarEditor() {
  instalarEditor();
}
