/* ==== v8.1 — tabelas do Modo Editor (editor/editor.ts, editor/modelos.ts, editor/cena.ts) ==== */

/** giro: passo de Q/E e da roda (graus); escala: passo de +/− e de Shift+roda (×); zoom: limites da câmera do editor
 *  (× o zoom do jogo) e o passo da roda; pan: velocidade de WASD (px do campo por segundo, no zoom 1); grade: lado da
 *  grade do ímã (px do campo); pincel: raio (px), espaço entre peças (× o tamanho da peça), variação de tamanho;
 *  autoSalvar: segundos parado depois de uma mudança até gravar sozinho; historico: minutos entre cópias automáticas
 *  na pasta editor-historico; desfazer: quantos passos guarda. */
export const EDITOR = {
  giro: 15,
  escala: 1.1,
  zoom: { min: 0.25, max: 2.5, passo: 1.12 },
  pan: 520,
  grade: 21,
  pincel: { raio: 90, raioMin: 20, raioMax: 400, espaco: 0.9, variar: [0.75, 1.25] as [number, number] },
  autoSalvar: 4,
  historico: 5,
  desfazer: 200,
};

/** As camadas: id → nome e ícone. Cada peça cai na camada da categoria do modelo, se não tiver `cam`. */
export const CAMADAS: Record<string, { nome: string; ico: string }> = {
  natureza: { nome: "Natureza", ico: "🌲" },
  objetos: { nome: "Objetos", ico: "🏠" },
  luzes: { nome: "Luzes", ico: "💡" },
  efeitos: { nome: "Efeitos", ico: "✨" },
  sons: { nome: "Sons", ico: "🔊" },
  recados: { nome: "Recados", ico: "📌" },
};

/** Categorias da biblioteca: id → nome, ícone, camada e quais modelos entram (por prefixo do grupo, sem o _n). */
export const CATEGORIAS: { id: string; nome: string; ico: string; cam: string; grupos?: string[] }[] = [
  { id: "arvores", nome: "Árvores", ico: "🌲", cam: "natureza", grupos: ["folhosa", "pinheiro", "outono", "seca"] },
  {
    id: "plantas",
    nome: "Plantas",
    ico: "🌿",
    cam: "natureza",
    grupos: ["moita", "moita_outono", "samambaia", "cogumelo"],
  },
  {
    id: "pedras",
    nome: "Pedras e troncos",
    ico: "🪨",
    cam: "natureza",
    grupos: ["pedra", "laje", "poco", "tronco", "tocos", "toco"],
  },
  // v8.1 — as pedras de minério feitas em código (render/gl/pedras_minerio.ts), inteiras e quebradas
  { id: "minerios", nome: "Pedras de minério", ico: "💎", cam: "natureza" },
  {
    id: "acamp",
    nome: "Acampamento",
    ico: "⛺",
    cam: "objetos",
    grupos: [
      "barraca",
      "barraca_pequena",
      "toldo",
      "fogueira",
      "bigorna",
      "fornalha",
      "saco",
      "rolo",
      "mochila",
      "lenha",
      "bau",
      "maleta",
      "mesa",
      "banco",
      "balde",
      "lampiao",
      "tripe",
    ],
  },
  { id: "estacoes", nome: "Estações", ico: "🌸", cam: "natureza" },
  { id: "vila", nome: "Vila", ico: "🏠", cam: "objetos" },
  { id: "itens", nome: "Itens", ico: "🗡", cam: "objetos" },
  { id: "importados", nome: "Meus modelos", ico: "📦", cam: "objetos" },
  { id: "construcao", nome: "Construção", ico: "🧱", cam: "objetos", grupos: ["taverna", "igreja", "casa_dois", "emporio", "casa_lenha", "banca", "doca"] },
  { id: "mobilia", nome: "Mobiliário", ico: "🪑", cam: "objetos", grupos: ["mesa", "banco", "bigorna", "fornalha", "bau", "maleta", "barril", "caixote", "saco", "rolo", "mochila"] },
  { id: "decoracao", nome: "Decoração", ico: "🏺", cam: "objetos", grupos: ["quadro", "balde", "lampiao", "tripe", "rede", "balde_peixes", "feno", "horta", "varal", "placa"] },
  { id: "luzes", nome: "Luzes", ico: "💡", cam: "luzes" },
  { id: "efeitos", nome: "Efeitos", ico: "✨", cam: "efeitos" },
  { id: "sons", nome: "Sons", ico: "🔊", cam: "sons" },
];

