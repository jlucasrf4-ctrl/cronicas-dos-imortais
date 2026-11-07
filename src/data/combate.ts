/* ==== Fase 4 ====
   combate: armas básicas e bônus em alvo marcado, sequência de golpes, bote do lobo, armas do v4.8 em diante (WPN,
   WPN_OF, lança, armas longas, textos, machado/clava, armas da sala de treino, facas), corda e nocaute, faca em
   cone, arremesso, cravar (CRAV2), laço (LACO) e dano por tipo (DANO). Saíram de base/15, base/16 e dos módulos
   v4.8 a v7.4 */

export const WEAPONS: Record<string, { label: string; cd: number; reach?: number; range?: number }> = {
  melee: { label: "⚔ Espada", cd: 0.9, reach: 0.75 },
  bow: { label: "🏹 Arco", cd: 1.4, range: 6.5 },
};
export const MARK_BONUS = 1.5; // alvo marcado leva +50% de dano
export const COMBO = [
  // golpe 1 e 2: rápidos · golpe 3: finalizador largo, mais forte, com avanço e empurrão
  { mult: 0.5, cd: 0.34, reach: 0.62, half: 0.62, lunge: 4, kb: 0 },
  { mult: 0.55, cd: 0.34, reach: 0.62, half: 0.62, lunge: 4, kb: 0 },
  { mult: 0.8, cd: 0.75, reach: 0.8, half: 0.95, lunge: 10, kb: 18 }, // v7.7: era 1,2 (mais que o dobro do 1º)
];
export const CLAVA_COMBO = [0.9, 1.05]; // clava: os 2 golpes do clique esquerdo (field/armas.ts: hvClubCombo)
export const CLAVA_CD = 0.55; // intervalo depois do combo da clava
export const COMBO_WINDOW = 0.75; // segundos para encadear o próximo clique
/* Ataque básico automático (clique no inimigo): no máximo `porSeg` golpes por segundo, acelerado pelo atributo
   velocidade como os demais golpes (mantenedor, 2026-11-06: "menos de 1,5 ataques por segundo", referência LoL). */
export const ATAQUE_AUTO = { porSeg: 1.5 };
/* Básico do arco (mesma opção do automático). Mantenedor, 2026-11-06: "o range tá muito grande… os tiros estão sendo
   rajadão; o tiro deve demonstrar o percurso da flecha antes de atirar: clica, barulhinho de puxar a corda, 3 segundos,
   atira". Clicar no inimigo puxa a corda por `puxada` s parada (andando demora mais, como no carregado; Força acelera),
   mirando sozinha nele e mostrando no chão o percurso até ele; cheia, solta: `alcance` tiles, `dano` × o dano base do
   arco (a força da carga cheia; o carregado vai de 0,45 a 1,5 ×, mas não empurra nem crava como o cheio manual), 1
   flecha, sem fôlego, e `pausa` s até a próxima puxada. Se o alvo sai do alcance, ela segura a corda até ele voltar. */
// 2026-11-06: "a puxada tá muito lenta, aumenta em 50% a velocidade" → 3 s ÷ 1,5 = 2 s.
export const ARCO_BASICO = { alcance: 3.5, puxada: 2, dano: 1.5, pausa: 0.4, velocidade: 420 };
export const POUNCE_LOCK = 0.35; // tempo em que a área do bote fica visível (e travada) antes do salto

interface Arma {
  mult: number;
  cd: number;
  reach: number;
  half: number;
  kb: number;
  lunge: number;
  stun?: number;
  bleed?: number;
  thrust?: boolean;
}
export const WPN: Record<string, Arma> = {
  espada: { mult: 1, cd: 1, reach: 1, half: 1, kb: 1, lunge: 1 },
  clava: { mult: 1.4, cd: 1.5, reach: 0.95, half: 1.05, kb: 2.2, lunge: 0.8, stun: 0.3 },
  machado: { mult: 1.22, cd: 1.22, reach: 1, half: 1.45, kb: 1, lunge: 1, bleed: 0.35 },
  lanca: { mult: 1.08, cd: 0.95, reach: 2.05, half: 0.22, kb: 0.7, lunge: 0.55, thrust: true },
  // v8.1: ferramenta de quebrar pedra; na luta, um golpe pesado e estreito, de impacto
  picareta: { mult: 1.1, cd: 1.3, reach: 0.95, half: 0.8, kb: 1.3, lunge: 0.8, stun: 0.15 },
};
export const WPN_OF: Record<string, string> = {
  eq_espada: "espada",
  eq_espada_longa: "espada",
  eq_clava: "clava",
  eq_machado: "machado",
  eq_lanca: "lanca",
  eq_picareta: "picareta",
};
/** v8.1 (mantenedor, 2026-10-31: "a madeira está quebrando muito rápido… no máximo 5 golpes verde, 5 a 8 amarelo, 8 a
    12"): quantos golpes derrubam a árvore (machado) ou quebram a pedra (picareta), por tamanho, na qualidade do golpe
    [verde, amarelo, laranja] (o "forte" conta como verde). field/recursos_campo.ts golpearRecursoCampo. */
