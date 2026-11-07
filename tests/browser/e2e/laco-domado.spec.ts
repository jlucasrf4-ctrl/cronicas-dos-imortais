/* v7.7 — laço: dominado em 2 estados (field/faca_corda.ts, tabela LACO): caído (deitado, arrastado) → levanta domado
   (segue você andando; o fôlego dele volta aos poucos; o G puxa e baixa) → acima de LACO.rebela, cabo de guerra de
   novo; zerado, cai de novo. Segurar G com ele dominado solta a corda. */
import { test, expect, entrarComHeroi, campoDireto, esperarAte } from "./comum.ts";

const estado =
  "(()=>{const d=__t.dungeon,m=d.monsters[0],B=m.bound; return {preso:!!B, dom:!!(B&&B.dom), fase:B?B.fase:null, ko:m.ko||0, fol:m.fol/m.folMax, res:m.folRes==null?1:m.folRes, pinotes:B?B.pinotes||0:0, gstam:d.gstam, gint:d.gint, dist:Math.hypot(m.x-d.px,m.y-d.py)/d.tile};})()";
type Estado = {
  preso: boolean;
  dom: boolean;
  fase: string | null;
  ko: number;
  fol: number;
  res: number;
  pinotes: number;
  gstam: number;
  gint: number;
  dist: number;
};

test("laço: caído → domado andando → rebela → cai de novo → segurar G solta", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 só tem o dominado parado");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize')); __t.spawnDungeonMonster(); const m=d.monsters[0]; m.x=d.px+60; m.y=d.py; __t.ensureFol(m); m.bound={t:0,len:d.tile*3.5,tire:0,_ok:true}; d.gstam=100; d.gint=100; m.fol=0;})()",
  );
  await jogo.esperar(300);
  let e = await jogo.js<Estado>(estado);
  expect(e.fase, "fôlego zerado: caído").toBe("caido");
  expect(e.ko, "deitado").toBeGreaterThan(0);
  await jogo.foto("1_caido");

  // levanta domado; você se afasta e ele vem andando atrás
  await jogo.js("(()=>{const d=__t.dungeon; d.monsters[0].bound.caiT=0.01;})()");
  await jogo.esperar(200);
  await jogo.js("(()=>{const d=__t.dungeon, m=d.monsters[0]; d.px=m.x-d.tile*3.2; d.gstam=100;})()");
  const longe = (await jogo.js<Estado>(estado)).dist;
  await jogo.esperar(900);
  e = await jogo.js<Estado>(estado);
  expect(e.fase).toBe("domado");
  expect(e.ko, "de pé").toBe(0);
  expect(e.dist, "veio andando atrás de você").toBeLessThan(longe - 0.4);
  await jogo.foto("2_domado");

  // DOMA: o interno sobe sozinho; o G (puxão) baixa
  expect(e.res, "levanta com o interno baixo (DOMA.inicio, e já subindo)").toBeLessThan(0.45);
  await jogo.esperar(800);
  const r1 = (await jogo.js<Estado>(estado)).res;
  expect(r1, "o interno sobe").toBeGreaterThan(e.res);
  await jogo.js("__t.dungeon.gstam=100");
  await jogo.page.keyboard.press("KeyG");
  await jogo.esperar(100);
  expect((await jogo.js<Estado>(estado)).res, "o puxão baixou o interno").toBeLessThan(r1);

  // interno cheio com fôlego para segurar: pinote (tira o seu fôlego, continua domado)
  await jogo.js("(()=>{const d=__t.dungeon,m=d.monsters[0]; d.gstam=100; d.gint=100; m.folRes=1;})()");
  await jogo.esperar(200);
  e = await jogo.js<Estado>(estado);
  expect(e.fase, "segurou o pinote").toBe("domado");
  expect(e.pinotes).toBe(1);
  expect(e.res, "o interno baixa depois do pinote").toBeLessThan(0.7);
  expect(e.gstam + e.gint, "o pinote cansou você").toBeLessThan(200);

  // interno cheio sem fôlego: escapa para o cabo de guerra
  await jogo.js("(()=>{const d=__t.dungeon,m=d.monsters[0]; d.gstam=5; m.folRes=1;})()");
  await jogo.esperar(200);
  e = await jogo.js<Estado>(estado);
  expect(e.preso, "ainda na corda").toBe(true);
  expect(e.dom, "escapou: cabo de guerra").toBe(false);
  await jogo.foto("3_pinote");

  // cansado de novo, cai; segurar G solta a corda
  await jogo.js("(()=>{const d=__t.dungeon, m=d.monsters[0]; m.fol=0; d.gstam=100; d.gint=100;})()");
  await jogo.esperar(200);
  expect((await jogo.js<Estado>(estado)).fase, "caiu de novo").toBe("caido");
  // (o relógio do jogo no navegador de teste anda mais devagar: espera a condição, não um tempo fixo)
  await jogo.page.keyboard.down("KeyG");
  const soltou = await esperarAte(jogo, "!__t.dungeon.monsters[0].bound", 6000);
  await jogo.page.keyboard.up("KeyG");
  expect(soltou, "segurar G soltou").toBe(true);
});

test("laço: domado desiste de fugir depois de DOMA.teima (o interno para de subir, sem pinote)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 só tem o dominado parado");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; __t.spawnDungeonMonster(); const m=d.monsters[0]; m.x=d.px+60; m.y=d.py; __t.ensureFol(m); m.bound={t:0,len:d.tile*3.5,tire:0,_ok:true}; d.gstam=100; d.gint=100; m.fol=0;})()",
  );
  await jogo.esperar(300);
  await jogo.js("__t.dungeon.monsters[0].bound.caiT=0.01");
  expect(await esperarAte(jogo, "__t.dungeon.monsters[0].bound.fase==='domado'", 2000)).toBe(true);
  // quase no fim da teimosia
  await jogo.js("__t.dungeon.monsters[0].bound.teima=0.05");
  expect(await esperarAte(jogo, "__t.dungeon.monsters[0].bound.teima===0", 2000), "desistiu").toBe(true);
  const r0 = await jogo.js<number>("__t.dungeon.monsters[0].folRes");
  await jogo.esperar(600);
  expect(await jogo.js<number>("__t.dungeon.monsters[0].folRes"), "o interno não sobe mais").toBeLessThanOrEqual(r0);
  await jogo.js("(()=>{const m=__t.dungeon.monsters[0]; m.folRes=1;})()");
  await jogo.esperar(300);
  const e = await jogo.js<Estado>(estado);
  expect([e.fase, e.pinotes], "cheio, mas desistiu: sem pinote").toEqual(["domado", 0]);
});
