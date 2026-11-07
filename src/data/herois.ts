/* ==== Fase 4 ====
   heróis: cores, vagas, nomes das perícias, velocidade e visão no mapa, rótulos de estado, sílabas dos nomes
   sorteados. Saíram de base/01 e base/08 */

export const HERO_COLORS = ["#ffd27a", "#7adfff", "#ff9ad1", "#b6ff9a", "#c9a2ff", "#ffb37a"];
export const HERO_MAX_SLOTS = 4;
export const SKILL_LABELS: Record<string, string> = { arco: "Arco", espada: "Espada" };
export const HERO_SPEED = 3.6;
export const HERO_VISION = 110;

export const HERO_STATE_LABEL: Record<string, string> = {
  idle: "No acampamento",
  marketgo: "Indo ao mercado",
  marketback: "Voltando do mercado",
  traveling: "A caminho",
  hunting: "Caçando em campo",
  returning: "Voltando",
  indungeon: "Na masmorra agora",
};
export const NAME_A = [
  "Ka",
  "Bru",
  "Tha",
  "Ro",
  "Eli",
  "Mar",
  "Va",
  "Dro",
  "Syl",
  "Gor",
  "Ila",
  "Ren",
  "Ael",
  "Tor",
  "Nyx",
  "Lu",
  "Fen",
  "Ori",
  "Zar",
  "Kae",
  "Bel",
  "Cor",
  "Isa",
  "Hal",
];
export const NAME_B = [
  "ran",
  "dor",
  "wen",
  "gar",
  "mir",
  "vok",
  "lis",
  "thar",
  "ryn",
  "bek",
  "dric",
  "nara",
  "los",
  "mund",
  "vel",
  "gus",
  "dan",
  "lo",
];
export const NAME_C = ["", "", "", "a", "o", "us", "ion", "ek"];