export const GOLPES_RECURSO: Record<string, Record<string, number[]>> = {
  arvore: { small: [3, 5, 8], medium: [4, 6, 10], large: [5, 8, 12] },
  pedra: { small: [3, 5, 8], medium: [4, 6, 10], large: [5, 8, 12] },
};
/** v8.1 — o que a picareta solta no chão (não vai direto para a mochila): a cada golpe, `pedra` de chance de uma pedra
    e a tabela de minérios (ORE_TABLE) vezes `minerio` pela qualidade [verde, amarelo, laranja]; ao quebrar, `fim`
    pedras (+1 no verde). Some do chão em `dura` min de jogo, como os galhos. */
export const PEDRA_QUEBRA = { pedra: 0.35, minerio: [1.6, 1, 0.5], fim: 2, dura: 3 * 24 * 60 };
export const SPEAR_CH = { time: 0.7, rMin: 1.4, rMax: 3.4 }; // alcance em tiles (o arco chega a 6,5)
/** v8.1 (mantenedor, 2026-10-30: "correr com lança mirando não deve ficar mais lento… mas a mira mexe um pouco; maior
    nível com a lança deixa a corrida estável"): mirando o arremesso ela anda e corre na velocidade normal; a mira balança
    até `andando`/`correndo` rad (no ritmo `freq`, rad/s), parada não; cada nível de Lança tira `porNivel` do balanço. */
