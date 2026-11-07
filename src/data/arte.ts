/* ==== Fase 4 ====
   arte nova: gemas e pedras (nomes, estágios, variações), carnes e formas na mochila, fichas dos animais (arte,
   proporção, pelagem, textos). Saíram de v5.9.07 e v5.9.11 */

export const GEMS: Record<string, { n: string; f: number; w: number; val: number; col: string }> = {
  rubi: { n: "Rubi", f: 0, w: 3, val: 1.25, col: "#d8333a" },
  safira: { n: "Safira", f: 1, w: 3, val: 1.25, col: "#3a6ee8" },
  esmeralda: { n: "Esmeralda", f: 1, w: 2.5, val: 1.3, col: "#2fb85a" },
  ametista: { n: "Ametista", f: 1, w: 3, val: 0.9, col: "#9b5be0" },
  topazio: { n: "Topázio", f: 0, w: 3, val: 1, col: "#f0a020" },
  onix: { n: "Ônix", f: 0, w: 2, val: 1, col: "#6d6a70" },
  diamante: { n: "Diamante", f: 0, w: 1, val: 1.8, col: "#dfeeff" },
};
export const GEM_ST = [
  null,
  ["bruto", "bruta"],
  ["lapidado", "lapidada"],
  ["polido", "polida"],
  ["refinado", "refinada"],
  ["re-lapidado", "re-lapidada"],
];
export const GEM_STN = [null, "Bruta", "Lapidada", "Polida", "Refinada", "Re-lapidada"];
export const GEM_VAR: Record<string, number[]> = {
  onix: [0, 9, 9, 18, 20, 10],
  topazio: [0, 9, 9, 18, 20, 10],
  diamante: [0, 9, 9, 18, 20, 10],
  ametista: [0, 9, 9, 18, 18, 11],
  safira: [0, 10, 10, 19, 21, 12],
  esmeralda: [0, 9, 9, 18, 20, 10],
  rubi: [0, 7, 8, 8, 8, 8],
}; // formas desenhadas por gema e estágio
export const SP_MEAT: Record<string, string> = {
  wolf: "lobo",
  rabbit: "coelho",
  boar: "javali",
  deer: "cervo",
  duck: "pato",
  eagle: "pato",
  fox: "lobo",
  fish: "peixe",
};
export const ST3 = [1, 3, 5]; // qualidade A / A+ / SS → estágio da arte
/* pedras: cada pedra/minério tem um formato; minerando pedra às vezes sai uma Pedra Semipreciosa */
export const STONES: Record<string, { n: string; w: number; v: number }> = {
  jaspe: { n: "Jaspe", w: 4, v: 1 },
  citrino: { n: "Citrino", w: 3, v: 1.3 },
  quartzo_rosa: { n: "Quartzo Rosa", w: 3, v: 1.2 },
  malaquita: { n: "Malaquita", w: 2.5, v: 1.4 },
  agata: { n: "Ágata", w: 3, v: 1.1 },
  serpentina: { n: "Serpentina", w: 3, v: 0.9 },
  lapis: { n: "Lápis-lazúli", w: 1.5, v: 1.7 },
  obsidiana: { n: "Obsidiana", w: 1.5, v: 1.5 },
};
export const AN_ART: Record<string, string> = {
  wolf: "lobo",
  rabbit: "coelho",
  boar: "javali",
  eagle: "aguia",
  fox: "raposa",
  demon: "demonio",
};
export const AN_ASP: Record<string, number> = {
  lobo: 0.83,
  coelho: 0.84,
  demonio: 0.86,
  javali: 0.95,
  aguia: 0.95,
  raposa: 0.84,
};
export const AN_TOK: Record<string, number[][]> = {
  // pelagem do jogo → ficha [macho, fêmea]
  fox: [
    [1, 1],
    [5, 6],
    [2, 2],
    [3, 3],
    [6, 5],
    [6, 5],
    [1, 1],
    [4, 4],
  ],
  eagle: [
    [1, 1],
    [2, 2],
    [2, 3],
    [1, 1],
    [3, 2],
    [4, 4],
    [5, 1],
    [5, 5],
  ],
  boar: [
    [1, 1],
    [5, 2],
    [4, 5],
    [2, 3],
    [3, 4],
  ],
};
export const AN_INFO: Record<string, { d: string; hab: string; diet: string; beh: string; alt: string; comp: string }> =
  {
    wolf: {
      d: "Predador ágil e inteligente, que vive em matilhas. Excelente visão e olfato — um dos animais mais perigosos das florestas.",
      hab: "Florestas e montanhas",
      diet: "Carnívoro",
      beh: "Territorial, vive em matilhas",
      alt: "0,6 – 0,9 m",
      comp: "1,2 – 1,8 m",
    },
    rabbit: {
      d: "Pequeno e ágil, conhecido pela rapidez e atenção ao ambiente. Vive em campos e florestas e é presa comum de vários predadores.",
      hab: "Campos e florestas",
      diet: "Herbívoro",
      beh: "Arisco, vive em tocas",
      alt: "0,2 – 0,3 m",
      comp: "0,3 – 0,5 m",
    },
    boar: {
      d: "Animal robusto e resistente, de grande força e investidas poderosas. Quando ameaçado fica extremamente agressivo e usa as presas.",
      hab: "Florestas e matas",
      diet: "Onívoro",
      beh: "Territorial, agressivo quando ameaçado",
      alt: "0,8 – 1,2 m",
      comp: "1,2 – 2,0 m",
    },
    eagle: {
      d: "Grande ave de rapina, símbolo de força e visão aguçada. Voa em grandes altitudes e avista presas a longa distância.",
      hab: "Montanhas, penhascos e florestas",
      diet: "Carnívoro",
      beh: "Solitário e territorial",
      alt: "0,7 – 1,0 m",
      comp: "1,8 – 2,4 m (envergadura)",
    },
    fox: {
      d: "Inteligente e adaptável. Excelente audição e olfato; move-se em silêncio — uma caçadora astuta e sobrevivente.",
      hab: "Florestas e campos",
      diet: "Carnívoro / Onívoro",
      beh: "Solitária, astuta e oportunista",
      alt: "0,3 – 0,5 m",
      comp: "0,6 – 1,0 m",
    },
    demon: {
      d: "Variante rara e corrompida, marcada por mutações e cristais naturais que armazenam energia. Extremamente agressivo, com força desproporcional ao tamanho.",
      hab: "Florestas sombrias e cavernas",
      diet: "Herbívoro / Oportunista",
      beh: "Agressivo e territorial",
      alt: "0,3 – 0,5 m",
      comp: "0,5 – 0,8 m",
    },
  };
/* carnes menores: tamanho pelo animal e cresce um pouco com a raridade */
export const MEAT_SH: Record<string, string[]> = {
  coelho: ["##", "##"],
  pato: [".#", "##", "##"],
  lobo: [".##", "###", "##."],
  cervo: [".##.", "####", "####"],
  javali: [".##.", "####", "####", ".##."],
  peixe: ["###", ".##"],
};
