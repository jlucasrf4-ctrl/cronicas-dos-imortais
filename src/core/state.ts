/* ==== Fase 4 — estado compartilhado do jogo ====
   world (mapa, heróis, tempo, de base/01), camera (base/01), dungeon (modo campo/expedição, base/04),
   econ (recursos, aljava, montaria, base/05), GL3 (renderizador WebGL, base/11) e OPT (opções salvas, base/18).
   Todos são objetos const, nunca reatribuídos: quem usa muda as propriedades. As chaves do localStorage e o formato
   continuam os mesmos (saves antigos carregam).
   Fase 5: world/dungeon/econ têm os tipos de core/tipos.ts (os campos que só aparecem depois da carga são opcionais).
   Fase 5.4: os objetos de estado de tela (TELAS, SEL, JANELAS, SOM, CACA, MEMO) têm interfaces `Estado…`. Um campo que
   começa vazio mas é preenchido na carga, antes de qualquer leitura (os canvas, o #viewport, o tamanho do mundo), tem o
   tipo de verdade, e o valor inicial leva `!` (`undefined!`, apagado pelo bundler). Os que ficam vazios de fato são `| null`. */
import { CONFIG } from "./config.ts";
import { lsGet } from "./storage.ts";
import type { World, Dungeon, Econ, Animal, Hero, Planta, Wild, Ponto, GLMesh, Golpe, Runa } from "./tipos.ts";
import type { Vec3 } from "../render/gl/geometria.ts";
import type { ModeloHeroi, glBuildWolfBase } from "../render/gl/modelos.ts";
import type { glBuildBoarBase } from "../creatures/javali.ts";
import type { Cidade } from "../data/economia.ts";
import type { MinijogoDef } from "../data/minigames.ts";
import type { Habitat } from "../ui/painel.ts";

export const world: World = {
  img: null,
  waterGrid: null, // Set de "cx,cy" células de água (grade esparsa)
  waterPoints: [], // lista de {x,y} centros de água, p/ busca de vizinho + mais próximo
  waterGridStep: CONFIG.WATER_SAMPLE_STEP,
  veg: [], // patches de vegetação
  animals: [],
  carcasses: [],
  nextId: 1,
  tick: 0, // minutos simulados desde o início
  events: [],
  statsHistory: { rabbit: [], deer: [], wolf: [], fox: [], duck: [], eagle: [] },
  spLog: [], // registro de nascimentos/mortes por espécie (análise de habitat)
  spTotals: {},
  counters: { births: 0, deaths: 0, hunts: 0 },
  paused: false,
  speedMult: 1,
  fastForwardTarget: 0, // ticks restantes a consumir "instantaneamente"
  heroes: [],
};
interface EstadoCamera {
  scale: number;
  minScale: number;
  maxScale: number;
  tx: number;
  ty: number;
  // acrescentados depois
  zt?: number | null;
  zx?: number;
  zy?: number;
  zanim?: number | boolean;
  zlast?: number | null;
}
export const camera: EstadoCamera = { scale: 1, minScale: 1, maxScale: 10, tx: 0, ty: 0 };
export const dungeon: Dungeon = {
  active: false,
  hero: null,
  cols: 21,
  rows: 13,
  tile: 42,
  k: 1,
  mode: "expedition",
  flow: "warmup",
  wave: 0,
  sess: 0,
  px: 0,
  py: 0,
  moveTarget: null,
  hp: 0,
  hpMax: 0,
  monsters: [],
  toasts: [],
  combatInterval: null,
  entrance: { x: 0, y: 0 },
};
export const econ = {
  gold: 0,
  horses: 0,
  wagons: 0,
  test: false,
  stash: { cols: 24, rows: 18, items: [], infinito: true }, // v7.7: baú infinito (items/bau_infinito.ts)
  chestLv: 0,
} as Omit<Econ, "quiver"> as Econ; // `quiver` entra na carga (iniciarFaunaRecursosCrafting), antes de qualquer leitura
/** Um item da lista de desenho do quadro (glPush). */
export interface ItemDesenhoGL {
  mesh: GLMesh;
  M: Float32Array | number[];
  tint: number[] | null;
  cast: boolean;
  noOl?: boolean;
  olCor?: number[]; // v7.7: cor própria do contorno (itens no chão: branco; o que o E vai pegar: dourado)
  olEsp?: number; // v7.7: multiplica a espessura do contorno
  brilha?: boolean; // v8.0: luz própria (as chamas): não escurece com a noite
}
type UniformesGL = Record<string, WebGLUniformLocation | null>;
/** As duas entradas de GL3.mesh que não são uma malha só: `wolf` (um modelo por pelagem) e `boar`. O índice de
 *  GL3.mesh é GLMesh, então quem as usa lê `(GL3.mesh as unknown as MalhasBichos)`. */
