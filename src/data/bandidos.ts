/* ==== v8.1 — bandidos (field/bandidos.ts): a ficha de cada tipo e as regras do bando ====
   Mantenedor 2026-10-31: a luta contra humanos do parceiro de treino (copiava a força e a velocidade da heroína, golpe
   de 0,16 s, esquivava lendo o controle) "precisa de muito refino". Cada tipo tem a própria ficha; os golpes têm preparo
   que dá para ver; ele só reage ao que vê; no bando, poucos atacam por vez. Poupar o caído: "chance dele te entregar
   algo de valor, só fugir ou te atacar na sujeira". Fuga: "quando tem apenas 1 com menos que 80% de vida; se tiver com
   20% é até a morte". Tempos em s, distâncias em tiles, dano na escala do bote do lobo (base do wolfStrike). ==== */

/** Um golpe: preparo (a arma erguida, o anel colorido: dá para esquivar ou aparar), dano e o tempo exposto depois. */
interface GolpeBandido {
  preparo: number;
  dano: number;
  recupera: number;
}
interface TipoBandido {
  nome: string;
  modelo: string; // o personagem vestido (vestidos.json)
  arma: string; // a chave do item na mão (o modelo desenhado e o que pode cair)
  escudo?: boolean;
  arco?: boolean;
  hp: number;
  vel: number; // px/s (o lobo: 38)
  alcance: number;
  leve: GolpeBandido;
  pesado: GolpeBandido & { derruba?: boolean };
  pesadoChance: number;
  esquiva: number; // chance de esquivar do que ele viu chegando
  guarda: number; // vontade de levantar o escudo de perto (0 = não tem)
  reacao: [number, number]; // quanto demora para reagir ao que vê
  prof: string; // perfil de dano (DANO.PERFIS): resistências e fôlego
  ouro: [number, number];
  trai: number; // poupado, chance de atacar na sujeira (o resto se divide entre entregar algo e só fugir)
}

export const BANDIDOS: Record<string, TipoBandido> = {
  capuz: {
    nome: "Bandido encapuzado",
    modelo: "bandido_capuz",
    arma: "eq_faca_velha",
    hp: 34,
    vel: 46,
    alcance: 0.75,
    leve: { preparo: 0.24, dano: 2.6, recupera: 0.28 },
    pesado: { preparo: 0.5, dano: 4.4, recupera: 0.6 },
    pesadoChance: 0.25,
    esquiva: 0.45,
    guarda: 0,
    reacao: [0.22, 0.32],
    prof: "bandido_leve",
    ouro: [4, 12],
    trai: 0.4,
  },
  arqueiro: {
    nome: "Bandido arqueiro",
    modelo: "bandido_capuz",
    arma: "eq_arco",
    arco: true,
    hp: 30,
    vel: 40,
    alcance: 6.5,
    leve: { preparo: 0.95, dano: 3.2, recupera: 0.6 },
    pesado: { preparo: 1.3, dano: 4.8, recupera: 0.8 },
    pesadoChance: 0.2,
    esquiva: 0.4,
    guarda: 0,
    reacao: [0.25, 0.35],
    prof: "bandido_leve",
    ouro: [4, 10],
    trai: 0.3,
  },
  colete: {
    nome: "Bandido de colete",
    modelo: "bandido_colete",
    arma: "eq_espada",
    escudo: true,
    hp: 48,
    vel: 38,
    alcance: 0.95,
    leve: { preparo: 0.28, dano: 3, recupera: 0.32 },
    pesado: { preparo: 0.62, dano: 5.2, recupera: 0.7 },
    pesadoChance: 0.3,
    esquiva: 0.2,
    guarda: 0.55,
    reacao: [0.28, 0.38],
    prof: "bandido",
    ouro: [6, 16],
    trai: 0.25,
  },
  bruto: {
    nome: "Bandido bruto",
    modelo: "bandido_bruto",
    arma: "eq_clava",
    hp: 78,
    vel: 31,
    alcance: 1.05,
    leve: { preparo: 0.42, dano: 4.2, recupera: 0.5 },
    pesado: { preparo: 1.05, dano: 7.5, recupera: 1.2, derruba: true },
    pesadoChance: 0.45,
    esquiva: 0.05,
    guarda: 0,
    reacao: [0.34, 0.45],
    prof: "bandido_bruto",
    ouro: [8, 20],
    trai: 0.35,
  },
  couraca: {
    nome: "Bandido de couraça",
    modelo: "bandido_couraca",
    arma: "eq_espada",
    hp: 58,
    vel: 34,
    alcance: 0.95,
    leve: { preparo: 0.3, dano: 3.4, recupera: 0.34 },
    pesado: { preparo: 0.64, dano: 5.6, recupera: 0.75 },
    pesadoChance: 0.3,
    esquiva: 0.1,
    guarda: 0.25,
    reacao: [0.3, 0.4],
    prof: "bandido_couraca",
    ouro: [10, 24],
    trai: 0.2,
  },
};

