/* Base dos testes de navegador: a fixture `jogo` abre o arquivo do projeto (build ou referência, ver
   playwright.config.ts), espera o gancho window.__t e, no fim do teste, falha se a página lançou algum erro
   (ou escreveu um console.error).
   O código do jogo é passado a page.evaluate como texto (como nos antigos scripts legacy-py): roda igual no
   build e na referência, e não precisa dos tipos do jogo. Os testes guardam valores em `window.__x` entre
   chamadas, como os scripts faziam. */
import { test as base, expect, type Page } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.resolve(import.meta.dirname, "../../..");

export interface Jogo {
  page: Page;
  erros: string[];
  /** Avalia uma expressão JS na página (o gancho do jogo é `__t`). */
  js<T = unknown>(expr: string): Promise<T>;
  /** Avança o relógio real, para o laço do jogo rodar. */
  esperar(ms: number): Promise<void>;
  /** Captura de tela em tests/browser/resultados/<teste>/<nome>.png (anexada ao relatório). */
  foto(nome: string, clip?: { x: number; y: number; width: number; height: number }): Promise<void>;
  /** Caixa do elemento (falha se ele não estiver na tela). */
  caixa(seletor: string): Promise<{ x: number; y: number; width: number; height: number }>;
  /** true no projeto da referência v7.6. */
  referencia: boolean;
  /** true se `__t.<nome>` existe (nomes acrescentados ao gancho depois da v7.6 faltam na referência). */
  tem(nome: string): Promise<boolean>;
}

export const test = base.extend<{ jogo: Jogo; relogio: "real" | "simulado" }>({
  /* Relógio "real" (padrão): o jogo roda no tempo do navegador, como os scripts legacy-py. Com a GPU de verdade
     (playwright.config.ts) os quadros saem a ~60 fps; um teste que monta uma situação e age nela faz as duas
     coisas no mesmo jogo.js, porque entre duas chamadas o laço do jogo anda.
     "simulado" (`test.use({ relogio: "simulado" })`): requestAnimationFrame, timers, Date e performance.now só
     andam com esperar(), em quadros de 16 ms; o resultado não depende da carga da máquina, mas cada quadro é
     desenhado, então fica ~2,5× mais lento que o tempo real. */
  relogio: ["real", { option: true }],
  jogo: async ({ page, relogio }, use, info) => {
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.stack || String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") erros.push("console.error: " + m.text());
    });
    const simulado = relogio === "simulado";
    if (simulado) await page.clock.install();
    const arquivo = path.join(RAIZ, String(info.project.metadata.arquivo));
    await page.goto(pathToFileURL(arquivo).href);
    for (let i = 0; i < 300 && !(await page.evaluate("!!window.__t")); i++) await page.waitForTimeout(100);
    expect(await page.evaluate("!!window.__t"), "gancho __t").toBe(true);
    const esperar = (ms: number) => (simulado ? page.clock.runFor(ms) : page.waitForTimeout(ms));
    await esperar(2000); // timers da carga (o que os scripts esperavam com wait_for_timeout)
    const jogo: Jogo = {
      page,
      erros,
      js: (expr) => page.evaluate(expr),
      esperar,
      foto: async (nome, clip) => {
        const arq = info.outputPath(nome + ".png");
        await page.screenshot({ path: arq, clip });
        await info.attach(nome, { path: arq, contentType: "image/png" });
      },
      caixa: async (seletor) => {
        const b = await page.locator(seletor).first().boundingBox();
        expect(b, "caixa de " + seletor).not.toBeNull();
        return b!;
      },
      referencia: info.project.name === "v7.6",
      tem: (nome) => page.evaluate(`typeof __t[${JSON.stringify(nome)}] !== "undefined"`),
    };
    await use(jogo);
    expect(erros, "erros de página").toEqual([]);
  },
});

