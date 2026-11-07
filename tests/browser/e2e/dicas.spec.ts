/* v7.7 — dicas no quadradinho do canto (src/ui/dicas.ts): uma por vez, some quando a ação é feita (✓), a de
   situação (pegar) passa na frente; o texto grande de controles não abre mais sozinho. */
import { test, expect, entrarComHeroi, campoDireto, esperarAte } from "./comum.ts";

const dica = "(()=>{const e=document.getElementById('dica'); return e&&e.classList.contains('on')?e.textContent:''})()";

test("dicas: uma por vez, somem quando a ação é feita", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o quadradinho de dicas");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; __t.econ.dicas={};})()",
  );
  expect(await jogo.js<boolean>("document.getElementById('dungeon-hint').classList.contains('show')")).toBe(false);
  await esperarAte(jogo, `${dica}.includes('andar')`, 4000);
  await jogo.foto("dica_andar");
  await jogo.page.keyboard.down("w");
  await jogo.esperar(150);
  await jogo.page.keyboard.up("w");
  expect(await jogo.js<boolean>("!!__t.econ.dicas.andar")).toBe(true);
  expect(await jogo.js<string>(dica)).toContain("✓");
  // item no pé: a dica de pegar passa na frente da de correr
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.loot.push({key:'galho',tier:0,t:0,ttl:0,x:d.px+10,y:d.py,ground:true});})()",
  );
  await esperarAte(jogo, `${dica}.includes('pegar')`, 5000);
  await jogo.foto("dica_pegar");
});