/** O bando: tamanho, quem ataca, o cerco, a fuga, o poupar e quando aparecem à noite. */
export const BANDO = {
  tamanho: [2, 4] as [number, number],
  sorteio: { capuz: 3, colete: 3, bruto: 2, couraca: 2 } as Record<string, number>, // pesos (o arqueiro: no máximo 1)
  arqueiro: 0.45, // chance de um do bando ser o arqueiro
  atacantes: 2, // no máximo tantos atacando de perto ao mesmo tempo; os outros rodeiam
  rodeio: 3, // a distância de quem espera a vez
  vez: 0.8, // s: quem acabou de atacar espera ao menos isso para pegar a vez de novo (v8.2: era 2,2 — lentos demais)
  // v8.2 (mantenedor: "os melees ficam na defensiva, vêm andando, ataques lentos"):
  // combo: chance de emendar o próximo golpe leve, quantos no máximo, o preparo de cada emenda e a recuperação do
  // último (× a normal: é a sua janela)
  combo: { chance: 0.65, max: 3, preparo: 0.17, ultimo: 1.7 },
  corre: 3, // tiles: mais longe que isso, vem correndo
  correVel: 1.8,
  // investida: a essa distância (tiles), às vezes avança já golpeando (chance por segundo; velocidade × a dele)
  investida: { de: 1.4, ate: 2.8, chance: 0.9, vel: 4.2, t: 0.22 },
  punir: 2.4, // tiles: quem está perto aproveita você golpeando no vazio ou rolando, mesmo sem a vez
  costas: 0.6, // quem rodeia puxa para as costas dela tanto (0..1)
  // fôlego gasto (fração do fôlego dele)
  custo: { leve: 0.08, pesado: 0.16, esquiva: 0.14, bloqueio: 0.07 },
  esquivaDur: 0.28,
  esquivaInvuln: 0.24,
  guardaDur: [0.9, 1.5] as [number, number],
  guardaCd: 2.4,
  giro: { leve: 2.6, pesado: 1.4, arco: 1.8 }, // rad/s que ele acompanha você durante o preparo (sair de lado esquiva)
  arcoTrava: 0.28, // s finais do preparo do arco em que a mira trava (sair da linha esquiva)
  arcoLargura: 0.42, // tiles: a meia-largura da linha da flecha
  pesadoQuebraGuarda: 0.6, // o pesado no escudo levantado: quebra a guarda e passa tanto do dano
  derrubaT: 0.75, // s no chão depois do pesado do bruto
  // a fuga e o até a morte (só o último de pé)
  fogeVida: 0.8,
  ateMorte: 0.2,
  ateMorteDano: 1.25,
  some: 13, // tiles: quem foge e passa disso some
  fugaVel: 1.25,
  // poupar o caído (R): entrega algo de valor, só foge, ou ataca na sujeira (BANDIDOS[tipo].trai)
  entrega: 0.55, // do que sobra depois da traição: a parte que entrega algo (o resto só foge)
  traiPreparo: 0.3,
  traiDano: 1.4,
  pouparAlc: 1.3,
  // o que cai
  armaChance: 0.25, // a arma dele no chão
  corpo: 20, // s que o corpo fica no chão
  xp: 14,
  linhaMira: false, // v8.1: a linha da mira do arqueiro no chão (o mantenedor tirou os avisos contra humanos)
  brilho: { t: 0.2, leve: 0.45, pesado: 0.9 }, // v8.1: a arma brilha nos últimos 	 s do preparo (força no leve/pesado)
};

/** v8.1 — quando os bandidos aparecem (mantenedor: "no campo a maioria das vezes, mas também quem trabalha sozinho à
    noite, mas sempre avisar"). Uma vez por noite, no máximo. */
export const BANDO_NOITE = {
  campo: 0.65, // jogando no campo à noite: chance de virem (uma vez por noite)
  campoAtraso: [25, 70] as [number, number], // s de noite no campo antes de chegarem
  chegam: 9, // tiles: de onde eles vêm
  mapa: 0.0035, // no mapa, a cada tique, por quem trabalha sozinho à noite
  // deixar resolver: a chance de sair bem, e o que perde se não
  sozinha: 0.4,
  porReforco: 0.2,
  ouroPerde: 0.25, // fração do ouro que levam (também o preço de entregar o ouro)
  ouroMin: 5,
  ouroGanha: [10, 30] as [number, number], // vitória deixada: o saque
};