export const LANCA_BALANCO = { andando: 0.07, correndo: 0.2, freq: 7, porNivel: 0.12 };
export const TR_WPN = [
  ["eq_espada", "⚔️", "Espada"],
  ["eq_espada_longa", "🗡️", "Espada Longa"],
  ["eq_clava", "🏏", "Clava"],
  ["eq_machado", "🪓", "Machado"],
  ["eq_lanca", "🔱", "Lança"],
  ["eq_arco", "🏹", "Arco"],
  ["eq_arco_longo", "🎯", "Arco Longo"],
];
export const LONG_W = ["eq_lanca", "eq_clava", "eq_machado", "eq_picareta"];
export const WPN_TXT: Record<string, string> = {
  espada: "Equilibrada · combo de 3 · parry no botão direito",
  clava: "Todo golpe é carregado · combo de 2 · porradão atordoa (botão direito)",
  machado: "Arco largo · sangramento · golpe pesado ALEIJA (botão direito)",
  lanca: "Alcance longo · estocada reta · arremesso crava no crítico · empurrão (Espaço)",
  picareta: "Quebra pedra (botão direito, segure e solte no verde) · na luta, golpe pesado de impacto",
};
export const HV: Record<string, { dur: number; stam0?: number; stamS?: number }> = {
  axe: { dur: 1.0, stam0: 8, stamS: 20 },
  clubL: { dur: 0.55 },
  clubR: { dur: 1.35 },
};
export const ROPE = { range: 5.2, speed: 520, uses: 5, maxBound: 12 };
export const KO_T = 3.6;
export const KNIFE_KEYS = ["eq_faca_velha", "eq_faca", "eq_faca_simples"];
/** Arma cravada (DANO.CRAVAR): "tick" cobra fôlego por segundo (flecha, lança arremessada); "arranque" cobra ao puxar. */
export interface Cravada {
  pago: string;
  dur?: number;
  folego?: number;
  vida?: number;
  max?: number;
  tempoMax?: number;
  inicial?: number;
  teto?: number;
  ganho?: number;
  chance?: number; // v7.4: chance de cravar na estocada corpo a corpo (só a lança)
  folFrac?: number; // v8.0: fôlego tirado como fração do fôlego do bicho (no lugar de `folego`)
  folFracCheia?: number; // v8.0: idem, com a carga cheia do arco
  /** v8.1 — depois dos `dur` tiques a arma continua cravada (até o bicho morrer) tirando `fica` de fôlego por segundo */
  fica?: number;
  /** v8.1 — cada queda do bicho abre a ferida de cada uma cravada: `sangraQueda` de vida, 1 por segundo */
  sangraQueda?: number;
}
export const DANO = {
  TIPOS: ["perf", "cort", "imp"],
  NOME: ["Perfurante", "Cortante", "Impacto"],
  ICO: ["🗡", "✂", "🔨"],
  /* mix por ITEM: perfurante / cortante / impacto (soma 100). A cabeça da arma define o tipo. */
  ARMAS: <Record<string, number[]>>{
    eq_espada: [15, 75, 10],
    eq_espada_longa: [15, 75, 10],
    eq_machado: [5, 70, 25],
    eq_picareta: [45, 5, 50], // v8.1: a ponta fura e o peso bate
    eq_clava: [0, 5, 95],
    eq_faca_velha: [45, 50, 5],
    eq_faca: [45, 50, 5],
    eq_faca_simples: [55, 40, 5],
    eq_lanca: [80, 12, 8],
    eq_lanca_madeira: [85, 5, 10],
    eq_lanca_pedra: [75, 20, 5],
    eq_lanca_caca: [70, 5, 25],
    eq_maca: [30, 5, 65],
    eq_martelo: [15, 0, 85],
    flecha: [65, 5, 30],
    flecha_pedra: [55, 5, 40],
    punho: [0, 0, 100],
  },
  /* quanto da resistência PERFURANTE do alvo a ponta ignora */
  PEN: <Record<string, number>>{ eq_lanca: 0.4, eq_lanca_madeira: 0.4, eq_lanca_pedra: 0.4, eq_lanca_caca: 0.4 },
  /* materiais de armadura: resistência (%) no PEITO — perfurante / cortante / impacto */
  MATERIAIS: <Record<string, { n: string; r: number[]; pesada?: boolean }>>{
    linho: { n: "Linho / acolchoado", r: [4, 10, 16] },
    couro: { n: "Couro", r: [8, 16, 12] },
    malha: { n: "Cota de malha", r: [10, 26, 6], pesada: true },
    placa: { n: "Placa / ferro", r: [22, 24, 16], pesada: true },
  },
  PESO_SLOT: <Record<string, number>>{ peito: 1, cabeca: 0.5, pernas: 0.4, pes: 0.25 },
  ARMADURAS: <Record<string, { m: string; k?: number }>>{
    eq_elmo: { m: "placa" },
    eq_elmo_prata: { m: "placa", k: 1.2 },
    eq_armadura: { m: "couro" },
    eq_cota: { m: "malha" },
    eq_calca: { m: "linho" },
    eq_botas: { m: "couro" },
    eq_botas_ref: { m: "couro", k: 1.5 },
  },
  TETO: 70, // teto de resistência por tipo (%)
  PLACA_STAMINA: 0.12, // cada peça de placa: +12% × peso do slot no gasto de stamina (bloquear, correr, empurrar)
  /* animais e monstros: perfil de dano que CAUSAM, resistências (%) e fôlego */
  PERFIS: <Record<string, { n: string; mix: number[]; res: number[]; fol: number }>>{
    lobo: { n: "Lobo", mix: [45, 50, 5], res: [4, 12, 4], fol: 9 },
    lobo_jovem: { n: "Lobo jovem", mix: [45, 50, 5], res: [2, 8, 2], fol: 7 }, // v8.0 (LOBO_NIVEL)
    lobo_veterano: { n: "Lobo veterano", mix: [45, 50, 5], res: [10, 22, 8], fol: 13 }, // v8.0: couro grosso
    alfa: { n: "Lobo Alfa", mix: [45, 50, 5], res: [10, 20, 8], fol: 18 },
    javali: { n: "Javali", mix: [40, 10, 50], res: [20, 20, 5], fol: 12 },
    coelho: { n: "Coelho", mix: [20, 30, 50], res: [0, 0, 0], fol: 3 },
    pato: { n: "Pato", mix: [30, 10, 60], res: [0, 0, 0], fol: 3 },
    aguia: { n: "Águia", mix: [55, 40, 5], res: [0, 5, 0], fol: 4 },
    cervo: { n: "Cervo", mix: [40, 5, 55], res: [5, 5, 5], fol: 5 },
    raposa: { n: "Raposa", mix: [45, 50, 5], res: [2, 6, 2], fol: 6 },
    esqueleto: { n: "Esqueleto", mix: [10, 40, 50], res: [45, 15, 0], fol: 99 },
    couro_grosso: { n: "Couro grosso", mix: [30, 20, 50], res: [40, 25, 5], fol: 18 },
    boneco: { n: "Boneco", mix: [0, 0, 100], res: [0, 0, 0], fol: 0 },
    // v8.1: bandidos (data/bandidos.ts); a couraça segura corte e perfuração, o impacto passa
    bandido_leve: { n: "Bandido", mix: [60, 40, 0], res: [3, 4, 3], fol: 10 },
    bandido: { n: "Bandido", mix: [30, 65, 5], res: [6, 10, 4], fol: 12 },
    bandido_bruto: { n: "Bandido bruto", mix: [0, 10, 90], res: [8, 8, 14], fol: 16 },
    bandido_couraca: { n: "Bandido de couraça", mix: [30, 65, 5], res: [32, 45, 4], fol: 14 },
  },
  /* cravar: tick = projétil (paga em pulsos) · arranque = corpo a corpo (paga ao arrancar) */
  CRAVAR: <Record<string, Cravada>>{
    // v8.0: a flecha tira uma FRAÇÃO do fôlego do bicho (era 5 fixos: 1 cravada sempre derrubava cervo e coelho)
    // v8.1 (mantenedor, 2026-10-30): a flecha fica cravada (1 de fôlego por segundo) e cada queda sangra 3 (1 por s)
    flecha: { pago: "tick", dur: 5, folego: 5, folFrac: 0.25, folFracCheia: 0.45, vida: 3, max: 4, fica: 1, sangraQueda: 3 },
    lanca_arremesso: { pago: "tick", dur: 6, folego: 9, vida: 4 },
    faca: { pago: "arranque", tempoMax: 3, inicial: 4, teto: 9, ganho: 1.5 },
    espada: { pago: "arranque", tempoMax: 4, inicial: 5, teto: 12, ganho: 1.5 },
    lanca: { pago: "arranque", tempoMax: 6, inicial: 6, teto: 14, ganho: 1.5 },
    machado: { pago: "arranque", tempoMax: 3, inicial: 5, teto: 10, ganho: 1.2 },
  },
  FOLEGO: {
    golpe: 1.3, // v8.0: era 2,2 (tirar ~45% da vida já derrubava; agora ~75%); parry/esquiva perfeitos cansam (PARRY, ESQUIVA)
    impacto: 0.4,
    regen: 0.5,
    espera: 2.5,
    tetoMin: 0.25, // o mínimo do teto do fôlego (a perda por queda: EXAUSTAO.perdaInterna)
    vel: [1, 0.85, 0.7, 0.55], // v7.7: velocidade por faixa de fôlego (100–75% · 75–50% · 50–25% · abaixo de 25%)
    koT: 8, // v7.7: o bicho caído levanta 50% mais rápido (era 12)
    koBoss: 4, // (era 6)
    levanta: 0.4,
    /* v8.1 (mantenedor, 2026-10-30: "a ideia é que ele levanta no susto, ganha uma stamina, corre gastando a stamina e
       cai"): ao levantar, o fôlego vai a pelo menos `folego` do máximo (passa do teto por um tempo); por `t` s a presa e
       o bicho neutro fogem com `vel`× a velocidade, gastando `corre` do máximo por segundo correndo (pode escapar ou
       cair de novo); o predador bravo bate com `dm`× o dano, em frenesi (field/tipos.ts folWake, field/combate.ts) */
    desespero: { t: 6, folego: 0.5, vel: 1.35, corre: 0.09, dm: 1.3 },
    empurrar: 2,
    stamina: 14,
    arranque: 0.5,
  },
  /* v8.0 (mantenedor, 2026-10-24): o impacto sempre entra no dano, mas os EFEITOS (empurrar, interromper o bote,
     atordoar) só valem para armas com pelo menos `minEfeito`% de impacto no mix (clava, maça, martelo, machado, lança de
     caça, flechas, punho). Antes qualquer golpe com um pouco de impacto (espada 10%, faca 5%) cancelava o bote. */
  IMPACTO: { chance: 0.6, empurra: 5, imune: 3, tMin: 0.6, tMax: 1.5, minEfeito: 25 },
  // v8.0: o corte sangra `frac` da parte cortante do golpe, em `dur` s, acumulando até `pilhas` cortes e no máximo
  // `teto` da vida máxima do bicho
  CORTE: { dps: 1, dur: 5, chance: 0.6, frac: 0.6, pilhas: 3, teto: 0.35 },
  /* v8.0: toda arma com ≥ 40% de perfurante ignora `PEN_PADRAO` da resistência perfurante (a lança, PEN, mais) */
  PEN_PADRAO: 0.2,
};
export const CRAV2 = {
  ponta: <Record<string, number>>{ faca: 0.5, espada: 0.8, lanca: 1.5, machado: 0.75 }, // distância da ponta (em tiles) — o bicho fica preso nela
  zoom: 1.18,
  zoomCrav: 1.07,
  zoomVel: 4, // zoom no personagem ao segurar / só cravado
  foge: 34, // força com que o bicho tenta fugir (arrasta o jogador)
  puxa: 0.55,
  puxaHold: 0.25, // quanto do puxão vai para o jogador (solto / segurando)
  debate: [1.2, 2.2],
  debateStam: 12, // debatida: a cada x s tira stamina do jogador
  somSeg: 0.32, // som contínuo enquanto segura
  pulso: 1, // empurrão a cada x s
  fundo: 0.18, // o máximo da lâmina dentro do corpo (fração: CravadoNaHeroina.dep)
};
/* v7.7 — fôlego interno do jogador (dungeon.gint, 0..100, o cinza do anel). Só volta com o fôlego de fora cheio.
   v8.0 (mantenedor, 2026-10-24): o interno não é mais o teto do fôlego de fora (gstam, o verde) e o de fora não tira
   mais do interno ao zerar; a única ligação é zerar o interno, que derruba o de fora (`queda`). */
