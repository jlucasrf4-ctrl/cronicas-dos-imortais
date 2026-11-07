/* v8.1 — registra os bustos novos por célula, conservando as texturas e a medida olhos–queixo. */
import { readFileSync, writeFileSync } from "node:fs";
import { ORCAMENTO_PERSONAGEM } from "./lib/orcamento-personagem.ts";
const registro = JSON.parse(readFileSync("build/inspecao-personagens/folhas.json", "utf8")) as {
  nome: string;
  caixa: { mn: number[]; mx: number[] };
}[];
const arq = "tools/modelos/aparencias.json";
const plano = JSON.parse(readFileSync(arq, "utf8"));
plano.trisCabeca = ORCAMENTO_PERSONAGEM.cabeca;
plano.tamanhoTextura = 2048;
plano.qualidadeTextura = 92;
plano.alisar.voltas = 2;
plano.alisar.voltasCor = 0;
plano.cabecas = plano.cabecas.filter((c: { nome: string }) => !c.nome.startsWith("busto_"));
const folhas = [
  {
    arquivo: "Cabeças F1-f6.glb",
    colunas: 3,
    olhos: [0.707, 0.74, 0.737, 0.69, 0.708, 0.694],
    queixos: [0.579, 0.599, 0.545, 0.517, 0.538, 0.537],
  },
  {
    arquivo: "Cabeça 7 - 12.glb",
    colunas: 3,
    olhos: [0.678, 0.696, 0.703, 0.688, 0.672, 0.64],
    queixos: [0.505, 0.487, 0.527, 0.494, 0.478, 0.47],
  },
  {
    arquivo: "afdf1c97-549a-4ae0-9b92-a82b5169e382.glb",
    colunas: 2,
    olhos: [0.69, 0.665, 0.66, 0.696],
    queixos: [0.56, 0.525, 0.51, 0.557],
  },
];
let n = 0;
for (const [f, folha] of folhas.entries()) {
  const { mn, mx } = registro.find((r) => r.nome === folha.arquivo)!.caixa;
  for (let k = 0; k < folha.colunas * 2; k++) {
    n++;
    const coluna = k % folha.colunas,
      linha = Math.floor(k / folha.colunas);
    plano.cabecas.push({
      nome: `busto_${String(n).padStart(2, "0")}`,
      rotulo: `Busto F${String(n).padStart(2, "0")}`,
      peso: 1,
      busto: true,
      olhos: folha.olhos[k],
      queixo: folha.queixos[k],
      tripo: {
        arquivo: "arquivos de transferência/3.11.2026/" + folha.arquivo,
        xMin: mn[0] + ((mx[0] - mn[0]) * coluna) / folha.colunas - 0.0001,
        xMax: mn[0] + ((mx[0] - mn[0]) * (coluna + 1)) / folha.colunas + 0.0001,
        yMin: linha ? mn[1] - 0.0001 : (mn[1] + mx[1]) / 2,
        yMax: linha ? (mn[1] + mx[1]) / 2 : mx[1] + 0.0001,
        textura: "bustos_novos_" + f,
      },
    });
  }
}
for (const c of plano.corpos) if (/^corpo_f0[1-6]$/.test(c.nome)) c.cabecaPadrao = "busto_" + c.nome.slice(-2);
writeFileSync(arq, JSON.stringify(plano, null, 2) + "\n");
console.log(`${n} bustos registrados; gerar as aparências depois dos corpos.`);
