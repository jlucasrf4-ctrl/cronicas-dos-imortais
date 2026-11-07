/* ==== Fase 5 — tipos do domínio do jogo ====
   Só tipos (nada aqui existe em tempo de execução): herói, atributos, itens, grade de inventário, monstro, bichos,
   mundo, economia, expedição (dungeon), save e malha WebGL. Descrevem os objetos como o código os monta hoje;
   os campos opcionais (`?`) são os que só aparecem depois (acrescentados por outro módulo, pelo jogo ou na migração
   de um save). Os campos foram colhidos com o tsc sobre uma cópia de src/ sem os `// @ts-nocheck`.
   Enquanto `strict` estiver desligado, `null` cabe em qualquer campo; o `| null` já marca quem pode ser null para
   quando `strictNullChecks` ligar. Na 5.5 os sub-objetos que ainda eram `any` (o antigo marcador "solto") ganharam
   interfaces (fim do arquivo), e o marcador foi apagado: um valor novo ganha um tipo de verdade. */

import type { Cidade } from "../data/economia.ts";
import type { Cravada } from "../data/combate.ts";

/** Os `arguments` de uma etapa da Fase 3, repassados como vieram: `fnBase.apply(this, arguments as Repasse)`.
 *  Com `strict`, `IArguments` não casa com a tupla de parâmetros de `fnBase`; a função que repassa declara `this: unknown`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Repasse = any;

export interface Ponto {
  x: number;
  y: number;
}

/* ---------- herói ---------- */

/** Os quatro atributos de nascimento (ATTR_DEFS). `vida` é o nome antigo de `constituicao` (saves velhos). */
export interface Attrs {
  forca: number;
  constituicao: number;
  destreza: number;
  mana: number;
  vida?: number;
  [atributo: string]: number | undefined; // lidos pelo id de ATTR_DEFS
}

/** O que bornFromSeed devolve: a semente decide afinidade, genética e atributos. */
export interface Nascimento {
  seed: number;
  aff: string;
  gen: string;
  attrs: Attrs;
}

/** Proficiência treinada (hero.skills[id]). */
interface Pericia {
  level: number;
  xp: number;
}

/** A tarefa do herói no mapa: caçar numa região, buscar uma runa, voltar ao acampamento (map/caca, runas). */
interface TarefaHeroi extends Ponto {
  targetSpecies: string;
  killsDone: number;
  killsWanted?: number;
  maxMin?: number;
  ox?: number;
  oy?: number;
  r?: number;
  field?: boolean; // caçada "e fica no campo" (huntHere): ao voltar, o herói fica onde está
  back?: boolean;
  mg?: boolean; // v7.7: comando do mapa (map/selecao.ts): o minijogo abre quando ele chegar
  runeId?: string;
  t?: number;
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  idle?: number;
  moves?: number;
  noT?: number;
  warned?: number | boolean;
  // v7.7: fluxo de caça (map/cacada.ts)
  cacada?: string; // "aviso" | "campo" | "ok" | "fugiu" | "auto": já teve (ou dispensou) a caçada no campo
  fraca?: boolean; // a presa fugiu: o resto da caça dá menos carne (CACADA.fracasso)
}

/** Viagem de comércio até uma cidade (econ/economia: startTrip). setLeg põe o trecho atual (from → to). */
export interface Viagem {
  city: Cidade;
  cargo: Item[];
  mode: string;
  horses: number;
  wagon: boolean;
  speed: number;
  t: number;
  from?: Ponto;
  to?: Ponto;
  total?: number;
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  gaveUp?: boolean;
}

export interface Hero {
  id: string;
  name: string;
  sexo?: "M" | "F"; // v7.7: a silhueta da preparação; sem escolha na criação ainda, vale "F" (a heroína)
  /** v8.0: corpo e cabeça sorteados ao nascer (render/gl/aparencias.ts); ausente = a heroína de sempre */
  visual?: { corpo: string; cabeca: string; pele?: string; cabelo?: string };
  /** v8.2: migração única dos visuais antigos para os corpos padrão das recrutáveis */
  aparenciaVersao?: number;
  color: string;
  attrs: Attrs;
  seed: number;
  aff: string;
  gen: string;
  xp: number;
  lvl: number;
  nodes: Record<string, boolean>;
  spent: number;
  treeBonus: number;
  manaMax: number;
  mana: number;
  _rpg?: number;
  skills: Record<string, Pericia>;
  camp: Ponto;
  x: number;
  y: number;
  dir: number;
  state: string;
  task: TarefaHeroi | null;
  targetEntity: AlvoHeroi | null; // bicho (caça) ou nó de recurso (coleta), conforme a tarefa
  loot: Record<string, number>;
  trail: Ponto[];
  huntTimer: number;
  localTarget: Ponto | null;
  huntSpecies: string;
  huntHours: number;
  implemented: boolean;
  hpMax: number;
  hp: number;
  energy: number;
  hunger: number;
  // acrescentados depois
  inv?: InvGrid;
  inv2?: InvGrid;
  equip?: Equip;
  trip?: Viagem | null;
  walkTo?: Ponto | null;
  nav?: CaminhoNav | null;
  navActive?: boolean;
  navBlocked?: boolean;
  wound?: number;
  cold?: number;
  bagLv?: number;
  banked?: number;
  bowMastery?: { lvl: number; pts: number };
  swordMastery?: { lvl: number; pts: number };
  _trAttr?: Record<string, number>;
  _enterCamp?: boolean;
  _toDoca?: boolean;
  _toMusgo?: boolean;
  _walkArm?: boolean; // esperando o toque no mapa para andar (heroWalkArm)
  _folhKit?: number; // já ganhou o kit de folhamas (runeGiveKit)
  _segWT?: Ponto | null;
  _profV?: number; // versão da migração de proficiências (profMigrate)
  fishT?: number; // minutos pescando desde o último peixe (fishTick)
  mgUntil?: number; // tick até quando o minijogo de trabalho está em espera (askWork)
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  _obsG?: number;
  _set?: number;
  gatherT?: number;
  // acrescentado na 5.5
  runeLore?: Record<string, number>; // runas absorvidas por elemento (estudo para as Runas Comuns)
}

/** Equipamento vestido, por encaixe (EQ_SLOTS: cabeca, peito, pernas, pes, maoD, maoE, costas…). */
export type Equip = Record<string, Item | null>;

/* ---------- itens e inventário ---------- */

