/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.2_icones_pintados.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarIconesPintados() na ordem do antigo manifesto. */
import { ICO_DIAG, TOAST_ICONS } from "../../data/icones.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { ICOS, ICO_EMO, icoHas, icoImg, icoLabel, mobIcons } from "../../ui/icones.ts";

export function iniciarIconesPintados() {
  /* =====================================================================
     v5.2 — ÍCONES PINTADOS (substituem os emojis onde já existe arte)
     As imagens ficam no <style id="ico-css"> como classes .ico-<chave>.
     icoTag(chave, emojiReserva) devolve o ícone pintado ou, se ainda não
     existir arte, o emoji antigo — assim dá para trocar aos poucos.
  ===================================================================== */
  (function () {
    const st = document.getElementById("ico-css");
    if (!st) return;
    const re = /\.ico-([\w]+)\{background-image:url\(([^)]+)\)\}/g;
    let m;
    while ((m = re.exec(st.textContent))) ICOS[m[1]] = m[2];
  })();
  for (const k in ICOS) icoImg(k); // pré-carrega para o canvas
  // botões de toque (celular)
  setInterval(mobIcons, 350);

  /* ---- v5.3: efeitos, criaturas, árvore, interface e molduras ---- */
  for (const k in ITEM_DEFS) {
    const e = ITEM_DEFS[k].emoji;
    if (e && !ICO_EMO[e] && icoHas(k)) ICO_EMO[e] = k;
  }
  TOAST_ICONS.unshift(
    [/^💥$/, "💥", "#ffd24a"],
    [/^🩸$/, "🩸", "#ff6a6a"],
    [/^💫$/, "💫", "#ffe08a"],
    [/^💨$/, "💨", "#bfe8ff"],
    [/^\+🔱$/, "+🔱", "#ffe08a"],
  );
  // rótulo da horda: troca os emojis do começo por ícones
  setTimeout(() => {
    const el = document.getElementById("dungeon-wave-label");
    if (!el || el._icoP) return;
    el._icoP = 1;
    Object.defineProperty(el, "textContent", {
      configurable: true,
      get() {
        return this._v || "";
      },
      set(v) {
        if (this._v === v) return;
        this._v = v;
        this.innerHTML = icoLabel(v);
      },
    });
  }, 0);

  /* ---- v5.3: números de dano legíveis ----
     · golpes seguidos no mesmo alvo (em 0,3 s) somam num número só, que dá um "pulo";
     · sangramento soma num único número vermelho por alvo;
     · números novos abrem em leque (esquerda/direita) e sobem com suavidade;
     · no máximo 5 números por alvo; crítico é dourado, maior e com o ícone de crítico;
     · avisos repetidos (ex.: "Marcado") não empilham. */
  // v5.6: flechas
  Object.assign(ICO_DIAG, { flecha: -45, flecha_pacote: -45, flecha_ouro: -45, flecha_pacote_ouro: -45 });
}
