/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.02_melhorias.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarMelhorias() na ordem do antigo manifesto. */
import { dungeon } from "../../core/state.ts";
import { INV_CELL } from "../../data/itens.ts";
import { hvRelease } from "../../field/armas.ts";
import { FIRE, fireOpen } from "../../field/fogueira.ts";
import { eqQ } from "../../items/equipamento.ts";
import { INV, TIERS } from "../../items/inventario.ts";
import { CAMP } from "../../survival/acampamento.ts";
import { TIP, invLayout, itemTipHtml, tipEl, tipHide } from "../../ui/inventario.ts";
import type { Item } from "../../core/tipos.ts";

export function iniciarMelhorias() {
  /* =====================================================================
     v5.9.02 — MELHORIAS
     · Mochila cheia ao pegar algo: abre a tela Mochila × Chão para comparar e escolher.
     · Dica de item ao passar o mouse (nome, qualidade, dano/proteção, durabilidade, peso, valor e
       comparação com o equipado) em todas as mochilas, baú e chão.
     · 🧹 Organizar: arruma a mochila/baú sozinho (10 de ouro).
     · Fogueira na masmorra (F): pedras (bater uma na outra) ou graveto (fricção), cada uma com seu
       minigame. Cada fogueira acesa sobe o nível e facilita; no nível 5 acende direto.
     · Machado: botão direito = golpe pesado carregado (gasta fôlego) que ALEIJA (lento);
       o tempo de carga aumenta a duração, não o dano.
     · Clava: todo golpe é carregado — o básico carrega e solta um combo de 2 golpes; o botão
       direito carrega mais e, cheio, solta um PORRADÃO que atordoa (soltar antes cancela).
  ===================================================================== */

  /* ---------------- dica de item (tooltip) ---------------- */
  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      const w = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest(".inv-item");
      const g = w && w.parentElement;
      if (!w || !g || !g._gr || (typeof INV.invDrag !== "undefined" && INV.invDrag) || w.classList.contains("fix")) {
        if (TIP.it) tipHide();
        return;
      }
      const inv = g._gr.inv,
        rc = g.getBoundingClientRect(),
        cx = Math.floor((e.clientX - rc.left) / INV_CELL),
        cy = Math.floor((e.clientY - rc.top) / INV_CELL);
      // v7.7: no baú infinito (lista) cada quadradinho sabe o seu item (items/bau_infinito.ts)
      const it =
        (w as HTMLElement)._it ||
        inv.items.find((o: Item) => {
          const sy = cy - o.y,
            sx = cx - o.x;
          return sy >= 0 && sx >= 0 && o.shape[sy] && o.shape[sy][sx];
        });
      if (!it) {
        tipHide();
        return;
      }
      const t = tipEl();
      if (TIP.it !== it) {
        TIP.it = it;
        t.innerHTML = itemTipHtml(it);
        const Q = it.def.slot ? eqQ(it) : null;
        t.style.borderColor = Q ? Q.col : it.tier ? TIERS[it.tier].col : "#c9a25a";
      }
      t.style.display = "block";
      const tw = t.offsetWidth,
        th = t.offsetHeight;
      let x = e.clientX + 18,
        y = e.clientY + 14;
      if (x + tw > innerWidth - 6) x = e.clientX - tw - 14;
      if (y + th > innerHeight - 6) y = innerHeight - th - 6;
      t.style.left = x + "px";
      t.style.top = Math.max(6, y) + "px";
    },
    { passive: true },
  );
  document.addEventListener("pointerdown", () => tipHide(), true);

  /* ---------------- FOGUEIRA NA MASMORRA (F) ---------------- */
  window.addEventListener("keydown", (e) => {
    if (
      e.code === "KeyF" &&
      dungeon.active &&
      !FIRE.open &&
      !dungeon.modalOpen &&
      !dungeon.invOpen &&
      !dungeon.craftOpen &&
      !(typeof CAMP !== "undefined" && CAMP.open) &&
      !e.repeat
    ) {
      const tg = e.target as HTMLElement;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
      fireOpen();
    }
  });
  setTimeout(function fbtn() {
    const herb = document.getElementById("dungeon-herb");
    if (!herb) {
      setTimeout(fbtn, 800);
      return;
    }
    if (document.getElementById("dungeon-fire")) return;
    const b = document.createElement("button");
    b.className = "btn";
    b.id = "dungeon-fire";
    b.innerHTML = "🔥<kbd>F</kbd>"; // v7.7: HUD compacta (o nome vai no title)
    b.title = "Fogueira (F)";
    b.onclick = () => fireOpen();
    herb.after(b);
  }, 400);

  /* ---------------- MACHADO e CLAVA: golpes carregados ---------------- */
  for (const _ev of ["pointerup"] as const)
    window.addEventListener(_ev, (e) => {
      if (!dungeon.active || !dungeon.hv) return;
      if (e.button === 2) hvRelease("R");
      else if (e.button === 0 && !dungeon.alvoAutomatico) hvRelease("L");
    });
  window.addEventListener("blur", () => {
    if (dungeon.hv) dungeon.hv = null;
  });
  setTimeout(function hvTb() {
    const p = document.getElementById("tb-parry"),
      a = document.getElementById("tb-atk");
    if (!p || !a) {
      setTimeout(hvTb, 800);
      return;
    }
    for (const ev of ["pointerup", "pointercancel"]) {
      p.addEventListener(ev, () => hvRelease("R"));
      a.addEventListener(ev, () => hvRelease("L"));
    }
  }, 600);
  /* ---------------- layout da mochila na masmorra: aljava à direita, chão logo abaixo da mochila ---------------- */
  setTimeout(function il() {
    if (!invLayout()) setTimeout(il, 500);
  }, 300);
}
