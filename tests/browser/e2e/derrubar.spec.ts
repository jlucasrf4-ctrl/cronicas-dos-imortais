/* v8.0 — derrubar e finalizar (análise de combate do mantenedor, 2026-10-24; data/combate.ts DANO.FOLEGO, FINALIZAR,
   DANO.CRAVAR.flecha; field/rastro.ts sangue): o dano derruba mais devagar (~75% da vida, era ~45%); o finalizar só
   mata lobo com pouca vida (com muita, golpe fundo e ele levanta), bicho de caça sempre; a flecha cravada tira uma
   fração do fôlego (não derruba o cervo sozinha); bicho ferido deixa sangue no chão. */
import { test, expect, campoDireto } from "./comum.ts";

test("derrubar pede mais golpes; finalizar só mata com pouca vida; flecha cansa; ferido sangra", async ({ jogo }) => {
  test.skip(jogo.referencia, "regras novas da v8.0");
  test.setTimeout(120_000);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  // golpes de espada (perícia 10) até o lobo cair: eram 2,0 em média
  const golpes = await jogo.js<number>(`(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0;
    const h=d.hero, e=__t.ensureEquip(h); const it=__t.mkItem('eq_espada'); __t.eqDurInit(it); e.maoD=it; d.weapon='melee'; h.skills.espada={level:10,xp:0};
    let soma=0;
    for (let r=0;r<30;r++){ const m=__t.spawnDungeonMonster(); m.x=d.px+400; m.y=d.py; m.hp=m.hpMax; m.st='chase'; let g=0;
      while (m.alive && !(m.ko>0) && g<40){ __t.hurtMonster(m, __t.meleeDmg(h), 'espada', 0); m.bleed=null; g++; }
      soma+=g; d.monsters.length=0; }
    return soma/30;})()`);
  expect(golpes, "precisa de mais golpes para cair").toBeGreaterThan(2.6);

  // finalizar: lobo caído com 80% da vida não morre (golpe fundo, levanta); com 20% morre; cervo sempre morre
  const fin = await jogo.js<{ cheio: [boolean, number]; pouca: boolean; cervo: boolean }>(`(()=>{const d=__t.dungeon;
    const caso=(m, hpFrac)=>{ m.hp=m.hpMax*hpFrac; m.ko=5; m.x=d.px+30; m.y=d.py; d.finish={m, t:0, dur:0.4, ang:0};
      for (let i=0;i<12;i++) __t.finishTick(0.1); d.finish=null; d.hitStop=0; d.lenta=null; return m; };
    const a=caso(__t.spawnDungeonMonster(), 0.8);
    const b=caso(__t.spawnDungeonMonster(), 0.2);
    const c=caso(__t.critSpawn('deer'), 0.8);
    const r={cheio:[a.alive, Math.round(a.hp/a.hpMax*100)], pouca:b.alive, cervo:c.alive}; d.monsters.length=0; return r;})()`);
  expect(fin.cheio[0], "lobo com muita vida sobrevive ao finalizar").toBe(true);
  expect(fin.cheio[1], "mas leva o golpe fundo (30%)").toBeLessThanOrEqual(51);
  expect(fin.pouca, "com pouca vida morre").toBe(false);
  expect(fin.cervo, "bicho de caça sempre morre").toBe(false);

  // flecha cravada no cervo: tira 25% do fôlego dele em 5 s (não derruba sozinha); carga cheia, 45%
  const fl = await jogo.js<{ comum: number; cheia: number; caiu: boolean }>(`(()=>{const d=__t.dungeon;
    const tira=(full)=>{ const m=__t.critSpawn('deer'); __t.ensureFol(m); m.x=d.px+400; m.y=d.py;
      for (let i=0;i<40 && !(m.stk&&m.stk.length);i++) __t.arrowStick(m, {vx:1, vy:0, full}, 3);
      const f0=m.fol; for (let i=0;i<5;i++) __t.stickTick(m, 1);
      const r={frac:(f0-m.fol)/m.folMax, caiu: m.ko>0}; d.monsters=d.monsters.filter(o=>o!==m); return r; };
    const a=tira(false), b=tira(true); return {comum:a.frac, cheia:b.frac, caiu:a.caiu};})()`);
  expect(fl.comum, "flecha comum: ~25% do fôlego").toBeCloseTo(0.25, 1);
  expect(fl.cheia, "carga cheia: ~45%").toBeCloseTo(0.45, 1);
  expect(fl.caiu, "uma flecha comum não derruba sozinha").toBe(false);

  // bicho ferido deixa sangue pelo caminho
  const sangue = await jogo.js<number>(`(()=>{const d=__t.dungeon; d.mode='campo'; d.sangue=[];
    const m=__t.critSpawn('deer'); m.ferido=10; m.x=d.px+200; m.y=d.py; return 0;})()`);
  expect(sangue).toBe(0);
  for (let i = 0; i < 4; i++) {
    await jogo.js(
      "(()=>{const m=__t.dungeon.monsters.find(o=>o.ferido>0); if(m){m.x+=__t.dungeon.tile*1.5; m.ferido=10;}})()",
    );
    await jogo.esperar(250);
  }
  expect(await jogo.js<number>("(__t.dungeon.sangue||[]).length"), "gotas de sangue no chão").toBeGreaterThan(1);

  // sangramento: proporcional ao corte, acumula até 3 cortes e no máximo 35% da vida; no Alfa vale também
  const sg = await jogo.js<{ um: number; tres: number; cinco: number; alfa: number }>(`(()=>{const d=__t.dungeon;
    const m=__t.spawnDungeonMonster(); m.hp=m.hpMax=22;
    __t.applyBleed(m, 2); const um=m.bleed.rem; __t.applyBleed(m, 2); __t.applyBleed(m, 2); const tres=m.bleed.rem;
    __t.applyBleed(m, 2); __t.applyBleed(m, 2); const cinco=m.bleed.rem;
    const a=__t.spawnDungeonMonster({boss:true}); __t.applyBleed(a, 8); const alfa=a.bleed.rem;
    d.monsters.length=0; return {um, tres, cinco, alfa};})()`);
  expect(sg.um, "1 corte").toBe(2);
  expect(sg.tres, "3 cortes acumulam").toBe(6);
  expect(sg.cinco, "não passa de 3 cortes nem de 35% da vida").toBeLessThanOrEqual(22 * 0.35 + 1e-9);
  expect(sg.alfa, "no Alfa, proporcional ao golpe").toBe(8);

  // sangramento fraco: pulsos de 1 de vida (não "-0") e cansa o bicho
  const sp = await jogo.js<{ vida: number; fol: number }>(`(()=>{const d=__t.dungeon;
    const m=__t.spawnDungeonMonster(); m.hp=m.hpMax=22; __t.ensureFol(m); m.x=d.px+400; m.y=d.py; const f0=m.fol;
    __t.applyBleed(m, 1.5); for(let i=0;i<6;i++){ m.bleed&&(m.bleed.t=0); if(m.bleed) __t.bleedTick(m); }
    const r={vida:22-m.hp, fol:f0-m.fol}; d.monsters.length=0; return r;})()`);
  expect(sp.vida, "o sangramento tirou vida").toBeGreaterThanOrEqual(1);
  expect(sp.fol, "e cansou").toBeGreaterThan(0);

  // caído: o fôlego volta aos poucos; ao levantar, foge
  const ko = await jogo.js<{ subiu: boolean; foge: boolean }>(`(()=>{const d=__t.dungeon; d.mode='campo';
    const m=__t.critSpawn('deer'); __t.ensureFol(m); m.x=d.px+60; m.y=d.py; m.hp=m.hpMax*0.6; m.fol=0; m.ko=2; m.koMax=2; m.st='recover';
    __t.folTick(m, 1); const subiu=m.fol>0;
    m.ko=0.01; __t.critAI(m, 0.05); __t.critAI(m, 0.05);
    const r={subiu, foge: m.st==='flee'}; d.monsters=d.monsters.filter(o=>o!==m); return r;})()`);
  expect(ko.subiu, "o fôlego enche no chão").toBe(true);
  expect(ko.foge, "levanta e foge").toBe(true);

  // lobos por nível no campo aberto: perto do acampamento de dia, mais jovens; longe à noite, veteranos
  const nv = await jogo.js<{ perto: Record<string, number>; longe: Record<string, number>; arena: string }>(`(()=>{
    const d=__t.dungeon, h=d.hero; h.camp=h.camp||{x:h.x,y:h.y}; const o0=d.origem;
    const conta=(dist, hora)=>{ const r={}; h.x=h.camp.x+dist; h.y=h.camp.y; __t.world.tick=hora; d.origem={x:0,y:0};
      for(let i=0;i<60;i++){ const m=__t.spawnDungeonMonster(); r[m.nivel]=(r[m.nivel]||0)+1; } d.monsters.length=0; return r; };
    const dia=Math.floor(__t.world.tick/1440)*1440;
    const perto=conta(0, dia+12*60), longe=conta(2000, dia+23*60);
    d.origem=null; const a=__t.spawnDungeonMonster(); const arena=a.nivel||'nenhum'; d.monsters.length=0; d.origem=o0;
    return {perto, longe, arena};})()`);
  expect(nv.perto.veterano || 0, "perto de casa de dia: quase nenhum veterano").toBeLessThan(5);
  expect(nv.longe.veterano || 0, "longe à noite: muitos veteranos").toBeGreaterThan(30);
  expect(nv.arena, "arena não muda").toBe("nenhum");
});