export interface MalhasBichos {
  wolf: ReturnType<typeof glBuildWolfBase>[];
  boar?: ReturnType<typeof glBuildBoarBase>;
}
/** O renderizador WebGL2. Os objetos de GL (cv, gl, programas, fbo, textura) são criados em glInit e só são lidos com
 *  GL3.ok verdadeiro; começam `null!`. */
export interface EstadoGL3 {
  ok: boolean;
  tried: boolean;
  cv: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  sprog: WebGLProgram;
  fbo: WebGLFramebuffer;
  stex: WebGLTexture;
  SM: number; // lado do mapa de sombra
  U: UniformesGL;
  SU: UniformesGL;
  mesh: Record<string, GLMesh>;
  list: ItemDesenhoGL[];
  fogos: number[][]; // v8.0: as fogueiras acesas do quadro ([x, z, força 0..1]; luzFogueira)
  scene: { floor: GLMesh; deco: GLMesh; tex?: GLMesh | null } | null; // tex: v8.0, os prédios texturizados da vila
  sceneKey: string;
  heroKey: string;
  hero: ModeloHeroi | null;
  trail: { b: Vec3; p: Vec3; a: number; fin: boolean }[]; // rastro do golpe
  atk: { step: number; t: number; ang: number; hit: boolean; crav?: boolean } | null;
  lastSl: Golpe | null; // o último dungeon.slash desenhado
  bk: number;
  rel: number;
  wasCh: boolean | undefined;
  fr: number;
  hx: number | null;
  hy: number;
  hph: number;
  hyaw: number;
  // acrescentados depois
  OU?: UniformesGL;
  oprog?: WebGLProgram;
  tprog?: WebGLProgram;
  tvao?: WebGLVertexArrayObject;
  tb?: WebGLBuffer[];
  tVP?: WebGLUniformLocation | null;
  sfbo?: WebGLFramebuffer;
  stexS?: WebGLTexture;
  _home?: ParentNode | null; // onde o canvas do GL mora quando não está no retrato
  fz?: number | null;
  hunterP?: ModeloHeroi;
  port?: ModeloHeroi;
  portKey?: string;
  lt?: number;
  mvA?: number;
  mvK?: number;
  runK?: number;
  noSCache?: boolean;
  noTrail?: boolean;
  sBuilds?: number;
  sKey?: string;
}
export const GL3: EstadoGL3 = {
  ok: false,
  tried: false,
  cv: null!,
  gl: null!,
  prog: null!,
  sprog: null!,
  fbo: null!,
  stex: null!,
  SM: 2048,
  U: {},
  SU: {},
  mesh: {},
  list: [],
  fogos: [],
  scene: null,
  sceneKey: "",
  heroKey: "",
  hero: null,
  trail: [],
  atk: null,
  lastSl: null,
  bk: 0,
  rel: 0,
  wasCh: false,
  fr: 0,
  hx: null,
  hy: 0,
  hph: 0,
  hyaw: 0,
};

export const OPT_KEY = "cdi.opts.v1";
export const OPT_DEF = {
  sfx: 0.8,
  music: 0.5,
  shake: true,
  d3: true,
  gfx: "alta",
  hints: true,
  autosave: true,
  mapNew: true,
  runas: true,
  touch: "auto",
  outline: true,
  textos: false,
  autoRes: true,
  ataqueAutomatico: false, // opção experimental; desligada mantém os golpes por clique
  // v8.1: os estados da heroína perto dela (field/estados.ts): dentro do anel, selos na borda, fita sob os pés
  estAnel: true,
  estSelos: true,
  estFita: true,
  // v8.1: o HUD do campo no estilo "Traço solto" com destaque brasa (styles/63_v8.1_hud_traco.css)
  hudTraco: false,
  // v8.1: a receita do segurar C (field/craft_rapido.ts, data/craft_rapido.ts)
  craftRapido: "flechas",
};
export const OPT = Object.assign({}, OPT_DEF, lsGet(OPT_KEY) || {});