/** Nomes para mostrar dos grupos e peças (o resto aparece com o nome do arquivo). */
export const NOMES: Record<string, string> = {
  folhosa: "Árvore",
  pinheiro: "Pinheiro",
  outono: "Árvore de outono",
  seca: "Árvore seca",
  moita: "Moita",
  moita_outono: "Moita de outono",
  samambaia: "Samambaia",
  cogumelo: "Cogumelo",
  pedra: "Pedra",
  laje: "Laje",
  poco: "Poço de pedra",
  tronco: "Tronco caído",
  tocos: "Tocos",
  toco: "Toco",
  barraca: "Barraca",
  barraca_pequena: "Barraca pequena",
  toldo: "Toldo",
  fogueira: "Fogueira",
  bigorna: "Bigorna",
  fornalha: "Fornalha",
  saco: "Saco",
  rolo: "Saco de dormir",
  mochila: "Mochila",
  lenha: "Lenha",
  bau: "Baú",
  maleta: "Maleta",
  mesa: "Mesa",
  banco: "Banco",
  balde: "Balde",
  lampiao: "Lampião",
  tripe: "Tripé",
  taverna: "Taverna",
  igreja: "Igreja",
  casa_dois: "Casa de dois andares",
  emporio: "Empório",
  casa_lenha: "Casa do lenhador",
  quadro: "Quadro de avisos",
  banca: "Banca",
  barril: "Barril",
  caixote: "Caixote",
  rede: "Rede de pesca",
  balde_peixes: "Balde de peixes",
  doca: "Doca",
  bote: "Bote",
  feno: "Feno",
  horta: "Horta",
  varal: "Varal",
  placa: "Placa",
};

/** v8.1 — os grupos do cenário que ganham versão de estação na biblioteca (categoria Estações), repintados por
 *  render/gl/estacao_cor.ts: neve no inverno, flores na primavera, folhas vermelhas no outono. */
export const ITENS_ESTACAO: Record<string, string[]> = {
  folhosa: ["primavera", "outono", "inverno"],
  pinheiro: ["inverno"],
  moita: ["primavera", "outono", "inverno"],
  samambaia: ["outono", "inverno"],
  seca: ["inverno"],
  tronco: ["inverno"],
  pedra: ["inverno"],
};

/** Tamanho (maior medida, px do campo; uma casa = 42) de cada peça da vila na escala 1: o mesmo da vila de verdade. */
export const TAM_VILA: Record<string, number> = {
  taverna: 227,
  igreja: 176,
  casa_dois: 110,
  emporio: 185,
  casa_lenha: 110,
  quadro: 63,
  banca: 88,
  poco: 67,
  barril: 13,
  caixote: 13,
  rede: 46,
  balde_peixes: 21,
  doca: 126,
  bote: 52,
  banco: 42,
  feno: 46,
  horta: 67,
  varal: 63,
  placa: 34,
};
/** Tamanho padrão de um modelo importado (maior medida, px do campo) na escala 1. */
export const TAM_IMPORTADO = 60;

/** Os invisíveis: luzes (raio px, cor), efeitos (partículas: por segundo, cor, tamanho, sobe, vida s) e sons
 *  (sintetizados em editor/som.ts). `raio` é o padrão de uma peça nova. */
export const LUZES: Record<string, { nome: string; raio: number; ico: string }> = {
  fogo: { nome: "Luz de fogo", raio: 150, ico: "🔥" },
  tocha: { nome: "Tocha", raio: 110, ico: "🕯" },
  janela: { nome: "Janela acesa", raio: 70, ico: "🪟" },
};
export const EFEITOS: Record<
  string,
  {
    nome: string;
    ico: string;
    raio: number;
    porSeg: number;
    cor: number[];
    tam: [number, number];
    sobe: number;
    vida: number;
    vento?: number;
    brilha?: boolean;
    noite?: boolean;
  }
