/* descartável: fotos das fitas da deusa (frente, costas, de perto) */
import { test, entrarComHeroi } from "./comum.ts";

test("fitas da deusa: fotos", async ({ jogo }) => {
  test.setTimeout(120_000);
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.OPT.autoRes=false; __h.state='field'; __t.updateHeroPanelUI()");
  await jogo.js("document.querySelector('[data-act=\"dtest\"]').click()");
  await jogo.esperar(3800);
  await jogo.js("document.querySelector('[data-tr=\"min\"]').click()");
  await jogo.js("(()=>{const d=__t.dungeon; d.px=d.tile*4; d.py=d.tile*3; d.moveTarget=null; d.monsters.length=0;})()");
  await jogo.js("(()=>{const D=__t.CONFIG.DAY_MIN; __t.world.tick=Math.floor(__t.world.tick/D)*D+D*0.5;})()");
  await jogo.js("__t.gsRun('OUTONO')");
  await jogo.esperar(800);
  const c = (await jogo.page.locator("#dungeon-view").boundingBox())!;
  await jogo.page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  for (let i = 0; i < 4; i++) {
    await jogo.page.mouse.wheel(0, -100);
    await jogo.esperar(120);
  }
  // mira para baixo (vira para a câmera) e para cima (de costas)
  await jogo.page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.95);
  await jogo.esperar(1500);
  await jogo.foto("fitas_frente");
  await jogo.page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.05);
  await jogo.esperar(1500);
  await jogo.foto("fitas_costas");
  await jogo.page.mouse.move(c.x + c.width * 0.98, c.y + c.height / 2);
  await jogo.esperar(1500);
  await jogo.foto("fitas_lado");
  await jogo.page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  for (let i = 0; i < 8; i++) {
    await jogo.page.mouse.wheel(0, -100);
    await jogo.esperar(120);
  }
  await jogo.esperar(800);
  await jogo.page.keyboard.press("i");
  await jogo.esperar(2500);
  await jogo.foto("fitas_perto");
});
