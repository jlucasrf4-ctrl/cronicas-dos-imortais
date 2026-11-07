import { test, expect, entrarComHeroi } from "./comum.ts";
test("preparação: Dungeon Teste aceita personagem descansando na cabana", async ({ jogo }) => {
  test.skip(jogo.referencia, "entrada de treino atual");
  test.setTimeout(150_000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle();__t.econ.introDone=true;__t.econ.campTut=3;__t.econ.tent=true;__t.enterCamp(__h)");
  await jogo.esperar(3000);
  expect(await jogo.js("__t.dungeon.camp")).toBe(true);
  await jogo.js("__t.openPrep(__h.id);document.getElementById('prep-train').click()");
  await jogo.esperar(3500);
  expect(await jogo.js("__t.dungeon.training")).toBe(true);
});