/** Uma entrada de ITEM_DEFS. A carga acrescenta mais itens e campos (armas, minérios, runas…). */
export interface ItemDef {
  key: string;
  name: string;
  emoji: string;
  color: string;
  val: number;
  w: number;
  shape?: number[][];
  res?: string;
  stack?: number;
  slot?: string;
  armor?: number;
  desc?: string;
  dmg?: number;
  block?: number;
  mix?: number[]; // mistura de tipos de dano da arma (DANO.ARMAS)
  blueprint?: string; // planta da forja: a chave do item que ela ensina
  packBase?: number; // casinhas de 1 unidade de um pacote 9/9 (v6.5)
  rune?: { tier: string; el: string; sub: string; fx: number }; // runas criadas em jogo (runas: runeDef)
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  mat?: string; // material da armadura (DANO.MATERIAIS)
}

/** Um item que existe numa grade (mochila, baú, chão) ou num encaixe de equipamento. */
export interface Item {
  uid: number;
  def: ItemDef;
  conteudo?: InvGrid; // v7.7: mochila/aljava guardada (fora do corpo) leva aqui o que tem dentro (items/mochilas.ts)
  flechas?: number; // v7.7: aljava guardada: as flechas que estavam nela (econ.quiver.n)
  presilhas?: (Item | null)[]; // v7.7: cinto: o que está preso em cada presilha (faca ou bolsa; items/cinto.ts)
  x: number;
  y: number;
  shape: number[][];
  tier: number;
  n?: number;
  _core?: number[][];
  q?: number; // qualidade (QUAL)
  dur?: number; // durabilidade
  durMax?: number | null;
  af?: Record<string, number>; // afixos de atributo
  uses?: number; // usos que restam (corda)
  an?: string; // de que bicho veio (carne)
  qc?: number; // v7.7: carne assada: a qualidade (tier) da carne crua que foi para o fogo (CARNE_CRUA_Q)
  st?: string; // tipo de pedra semipreciosa (chave de STONES)
  stage?: number; // estágio da gema (1–5)
  pv?: number; // variante do desenho da pedra/minério (stoneDecor)
  gv?: number; // variante do desenho da gema (0 = a comum)
  gem?: string; // tipo de gema (chave de GEMS)
  _msh?: number; // forma da carne já ajustada (2)
  _w25?: number; // já avisou que está gasto (1)
  _loot?: LootChao; // o saque no chão de onde o item veio (dungeon.loot)
  _pb?: number; // cache de packBaseOf
  insp?: number; // pedras da pilha já examinadas (inspectStone)
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  _dk?: number;
  cv?: number;
  wv?: number;
  /** v8.1 — aparência associada à peça de roupa; persistida no save. */
  visualRoupa?: "aventureira" | "deserto" | "patrulheira" | "placa";
}

/** Grade de inventário: mochila do herói (24×15), baú (econ.stash), chão da expedição (dungeon.gInv). */
export interface InvGrid {
  cols: number;
  rows: number;
  items: Item[];
  ground?: boolean;
  // aljava (Mochila 02, qvInv)
  qv?: boolean;
  hero?: Hero;
  auto?: boolean; // layout automático antigo (qvMigrate troca pela grade livre)
  fixed?: CasaFixa[]; // peças desenhadas sem ser itens (renderInvGrid)
  saddle?: boolean; // alforjes do tamanduá (mountBag)
  mochila?: boolean; // v7.7: a grade de uma mochila de herói (items/mochilas.ts): mochila fechada não entra nela
  bolsa?: boolean; // v7.7: a grade de uma bolsa presa no cinto (items/cinto.ts): mochila, aljava, cinto e bolsa não entram
  infinito?: boolean; // v7.7: o baú do acampamento: cresce sozinho (bauFolga) e aparece como lista (items/bau_infinito.ts)
  over?: unknown; // campo antigo, apagado por qvMigrate
}

/** Peça fixa de uma grade (InvGrid.fixed). */
interface CasaFixa extends Ponto {
  shape: number[][];
  color: string;
  title: string;
  emoji: string;
  count?: number;
}

/* ---------- seres do mapa ---------- */

/** Bicho da simulação do mapa (world.animals; spawnAnimal). */
export interface Animal {
  id: string;
  species: string;
  sex: "M" | "F";
  birthTick: number;
  x: number;
  y: number;
  dir: number;
  vx: number;
  vy: number;
  genes: Genes;
  sizeMult: number;
  weightMult: number;
  speedMult: number;
  strengthMult: number;
  parents: string[] | null;
  hunger: number;
  thirst: number;
  energy: number;
  health: number;
  state: string;
  stateTimer: number;
  target: Ponto | null;
  targetEntity: AlvoBicho | null; // planta, presa ou carcaça, conforme o estado
  reproCooldown: number;
  starveTimer: number;
  dehydrateTimer: number;
  trail: Ponto[];
  alive: boolean;
  causeOfDeath: string | null;
  carcass?: Carcaca | null;
  deathTick?: number;
  runic?: string; // elemento da runa que o transformou (RUNE_EL)
  _perigoAte?: number; // v8.1: até esse world.tick este bicho rúnico não dispara outro perigo (map/perigo.ts)
  nav?: CaminhoNav | null;
  ign?: Map<Ponto, number> | null; // alvos ignorados até o tick dado (ignoreEntity)
  navActive?: boolean;
  navBlocked?: boolean;
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  fleeJitter?: number;
  _navC?: number;
  _navT?: number;
  _thirstSpot?: Ponto | null;
  _sz?: number; // raio desenhado no último quadro (drawAnimalBase)
}

/** Bicho selvagem fora da simulação principal (world.wild; addWild: javalis, aves…). */
export interface Wild {
  id: string;
  species: string;
  sex: "M" | "F";
  x: number;
  y: number;
  dir: number;
  alive: boolean;
  state: string;
  t: number;
  hunger: number;
  // addWild (o único que cria um Wild) sempre põe coat, energy, thirst e hp
  coat: number;
  energy: number;
  thirst: number;
  hp: number;
  cool?: number;
  dead?: number; // tick em que morreu (o corpo some 60 min depois)
  flock?: number; // id do bando (patos)
  home?: Ponto;
  fx?: number;
  fy?: number;
  landing?: boolean;
  prey?: Animal | Wild | null; // presa da águia/raposa (prey, duckNear)
  tgt?: Ponto | null;
  vr?: number;
  wp?: Ponto | null;
}

/** Moita/planta (world.veg). */
export interface Planta {
  id?: string; // as plantas semeadas (seedVegetation) não têm
  x: number;
  y: number;
  kind: string;
  growth: number;
}

/** Carcaça deixada por um bicho morto (world.carcasses). */
export interface Carcaca {
  x: number;
  y: number;
  amount: number;
  max: number;
  born: number;
  color: string;
  dir: number;
  r: number;
}

