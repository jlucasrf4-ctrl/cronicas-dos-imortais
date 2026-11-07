/* v8.1 — clips do boneco genérico do Mixamo na heroína animada (mantenedor, 2026-10-31): a derrubada do javali
   (Scissor Kick), o passo de guarda para trás (Step Backward) e a guarda baixa da mira da lança (Sword Fight One).
   Confere os estados e tira fotos para comparar a olho. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

const PREPARO =
  "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:273}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()";

test("heroína animada: derrubada do javali, recuar em guarda e mira da lança", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a heroína animada");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(PREPARO);
  await jogo.esperar(1200);

  // derrubada: um javalino à direita acerta a investida
  const dur = await jogo.js<number>(
    "(()=>{const d=__t.dungeon; const m=__t.spawnJavalino(1); m.x=d.px+40; m.y=d.py; m.st='charge'; m.hit=true; __t.boarHit(m); m.st='wander'; m.acalmarT=30; return d.down;})()",
  );
  expect(dur, "derrubada de 1,8 s").toBeCloseTo(1.8, 1);
  await jogo.esperar(150);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "toca a derrubada").toBe("derrubada");
  await jogo.foto("derrubada_voo");
  await jogo.esperar(450);
  await jogo.foto("derrubada_chao");
  await jogo.esperar(600);
  await jogo.foto("derrubada_levantando");
  await jogo.esperar(1100);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "levantou").not.toBe("derrubada");
  await jogo.js("(()=>{const d=__t.dungeon; d.monsters.length=0; d.dazed=0;})()");

  // recuar: com alvo fixado à direita (mira para lá), andar para a esquerda
  await jogo.js(
    "(()=>{const d=__t.dungeon; const m=__t.spawnJavalino(1); m.x=d.px+120; m.y=d.py; m.st='wander'; m.acalmarT=30; m.target={x:m.x,y:m.y}; d.target=m;})()",
  );
  await jogo.esperar(400);
  await jogo.page.keyboard.down("a");
  await jogo.esperar(500);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "passo de guarda para trás").toBe("recuar");
  await jogo.foto("recuar_1");
  await jogo.esperar(200);
  await jogo.foto("recuar_2");
  await jogo.page.keyboard.up("a");
  await jogo.js("(()=>{const d=__t.dungeon; d.monsters.length=0; d.target=null;})()");
  await jogo.esperar(500);

  // mira da lança parada
  await jogo.js(
    "(()=>{const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.weapon='melee'; d.cd=0;})()",
  );
  await jogo.esperar(400);
  await jogo.js("__t.spearChargeStart()");
  await jogo.esperar(900);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "guarda baixa da mira").toBe("lanca_mira");
  await jogo.foto("lanca_mira");
  await jogo.js("(()=>{__t.dungeon.spCh=null;})()");
});
