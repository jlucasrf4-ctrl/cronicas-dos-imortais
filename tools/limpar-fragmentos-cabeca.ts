/** Limpeza individual do pacote já gerado, sem regenerar ou alterar as outras aparências.
 * node tools/limpar-fragmentos-cabeca.ts busto_14 busto_16 [--publicar]
 * Sem --publicar grava somente em build/modelos/cabecas-limpas.json. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AparenciasDados } from "../src/render/gl/aparencias.ts";
import { limparFragmentosCabeca, type LimpezaFragmentosCabeca } from "./lib/limpar-fragmentos-cabeca.ts";
const nomes = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!nomes.length) throw new Error("Informe as cabeças com calibração individual, por exemplo busto_14 busto_16.");
const plano = JSON.parse(readFileSync("tools/modelos/aparencias.json", "utf8")) as {
  cabecas: { nome: string; limparFragmentos?: LimpezaFragmentosCabeca }[];
};
const arq = "src/assets/models/aparencias.json",
  pacote = JSON.parse(readFileSync(arq, "utf8")) as AparenciasDados;
const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const relatorio: { nome: string; removidos: number; restantes: number }[] = [];
for (const nome of nomes) {
  const config = plano.cabecas.find((c) => c.nome === nome)?.limparFragmentos,
    cab = pacote.cabecas?.find((c) => c.nome === nome);
  if (!config || !cab) throw new Error("Cabeça sem calibração individual ou ausente: " + nome);
  const P = new Int16Array(bytes(cab.p).buffer),
    I = new Uint16Array(bytes(cab.i).buffer),
    resultado = limparFragmentosCabeca(P, I, config);
  const selecionar = (s: string, tamanho: number) => {
    const b = Buffer.from(s, "base64");
    return Buffer.concat(resultado.tris.map((t) => b.subarray(t * tamanho, (t + 1) * tamanho))).toString("base64");
  };
  if (resultado.removidos.length) {
    cab.i = b64(Uint16Array.from(resultado.tris.flatMap((t) => [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]])));
    cab.c = selecionar(cab.c, 3);
    if (cab.uv) cab.uv = selecionar(cab.uv, 12);
    if (cab.mascara) cab.mascara = selecionar(cab.mascara, 1);
  }
  relatorio.push({ nome, removidos: resultado.removidos.length, restantes: resultado.tris.length });
}
mkdirSync("build/modelos", { recursive: true });
writeFileSync(
  "build/modelos/cabecas-limpas.json",
  JSON.stringify({ cabecas: pacote.cabecas?.filter((c) => nomes.includes(c.nome)) }),
);
if (process.argv.includes("--publicar")) writeFileSync(arq, JSON.stringify(pacote));
console.log(JSON.stringify({ publicado: process.argv.includes("--publicar"), relatorio }, null, 2));
