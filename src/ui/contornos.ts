/* ==== v7.7 — contornos dourados dos encaixes vazios da preparação (arte do GPT aprovada em 2026-10-18; originais em
   "arquivos de transferência/inventario/contornos.png") ====
   Um encaixe vazio mostra o contorno do que vai nele, no lugar do emoji apagado. Chave = id do encaixe (EQ_SLOTS, e
   os da Arma 2 usam os mesmos da Arma 1). */
import type { Hero } from "../core/tipos.ts";

const CONTORNO: Record<string, string> = {
  cabeca: "/src/assets/art/contornos/elmo.webp",
  peito: "/src/assets/art/contornos/armadura.webp",
  pernas: "/src/assets/art/contornos/calca.webp",
  pes: "/src/assets/art/contornos/botas.webp",
  maoD: "/src/assets/art/contornos/maoD.webp",
  maoE: "/src/assets/art/contornos/maoE.webp",
  costas: "/src/assets/art/contornos/arco.webp",
  mochila: "/src/assets/art/contornos/mochila.webp",
  aljava: "/src/assets/art/contornos/aljava.webp",
  // cinto e presilhas (items/cinto.ts)
  cinto: "/src/assets/art/contornos/cinto.webp",
  faca: "/src/assets/art/contornos/faca.webp",
  bolsa: "/src/assets/art/contornos/bolsa.webp",
};

/** A silhueta do herói (preparação e mochila do campo): h.sexo "M" masculina; sem ele, feminina (a heroína). */
export function silhuetaDe(h: Hero) {
  return h.sexo === "M" ? "/src/assets/art/silhueta_m.webp" : "/src/assets/art/silhueta_f.webp";
}
/** O conteúdo de um encaixe vazio: o contorno dourado, ou o emoji apagado de antes se o encaixe não tiver contorno. */
export function encaixeVazio(slot: string, emoji: string) {
  const src = CONTORNO[slot];
  return src
    ? '<img class="p77-vazio" src="' + src + '" alt="" draggable="false">'
    : '<span style="opacity:.25">' + emoji + "</span>";
}
