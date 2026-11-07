/* ==== Fase 4 ====
   runas: tipos, elementos, substratos, líquidos, tamanho do tapete no mapa, nomes dos bichos rúnicos e as etapas,
   encaixes e umidade da absorção de runas. Saíram de v4.4_runas */

export const RUNAS = {
  ativo: true, // chave geral (o enredo pode desligar/ligar)
  mapa: true, // aparecem no mapa do mundo
  dungeon: true, // aparecem na masmorra
  inicioDia: 1, // primeiro dia do mundo em que podem surgir no mapa
  maxMapa: 5, // quantas ao mesmo tempo na região simulada
  porDungeon: [1, 2], // quantas por expedição
};
interface ElementoRuna {
  n: string;
  t: string;
  c: string;
  e: string;
  w: number;
}
export const RUNE_EL: Record<string, ElementoRuna> = {
  nularis: { n: "Nularis", t: "natureza Nularis (muda a realidade)", c: "#f4f1ea", e: "⚪", w: 30 },
  fogo: { n: "Fogo", t: "afinidade de Fogo", c: "#ff8a2a", e: "🔥", w: 14 },
  energia: { n: "Energia", t: "afinidade de Energia", c: "#ffe14a", e: "⚡", w: 14 },
  agua: { n: "Água", t: "afinidade de Água", c: "#3f9dff", e: "💧", w: 14 },
  ar: { n: "Ar", t: "afinidade de Ar", c: "#7fe0c8", e: "🌪️", w: 14 },
  terra: { n: "Terra", t: "afinidade de Terra", c: "#c08a4a", e: "🪨", w: 14 },
};
export const RUNE_KEYS = Object.keys(RUNE_EL);
export const RUNE_SUBS: Record<string, { q: number; n: string }> = {
  pedra: { q: 1, n: "Pedra" },
  ferro: { q: 2, n: "Ferro" },
  prata: { q: 2.5, n: "Prata" },
  lingote: { q: 2.2, n: "Lingote" },
  quartzo: { q: 3, n: "Quartzo" },
  ametista: { q: 3.2, n: "Ametista" },
  runa_bruta: { q: 3.2, n: "Ametista" },
  gema: { q: 4, n: "Gema" },
};
export const RUNE_LIQ = [
  "tudo o que o portador come passa a ter gosto de peixe.",
  "a água do cantil fica levemente doce.",
  "a sombra de quem segura anda meio passo atrasada.",
  "o cabelo do portador arrepia quando alguém mente perto dele.",
  "esquenta os pés — e só os pés.",
  "galos cantam sempre que o portador espirra.",
  "flores murchas se viram na direção do portador.",
  "moscas fogem do portador, mas mariposas o adoram.",
  "a comida do portador nunca esfria antes da metade do prato.",
  "botas ficam silenciosas na grama e barulhentas na pedra.",
];
export const RUNE_MAP_S = 18; // tamanho do tapete no mapa (unidades do mundo)
export const RUNIC_NAME: Record<string, string> = { rabbit: "Lebre Rúnica", deer: "Cervo Rúnico", wolf: "Lobo Rúnico" };

export const RA_STEPS = [
  ["heat", "Aquecer e esticar a Folhama"],
  ["l1", "Primeira camada"],
  ["sketch", "Molde de vista (opcional)"],
  ["subs", "Dispor os substratos"],
  ["seal", "Selar com a segunda camada"],
  ["trace", "Traçar com a agulha"],
  ["fix", "Aguardar a energia fixar"],
  ["result", "Separar e testar"],
];
export const RA_SLOTS = [
  [-0.62, 0.6],
  [0.6, -0.58],
  [0.58, 0.62],
];
export const RA_WET = { lo: 0.18, okLo: 0.35, okHi: 0.75, hi: 0.88, use: 0.9 };