export const FOL_HEROI = {
  perdaInterna: 0.2, // a barra de fôlego quebrou: o interno perde isso (field/folego.ts)
  corrida: [0.65, 0.8, 0.9, 0.95, 1], // a velocidade da corrida por faixa do interno (field/folego.ts)
  suavizarCorrida: 5, // quão rápido a velocidade da corrida acompanha a faixa (field/chao.ts)
  volta: 8, // quanto o interno volta por segundo (com o fôlego de fora cheio e parado de gastar)
  rolar: 25, // cada rolamento (dash do arco) tira isso do interno; sem interno acima do mínimo + isso, não rola
  min: 0, // o interno pode zerar (v7.7; era 25)
  minLaco: 25, // o cabo de guerra do laço tira do interno só até aqui (depois, do fôlego de fora)
  // o fôlego de fora volta 25 × isso por segundo. v7.7 era 0,5 a 2,5 conforme os quartos do interno cheio; v8.0 fixo
  // no valor de interno cheio (o interno não mexe mais na corrida)
  voltaFora: 2.5,
};
/* v8.0 — segurar o arco puxado ao máximo (mantenedor, 2026-10-24: "solta sozinho… não mostra quanto tempo eu ainda
   tenho"): no lugar do limite fixo de 1,6 s, cada `passo` s cheio tira `gasto` do fôlego interno (o cinza do anel, o
   mesmo do rolamento; mantenedor: "use a stamina interna"); sem interno para mais um passo, ela perde a mira (sem
   atirar). O interno gasto assim volta `volta` × mais rápido (150% mais rápido). Clique esquerdo puxando = cancela. */
