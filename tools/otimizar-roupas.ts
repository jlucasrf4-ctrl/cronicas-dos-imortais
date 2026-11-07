/* v8.1 — reserva espaço para os rostos e três armas visíveis, inclusive roupas misturadas. */
import { readFileSync, writeFileSync } from "node:fs";
import { reduzirAnimado } from "./lib/reduzir-animado.ts";
import { orcamentoRoupa } from "./lib/orcamento-personagem.ts";
import type { DadosAnim } from "../src/render/gl/esqueleto.ts";
const orcamento = { peito: 1700, pernas: 1800, pes: 400 };
for (const roupa of ["aventureira", "deserto", "patrulheira", "placa"]) {
  const plano = `tools/modelos/roupa_${roupa}.json`;
  const p = JSON.parse(readFileSync(plano, "utf8"));
  p.orcamento = orcamento;
  writeFileSync(plano, JSON.stringify(p, null, 2) + "\n");
  for (let corpo = 1; corpo <= 6; corpo++)
    for (const parte of ["peito", "pernas", "pes"] as const) {
      const arq = `build/modelos/corpo_f0${corpo}__${roupa}_${parte}_anim.json`;
      const d = JSON.parse(readFileSync(arq, "utf8")) as DadosAnim;
      const saida = await reduzirAnimado(d, orcamentoRoupa(`corpo_f0${corpo}`, orcamento)[parte]);
      writeFileSync(arq, JSON.stringify(saida));
      console.log(`${arq}: ${Buffer.from(saida.malha.i, "base64").length / 6}`);
    }
}
