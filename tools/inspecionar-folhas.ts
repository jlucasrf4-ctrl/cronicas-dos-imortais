/* v8.1 — prévias das folhas de personagens antes de separar ou alterar seus modelos. */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { lerGLB, desenhar, amostra, caixa } from "./lib/glb.ts";

const pasta = "arquivos de transferência/3.11.2026";
const saida = "build/inspecao-personagens";
mkdirSync(saida, { recursive: true });
const registro = [];
for (const nome of readdirSync(pasta).filter((n) => /head|Cabe|character|peasant|armor|afdf|dragon|griffin/.test(n))) {
  console.log(nome);
  const m = await lerGLB(join(pasta, nome), 1024);
  const arq = basename(nome, ".glb").replace(/[^a-zA-Z0-9_-]/g, "_");
  await desenhar(
    join(saida, arq + ".png"),
    m.P,
    m.I,
    (t) => {
      const v = m.I[t * 3];
      return amostra(m, m.T[v * 2], m.T[v * 2 + 1]);
    },
    { W: 1000 },
  );
  registro.push({ nome, caixa: caixa(m.P), triangulos: m.I.length / 3, previa: arq + ".png" });
}
writeFileSync(join(saida, "folhas.json"), JSON.stringify(registro, null, 2));
