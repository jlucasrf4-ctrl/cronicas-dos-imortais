/* ==== v8.1 — Modo Editor: o estado e o formato da decoração (mantenedor 2026-10-31: "quero ter mais acesso a decorar o
   mapa e assets") ====
   A decoração é um arquivo só, src/assets/map/decoracao.json (DadosEditor): por cena, a lista de peças postas à mão
   (Deco), os recados para o Claude (Recado) e os conjuntos salvos. O jogo desenha as peças sempre (editor/cena.ts); o
   editor (editor/editor.ts, F2 no campo) só muda a lista. Este módulo não importa nada do jogo: o renderizador e a luz
   do dia leem ED sem ciclo de importação. */

/** Uma peça posta à mão. `m` = o modelo ("cen:pinheiro_1", "vila:taverna", "item:eq_espada", "imp:<nome>", e os
 *  invisíveis "luz:<tipo>", "fx:<tipo>", "som:<tipo>"). x/z: no campo aberto (cena "mundo"), px do campo absolutos
 *  (mapa / MUNDO.escala), presos ao mundo; nas outras cenas, px do campo da arena. y: altura a mais; g: giro (rad);
 *  e: escala; tom/tomK: cor por cima e quanto dela; cam: camada; raio: alcance da luz, do efeito ou do som; forca:
 *  intensidade (0..1); luz: a peça também ilumina (raio da luz). */
export interface Deco {
  id: number;
  m: string;
  x: number;
  z: number;
  y?: number;
  g?: number;
  e?: number;
  tom?: string;
  tomK?: number;
  cam?: string;
  raio?: number;
  forca?: number;
  luz?: number;
  /** Pavimento da construção (0 = térreo). */
  pavimento?: number;
  categoria?: string;
}
/** Um alfinete com um pedido para o Claude ("quero uma ponte aqui"). */
export interface Recado {
  id: number;
  x: number;
  z: number;
  texto: string;
  quando: string;
  feito?: boolean;
}
/** Uma pincelada do pincel de terreno, em unidades do MAPA (vale no mapa e no campo aberto): `t` "terra" (ilha,
 *  aterro) ou "agua" (lago, rio, canal); círculo de raio `r` em (x, y). As pinceladas valem na ordem. */
export interface Traco {
  t: "terra" | "agua";
  x: number;
  y: number;
  r: number;
}
/** O arquivo de decoração. `cenas`: "mundo" (o campo aberto), "vila", "acamp", "treino"; `conjuntos`: grupos salvos
 *  (posições relativas ao centro do grupo); `salvoEm`: ISO da última gravação; `aparencias`: o controle de qualidade
 *  das aparências sorteadas ("corpo|cabeça" → boa/ruim; as notas servem à revisão visual). */
export interface DadosEditor {
  versao: 1;
  cenas: Record<string, Deco[]>;
  recados: Record<string, Recado[]>;
  conjuntos: Record<string, Deco[]>;
  terreno?: Traco[];
  /** v8.1 — peças do mapa apagadas no editor (árvores "arvore:x:z", pedras "pedra:i:j", mato "mato:i:j") */
  removidos?: string[];
  aparencias?: Record<string, "boa" | "ruim">;
  proximo: number;
  salvoEm?: string;
}

export function dadosVazios(): DadosEditor {
  return { versao: 1, cenas: {}, recados: {}, conjuntos: {}, proximo: 1 };
}

/** O estado do editor que o resto do jogo lê. on: o editor está aberto; dados: a decoração que o jogo desenha agora;
 *  antes: a última versão gravada (ou a escolhida no histórico), mostrada enquanto `vendoAntes`; hora: hora do dia
 *  fixada pelo editor (0..24) ou null; estacao: a prévia de estação ("" = a de sempre); camadasOcultas: camadas que não
 *  aparecem; selecionados: ids das peças selecionadas (contorno dourado); fantasmas: as peças que vão ser postas (sob o
 *  cursor, em azul). */
export const ED = {
  on: false,
  dados: dadosVazios(),
  antes: null as DadosEditor | null,
  vendoAntes: false,
  hora: null as number | null,
  estacao: "",
  camadasOcultas: new Set<string>(),
  selecionados: new Set<number>(),
  fantasmas: [] as Deco[],
  pavimento: 0,
  /** muda a cada alteração (a cena refaz o que guardou da lista) */
  versao: 0,
};

/** A decoração que aparece agora (a de antes, segurando "Antes/Depois"). */
export function dadosVistos() {
  return ED.vendoAntes && ED.antes ? ED.antes : ED.dados;
}