/** Entra no jogo e cria um herói (semente fixa); o herói fica em `window.__h`. `teste` liga `econ.test`. */
export async function entrarComHeroi(jogo: Jogo, nome = "Ayla", semente = 777, teste = false) {
  await jogo.js(
    // a aparência sorteada sai: as specs medem e fotografam a heroína base (malha, mãos, peças presas)
    `__t.enterGame(); ${teste ? "__t.econ.test = true;" : ""} window.__h = __t.createHero(${JSON.stringify(nome)}, __t.bornFromSeed(${semente})); delete __h.visual;`,
  );
  await jogo.esperar(800);
}

/** Abre o preparo do herói `__h` e clica em "Partir": entra no campo (expedição). */
export async function irAoCampo(jogo: Jogo, espera = 3000) {
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(600);
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(espera);
  expect(await jogo.js("__t.dungeon.active"), "campo ativo").toBe(true);
}

/** Campo pela entrada antiga (`launchDungeon`, sem o painel de preparo). Os scripts que usavam essa entrada são
    de antes da tela de título: ela é fechada aqui, senão fica por cima do campo e recebe o mouse. */
export async function campoDireto(jogo: Jogo, espera = 2600) {
  await jogo.js("__t.closeTitle(); __t.launchDungeon(__h.id)");
  await jogo.esperar(espera);
  expect(await jogo.js("__t.dungeon.active"), "campo ativo").toBe(true);
}

/** Campo limpo: sem hordas nem banner, sem monstros. */
export async function campoLimpo(jogo: Jogo) {
  await jogo.js("(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0;})()");
}

/** Avança o jogo em passos de `passo` ms até `expr` ser verdadeira (ou `maxMs`); devolve se chegou lá. */
export async function esperarAte(jogo: Jogo, expr: string, maxMs: number, passo = 250) {
  for (let t = 0; t <= maxMs; t += passo) {
    if (await jogo.js<boolean>(`!!(${expr})`)) return true;
    await jogo.esperar(passo);
  }
  return jogo.js<boolean>(`!!(${expr})`);
}

/** Clica em "+1h" e espera a hora passar (v7.7: o avanço rápido roda em vários quadros, com teto de tempo por quadro). */
export async function avancarHora(jogo: Jogo) {
  await jogo.js("document.getElementById('ff-hour').click()");
  await esperarAte(jogo, "__t.world.fastForwardTarget <= 0", 8000, 50);
}

/** Passa as falas abertas da cena da intro (`ISC.dlg`), até `max` vezes. */
export async function passarDialogo(jogo: Jogo, max = 10) {
  for (let i = 0; i < max; i++) {
    if (!(await jogo.js("!!__t.ISC.dlg"))) return;
    await jogo.js("__t.dlgAdvance(); __t.dlgAdvance()");
    await jogo.esperar(200);
  }
}

/** Começa a cena da intro (javali, caçador, erva, flechas, faca) com um herói novo em `__h`. */
export async function comecarIntro(jogo: Jogo) {
  await jogo.js(
    "__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=false; __t.introStart(__h)",
  );
}

/** v7.7 — E perto de um lobo do acampamento abre o menu dele (campanha/cercado.ts); clica na opção com `texto`
    (sem `texto`, só abre). Devolve os textos das opções que havia. */
export async function menuLobo(jogo: Jogo, texto?: string) {
  await jogo.page.keyboard.press("KeyE");
  await jogo.page.waitForSelector("#lobo-menu", { timeout: 2000 });
  const opcoes = await jogo.page.locator("#lobo-menu button").allTextContents();
  if (texto) await jogo.page.locator("#lobo-menu button", { hasText: texto }).click();
  return opcoes;
}
/** v7.7 — menu do lobo → Dar comida → na mochila, "Dar ao lobo" com a primeira `chave` (carne, peixe…). */
export async function darComidaAoLobo(jogo: Jogo, chave = "carne") {
  await menuLobo(jogo, "Dar comida");
  expect(await esperarAte(jogo, "__t.dungeon.invOpen", 2000), "a mochila abriu").toBe(true);
  await jogo.js(
    `(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='${chave}'); const g=[...document.querySelectorAll('*')].find(e=>e._gr&&e._gr.inv===inv); __t.invItemMenu(it, g._gr, 300, 300);})()`,
  );
  await jogo.page.click("#inv-menu [data-a=lobo]");
  await jogo.esperar(200);
}

export { expect };
