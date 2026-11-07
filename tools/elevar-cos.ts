/** node tools/elevar-cos.ts calca.json corpo.json saida.json [config.json] */
import { readFileSync, writeFileSync } from "node:fs";
import { decodificarAnim, type DadosAnim } from "../src/render/gl/esqueleto.ts";
import { elevarCos, type ExtensaoCos } from "./lib/elevar-cos.ts";
const [entrada, corpoEntrada, saida, configEntrada] = process.argv.slice(2);
if (!entrada || !corpoEntrada || !saida) throw new Error("Uso: calca.json corpo.json saida.json [config.json]");
const camada = JSON.parse(readFileSync(entrada, "utf8")) as DadosAnim;
const corpo = JSON.parse(readFileSync(corpoEntrada, "utf8")) as DadosAnim | { anim: DadosAnim };
const config: ExtensaoCos = configEntrada
  ? (JSON.parse(readFileSync(configEntrada, "utf8")) as ExtensaoCos)
  : {
      alturaBaixa: 24,
      alturaAlta: 28.4,
      folga: 0.14,
      cor: [78 / 255, 43 / 255, 26 / 255],
      branco: [0.5, 1032 / 1040],
    };
const resultado = elevarCos(camada, decodificarAnim("anim" in corpo ? corpo.anim : corpo), config);
writeFileSync(saida, JSON.stringify(resultado));
console.log(`${saida}: ${Buffer.from(resultado.malha.i, "base64").length / 6} triângulos; cobertura do cós incluída`);
