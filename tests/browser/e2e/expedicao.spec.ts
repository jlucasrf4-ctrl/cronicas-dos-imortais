/* v7.7 — documento mestre, bloco 4: partir da preparação carrega a expedição (uma entrada no acampamento recusada deixava
   a marca CPS.pending ligada e a próxima partida virava o acampamento); sair da expedição não esvazia mais a mochila no
   baú (bankLoot). */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

test("partir da preparação vai para a expedição mesmo com a marca do acampamento sobrando", async ({ jogo }) => {
  test.skip(jogo.referencia, "correção da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 3;");
  // a marca que sobrava de uma entrada no acampamento recusada
  await jogo.js("__t.CPS.pending = true; __h.state = 'idle'; __t.openPrep(__h.id)");
  await jogo.esperar(400);
  await jogo.js("document.getElementById('prep-go').click()");
  expect(await esperarAte(jogo, "__t.dungeon.active", 5000), "entrou").toBe(true);
  expect(await jogo.js("[__t.dungeon.camp, __t.dungeon.mode]"), "expedição, não acampamento").toEqual([
    false,
    "expedition",
  ]);
});

test("sair da expedição não guarda a mochila no baú", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 3; __t.openPrep(__h.id)");
  await jogo.esperar(400);
  await jogo.js("document.getElementById('prep-go').click()");
  expect(await esperarAte(jogo, "__t.dungeon.active", 5000)).toBe(true);
  const r = await jogo.js<{ antes: number; bau0: number }>(
    "(()=>{const h=__t.dungeon.hero; __t.giveItem(h,'galho',0); __t.giveItem(h,'erva',0); return {antes: __t.ensureInv(h).items.length, bau0: __t.econ.stash.items.length};})()",
  );
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.px=d.entrance.x; d.py=d.entrance.y; __t.bankLoot(); __t.exitDungeon();})()",
  );
  await jogo.esperar(1500);
  const depois = await jogo.js<{ mochila: number; bau: number }>(
    "({mochila: __t.ensureInv(__h).items.length, bau: __t.econ.stash.items.length})",
  );
  expect(depois.mochila, "a mochila ficou com o personagem").toBe(r.antes);
  expect(depois.bau, "o baú não recebeu nada sozinho").toBe(r.bau0);
});
