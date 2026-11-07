/* ==== Fase 4 — galho x lenha, e observar o galho (v7.1, v7.3) ==== */
import { giveItem } from "../minijogos/trabalho.ts";
import { profLv } from "../hero/proficiencias.ts";
import { knifeIn } from "../field/faca_corda.ts";
import { forgeKnows, forgeLearn } from "../forja/forja.ts";
import { OBS_GALHO } from "../data/mapa.ts";
import { gainSkill } from "../hero/nivel.ts";
import { sfx, renderInv } from "../field/chao.ts";
import { itemMsg } from "../field/masmorra.ts";
import { itemCnt, itemTakeH } from "../intro/cena.ts";
import { mkItem, placeIn } from "./equipamento.ts";
import { eqDurInit, eqName } from "./durabilidade.ts";
import { ensureInv } from "./inventario.ts";
import { icoItem } from "../ui/icones.ts";
import { invHeroNow } from "../ui/inventario.ts";
import type { GradeTela, Hero, Item } from "../core/tipos.ts";

/* galho não empilha: entra um por casa; sem espaço, vira lenha no acampamento (1 galho = 2 lenha, como no "Enviar ao acampamento") */
export function galhoAdd(h: Hero, n: number) {
  let g = 0;
  for (let i = 0; i < n; i++) {
    if (giveItem(h, "galho", 0)) g++;
    else {
      h.loot = h.loot || {};
      h.loot.wood = (h.loot.wood || 0) + 2;
    }
  }
  return g;
}
export function isLanca(k: string | null) {
  return k === "eq_lanca" || k === "eq_lanca_madeira";
}

function obsPop(html: string) {
  let el = document.getElementById("obs-pop");
  if (!el) {
    el = document.createElement("div");
    el.id = "obs-pop";
    document.body.appendChild(el);
    el.addEventListener("pointerdown", () => el!.classList.remove("on"));
  }
  el.innerHTML = html;
  el.classList.add("on");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("on"), 7000);
}
export function galhoObservar(h: Hero) {
  if (!h) return;
  const lv = profLv(h, "percepcao"),
    faca = !!knifeIn(h),
    knows = forgeKnows("eq_lanca_madeira");
  let t = "<b>🔍 Percepção Nv." + Math.max(1, lv) + "</b>";
  if (lv <= 1) t += "<p>Um galho.</p>";
  else {
    t += "<p>Galho de madeira. Parece um item essencial para fazer várias coisas.</p>";
    if (lv >= 3) {
      if (knows)
        t +=
          "<p class='ok'>🔱 Você já sabe talhar a <b>Lança de Madeira</b>: " +
          OBS_GALHO.talhar +
          " galhos + uma faca (clique no galho → Talhar).</p>";
      else if (faca) {
        forgeLearn("eq_lanca_madeira");
        gainSkill(h, "percepcao", 10);
        try {
          sfx("perfect");
        } catch (_) {}
        t +=
          "<p class='ok'>💡 Reto, firme… com a faca dá para afiar a ponta. <b>Deduziu: Lança de Madeira!</b><br><small>" +
          OBS_GALHO.talhar +
          " galhos + faca — clique no galho → Talhar (ou na forja).</small></p>";
      } else t += "<p><i>Reto e firme… se tivesse uma faca, daria para afiar a ponta.</i></p>";
    }
  }
  if (!(h._obsG! > performance.now())) {
    h._obsG = performance.now() + 20000;
    gainSkill(h, "percepcao", 1);
  }
  obsPop(t);
}
export function galhoTalhar(h: Hero) {
  if (!h) return;
  if (!knifeIn(h)) {
    itemMsg("Precisa de uma faca 🔪 para talhar");
    return;
  }
  if (itemCnt(h, "galho") < OBS_GALHO.talhar) {
    itemMsg("Precisa de " + OBS_GALHO.talhar + " galhos");
    return;
  }
  const it = mkItem("eq_lanca_madeira");
  eqDurInit(it);
  if (!placeIn(ensureInv(h), it)) {
    itemMsg("Sem espaço na mochila para a lança");
    return;
  }
  itemTakeH(h, "galho", OBS_GALHO.talhar);
  itemMsg("🔱 Talhou uma Lança de Madeira!");
  gainSkill(h, "artesao", 2);
  gainSkill(h, "faca", 1);
  try {
    sfx("ping");
    renderInv();
  } catch (_) {}
}
/* menu do item: galho: analisar (pela Percepção) e talhar lança (invItemMenu chama) */
export function invMenuGalho(it: Item, gr: GradeTela, x: number, y: number) {
  if (!it || !it.def || it.def.key !== "galho") return;
  const h = invHeroNow();
  if (!h) return;
  let m = document.getElementById("inv-menu");
  const extra = [["obs", "🔍 Analisar"]];
  if (forgeKnows("eq_lanca_madeira"))
    extra.push(["tal", "🔪 Talhar Lança de Madeira (" + OBS_GALHO.talhar + " galhos)"]);
  if (!m) {
    m = document.createElement("div");
    m.id = "inv-menu";
    m.style.cssText =
      "position:fixed;z-index:300;left:" +
      Math.min(innerWidth - 300, x + 8) +
      "px;top:" +
      Math.min(innerHeight - 160, y + 8) +
      "px;background:#2b2113;border:1px solid #e0b35f;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;max-width:290px";
    m.innerHTML = "<b style='font-size:.74rem;color:#f0d9a2'>" + icoItem(it.def) + " " + eqName(it) + "</b>";
    document.body.appendChild(m);
    setTimeout(
      () =>
        window.addEventListener(
          "pointerdown",
          function f(ev) {
            if (!m!.contains(ev.target as Node)) {
              m!.remove();
              window.removeEventListener("pointerdown", f, true);
            }
          },
          true,
        ),
      0,
    );
  }
  for (const [a, t] of extra) {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.cssText = "font-size:.72rem;text-align:left";
    b.textContent = t;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      m.remove();
      if (a === "obs") galhoObservar(h);
      else galhoTalhar(h);
    });
    m.insertBefore(b, m.children[1] || null);
  }
}
