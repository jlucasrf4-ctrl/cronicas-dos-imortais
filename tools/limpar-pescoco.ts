/** Aplica a limpeza individual ao pacote atual sem regenerar os outros corpos. */
import { readFileSync, writeFileSync } from "node:fs";
import { decodificarAnim } from "../src/render/gl/esqueleto.ts";
import { limparIlhasPescoco, type LimpezaPescoco } from "./lib/limpar-pescoco.ts";
import type { AparenciasDados } from "../src/render/gl/aparencias.ts";
const nome = process.argv[2];
if (!nome) throw new Error("Uso: node tools/limpar-pescoco.ts corpo_f02");
const plano = JSON.parse(readFileSync("tools/modelos/aparencias.json", "utf8")) as {
  corpos: { nome: string; limparIlhasPescoco?: LimpezaPescoco }[];
};
const ajuste = plano.corpos.find((c) => c.nome === nome)?.limparIlhasPescoco;
if (!ajuste) throw new Error("Corpo sem calibração individual de limpeza: " + nome);
const arq = "src/assets/models/aparencias.json",
  pacote = JSON.parse(readFileSync(arq, "utf8")) as AparenciasDados;
const corpo = pacote.corpos!.find((c) => c.nome === nome);
if (!corpo) throw new Error("Corpo não encontrado: " + nome);
const A = decodificarAnim(corpo.semCabeca),
  todos = Array.from({ length: A.I.length / 3 }, (_, i) => i);
const resultado = limparIlhasPescoco(A, todos, corpo.encaixe, ajuste);
const b64 = (v: ArrayBufferView) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
const selecionar = (s: string, n: number) => {
  const b = Buffer.from(s, "base64");
  return Buffer.concat(resultado.tris.map((t) => b.subarray(t * n, (t + 1) * n))).toString("base64");
};
if (resultado.removidos.length) {
  corpo.semCabeca.malha.i = b64(
    Uint16Array.from(resultado.tris.flatMap((t) => Array.from(A.I.subarray(t * 3, t * 3 + 3)))),
  );
  corpo.semCabeca.malha.c = selecionar(corpo.semCabeca.malha.c, 3);
  if (corpo.semCabeca.malha.uv) corpo.semCabeca.malha.uv = selecionar(corpo.semCabeca.malha.uv, 12);
  if (corpo.mascara) corpo.mascara = selecionar(corpo.mascara, 1);
  writeFileSync(arq, JSON.stringify(pacote));
}
console.log(
  nome + ": " + resultado.removidos.length + " triângulos soltos retirados; superfície, pesos e encaixe preservados.",
);
