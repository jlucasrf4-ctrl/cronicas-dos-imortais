/* 2026-11-07 — corrige nos dados já gerados (src/assets/models/aparencias.json) os triângulos de cabelo com a cor da pele
   na textura (tools/lib/uv-cabelo.ts; o gerador também aplica ao gerar). Sem `--gravar` só lista.
   Uso: node tools/corrigir-uv-cabelo.ts [--gravar] */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { corrigirUvCabelo } from "./lib/uv-cabelo.ts";
import type { AparenciasDados } from "../src/render/gl/aparencias.ts";

const ARQ = "src/assets/models/aparencias.json",
  gravar = process.argv.includes("--gravar"),
  texto = readFileSync(ARQ, "utf8"),
  D = JSON.parse(texto) as AparenciasDados;
const bytes = (s: string) => {
  const b = Buffer.from(s, "base64");
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
};
const cache = new Map<string, { data: Buffer; w: number; h: number }>();
async function textura(url: string) {
  let t = cache.get(url);
  if (!t) {
    const { data, info } = await sharp(Buffer.from(url.split(",")[1], "base64"))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    cache.set(url, (t = { data, w: info.width, h: info.height }));
  }
  return t;
}
let total = 0,
  mudou = false;
for (const cab of D.cabecas ?? []) {
  const url = cab.tex ?? (cab.texDe ? D.texturas?.[cab.texDe] : undefined);
  if (!url || !cab.uv || !cab.mascara || !cab.refPele || !cab.refCabelo) continue;
  const I = new Uint16Array(bytes(cab.i).slice().buffer),
    uv = new Uint16Array(bytes(cab.uv).slice().buffer),
    feitos = corrigirUvCabelo(
      I,
      uv,
      bytes(cab.mascara),
      await textura(url),
      { pele: cab.refPele, cabelo: cab.refCabelo },
      cab.branco,
    );
  if (!feitos.length) continue;
  total += feitos.length;
  console.log(
    `${cab.nome}: ${feitos.length} triângulo(s) de cabelo com cor de pele (${feitos.slice(0, 8).join(", ")})`,
  );
  if (gravar) {
    cab.uv = Buffer.from(uv.buffer, uv.byteOffset, uv.byteLength).toString("base64");
    mudou = true;
  }
}
console.log(total ? `${total} no total${gravar ? ", gravado em " + ARQ : " (use --gravar)"}` : "nada a corrigir");
// o JSON é gravado no mesmo formato (sem espaços), como o gerador grava
if (mudou) writeFileSync(ARQ, JSON.stringify(D) + (texto.endsWith("\n") ? "\n" : ""));
