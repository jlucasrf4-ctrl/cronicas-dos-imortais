/* ==== Fase 4 ====
   equipamento e forja: espaços do boneco, peças iniciais, minérios, qualidades, durabilidade e receitas. Saíram de
   base/15 (v4.3) e v4.5_forja */

export const EQ_SLOTS = [
  { id: "cabeca", label: "Elmo", icon: "⛑️" },
  { id: "peito", label: "Armadura", icon: "🦺" },
  { id: "pernas", label: "Calça", icon: "👖" },
  { id: "pes", label: "Botas", icon: "🥾" },
  { id: "maoD", label: "Mão D.", icon: "🗡️" },
  { id: "maoE", label: "Mão E.", icon: "🛡️" },
  { id: "costas", label: "Arco", icon: "🏹" },
];
export const EQ_DEFAULT: Record<string, string> = {
  cabeca: "eq_elmo",
  peito: "eq_armadura",
  pernas: "eq_calca",
  pes: "eq_botas",
  maoD: "eq_espada",
  maoE: "eq_escudo",
  costas: "eq_arco",
};
export const ORE_TABLE: [string, number][] = [
  ["runa_bruta", 0.025],
  ["quartzo", 0.05],
  ["prata", 0.07],
  ["ferro", 0.18],
];
export const QUAL = [
  { n: "Ruim", stat: 0.9, dur: 0.6, col: "#b59a7a" },
  { n: "Comum", stat: 1, dur: 1, col: "#e9dcc0" },
  { n: "Boa", stat: 1.07, dur: 1.3, col: "#9fe3ff" },
  { n: "Excelente", stat: 1.14, dur: 1.6, col: "#ffd24a" },
];
interface EquipBase {
  dur: number;
  mat: Record<string, number>; // material → quantidade
  kind: string;
  forja?: false; // v7.7: não se forja (presente do tutorial, feito na carpintaria): fora da lista e dos projetos da Forja
}
export const EQ_BASE: Record<string, EquipBase> = {
  // durabilidade base · receita · tipo de trabalho
  eq_espada: { dur: 110, mat: { ferro: 3, galho: 1 }, kind: "metal" },
  eq_elmo: { dur: 70, mat: { ferro: 3 }, kind: "metal" },
  eq_armadura: { dur: 90, mat: { pele: 3 }, kind: "couro" },
  eq_calca: { dur: 70, mat: { folhama: 3 }, kind: "couro" },
  eq_botas: { dur: 70, mat: { pele: 2 }, kind: "couro" },
  eq_escudo: { dur: 80, mat: { galho: 4, ferro: 1 }, kind: "madeira" },
  eq_arco: { dur: 160, mat: { galho: 3, pele: 1 }, kind: "madeira" },
  eq_espada_longa: { dur: 150, mat: { ferro: 4, prata: 1, galho: 1 }, kind: "metal" },
  eq_cota: { dur: 140, mat: { ferro: 5, pele: 1 }, kind: "metal" },
  eq_elmo_prata: { dur: 115, mat: { ferro: 2, prata: 2 }, kind: "metal" },
  eq_escudo_ref: { dur: 130, mat: { galho: 3, ferro: 3 }, kind: "metal" },
  eq_arco_longo: { dur: 200, mat: { galho: 4, pele: 2, prata: 1 }, kind: "madeira" },
  eq_botas_ref: { dur: 110, mat: { pele: 2, ferro: 1 }, kind: "couro" },
  // v7.7 — cinto (items/cinto.ts): feito na carpintaria; o conserto na Forja usa estes materiais
  eq_cinto: { dur: 120, mat: { couro: 2, ferro: 1 }, kind: "couro", forja: false },
};
export const MAT_NAME: Record<string, string> = {
  ferro: "⛏️ Ferro",
  prata: "🥈 Prata",
  galho: "🪵 Galho",
  pele: "🟫 Pele",
  folhama: "🍃 Folhama",
  cabo: "🥢 Cabo",
  couro: "🟤 Couro",
  linho: "🧵 Linho",
  pedra: "🪨 Pedra",
};
export const RECIPES_START = ["eq_calca", "eq_botas", "eq_escudo"]; // o que o acampamento já sabe fazer no começo
