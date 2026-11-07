/* v7.7 — animais do campo com os modelos animados do pacote craftpix (render/gl/bichos.ts): lobo (com pelagens),
   javali, cervo macho e fêmea, coelho. Parados, andando e o lobo no bote. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("bichos animados: lobo, javali, cervos e coelho no campo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem os bichos de peças");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  // uma fileira parada perto da heroína: 3 lobos de pelagens diferentes, javali, cervo macho, cerva, coelho
  await jogo.js(`(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0;
    d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2+60; d.invuln=999; __t.D3.ZM=2.2; window.dispatchEvent(new Event('resize'));
    const fila=[];
    for (const c of [0,2,3]) { const m=__t.spawnDungeonMonster(); m.coat=c; fila.push(m); }
    __t.spawnJavalino(1); fila.push(d.monsters[d.monsters.length-1]);
    for (const [sp,sx] of [['deer','M'],['deer','F'],['rabbit','M']]) { const m=__t.critSpawn(sp); m.sex=sx; fila.push(m); }
    fila.forEach((m,i)=>{ m.x=d.px-220+i*62; m.y=d.py-90; m.ang=0; m._yaw=0; m._yy=0; m.st=m.critter?'idle':'recover'; m.t=999; m.spd=0; m.hp=9999; m.alive=true; m.retreat=0; });
    window.__fila=fila;
    window.__trava=setInterval(()=>{ fila.forEach((m,i)=>{ m.x=d.px-220+i*62; m.y=d.py-90; m.st=m.critter?'idle':'recover'; m.t=999; m.atk=null; }); },10);
  })()`);
  await jogo.esperar(900);
  const n = await jogo.js<number>(
    "__t.GL3.list.filter(x=>x.mesh && x.mesh.n>2500 && x.mesh.n<6000 && !x.mesh.stat).length",
  );
  expect(n, "os 7 bichos com malha animada (2,5 a 6 mil vértices)").toBeGreaterThanOrEqual(7);
  await jogo.foto("bichos_parados");
  // andando: a fileira anda para a direita
  await jogo.js(`(()=>{clearInterval(window.__trava); const d=__t.dungeon, f=window.__fila; let k=0;
    window.__trava=setInterval(()=>{ k+=1; f.forEach((m,i)=>{ m.x=d.px-220+i*62+ (k%120)*0.9; m.y=d.py-90; m.t=999; m.st=m.critter?'idle':'recover'; }); },16);})()`);
  await jogo.esperar(700);
  await jogo.foto("bichos_andando");
  // o primeiro lobo no bote
  await jogo.js(
    "(()=>{clearInterval(window.__trava); const d=__t.dungeon, m=window.__fila[0]; m.st='leap'; m.lx=m.x+200; m.ly=m.y; m.l0=200; m.lt=0; m.hit=false; m.lpr=null;})()",
  );
  await jogo.esperar(150);
  await jogo.foto("lobo_bote");
});
