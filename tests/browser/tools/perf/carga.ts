/* Tempo de carga do arquivo (3 vezes): até o evento load e até o DOMContentLoaded.
   Uso: node tests/browser/tools/perf/carga.ts [arquivo relativo à raiz, padrão dist/vtest.html]
   Substitui o antigo tload.py. */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ, args } from "../abrir.ts";

const url = pathToFileURL(path.join(RAIZ, args[0] ?? "dist/vtest.html")).href;
const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const tempos: number[] = [];
let dcl = 0;
for (let i = 0; i < 3; i++) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load" });
  tempos.push(Date.now() - t0);
  dcl = await page.evaluate("Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)");
  await page.close();
}
console.log("navegação → load (ms)", tempos, "DOMContentLoaded (última)", dcl);
await browser.close();
