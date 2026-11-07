/* ==== Fase 4 — código de carga do antigo src/js/base/05_v3.0_economia_bau_mercado.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarEconomiaBauMercado() na ordem do antigo manifesto. */
import { JANELAS, econ, world } from "../../core/state.ts";
import { BAG_LV, CITIES, HORSE_PRICE, WAGON_PRICE } from "../../data/economia.ts";
import { QUIVER_SHOP } from "../../data/recursos.ts";
import { pay } from "../../econ/armaria.ts";
import { closeChest, renderChest } from "../../econ/bau.ts";
import { bag, startTrip, updateEcon } from "../../econ/economia.ts";
import { bagApply, openMarket, renderMarket } from "../../econ/mercado.ts";
import { rotateDrag } from "../../field/chao.ts";
import { INV, ensureInv } from "../../items/inventario.ts";
import { closeBag } from "../../ui/janelas.ts";

export function iniciarEconomiaBauMercado() {
  /* ---- mercado ---- */
  (function wireV3() {
    const $ = (i: string) => document.getElementById(i);
    $("btn-chest")!.onclick = () => {
      if (bag.open) closeBag();
      INV.chestOpen = true;
      $("chest-modal")!.classList.add("open");
      renderChest();
    };
    $("chest-close")!.onclick = closeChest;
    window.addEventListener("keydown", (e) => {
      if (!INV.chestOpen) return;
      if (e.code === "KeyR") rotateDrag();
      else if (e.code === "Escape") closeChest();
    });
    $("chest-hero")!.onchange = renderChest;
    $("btn-market")!.onclick = () => openMarket();
    $("market-close")!.onclick = () => $("market-modal")!.classList.remove("open");
    $("arrive-close")!.onclick = () => $("arrive-modal")!.classList.remove("open");
    $("mk-hero")!.onchange = renderMarket;
    $("mk-bags")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b || b.disabled) return;
      const msg = $("mk-msg")!;
      if (b.dataset.bag) {
        const h = world.heroes.find((x) => x.id === ($("mk-hero") as HTMLInputElement).value),
          nx = h && BAG_LV[(h.bagLv! | 0) + 1];
        if (h && nx && pay(nx[3])) {
          h.bagLv = (h.bagLv! | 0) + 1;
          bagApply(h);
          msg.textContent = nx[0] + " comprada!";
        }
      } else if (b.dataset.mkq != null) {
        const q = QUIVER_SHOP[+b.dataset.mkq];
        if (pay(q.price)) {
          econ.quiver.type = q.type;
          msg.textContent = q.label + " comprada!";
        }
      } // v7.7: a compra de baú maior saiu (baú infinito, items/bau_infinito.ts)
      renderMarket();
      updateEcon();
    });
    $("mk-mode")!.addEventListener("change", (e) => {
      JANELAS.mkMode = (e.target as HTMLInputElement).value;
      renderMarket();
    });
    $("mk-cities")!.addEventListener("click", (e) => {
      const d = (e.target as HTMLElement).closest(".city-opt") as HTMLElement;
      if (d) {
        JANELAS.mkCity = d.dataset.city!;
        renderMarket();
      }
    });
    $("buy-horse")!.onclick = () => {
      const _p = econ.test ? 0 : HORSE_PRICE;
      if (econ.gold >= _p) {
        econ.gold -= _p;
        econ.horses++;
        renderMarket();
        updateEcon();
      }
    };
    $("buy-wagon")!.onclick = () => {
      const _p = econ.test ? 0 : WAGON_PRICE;
      if (econ.gold >= _p) {
        econ.gold -= _p;
        econ.wagons++;
        renderMarket();
        updateEcon();
      }
    };
    $("mk-send")!.onclick = () => {
      const h = world.heroes.find((x) => x.id === ($("mk-hero") as HTMLInputElement).value),
        msg = $("mk-msg")!;
      if (!h || h.state !== "idle") {
        msg.textContent = "Nenhum personagem livre.";
        return;
      }
      const hasStash = JANELAS.mkMode === "wagon" && econ.stash.items.length;
      if (!ensureInv(h).items.length && !hasStash) {
        msg.textContent = "A mochila está vazia — carregue itens pelo Baú.";
        return;
      }
      startTrip(
        h,
        CITIES.find((c) => c.id === JANELAS.mkCity)!,
        JANELAS.mkMode,
      );
      $("market-modal")!.classList.remove("open");
    };
  })();
}
