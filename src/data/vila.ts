/* ==== v8.0 — a vila em janela (ROADMAP Etapa 2, decisão do mantenedor 2026-10-23: janela com abas agora, cena 3D
   depois): Taverna, Quadro de missões, Doca e Igreja ao lado do Empório (map/vila.ts). ==== */

/** dormir: ouro para dormir na taverna até `acorda` h · conserto do bote: `galhos` e `ouro`, pronto em `dias` dias. */
export const VILA = {
  dormir: 6,
  acorda: 6,
  conserto: { galhos: 8, ouro: 20, dias: 2 },
};

/** Pedidos do quadro de missões: entregar `n` de `item` (chave do item) por `ouro`. Três por dia, sorteados pelo dia. */
export const QUADRO: { item: string; n: number; ouro: number; txt: string }[] = [
  { item: "pele", n: 2, ouro: 22, txt: "O curtidor precisa de peles" },
  { item: "carne", n: 3, ouro: 14, txt: "A taverna quer carne fresca" },
  { item: "galho", n: 6, ouro: 9, txt: "Lenha para o forno da padaria" },
  { item: "pena", n: 4, ouro: 10, txt: "O flecheiro pede penas" },
  { item: "erva", n: 3, ouro: 12, txt: "A curandeira quer ervas" },
  { item: "pedra", n: 5, ouro: 8, txt: "Pedras para o muro da doca" },
];

/* v8.0 — a vila andável (map/vila_cena.ts; mantenedor, 2026-10-24: "clico nela e já entro em um mapa de cidade, não
   as janelinhas"). Medidas em casas (dungeon.tile); x para a direita, z para baixo (z pequeno = fundo da tela). A
   rua corta de oeste (a entrada, o círculo verde) a leste; os prédios ficam do lado de cima da rua, de frente para
   ela; a doca, embaixo à direita, na água. */
/** Um prédio: centro (x, z), largura (w, em x), fundo (d, em z), altura da parede (h) e do telhado (th), cores. */
export interface PredioVila {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  th: number;
  parede: string;
  telhado: string;
}
/** Um lugar onde o E abre a janela: a aba de map/vila.ts, o ponto da porta (x, z), o texto do painel de ações, o
    morador parado ao lado da porta (dx, dz a partir da porta; tom = o tint do glPush sobre o modelo do Caçador). */
export interface LugarVila {
  id: string;
  aba: string;
  x: number;
  z: number;
  texto: string;
  detalhe: string;
  placa: string;
  morador?: { dx: number; dz: number; tom: number[] };
}
export const VILA_CENA = {
  cols: 28,
  rows: 16,
  raioPorta: 1.25, // casas: perto assim da porta, o E abre o lugar
  rua: { z: 8, meia: 0.85 },
  praca: { x: 14, z: 8.4, r: 2.2 },
  poco: { x: 14, z: 8.4, r: 0.55 },
  /** a água (embaixo à direita) e o píer que entra nela */
  agua: { x0: 19.5, z0: 11.6 },
  pier: { x0: 23.3, x1: 24.7, z1: 15.2 },
  predios: {
    emporio: { x: 6.5, z: 3.7, w: 4.4, d: 3.4, h: 1.5, th: 0.85, parede: "#d9c7a0", telhado: "#8a4a2e" },
    taverna: { x: 13, z: 3.4, w: 5.4, d: 3.8, h: 2.1, th: 0.75, parede: "#cdb48a", telhado: "#5e4a3a" },
    igreja: { x: 21.6, z: 3.2, w: 4.0, d: 4.2, h: 2.0, th: 1.0, parede: "#e6e0d2", telhado: "#4a5868" },
    casa1: { x: 2.4, z: 3.9, w: 2.6, d: 2.6, h: 1.2, th: 0.9, parede: "#d6c29a", telhado: "#9a5a36" },
    casa2: { x: 17.4, z: 2.6, w: 2.4, d: 2.4, h: 1.2, th: 0.9, parede: "#cbb48c", telhado: "#7a4630" },
    casa3: { x: 26.2, z: 4.2, w: 2.4, d: 2.8, h: 1.1, th: 0.9, parede: "#d9c7a0", telhado: "#8a4a2e" },
    casa4: { x: 4.2, z: 12.6, w: 2.8, d: 2.4, h: 1.1, th: 0.9, parede: "#cdb48a", telhado: "#6e4a32" },
  } as Record<string, PredioVila>,
  torre: { x: 24.2, z: 2.6, w: 1.4, h: 4.2 }, // a torre da igreja, do lado direito
  cavaleiros: [
    { x: 20.5, z: 5.75 },
    { x: 22.7, z: 5.75 },
  ], // de armadura escura, um de cada lado da porta da igreja
  tomCavaleiro: [0.1, 0.1, 0.14, 0.72],
  lanternas: [
    { x: 4.5, z: 9.2 },
    { x: 10.5, z: 9.2 },
    { x: 18.5, z: 9.2 },
  ],
  quadro: { x: 16.8, z: 10.4 },
  banca: { x: 9.6, z: 11.2 }, // a barraca de feira (enfeite) do lado de baixo da rua
  lugares: [
    {
      id: "emporio",
      aba: "emporio",
      x: 6.5,
      z: 6.0,
      texto: "Empório",
      detalhe: "comprar e vender",
      placa: "🏪 Empório",
      morador: { dx: 1.3, dz: -0.15, tom: [0.25, 0.45, 0.3, 0.35] },
    },
    {
      id: "taverna",
      aba: "taverna",
      x: 13,
      z: 5.9,
      texto: "Taverna",
      detalhe: "conversar e dormir",
      placa: "🍺 Taverna",
      morador: { dx: -1.5, dz: -0.1, tom: [0.55, 0.3, 0.15, 0.3] },
    },
    {
      id: "igreja",
      aba: "igreja",
      x: 21.6,
      z: 5.95,
      texto: "Igreja",
      detalhe: "o Imortal",
      placa: "⛪ Igreja", // o Imortal fica lá dentro, ao lado do altar; na porta, os dois cavaleiros (cavaleiros)
    },
    {
      id: "quadro",
      aba: "quadro",
      x: 16.8,
      z: 11.1,
      texto: "Quadro de pedidos",
      detalhe: "entregar por ouro",
      placa: "📜 Quadro",
    },
    {
      id: "doca",
      aba: "doca",
      x: 24,
      z: 11.3,
      texto: "Doca",
      detalhe: "o bote",
      placa: "⛵ Doca",
      morador: { dx: -1.2, dz: 0.2, tom: [0.2, 0.3, 0.55, 0.35] },
    },
  ] as LugarVila[],
};

/** O Imortal lê a afinidade (h.aff, data/nascimento.ts AFFINITIES). */
export const IMORTAL_AFINIDADE: Record<string, string> = {
  fogo: "Fogo. Queima por dentro e não se apaga com facilidade. Cuidado com a pressa.",
  raio: "Raio. Rápida, inquieta. A energia corre antes de você decidir.",
  agua: "Água. Paciente, contorna o que não pode quebrar.",
  ar: "Ar. Leve, difícil de prender. Vê de cima o que os outros não veem.",
  terra: "Terra. Firme. Demora a se mover, mas ninguém a derruba.",
  nularis: "Nularis… rara. Um vazio que apaga as outras. Faz séculos que não vejo uma.",
};