/** Recurso do mapa: árvore, pedra, minério (world.nodes; addNode). */
export interface NoRecurso {
  id: string;
  kind: string;
  size: string; // small | medium | large (árvore)
  x: number;
  y: number;
  alive: boolean;
  readyAt: number;
}

/** Durabilidade de uma árvore ou pedra do campo aberto, guardada pelo id preso às coordenadas do mundo. */
interface EstadoRecursoCampo {
  hp: number;
  maxHp: number;
  golpeEm?: number; // v8.1: Date.now() do último golpe (a barrinha de vida aparece por um tempo)
  quebrado?: boolean;
  etapa?: "arvore" | "toco" | "broto" | "muda" | "tronco" | "lascado";
  crescimento?: "toco" | "broto" | "muda";
  qualidade?: "laranja" | "amarelo" | "verde" | "forte";
  madeiraRecolhida?: boolean;
  sementeAte?: number;
  galhos?: number;
  bloco?: string;
  quedaInicioMs?: number;
  quedaAteMs?: number;
  quedaDirecao?: number;
}

/** Recurso quebrável do cenário 3D, exposto enquanto o bloco está carregado. */
export interface RecursoCampo {
  id: string;
  bloco: string;
  tipo: "arvore" | "pedra";
  x: number;
  z: number;
  porte: string;
  raio: number;
  maxHp: number;
}

/** Tamanduá do mapa (world.anteaters; x/y aparecem quando ele anda). */
export interface Tamandua {
  id: string;
  hx: number;
  hy: number;
  seed: number;
  r: number;
  coat: string; // chave de TCOATS ("selvagem"…)
  x?: number;
  y?: number;
}

/** Cupinzeiro do mapa (world.termites; termiteSeed). */
export interface Cupinzeiro extends Ponto {
  s: number; // tamanho
  k: number; // semente do desenho
  cupDay?: number; // dia em que a montaria raspou (mountDay)
}

interface Evento {
  tick: number;
  text: string;
}

/* ---------- mundo ---------- */

export interface World {
  img: HTMLImageElement | null;
  waterGrid: Set<string> | null;
  waterPoints: Ponto[];
  waterGridStep: number;
  veg: Planta[];
  animals: Animal[];
  carcasses: Carcaca[];
  nextId: number;
  tick: number;
  events: Evento[];
  statsHistory: Record<string, number[]>;
  spLog: RegistroEspecie[];
  spTotals: Record<string, TotaisEspecie>;
  counters: { births: number; deaths: number; hunts: number };
  paused: boolean;
  speedMult: number;
  fastForwardTarget: number;
  heroes: Hero[];
  // acrescentados depois da carga
  wild?: Wild[];
  nodes?: NoRecurso[];
  recursosCampo?: Record<string, EstadoRecursoCampo>;
  anteaters?: Tamandua[];
  termites?: Cupinzeiro[];
  runes?: Runa[];
  qstore?: Record<string, QuadranteSalvo>;
  activeQ?: string | null;
  qver?: number;
  navBudget?: number;
  _boarOk?: number;
  _br?: Record<string, number>; // minutos desde a última cria, por espécie (wildBreed)
  _imm?: number;
  _wa?: number;
  _rnK?: number;
  _rnT?: number;
}

/* ---------- economia ---------- */

/** v7.7 — campanha (vai no save dentro do econ): a missão atual (chave de MISSOES, null = fim do conteúdo pronto),
 *  as concluídas (id → world.tick) e marcas livres que as missões e falas usam. */
export interface EstadoCampanha {
  etapa: string | null;
  /** v8.0 — a missão da linha paralela (os lobos); undefined = ainda não abriu, null = acabou */
  paralela?: string | null;
  feitas: Record<string, number>;
  flags: Record<string, number | string | boolean>;
}
/** v7.7 — um lobo no cercado do acampamento (campanha/lobos.ts, docs/campanha.md C2). */
/** v7.7 — o que faz de um lobo capturado o mesmo bicho do campo (campanha/lobos.ts): não aparece na tela, mas fica
    guardado para a genética de pelagens que vem depois. */
interface FichaLobo {
  id: string; // identidade do bicho (gerada na captura)
  escala: number; // tamanho (Monster.big, ou o padrão 0,95)
  hpMax: number;
  folMax: number;
  spd: number;
}
export interface LoboCercado {
  sexo: "M" | "F";
  pelagem: number; // Monster.coat
  ficha?: FichaLobo; // v7.7: o mesmo bicho que foi capturado (os lobos de antes não têm)
  vinculo: number; // 0..4
  dono: "cacador" | "jogador";
  desde: number; // world.tick da captura
  pontos?: number; // v7.7: pontos de vínculo (campanha/cercado.ts, VINCULO.niveis)
  diaCacador?: number; // último dia em que o Caçador tratou (conta os dias que passaram)
  comeuDia?: number; // último dia em que comeu da mão do jogador
  afagoDia?: number; // v7.7: último dia em que o afago deu vínculo (menu do lobo, campanha/cercado.ts)
  filhote?: boolean; // v7.7: o filhote do casal (nasceu no cercado; `desde` = quando nasceu)
  prazo?: number; // v7.7: no filhote, até quando (world.tick) os pais precisam ser soltos
  paisSoltosEm?: number; // v7.7: no filhote, quando os pais foram soltos (depois disso ele sai pelo acampamento)
  comHeroi?: string; // v7.7: id da heroína que o leva pelo mapa (saiu do campo na corda); chega ao cercado com ela
  semPais?: boolean; // v7.7 (5b): no filhote, os pais foram soltos a tempo (cresce longe deles: pode virar pet)
  cresceuLobo?: boolean; // v7.7 (5b): no filhote, passou o prazo com os pais lá: cresceu lobo (não vira pet)
  teveFilhote?: boolean; // v7.7 (5b): na sua loba, já teve o filhote (um por mãe)
}
/** v7.7 — um pedido de carne do Caçador para os lobos dele (campanha/pedidos.ts). */
export interface PedidoCarne {
  an: string; // de que bicho (Item.an)
  n: number;
  q: number; // qualidade mínima (índice em TIERS; na assada, a da carne crua: Item.qc)
  assada: boolean;
  anunciado: boolean; // o Caçador já falou (antes disso ele chama com o ❗)
}

