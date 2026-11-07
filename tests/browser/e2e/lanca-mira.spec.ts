/* v8.0 — mira do arremesso da lança com a heroína animada (MIRA_LANCA em render/gl/animado.ts): as pernas seguem o
   andar/parada do esqueleto e só os braços (IK) e o tronco fazem a pose, com a cor do modelo. Antes a mira usava a
   heroína de peças inteira (braços de bloco). Fotos: começando a mirar, carga cheia e andando mirando. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("lança: mirar o arremesso usa a heroína animada", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a heroína animada");
  const ANIM = "__t.GL3.list.some(x=>x.mesh&&x.mesh.n===14340)";
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const w=__t.world; w.tick=Math.floor(w.tick/1440)*1440+12*60; w.paused=true; const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.weapon='melee'; d.cd=0; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1000);
  const PERTO = { x: 500, y: 150, width: 380, height: 330 };
  await jogo.foto("parada_perto", PERTO);
  await jogo.js("__t.spearChargeStart()");
  await jogo.esperar(200);
  await jogo.foto("mira_inicio");
  const anim = await jogo.js<boolean>(ANIM);
  await jogo.esperar(1200);
  await jogo.foto("mira_cheia");
  await jogo.foto("mira_perto", PERTO);
  await jogo.page.keyboard.down("s");
  await jogo.esperar(350);
  await jogo.foto("mira_andando");
  await jogo.page.keyboard.up("s");
  expect(await jogo.js("!!__t.dungeon.spCh"), "ainda mirando").toBe(true);
  expect(anim, "mirando com a malha animada").toBe(true);
});
