/** Refina um corpo nos pacotes atuais, preservando os demais modelos e as texturas. */
import { readFileSync, writeFileSync } from "node:fs";
import { refinarOmbrosModelo } from "./lib/refinar-ombros.ts";
import type { DadosAnim } from "../src/render/gl/esqueleto.ts";

const nome = process.argv[2];
if (!nome) throw new Error("Uso: node tools/refinar-ombros.ts corpo_f02");
for (const arquivo of ["src/assets/models/aparencias.json", "src/assets/models/vestidos.json"]) {
  const pacote = JSON.parse(readFileSync(arquivo, "utf8"));
  let total = 0;
  if (pacote.corpos)
    for (const c of pacote.corpos) {
      if (c.nome === nome) total += refinarOmbrosModelo(c.nome, c.semCabeca).pivos;
    }
  if (pacote.modelos)
    for (const m of pacote.modelos) {
      if (m.nome !== nome && !m.nome.startsWith(nome + "__")) continue;
      for (const d of [m.anim, ...Object.values(m.partes ?? {})].filter(Boolean) as DadosAnim[])
        total += refinarOmbrosModelo(m.nome, d).pivos;
    }
  if (total) writeFileSync(arquivo, JSON.stringify(pacote));
  console.log(`${arquivo}: ${total} pivôs refinados`);
}