export interface Econ {
  gold: number;
  horses: number;
  wagons: number;
  test: boolean;
  stash: InvGrid;
  chestLv: number;
  // acrescentados depois da carga
  quiver: Aljava; // posta na carga (iniciarFaunaRecursosCrafting), antes de qualquer leitura
  arrowStock?: number;
  mount?: Montaria | null;
  armasKit?: number;
  caixas?: number;
  campanha?: EstadoCampanha; // v7.7: missão atual da campanha (campanha/campanha.ts)
  /** v8.3: células do mapa já exploradas (map/explorar.ts: chave (cy+5000)*10000+(cx+5000)) */
  explorado?: number[];
  /** v8.3: o caderno do cartógrafo (map/caderno.ts): o texto das anotações e o desenho (PNG em data URL) */
  caderno?: { notas: string; desenho: string };
  /** v8.3: armadilhas já disparadas (map/armadilhas.ts, mesma chave de explorar.ts) e os pontos marcados no minimapa */
  armadilhasDisparadas?: number[];
  marcasMapa?: number[][];
  lobos?: LoboCercado[]; // v7.7: os lobos do cercado (campanha/lobos.ts)
  lobosFugidos?: { L: LoboCercado; volta: number }[]; // v7.7: lobos do Caçador que fugiram pela porteira (voltam)
  pedido?: PedidoCarne | null; // v7.7: o pedido de carne do Caçador em aberto (campanha/pedidos.ts)
  pedidoProx?: number; // v7.7: o dia em que pode vir o próximo pedido
  campTut?: number; // tutorial do acampamento: 1 a fazer, 2 em curso, 3 feito
  clues?: Record<string, Pista>;
  cupim?: number;
  fireLv?: number;
  forgeXp?: number;
  hintRuns?: number;
  dicas?: Record<string, number>; // v7.7: dicas do quadradinho já concluídas (ui/dicas.ts)
  hunterCamp?: boolean;
  hunterNap?: boolean;
  hunterTip?: number;
  introDone?: boolean;
  mapas?: number;
  mesa?: boolean;
  musgoVisto?: number;
  noWear?: boolean;
  recipes?: Record<string, number>;
  tent?: boolean;
  weaponLore?: boolean;
  _introKeep?: number;
  _ropeGift?: number;
  _ferramentas?: number; // v8.1: o machado e a picareta já foram dados (launchDungeon)
  _bandidosNoite?: number; // v8.1: a última noite em que os bandidos vieram (map/perigo.ts)
}

/* ---------- expedição ("dungeon": o modo campo) ---------- */

/** Monstro do campo (dungeon.monsters): lobos (spawnDungeonMonster), bonecos do treino, bichos e javalis do campo. */
export interface Monster {
  name: string;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  alive: boolean;
  st: string;
  t: number;
  target?: Ponto | null;
  tgt?: Ponto | null; // destino do passeio (bichos do campo)
  sp?: string; // espécie (bichos do campo)
  prof?: string; // perfil de dano (chave de DANO.PERFIS)
  sex?: string;
  boss?: boolean;
  wu?: number;
  dm?: number;
  spd?: number;
  ang?: number;
  atk?: string;
  pcd?: number;
  coat?: number;
  kind?: string;
  model?: string;
  critter?: boolean;
  humano?: boolean; // combatente humano: ativa as regras de adrenalina, CC e finalização humana
  humanoCC?: boolean; // este golpe humano aplica controle de grupo ao jogador
  humanoAtaques?: number; // ciclo de golpes do parceiro de treino (alternância leve/pesado)
  humanoLado?: number; // sentido do passo lateral do sparring
  humanoFolego?: number; // stamina própria do parceiro (0..100)
  humanoArma?: "melee" | "bow";
  humanoEscudo?: boolean;
  humanoPersonalidade?: "agressivo" | "calculista" | "acrobata";
  humanoTrocaT?: number;
  humanoTrocaCd?: number;
  humanoEsquivaT?: number;
  humanoEsquivaCd?: number;
  humanoEsquivaX?: number;
  humanoEsquivaY?: number;
  humanoInvuln?: number;
  humanoGuardT?: number;
  humanoRolando?: boolean;
  humanoCorrendo?: boolean;
  humanoGolpeT?: number;
  humanoPassoGolpe?: number;
  humanoSoltarT?: number;
  humanoAtingidoT?: number;
  corpoCaido?: number[]; // v8.1: humano caído — [x, z] dos pés e [x, z] da cabeça do corpo deitado (render/gl/bandidos_gl.ts)
  humanoBloqueouT?: number;
  // v8.1 — bandidos (field/bandidos.ts)
  bandido?: string; // o tipo (BANDIDOS)
  grupo?: number; // o bando
  bVez?: boolean; // tem a vez de atacar de perto
  bEspera?: number; // s desde o último ataque (a vez vai para quem espera mais)
  bFoge?: boolean;
  bAteMorte?: boolean;
  bPoupado?: boolean;
  bViu?: { k: string; t: number; reag: number; feito: boolean } | null; // a ameaça que ele viu e quando reage
  bStrafe?: number; // s andando de lado (saindo da sua mira)
  bGuardaCd?: number;
  bSujo?: boolean; // o golpe sujo do poupado que traiu
  bPasso?: number; // o passo do combo do golpe atual (0, 1, 2)
  quebraGuarda?: boolean; // o golpe que está saindo quebra o escudo levantado (wolfStrike)
  dummy?: boolean;
  neutral?: boolean;
  intro?: boolean;
  big?: number; // escala do javali grande da cena inicial
  runic?: string; // elemento da runa (RUNE_EL)
  alerted?: boolean;
  nt?: number;
  bleed?: Sangria | null;
  cripple?: number;
  bound?: Amarra | null;
  ko?: number;
  scared?: number;
  fol?: number;
  folMax?: number;
  folT?: number;
  downT?: number;
  flash?: number;
  fleeT?: number;
  hit?: boolean; // o bote já acertou
  kx?: number;
  ky?: number;
  low?: "frenzy" | "flee"; // o que faz com pouca vida (acertos: hurtMonster)
  lowSet?: boolean;
  lpr?: Aparo | null; // o aparo que valia quando o bote saiu (wolfStrike)
  recO?: number; // tempo de recuperação dado pelo golpe (wolfStrike)
  moving?: boolean;
  parry?: Aparo | null;
  wuTot?: number;
  cx0?: number;
  cy0?: number;
  _yaw?: number;
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  _gx?: number;
  _gy?: number;
  _ph?: number;
  cmt?: number;
  comendo?: number;
  refeicao?: LootChao[]; // v8.0: as carnes da presa que o lobo neutro ainda vai comer
  mordida?: LootChao | null; // v8.0: a carne que ele está comendo agora
  crav?: boolean; // tem uma arma cravada (dungeon.crav)
  ferido?: number;
  folLost?: number;
  folRes?: number; // v7.7: reserva do fôlego interno (0..1) gasta no cabo de guerra do laço (folTeto)
  quebrasFolego?: number; // esgotamentos externos, separados das quedas
  protecaoFolego?: number; // tempo para reagir depois de levantar
  fugaFolego?: number; // último esforço antes do colapso
  exaustoFolego?: boolean; // já chegou ao esgotamento interno total
  quedas?: number; // número de quedas; em estados antigos serve de base para migrar o desgaste
  koMax?: number; // v7.7: duração da queda atual (o círculo de dentro esvazia até levantar)
  fugir?: boolean;
  hitAng?: number;
  hitT?: number;
  hop?: number;
  howled?: number | boolean;
  l0?: number;
  life?: number; // fantasma do lobo morto (glWolf ghost): vida e duração
  locked?: number | boolean;
  lp?: number;
  lt?: number;
  lx?: number;
  ly?: number;
  max?: number;
  mt?: number;
  orb?: number;
  pref?: number;
  presa?: Monster | null;
  cacada?: boolean; // v7.7: a presa da caçada (map/cacada.ts)
  cacFuga?: boolean; // v7.7: o tempo da caçada acabou: corre para a borda
  fugiu?: boolean; // v7.7: saiu pela borda (não morreu)
  espreita?: number; // v8.1: lobo que segue a heroína a esta distância (px do campo), sem atacar (intro/caminhada.ts)
  visualBicho?: boolean; // v8.1: luta como lobo, desenhado com o modelo do bicho de `sp` (o chefe rúnico, map/perigo.ts)
  bInvest?: number; // v8.2: s que o bandido ainda avança na investida (field/bandidos.ts)
  bCombo?: number; // v8.2: quantos golpes ele já emendou no combo
  posto?: { x: number; y: number } | null; // v8.2: aonde o javali vai para ter a linha livre até ela (creatures/javali.ts)
  rodeio?: number; // v8.1: para que lado o javali rodeia a heroína (1 ou −1; troca quando um tronco barra)
  desespero?: number; // v8.1: s que faltam do fôlego de desespero depois de levantar (FOLEGO.desespero)
  feroz?: number; // v8.1: o dano (dm) de antes da fúria do desespero, para devolver
  bichoMapa?: Animal | Wild; // v8.0: o mesmo bicho no mapa (campo aberto; map/mundo.ts); v8.1: a raposa é Wild
  _sangue?: Ponto; // v8.0: onde caiu a última gota de sangue dele (field/rastro.ts)
  nivel?: string; // v8.0: lobo do campo aberto: "jovem" | "adulto" | "veterano" (data/combate.ts LOBO_NIVEL)
  retreat?: number;
  slow?: number;
  slowMax?: number;
  slowShown?: number;
  stun?: number;
  stunMax?: number;
  wob?: number;
  wobA?: number;
  _hd?: number;
  _yy?: number;
  bcd?: number;
  investidasErradas?: number;
  acalmarT?: number;
  cravCd?: number;
  crippleMax?: number;
  fury?: number;
  stk?: CravadoNoBicho[];
  stunImm?: number;
  calmT?: number;
  ct?: number;
  fa?: number;
  maxHp?: number;
  trail?: number;
}

