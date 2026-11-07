/* ==== Fase 4 ====
   recursos e flechas: nomes dos recursos, aljavas, receitas, alvos de caça, pacotes à venda, cura das ervas, zonas
   de pedra, madeira por árvore. Saíram de base/07 (v3.4) e base/08 (v3.7) */
import type { Receita } from "../core/tipos.ts";

export const RES: Record<string, string[]> = {
  wood: ["🪵", "Madeira"],
  stone: ["🪨", "Pedra"],
  feather: ["🪶", "Pena"],
  eagle: ["🪶", "Pena de Águia"],
};
export const QUIVERS: Record<string, number> = { comum: 30, reforcada: 45, grande: 60 }; // aljavas futuras: é só adicionar aqui
export const RECIPES: Receita[] = [
  {
    id: "arrow_stone",
    name: "Flecha de Pedra",
    icon: "🏹",
    mats: { wood: 1, stone: 1, feather: 1 },
    out: "arrow",
    qty: 1,
  },
  {
    id: "arrow_rustic",
    name: "Flecha Rústica (sem pena)",
    icon: "🪵",
    mats: { wood: 2, stone: 1 },
    out: "arrow",
    qty: 1,
  },
];
export const HUNT_TARGETS = [
  ["rabbit", "🐇 Coelho (1–2 carne)"],
  ["deer", "🦌 Cervo (5–6 carne)"],
  ["duck", "🦆 Pato (penas)"],
  ["eagle", "🦅 Águia (pena rara)"],
  ["tree", "🪵 Madeira (árvores)"],
  ["rock", "🪨 Pedra"],
  ["fish", "🎣 Pesca (peixe)"],
];
export const ARROW_PACKS = [
  [5, 10],
  [10, 18],
  [30, 50],
]; // [flechas, ouro]
export const QUIVER_SHOP = [
  { type: "reforcada", label: "Aljava reforçada (45 flechas · 5 colunas)", price: 140 },
  { type: "grande", label: "Aljava grande (60 flechas · 6 colunas)", price: 380 },
];
export const QUIVER_ORDER = ["comum", "reforcada", "grande"],
  ARROW_STOCK_MAX = 150;
export const HERB_HEAL = [21, 36],
  HERB_TICK = 3; // cada erva cura de 21 a 36 no total, 3 de vida por segundo
export const ROCK_ZONES = [
  [640, 250, 90],
  [300, 265, 45],
  [345, 55, 50],
  [60, 20, 40],
  [70, 305, 25],
  [110, 460, 35],
  [150, 540, 30],
  [780, 580, 30],
  [540, 460, 25],
];
/** v8.1 — raio (unidades do mapa) em volta do acampamento e da vila onde não nasce árvore nem pedra do mapa: ali o
    clique direito é para entrar, não para coletar (map/recursos.ts areaReservada). */
export const AREA_RESERVADA = { acampamento: 36, vila: 28 };
export const TREE_WOOD: Record<string, number[]> = { small: [1, 2], medium: [2, 4], large: [4, 6] };
export const QV_STACK = 10,
  QV_ROWS = 12; // v5.5: aljava fina (pacotes 2×9 + uma faixa embaixo para itens pequenos)
export const RES_KEY: Record<string, string> = { stone: "pedra", feather: "pena", eagle: "penaag" };
/* Preparação: HUD do personagem + mochilas + compra de flechas/ervas antes da masmorra */
export const HERB_PACKS = [
  [1, 6],
  [3, 15],
];
export const FOLH_PACK = [2, 8]; // [ervas, ouro]
