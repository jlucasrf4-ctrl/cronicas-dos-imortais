/* v7.7 — itens no chão: o modelo low poly de cada item (render/gl/chao.ts), sem ícone flutuante nem anel amarelo; o
   item que o E vai pegar tem contorno dourado; A+ e SS têm um anel fino na cor da qualidade. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("itens no chão: modelos novos, contorno no mais próximo, brilho de qualidade", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem os modelos novos");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; d.mouseC=null; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(600);
  // uma roda de itens: comuns, A+ e SS; a pedra bem perto (é a que o E pega)
  await jogo.js(`(()=>{const d=__t.dungeon, R=58, ks=[
      ['eq_espada',0],['carne',2],['pena',0],['gema',1],['pele',0],['eq_arco',0],['reliquia',2],['eq_escudo',1],['galho',0],['eq_machado',0]];
    ks.forEach(([k,t],i)=>{const a=i/ks.length*6.283; d.loot.push({key:k,tier:t,t:0,ttl:0,x:d.px+Math.cos(a)*R,y:d.py+Math.sin(a)*R*0.8});});
    d.loot.push({key:'pedra',tier:0,t:0,ttl:0,x:d.px+14,y:d.py+4,ground:true});})()`);
  await jogo.esperar(800);
  const r = await jogo.js<{ dourado: number; branco: number; aneis: number }>(
    "(()=>{const L=__t.GL3.list; return {dourado:L.filter(x=>x.olCor&&x.olEsp>2).length, branco:L.filter(x=>x.olCor&&x.olEsp<2).length, aneis:L.filter(x=>x.mesh&&x.mesh.n===168).length}})()",
  );
  expect(r.dourado, "um item com contorno dourado grosso (o que o E pega)").toBe(1);
  expect(r.branco, "os outros itens com contorno branco").toBe(10);
  expect(r.aneis, "anéis: 4 de qualidade (A+ e SS) + 1 do item que o E pega").toBe(5);
  await jogo.foto("chao_itens");
});