/** Número ou texto flutuante no campo (dungeon.toasts; spawnDungeonToast e os números de dano). */
export interface AvisoCampo {
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  size?: number; // os números de dano usam `base` no lugar
  icon?: boolean;
  dmg?: boolean;
  vx?: number;
  age?: number;
  font?: string;
  crit?: boolean;
  dot?: boolean;
  base?: number;
  bump?: number;
  t0?: number;
  tg?: Monster | null; // o bicho do número de dano (junta os acertos seguidos)
  val?: number;
  _src?: string; // o texto do aviso (não repete no mesmo lugar)
  _sx?: number;
  _sy?: number;
}

/** Faixa de aviso no alto do campo (setBanner). */
interface Faixa {
  text: string;
  sub: string;
  t: number;
  max: number;
  col: string;
}

/** O modo campo. setupDungeon monta a maior parte dos campos a cada entrada; as listas de efeitos são de desenho. */
export interface Dungeon {
  active: boolean;
  hero: Hero | null;
  cols: number;
  rows: number;
  tile: number;
  k: number;
  mode: string;
  flow: string;
  wave: number;
  sess: number;
  px: number;
  py: number;
  moveTarget: Ponto | null;
  alvoAutomatico?: Monster | null;
  autoCd?: number; // s até o próximo básico automático (ATAQUE_AUTO)
  tiroAuto?: boolean; // a corda puxada agora é o básico do arco (ARCO_BASICO): mira no alvo e solta sozinha
  _pararPuxada?: (() => void) | null; // corta o som da corda se a puxada do básico acaba antes
  especialPressionado?: boolean;
  hp: number;
  hpMax: number;
  monsters: Monster[];
  toasts: AvisoCampo[];
  combatInterval: ReturnType<typeof setInterval> | null;
  entrance: Ponto;
  // onde a expedição está
  camp?: boolean;
  training?: boolean;
  vila?: boolean; // v8.0: a Vila Musgo andável (map/vila_cena.ts)
  mount?: MontariaCampo | null;
  // herói no campo
  weapon?: string;
  wound?: number;
  dead?: boolean;
  down?: number;
  derrubada?: number; // v8.1: a duração da derrubada animada em curso (javali; 0 = a queda de agora não é animada)
  derrubadaDe?: number; // v8.1: de onde veio o golpe (rad, da heroína para o javali): ela cai de costas para longe dele
  dazed?: number;
  invuln?: number;
  running?: boolean;
  runLock?: boolean;
  boost?: number;
  gstam?: number;
  fatorCorrida?: number; // velocidade suavizada pela reserva interna
  gint?: number; // v7.7: fôlego interno do jogador (FOL_HEROI; v8.0: não é mais o teto do gstam)
  _cansadoAvisado?: boolean; // já tocou o aviso ao chegar à faixa vermelha de fôlego
  combateHumanoT?: number; // janela recente de combate humano (adrenalina)
  debilitadoT?: number; // duração restante do estado debilitado
  debilitadoN?: number; // episódios de exaustão na janela
  debilitadoJanela?: number;
  exaustaoArmada?: boolean; // evita contar a mesma exaustão a cada quadro
  _blqEm?: number; // v7.7: quando o escudo segurou o último golpe (performance.now)
  _zerouInt?: boolean; // v8.0: o interno está zerado (a queda do fôlego de fora conta uma vez por zerada)
  _quedaInt?: boolean; // marcador legado de queda externa pela interna (mantido na inicialização)
  gregen?: number;
  folArco?: number; // v8.0: fôlego interno gasto segurando o arco cheio, que volta mais rápido (ARCO_FOL)
  sinceHurt?: number;
  hotLeft?: number;
  hotT?: number;
  resT?: number;
  campoT?: number;
  pegadas?: { x: number; y: number; a: number; t: number; lida?: boolean }[]; // v8.0: o rastro da presa (field/rastro.ts)
  fezes?: { x: number; y: number }[]; // v8.0: fezes da presa que revelam o rastro (field/rastro.ts)
  sangue?: { x: number; y: number; a: number; t: number }[]; // v8.0: gotas de sangue de bicho ferido (field/rastro.ts)
  expT?: number;
  full?: number;
  herbCd?: number;
  // ataque e defesa
  target?: Monster | null; // alvo prioritário (laranja): o do combate, o do HUD e do fôlego do bicho
  foco?: Monster | null; // v7.7: foco (branco): só dá a direção precisa do golpe/tiro (Alt + clique)
  cd?: number;
  cdMax?: number;
  kcd?: number;
  charge?: number;
  charging?: boolean;
  combo?: number;
  comboT?: number;
  lastStep?: number;
  lastStepAt?: number;
  slash?: Golpe | null;
  guard?: boolean;
  guardBroken?: number;
  parryArc?: ArcoAparo | null;
  parryCd?: number;
  parryMax?: number;
  parryVis?: number;
  parryT?: number | null; // v8.0: s desde o clique do parry; null = janela fechada (data/combate.ts PARRY)
  parryN?: number; // v8.0: quantos golpes o parry perfeito pegou nesta janela
  lenta?: { k: number; ate: number } | null; // v8.0: câmera lenta curta (parry perfeito, esquiva no último instante)
  _parryEm?: number; // v8.0: performance.now() do último parry perfeito (animação)
  riposte?: number;
  dodge?: Esquiva | null;
  dodgeCd?: number;
  dodgeGuard?: number;
  rollGuard?: number;
  rollHit?: number;
  gingaGuard?: number; // v7.7: janela da ginga (GINGA) em que o golpe passa direto
  camLenta?: number; // v8.0: câmera lenta do campo (multiplica o tempo do quadro; ausente = 1)
  origem?: Ponto | null; // v8.0: o canto do pedaço do mapa que este campo mostra (map/mundo.ts); null = arena solta
  recursosCampo?: RecursoCampo[];
  recursosCampoSujo?: string[];
  golpeMachado?: {
    impactoAplicado?: boolean;
    angulo?: number;
    t: number;
    carga: number;
    qualidade?: "laranja" | "amarelo" | "verde" | "forte";
    recursoId?: string;
    recursoTipo?: "arvore" | "tronco" | "pedra"; // v8.1: a picareta trava numa pedra
  } | null;
  _gingaLado?: boolean; // v7.7: lado da próxima ginga parada
  noAtk?: number;
  inShot?: boolean;
  quickShot?: number;
  shotT?: number;
  shove?: number;
  pinged?: boolean;
  crav?: Cravando | null;
  finish?: Finalizacao | null;
  hv?: GolpePesado | null;
  spCh?: CargaLanca | null;
  spearOut?: Item | null;
  rope?: LacoVoando | null;
  ropeHold?: boolean;
  near?: LootChao | null;
  // entrada
  keys?: Record<string, boolean>;
  mouse?: Ponto | null;
  mouseC?: { clientX: number; clientY: number } | null;
  joy?: Joystick | null;
  // janelas abertas por cima do campo
  invOpen?: boolean;
  craftOpen?: boolean;
  modalOpen?: boolean;
  gInv?: InvGrid | null;
  // efeitos e listas desenhadas
  banner?: Faixa | null;
  shake?: number;
  shakeAmp?: number;
  hitStop?: number;
  hurtFlash?: number;
  hurtVig?: number;
  hpTrail?: number | null;
  hpBarShake?: number;
  bowFlash?: number;
  swFlash?: number;
  pcFlash?: number;
  revealT?: number;
  flowT?: number;
  pkx?: number;
  pky?: number;
  lootWarn?: boolean;
  lowWarned?: boolean;
  arrows?: Flecha[];
  birds?: AveCampo[];
  birdQ?: number[]; // segundos até cada pássaro voltar
  bushes?: Moita[];
  cuts?: Corte[];
  fires?: FogoCampo[];
  fx?: Respingo[];
  ghosts?: FantasmaLobo[];
  hitDirs?: DirecaoGolpe[];
  loot?: LootChao[];
  parts?: Particula[];
  rings?: Anel[];
  runes?: Runa[];
  sparks?: Centelha[];
  spears?: LancaCampo[];
  // marcas internas (tempos, últimos acertos)
  _campUi?: "ana" | "carp" | null;
  _dmgCrit?: boolean;
  _dmgDot?: boolean;
  _dmgSide?: number;
  _dmgTgt?: Monster | null;
  _frT?: number;
  _lastCrit?: boolean;
  _moita?: Moita | null;
  _noKnT?: number;
  _noShT?: number;
  _noWpnT?: number;
  _realDt?: number;
  _rideT?: number;
  _rnHurt?: number;
  _spearWarn?: number;
  // acrescentados na 5.3 (apareceram ao tipar os parâmetros)
  _stA?: number;
}

