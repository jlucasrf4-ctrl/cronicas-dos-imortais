/* v7.7 — o lobo que a heroína leva pelo mapa (campanha/cercado.ts: LoboCercado.comHeroi, desenharLoboCarregado):
   saindo do campo com ele na corda ele fica com ela no mapa (desenhado ao lado, na corda) e só entra no cercado
   quando ela chega ao acampamento. */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

test("lobo carregado: vai com a heroína pelo mapa e entra no cercado quando ela chega", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  // longe da base, com o lobo na corda
  await jogo.js(
    "(()=>{__t.closeTitle(); const e=__t.econ, h=__h; e.introDone=true; e.campTut=3; e.tent=true; e.lobos=[{sexo:'M',pelagem:1,vinculo:0,dono:'cacador',desde:__t.world.tick,comHeroi:h.id}]; h.state='field'; h.task=null; h.walkTo=null; h.x=h.camp.x+60; h.y=h.camp.y+10; const c=__t.camera, vp=document.getElementById('viewport'), s=c.maxScale*0.7; c.scale=s; c.tx=vp.clientWidth/2-h.x*s; c.ty=vp.clientHeight/2-h.y*s; __t.applyCameraTransform();})()",
  );
  await jogo.esperar(1500);
  expect(await jogo.js("__t.econ.lobos[0].comHeroi"), "ainda com ela").toBe(await jogo.js("__h.id"));
  await jogo.foto("lobo-no-mapa");
  // chegou ao acampamento (parada nele): o lobo vai para o cercado
  await jogo.js("(()=>{const h=__h; h.x=h.camp.x; h.y=h.camp.y; h.state='idle';})()");
  expect(await esperarAte(jogo, "!__t.econ.lobos[0].comHeroi", 2000), "foi para o cercado").toBe(true);
  expect(await jogo.js("__t.world.events.slice(-3).map(e=>e.text).join(' | ')")).toContain(
    "levou o lobo para o cercado",
  );
});