// telas e laço de quadros (eram let do legado: canvas do mapa e do campo, tamanho do mundo, tempo do laço)
interface EstadoTelas {
  // preenchidos na carga (iniciar…), antes de qualquer leitura
  viewport: HTMLElement;
  stage: HTMLElement;
  mapImg: HTMLImageElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  worldW: number;
  worldH: number;
  dCtx: CanvasRenderingContext2D;
  dCanvas: HTMLCanvasElement;
  // laço de quadros
  canvasDpr: number;
  lastFrameTime: number | null;
  accumulatorSec: number;
  lastPanelUpdate: number;
  _mobRz: ReturnType<typeof setTimeout> | number;
  _mapSkip: number;
  d0: Ponto | null; // onde o dedo/ponteiro desceu no mapa
}
export const TELAS: EstadoTelas = {
  viewport: undefined!,
  stage: undefined!,
  mapImg: undefined!,
  canvas: undefined!,
  ctx: undefined!,
  worldW: undefined!,
  worldH: undefined!,
  canvasDpr: 1,
  lastFrameTime: null,
  accumulatorSec: 0,
  lastPanelUpdate: 0,
  dCtx: null!,
  dCanvas: null!,
  _mobRz: 0,
  _mapSkip: 0,
  d0: null,
};

// seleção no mapa e no inspetor (eram let do legado)
interface EstadoSel {
  commandMode: string | null;
  renderEventFeedDirty: boolean;
  selectedAnimal: Animal | null;
  selectedPlant: Planta | null;
  selectedHero: Hero | null;
  selectedCity: Cidade | null;
  infoTarget: { kind: string; x: number; y: number } | null;
  selectedWild: Wild | null;
  runeInspR: Runa | null; // a runa no inspetor
  CENTER_I: number;
  grupo: string[]; // v7.7: ids dos heróis selecionados no mapa (map/selecao.ts)
  grupos: Record<string, string[]>; // v7.7: grupos guardados com Ctrl+1..9 (map/selecao.ts)
}
export const SEL: EstadoSel = {
  commandMode: null, // id do herói aguardando clique no mapa pra definir região de caça
  renderEventFeedDirty: true,
  selectedAnimal: null,
  selectedPlant: null,
  selectedHero: null,
  selectedCity: null,
  infoTarget: null,
  selectedWild: null,
  runeInspR: null,
  CENTER_I: -1,
  grupo: [],
  grupos: {},
};

// estado das janelas e diálogos (eram let do legado: janelas, aviso, criação, menu, minijogos, mercado, empório)
/** Minijogo de trabalho aberto (minijogos/trabalho.ts). */
interface Minijogo {
  h: Hero;
  kind: string;
  d: MinijogoDef;
  r: number;
  pts: number;
  perf: number;
  pos: number;
  dir: number;
  w: number;
  c: number;
  on: boolean;
  last: number;
  log: unknown[]; // nunca lido
}
interface EstadoJanelas {
  _crTimers: ReturnType<typeof setTimeout>[];
  winSt: Record<string, { hidden?: boolean; x?: number; y?: number }>; // janelas soltas: posição e se está escondida
  winZ: number;
  mkCity: string | null;
  mkMode: string;
  mg: Minijogo | null;
  wmCb: { h: Hero; kind: string; auto: () => void } | null;
  MSG_EMP: string;
  EMP_TAB: string;
  _autoT: number;
  _toastT: ReturnType<typeof setTimeout> | null;
  _gmPaused: boolean;
}
export const JANELAS: EstadoJanelas = {
  _crTimers: [],
  winSt: {},
  winZ: 21,
  mkCity: null,
  mkMode: "foot",
  mg: null,
  wmCb: null,
  MSG_EMP: "",
  EMP_TAB: "compra",
  _autoT: 0,
  _toastT: null,
  _gmPaused: false,
};

// áudio (eram let do legado: o AudioContext e o ganho dos efeitos)
interface EstadoSom {
  _ac: AudioContext | null; // criado no primeiro som (o navegador exige um gesto)
  _mg: GainNode | null; // ganho geral dos efeitos
}
export const SOM: EstadoSom = {
  _ac: null,
  _mg: null,
};

// caçada em andamento (eram let do legado: de que bicho é a carne, área de caça)
interface EstadoCaca {
  MEAT_SRC: string | null;
  HUNT_AREA: { x: number; y: number; r: number } | null;
}
export const CACA: EstadoCaca = {
  MEAT_SRC: null,
  HUNT_AREA: null,
};

// caches e contadores (eram let do legado)
interface EstadoMemo {
  _pngWater: { d: ImageData["data"]; w: number; h: number } | null;
  _habCache: Habitat | null;
  _habAt: number;
  _mapPix: ImageData | null;
  runeUid: number;
  _cookOk0: number[] | null;
  ECON0: Econ | null; // cópia do econ inicial (para o "novo jogo")
}
export const MEMO: EstadoMemo = {
  _pngWater: null,
  _habCache: null,
  _habAt: 0,
  _mapPix: null,
  runeUid: 0,
  _cookOk0: null,
  ECON0: null,
};
