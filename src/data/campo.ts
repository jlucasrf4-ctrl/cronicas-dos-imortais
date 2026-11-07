/* ==== Fase 4 ====
   modo campo (expedição): vida do campo e criaturas pequenas, aves, galhos e moitas, o que nasce no chão,
   visibilidade do loot, avisos, flechas, durabilidade, pacotes e quanto da população aparece. Saíram de v6.3 a v7.0 */

/* chão da masmorra: só folhama, pedra e erva (sem itens soltos aleatórios) */
export const CHAO_KINDS = ["folhama", "folhama", "pedra", "pedra", "pedra", "erva", "erva", "erva", "erva"];
/* ícone do item no chão: só aparece de perto */
export const LOOT_VIS = { perto: 1.1, some: 1.6 }; // em tiles: até "perto" aparece inteiro; some depois de "some"
/* menos texto: avisos menores, no máximo 5 ao mesmo tempo, iguais não repetem */
export const TXT = { maxToasts: 5, escala: 0.82 };
export const MOITA = { n: 3, r: 1.15 }; // quantas moitas extras por expedição e raio (tiles)
export const ARROW_HOLD = 1.8; // segundos segurando para fazer uma leva
/* durabilidade: tudo dura 3× mais (itens antigos são ajustados uma vez) */
export const DUR_K = 3;
/* pacotes 9/9: itens pequenos (pena, pedra…) empilham ocupando as casinhas livres do próprio quadrado 3×3 */
export const PACK_KEYS = ["pedra", "pena", "penaag"];
export const POP_K = 0.5; // metade da população máxima de cada espécie
export const VIS_MAPA = { perto: 95, some: 125 }; // px do mapa em volta do personagem: perto = retrato; longe = só um pontinho
export const CAMPO_VIDA = {
  coelhos: [3, 5],
  cervos: [1, 2],
  passaros: 3,
  loboChance: 0.25,
  loboAtaca: 0.8,
  perto: 3.2,
  respawn: 35,
  loboCome: 3, // segundos que o lobo leva para comer cada carne da presa
  loboCura: 0.5, // fração da vida máxima que cada carne devolve ao lobo
};
interface CriaturaCampo {
  prof: string;
  n: string;
  hp: number;
  wander: number;
  flee: number;
  scare: number;
  sz: number;
  meat: number;
  an: string;
  pele: number;
  tiroMax?: number;
  folHitMax?: number;
  ferido?: number;
  corridaFol?: number;
}
export const CRIT_SP: Record<string, CriaturaCampo> = {
  rabbit: {
    prof: "coelho",
    n: "Coelho",
    hp: 6,
    wander: 18,
    flee: 78,
    scare: 3.2,
    sz: 20,
    meat: 1,
    an: "coelho",
    pele: 0,
  },
  deer: {
    prof: "cervo",
    n: "Cervo",
    hp: 14,
    wander: 14,
    flee: 88,
    scare: 4.4,
    sz: 34,
    meat: 2,
    an: "cervo",
    pele: 0.5,
  },
  // v8.0: a raposa do mapa (world.wild) na caçada do campo; caçada pela pele, sem carne
  fox: {
    prof: "raposa",
    n: "Raposa",
    hp: 9,
    wander: 22,
    flee: 92,
    scare: 4,
    sz: 24,
    meat: 0,
    an: "raposa",
    pele: 1,
  },
};
/** v8.1 — o acampamento visto do campo aberto (field/acampamento_campo.ts), em casas: `clareira`, o raio sem árvore,
    mato e capim em volta da fogueira; `entrada`, perto assim da fogueira a heroína entra no acampamento; `fumaca`, até
    quantas casas a coluna de fumaça ainda é desenhada; `fogoAfasta`, o lobo bravo desiste a tantas casas da clareira;
    `marca`, até quantas casas o marcador na borda da tela aponta o acampamento fora do quadro. */
export const ACAMP_CAMPO = { clareira: 4.6, entrada: 3.3, fumaca: 60, fogoAfasta: 5, marca: 45 };
export const AVE = { susto: 2.4, vooAleatorio: [9, 22], vel: 130, alt: 52, penaChance: 0.35 };
export const CAMPO_CHAO = { galhoIni: 6, galhoChance: 0.4 };
