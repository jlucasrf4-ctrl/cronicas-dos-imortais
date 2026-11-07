import type { Animal, Genes } from "../core/tipos.ts";
/* ==== Fase 4 — genética dos bichos (genes herdáveis) e pelagens (COATS). Saiu de base/00_nucleo.js ==== */

/* ---------------------------------------------------------------------
   1b. GENÉTICA — características herdáveis (estilo Axie Infinity, simplificado)
   Cada bicho tem 4 genes: porte e velocidade e força são MECÂNICOS (mudam
   números reais do corpo); marca é só estética (palavra legal, sem efeito).
   Na reprodução, cada gene é herdado de um dos dois pais (50/50), com uma
   pequena chance de mutação (sorteia um gene novo do nada).
--------------------------------------------------------------------- */
export const GENE_POOLS: Record<string, { name: string; sizeMult?: number; weightMult?: number; mult?: number }[]> = {
  size: [
    { name: "Diminuto", sizeMult: 0.72, weightMult: 0.68 },
    { name: "Pequeno", sizeMult: 0.86, weightMult: 0.84 },
    { name: "Padrão", sizeMult: 1.0, weightMult: 1.0 },
    { name: "Avantajado", sizeMult: 1.14, weightMult: 1.18 },
    { name: "Colossal", sizeMult: 1.3, weightMult: 1.42 },
  ],
  speed: [
    { name: "Vagaroso", mult: 0.8 },
    { name: "Constante", mult: 0.92 },
    { name: "Ágil", mult: 1.0 },
    { name: "Veloz", mult: 1.14 },
    { name: "Relâmpago", mult: 1.28 },
  ],
  strength: [
    { name: "Frágil", mult: 0.78 },
    { name: "Comum", mult: 0.94 },
    { name: "Resistente", mult: 1.0 },
    { name: "Robusto", mult: 1.16 },
    { name: "Titânico", mult: 1.32 },
  ],
  flavor: [
    "Focinho Cicatrizado",
    "Orelhas Longas",
    "Passo Silencioso",
    "Cauda Curta",
    "Olhar Penetrante",
    "Crina Arrepiada",
    "Bigodes Longos",
    "Orelhas Rasgadas",
    "Porte Altivo",
    "Pelo Espesso",
    "Olhos Atentos",
    "Cauda Longa",
  ].map((n) => ({ name: n })),
};
const GENE_SLOTS = ["size", "speed", "strength", "flavor"];
const GENE_MUTATION_CHANCE = 0.08;

function rollGene(slot: string) {
  const pool = GENE_POOLS[slot];
  return pool[Math.floor(Math.random() * pool.length)];
}
export function randomGenes() {
  const g = {} as Genes;
  for (const slot of GENE_SLOTS) g[slot] = rollGene(slot);
  return g;
}
export function inheritGenes(parentA: Animal, parentB: Animal) {
  const g = {} as Genes;
  for (const slot of GENE_SLOTS) {
    if (Math.random() < GENE_MUTATION_CHANCE) g[slot] = rollGene(slot);
    else g[slot] = (Math.random() < 0.5 ? parentA.genes : parentB.genes)[slot];
  }
  // pelagem herdada de um dos pais (com pequena chance de mutação de cor)
  g.coat =
    Math.random() < GENE_MUTATION_CHANCE
      ? rollCoat(parentA.species)
      : (Math.random() < 0.5 ? parentA : parentB).genes.coat;
  return g;
}
export function pctLabel(mult: number) {
  const pct = Math.round((mult - 1) * 100);
  if (pct === 0) return "padrão";
  return (pct > 0 ? "+" : "") + pct + "%";
}

