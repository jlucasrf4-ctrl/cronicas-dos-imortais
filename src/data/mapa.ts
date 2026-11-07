/* ==== Fase 4 ====
   mapa e interface: teclas e velocidade no mapa, zoom, névoa, ilhas e a Vila do Musgo, área de caça, direções do
   caminho (A*), abas do celular, tipos de trabalho, espaços do boneco e dos atalhos, galhos por lança. Saíram de
   v4.4 a v7.6 */
import type { Hero } from "../core/tipos.ts";

export const MOB_TABS = [
  ["heroes", "👤", "Heróis"],
  ["pop", "📊", "Região"],
  ["bag", "💰", "Bolsa"],
  ["ctl", "⚙", "Tempo"],
];
export const ALT_K = ["maoD", "maoE", "costas"];
export const DOLL_ARMOR = [
  ["cabeca", "Elmo"],
  ["peito", "Armadura"],
  ["pernas", "Calça"],
  ["pes", "Botas"],
];
export const HUNT_AREA_R = (hrs: number) => Math.round(30 + 15 * Math.sqrt(hrs || 6)); // 2h≈51 · 6h≈67 · 12h≈82 · 24h≈103 · 48h≈134
export const HUNT_MAX_START = 240; // até onde, a partir da base (ou de onde ele está), a área pode começar
export const KIND_N: Record<string, string> = {
  metal: "⚒ Metal (bigorna e têmpera)",
  couro: "🧵 Couro (corte e costura)",
  madeira: "🪵 Madeira (entalhe)",
};
export const NAV_DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.41421356],
  [1, -1, 1.41421356],
  [-1, 1, 1.41421356],
  [-1, -1, 1.41421356],
];
export const MAP_KEYS: Record<string, number[]> = {
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};
/* v7.7 — controle de RTS no mapa (map/selecao.ts): câmera pelo teclado e pela borda da tela, arrasto e duplo toque */
export const RTS = {
  vel: 900, // px da tela por segundo (WASD/setas e borda)
  acel: 8, // quanto a câmera demora a pegar e perder a velocidade (maior = mais rápida)
  borda: 10, // px da borda da janela que movem a câmera
  arrasto: 6, // px de movimento para o clique virar caixa de seleção
  duplo: 350, // ms entre dois toques no número do grupo para centralizar nele
};
/* v7.7 — ordens do mapa (map/selecao.ts) e os verbos de cada trabalho (botões, avisos, dica do cursor): nada de
   "Caçar aqui" para pedra e madeira (pedido do mantenedor, 2026-10-18) */
export const ORDEM = {
  raioBicho: 16, // px da tela: o cursor está "no bicho"
  verbos: {
    rabbit: ["🏹", "Caçar coelho"],
    deer: ["🏹", "Caçar cervo"],
    wolf: ["🏹", "Caçar lobo"],
    boar: ["🏹", "Caçar javali"],
    fox: ["🏹", "Caçar raposa"],
    duck: ["🏹", "Caçar pato"],
    eagle: ["🏹", "Caçar águia"],
    tree: ["🪓", "Cortar madeira"],
    rock: ["⛏", "Quebrar pedra"],
    fish: ["🎣", "Pescar"],
  } as Record<string, [string, string]>,
};
/** "🪓 Cortar madeira" (o trabalho `k`). */
export const verboTrabalho = (k: string) => (ORDEM.verbos[k] || ["🎯", "Caçar"]).join(" ");
/* v7.7 — fluxo de caça (map/cacada.ts): achou a presa, entra no campo para derrubá-la; decisões do mantenedor, 2026-10-18 */
export const CACADA = {
  especies: ["rabbit", "deer", "wolf", "boar", "fox"], // só estas viram caçada no campo (o resto segue automático)
  aviso: 6000, // ms que o aviso "achou" fica na tela; v8.1: clicar entra no campo, ignorar segue automática
  tempo: 60, // s para derrubar a presa; depois ela corre para a borda e foge (v8.0: era 90, "muito tempo")
  distIni: 9, // tiles: a presa nasce pelo menos a essa distância da heroína (arenas)
  longe: [18, 24], // v8.0: no campo aberto, entre tantas casas dela (mantenedor: "o cervo por padrão mais longe")
  fugaVel: 1.2, // × a velocidade de fuga da espécie, correndo para a borda
  fracasso: 0.5, // se ela fugiu: fração da carne no resto da caça automática (mínimo 1)
  volta: 2500, // ms entre "fugiu" e a volta ao mapa
};
/* v8.0 — rastrear a presa da caçada no campo aberto (field/rastro.ts; mantenedor, 2026-10-24: "dificuldade de rastrear
   o cervo… sistema de pegadas"): a presa deixa pegadas no chão a cada `passo` casas, que somem em `vida` s (encolhem no
   último terço); ao entrar, um rastro já leva de perto da heroína (`inicio` casas) até a presa. Fora da tela, uma seta
   na borda aponta para ela, com a distância em passos.
   Às vezes (`semRastro`, menos com a perícia Rastreio) não há pegada nem seta no começo: há `fezes` pelo caminho (a
   `fezesDist` casas dela, até `fezesAng` rad para o lado da presa); chegar a `fezesR` casas de uma revela o rastro.
   Rastreio (por nível): `porNivel` tira da chance sem rastro (mínimo `semRastroMin`), `vidaNivel` alonga a vida das
   pegadas, `fezesNivel` aumenta o raio de achar. XP: `xpLer` por pegada pisada, `xpFezes`, `xpAbate`. */
