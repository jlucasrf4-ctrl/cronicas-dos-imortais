/* ==== v8.1 — pedras de minério feitas em código (render/gl/pedras_minerio.ts): cores e padrão de cada tipo ====
   Cores em 0..255; acima de 255 = brilho próprio (a luz da cena não apaga: Pedra Rúnica, faíscas do Diamante).
   padrao: como a casca é pintada (veios = rachaduras finas da cor 0; pintas = faces soltas da cor 0; faixas, anéis,
   manchas = alterna as cores). quebra: o que aparece ao quebrar (cristal = prismas; pepita = pedaços de metal saindo
   da rocha; geodo = corte reto mostrando o padrão; lascas = só pedaços; vidro = lâminas escuras com reflexo). */
type Cor = [number, number, number];
export interface TipoPedra {
  n: string;
  base: Cor;
  cores: Cor[];
  padrao: "liso" | "veios" | "pintas" | "faixas" | "aneis" | "manchas";
  quebra: "cristal" | "pepita" | "geodo" | "lascas" | "vidro";
  dentro?: Cor;
  freq?: number;
  dens?: number;
  /** peso no sorteio das pedras quebráveis do campo aberto (0 = só no editor) */
  peso: number;
}

export const TIPOS_PEDRA: Record<string, TipoPedra> = {
  ferro: {
    n: "Ferro",
    base: [92, 84, 80],
    cores: [[165, 140, 120]],
    padrao: "veios",
    quebra: "pepita",
    dentro: [160, 158, 162],
    peso: 6,
  },
  cobre: {
    n: "Cobre",
    base: [100, 76, 64],
    cores: [[225, 112, 45]],
    padrao: "veios",
    quebra: "pepita",
    dentro: [235, 120, 50],
    peso: 3,
  },
  prata: {
    n: "Prata",
    base: [96, 92, 92],
    cores: [[225, 225, 232]],
    padrao: "veios",
    quebra: "pepita",
    dentro: [240, 240, 250],
    peso: 2,
  },
  ouro: {
    n: "Ouro",
    base: [100, 82, 60],
    cores: [[245, 175, 40]],
    padrao: "veios",
    quebra: "pepita",
    dentro: [255, 195, 55],
    peso: 1,
  },
  quartzo: {
    n: "Quartzo",
    base: [150, 144, 138],
    cores: [[230, 230, 232]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [235, 235, 242],
    peso: 3,
  },
  ametista: {
    n: "Ametista",
    base: [96, 70, 120],
    cores: [[165, 90, 230]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [170, 95, 240],
    peso: 1,
  },
  esmeralda: {
    n: "Esmeralda",
    base: [72, 80, 74],
    cores: [[40, 185, 95]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [40, 200, 100],
    peso: 0.5,
  },
  rubi: {
    n: "Rubi",
    base: [92, 72, 72],
    cores: [[225, 30, 45]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [235, 30, 50],
    peso: 0.5,
  },

  jaspe: { n: "Jaspe", base: [175, 72, 45], cores: [[115, 42, 28]], padrao: "veios", quebra: "lascas", peso: 1 },
  citrino: {
    n: "Citrino",
    base: [170, 125, 50],
    cores: [[245, 195, 60]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [250, 210, 80],
    peso: 1,
  },
  lapis: {
    n: "Lápis-lazúli",
    base: [35, 55, 150],
    cores: [[230, 185, 70]],
    padrao: "pintas",
    quebra: "lascas",
    dens: 0.1,
    peso: 0.5,
  },
  quartzo_rosa: {
    n: "Quartzo Rosa",
    base: [225, 135, 138],
    cores: [[245, 175, 178]],
    padrao: "pintas",
    quebra: "cristal",
    dentro: [245, 165, 170],
    dens: 0.2,
    peso: 1,
  },
  malaquita: {
    n: "Malaquita",
    base: [30, 120, 60],
    cores: [
      [18, 80, 40],
      [90, 190, 120],
    ],
    padrao: "aneis",
    quebra: "geodo",
    freq: 3.2,
    peso: 0.5,
  },
  agata: {
    n: "Ágata",
    base: [200, 130, 95],
    cores: [
      [205, 125, 85],
      [235, 210, 180],
      [140, 110, 100],
      [180, 90, 60],
    ],
    padrao: "faixas",
    quebra: "geodo",
    freq: 5,
    peso: 1,
  },
  serpentina: {
    n: "Serpentina",
    base: [135, 135, 60],
    cores: [
      [100, 105, 45],
      [170, 170, 85],
    ],
    padrao: "manchas",
    quebra: "lascas",
    peso: 1,
  },
  esmeril: {
    n: "Esmeril",
    base: [62, 58, 60],
    cores: [[190, 190, 200]],
    padrao: "pintas",
    quebra: "lascas",
    dens: 0.1,
    peso: 0.5,
  },

  comum: { n: "Pedra Comum", base: [125, 110, 100], cores: [], padrao: "liso", quebra: "lascas", peso: 30 },
  safira: {
    n: "Safira",
    base: [62, 64, 92],
    cores: [[40, 85, 215]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [45, 95, 235],
    peso: 0.5,
  },
  topazio: {
    n: "Topázio",
    base: [108, 84, 60],
    cores: [[240, 150, 40]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [250, 165, 55],
    peso: 0.5,
  },
  onix: {
    n: "Ônix",
    base: [40, 38, 40],
    cores: [
      [28, 27, 30],
      [72, 70, 74],
      [120, 118, 122],
    ],
    padrao: "faixas",
    quebra: "geodo",
    freq: 6,
    peso: 0.5,
  },
  diamante: {
    n: "Diamante",
    base: [112, 106, 102],
    cores: [[300, 340, 380]],
    padrao: "pintas",
    quebra: "cristal",
    dentro: [330, 370, 420],
    dens: 0.06,
    peso: 0.2,
  },
  obsidiana: {
    n: "Obsidiana",
    base: [32, 29, 38],
    cores: [[95, 90, 120]],
    padrao: "pintas",
    quebra: "vidro",
    dentro: [70, 64, 92],
    dens: 0.15,
    peso: 1,
  },
  runica: {
    n: "Pedra Rúnica",
    base: [82, 92, 102],
    cores: [[90, 330, 420]],
    padrao: "veios",
    quebra: "cristal",
    dentro: [100, 360, 460],
    peso: 0,
  },
  olho_tigre: {
    n: "Olho de Tigre",
    base: [190, 115, 35],
    cores: [
      [205, 125, 35],
      [115, 68, 25],
      [240, 170, 65],
    ],
    padrao: "faixas",
    quebra: "geodo",
    freq: 7,
    peso: 0.5,
  },

  granito: {
    n: "Granito",
    base: [150, 110, 95],
    cores: [
      [160, 115, 98],
      [85, 72, 70],
      [205, 175, 155],
    ],
    padrao: "manchas",
    quebra: "lascas",
    peso: 8,
  },
  basalto: { n: "Basalto", base: [56, 53, 56], cores: [], padrao: "liso", quebra: "lascas", peso: 6 },
  arenito: {
    n: "Arenito",
    base: [195, 150, 110],
    cores: [
      [200, 152, 110],
      [180, 135, 95],
    ],
    padrao: "faixas",
    quebra: "lascas",
    freq: 4,
    peso: 5,
  },
  calcario: { n: "Calcário", base: [200, 190, 175], cores: [], padrao: "liso", quebra: "lascas", peso: 5 },
  xisto: {
    n: "Xisto",
    base: [100, 85, 75],
    cores: [
      [90, 75, 65],
      [150, 120, 100],
      [60, 55, 55],
    ],
    padrao: "faixas",
    quebra: "geodo",
    freq: 6,
    peso: 3,
  },
  marmore: {
    n: "Mármore",
    base: [222, 216, 210],
    cores: [[160, 160, 168]],
    padrao: "veios",
    quebra: "lascas",
    peso: 2,
  },
  dolomita: {
    n: "Dolomita",
    base: [205, 185, 170],
    cores: [
      [215, 198, 185],
      [180, 160, 145],
    ],
    padrao: "manchas",
    quebra: "lascas",
    peso: 3,
  },
  gnaisse: {
    n: "Gnaisse",
    base: [80, 72, 75],
    cores: [
      [70, 65, 70],
      [175, 145, 115],
      [115, 95, 85],
    ],
    padrao: "faixas",
    quebra: "geodo",
    freq: 6,
    peso: 3,
  },
};

/** campo: as pedras quebráveis do campo aberto usam estas (false = a pedra antiga do Tripo); tam: maior medida
 *  da rocha inteira em px do campo, × a escala da pedra (a do Tripo tem 18); variantes: formas por tipo (cache);
 *  veio: largura das rachaduras (0..1 do raio); luz: multiplica as cores da tabela. */
export const PEDRA_MINERIO = { campo: true, tam: 18, variantes: 4, veio: 0.045, luz: 1.1 };