/* A exaustão (field/folego.ts, field/tipos.ts): o interno perdido a cada quebra/queda, a chance de cair por etapa,
   a velocidade e a defesa por etapa, a proteção ao levantar, a fuga e o impacto do machado no próprio fôlego.
   (recuperado do build de 2026-11-06 19:50 depois da corrupção do disco; os comentários originais se perderam) */
export const EXAUSTAO = {
  perdaInterna: 0.25,
  chanceQueda: [0.2, 0.25, 0.5, 0.8],
  velocidade: [1, 0.85, 0.65, 0.25],
  defesa: [1, 0.8, 0.55, 0.2],
  protecaoLevantar: 3,
  fuga: { duracao: 3, velocidade: 1.35 },
  impactoMachado: 0.03,
  impactoMachadoEm: 0.18,
};
export const ARCO_FOL ={ passo: 0.4, gasto: 10, volta: 2.5 };
/* v8.0 — parry como janela ativa (mantenedor, 2026-10-24: "acertando o tempo, outro bicho atacando junto… o parry só
   conta no primeiro"): o clique abre a janela; cada golpe de frente que CHEGA dentro dela é avaliado na hora em que
   chega (perfeito até PARRY_PERFECT s depois do clique, parcial até PARRY_NEAR). Antes era uma foto do clique: só valia
   para quem já estava preparando o golpe. `invul`: invulnerável depois do perfeito (era 2,5 s: imune à matilha).
   `cd`/`cdOk`: recarga depois do clique / depois de um perfeito. Feedback do perfeito: `congela` s de tela parada,
   câmera lenta `lenta` × por `lentaMs` ms reais. `anel`: s antes do golpe em que o anel que fecha aparece no lobo. */
