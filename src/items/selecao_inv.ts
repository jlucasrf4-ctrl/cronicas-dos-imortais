/* ==== v7.7 — seleção de vários itens na mochila (pedido do mantenedor, 2026-10-18: "não dá pra selecionar mais de uma
   coisa e enviar tudo") ====
   Arrastar um retângulo a partir de uma casa vazia seleciona os itens que ele toca (Shift soma à seleção); no menu do
   item, "Selecionar" e "Selecionar todos: <nome>". Com seleção, um toque num item marca/desmarca em vez de abrir o
   menu (cinematica.ts, pointerup) e a barra #inv-selbar oferece: enviar ao acampamento (carne, peixe, galho), largar no
   chão (no campo), mover para o outro lado (baú ⇄ mochila) e limpar. Esc ou fechar a mochila limpa.
   v7.7 (2026-10-19): arrastar um item selecionado para outra grade leva a seleção inteira (selSoltarGrupo; o fantasma
   mostra ×N). Na mesma grade só o item arrastado se move. */
import { dungeon } from "../core/state.ts";
import { INV, canPlace, lugarMaisPerto, shapeCells } from "./inventario.ts";
import { isArrowIt } from "./aljava.ts";
import { quickMove } from "./qualidade.ts";
import { CAMP_SEND } from "../data/economia.ts";
import { renderInv, largarNoChao, groundTake } from "../field/chao.ts";
import { itemMsg } from "../field/masmorra.ts";
import { guardarNoBau } from "./bau_infinito.ts";
import { enviarAoAcampamento } from "../econ/bau.ts";
import { updateEcon } from "../econ/economia.ts";
import { INV_CELL } from "../data/itens.ts";
import type { GradeTela, Item } from "../core/tipos.ts";

interface EstadoSELI {
  itens: Set<Item>;
  caixa: { gr: GradeTela; sx: number; sy: number; el: HTMLDivElement; soma: boolean } | null;
}
const SELI: EstadoSELI = { itens: new Set(), caixa: null };

export function selTem(it: Item) {
  return SELI.itens.has(it);
}
/** Toque num item com seleção: marca/desmarca. false = não há seleção (segue para o menu do item). */
export function selAlternar(it: Item) {
  if (!SELI.itens.size) return false;
  if (SELI.itens.has(it)) SELI.itens.delete(it);
  else SELI.itens.add(it);
  renderInv();
  return true;
}
export function selAdicionar(its: Item[]) {
  for (const it of its) SELI.itens.add(it);
  renderInv();
}
export function selLimpar() {
  if (!SELI.itens.size) return false;
  SELI.itens.clear();
  renderInv();
  barra();
  return true;
}
function gradeDe(it: Item) {
  return INV.invGrids.find((g) => g.inv.items.includes(it));
}
/** Itens selecionados que ainda estão numa grade aberta, com a grade. */
function selecionados() {
  const r: { it: Item; gr: GradeTela }[] = [];
  for (const it of SELI.itens) {
    const gr = gradeDe(it);
    if (gr) r.push({ it, gr });
    else SELI.itens.delete(it);
  }
  return r;
}

/* ---- retângulo de seleção ---- */
function celula(gr: GradeTela, x: number, y: number) {
  const rc = gr.el.getBoundingClientRect();
  return [
    Math.max(0, Math.min(gr.inv.cols - 1, Math.floor((x - rc.left) / INV_CELL))),
    Math.max(0, Math.min(gr.inv.rows - 1, Math.floor((y - rc.top) / INV_CELL))),
  ];
}
/** Casa vazia da grade (renderInvGrid, pointerdown): começa o retângulo. */
export function selCaixaInicio(gr: GradeTela, e: PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  const el = document.createElement("div");
  el.className = "inv-caixa";
  SELI.caixa = { gr, sx: e.clientX, sy: e.clientY, el, soma: e.shiftKey };
  window.addEventListener("pointermove", caixaMove);
  window.addEventListener("pointerup", caixaFim, { once: true });
}
function caixaMove(e: PointerEvent) {
  const C = SELI.caixa;
  if (!C) return;
  if (!C.el.isConnected) C.gr.el.appendChild(C.el); // renderInv refaz a grade
  const rc = C.gr.el.getBoundingClientRect(),
    x0 = Math.min(C.sx, e.clientX) - rc.left,
    y0 = Math.min(C.sy, e.clientY) - rc.top;
  C.el.style.left = x0 + "px";
  C.el.style.top = y0 + "px";
  C.el.style.width = Math.abs(e.clientX - C.sx) + "px";
  C.el.style.height = Math.abs(e.clientY - C.sy) + "px";
}
function caixaFim(e: PointerEvent) {
  window.removeEventListener("pointermove", caixaMove);
  const C = SELI.caixa;
  SELI.caixa = null;
  if (!C) return;
  C.el.remove();
  if (Math.hypot(e.clientX - C.sx, e.clientY - C.sy) < 6) {
    if (!C.soma) selLimpar(); // um toque numa casa vazia limpa
    return;
  }
  const [ax, ay] = celula(C.gr, C.sx, C.sy),
    [bx, by] = celula(C.gr, e.clientX, e.clientY),
    [x0, x1] = ax < bx ? [ax, bx] : [bx, ax],
    [y0, y1] = ay < by ? [ay, by] : [by, ay];
  if (!C.soma) SELI.itens.clear();
  for (const it of C.gr.inv.items)
    if (
      it.shape.some((row, r) =>
        row.some((v, c) => v && it.x + c >= x0 && it.x + c <= x1 && it.y + r >= y0 && it.y + r <= y1),
      )
    )
      SELI.itens.add(it);
  renderInv();
}

