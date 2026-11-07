/* v8.0 — a deusa da primavera com a pintura do corpo em textura de verdade (build/tmp/deusas_proj.ts --textura,
   tools/juntar-vestidos.ts, animado.ts criarMalhaGL): vestida na sala de treino, de perto. */
import { test, expect, entrarComHeroi } from "./comum.ts";

test("deusa da primavera: textura da pele, de perto", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem os personagens vestidos");
  test.setTimeout(90_000);
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.OPT.autoRes=false; __h.state='field'; __t.updateHeroPanelUI()");
  await jogo.js("document.querySelector('[data-act=\"dtest\"]').click()");
  await jogo.esperar(3800);
  expect(await jogo.js("__t.dungeon.training")).toBeTruthy();
  await jogo.js("document.querySelector('[data-tr=\"min\"]').click()");
  // longe dos manequins, no meio da sala
  await jogo.js("(()=>{const d=__t.dungeon; d.px=d.tile*4; d.py=d.tile*3; d.moveTarget=null; d.monsters.length=0;})()");
  // meio-dia (a luz da hora escurece tudo à noite)
  await jogo.js("(()=>{const D=__t.CONFIG.DAY_MIN; __t.world.tick=Math.floor(__t.world.tick/D)*D+D*0.5;})()");
  await jogo.js("__t.gsRun('PRIMAVERA')");
  await jogo.esperar(800);
  expect(await jogo.js("__t.VESTIDO.atual")).toBe("deusa_primavera");
  const caixa = await jogo.page.locator("#dungeon-view").boundingBox();
  await jogo.page.mouse.move(caixa!.x + caixa!.width / 2, caixa!.y + caixa!.height / 2);
  // zoom de sempre até o máximo e a câmera de perto até o fim (a mochila abre ao lado: fecha com I, a câmera fica)
  for (let i = 0; i < 10; i++) {
    await jogo.page.mouse.wheel(0, -100);
    await jogo.esperar(120);
  }
  await jogo.esperar(800);
  await jogo.page.keyboard.press("i");
  await jogo.esperar(2500);
  await jogo.foto("deusa_perto");
  expect(jogo.erros, "sem erros no console").toEqual([]);
});