/* ---------------------------------------------------------------------
   1b'. CLASSIFICAÇÃO POR APARÊNCIA — cada coluna do sprite sheet é uma pelagem.
   [adjetivo, descrição visual, peso de raridade]  (peso <= 1.5 = rara)
--------------------------------------------------------------------- */
interface Pelagens {
  label: string;
  v: [adjetivo: string, descricao: string, peso: number][];
}
export const COATS: Record<string, Pelagens> = {
  wolf: {
    label: "Lobo",
    v: [
      ["Cinzento", "pelagem cinza-chumbo, a clássica dos lobos da floresta", 4],
      ["Branco", "pelagem de neve, quase sem marcas", 1],
      ["Negro", "pelagem escura como breu, some na sombra", 1.5],
      ["Pardo", "pelo pardo-acinzentado e face mais clara", 3],
      ["Ruivo", "pelagem cor de ferrugem, de tom avermelhado", 1.5],
      ["Prateado", "cinza bem claro, com brilho prateado", 2],
    ],
  },
  rabbit: {
    label: "Coelho",
    v: [
      ["Pardo", "pelagem marrom-acinzentada comum", 4],
      ["Branco", "pelagem branca e orelhas rosadas", 1.5],
      ["Negro", "pelagem preta e orelhas escuras", 1.5],
      ["Ruivo", "pelagem alaranjada, bem vistosa", 2],
      ["Malhado", "manchas marrons sobre fundo branco", 1],
      ["Cinza", "pelagem cinza uniforme", 3],
    ],
  },
  deer: {
    label: "Cervo",
    v: [
      ["Castanho", "pelagem marrom-dourada com galhada ramificada", 4],
      ["Branco", "pelagem quase branca, raríssima na mata", 1],
      ["Escuro", "pelagem marrom-escura, quase carvão", 2],
      ["Ruivo", "pelagem avermelhada, cor de cobre", 3],
      ["Pintado", "dorso salpicado de manchas brancas", 1.5],
      ["Cinzento", "pelagem cinza-ardósia", 2],
    ],
  },
  fox: {
    label: "Raposa",
    v: [
      ["Vermelha", "pelagem laranja-avermelhada e ponta da cauda branca", 4],
      ["Rubra", "vermelho intenso, mais vivo que o comum", 1.5],
      ["Branca", "pelagem toda branca, camufla na neve e na geada", 1],
      ["Negra", "pelagem escura com a ponta da cauda branca", 1],
      ["Parda", "pelagem marrom-acinzentada com cauda clara", 2.5],
      ["Dourada", "pelagem cor de mel e cauda volumosa", 2],
      ["Malhada", "manchas marrons sobre o branco", 1],
      ["Grafite", "cinza-chumbo bem escuro, de aspecto prateado", 1.5],
    ],
  },
  duck: {
    label: "Pato",
    v: [
      ["Real", "cabeça verde-iridescente e bico amarelo", 4],
      ["Pardo", "plumagem marrom salpicada, discreta", 3],
      ["Branco", "plumagem branca, bico alaranjado", 1],
      ["Negro", "plumagem escura de reflexo esverdeado", 1],
      ["de Asa Azul", "peito acobreado e faixa azul nas asas", 1.5],
      ["Esmeralda", "cabeça verde-esmeralda e corpo claro", 1.5],
      ["Cinzento", "plumagem cinza uniforme", 2],
      ["Castanho", "plumagem castanha, quase sem brilho", 3],
    ],
  },
  eagle: {
    label: "Águia",
    v: [
      ["de Cabeça Branca", "corpo marrom-escuro, cabeça e cauda brancas", 1.5],
      ["Parda", "plumagem marrom-escura uniforme", 4],
      ["Dourada", "plumagem dourada, de olhar feroz", 2],
      ["Branca", "plumagem toda branca, rara e visível de longe", 1],
      ["Negra", "plumagem preta como a noite", 1],
      ["Ruiva", "plumagem avermelhada, tom de cobre", 2],
      ["Arenosa", "plumagem cor de areia e palha", 2],
      ["Cinzenta", "plumagem cinza-ardósia", 1.5],
    ],
  },
};
export function coatInfo(species: string, idx: number) {
  const c = COATS[species];
  if (!c) return null;
  const n = c.v.length,
    v = c.v[(((idx | 0) % n) + n) % n];
  return { name: c.label + " " + v[0], adj: v[0], desc: v[1], rare: v[2] <= 1.5, idx: (((idx | 0) % n) + n) % n };
}
export function rollCoat(species: string) {
  const c = COATS[species];
  if (!c) return 0;
  const tot = c.v.reduce((s, x) => s + x[2], 0);
  let r = Math.random() * tot;
  for (let i = 0; i < c.v.length; i++) {
    r -= c.v[i][2];
    if (r <= 0) return i;
  }
  return 0;
}