/* v8.0 — esquiva no último instante (rolamento do arco e footwork): o golpe chegou até `perfeita` s depois de começar
   a esquiva. Câmera lenta `lenta` × por `lentaMs` ms, devolve `folego` do fôlego e `interno` do interno. */
export const ESQUIVA = { perfeita: 0.12, lenta: 0.4, lentaMs: 220, folego: 10, interno: 8, cansaBicho: 0.2 };
/* v8.0 — finalizar (mantenedor: "um combo e já finaliza na faca é muito forte… a sensação de golpe final não existe"):
   lobo/javali caído só morre no finalizar com até `mata` da vida; acima, leva `golpe` da vida máxima e levanta (como o
   Alfa). Bichos de caça (cervo, coelho…) seguem morrendo (o abate limpo da caça). O golpe é o 3º do combo, com o pico
   no acerto (`pico` s antes), tela parada `congela` s e câmera lenta `lenta` × por `lentaMs` ms. */
/* v8.0 — lobos por nível (mantenedor: "os inimigos passam a ser muito fracos depois de um certo nível"): no campo
   aberto, o lobo é jovem, adulto ou veterano conforme a distância da heroína ao acampamento (`longe` unidades do mapa
   = +1 nível) e a noite (+`noite`), com um sorteio de ±`sorte`/2. Nível < `jovem` = jovem; ≥ `veterano` = veterano.
   O Alfa e as arenas (hordas, treino) não mudam. A heroína fica forte de verdade perto de casa; longe, o mundo cobra. */
export const LOBO_NIVEL = {
  longe: 900,
  noite: 0.7,
  sorte: 0.8,
  jovem: 0.35,
  veterano: 1.35,
  tipos: <Record<string, { nome: string; hp: number; dm: number; spd: number; prof: string }>>{
    jovem: { nome: "Lobo jovem", hp: 16, dm: 0.8, spd: 0.95, prof: "lobo_jovem" },
    adulto: { nome: "Lobo", hp: 22, dm: 1, spd: 1, prof: "lobo" },
    veterano: { nome: "Lobo veterano", hp: 34, dm: 1.3, spd: 1.08, prof: "lobo_veterano" },
  },
};
export const FINALIZAR = { mata: 0.35, golpe: 0.3, pico: 0.12, congela: 0.12, lenta: 0.3, lentaMs: 380 };
export const ROLAR_GUARDA = 0.32; // s do rolamento do arco em que o golpe passa direto
export const PARRY = {
  invul: 0.4,
  cd: 0.6,
  cdOk: 0.3,
  congela: 0.09,
  lenta: 0.35,
  lentaMs: 260,
  anel: 0.6,
  cansaBicho: 0.35, // fração do fôlego do bicho que o parry perfeito tira
};
/* v7.7 — footwork (no código, "ginga"): Espaço com arma corpo a corpo e sem escudo (field/armas.ts: gingar). Um jogo
   de corpo curto para o lado; o golpe que chega dentro da janela passa direto. Não mexe no bicho (diferente do parry e
   do empurrão). */
