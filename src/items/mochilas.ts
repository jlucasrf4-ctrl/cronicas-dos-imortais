/* ==== v7.7 — mochila e aljava como itens equipáveis e desequipáveis (documento mestre 4.2; decisão do mantenedor, 2026-10-17) ====
   Equipada (h.equip.mochila / h.equip.aljava): o conteúdo é a grade de sempre, h.inv / h.inv2. Guardada: o item leva o
   conteúdo em it.conteudo, ocupa MOCHILA.fechada / ALJAVA.fechada casinhas e a grade do herói vira 0×0 (o que a
   heroína ganhar vai para a outra, o baú ou o chão, como com a mochila cheia). Nunca os dois ao mesmo tempo: o save é
   JSON, e um objeto em dois lugares voltaria como duas cópias. Mochila e aljava não entram em mochila nem em aljava:
   vão no tamanduá (alforjes), no baú ou no chão.
   Aljava: as flechas são um total (econ.quiver.n) que qvSync desenha como pacotes na grade. Guardada, ela leva o total
   em it.flechas (os pacotes saem do conteúdo) e o arco fica sem flechas; vestida, o total dela volta para econ.quiver.n.
   Saves de antes: quem não tem o encaixe (undefined) ganha a mochila/aljava equipada com o conteúdo que já tinha. */
import { dungeon, econ } from "../core/state.ts";
import { MOCHILA } from "../data/itens.ts";
import { QV_ROWS } from "../data/recursos.ts";
import { ensureEquip, placeIn } from "./equipamento.ts";
import { isArrowIt, qvSync } from "./aljava.ts";
import { buildGroundInv, groundPut, groundTake } from "../field/chao.ts";
import { mountBag, mountNear } from "../creatures/tamandua.ts";
import type { Hero, InvGrid, Item } from "../core/tipos.ts";

/** Os dois recipientes que se vestem: chave do item, encaixe, grade do herói e o nome nas mensagens. */
const BOLSAS: Record<string, { key: string; nome: string; grade: "inv" | "inv2"; nova: () => InvGrid }> = {
  mochila: {
    key: "eq_mochila",
    nome: "a mochila",
    grade: "inv",
    nova: () => ({ cols: MOCHILA.cols, rows: MOCHILA.rows, items: [], mochila: true }),
  },
  aljava: {
    key: "eq_aljava",
    nome: "a aljava",
    grade: "inv2",
    nova: () => ({ cols: 0, rows: QV_ROWS, items: [], qv: true }),
  },
};
const vazia = (slot: string): InvGrid =>
  slot === "aljava" ? { cols: 0, rows: 0, items: [], qv: true } : { cols: 0, rows: 0, items: [], mochila: true };

export function ehMochila(it: Item | null | undefined) {
  return !!it && !!it.def && it.def.key === "eq_mochila";
}
/** Mochila ou aljava (o que não entra em grade de herói). */
export function ehBolsa(it: Item | null | undefined) {
  return !!it && !!it.def && (it.def.key === "eq_mochila" || it.def.key === "eq_aljava");
}
/** Sem a aljava no corpo a grade dela é 0×0 (preparo.ts: qvInv). Save sem o encaixe conta como vestida. */
export function temAljava(h: Hero) {
  return !h.equip || h.equip.aljava !== null;
}

/** Onde a bolsa tirada do corpo vai, sem outro lugar escolhido: com o tamanduá perto, nos alforjes; no campo, no
    chão; fora do campo (preparo, mapa), no baú. */
