/* v8.0 — efeitos de estado em 3D (render/gl/status_fx.ts): estrelas do atordoado (douradas) e do caído
   (alaranjadas) como peças da cena, ao lado da heroína; de dia e de noite, no zoom de perto e no normal. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("status em 3D: estrelas do atordoado e do caído", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem as estrelas de texto");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  // lobo e javali atordoados, lobo e cervo caídos, numa fileira acima da heroína
  await jogo.js(`(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0;
    d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2+60; d.invuln=999; __t.world.tick=__t.CONFIG.DAY_MIN*3+12*60;
    __t.D3.ZM=2.2; window.dispatchEvent(new Event('resize'));
    const fila=[];
    fila.push(__t.spawnDungeonMonster());
    __t.spawnJavalino(1); fila.push(d.monsters[d.monsters.length-1]);
    fila.push(__t.spawnDungeonMonster());
    const c=__t.critSpawn('deer'); c.sex='M'; fila.push(c);
    fila.forEach((m,i)=>{ m.x=d.px-110+i*70; m.y=d.py-90; m.ang=0; m._yaw=0; m._yy=0; m.spd=0; m.hp=9999; m.hpMax=9999; m.alive=true; m.retreat=0; });
    window.__fila=fila;
    window.__trava=setInterval(()=>{ fila.forEach((m,i)=>{ m.x=d.px-110+i*70; m.y=d.py-90; m.atk=null;
      if (i<2) { m.st='recover'; m.t=999; m.stun=2.9; m.stunMax=3; m.ko=0; } else { m.st=m.critter?'idle':'recover'; m.t=999; m.ko=5; m.koMax=5; } }); },10);
  })()`);
  await jogo.esperar(900);
  const n = await jogo.js<{ ouro: number; laranja: number }>(
    "(()=>{const L=__t.GL3.list, M=__t.GL3.mesh; return {ouro:L.filter(x=>x.mesh===M.fx_estrela_ouro).length, laranja:L.filter(x=>x.mesh===M.fx_estrela_laranja).length};})()",
  );
  expect(n.ouro, "3 estrelas douradas em cada um dos 2 atordoados").toBe(6);
  expect(n.laranja, "3 estrelas alaranjadas em cada um dos 2 caídos").toBe(6);
  await jogo.foto("status_dia_perto");
  await jogo.js("(()=>{__t.D3.ZM=1; window.dispatchEvent(new Event('resize'));})()");
  await jogo.esperar(400);
  await jogo.foto("status_dia_normal");
  await jogo.js(
    "(()=>{__t.world.tick=__t.CONFIG.DAY_MIN*3+0*60; __t.D3.ZM=2.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(600);
  await jogo.foto("status_noite_perto");
  // contagem: com 1/3 do tempo restando sobra só uma estrela
  await jogo.js(
    "(()=>{clearInterval(window.__trava); const f=window.__fila; window.__trava=setInterval(()=>{ f[0].stun=0.8; f[0].stunMax=3; f[0].st='recover'; f[0].t=999; },10);})()",
  );
  await jogo.esperar(300);
  const so = await jogo.js<number>(
    "(()=>{const m=window.__fila[0]; return __t.GL3.list.filter(x=>x.mesh===__t.GL3.mesh.fx_estrela_ouro && Math.hypot(x.M[12]-m.x, x.M[14]-m.y)<40).length;})()",
  );
  expect(so, "1/3 do atordoamento restando = 1 estrela no primeiro lobo").toBe(1);
  await jogo.js("clearInterval(window.__trava)");
});