/* ---- a barra de ações ---- */
function barraEl() {
  let el = document.getElementById("inv-selbar");
  if (!el) {
    el = document.createElement("div");
    el.id = "inv-selbar";
    el.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b) agir(b.dataset.a || "");
    });
    document.body.appendChild(el);
  }
  return el;
}
const podeLargar = () => dungeon.active && !!dungeon.invOpen;
const podeMover = () => INV.chestOpen;
/** Fim do renderInv: tira da seleção o que saiu das grades e redesenha a barra. */
export function barra() {
  const sel = selecionados(),
    el = barraEl();
  if (!sel.length) {
    el.classList.remove("on");
    return;
  }
  let meat = 0,
    wood = 0,
    vai = 0;
  for (const { it } of sel)
    if (CAMP_SEND[it.def.key]) {
      const g = CAMP_SEND[it.def.key](it);
      meat += g.meat || 0;
      wood += g.wood || 0;
      vai++;
    }
  const ganho = [meat ? "+" + meat + " 🥩" : "", wood ? "+" + wood + " 🔥" : ""].filter(Boolean).join(" ");
  const largaveis = sel.filter(({ it, gr }) => !gr.inv.ground && !isArrowIt(it)).length;
  el.innerHTML =
    "<b>" +
    sel.length +
    (sel.length === 1 ? " selecionado" : " selecionados") +
    "</b>" +
    (vai
      ? '<button class="btn" data-a="enviar">⛺ Enviar ao acampamento' +
        (vai < sel.length ? " (" + vai + " de " + sel.length + ")" : "") +
        " <small>" +
        ganho +
        "</small></button>"
      : '<span class="nada">nada disso vai para o acampamento (só carne, peixe e galho)</span>') +
    (podeLargar() && largaveis ? '<button class="btn" data-a="largar">🟫 Largar no chão</button>' : "") +
    (podeMover() ? '<button class="btn" data-a="mover">↔ Mover para o outro lado</button>' : "") +
    '<button class="btn" data-a="limpar">✕ <kbd>Esc</kbd></button>';
  el.classList.add("on");
}
function agir(a: string) {
  const sel = selecionados();
  if (a === "enviar") {
    enviarAoAcampamento(sel);
    for (const { it } of sel) if (CAMP_SEND[it.def.key]) SELI.itens.delete(it);
  } else if (a === "largar" && podeLargar()) {
    for (const { it, gr } of sel)
      if (!gr.inv.ground && !isArrowIt(it)) {
        largarNoChao(it, gr.inv);
        SELI.itens.delete(it);
      }
  } else if (a === "mover" && podeMover()) {
    for (const { it, gr } of sel) quickMove(it, gr);
  } else if (a === "limpar") SELI.itens.clear();
  renderInv();
  updateEcon();
  barra();
}

/* ---- arrastar a seleção inteira (v7.7, 2026-10-19) ---- */
/** Quantos itens vão junto se `it` for arrastado (0 = só ele: não está selecionado ou a seleção é só ele). */
export function selGrupoN(it: Item) {
  if (!SELI.itens.has(it) || SELI.itens.size < 2) return 0;
  return selecionados().length;
}
/** Soltou um item selecionado em OUTRA grade: o grupo todo vai junto, guardando a arrumação entre eles quando dá
    (cada um no lugar livre mais perto do ponto correspondente). O que não couber fica onde estava, com um aviso.
    Na área do chão, tudo vai para o mundo ao lado do personagem. true = tratou o soltar. */
export function selSoltarGrupo(
  arr: { it: Item; from: GradeTela; shape: number[][]; gx: number; gy: number },
  to: GradeTela,
) {
  if (selGrupoN(arr.it) < 2 || to.inv === arr.from.inv) return false;
  const sel = selecionados().filter(({ gr }) => gr.inv !== to.inv);
  // o arrastado primeiro (com o giro do arrasto), depois os outros do maior para o menor
  sel.sort((a, b) => (a.it === arr.it ? -1 : b.it === arr.it ? 1 : shapeCells(b.it.shape) - shapeCells(a.it.shape)));
  let foram = 0,
    ficaram = 0;
  for (const { it, gr } of sel) {
    if (to.inv.ground) {
      if (!dungeon.active || isArrowIt(it)) {
        ficaram++;
        continue;
      }
      largarNoChao(it, gr.inv);
      SELI.itens.delete(it);
      foram++;
      continue;
    }
    if (to.inv.infinito) {
      // o baú infinito sempre tem lugar (items/bau_infinito.ts); flechas não vão
      if (guardarNoBau(it, gr.inv, to.inv)) foram++;
      else ficaram++;
      continue;
    }
    const sh = it === arr.it ? arr.shape : it.shape,
      gx = arr.gx + (it.x - arr.it.x),
      gy = arr.gy + (it.y - arr.it.y),
      p = canPlace(to.inv, sh, gx, gy, it) ? { x: gx, y: gy, shape: sh } : lugarMaisPerto(to.inv, sh, gx, gy, it);
    if (!p) {
      ficaram++;
      continue;
    }
    gr.inv.items.splice(gr.inv.items.indexOf(it), 1);
    to.inv.items.push(it);
    if (gr.inv.ground) groundTake(it);
    it.x = p.x;
    it.y = p.y;
    it.shape = p.shape;
    foram++;
  }
  if (ficaram) itemMsg(foram + " foram, " + ficaram + " não couberam (ficaram onde estavam).");
  return true;
}

/** Fechou a mochila/baú (nenhuma grade na tela): a seleção some. */
export function selVigiar() {
  if (SELI.itens.size && !INV.invGrids.some((g) => g.el && g.el.offsetParent)) {
    SELI.itens.clear();
    barra();
  }
}