/* ---------- save ---------- */

/** O que saveBlob grava no localStorage (JSON). */
export interface SaveData {
  v: number;
  K: number;
  ver: string;
  at: number;
  world: Partial<World>;
  econ: Econ;
  cam: { scale: number; tx: number; ty: number } | null;
}

/** Resumo de um espaço de save (saveMeta), mostrado na lista de saves. */
export interface SaveMeta {
  at: number;
  day: number;
  time: string;
  heroes: string[];
  gold: number;
  ver: string;
}

/* ---------- WebGL ---------- */

/** Malha enviada à placa (glMesh): o VAO e o número de vértices. `ol` liga o contorno; `uid`/`stat` são do cache de malhas estáticas. */
export interface GLMesh {
  vao: WebGLVertexArrayObject;
  n: number;
  ol?: boolean;
  uid?: number;
  stat?: boolean;
  bufs?: WebGLBuffer[]; // v8.0: os buffers da malha (glFree apaga junto)
  tex?: WebGLTexture; // v8.0: textura de cor (só os prédios da vila; a cor do vértice multiplica)
  relevo?: boolean; // v8.0: já está na altura do chão do campo aberto (erguerNoRelevo não sobe; a lâmina d'água)
}

/** Malha em construção (MB: posições, normais, cores, 3 números por vértice) antes de glMesh. */
export interface MalhaCrua {
  p: number[];
  n: number[];
  c: number[];
}

/* ---------- formas auxiliares (5.3) ---------- */

/** Uma grade de inventário em tela (INV.invGrids): o elemento e a grade de itens que ele mostra. */
export interface GradeTela {
  el: HTMLElement;
  inv: InvGrid;
  discard?: boolean;
}

