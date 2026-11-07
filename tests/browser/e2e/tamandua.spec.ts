/* v7.7 — tamanduá no campo: o alcance para montar/abrir os alforjes é até o corpo (curto), e um item no chão perto vem
   antes dele no E (creatures/tamandua.ts: mountNear; ui/acoes.ts; field/masmorra.ts: interact). */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

const PREPARO =
  "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; if(!__t.econ.mount) __t.econ.mount={name:'Tatu',xp:0,hp:100,sta:100,with:null,since:0,brushDay:0,feedDay:0,bag:null,coat:'selvagem',dirt:0}; d.mount={x:d.px+100,y:d.py,ang:0,mounted:false,st:'idle',ph:0,mv:0,flee:0,hp:100};})()";
const ACOES = "__t.acoesAgora().map(a=>a.tecla+':'+a.texto)";

test("tamanduá: alcance até o corpo; item no chão vem antes dele", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(PREPARO);
  await jogo.esperar(200);
  // 100 de distância do meio das costas (antes contava como perto: 2,1 tiles = 88… e com o lado, mais): longe
  const longe = await jogo.js<string[]>(
    `(()=>{const d=__t.dungeon; d.mount.x=d.px; d.mount.y=d.py+60; return ${ACOES};})()`,
  );
  expect(
    longe.some((a) => /alforjes|Montar/.test(a)),
    "a 60 do lado do corpo: longe",
  ).toBe(false);
  // encostada no flanco: perto
  const perto = await jogo.js<string[]>(
    `(()=>{const d=__t.dungeon; d.mount.x=d.px; d.mount.y=d.py+20; return ${ACOES};})()`,
  );
  expect(perto).toContain("E:Abrir os alforjes");
  expect(perto).toContain("T:Montar");
  // um item no chão aos pés: o E pega o item
  const comItem = await jogo.js<string[]>(
    `(()=>{const d=__t.dungeon; d.loot.push({key:'galho',tier:0,t:0,ttl:0,x:d.px+4,y:d.py,ground:true}); return ${ACOES};})()`,
  );
  expect(comItem[0], "o E pega o item").toMatch(/^E:Pegar/);
  const pegou = await jogo.js<boolean>(
    "(()=>{const d=__t.dungeon,n=d.loot.length; __t.interact(); return d.loot.length===n-1 && !d.invOpen;})()",
  );
  expect(pegou, "pegou o item, não abriu os alforjes").toBe(true);
});
