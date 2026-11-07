/* ==== v7.7 — baú infinito (ideia do mantenedor, 2026-10-18; aprovado 2026-10-19) ====
   O baú do acampamento (econ.stash, `infinito`) não tem mais limite. Por dentro continua uma InvGrid: bauFolga
   (items/inventario.ts) deixa sempre BAU.folga fileiras livres no fim, então placeIn/tryAddToInv/moveItem nunca
   recusam. Na tela vira uma lista de quadradinhos iguais, sem forma nem posição (renderBauLista, chamada pelo
   renderInvGrid): arrastar um quadradinho para a mochila põe o item lá com a forma dele; soltar qualquer item em
   qualquer ponto da lista guarda (guardarNoBau, que junta as pilhas de recursos). As melhorias de tamanho antigas
   (CHEST_LV no mercado, Caixa e Baú reforçado na carpintaria) saíram; as novas (abas, ordenar, busca…) vêm depois. */
import { BAU } from "../data/economia.ts";
import { EQ_SLOTS } from "../data/equipamento.ts";
import { INV_CELL } from "../data/itens.ts";
import { dungeon, GL3 } from "../core/state.ts";
import { INV, TIERS } from "./inventario.ts";
import { placeIn } from "./equipamento.ts";
import { isArrowIt } from "./aljava.ts";
import { itemVal, quickMove } from "./qualidade.ts";
import { selTem } from "./selecao_inv.ts";
import { eqDurInit, eqName } from "./durabilidade.ts";
import { eqDurBar } from "../forja/forja.ts";
import { icoHas, icoKeyOf, icoPiece } from "../ui/icones.ts";
import { equipTo, heroOf } from "../ui/inventario.ts";
import { recipCliqueDireito } from "../ui/recipientes.ts";
import { groundTake, renderInv } from "../field/chao.ts";
import { itemMsg, spawnDungeonToast, updateWeaponUI } from "../field/masmorra.ts";
import { updateEcon } from "../econ/economia.ts";
import { renderPrep } from "../expedicao/preparo.ts";
import type { GradeTela, InvGrid, Item } from "../core/tipos.ts";

const ORDEM_SLOT = EQ_SLOTS.map((s) => s.id);
/** Ordem da lista: equipamentos (pela ordem dos encaixes), depois o resto pelo nome; a melhor qualidade primeiro. */
function ordem(a: Item, b: Item) {
  const sa = a.def.slot ? ORDEM_SLOT.indexOf(a.def.slot) : 99,
    sb = b.def.slot ? ORDEM_SLOT.indexOf(b.def.slot) : 99;
  if (sa !== sb) return (sa < 0 ? 98 : sa) - (sb < 0 ? 98 : sb);
  const n = a.def.name.localeCompare(b.def.name, "pt");
  if (n) return n;
  return (b.tier | 0) - (a.tier | 0) || (b.q ?? 1) - (a.q ?? 1);
}

/** Guarda `it` (que está em `de`) no baú: junta nas pilhas de recurso que têm espaço, o resto vai para um lugar
    livre (o baú sempre tem). false = não vai (flechas só vão na aljava). */
export function guardarNoBau(it: Item, de: InvGrid, bau: InvGrid) {
  if (isArrowIt(it)) {
    itemMsg("Flechas só vão na aljava.");
    return false;
  }
  const i = de.items.indexOf(it);
  if (i >= 0) de.items.splice(i, 1);
  if (de.ground) groundTake(it);
  if (it.def.res && it.def.stack)
    for (const t of bau.items) {
      if ((it.n || 1) <= 0) break;
      if (t.def.key !== it.def.key || (t.tier | 0) !== (it.tier | 0) || (t.n || 1) >= it.def.stack) continue;
      const q = Math.min(it.def.stack - (t.n || 1), it.n || 1);
      t.n = (t.n || 1) + q;
      it.n = (it.n || 1) - q;
    }
  if ((it.n || 1) > 0 && !placeIn(bau, it)) bau.items.push(it);
  return true;
}