/** Grade espacial dos bichos do mapa (buildSpatialGrid): "cx,cy" → bichos na célula. */
export type GradeEspacial = Map<number, Animal[]>; // célula (chave numérica, sim/grade.ts) → bichos

/** Preço de uma viagem/serviço (costText, canPay, payCost): carne, ouro e itens do baú. */
export interface Custo {
  meat: number;
  gold: number;
  items: Record<string, number>;
}

/* ---------- sub-objetos que eram `any` (5.5) ---------- */

/** Alvo do herói no mapa: o bicho que ele caça ou o nó de recurso que coleta. */
type AlvoHeroi = Animal | Wild | NoRecurso;

/** Alvo de um bicho do mapa: a planta (herbívoro), a presa ou a carcaça que vai comer. */
type AlvoBicho = Planta | Animal | Carcaca;

/** Um gene sorteado de GENE_POOLS (porte, velocidade, força, marca). */
interface Gene {
  name: string;
  sizeMult?: number;
  weightMult?: number;
  mult?: number;
}

/** Os genes de um bicho do mapa (randomGenes, inheritGenes). `coat` é o índice da pelagem. */
export interface Genes {
  size: Gene & { sizeMult: number; weightMult: number };
  speed: Gene & { mult: number };
  strength: Gene & { mult: number };
  flavor: Gene;
  coat: number;
  [slot: string]: Gene | number; // lidos pelo nome do slot (GENE_SLOTS)
}

/** Quem anda pelo mapa com moveStep/getPath: um bicho ou um herói. Os campos de um só deles são opcionais aqui; o código
 *  testa antes de usar (`a.camp && …`, `a.species && …`, navIsHero). */
export interface Andante extends Ponto {
  id: string;
  dir: number;
  state: string;
  energy: number;
  nav?: CaminhoNav | null;
  navActive?: boolean;
  navBlocked?: boolean;
  species?: string; // só bicho
  camp?: Ponto; // só herói
  trip?: Viagem | null; // só herói
}

/** Caminho calculado pelo A* do mapa (getPath), guardado no bicho/herói até mudar o destino. */
export interface CaminhoNav {
  gx: number;
  gy: number;
  pts: Ponto[];
  i: number;
  t: number;
  ok: boolean;
  len: number;
  lim: number;
}

/** Nascimento ou morte registrado por espécie (world.spLog; análise de habitat). */
interface RegistroEspecie {
  t: number;
  sp: string;
  type: string; // "birth" | "death"
  cause: string | null;
}

/** Totais acumulados de uma espécie (world.spTotals). */
interface TotaisEspecie {
  births: number;
  deaths: number;
  immigrants: number;
  causes: Record<string, number>;
}

/** Um quadrante do mapa guardado quando o jogador sai dele (QUAD.store, world.qstore). */
export interface QuadranteSalvo {
  tick: number;
  animals: Animal[];
  carcasses: Carcaca[];
  wild: Wild[];
  nodes: NoRecurso[];
  statsHistory: Record<string, number[]>;
  spLog: RegistroEspecie[];
  spTotals: Record<string, TotaisEspecie>;
}

/** Runa Natural: no mapa (world.runes; runeNew) ou no chão do campo (dungeon.runes; runeSeedDungeon). */
export interface Runa extends Ponto {
  id: string;
  el: string; // elemento (RUNE_EL)
  seed: number;
  str: number; // força que resta (gasta ao transformar bichos)
  born?: number; // tick em que surgiu (mapa)
  R?: number; // raio no campo
  _m?: { patch: GLMesh; glyph: GLMesh }; // malhas do desenho no campo (runeBuildMeshes)
  absorbed?: boolean;
  byAnimal?: boolean;
  lastBeast?: string;
}

/** A aljava (econ.quiver): o modelo (chave de QUIVERS) e as flechas dentro. */
interface Aljava {
  type: string;
  n: number;
}

/** O tamanduá domado (econ.mount; mnt()). */
export interface Montaria {
  name: string;
  xp: number;
  hp: number;
  sta: number;
  with: string | null; // id do herói que o leva na expedição
  since: number;
  brushDay: number;
  feedDay: number;
  bag: InvGrid | null; // alforjes (mountBag)
  coat: string; // chave de TCOATS
  dirt: number;
  _dd?: number; // dia da última conta de sujeira
}

/** O que a mesa de análise já descobriu de uma planta da forja (econ.clues; clueOf). */
interface Pista {
  mats: Record<string, number>; // 1 = já sabe que leva esse material
  qty: Record<string, number>; // 1 = já sabe quanto leva
  kind: boolean;
  dur: boolean;
  n: number;
}

/** Sangramento de um bicho do campo (applyBleed): o que resta, por segundo, e o relógio do próximo tique. */
interface Sangria {
  rem: number;
  u: number;
  i: number;
  t: number;
  n?: number; // v8.0: quantos cortes acumulados (até DANO.CORTE.pilhas)
}

/** Bicho laçado (ropeFlyTick → Monster.bound): fuga acumulada, tempo e comprimento da corda. */
interface Amarra {
  t: number;
  len: number;
  tire: number;
  _ok?: boolean;
  dom?: boolean; // dominado: não foge mais (caído ou domado, ver fase)
  fase?: "caido" | "domado"; // v7.7: caído = deitado, vem arrastado · domado = de pé, segue andando
  caiT?: number; // v7.7: segundos caído até levantar domado
  segura?: number; // v7.7: segundos segurando G apertado com ele dominado (LACO.soltar solta a corda)
  teima?: number; // v7.7: domado, segundos até desistir de fugir (DOMA.teima); 0 = desistiu (não dá mais pinote)
  pinotes?: number; // v7.7: quantos pinotes deu nesta corda
  pull?: number;
  lastP?: number; // quando foi o último puxão (lacoPuxao)
  wa?: number; // balanço do bicho na corda
  deb?: number; // segundos até o próximo safanão
}

/** Resultado do aparo contra um golpe que está vindo (Monster.parry). */
export interface Aparo {
  kind: string; // "near" | "weak"
  late?: boolean; // a fatia do aparo ainda estava na tela (conta como parcial)
}

/** Arma cravada num bicho que sangra aos poucos (Monster.stk; stickAdd). */
export interface CravadoNoBicho {
  k: string; // chave de DANO.CRAVAR
  n: number; // tiques que faltam
  t: number;
  vida: number;
  fol: number;
  a: number; // ângulo em relação ao bicho (desenho)
  sangra?: number; // v8.1: pontos de sangramento que faltam (cada queda abre a ferida: DANO.CRAVAR[k].sangraQueda)
}

