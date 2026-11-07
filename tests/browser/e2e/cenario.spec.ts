/* v7.7 — cenário do campo com os modelos da folha de natureza (render/gl/cenario.ts): árvores, moitas e pedras. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("cenário do campo: árvores e pedras low poly", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem os modelos novos");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.px=d.tile*2.2; d.py=d.rows*d.tile/2; d.mouseC=null; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(900);
  const n = await jogo.js<number>("__t.GL3.scene && __t.GL3.scene.deco ? __t.GL3.scene.deco.n : 0");
  // a cena antiga tinha menos triângulos; com os modelos ela passa de 30 mil vértices
  expect(n, "vértices do cenário").toBeGreaterThan(30000);
  await jogo.foto("cenario_lateral");
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.px=d.tile*2.5; d.py=d.tile*1.2; __t.D3.ZM=1.3; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(600);
  await jogo.foto("cenario_canto");
  await jogo.js("(()=>{__t.D3.ZM=0.55; window.dispatchEvent(new Event('resize'));})()");
  await jogo.esperar(600);
  await jogo.foto("cenario_longe");
});
