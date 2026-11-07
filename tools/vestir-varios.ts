/* v8.0 — roda tools/reduzir-modelo.ts e tools/gerar-animacoes.ts (com "vestir") para vários personagens em sequência.
   Uso:  node tools/vestir-varios.ts <nome> [<nome> …]      (planos tools/modelos/<nome>.json e <nome>_animacoes.json)
   Cada passo num processo separado (o .glb do Tripo de uma folha passa de 1 GB de memória lido inteiro). */
import { execFileSync } from "node:child_process";

for (const nome of process.argv.slice(2)) {
  console.log(`== ${nome}`);
  execFileSync(
    process.execPath,
    ["--max-old-space-size=8192", "tools/reduzir-modelo.ts", `tools/modelos/${nome}.json`],
    {
      stdio: "inherit",
    },
  );
  execFileSync(process.execPath, ["tools/gerar-animacoes.ts", `tools/modelos/${nome}_animacoes.json`], {
    stdio: "inherit",
  });
}