/** O tamanduá no campo (dungeon.mount), montado ou andando por perto. */
interface MontariaCampo extends Ponto {
  ang: number;
  mounted: boolean;
  st: string;
  ph: number;
  mv: number;
  flee: number;
  hp: number;
  goal?: Ponto | null; // para onde está fuçando
  att?: number; // segundos esperando perto do herói
  sniff?: number;
  forage?: number;
}

/** Arco de um golpe corpo a corpo (dungeon.slash): desenhado e lido pelo modelo 3D. */
export interface Golpe {
  ang: number;
  life: number;
  step?: number;
  half?: number;
  reach?: number;
  ox?: number;
  oy?: number;
  thrust?: boolean;
  knife?: boolean;
}

/** De onde e para onde saiu o último aparo (dungeon.parryArc). */
interface ArcoAparo extends Ponto {
  ang: number;
}

/** Rolamento/esquiva com o arco (dungeon.dodge). */
interface Esquiva {
  t: number;
  dur: number;
  dx: number;
  dy: number;
  k: number;
  roll: boolean;
}

/** Arma cravada no bicho, segurada pelo herói (dungeon.crav; cravStart). */
export interface Cravando {
  m: Monster;
  key: string; // chave do item da arma
  f: string; // família (faca, lanca, espada…)
  P: Cravada; // DANO.CRAVAR da família
  t: number;
  max: number;
  stored: number;
  hold: boolean;
  h0: number;
  mon: boolean; // é um monstro (cravada mais curta)
  skill: string;
  sndT?: number;
  dep?: number; // fração da lâmina dentro do corpo (máximo CRAV2.fundo = 18%)
  jab?: number;
  pt?: number; // segundos até o próximo pulso de dano
  jolt?: number;
  wa?: number;
  deb?: number;
}

/** Golpe de misericórdia com a faca (dungeon.finish; finishStart). */
interface Finalizacao {
  m: Monster;
  t: number;
  dur: number;
  ang: number;
  done?: boolean;
  golpe?: boolean; // v8.0: a animação do golpe final já começou (FINALIZAR.pico)
}

/** Golpe pesado sendo carregado (dungeon.hv; hvStart): clava ou machado. */
interface GolpePesado {
  kind: string; // "axe" | "clubL" | "clubR"
  t: number;
  ch: number;
  full: boolean;
  recursoId?: string;
  recursoTipo?: "arvore" | "tronco" | "pedra"; // v8.1: a picareta trava numa pedra
  ponto?: number;
}

/** Arremesso da lança sendo carregado (dungeon.spCh). */
interface CargaLanca {
  t: number;
  ch: number;
  ping?: number; // já tocou o aviso de carga cheia
  // v8.1 — o balanço da mira andando/correndo (LANCA_BALANCO): onde ela estava, a fase, a amplitude atual e o desvio
  x?: number;
  y?: number;
  fase?: number;
  bal?: number;
  desvio?: number;
}

/** O laço no ar (dungeon.rope; ropeThrow). */
interface LacoVoando extends Ponto {
  ang: number;
  dist: number;
  max: number;
}

/** O joystick de toque (dungeon.joy): direção e marcha. */
interface Joystick extends Ponto {
  run: boolean;
  jog: boolean;
  lv: number;
}

/** Flecha em voo no campo (dungeon.arrows). */
export interface Flecha extends Ponto {
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  hits?: Set<Monster>;
  full?: boolean;
  seen?: Set<AveCampo>; // pássaros que já atravessou
}

/** Pássaro do campo (dungeon.birds; spawnBird): pousa, foge e pode ser abatido. */
export interface AveCampo extends Ponto {
  kind: string;
  name: string;
  hp: number;
  hpMax: number;
  alive: boolean;
  st: string;
  t: number;
  tx: number;
  ty: number;
  vr: number;
  pena?: boolean; // já soltou a pena
  // voo (birdTakeoff/birdFly): para onde, a distância, a altura e quanto falta
  fx?: number;
  fy?: number;
  fd?: number;
  alt?: number;
  flyT?: number;
  _yw?: number; // direção desenhada
}

/** Moita do campo (dungeon.bushes; moitaSpawn): esconde o herói. */
interface Moita extends Ponto {
  r: number;
  seed: number;
}

/** Risco de um corte sobre o bicho (dungeon.cuts). */
interface Corte extends Ponto {
  ang: number;
  life: number;
  big: boolean;
}

/** Fogo aceso no chão do campo (dungeon.fires). */
interface FogoCampo extends Ponto {
  t: number;
  max: number;
}

/** Respingo de um acerto (dungeon.fx). */
interface Respingo extends Ponto {
  life: number;
}

/** Fantasma do lobo que acabou de morrer (dungeon.ghosts). */
interface FantasmaLobo extends Ponto {
  coat: number;
  boss: boolean;
  ang: number;
  life: number;
  max: number;
}

/** De que lado veio o último golpe que o herói levou (dungeon.hitDirs). */
interface DirecaoGolpe {
  ang: number;
  life: number;
}

/** Saque no chão do campo (dungeon.loot): vira item ao ser pego; `it` guarda o item original quando já existia. */
export interface LootChao extends Ponto {
  expiraEm?: number; // itens de madeira do campo, em ticks do mundo
  key: string;
  t: number;
  ttl: number; // segundos até sumir (0 = fica)
  ground?: boolean;
  tier?: number;
  an?: string; // de que bicho (carne)
  fin?: boolean; // veio de um bicho finalizado
  n?: number;
  it?: Item;
  runic?: string;
  introMat?: boolean; // material da cena inicial
}

/** Partícula de sangue/poeira (dungeon.parts) e faísca de acerto (dungeon.sparks). */
interface Particula extends Ponto {
  vx: number;
  vy: number;
  t: number;
  life: number;
  col: string;
  r: number;
}
type Centelha = Particula;

/** Anel que se expande no chão (dungeon.rings; addRing). */
interface Anel extends Ponto {
  col: string;
  max: number;
  life: number;
  t: number;
  w: number;
}

/** Lança arremessada (dungeon.spears): voa, crava no bicho ou cai no chão. */
export interface LancaCampo extends Ponto {
  vx: number;
  vy: number;
  life: number;
  it: Item;
  dmg: number;
  fly: boolean;
  ang: number;
  h: number;
  ch: number;
  stuck?: Monster | null; // cravada nesse bicho
  sa?: number; // ângulo em relação ao bicho
  bt?: number;
  st?: number;
}

/** Receita de flecha (RECIPES). */
export interface Receita {
  id: string;
  name: string;
  icon: string;
  mats: Record<string, number>;
  out: string;
  qty: number;
}
