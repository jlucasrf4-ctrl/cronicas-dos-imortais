/* ==== Fase 4 ====
   economia: preços, cidades do mapa, estradas, o que vai para o acampamento, níveis de mochila e baú. Saíram de
   base/05 (v3.0) */
import { HERO_SPEED } from "./herois.ts";
import type { Item } from "../core/tipos.ts";

export const HORSE_PRICE = 150,
  WAGON_PRICE = 250,
  GOLD_PER_VALUE = 2,
  WALK_SPEED = HERO_SPEED * 0.6;
/** Cidade do mapa. `pay` é o multiplicador de preço por item; a carga acrescenta itens (pedra_rara…). */
export interface Cidade {
  id: string;
  name: string;
  region: string;
  pop: number;
  level: number;
  x: number;
  y: number;
  res: string;
  desc: string;
  pay: Record<string, number>;
}
export const CITIES: Cidade[] = [
  {
    id: "rio",
    name: "Vila do Rio",
    region: "Floresta Central",
    pop: 1800,
    level: 2,
    x: 433,
    y: 337,
    res: "Madeira, peixe de rio, ervas",
    desc: "Vila ribeirinha cercada de mata fechada. Ponto de passagem entre as trilhas do norte e do sul.",
    pay: { carne: 1.5, erva: 1.6, pele: 1.3 },
  },
  {
    id: "baia",
    name: "Baía Velha",
    region: "Costa Sudoeste",
    pop: 3200,
    level: 3,
    x: 392,
    y: 590,
    res: "Sal, couro, pescado",
    desc: "Porto de pesca antigo, de ruas estreitas e armazéns cheios de couro e sal.",
    pay: { pele: 1.4, presa: 1.2, erva: 1.2 },
  },
  {
    id: "campina",
    name: "Campina",
    region: "Planícies do Sul",
    pop: 2400,
    level: 2,
    x: 640,
    y: 520,
    res: "Grãos, cavalos, ervas",
    desc: "Povoado de fazendeiros e criadores de cavalos, com feira movimentada a cada semana.",
    pay: { erva: 1.4, carne: 1.2, lingote: 1.2 },
  },
  {
    id: "marcos",
    name: "Marcos do Leste",
    region: "Planalto Leste",
    pop: 1500,
    level: 2,
    x: 745,
    y: 392,
    res: "Presas, peles, ferro",
    desc: "Entreposto de caçadores e mineiros, ao pé das montanhas. Paga bem por troféus de lobo.",
    pay: { presa: 1.6, pele: 1.5, escudo: 1.2 },
  },
  {
    id: "pedravelha",
    name: "Fortaleza Pedravelha",
    region: "Serras do Norte",
    pop: 4100,
    level: 4,
    x: 242,
    y: 60,
    res: "Ferro, pedra, armas velhas",
    desc: "Fortaleza de pedra cinzenta no alto das serras. Guarda a passagem do norte e paga bem por metal e escudos.",
    pay: { lingote: 1.5, escudo: 1.5, presa: 1.15 },
  },
  {
    id: "enseada",
    name: "Enseada do Norte",
    region: "Baía Norte",
    pop: 1300,
    level: 2,
    x: 433,
    y: 117,
    res: "Peixe, sal, cordas",
    desc: "Vila de pescadores numa enseada abrigada. Barcos pequenos, redes por toda parte e cheiro de sal.",
    pay: { peixe: 1.6, pele: 1.2, erva: 1.1 },
  },
  {
    id: "salgueiro",
    name: "Vau do Salgueiro",
    region: "Margens do Rio",
    pop: 600,
    level: 1,
    x: 428,
    y: 457,
    res: "Junco, ervas, mel",
    desc: "Povoado pequeno no ponto raso do rio, onde as carroças atravessam. Curandeiras compram ervas.",
    pay: { erva: 1.5, carne: 1.25 },
  },
  {
    id: "pedrabranca",
    name: "Pedra Branca",
    region: "Pedreiras do Centro-Sul",
    pop: 1900,
    level: 2,
    x: 501,
    y: 502,
    res: "Mármore, cal, gemas brutas",
    desc: "Cidade de pedreiros erguida ao lado de uma pedreira de mármore claro. Ourives e lapidários de olho em gemas.",
    pay: { gema: 1.45, lingote: 1.3, pedra: 1.4 },
  },
  {
    id: "lagoa",
    name: "Lagoa Funda",
    region: "Costa Sudoeste",
    pop: 800,
    level: 1,
    x: 444,
    y: 645,
    res: "Peixe de lagoa, couro",
    desc: "Vilarejo à beira de uma lagoa escura e funda. Dizem que algo grande mora no fundo.",
    pay: { peixe: 1.4, pele: 1.3 },
  },
  {
    id: "porto",
    name: "Porto Sul",
    region: "Costa Sul",
    pop: 9500,
    level: 5,
    x: 772,
    y: 640,
    res: "Metais, gemas, especiarias, relíquias",
    desc: "A maior cidade do mapa: fortaleza com porto cheio de navios mercantes. Compra de tudo que for raro.",
    pay: { lingote: 1.6, gema: 1.7, reliquia: 1.6, escudo: 1.4 },
  },
];
export const ROAD_MULT = 2.2; // pelas estradas a viagem rende mais que andando no mato
export const CAMP_SEND: Record<string, (it: Item) => { wood?: number; meat?: number }> = {
  galho: (it) => ({ wood: (it.n || 1) * 2 }),
  carne: (it) => ({ meat: (it.n || 1) * (1 + (it.tier | 0)) }),
  peixe: (it) => ({ meat: (it.n || 1) * (1 + (it.tier | 0)) }),
};
export const BAG_LV: [nome: string, cols: number, rows: number, preco: number][] = [
  ["Mochila de pano", 8, 5, 0],
  ["Mochila de couro", 9, 6, 90],
  ["Mochila de viagem", 10, 7, 260],
  ["Mochila de aventureiro", 11, 8, 600],
];
/* v7.7 — baú infinito (items/bau_infinito.ts): por dentro a grade sempre tem `folga` fileiras livres no fim (cabe
   qualquer item, até a lança SS deitada ou em pé), nunca menos que `linhasMin`; na tela, quadradinhos de `peca` casinhas
   de lado. As melhorias de tamanho antigas (CHEST_LV no mercado, Caixa e Baú reforçado na carpintaria) saíram. */
export const BAU = { folga: 18, linhasMin: 18, peca: 3 };
