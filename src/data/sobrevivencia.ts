/* ==== Fase 4 ====
   sobrevivência e acampamento: fome/frio/ferimento (SURV), peso dos itens (KG), calor das roupas (WARM), comida,
   cozimento, custo de organizar, montaria (tamanduá: MOUNT, TCOATS) e moldes de corte (PATTERNS). Saíram de v5.9,
   v5.9.01, v5.9.02 e v5.9.04 */

export const SURV = {
  woundK: 0.65, // fração do dano que vira ferimento (não volta sozinha em combate)
  hungerDg: 1 / 15, // fome por segundo na masmorra (+4 por minuto)
  wolfDmg: 1.4, // multiplicador do dano dos lobos
  capBase: 15,
  capFor: 1.5, // capacidade de carga (kg) = 15 + 1,5 × Força
};
export const KG: Record<string, number> = {
  carne: 1.2,
  carne_assada: 0.8,
  erva: 0.1,
  presa: 0.2,
  pele: 1.5,
  lingote: 2,
  gema: 0.1,
  escudo: 3,
  reliquia: 2.5,
  peixe: 0.8,
  pedra: 0.6,
  pena: 0.02,
  penaag: 0.05,
  ferro: 1.2,
  prata: 1.2,
  quartzo: 0.3,
  ametista: 0.3,
  runa_bruta: 0.8,
  galho: 0.5,
  folhama: 0.1,
  flecha: 0.05,
  eq_espada: 2.5,
  eq_espada_longa: 3.5,
  eq_clava: 3,
  eq_machado: 3,
  eq_lanca: 2.5,
  eq_arco: 1.2,
  eq_arco_longo: 1.6,
  eq_escudo: 4,
  eq_escudo_ref: 5.5,
  eq_elmo: 2,
  eq_elmo_prata: 2.5,
  eq_armadura: 5,
  eq_cota: 9,
  eq_calca: 1.5,
  eq_botas: 1.5,
  eq_botas_ref: 3,
};
export const WARM: Record<string, number> = {
  eq_armadura: 3,
  eq_cota: 1.5,
  eq_elmo: 1,
  eq_elmo_prata: 1,
  eq_calca: 1.5,
  eq_botas: 1,
  eq_botas_ref: 1.5,
};
export const FOOD: Record<string, { hunger: number; wound: number; hp: number; raw: boolean }> = {
  carne_assada: { hunger: 45, wound: 12, hp: 10, raw: false },
  carne: { hunger: 18, wound: 0, hp: 0, raw: true },
  peixe: { hunger: 15, wound: 0, hp: 0, raw: true },
};
/* v7.7 — quanto a carne sustenta e cura depende do bicho e da qualidade da carne crua (valorComida em
   survival/sobrevivencia.ts multiplica FOOD por estes fatores e pelo ponto do cozimento, 1 + 15% por nível) */
export const CARNE_BICHO: Record<string, number> = { coelho: 0.7, peixe: 0.8, lobo: 0.9, cervo: 1, javali: 1.15 };
export const CARNE_CRUA_Q = [1, 1.25, 1.5]; // qualidade da carne crua que foi assada: A, A+, SS (Item.qc)
export const COOK = { ok: [0.72, 0.95], burn: 1.05, rate: 0.16 };
export const PATTERNS: Record<string, number[][]> = {
  eq_armadura: [
    [0.3, 0.1],
    [0.42, 0.1],
    [0.46, 0.2],
    [0.54, 0.2],
    [0.58, 0.1],
    [0.7, 0.1],
    [0.72, 0.28],
    [0.82, 0.34],
    [0.79, 0.9],
    [0.21, 0.9],
    [0.18, 0.34],
    [0.28, 0.28],
    [0.3, 0.1],
  ],
  eq_botas: [
    [0.36, 0.08],
    [0.56, 0.08],
    [0.57, 0.52],
    [0.78, 0.64],
    [0.84, 0.8],
    [0.81, 0.9],
    [0.3, 0.9],
    [0.33, 0.52],
    [0.36, 0.08],
  ],
  eq_botas_ref: [
    [0.36, 0.08],
    [0.56, 0.08],
    [0.57, 0.52],
    [0.78, 0.64],
    [0.84, 0.8],
    [0.81, 0.9],
    [0.3, 0.9],
    [0.33, 0.52],
    [0.36, 0.08],
  ],
  eq_calca: [
    [0.3, 0.08],
    [0.7, 0.08],
    [0.75, 0.9],
    [0.56, 0.9],
    [0.5, 0.4],
    [0.44, 0.9],
    [0.25, 0.9],
    [0.3, 0.08],
  ],
};
export const ORG_COST = 10;
export const MOUNT = {
  lvXp: [0, 6, 16, 32],
  spd: [1.55, 1.7, 1.85, 2.0],
  bag: [
    [18, 12],
    [21, 12],
    [24, 15],
    [27, 15],
  ],
  names: ["Bandeira", "Cupim", "Pé-de-Pano", "Trovão", "Areia", "Jurema"],
};
interface PelagemTamandua {
  n: string;
  w: number;
  r: string;
  fur: string;
  dark: string;
  light: string;
  tail: string;
  snout: string;
  spots?: string;
}
export const TCOATS: Record<string, PelagemTamandua> = {
  selvagem: {
    n: "Selvagem",
    w: 30,
    r: "comum",
    fur: "#8c8274",
    dark: "#221e1a",
    light: "#ece4d0",
    tail: "#4e463e",
    snout: "#5e564d",
  },
  cinza: {
    n: "Cinza",
    w: 14,
    r: "comum",
    fur: "#98989a",
    dark: "#262628",
    light: "#ececea",
    tail: "#6e6e70",
    snout: "#5e5e60",
  },
  branco: {
    n: "Branco",
    w: 12,
    r: "comum",
    fur: "#e0d9c6",
    dark: "#3a352f",
    light: "#f6f1e4",
    tail: "#cfc6b2",
    snout: "#8a8178",
  },
  marrom: {
    n: "Marrom",
    w: 12,
    r: "comum",
    fur: "#94502e",
    dark: "#2a1a12",
    light: "#edd3b2",
    tail: "#6a3a22",
    snout: "#7a5848",
  },
  preto: {
    n: "Preto",
    w: 10,
    r: "incomum",
    fur: "#33323c",
    dark: "#141318",
    light: "#7a7888",
    tail: "#24232a",
    snout: "#4a4650",
  },
  pintado: {
    n: "Pintado",
    w: 8,
    r: "incomum",
    fur: "#ece4d4",
    dark: "#7a4a2a",
    light: "#f8f2e6",
    tail: "#8a5a34",
    snout: "#8a7a70",
    spots: "#7a4a26",
  },
  dourado: {
    n: "Dourado",
    w: 7,
    r: "rara",
    fur: "#d1a052",
    dark: "#2a2018",
    light: "#f4e4b6",
    tail: "#a87a36",
    snout: "#8a7060",
  },
  albino: {
    n: "Albino",
    w: 3,
    r: "raríssima",
    fur: "#f6f2ec",
    dark: "#e8d8d2",
    light: "#ffffff",
    tail: "#eee8de",
    snout: "#eab8b4",
  },
};
