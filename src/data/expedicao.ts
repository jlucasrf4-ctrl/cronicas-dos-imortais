/* ==== Fase 4 ====
   expedição: ondas, sorte com pássaros, tipos de chão e raio de interação. Saíram de base/09 (v3.6) */

export const EXP_WAVES = [3, 4, 5];
export const BIRD_LUCK = 0.15; // chance de acertar um pássaro NÃO marcado
export interface ItemChao {
  name: string;
  emoji: string;
  res?: string;
  item?: string;
  flechas?: number; // v8.0: vai direto para a aljava
}
export const GROUND_DEFS: Record<string, ItemChao> = {
  pena: { name: "Pena", emoji: "🪶", res: "feather" },
  galho: { name: "Galho", emoji: "🪵", item: "galho" },
  pedra: { name: "Pedra", emoji: "🪨", res: "stone" },
  erva: { name: "Erva", emoji: "🌿", item: "erva" },
  // v8.0 — a caminhada do fim da cena inicial (intro/caminhada.ts)
  flecha: { name: "Flecha", emoji: "🏹", flechas: 1 },
  carne_assada: { name: "Carne assada", emoji: "🍖", item: "carne_assada" },
};
export const INTERACT_R = 30;
