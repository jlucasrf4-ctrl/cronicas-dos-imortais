/* Fatia folhas de sprites em ícones .webp (Fase 7: substitui os antigos scripts/assets/slice*.py, sem Python/scipy).

   Uso:  node tools/slice-sheet.ts <plano.json> [--simular] [--contagens <arquivo.json>]
   O plano diz onde estão as folhas, para onde vão as peças e como achar cada uma (tipos em tools/lib/fatiar.ts):
     { "origem": "assets/source_sheets", "saida": "build/fatias",
       "folhas": [
         { "arquivo": "armas.png", "modo": "componentes", "limiar": 30, "fechar": { "forma": "ret", "larg": 5, "alt": 14 },
           "areaMin": 0, "ladoMin": 0, "largMin": 11, "altMin": 119, "folgaLinha": 120, "nomes": ["wx_faca", "wx_machado"], "altura": 150, "fundo": 40 },
         { "arquivo": "icones.png", "modo": "grade", "colunas": 4, "linhas": 4, "nomes": ["carne", "erva", null, "pele"],
           "fundo": 22, "erosao": 3, "desfoque": 0.8, "aparar": 0.06, "quadrado": 128 } ] }
   Para cada folha imprime quantas peças achou por linha e grava `<saida>/<nome>.webp` mais uma prévia
   `<saida>/previa_<folha>.png` para conferir a olho. `--simular` só imprime.
   `--contagens` grava quantas peças cada nome recebeu (como o antigo art4_counts.json; o jogo lê essas contagens de
   `WX_N` em src/data/icones.ts, que se atualiza à mão).
   As folhas originais da v7.6 se perderam: os planos delas não foram portados (estão nos .py do backup pré-Fase 7). */
import { readFileSync, writeFileSync } from "node:fs";
import { fatiarFolha, type Plano } from "./lib/fatiar.ts";

async function main() {
  const args = process.argv.slice(2);
  const simular = args.includes("--simular");
  const ic = args.indexOf("--contagens");
  const saidaContagens = ic >= 0 ? args[ic + 1] : undefined;
  const arqPlano = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--contagens");
  if (!arqPlano) {
    console.error("uso: node tools/slice-sheet.ts <plano.json> [--simular] [--contagens <arquivo.json>]");
    process.exit(1);
  }
  const plano = JSON.parse(readFileSync(arqPlano, "utf8")) as Plano;
  const contagens: Record<string, number> = {};
  for (const folha of plano.folhas) {
    const r = await fatiarFolha(plano, folha, simular);
    const linhas = r.porLinha.length ? ` por linha [${r.porLinha.join(", ")}]` : "";
    console.log(`${r.arquivo}: ${r.fatias.length} peças${linhas}`);
    for (const [n, c] of Object.entries(r.contagens)) contagens[n] = (contagens[n] ?? 0) + c;
  }
  if (saidaContagens && !simular) writeFileSync(saidaContagens, JSON.stringify(contagens) + "\n");
  console.log(`${simular ? "(simulação) " : ""}${Object.keys(contagens).length} nomes, saída em ${plano.saida}`);
}

await main();
