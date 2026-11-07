/* v8.0 — parry como janela ativa (data/combate.ts PARRY; field/chao.ts doParryBase/parryNaChegada): o clique abre a
   janela e cada golpe de frente é avaliado quando CHEGA (perfeito até PARRY_PERFECT s depois do clique, parcial até
   PARRY_NEAR). Vale para um lobo que começou a morder depois do clique. Perfeito: nenhum dano, o lobo atordoado e só
   PARRY.invul s de invulnerabilidade (era 2,5 s). */
import { test, expect, campoDireto } from "./comum.ts";

test("parry: janela ativa pega cada golpe na chegada, inclusive de quem começou depois", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 avaliava o parry só no clique");
  test.setTimeout(150_000);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(`(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0;
    const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_espada'); __t.eqDurInit(it); e.maoD=it; e.maoE=null; d.weapon='melee';
    // lobos mordendo em t s; 'depois': o 2º só começa a morder depois do clique
    window.__luta = (ts, depois) => new Promise(res => {
      const d=__t.dungeon, T=d.tile;
      d.monsters.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:273};
      d.invuln=0; d.parryCd=0; d.parryT=null; d.cd=0; d.wound=0; d.hp=d.hpMax; d.guard=false; d.dead=false; d.gstam=100; d.lenta=null;
      const hp0=d.hp;
      const mk=(A,t)=>{const m=__t.spawnDungeonMonster(); m.x=d.px+Math.cos(A)*T*0.75; m.y=d.py+Math.sin(A)*T*0.75; m.hp=m.hpMax=999;
        m.ang=Math.atan2(d.py-m.y,d.px-m.x); m.atk='bite'; m.pcd=99; if(t==null){m.st='recover'; m.t=99;} else {m.st='windup'; m.t=t; m.wuTot=0.75;} return m;};
      const L=ts.map((t,i)=>mk(i?0.7:0, depois&&i?null:t));
      __t.doParry();
      if (depois) setTimeout(()=>{ const m=L[1]; m.st='windup'; m.t=ts[1]; m.wuTot=0.75; }, 60);
      setTimeout(()=>{ res({dano: Math.round((hp0-d.hp)*10)/10, n: d.parryN||0, inv: d.invuln, st: L.map(m=>m.st), atord: L.map(m=>m.stun>0)});
        d.monsters.length=0; }, 1500);
    });})()`);
  await jogo.esperar(400);

  const perfeito = await jogo.js<{ dano: number; n: number; atord: boolean[] }>("__luta([0.08])");
  expect(perfeito.dano, "perfeito: sem dano").toBe(0);
  expect(perfeito.n, "contou o perfeito").toBe(1);
  expect(perfeito.atord[0], "lobo atordoado").toBe(true);

  const parcial = await jogo.js<{ dano: number; n: number }>("__luta([0.32])");
  expect(parcial.n, "chegou tarde: não é perfeito").toBe(0);
  expect(parcial.dano, "parcial: leva um pouco").toBeGreaterThan(0);

  const dois = await jogo.js<{ dano: number; n: number; atord: boolean[] }>("__luta([0.05, 0.12])");
  expect(dois.dano, "dois lobos no tempo: sem dano").toBe(0);
  expect(dois.atord, "os dois atordoados").toEqual([true, true]);

  // o 2º lobo só começa a morder 0,06 s depois do clique e chega dentro da janela perfeita
  const depois = await jogo.js<{ dano: number; atord: boolean[] }>("__luta([0.05, 0.06], true)");
  expect(depois.dano, "quem começou depois também é aparado").toBe(0);
  expect(depois.atord[1], "o 2º atordoado").toBe(true);

  // a invulnerabilidade do perfeito é curta
  const inv = await jogo.js<number>(
    "(()=>{const d=__t.dungeon; d.invuln=0; d.parryCd=0; d.monsters.length=0; const m=__t.spawnDungeonMonster(); m.x=d.px+30; m.y=d.py; m.hp=m.hpMax=999; m.ang=Math.PI; m.st='windup'; m.t=0.01; m.atk='bite'; m.pcd=99; __t.doParry(); __t.dungeon.parryT=0.05; __t.wolfStrike(m, null, 3, 0.5); return d.invuln;})()",
  );
  expect(inv, "invulnerável por pouco tempo").toBeLessThanOrEqual(0.4);
  // e o contra-ataque sai logo depois do perfeito (a fatia some em 0,1 s; antes, só depois de toda a janela)
  await jogo.esperar(300);
  const contra = await jogo.js<{ dano: number; estado: string }>(
    "(()=>{const d=__t.dungeon, m=d.monsters[d.monsters.length-1]; d.hitStop=0; m.alive=true; m.hp=m.hpMax=999; m.x=d.px+30; m.y=d.py; d.mouse={x:d.px+100,y:d.py}; const estado=JSON.stringify({cd:d.cd,vis:d.parryVis,down:d.down,noAtk:d.noAtk,crav:!!d.crav,guard:d.guard,w:d.weapon,n:d.monsters.length}); __t.swingBasic(); return {dano:999-m.hp, estado};})()",
  );
  expect(contra.dano, "contra-ataque logo depois do parry " + contra.estado).toBeGreaterThan(0);
  // parry no vazio: a janela fecha sozinha e os golpes voltam
  await jogo.js("(()=>{const d=__t.dungeon; d.monsters.length=0; d.parryCd=0; d.cd=0; __t.doParry();})()");
  await jogo.esperar(1200);
  const vazio = await jogo.js<{ vis: number; dano: number }>(
    "(()=>{const d=__t.dungeon; const vis=d.parryVis; const m=__t.spawnDungeonMonster(); m.hp=m.hpMax=999; m.x=d.px+30; m.y=d.py; m.st='chase'; d.mouse={x:d.px+100,y:d.py}; d.cd=0; __t.swingBasic(); return {vis, dano:999-m.hp};})()",
  );
  expect(vazio.vis, "a fatia do parry apagou").toBeLessThanOrEqual(0);
  expect(vazio.dano, "golpeia de novo").toBeGreaterThan(0);
});

test("esquiva no último instante: perfeita (câmera lenta, fôlego de volta); cedo demais é a comum", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem a esquiva perfeita");
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  const caso = (antes: number) =>
    jogo.js<{
      dano: number;
      lenta: boolean;
      gstam: number;
    }>(`(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0;
      const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_espada'); __t.eqDurInit(it); e.maoD=it; e.maoE=null; d.weapon='melee';
      d.dodge=null; d.dodgeCd=0; d.gstam=80; d.gint=100; d.invuln=0; d.hp=d.hpMax; d.lenta=null; d.parryT=null;
      __t.espacoCorpo(); d.gingaGuard -= ${antes}; const g0=d.gstam, hp0=d.hp;
      const m=__t.spawnDungeonMonster(); m.x=d.px+30; m.y=d.py; m.hp=m.hpMax=999;
      __t.wolfStrike(m, null, 3, 0.5);
      return {dano: hp0-d.hp, lenta: !!d.lenta, gstam: d.gstam-g0};})()`);
  const perfeita = await caso(0.02);
  expect(perfeita.dano, "passou direto").toBe(0);
  expect(perfeita.lenta, "câmera lenta").toBe(true);
  expect(perfeita.gstam, "fôlego de volta").toBeGreaterThan(0);
  await jogo.esperar(400);
  const cedo = await caso(0.2);
  expect(cedo.dano, "também passou direto").toBe(0);
  expect(cedo.lenta, "mas sem a perfeita").toBe(false);
});