export const GINGA = {
  janela: 0.25, // s depois do Espaço em que o golpe passa direto
  dur: 0.22, // duração do passo
  passo: 0.55, // força do passo (× a do rolamento do arco)
  cd: 0.55, // intervalo entre gingas
  stam: 20, // fôlego de fora gasto (v7.7: 20% da barra máxima de 100; era 10)
  minStam: 20, // abaixo disso não ginga (precisa ter o custo inteiro)
};
export const LACO = {
  corda: 4.2, // comprimento máximo da corda (tiles); mínimo 1,8
  forca: 40, // força com que o bicho tenta fugir
  puxaoStam: 14, // stamina por puxão (G)
  puxaoFol: 0.22, // fração do fôlego do bicho que cada puxão tira (÷ √força do bicho)
  puxaoCd: 0.3, // intervalo mínimo entre puxões
  /* v7.7 — cabo de guerra (no lugar da barra de fuga): os dois perdem fôlego por segundo, primeiro o interno (até 25%),
     depois o de fora; quem zerar primeiro perde (bicho → dominado · você → a corda escapa) */
  cansaBicho: 0.07, // fração do fôlego do bicho por segundo (× sua força na corda ÷ √força do bicho)
  cansaHeroi: 5, // seu fôlego por segundo (× força do bicho, que cai com o cansaço dele)
  tranco: 4, // fôlego que cada tranco do bicho tira de você (× força do bicho)
  debate: [1.4, 2.4], // a cada x s o bicho dá um tranco
  arrasto: 0.25, // dominado: quanto o peso do bicho segura o herói quando a corda estica
  /* v7.7 — dominado tem 2 estados: CAÍDO (deitado, vem arrastado) e DOMADO (de pé, segue você andando). Domado, o
     fôlego dele volta aos poucos e o interno sobe sozinho até dar pinote (tabela DOMA); se o fôlego zerar, cai */
  caido: 4, // s caído depois de dominado, até levantar domado
  levanta: 0.15, // fôlego com que levanta (fração do máximo)
  volta: 0.05, // domado: fração do fôlego máximo que volta por segundo
  segue: 1.4, // domado: anda até ficar a esta distância de você (tiles)
  vel: 3, // domado: velocidade = (distância − segue) × isto, por segundo…
  velMax: 90, // …até este máximo (px/s)
  soltar: 0.8, // segurar G por isto (s) com ele dominado solta a corda
};
/* v7.7 — domado na corda (ideia do mantenedor, 2026-10-18; valores propostos, a ajustar jogando): o fôlego interno
   do bicho (o círculo de dentro) sobe sozinho; cheio, ele dá um PINOTE (tranco que puxa o seu fôlego; sem fôlego
   para segurar, volta o cabo de guerra). O G baixa o interno. Depois de `teima` s domado ele desiste: o interno não
   sobe mais e não há mais pinote. */
export const DOMA = {
  inicio: 0.25, // o interno com que levanta domado (fração; o mínimo do fôlego interno, DANO.FOLEGO.tetoMin)
  sobe: 0.06, // quanto o interno sobe por segundo (de 25% a cheio em ~12 s sem puxar)
  cheio: 1, // interno a partir do qual dá o pinote
  depois: 0.55, // o interno logo depois do pinote
  puxao: 0.2, // quanto cada puxão (G) tira do interno (÷ √força do bicho); no mínimo, tira do fôlego de fora
  custo: 18, // seu fôlego que cada pinote tira (× força do bicho); sem isso no fôlego, ele escapa para o cabo de guerra
  salto: 26, // quanto o pinote o joga para longe de você (mundo)
  teima: 30, // s domado até ele desistir de fugir
};
/* v7.7 — rastreamento (field/rastreio.ts): com o nó Rastreador; o painel lista até cap[rank − 1] bichos dentro do raio */
export const RASTREIO = {
  raio: 6, // tiles (decidido pelo mantenedor em 2026-10-18; era 9, provisório)
  cap: [4, 5], // Rastreador rank 1 · rank 2
};
/* v7.7 — Lobo Alfa: toma menos dano; caído, o finalizador não o mata: tira esta fração da vida máxima */
export const ALFA = { dano: 0.75, finalizador: 0.3 };
/* v7.7 — finalizar: zoom da câmera durante o golpe (multiplica o zoom; field/tipos.ts: cravZoom) */
export const FINAL = { zoom: 1.28 }; // 1,12 × 1,14 (o mantenedor pediu +14%)
export const FACA2 = { reach: 0.85, half: 0.5, cd: 0.32, marcado: 0.3, mult: 0.55, segundo: 1.15 }; // segundo: o 2º corte (alternado) bate ×1,15
export const ARREMESSO = { medio: 0.75, chance: [0.5, 0.65, 0.8] }; // força: < 75% fraco · ≥ 75% médio (amarelo) · barra cheia
