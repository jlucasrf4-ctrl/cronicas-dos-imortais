import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("parry: Espada 02, perfeito Espada 1, números e seleção no chão", async ({ jogo }) => {
  test.skip(jogo.referencia, "novas animações e marcação 3D");
  test.setTimeout(180000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(`(()=>{
    const d=__t.dungeon; d.monsters.forEach(m=>m.alive=false); __t.spawnDungeonMonster();
    const m=d.monsters.find(m=>m.alive); d.px=300; d.py=270; m.x=340; m.y=270;
    d.target=d.foco=m; d.weapon='melee'; d.dead=false; d.down=0; d.dodge=null;
    d.parryT=0.12; d._parryEm=0;
    window.__aparo=setInterval(()=>{d.parryT=0.12;d._parryEm=0;d.invuln=999;m.st='recover';m.t=99},16);
    window.__textos=[]; const ctx=document.querySelector('#dungeon-canvas').getContext('2d'),fill=ctx.fillText;
    ctx.fillText=function(s,...args){__textos.push(String(s));return fill.call(this,s,...args)};
  })()`);
  await expect.poll(() => jogo.js("__t.heroinaEstado()"), { timeout: 15000 }).toBe("aparo");
  await jogo.js("__t.spawnDungeonToast('-17',__t.dungeon.target.x,__t.dungeon.target.y-30,'#ffe08a',14)");
  await expect.poll(() => jogo.js("__textos.includes('-17')"), { timeout: 10000 }).toBe(true);
  expect(await jogo.js("__textos.some(t=>/^(ALVO|FOCO)/.test(t))")).toBe(false);
  expect(
    await jogo.js(
      "__t.GL3.list.some(i=>i.cast===false && i.tint?.[0]===1 && i.tint?.[1]===0.6 && Math.abs(i.M[13])<0.01)",
    ),
  ).toBe(true);
  await jogo.foto("aparo-espada02-anel-no-chao");
  await jogo.js(
    "clearInterval(__aparo);window.__perfeito=setInterval(()=>{__t.dungeon._parryEm=performance.now()-120},16);__t.dungeon._parryEm=performance.now()-120",
  );
  await expect.poll(() => jogo.js("__t.heroinaEstado()"), { timeout: 15000 }).toBe("aparo_perfeito");
  await jogo.foto("perfeito-espada1");
  await jogo.js("clearInterval(__perfeito)");
});
