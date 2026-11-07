/* ==== v8.1 — cores de pele e de cabelo das aparências (render/gl/aparencias.ts, editor/aparencias_qc.ts) ====
   Cada personagem novo sorteia um tom de pele e uma cor de cabelo destas paletas (peso de cada um); "" = a cor
   original do modelo. No painel 👤 Aparências do Modo Editor dá para trocar à mão (também por uma cor livre). */
export const PALETA_PELE: { cor: string; nome: string; peso: number }[] = [
  { cor: "", nome: "Original", peso: 4 },
  { cor: "#f2d3bd", nome: "Clara", peso: 1 },
  { cor: "#e6b896", nome: "Pêssego", peso: 1 },
  { cor: "#d9a074", nome: "Bronzeada", peso: 1 },
  { cor: "#b97b55", nome: "Morena", peso: 1 },
  { cor: "#8d5a3c", nome: "Escura", peso: 1 },
  { cor: "#5e3a26", nome: "Muito escura", peso: 1 },
];
export const PALETA_CABELO: { cor: string; nome: string; peso: number }[] = [
  { cor: "", nome: "Original", peso: 4 },
  { cor: "#1f1a18", nome: "Preto", peso: 1 },
  { cor: "#4a2e1f", nome: "Castanho escuro", peso: 1 },
  { cor: "#7a4a2a", nome: "Castanho", peso: 1 },
  { cor: "#d8b06a", nome: "Loiro", peso: 1 },
  { cor: "#9a3b1e", nome: "Ruivo", peso: 1 },
  { cor: "#c9c4c0", nome: "Grisalho", peso: 0.5 },
  { cor: "#e8e6f0", nome: "Branco", peso: 0.3 },
  { cor: "#2c3a6e", nome: "Azul-marinho", peso: 0.3 },
  { cor: "#7a4fa0", nome: "Roxo", peso: 0.3 },
  { cor: "#d87aa8", nome: "Rosa", peso: 0.3 },
  { cor: "#5f8a4a", nome: "Verde", peso: 0.3 },
];
/** Cabeças fora do sorteio e da escolha da criação por serem MUITO parecidas com outra (mantenedor, 2026-11-06:
 *  "exclua as personagens que forem muito parecidas, deixe enxuto"). A cor de pele e de cabelo é tingida, então conta o
 *  formato. Continuam nos dados (o Modo Editor mostra todas; o busto integral usa a busto_03 e a busto_06; quem já
 *  nasceu com uma delas continua com ela). Fica → sai:
 *  busto_05 (ruiva cacheada curta) → busto_03 · busto_09 (castanha cacheada volumosa) → busto_08 ·
 *  busto_14 (trança de lado) → busto_07 e busto_11 · busto_04 (castanha longa de lado) → busto_12 ·
 *  busto_16 (platinada solta) → busto_06 · ruiva_rabo (rabo alto) → rosa · morena_argolas → morena_tiara */
export const CABECAS_FORA = [
  "busto_03",
  "busto_08",
  "busto_07",
  "busto_11",
  "busto_12",
  "busto_06",
  "rosa",
  "morena_tiara",
];
/** O tingimento pela máscara (render/gl/aparencias.ts tingir), em CIELAB: cada triângulo guarda a diferença dele para a
 *  mediana da parte (2026-11-06; antes, metade da luz e nenhum matiz: a pele chapava). `luz`: limites do fator da
 *  diferença de luz (a razão L da cor nova / L da mediana) — no cabelo preto vindo do loiro as mechas ainda aparecem
 *  (mínimo), no loiro vindo do preto não viram listras (máximo). `croma`: idem para o matiz (cabelo grisalho perde o
 *  colorido das mechas). `textura`: o multiplicador por canal dos triângulos com textura fica a `desvio`× da razão de
 *  luz e no máximo `max` (um canal sozinho estourava um texel claro em azul). */
export const TINGIR = {
  pele: { luz: [0.55, 1.5] as [number, number], croma: [0.4, 1.2] as [number, number] },
  cabelo: { luz: [0.45, 1.6] as [number, number], croma: [0.3, 1.2] as [number, number] },
  textura: { desvio: 1.6, max: 4 },
};
