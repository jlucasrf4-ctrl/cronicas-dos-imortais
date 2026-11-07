/* Verifica a sintaxe do JS principal de um HTML montado (porta do `node --check` de scripts/build.py).

   Uso:  npm run tools:check-js -- [arquivo.html]      (padrão: dist/game.html)
   Sai com código 1 se o JS for inválido. */
import { readFileSync } from "node:fs";
import { checarSintaxe, scriptPrincipal } from "./lib/html.ts";

const html = process.argv[2] ?? "dist/game.html";
const js = scriptPrincipal(readFileSync(html, "utf8"));
const erro = checarSintaxe(js);
if (erro) {
  console.error(erro);
  console.error(`node --check falhou: JavaScript inválido em ${html}`);
  process.exit(1);
}
console.log(`JS_OK ${html} (${Math.round(Buffer.byteLength(js) / 1024)} KB de JS)`);