/** Desenha o baú como lista de quadradinhos (no lugar da grade). */
export function renderBauLista(gr: GradeTela) {
  const g = gr.el,
    inv = gr.inv,
    lado = BAU.peca * INV_CELL;
  g.innerHTML = "";
  g._gr = gr;
  g.classList.add("bau-lista");
  g.classList.remove("grade-a2");
  g.style.width = inv.cols * INV_CELL + "px";
  g.style.height = "";
  g.style.backgroundImage = "";
  g.oncontextmenu = (ev: Event) => ev.preventDefault();
  const D = INV.invDrag;
  g.classList.toggle("alvo", !!D && !!D.over && D.over.inv === inv && D.from.inv !== inv);
  if (!inv.items.length) {
    const v = document.createElement("div");
    v.className = "bau-vazio";
    v.textContent = "Baú vazio — arraste itens para cá.";
    g.appendChild(v);
  }
  const quadrado = [0, 1, 2].map(() => [1, 1, 1]);
  for (const it of inv.items.slice().sort(ordem)) {
    if (D && D.it === it) continue;
    eqDurInit(it);
    const w = document.createElement("div");
    w.className =
      "inv-item bau-peca" + (it.tier ? " tier" + Math.min(2, it.tier) : "") + (selTem(it) ? " inv-sel" : "");
    w._it = it;
    w.title =
      eqName(it) +
      (it.tier ? " [" + TIERS[it.tier].lab + "]" : "") +
      (it.n! > 1 ? " ×" + it.n : "") +
      " · valor " +
      itemVal(it);
    const c = document.createElement("div");
    c.className = "inv-cell";
    c.dataset.r = "0";
    c.dataset.c = "0";
    c.style.width = c.style.height = lado + "px";
    w.appendChild(c);
    const e = document.createElement("div");
    e.className = "inv-emo";
    e.style.width = e.style.height = lado + "px";
    const k = icoKeyOf(it);
    if (k && icoHas(k))
      icoPiece(e, k, lado, lado, it.def.slot ? (it.q ?? 1) : it.tier ? 10 + Math.min(2, it.tier) : null);
    else {
      e.textContent = it.def.emoji;
      e.style.fontSize = lado * 0.6 + "px";
    }
    w.appendChild(e);
    if (it.tier && !it.def.slot) {
      const b = document.createElement("i");
      b.className = "tier-b";
      b.style.color = TIERS[it.tier].col;
      b.textContent = TIERS[it.tier].lab;
      w.appendChild(b);
    }
    if ((it.n || 1) > 1) {
      const m = document.createElement("small");
      m.className = "inv-cnt";
      m.textContent = String(it.n);
      w.appendChild(m);
    }
    eqDurBar(w, it, quadrado);
    w.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || INV.invDrag) return;
      ev.preventDefault();
      if ((ev.ctrlKey || ev.metaKey || ev.shiftKey) && INV.invGrids.length > 1) {
        quickMove(it, gr);
        renderInv();
        updateEcon();
        return;
      }
      // o item sai com a forma dele, com o canto de cima à esquerda no ponteiro
      INV.invDrag = {
        sx: ev.clientX,
        sy: ev.clientY,
        moved: false,
        it,
        from: gr,
        over: gr,
        shape: it.shape,
        ox: 0,
        oy: 0,
        gx: it.x,
        gy: it.y,
      };
      renderInv();
    });
    w.addEventListener("dblclick", () => {
      const h = heroOf();
      if (!it.def.slot || isArrowIt(it) || !h) return;
      const msg = equipTo(h, it, gr, it.def.slot);
      if (dungeon.active) {
        spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
        GL3.heroKey = "";
        updateWeaponUI();
        renderInv();
      } else {
        const m = document.getElementById("prep-msg");
        if (m) m.textContent = msg;
        renderPrep();
      }
    });
    w.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (recipCliqueDireito(it, gr)) renderInv();
    });
    g.appendChild(w);
  }
}