function destinoPadrao(): InvGrid | "chao" {
  const d = dungeon;
  if (d.active) {
    if (d.mount && (d.mount.mounted || mountNear(d.tile * 2))) {
      const b = mountBag();
      if (b) return b;
    }
    return "chao";
  }
  return econ.stash;
}
function largarNoChao(it: Item) {
  const d = dungeon;
  if (!d.gInv) buildGroundInv();
  if (!placeIn(d.gInv!, it)) d.gInv!.items.push(it);
  groundPut(it);
}
/** Fecha a bolsa do corpo: o conteúdo (e as flechas, na aljava) passa para o item. */
function fechar(h: Hero, slot: string, it: Item) {
  const B = BOLSAS[slot],
    g = h[B.grade] || B.nova();
  if (slot === "aljava") {
    g.items = g.items.filter((i) => !isArrowIt(i)); // os pacotes são o desenho do total
    it.flechas = econ.quiver.n;
    econ.quiver.n = 0;
  }
  it.conteudo = g;
  h[B.grade] = vazia(slot);
}
/** Abre a bolsa no corpo: o conteúdo do item vira a grade do herói. */
function abrir(h: Hero, slot: string, it: Item) {
  const B = BOLSAS[slot],
    g = it.conteudo || B.nova();
  if (slot === "aljava") {
    g.qv = true;
    econ.quiver.n += it.flechas || 0;
    delete it.flechas;
  } else g.mochila = true;
  h[B.grade] = g;
  delete it.conteudo;
  ensureEquip(h)[slot] = it;
  if (slot === "aljava") qvSync(h); // os pacotes de flechas voltam para a grade
}

/** Tira a bolsa do encaixe `slot` e guarda em `para` (ou no destino padrão). Devolve a mensagem para o jogador. */
export function desequiparBolsa(h: Hero, slot: string, para?: InvGrid | "chao") {
  const e = ensureEquip(h),
    it = e[slot],
    B = BOLSAS[slot];
  if (!it || !B) return "";
  const dest = para ?? destinoPadrao();
  if (dest !== "chao" && (dest.mochila || dest.qv)) return "Não cabe dentro de outra mochila ou aljava.";
  const n = econ.quiver.n;
  fechar(h, slot, it);
  e[slot] = null;
  if (dest === "chao") {
    largarNoChao(it);
    return "Largou " + B.nome + " no chão.";
  }
  if (placeIn(dest, it)) return "Guardou " + B.nome + (dest === econ.stash ? " no baú." : ".");
  // sem lugar: volta para o corpo
  h[B.grade] = it.conteudo!;
  delete it.conteudo;
  delete it.flechas;
  econ.quiver.n = n;
  e[slot] = it;
  if (slot === "aljava") qvSync(h);
  return "Sem espaço para guardar " + B.nome + ".";
}

/** Veste a bolsa `it`, que está na grade `de`; a que estava no corpo vai para o lugar dela. */
export function equiparBolsa(h: Hero, it: Item, de: InvGrid) {
  const slot = it.def.slot!,
    e = ensureEquip(h),
    i = de.items.indexOf(it);
  if (i < 0 || !BOLSAS[slot]) return "";
  const antiga = e[slot],
    { x, y } = it;
  de.items.splice(i, 1);
  if (de.ground) groundTake(it);
  if (antiga) {
    fechar(h, slot, antiga);
    antiga.x = x;
    antiga.y = y;
    antiga.shape = it.shape;
    de.items.push(antiga);
    if (de.ground) groundPut(antiga);
  }
  abrir(h, slot, it);
  return antiga ? "Trocou " + BOLSAS[slot].nome + "." : "Vestiu " + BOLSAS[slot].nome + ".";
}

/** Veste uma bolsa que não está em grade nenhuma (pega do chão com E), se o encaixe estiver vazio. */
export function vestirBolsa(h: Hero, it: Item) {
  const slot = it.def.slot!;
  if (!BOLSAS[slot] || ensureEquip(h)[slot]) return "";
  abrir(h, slot, it);
  return "Vestiu " + BOLSAS[slot].nome + ".";
}
/** Saves de antes do encaixe: a mochila e a aljava de sempre viram os itens equipados (o conteúdo continua o mesmo). */
export function migrarBolsas(h: Hero, criar: (k: string) => Item) {
  const e = h.equip;
  if (!e) return;
  for (const slot in BOLSAS) if (e[slot] === undefined) e[slot] = criar(BOLSAS[slot].key);
}
