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
/** O tingimento pela máscara (render/gl/aparencias.ts tingir). contraste: quanto da variação de luz do modelo (em
 *  relação à mediana da parte) fica na cor nova — o cabelo mais, para as mechas não virarem um bloco; luz: limites
 *  dessa luz (acima de 1,25 a pele clara virava branca). */
export const TINGIR = { contraste: { pele: 0.5, cabelo: 0.7 }, luz: [0.6, 1.25] as [number, number] };
