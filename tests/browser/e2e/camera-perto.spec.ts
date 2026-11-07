/* v8.0 — câmera de perto: a roda além do zoom máximo leva a câmera até o personagem, de frente (field/tipos.ts
   CZ.perto, renderer.ts vpPerto); afastar desfaz. */
import { test, expect, campoDireto, campoLimpo } from "./comum.ts";

test("câmera de perto: a roda aproxima até ficar de frente para o personagem e volta", async ({ jogo }) => {
  await jogo.js(`__t.enterGame(); window.__h = __t.createHero("Lia", __t.bornFromSeed(777));`);
  await jogo.esperar(800);
  await campoDireto(jogo);
  await campoLimpo(jogo);
  const caixa = await jogo.page.locator("#dungeon-view").boundingBox();
  await jogo.page.mouse.move(caixa!.x + caixa!.width / 2, caixa!.y + caixa!.height / 2);
  await jogo.foto("perto_0");
  // até o zoom máximo de sempre (4 passos) e mais 2: metade do caminho
  for (let i = 0; i < 6; i++) {
    await jogo.page.mouse.wheel(0, -100);
    await jogo.esperar(120);
  }
  await jogo.esperar(1200);
  await jogo.foto("perto_meio");
  for (let i = 0; i < 6; i++) {
    await jogo.page.mouse.wheel(0, -100);
    await jogo.esperar(120);
  }
  await jogo.esperar(1500);
  expect(await jogo.js("document.getElementById('dungeon-stage-wrap').classList.contains('perto')")).toBe(true);
  // no zoom máximo a mochila abre ao lado, sem escurecer, e a personagem vai para a esquerda
  expect(await jogo.js("__t.dungeon.invOpen")).toBe(true);
  expect(await jogo.js("document.getElementById('inv-modal').classList.contains('lateral')")).toBe(true);
  await jogo.foto("perto_mochila");
  for (let i = 0; i < 6; i++) {
    await jogo.page.mouse.wheel(0, 100);
    await jogo.esperar(120);
  }
  await jogo.esperar(1500);
  expect(await jogo.js("document.getElementById('dungeon-stage-wrap').classList.contains('perto')")).toBe(false);
  expect(await jogo.js("__t.dungeon.active"), "afastar desfaz a vista de perto sem sair do campo").toBe(true);
  expect(await jogo.js("__t.dungeon.invOpen"), "afastar fecha a mochila do lado").toBe(false);
  // a tecla I fora do zoom: a mochila de sempre, no meio
  await jogo.page.keyboard.press("i");
  await jogo.esperar(800);
  expect(await jogo.js("document.getElementById('inv-modal').classList.contains('lateral')")).toBe(false);
});