export const RASTRO = {
  passo: 0.6,
  vida: 45,
  max: 90,
  inicio: 2.5,
  seta: "#ffd27a",
  semRastro: 0.45,
  semRastroMin: 0.1,
  porNivel: 0.04,
  vidaNivel: 0.08,
  fezes: 2,
  fezesDist: [4, 10],
  fezesAng: 0.6,
  fezesR: 1.3,
  fezesNivel: 0.12,
  xpLer: 0.25,
  xpFezes: 3,
  xpAbate: 4,
  // v8.0: bicho ferido ou sangrando deixa uma gota a cada `passo` casas, que some em `vida` s (field/rastro.ts)
  sangue: { passo: 1, vida: 40, max: 80 },
};
export const ZOOM_MAPA = { base: 6, perc: 0.08, cart: 0.12, mapa: 0.25 }; // quanto o mapa afasta: menor = vê mais longe
export const OBS_GALHO = { talhar: 2 }; // galhos por lança
export const ARQ = { nome: "Ilhas Golden Fish" };
interface EstadoMUSGO {
  id: string;
  raio: number;
  docaRaio: number;
  loja: [string, number][];
  // acrescentados depois
  _dc?: { x: number; y: number; ang: number };
  h?: Hero | null; // quem está comerciando na Vila Musgo (empOpen)
  _pd?: { x: number; y: number };
}
export const MUSGO: EstadoMUSGO = {
  id: "musgo",
  raio: 44,
  docaRaio: 34,
  loja: [
    ["corda", 10],
    ["erva", 4],
    ["galho", 1],
    ["pele", 9],
    ["linho", 4], // v7.7: só se compra (docs/materiais.md): costura bolsas e forros
    ["peixe", 3],
    ["eq_faca", 22],
    ["eq_lanca_madeira", 12],
    ["flechas10", 8],
  ],
};
export const NEVOA = { cor: "rgba(206,198,176,", forte: 0.9, borda: 0.35 }; // névoa de pergaminho; borda = fração do raio que esfuma
/** v8.0 — a noite no mapa (desenharCamadaMapa): horários em horas do dia; escurece de `escurece` a `noite`, clareia de
    `clareia` a `dia`; `forte` = opacidade do azul na noite fechada; `poente` = a do laranja no meio das transições. */
export const NOITE_MAPA = {
  escurece: 17,
  noite: 21,
  clareia: 4.5,
  dia: 7,
  cor: "rgba(12,20,52,",
  forte: 0.55,
  corPoente: "rgba(255,120,50,",
  poente: 0.16,
};
/** v8.0 — a noite no campo 3D (luzCampo em render/luz_do_dia.ts, mesmos horários de NOITE_MAPA): a cena é
    multiplicada por `noite` (rgb) na noite fechada e por `poente` × `forcaPoente` no meio do poente e da aurora. */
export const NOITE_CAMPO = { noite: [0.34, 0.4, 0.66], poente: [1, 0.78, 0.6], forcaPoente: 0.6 };
/** v8.0 — a luz da fogueira acesa no campo 3D (luzFogueira em render/luz_do_dia.ts; shader GL_FS): `raio` em px do
    campo (uma casa = 42), `altura` do ponto de luz, `cor` (rgb, pode passar de 1), força de `dia` a `noite` pelo escuro
    da hora (no poente, `poente`), `tremor` = quanto a chama oscila; `max` = fogueiras com luz por quadro. */
export const FOGO_LUZ = {
  raio: 170,
  altura: 16,
  cor: [1, 0.56, 0.24],
  dia: 0,
  poente: 0.35,
  noite: 1.25,
  tremor: 0.08,
  max: 4,
};
