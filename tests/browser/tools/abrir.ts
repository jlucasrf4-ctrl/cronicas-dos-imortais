/* Base das ferramentas de navegador (perf/, sim/): abre o build de teste no Chromium com a GPU de verdade e
   devolve a página e um atalho para avaliar código do jogo. Rode da raiz, por exemplo
   `node tests/browser/tools/perf/fps.ts`. `--ref` abre a referência v7.6 em vez de dist/vtest.html.
   Diferente dos specs (tests/browser/e2e), estas ferramentas medem tempo real: imprimem números, não testam. */
import { chromium, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const RAIZ = path.resolve(import.meta.dirname, "../../..");
export const SAIDA = path.join(RAIZ, "tests/browser/resultados/tools");

export interface Sessao {
  browser: Browser;
  page: Page;
  js<T = unknown>(expr: string): Promise<T>;
  esperar(ms: number): Promise<void>;
}

/** Os argumentos da linha de comando, sem as opções `--…`. */
export const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
export const opcao = (nome: string) => process.argv.includes("--" + nome);

export async function abrirJogo(
  opts: { largura?: number; altura?: number; launchArgs?: string[] } = {},
): Promise<Sessao> {
  const arquivo = opcao("ref") ? "reference/vtest_v7.6.html" : "dist/vtest.html";
  // SwiftShader (padrão): a GPU de verdade (--use-angle=d3d11) derrubou esta máquina; passe launchArgs para medir com ela
  const browser = await chromium.launch({ args: opts.launchArgs ?? [] });
  const page = await browser.newPage({ viewport: { width: opts.largura ?? 1366, height: opts.altura ?? 860 } });
  page.on("pageerror", (e) => console.error("erro na página:", e.message));
  await page.goto(pathToFileURL(path.join(RAIZ, arquivo)).href);
  for (let i = 0; i < 300 && !(await page.evaluate("!!window.__t")); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(2000);
  return { browser, page, js: (expr) => page.evaluate(expr), esperar: (ms) => page.waitForTimeout(ms) };
}

/** Entra no jogo com um herói (`__h`) e, se `campo`, numa expedição com 6 lobos (o herói não morre). */
export async function cenario(s: Sessao, qual: "mapa" | "campo" | "campo-aberto" | "mapa-rapido") {
  await s.js("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));");
  await s.esperar(800);
  if (qual === "campo") {
    await s.js("__t.openPrep(__h.id)");
    await s.esperar(500);
    await s.js("document.getElementById('prep-go').click()");
    await s.esperar(3500);
    await s.js("(()=>{const d=__t.dungeon; d.invuln=999; for(let i=0;i<6;i++) __t.spawnDungeonMonster(); })()");
    await s.esperar(800);
  } else if (qual === "campo-aberto") {
    await s.js(
      "__t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=0; __t.jogoEnter()",
    );
    await s.esperar(5000);
  } else if (qual === "mapa-rapido") {
    await s.js("document.querySelector('[data-hs=\"8\"]') && document.querySelector('[data-hs=\"8\"]').click()");
  }
}

/** Quadros por segundo medidos com requestAnimationFrame por `seg` segundos, e o p95 do tempo de quadro. */
export function medirFps(s: Sessao, seg = 4) {
  return s.js<{ fps: number; mediaMs: number; p95Ms: number }>(
    `new Promise(r=>{const ts=[];const t0=performance.now();let ult=t0;function f(t){ts.push(t-ult);ult=t; if(t-t0<${seg * 1000}) requestAnimationFrame(f); else { const a=ts.slice(1).sort((x,y)=>x-y); r({fps:+(a.length/${seg}).toFixed(1), mediaMs:+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(1), p95Ms:+a[Math.floor(a.length*0.95)].toFixed(1)}); } } requestAnimationFrame(f)})`,
  );
}
