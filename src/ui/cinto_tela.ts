/* ==== v7.7 — o cinto na tela: a faixa de couro (encaixe do cinto + presilhas) e as grades das bolsas ====
   Usado na preparação (ui/preparo_tela.ts) e na mochila do campo (ui/inventario.ts: dollHtml; field/chao.ts:
   renderInv). O encaixe do cinto tem data-slot e data-eqs = "cinto" (os dois jeitos de soltar/clicar: preparo e
   campo); cada presilha tem data-presilha = i (items/equipamento.ts: eqDropAt prende; o clique solta). */
import { esc } from "../core/util.ts";
import { TIERS } from "../items/inventario.ts";
import { eqDurCol, eqDurInit, eqName, eqPct } from "../items/durabilidade.ts";
import { cintoDe, ehFaca, facaNoCinto, gradesDasBolsas, presilhas } from "../items/cinto.ts";
import { icoItemQ, icoTag } from "./icones.ts";
import { encaixeVazio } from "./contornos.ts";
import type { GradeTela, Hero, Item } from "../core/tipos.ts";

function durBarra(it: Item) {
  const p = eqPct(eqDurInit(it));
  return "<b class='eq-dur'><i style='width:" + Math.round(p * 100) + "%;background:" + eqDurCol(p) + "'></i></b>";
}
/** O conteúdo da faixa do cinto. `cls` é a classe do encaixe na tela (eq-slot no preparo, dslot no campo). */
export function faixaCintoHtml(h: Hero, cls: string) {
  const c = cintoDe(h),
    enc = (attrs: string, it: Item | null, vazio: string, rot: string, titulo: string) =>
      '<div class="p77-pres"><span>' +
      rot +
      '</span><div class="' +
      cls +
      (it ? "" : " empty") +
      '" ' +
      attrs +
      ' title="' +
      esc(titulo) +
      '">' +
      (it ? icoItemQ(it) + durBarra(it) : vazio) +
      "</div></div>";
  let html = enc(
    'data-slot="cinto" data-eqs="cinto"',
    c,
    encaixeVazio("cinto", "🪢"),
    "Cinto" + (c ? " " + TIERS[c.tier | 0].lab : ""),
    c ? eqName(c) + " · clique para tirar (leva o que está preso)" : "Sem cinto: arraste um cinto para cá",
  );
  html += '<i class="p77-costura"></i>';
  if (c)
    html += presilhas(c)
      .map((it, i) =>
        enc(
          'data-presilha="' + i + '"',
          it,
          i === 0
            ? encaixeVazio("faca", "🔪")
            : '<span class="p77-duplo">' + encaixeVazio("faca", "🔪") + encaixeVazio("bolsa", "👝") + "</span>",
          it ? (ehFaca(it) ? "Faca" : "Bolsa") : i === 0 ? "Faca" : "Faca ou bolsa",
          it
            ? eqName(it) + " · clique para tirar do cinto"
            : "Presilha " + (i + 1) + ": arraste " + (i === 0 ? "uma faca" : "uma faca ou uma bolsa pequena"),
        ),
      )
      .join("");
  const faca = facaNoCinto(h);
  html +=
    '<p class="p77-nota">' +
    (!c
      ? "Sem cinto não dá para levar faca e bolsa à mão."
      : faca
        ? "🔪 " + esc(faca.def.name) + " à mão: finaliza bichos caídos ou laçados (E)."
        : "Sem faca no cinto: o E não finaliza.") +
    "</p>";
  return html;
}

/** Uma grade por bolsa presa no cinto, dentro de `box` (cria/tira os quadros), para INV.invGrids. */
export function bolsasNaTela(h: Hero, box: HTMLElement | null): GradeTela[] {
  if (!box) return [];
  const gs = gradesDasBolsas(h);
  while (box.children.length > gs.length) box.lastElementChild!.remove();
  while (box.children.length < gs.length) {
    const d = document.createElement("div");
    d.className = "p77-bolsa";
    d.innerHTML =
      "<h3>" + icoTag("eq_bolsa", "👝") + " Bolsa do cinto <small>3 × 2</small></h3><div class='gridbox'></div>";
    box.appendChild(d);
  }
  return gs.map((inv, i) => ({ el: box.children[i].querySelector<HTMLElement>(".gridbox")!, inv }));
}
