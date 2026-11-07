/* v7.7 — fôlego do bicho em círculo (field/tipos.ts: folAnel): anel = fôlego, círculo de dentro = capacidade de se
   recuperar (cai 25% por queda, até 25%) ou, no chão, o tempo até levantar. Só no bicho marcado/preso. */
import { test, expect, entrarComHeroi, campoDireto, esperarAte } from "./comum.ts";

test("fôlego em círculo: só no marcado; queda baixa a capacidade", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem a barrinha reta");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize')); for(let i=0;i<2;i++){__t.spawnDungeonMonster(); const m=d.monsters[i]; m.x=d.px+50+i*70; m.y=d.py-10; m.st='recover'; m.t=99; __t.ensureFol(m); m.fol=m.folMax*0.6;} d.target=d.monsters[0];})()",
  );
  await jogo.esperar(500);
  await jogo.foto("folego_marcado");
  // duas quedas: a capacidade vai a 50%; no chão o círculo de dentro conta o tempo
  const r = await jogo.js<{ quedas: number; ko: boolean; cap: number }>(
    "(()=>{const m=__t.dungeon.monsters[0]; m.quedas=1; __t.folDrain(m, m.fol+1); return {quedas:m.quedas, ko:m.ko>0, cap:__t.folCap(m)/m.folMax};})()",
  );
  expect(r).toEqual({ quedas: 2, ko: true, cap: 0.5 });
  await jogo.esperar(400);
  await jogo.foto("folego_caido");
});

test("heroína: rolar gasta 1/4 do interno; parar de correr já recupera", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o fôlego interno");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2;})()",
  );
  // v7.7 (documento mestre 2.5): o interno pode zerar — quatro rolamentos (100 → 75 → 50 → 25 → 0); o quinto não sai
  const g = await jogo.js<number[]>(
    "(()=>{const d=__t.dungeon, r=[]; d.weapon='bow'; d.gint=100; d.gstam=100; for(let i=0;i<5;i++){d.dodge=null; d.dodgeCd=0; d.gstam=100; __t.bowRoll(); r.push(Math.round(d.gint));} d.dodge=null; return r;})()",
  );
  expect(g).toEqual([75, 50, 25, 0, 0]);
  // correndo (Shift + D) e soltando: logo depois o fôlego já subiu
  await jogo.js("(()=>{const d=__t.dungeon; d.gint=100; d.gstam=100; d.gregen=0; d.dodgeCd=0;})()");
  await jogo.page.keyboard.down("Shift");
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(700);
  const correndo = await jogo.js<{ run: boolean; g: number }>("({run:!!__t.dungeon.running, g:__t.dungeon.gstam})");
  await jogo.page.keyboard.up("Shift");
  await jogo.page.keyboard.up("KeyD");
  await jogo.esperar(250);
  const depois = await jogo.js<number>("__t.dungeon.gstam");
  expect(correndo.run, "correu").toBe(true);
  expect(correndo.g, "correr gastou").toBeLessThan(100);
  expect(depois, "o fôlego volta logo depois de parar de correr").toBeGreaterThan(correndo.g);
  // v8.0: interno baixo não mexe no de fora; zerar o interno derruba o de fora; o interno só sobe com o de fora cheio
  await jogo.js("(()=>{const d=__t.dungeon; d.gint=30; d.gstam=100; d.gregen=0;})()");
  await jogo.esperar(150);
  expect(await jogo.js<number>("__t.dungeon.gstam"), "interno baixo, fora cheio").toBe(100);
  await jogo.js("(()=>{const d=__t.dungeon; d.gint=0; d.gstam=100; d.gregen=0;})()");
  expect(await esperarAte(jogo, "__t.dungeon.gstam<=0", 8000), "zerar o interno derrubou o de fora").toBe(true);
  expect(await jogo.js<number>("__t.dungeon.gint"), "o interno espera o de fora encher").toBe(0);
  expect(await esperarAte(jogo, "__t.dungeon.gint>0", 15000), "de fora cheio, o interno sobe").toBe(true);
  expect(await jogo.js<number>("__t.dungeon.gstam"), "o de fora já estava cheio").toBeGreaterThanOrEqual(99.99);
});

test("laço: cabo de guerra gasta primeiro o interno dos dois; zerar o seu solta a corda", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem a barra de fuga");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize')); __t.spawnDungeonMonster(); const m=d.monsters[0]; m.x=d.px+70; m.y=d.py; __t.ensureFol(m); m.bound={t:0,len:d.tile*2.5,tire:0,_ok:true}; d.gstam=100; d.gint=100;})()",
  );
  await jogo.esperar(1500);
  const r = await jogo.js<{ gint: number; gstam: number; res: number; dom: boolean }>(
    "(()=>{const d=__t.dungeon,m=d.monsters[0]; return {gint:d.gint, gstam:d.gstam, res:m.folRes, dom:!!(m.bound&&m.bound.dom)};})()",
  );
  expect(r.gint, "seu interno caiu").toBeLessThan(100);
  expect(r.res, "o interno do bicho caiu").toBeLessThan(1);
  await jogo.foto("folego_corda");
  // sem fôlego: a corda escapa
  await jogo.js("(()=>{const d=__t.dungeon; d.gint=25; d.gstam=0.5;})()");
  await jogo.esperar(600);
  expect(await jogo.js("!__t.dungeon.monsters[0].bound"), "a corda escapou").toBe(true);
});
