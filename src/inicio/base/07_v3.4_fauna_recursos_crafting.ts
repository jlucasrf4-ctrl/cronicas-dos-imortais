/* ==== Fase 4 — código de carga do antigo src/js/base/07_v3.4_fauna_recursos_crafting.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarFaunaRecursosCrafting() na ordem do antigo manifesto. */
import { dungeon, econ, world } from "../../core/state.ts";
import { ARROW_PACKS, QUIVER_SHOP, RECIPES, RES } from "../../data/recursos.ts";
import { closeCraft, openCraft, pay, renderShop } from "../../econ/armaria.ts";
import { updateEcon } from "../../econ/economia.ts";
import { resAdd } from "../../expedicao/preparo.ts";
import { ATLAS, craft, refillQuiver, renderCraft } from "../../render/sprites.ts";
import { pushEvent } from "../../sim/eventos.ts";

export function iniciarFaunaRecursosCrafting() {
  /* ======================= v3.4: FAUNA, RECURSOS E CRAFTING ======================= */
  ATLAS.src = "/src/assets/art/atlas.webp";
  econ.quiver = { type: "comum", n: 20 };
  econ.arrowStock = 0;
  (function wireCraft() {
    const $ = (i: string) => document.getElementById(i);
    $("btn-craft")!.onclick = () => openCraft();
    $("craft-close")!.onclick = () => closeCraft();
    $("craft-list")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-craft]") as HTMLElement;
      if (!b) return;
      craft(
        RECIPES.find((r) => r.id === b.dataset.craft)!,
        +b.dataset.n!,
      );
      renderCraft();
      updateEcon();
    });
  })();
  /* ---- v3.6: ARMARIA (loja de flechas e aljavas) ---- */
  (function wireShop() {
    const $ = (i: string) => document.getElementById(i);
    $("btn-shop")!.onclick = () => {
      $("sh-msg")!.textContent = "";
      renderShop();
      $("shop-modal")!.classList.add("open");
    };
    $("shop-close")!.onclick = () => {
      $("shop-modal")!.classList.remove("open");
      updateEcon();
    };
    $("shop-modal")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.pack != null) {
        const p = ARROW_PACKS[+b.dataset.pack];
        if (pay(p[1])) {
          econ.arrowStock! += p[0];
          refillQuiver();
          $("sh-msg")!.textContent = "Comprou " + p[0] + " flechas.";
        }
      } else if (b.dataset.quiver != null) {
        const s = QUIVER_SHOP[+b.dataset.quiver];
        if (pay(s.price)) {
          econ.quiver.type = s.type;
          refillQuiver();
          $("sh-msg")!.textContent = s.label + " adquirida!";
        }
      }
      renderShop();
      updateEcon();
    });
    const tg = $("toggle-test") as HTMLInputElement;
    tg.addEventListener("change", () => {
      econ.test = tg.checked;
      $("test-tools")!.style.display = econ.test ? "flex" : "none";
      $("e-test")!.style.display = econ.test ? "" : "none";
      pushEvent(econ.test ? "🧪 Modo teste LIGADO: nada tem custo." : "Modo teste desligado.");
      updateEcon();
    });
    $("tt-gold")!.onclick = () => {
      econ.gold += 1000;
      updateEcon();
    };
    $("tt-res")!.onclick = () => {
      const h = world.heroes[0];
      if (!h) {
        pushEvent("Crie um personagem primeiro.");
        return;
      }
      h.loot = h.loot || {};
      for (const k in RES) resAdd(h, k, 20);
      updateEcon();
    };
    $("tt-heal")!.onclick = () => {
      for (const h of world.heroes) h.hp = h.hpMax;
      if (dungeon.active) dungeon.hp = dungeon.hpMax;
    };
  })();
}
