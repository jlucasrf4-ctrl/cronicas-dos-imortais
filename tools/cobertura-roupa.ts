/** Calcula a cobertura de cada peça final sem regenerar a geometria ou os outros modelos. */
import { readFileSync, writeFileSync } from "node:fs";
import { decodificarAnim, type DadosAnim } from "../src/render/gl/esqueleto.ts";
import { coberturaPorPeca } from "./lib/cobertura-roupa.ts";
const [nome, estilo] = process.argv.slice(2);
if (!nome || !estilo) throw new Error("Uso: node tools/cobertura-roupa.ts corpo_f02 aventureira");
const A = decodificarAnim(JSON.parse(readFileSync("build/modelos/" + nome + "_anim.json", "utf8")) as DadosAnim);
const arquivo = "src/assets/models/vestidos.json",
  pacote = JSON.parse(readFileSync(arquivo, "utf8"));
const modelo = pacote.modelos.find((m: { nome: string }) => m.nome === nome + "__" + estilo);
if (!modelo?.partes) throw Error("Peças não encontradas");
let altura = 0;
for (let v = 0; v < A.P.length / 3; v++) altura = Math.max(altura, A.P[v * 3 + 1]);
for (const parte of ["peito", "pernas", "pes"]) {
  const d = modelo.partes[parte] as DadosAnim | undefined;
  if (!d) continue;
  d.coberturaCorpo = coberturaPorPeca(A, decodificarAnim(d), altura * 0.04, parte === "pes");
  console.log(
    nome +
      " " +
      estilo +
      " " +
      parte +
      ": " +
      Buffer.from(d.coberturaCorpo, "base64").length / 18 +
      " triângulos cobertos",
  );
}
writeFileSync(arquivo, JSON.stringify(pacote));
