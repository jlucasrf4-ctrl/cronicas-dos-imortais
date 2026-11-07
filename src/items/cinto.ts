/* ==== v7.7 — cinto com presilhas: facas e bolsas pequenas (aprovado pelo mantenedor em 2026-10-18) ====
   O cinto é um encaixe próprio (h.equip.cinto, fora de EQ_SLOTS, como a mochila e a aljava). O que está preso nele
   fica no próprio item (it.presilhas): tirar o cinto leva as facas e as bolsas junto. O número de presilhas vem da
   qualidade do cinto (CINTO.presilhas: A 1, A+ 2, SS 3). A 1ª presilha é só de faca; as outras levam faca ou bolsa;
   no máximo CINTO.maxFacas facas. Cada bolsa tem a própria grade (it.conteudo, InvGrid com bolsa: true).
   Finalizar um bicho caído com E só funciona com uma faca no cinto (field/faca_corda.ts: finishStart), e gasta a faca;
   a Faca Simples quebra quando a durabilidade acaba. */
import { SUB } from "../data/itens.ts";
import { KNIFE_KEYS } from "../data/combate.ts";
import { ensureEquip, mkItem, placeIn } from "./equipamento.ts";
import { eqDurInit } from "./durabilidade.ts";
import { groundTake } from "../field/chao.ts";
import type { Hero, InvGrid, Item } from "../core/tipos.ts";

const CINTO = {
  presilhas: [1, 2, 3], // por qualidade do cinto (it.tier: A, A+, SS)
  maxFacas: 2,
  bolsa: { cols: 3 * SUB, rows: 2 * SUB }, // 3 × 2 casas
  gastoFinalizar: 4, // durabilidade que a faca do cinto perde a cada finalizar
  quebra: ["eq_faca_simples"], // facas que somem quando a durabilidade acaba (as outras ficam gastas, sem finalizar)
};

export const ehFaca = (it: Item | null | undefined) => !!it && !!it.def && KNIFE_KEYS.includes(it.def.key);
const ehBolsinha = (it: Item | null | undefined) => !!it && !!it.def && it.def.key === "eq_bolsa";

/** Uma bolsa pequena nova, vazia. */
export function novaBolsa() {
  const it = mkItem("eq_bolsa");
  it.conteudo = { cols: CINTO.bolsa.cols, rows: CINTO.bolsa.rows, items: [], bolsa: true };
  return it;
}
/** A grade da bolsa (cria se o save não tiver). */
function gradeBolsa(it: Item): InvGrid {
  if (!it.conteudo) it.conteudo = { cols: CINTO.bolsa.cols, rows: CINTO.bolsa.rows, items: [] };
  it.conteudo.bolsa = true;
  return it.conteudo;
}

export function cintoDe(h: Hero | null | undefined) {
  return h ? ensureEquip(h).cinto || null : null;
}
/** As presilhas do cinto, do tamanho que a qualidade dá (o save antigo ou o cinto novo ganham a lista). */
export function presilhas(cinto: Item) {
  const n = CINTO.presilhas[Math.min(CINTO.presilhas.length - 1, cinto.tier | 0)];
  const p = cinto.presilhas || (cinto.presilhas = []);
  while (p.length < n) p.push(null);
  return p;
}
/** A faca do cinto que finaliza: a primeira com fio (durabilidade > 0). */
export function facaNoCinto(h: Hero | null | undefined) {
  const c = cintoDe(h);
  if (!c) return null;
  for (const it of presilhas(c)) if (ehFaca(it) && eqDurInit(it!).dur! > 0) return it;
  return null;
}
/** Qualquer faca presa no cinto (mesmo gasta): conta como "tem faca" para estocar e esculpir. */
export function qualquerFacaNoCinto(h: Hero | null | undefined) {
  const c = cintoDe(h);
  return c ? presilhas(c).find(ehFaca) || null : null;
}
function bolsasNoCinto(h: Hero | null | undefined) {
  const c = cintoDe(h);
  return c ? (presilhas(c).filter(ehBolsinha) as Item[]) : [];
}

/** Prende `it` (que está na grade `de`) na presilha i do cinto do herói. Devolve a mensagem para o jogador. */
export function prenderNoCinto(h: Hero, it: Item, i: number, de: InvGrid) {
  const c = cintoDe(h);
  if (!c) return "Vista um cinto primeiro.";
  const p = presilhas(c);
  if (i < 0 || i >= p.length) return "Esse cinto não tem essa presilha.";
  const faca = ehFaca(it),
    bolsa = ehBolsinha(it);
  if (!faca && !bolsa) return "Na presilha só vai faca ou bolsa pequena.";
  if (bolsa && i === 0) return "A primeira presilha é da faca.";
  if (faca && p.filter((o, j) => j !== i && ehFaca(o)).length >= CINTO.maxFacas)
    return "No máximo " + CINTO.maxFacas + " facas no cinto.";
  const k = de.items.indexOf(it);
  if (k < 0) return "";
  de.items.splice(k, 1);
  if (de.ground) groundTake(it);
  const antes = p[i];
  if (antes && !placeIn(de, antes)) {
    de.items.push(it); // sem lugar para o que estava: desfaz
    return "Sem espaço para tirar " + antes.def.name + " da presilha.";
  }
  if (bolsa) gradeBolsa(it);
  if (faca) eqDurInit(it);
  p[i] = it;
  return "Prendeu " + it.def.name + " no cinto.";
}
/** Solta o que está na presilha i e guarda na grade `para`. */
export function soltarDoCinto(h: Hero, i: number, para: InvGrid) {
  const c = cintoDe(h);
  if (!c) return "";
  const p = presilhas(c),
    it = p[i];
  if (!it) return "";
  if (!placeIn(para, it)) return "Sem espaço para guardar " + it.def.name + ".";
  p[i] = null;
  return "Tirou " + it.def.name + " do cinto.";
}
/** Presente do tutorial (e itens achados): prende a faca na primeira presilha livre que aceita faca. */
export function prenderSeCouber(h: Hero, it: Item) {
  const c = cintoDe(h);
  if (!c || !ehFaca(it)) return false;
  const p = presilhas(c);
  if (p.filter(ehFaca).length >= CINTO.maxFacas) return false;
  const i = p.findIndex((o) => !o);
  if (i < 0) return false;
  eqDurInit(it);
  p[i] = it;
  return true;
}

/** Finalizou com a faca do cinto: ela gasta; a Faca Simples quebra quando acaba. Devolve o aviso (ou ""). */
export function gastarFacaDoCinto(h: Hero) {
  const it = facaNoCinto(h);
  if (!it) return "";
  it.dur = Math.max(0, it.dur! - CINTO.gastoFinalizar);
  if (it.dur > 0) return "";
  if (CINTO.quebra.includes(it.def.key)) {
    const p = presilhas(cintoDe(h)!),
      i = p.indexOf(it);
    if (i >= 0) p[i] = null;
    return "🔪 " + it.def.name + " quebrou!";
  }
  return "🔪 " + it.def.name + " perdeu o fio: conserte na Forja";
}

/** Saves de antes do cinto (e heróis novos): ganham um cinto comum vazio. */
export function migrarCinto(h: Hero) {
  const e = h.equip;
  if (e && e.cinto === undefined) e.cinto = mkItem("eq_cinto", 0);
}

/** Grades das bolsas presas no cinto (a preparação as mostra ao lado da aljava). */
export function gradesDasBolsas(h: Hero | null | undefined) {
  return bolsasNoCinto(h).map(gradeBolsa);
}
