/* Build do jogo na memória, com a API do Vite (a mesma configuração de `npm run build`, sem gravar em dist/).
   Desde a Fase 4 o JS passa pelo empacotador, então os testes conferem o que o navegador recebe de verdade. */
import { build, type Rollup } from "vite";

const cache = new Map<boolean, Promise<string>>();

/** O HTML único do jogo (teste = com window.__t, como dist/vtest.html). */
export function construirJogo(op: { teste: boolean }): Promise<string> {
  let p = cache.get(op.teste);
  if (!p) cache.set(op.teste, (p = construir(op.teste)));
  return p;
}

async function construir(teste: boolean): Promise<string> {
  const r = await build({
    configFile: "vite.config.ts",
    mode: teste ? "test" : "production",
    logLevel: "silent",
    build: { write: false },
  });
  const saidas = (Array.isArray(r) ? r : [r]) as Rollup.RollupOutput[];
  const html = saidas.flatMap((s) => s.output).find((o) => o.fileName === "index.html");
  if (!html || html.type !== "asset") throw new Error("build sem index.html");
  return String(html.source);
}
