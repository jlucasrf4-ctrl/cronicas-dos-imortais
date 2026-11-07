/* ==== v8.1 — craft rápido (field/craft_rapido.ts): segurar C faz a receita escolhida sem abrir janela ====
   Mantenedor 2026-10-31: anda enquanto faz (mais devagar), o arco em meio círculo enche perto da heroína, levar dano
   cancela. Tocar C abre o craft como antes; lá (ou no ícone do C no HUD) escolhe-se a receita do segurar. */
export const CRAFT_RAPIDO = {
  segurar: 0.22, // s com o C apertado até virar craft rápido (antes disso, soltar abre a janela)
  andar: 0.6, // velocidade de andar enquanto faz
  esvazia: 3, // o arco esvazia esse tanto mais rápido do que enche, ao soltar
};
/** Uma receita do craft rápido. custo/opcional: chaves de recurso (stone, feather: preparo.resCount) ou de item da
 *  mochila (galho, cabo, pele). Faz flechas (aljava: [sem, com] o opcional) ou um item (vai para a mochila). */
export interface ReceitaRapida {
  id: string;
  nome: string;
  ico: string;
  tempo: number; // s para um lote, parada
  custo: Record<string, number>;
  opcional?: Record<string, number>;
  flechas?: [number, number];
  item?: string;
  etapas: [string, string, string];
  pericia: [string, number]; // gainSkill a cada lote
}
export const RECEITAS_RAPIDAS: ReceitaRapida[] = [
  {
    id: "flechas",
    nome: "Flechas",
    ico: "🏹",
    tempo: 2.4,
    custo: { galho: 1, stone: 1 },
    opcional: { feather: 1 },
    flechas: [2, 3],
    etapas: ["Lascar a pedra", "Encaixar na haste", "Amarrar"],
    pericia: ["arco", 2],
  },
  {
    id: "cabo",
    nome: "Cabo de madeira",
    ico: "🥢",
    tempo: 2,
    custo: { galho: 1 },
    item: "cabo",
    etapas: ["Descascar", "Esculpir", "Lixar"],
    pericia: ["artesao", 2],
  },
  {
    id: "faca",
    nome: "Faca simples",
    ico: "🔪",
    tempo: 3,
    custo: { cabo: 1, stone: 2 },
    item: "eq_faca_simples",
    etapas: ["Lascar a lâmina", "Encaixar no cabo", "Amarrar"],
    pericia: ["artesao", 3],
  },
  {
    id: "couro",
    nome: "Curtir couro",
    ico: "🟤",
    tempo: 3.2,
    custo: { pele: 1, galho: 1 },
    item: "couro",
    etapas: ["Raspar a pele", "Ferver a casca", "Curtir"],
    pericia: ["artesao", 2],
  },
];
