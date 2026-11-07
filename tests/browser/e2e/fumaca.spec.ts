/* Smoke tests de navegador, portados dos scripts legacy-py: terr.py (carga sem erros), t106.py/t101.py (mapa com
   herói), t98.py + tgl.py (expedição pelo painel de preparo, com o renderizador WebGL2), t104.py (treino no celular).
   Cada um roda no build e na referência v7.6; a fixture falha se a página lançar erro. */
import { test, expect, entrarComHeroi } from "./comum.ts";

test("carrega e mostra a tela de título", async ({ jogo }) => {
  await expect(jogo.page).toHaveTitle(/Crônicas dos Imortais v7\.6/);
  await jogo.esperar(1500);
  expect(await jogo.js("document.getElementById('title-screen').classList.contains('open')")).toBe(true);
});

test("entra no mapa com um herói e o mundo anda", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  expect(await jogo.js("document.getElementById('title-screen').classList.contains('open')")).toBe(false);
  expect(await jogo.js("__t.world.heroes.length")).toBe(1);
  expect(await jogo.js("__t.world.animals.length")).toBeGreaterThan(0);
  const tick0 = await jogo.js<number>("__t.world.tick");
  await jogo.esperar(1500);
  expect(await jogo.js<number>("__t.world.tick")).toBeGreaterThan(tick0);
  await jogo.page.screenshot({ path: test.info().outputPath("mapa.png") });
});

test("expedição: o preparo abre e o campo inicia em WebGL2", async ({ jogo }) => {
  await entrarComHeroi(jogo);
  expect(await jogo.js("__t.GL3.tried")).toBe(false); // o renderizador 3D só sobe no campo
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(800);
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(3000);
  expect(await jogo.js("__t.dungeon.active")).toBe(true);
  expect(await jogo.js("__t.dungeon.hero && __t.dungeon.hero.id === __h.id")).toBe(true);
  expect(await jogo.js("__t.GL3.ok")).toBe(true);
  await jogo.page.screenshot({ path: test.info().outputPath("campo.png") });
});

test.describe("celular", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test("treino abre na tela deitada", async ({ jogo }) => {
    await entrarComHeroi(jogo);
    await jogo.js("__t.launchTraining(__h.id)");
    await jogo.esperar(3000);
    expect(await jogo.js("__t.dungeon.active")).toBe(true);
    await jogo.page.screenshot({ path: test.info().outputPath("treino-celular.png") });
  });
});