> = {
  fumaca: {
    nome: "Fumaça",
    ico: "💨",
    raio: 8,
    porSeg: 7,
    cor: [0.82, 0.8, 0.78, 0.35],
    tam: [5, 16],
    sobe: 26,
    vida: 3.2,
    vento: 8,
  },
  vagalumes: {
    nome: "Vaga-lumes",
    ico: "✨",
    raio: 110,
    porSeg: 5,
    cor: [1, 0.92, 0.45, 0.95],
    tam: [1.3, 2.2],
    sobe: 2,
    vida: 4,
    brilha: true,
    noite: true,
  },
  folhas: {
    nome: "Folhas caindo",
    ico: "🍂",
    raio: 120,
    porSeg: 4,
    cor: [0.85, 0.5, 0.18, 0.95],
    tam: [2, 3.2],
    sobe: -14,
    vida: 5,
    vento: 10,
  },
  neblina: {
    nome: "Neblina",
    ico: "🌫",
    raio: 160,
    porSeg: 3,
    cor: [0.9, 0.92, 0.95, 0.12],
    tam: [40, 80],
    sobe: 0,
    vida: 7,
    vento: 4,
  },
  faiscas: {
    nome: "Faíscas",
    ico: "🎇",
    raio: 6,
    porSeg: 10,
    cor: [1, 0.62, 0.2, 1],
    tam: [0.8, 1.4],
    sobe: 34,
    vida: 1.3,
    vento: 6,
    brilha: true,
  },
};
export const SONS: Record<string, { nome: string; ico: string; raio: number }> = {
  rio: { nome: "Rio", ico: "🌊", raio: 220 },
  mar: { nome: "Mar", ico: "🌊", raio: 320 },
  floresta: { nome: "Floresta (pássaros)", ico: "🐦", raio: 260 },
  vento: { nome: "Vento", ico: "🌬", raio: 300 },
  fogueira: { nome: "Fogo estalando", ico: "🔥", raio: 120 },
  grilos: { nome: "Grilos (noite)", ico: "🦗", raio: 220 },
  vila: { nome: "Vila movimentada", ico: "🏘", raio: 260 },
};

/** Prévia das estações (só no editor): cor que multiplica a cena, cor por cima do chão e das árvores [r, g, b, força]
 *  e as partículas que caem no céu inteiro. */
export const ESTACOES: Record<
  string,
  {
    nome: string;
    ico: string;
    img: string;
    luz: number[];
    tom: number[];
    cai?: { cor: number[]; tam: [number, number]; vel: number; n: number };
  }
> = {
  primavera: {
    nome: "Primavera",
    ico: "🌸",
    img: "/src/assets/art/estacao_primavera.webp",
    luz: [1.02, 1.04, 1],
    tom: [0.55, 0.8, 0.35, 0.12],
    cai: { cor: [1, 0.78, 0.86, 0.95], tam: [1.4, 2.4], vel: 18, n: 70 },
  },
  verao: {
    nome: "Verão",
    ico: "☀️",
    img: "/src/assets/art/estacao_verao.webp",
    luz: [1.08, 1.04, 0.92],
    tom: [0.95, 0.85, 0.45, 0.08],
  },
  outono: {
    nome: "Outono",
    ico: "🍂",
    img: "/src/assets/art/estacao_outono.webp",
    luz: [1.04, 0.96, 0.86],
    tom: [0.85, 0.5, 0.2, 0.3],
    cai: { cor: [0.9, 0.48, 0.16, 0.95], tam: [2, 3.2], vel: 22, n: 60 },
  },
  inverno: {
    nome: "Inverno",
    ico: "❄️",
    img: "/src/assets/art/estacao_inverno.webp",
    luz: [0.92, 0.97, 1.08],
    tom: [0.95, 0.97, 1, 0.55],
    cai: { cor: [1, 1, 1, 0.9], tam: [1.2, 2.2], vel: 30, n: 140 },
  },
};
