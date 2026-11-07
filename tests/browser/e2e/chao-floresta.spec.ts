/* v8.0 — o chão do campo aberto (render/gl/mundo_cena.ts, tabela CENA): fotos na mata fechada, no campo aberto e na
   beira d'água, de meio-dia, para o mantenedor aprovar o visual (manchas de terra, folhas, musgo e capim). */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";
import type { Jogo } from "./comum.ts";

/** Procura perto do acampamento um ponto de terra (sem água a 1 casa) onde `cond` (com `f` = densidade da floresta
 *  0..1 e `agua2` = água a 2 casas) vale, e entra no campo lá ao meio-dia. */
async function entrarEm(jogo: Jogo, cond: string) {
  const p = await jogo.js<{ x: number; y: number } | null>(`(()=>{
    const h=__h, e=__t.MUNDO.escala, T=42, A=__t.aguaEm;
    const agua=(x,y,r)=>A(x,y)||A(x+r,y)||A(x-r,y)||A(x,y+r)||A(x,y-r);
    for (let r=0; r<4000; r+=25) for (let a=0;a<6.28;a+=0.2){
      const x=h.camp.x+Math.cos(a)*r, y=h.camp.y+Math.sin(a)*r;
      if (agua(x,y,T*e)) continue;
      const f=__t.densEm(x,y)[0]/255, agua2=agua(x,y,2.5*T*e);
      if (${cond}) return {x,y};
    }
    return null;})()`);
  expect(p, "achou o lugar: " + cond).not.toBeNull();
  await jogo.js(
    `(()=>{const h=__h, w=__t.world; w.tick=Math.floor(w.tick/1440)*1440+12*60; w.paused=true; h.x=${p!.x}; h.y=${p!.y}; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()`,
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 4000)).toBe(true);
  await jogo.js("(()=>{const d=__t.dungeon; d.monsters.length=0; d.flow='x'; d.banner=null;})()");
  await jogo.esperar(2500);
}

async function sair(jogo: Jogo) {
  await jogo.js("__t.exitDungeon()");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 4000)).toBe(true);
  await jogo.esperar(400);
}

test("chão do campo aberto: mata, campo e beira d'água", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não liga o campo ao mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0;");
  expect(await esperarAte(jogo, "__t.MAPART.ready", 8000)).toBe(true);
  await entrarEm(jogo, "f > 0.75");
  await jogo.foto("mata");
  await sair(jogo);
  await entrarEm(jogo, "f < 0.15 && !agua2");
  await jogo.foto("campo");
  await sair(jogo);
  await entrarEm(jogo, "agua2 && f > 0.3");
  await jogo.foto("beira");
});
