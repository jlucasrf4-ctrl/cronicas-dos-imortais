/* ==== v7.7 — campanha (src/campanha/campanha.ts): o quadro do objetivo atual, atualizado algumas vezes por segundo;
   Z perto da tenda = dormir até o amanhecer (src/campanha/sono.ts); as teclas do menu do lobo (campanha/cercado.ts);
   v8.0: J ou clique no quadro = a aba de missões (campanha/diario.ts) ==== */
import { dungeon } from "../../core/state.ts";
import { desenharMissao, ocultarMissao, pedidosTick } from "../../campanha/campanha.ts";
import { avisoNoite, dormir } from "../../campanha/sono.ts";
import { loboConferir } from "../../campanha/lobos.ts";
import { casalTick, teclaMenuLobo } from "../../campanha/cercado.ts";
import { abrirDiario, teclaDiario } from "../../campanha/diario.ts";

/** Quantas vezes por segundo o quadro confere se deve aparecer (título, diálogo, mochila…). */
const MISSAO_HZ = 4;

export function iniciarCampanha() {
  setInterval(() => {
    try {
      desenharMissao();
      avisoNoite();
      loboConferir();
      pedidosTick();
      casalTick();
    } catch (_) {}
  }, 1000 / MISSAO_HZ);
  // v8.0: clicar no quadro do objetivo abre a aba de missões
  document.addEventListener("click", (e) => {
    const alvo = e.target as HTMLElement;
    if (alvo.closest?.("#missao-fechar")) {
      e.preventDefault();
      e.stopPropagation();
      ocultarMissao(true);
    } else if (alvo.closest?.("#missao-abrir")) {
      ocultarMissao(false);
      abrirDiario();
    } else if (alvo.closest?.("#missao")) abrirDiario();
  });
  // captura: a tecla da aba vem antes das do mapa/campo (Esc fecha só ela)
  window.addEventListener(
    "keydown",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (e.repeat || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) return;
      if (teclaDiario(e.code)) e.stopImmediatePropagation();
    },
    true,
  );
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (e.repeat || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) return;
    // v7.7: com o menu do lobo aberto, 1–5 escolhem e E/Esc fecham (campanha/cercado.ts)
    if (teclaMenuLobo(e.code)) return;
    if (e.code === "KeyZ" && dungeon.active) dormir();
  });
}
