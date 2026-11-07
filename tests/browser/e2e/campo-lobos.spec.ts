/* Campo pela entrada antiga (launchDungeon): lobos, Alfa, parry, escudo, flechas, fluxo de hordas.
   Portado de legacy-py: t, t2, t3, t7, t10, t11, t12, t13, t14, t20, t21/t22, t23, t24, t26, t35, t67. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("t — nascimento pela UI, ficha, sangramento e órbita do lobo", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; __t.openCreateModal()");
  await jogo.page.fill("#create-name", "Kaelin");
  await jogo.page.click("#create-confirm");
  await jogo.esperar(8200);
  await jogo.foto("nascimento");
  const h = await jogo.js<{ tot: number; lvl: number }>(
    "(()=>{const h=__t.world.heroes[0]; return {tot:Object.values(h.attrs).reduce((a,b)=>a+b,0),lvl:h.lvl}})()",
  );
  expect(h.lvl).toBe(1);
  // 300 sementes: o total de atributos é sempre o mesmo, e as afinidades variam
  const st = await jogo.js<{ c: Record<string, number>; totals: number[] }>(
    "(()=>{const c={},t=new Set();for(let i=1;i<=300;i++){const b=__t.bornFromSeed(i*7919);c[b.aff]=(c[b.aff]||0)+1;t.add(Object.values(b.attrs).reduce((a,x)=>a+x,0));}return {c,totals:[...t]}})()",
  );
  expect(st.totals).toEqual([h.tot]);
  expect(Object.keys(st.c).length).toBeGreaterThan(1);
  await jogo.page.click("#cr-skip");
  await jogo.esperar(300);
  // ficha: comprar nós da árvore
  await jogo.js("(()=>{const h=__t.world.heroes[0]; h.treeBonus=3; __t.openSheet(h.id)})()");
  await jogo.esperar(300);
  await jogo.foto("ficha");
  const nos = await jogo.js<{ r: boolean[]; nodes: string[] }>(
    "(()=>{const h=__t.world.heroes[0]; const r=[];for(const id of ['parry_atordoante','guarda_firme','corte_sangrento']){r.push(!!__t.buyNode(h,id));} return {r,nodes:Object.keys(h.nodes)}})()",
  );
  expect(nos.r).toContain(true);
  if (await jogo.tem("renderSheet")) {
    await jogo.js("__t.sheet.tab='combate'; __t.renderSheet()");
    await jogo.foto("ficha-combate");
  }
  await jogo.js("document.querySelector('[data-sheetclose]').click()");
  // campo: golpe no jogador
  await jogo.js("window.__h=__t.world.heroes[0]; __t.econ.quiver.n=10;");
  await campoDireto(jogo, 2500);
  await jogo.js("__t.spawnDungeonMonster()");
  await jogo.esperar(300);
  const hp = await jogo.js<number[]>(
    "(()=>{const d=__t.dungeon; d.invuln=0; const m=d.monsters.find(x=>x.alive); m.x=d.px+14; m.y=d.py; const a=d.hp; __t.hurtPlayer(9, 0, m); return [a,d.hp]})()",
  );
  expect(hp[1]).toBeLessThan(hp[0]);
  await jogo.foto("golpe");
  if (await jogo.tem("applyBleed")) {
    const sang = await jogo.js<{ ticks: number[]; total: number }>(
      "(()=>{const d=__t.dungeon; const m=d.monsters.find(x=>x.alive); m.hp=m.hpMax=500; __t.applyBleed(m,14); const out=[]; const orig=m.hp; for(let i=0;i<40&&m.bleed;i++){m.bleed.t=0; const b=m.hp; __t.updateDungeonMonster(m,0.001); out.push(+(b-m.hp).toFixed(2));} return {ticks:out, total:+(orig-m.hp).toFixed(2)}})()",
    );
    expect(sang.total).toBeGreaterThan(0);
  }
  // IA: o lobo ronda o herói e continua vivo e perto
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.invuln=999; d.hp=d.hpMax; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.x=d.px+130; m.y=d.py; m.hp=m.hpMax=999; window.__m=m;})()",
  );
  const dist: number[] = [];
  for (let i = 0; i < 8; i++) {
    await jogo.esperar(400);
    dist.push(await jogo.js<number>("Math.hypot(__m.x-__t.dungeon.px,__m.y-__t.dungeon.py)"));
  }
  expect(await jogo.js("__m.alive")).toBe(true);
  expect(Math.max(...dist)).toBeLessThan(600);
  expect(new Set(dist.map(Math.round)).size).toBeGreaterThan(1);
});

test("t2 — lobo fora da zona segura, escudo, parry com nós e subir de nível", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js(
    "__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(12345)); __h.treeBonus=4; __t.econ.quiver.n=10;",
  );
  await campoDireto(jogo);
  expect(await jogo.js("__t.dSafe()")).toBe(true);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.px=d.tile*12; d.py=d.tile*6; d.invuln=999; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.x=d.px+d.tile*3; m.y=d.py; m.hp=m.hpMax=999; window.__m=m;})()",
  );
  expect(await jogo.js("__t.dSafe()")).toBe(false);
  const pos = new Set<string>();
  for (let i = 0; i < 10; i++) {
    await jogo.esperar(400);
    pos.add(await jogo.js<string>("Math.round(__m.x)+','+Math.round(__m.y)"));
  }
  expect(pos.size).toBeGreaterThan(1); // o lobo se move em volta do herói
  await jogo.foto("lobo");
  await jogo.js(
    "(()=>{const h=__t.dungeon.hero; for(const id of ['guarda_firme','parry_atordoante','corte_sangrento']) __t.buyNode(h,id); const d=__t.dungeon; d.invuln=0; d.hp=d.hpMax; d.weapon='melee'; d.guard=true; d.mouse={x:d.px+50,y:d.py}; const m=__m; m.alive=true; m.x=d.px+16; m.y=d.py; m.st='chase'; __t.wolfStrike(m,null,4,0.5); })()",
  );
  const parry = await jogo.js<{ st: string; stun: number }>(
    "(()=>{const d=__t.dungeon; d.guard=false; const m=__m; m.slow=0; m.x=d.px+16; m.y=d.py; m.st='windup'; m.atk='bite'; m.wuTot=m.t=0.1; m.parry=null; d.parryCd=0; d.mouse={x:d.px+60,y:d.py}; __t.doParry(); m.t=0; __t.updateDungeonMonster(m,0.016); return {st:m.st,stun:m.stun||0}})()",
  );
  expect(parry.stun).toBeGreaterThan(0); // parry perfeito atordoa (v8.0: na chegada do golpe)
  await jogo.esperar(500);
  await jogo.foto("parry");
  const nv = await jogo.js<{ lvl: number }>(
    "(()=>{const h=__t.dungeon.hero; __t.addHeroXp(h,2000); return {lvl:h.lvl}})()",
  );
  expect(nv.lvl).toBeGreaterThan(1);
});

test("t3 — alcance da espada: lobo na borda do corpo leva o golpe", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js(
    "__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.updateHeroPanelUI(); __t.openPrep(__h.id)",
  );
  await jogo.esperar(400);
  await jogo.foto("preparo");
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(2400);
  const r = await jogo.js<{ hit: boolean }>(
    "(()=>{const d=__t.dungeon; d.px=d.tile*12; d.py=d.tile*6; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.hp=m.hpMax=500; d.mouse={x:d.px+100,y:d.py}; m.x=d.px+d.tile*0.62+10; m.y=d.py; m.st='recover'; m.t=5; d.cd=0; d.guard=false; const h0=m.hp; __t.swingBasic(); return {hit:h0-m.hp>0}})()",
  );
  expect(r.hit).toBe(true);
  await jogo.esperar(80);
  await jogo.foto("golpe");
});

test("t7 — parry perfeito, parcial, tolerância, bote, vida baixa e fuga", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(12345)); __t.econ.quiver.n=10;");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.px=d.tile*12; d.py=d.tile*6; d.invuln=0; d.weapon='melee'; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.hp=m.hpMax=999; m.dm=1; window.__m=m;})()",
  );
  // cada caso monta o lobo e age na mesma chamada (o laço do jogo anda entre duas chamadas)
  const caso = (t: number, acao: string, atk = "bite") =>
    jogo.js<{ dano: number; stun: number; parry: unknown; parryCd: number }>(
      `(()=>{const d=__t.dungeon,m=__m; d.invuln=0; d.hp=d.hpMax; d.parryCd=0; d.parryVis=0; d.guard=false; d.mouse={x:d.px+60,y:d.py}; m.x=d.px+18; m.y=d.py; m.alive=true; m.slow=0; m.stun=0; m.st='windup'; m.atk='${atk}'; m.wuTot=m.t=${t}; m.parry=null; m.locked=false; m.ang=Math.PI; const hp0=d.hp; ${acao}; return {dano:hp0-d.hp, stun:m.stun||0, parry:m.parry, parryCd:d.parryCd}})()`,
    );
  const golpe = "m.t=0; __t.updateDungeonMonster(m,0.016)";
  // perfeito (v8.0: o parry é avaliado quando o golpe chega; logo depois do clique = perfeito)
  expect((await caso(0.1, "__t.doParry(); " + golpe)).stun).toBeGreaterThan(0);
  await jogo.esperar(200);
  await jogo.foto("ruptura");
  // parcial: o golpe chega 0,3 s depois do clique; o lobo ainda morde, mas menos que sem parry
  const parcial = (await caso(0.3, "__t.doParry(); d.parryT=0.3; " + golpe)).dano;
  const semParry = (await caso(0.3, golpe)).dano;
  expect(semParry).toBeGreaterThan(0);
  expect(parcial).toBeLessThanOrEqual(semParry);
  // parry no vazio põe o parry em recarga
  expect((await caso(0.3, "m.st='chase'; m.x=d.px+300; d.parryCd=0; __t.doParry()")).parryCd).toBeGreaterThan(0);
  // bote: parry e o lobo salta em seguida: aparado no ar
  expect(
    (
      await caso(
        0.25,
        "__t.doParry(); " + golpe + "; for(let i=0;i<10;i++) __t.updateDungeonMonster(m,0.016)",
        "pounce",
      )
    ).stun,
  ).toBeGreaterThan(0);
  // vida baixa: o lobo escolhe um modo
  const modos = await jogo.js<(string | null)[]>(
    "(()=>{const d=__t.dungeon,m=__m,out=[]; for(let i=0;i<10;i++){m.alive=true;m.lowSet=false;m.low=null;m.fleeT=0; m.st='chase'; m.x=d.px+d.tile*3; m.y=d.py; d.invuln=99; d.hp=d.hpMax; m.hp=m.hpMax*0.2; __t.updateDungeonMonster(m,0.016); out.push(m.low)} return out})()",
  );
  expect(modos.some((x) => x)).toBe(true);
  // fuga: o lobo se afasta
  const fuga = await jogo.js<number[]>(
    "(()=>{const d=__t.dungeon,m=__m; m.alive=true; m.lowSet=true; m.low='flee'; m.fleeT=4; m.st='chase'; m.x=d.px+d.tile*2; m.y=d.py; const d0=Math.hypot(m.x-d.px,m.y-d.py); for(let i=0;i<60;i++) __t.updateDungeonMonster(m,0.05); return [d0, Math.hypot(m.x-d.px,m.y-d.py)]})()",
  );
  expect(fuga[1]).toBeGreaterThan(fuga[0]);
  // espada: o golpe básico acerta o lobo colado
  const tirou = await jogo.js<number>(
    "(()=>{const d=__t.dungeon,m=__m; d.invuln=99; m.alive=true; m.low=null; m.fleeT=0; m.hp=m.hpMax=999; m.st='chase'; m.x=d.px+30; m.y=d.py; d.mouse={x:d.px+100,y:d.py}; d.cd=0; d.parts.length=0; __t.swingBasic(); return 999-m.hp})()",
  );
  expect(tirou).toBeGreaterThan(0);
  await jogo.esperar(350);
  await jogo.foto("espada");
});

test("t10 — três lobos e o Alfa no campo 3D", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.foto("campo");
  await jogo.js(
    "(()=>{for(let i=0;i<3;i++)__t.spawnDungeonMonster({}); __t.spawnDungeonMonster({boss:true}); const d=__t.dungeon; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile*0.6;})()",
  );
  await jogo.esperar(1200);
  expect(await jogo.js<number>("__t.dungeon.monsters.filter(m=>m.alive).length")).toBeGreaterThanOrEqual(4);
  expect(await jogo.js("__t.dungeon.monsters.some(m=>m.boss)")).toBe(true);
  await jogo.foto("lobos");
});

test("t11 — o mouse no chão vira a mira; botão 3D alterna o modo", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{for(let i=0;i<3;i++)__t.spawnDungeonMonster({}); const d=__t.dungeon; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile*0.6; d.flow='wave'; d.banner=null; d.weapon='bow'})()",
  );
  const box = await jogo.caixa("#dungeon-canvas");
  const mx = box.x + box.width * 0.7,
    my = box.y + box.height * 0.55;
  // na v7.6 o clique não move mais o herói (anda com WASD); o ponto sob o mouse vira a mira, projetada no chão
  await jogo.page.mouse.move(mx, my);
  await jogo.page.mouse.click(mx, my);
  await jogo.esperar(100);
  const mira = await jogo.js<{ x: number; y: number } | null>("__t.dungeon.mouse");
  expect(mira).not.toBeNull();
  expect(mira!.x).toBeGreaterThan(await jogo.js<number>("__t.dungeon.px")); // apontou à direita do herói
  await jogo.esperar(1500);
  await jogo.foto("destino");
  const classe0 = await jogo.js<string>("document.getElementById('dungeon-stage-wrap').className");
  await jogo.page.click("#dungeon-3d");
  await jogo.esperar(500);
  await jogo.foto("modo-2d");
  expect(await jogo.js<string>("document.getElementById('dungeon-stage-wrap').className")).not.toBe(classe0);
  await jogo.page.click("#dungeon-3d");
  await jogo.js("__t.dungeon.weapon='bow'; __t.dungeon.charging=true; __t.dungeon.charge=0.6");
  await jogo.esperar(600);
  expect(await jogo.js<string>("document.getElementById('dungeon-stage-wrap').className")).toBe(classe0);
  await jogo.foto("de-volta");
});

test("t12 — cliques e parries contra o Alfa e dois lobos", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='wave'; d.banner=null; d.px=441; d.py=300; const m=__t.spawnDungeonMonster({boss:true}); m.x=480;m.y=300; for(let i=0;i<2;i++){const w=__t.spawnDungeonMonster({}); w.x=400+i*60; w.y=340}})()",
  );
  const box = await jogo.caixa("#dungeon-canvas");
  for (let i = 0; i < 14; i++) {
    await jogo.page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await jogo.esperar(180);
    if (i % 4 === 2)
      await jogo.page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55, { button: "right" });
  }
  await jogo.foto("combate");
});

test("t13 — pelagens dos lobos e o Alfa de perto", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.px=441; d.py=280; d.mouse={x:600,y:330}; [0,1,2,3,4,5].forEach((c,i)=>{const w=__t.spawnDungeonMonster({}); w.coat=c; w.x=330+i*45; w.y=360; w.st='idle'; w._yaw=i*0.6;}); const bz=__t.spawnDungeonMonster({boss:true}); bz.x=560; bz.y=250; d.modalOpen=true;})()",
  );
  await jogo.esperar(800);
  expect(await jogo.js("__t.dungeon.monsters.length")).toBe(7);
  const b = await jogo.caixa("#dungeon-canvas");
  await jogo.foto("pelagens", {
    x: b.x + b.width * 0.2,
    y: b.y + b.height * 0.15,
    width: b.width * 0.6,
    height: b.height * 0.7,
  });
});

test("t14 — o herói mira o mouse ao andar; escudo contra mordida e bote", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js("(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.px=300; d.py=280;})()");
  const box = await jogo.caixa("#dungeon-canvas");
  await jogo.page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2);
  const px0 = await jogo.js<number>("__t.dungeon.px");
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(800);
  const yaw = await jogo.js<number>("__t.GL3.hyaw");
  await jogo.page.keyboard.up("KeyD");
  expect(await jogo.js<number>("__t.dungeon.px")).toBeGreaterThan(px0); // D anda para a direita
  expect(Number.isFinite(yaw)).toBe(true);
  // escudo de frente bloqueia a mordida
  const bloq = await jogo.js<[number, number, number]>(
    "(()=>{const d=__t.dungeon; d.mouse=null; d.mouseC=null; d.px=400; d.py=300; d.target=null; d.invuln=0; const m=__t.spawnDungeonMonster({}); m.x=430; m.y=300; d.mouse={x:500,y:300}; d.guard=true; d.gstam=100; const hp0=d.hp; m.st='windup'; m.atk='bite'; m.t=0.0001; m.ang=Math.PI; __t.updateDungeonMonster(m,0.016); return [hp0, d.hp, d.gstam]})()",
  );
  expect(bloq[1]).toBe(bloq[0]);
  expect(bloq[2]).toBeLessThan(100); // bloquear gasta fôlego
  await jogo.page.keyboard.down("Space");
  await jogo.esperar(50);
  const muro = await jogo.js<[boolean, number]>(
    "(()=>{const d=__t.dungeon; const m=d.monsters[0]; m.st='chase'; m.x=420; m.y=300; __t.shieldWall(); return [d.guard, m.x-d.px]})()",
  );
  expect(muro[0]).toBe(true);
  expect(muro[1]).toBeGreaterThan(20); // o escudo empurra o lobo para fora
  const bote = await jogo.js<[number, number]>(
    "(()=>{const d=__t.dungeon; const m=d.monsters[0]; const hp0=d.hp; m.x=520; m.y=300; m.st='leap'; m.lx=380; m.ly=300; m.l0=140; m.lt=0; m.hit=false; m.lpr=null; for(let i=0;i<40;i++){__t.updateDungeonMonster(m,0.016); __t.shieldWall();} return [hp0,d.hp]})()",
  );
  expect(bote[1]).toBe(bote[0]);
  await jogo.page.keyboard.up("Space");
  await jogo.esperar(300);
  await jogo.js("__t.dungeon.monsters.length=0; __t.setBanner('🐺 Horda 2','teste',3)");
  await jogo.esperar(300);
  expect(await jogo.js("__t.dungeon.banner && __t.dungeon.banner.text")).toBeTruthy();
  await jogo.foto("banner");
});

test("t20 — matar o Alfa abre o espólio e o fluxo segue", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; d.flow='boss'; d.wave=3; const m=__t.spawnDungeonMonster({boss:true}); __t.hurtMonster(m, 9999, 'espada', 0)})()",
  );
  await jogo.esperar(3000);
  expect(await jogo.js("__t.dungeon.monsters.some(m=>m.boss&&m.alive)")).toBe(false);
  expect(await jogo.js("__t.dungeon.flow")).not.toBe("boss");
  await jogo.foto("espolio");
  await jogo.js("__t.dungeon.flowT=10.2");
  await jogo.esperar(600);
  await jogo.js("__t.dungeon.flowT=0.1");
  await jogo.esperar(2500);
  await jogo.foto("depois");
});

test("t21/t22/t24 — flechas acertam o Alfa pelo corpo, não pelo lado de fora", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  const tiro = async (boss: boolean, x0: number, y0: number, vx: number, vy: number, py = 300) => {
    await jogo.js(
      `(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.birds.length=0; d.arrows.length=0; d.px=250; d.py=${py}; const m=__t.spawnDungeonMonster({boss:${boss}}); m.x=500; m.y=300; m.st='recover'; m.t=999; m.ang=0; m._yaw=0; m._gx=500; m._gy=300; window._m=m; window._hp0=m.hp; d.arrows.push({x:${x0}, y:${y0}, vx:${vx}, vy:${vy}, life:0.6, dmg:5, hits:new Set(), full:false});})()`,
    );
    await jogo.esperar(1200);
    return jogo.js<number>("_hp0-_m.hp");
  };
  expect(await tiro(true, 360, 300, 600, 0), "cabeça").toBeGreaterThan(0);
  expect(await tiro(true, 300, 300, 600, 0), "centro").toBeGreaterThan(0);
  expect(await tiro(true, 300, 332, 600, 0), "lado (fora)").toBe(0);
  expect(await tiro(true, 530, 120, 0, 600, 420), "Alfa: de cima na cabeça").toBeGreaterThan(0);
  expect(await tiro(false, 516, 120, 0, 600, 420), "lobo: de cima na cabeça").toBeGreaterThan(0);
});

test("t23 — o Alfa parado fica no lugar e tem corpo", async ({ jogo }) => {
  await jogo.esperar(1500);
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.birds.length=0; d.arrows.length=0; d.px=250; d.py=300; const m=__t.spawnDungeonMonster({boss:true}); m.x=500; m.y=300; m.st='recover'; m.t=999; m.ang=0; m._yaw=0; m._gx=500; m._gy=300; window._m=m;})()",
  );
  for (let i = 0; i < 3; i++) {
    await jogo.esperar(200);
    const r = await jogo.js<[boolean, boolean, number, number]>(
      "[_m.alive, __t.dungeon.monsters.includes(_m), _m.x|0, _m.y|0]",
    );
    expect(r).toEqual([true, true, 500, 300]);
    expect(await jogo.js("__t.wolfBody(_m)")).toBeTruthy();
  }
});

test("t26 — o mundo serializa sem ciclos", async ({ jogo }) => {
  await jogo.esperar(1500);
  const r = await jogo.js<{ erros: string[]; chaves: number }>(
    "(()=>{const w=__t.world; __t.econ.test=true; __t.createHero('A',__t.bornFromSeed(5)); const erros=[]; for(const k in w){ try{ JSON.stringify(w[k]) }catch(e){ erros.push(k+': '+e.message) } } return {erros, chaves:Object.keys(w.animals[0]).length}})()",
  );
  expect(r.erros).toEqual([]);
  expect(r.chaves).toBeGreaterThan(0);
});

test("t35 — o GL vai para a cinemática e volta ao campo", async ({ jogo }) => {
  await jogo.esperar(2000);
  await jogo.page.mouse.click(600, 400);
  await jogo.esperar(500);
  await jogo.js("document.querySelector('[data-act=new]').click()");
  await jogo.esperar(800);
  await jogo.js("__t.INTRO.i=10; document.getElementById('intro').click()");
  await jogo.esperar(2500);
  expect(await jogo.js("!!document.querySelector('#cine #dungeon-gl')")).toBe(true);
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(800);
  expect(await jogo.js("__t.INTRO.open")).toBeFalsy();
  expect(await jogo.js("!!document.querySelector('#dungeon-stage-wrap #dungeon-gl')")).toBe(true);
  expect(await jogo.js("document.getElementById('create-modal').classList.contains('open')")).toBe(true);
  await jogo.js("document.getElementById('create-cancel').click()");
  await jogo.js("window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.econ.test=true;");
  await campoDireto(jogo, 3000);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; const m=__t.spawnDungeonMonster({}); m.x=d.px+60; m.y=d.py})()",
  );
  await jogo.esperar(1200);
  expect(await jogo.js("__t.GL3.ok")).toBe(true);
  await jogo.foto("campo-depois");
});

test("t67 — lobo longe percebe o herói e se aproxima", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo, 3000);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=440; d.py=300; d.invuln=999; const m=__t.spawnDungeonMonster({}); m.x=d.px+300; m.y=d.py+20; window.__m=m})()",
  );
  const d0 = await jogo.js<number>("Math.hypot(__m.x-__t.dungeon.px,__m.y-__t.dungeon.py)");
  await jogo.esperar(3000);
  expect(await jogo.js("__m.alive")).toBe(true);
  expect(await jogo.js<number>("Math.hypot(__m.x-__t.dungeon.px,__m.y-__t.dungeon.py)")).toBeLessThan(d0);
});
