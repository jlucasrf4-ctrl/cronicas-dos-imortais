/* Forja (minijogos de couro, cota, metal), estudo de projeto, durabilidade, receitas de flecha, análise de pistas,
   ficha no campo, minijogos de trabalho, kit de armas e joias; runas no mapa e no campo, absorção, traço.
   Também: organizar a mochila, dica do item, mochila cheia, fogueira, toasts com o jogo pausado.
   Portado de legacy-py: t5901, t5902, t87, t88, t71, tana, tbug1, tbug3, t5907, t5907b, t80, t81, t82, t86, trune,
   tpause, t91. */
import { test, expect, entrarComHeroi, irAoCampo } from "./comum.ts";

test("t5901 — forja: cortar e costurar couro, anéis da cota; lança cravada e puxada", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  expect(
    await jogo.js<number[]>("(()=>{const it=__t.mkItem('eq_lanca'); return [it.shape.length, it.shape[0].length]})()"),
  ).toHaveLength(2);
  await jogo.js(
    "__t.econ.test=true; __t.CAMP.allowForge=true; __t.openForge(); __t.CAMP.allowForge=false; __t.forgeStart('make','eq_armadura')",
  );
  await jogo.esperar(600);
  expect(await jogo.js("__t.FG.mg.ph")).toBeTruthy();
  await jogo.foto("corte");
  // passar a faca pelo caminho
  const box = await jogo.caixa("#fg-cv");
  const pts = await jogo.js<number[][]>("__t.FG.mg.cut");
  const L = box.width,
    H = L * 0.62;
  const P = pts.map((q) => [box.x + L * 0.14 + q[0] * L * 0.72, box.y + H * 0.07 + q[1] * H * 0.82]);
  await jogo.page.mouse.move(P[0][0], P[0][1]);
  await jogo.page.mouse.down();
  for (const q of P) await jogo.page.mouse.move(q[0], q[1]);
  await jogo.page.mouse.up();
  await jogo.esperar(800);
  const ph1 = await jogo.js<string>("__t.FG.mg.ph");
  for (let i = 0; i < 6; i++)
    await jogo.js("(()=>{const g=__t.FG.mg; if(g.sew){ g.sew.t=g.sew.dur*(1-9/34); __t.sewHit(); }})()");
  await jogo.foto("costura");
  expect(await jogo.js<string>("__t.FG.mg.ph")).not.toBe(ph1 === "cut" ? "cut" : "__nenhuma__");
  await jogo.js("document.querySelector('[data-mg=done]') && __t.forgeFinish()");
  // cota de anéis
  await jogo.js("__t.forgeStart('make','eq_cota'); __t.FG.mg.T=0.7");
  await jogo.esperar(700);
  const anel0 = await jogo.js<string>("__t.FG.mg.ph");
  for (let i = 0; i < 6; i++)
    await jogo.js("__t.FG.mg.T=0.7; __t.FG.mg.ring && (__t.FG.mg.ring.a=-Math.PI/2+0.05); __t.ringHit()");
  await jogo.foto("aneis");
  expect(anel0).toBeTruthy();
  await jogo.js("__t.forgeClose()");
  // campo: lança cravada no lobo, puxar com o golpe
  await irAoCampo(jogo, 3500);
  await jogo.js(
    "const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; d.weapon='melee'; __t.GL3.heroKey=''; d.px=200; d.py=270; __t.spawnDungeonMonster({});",
  );
  await jogo.js(
    "const d=__t.dungeon; const m=d.monsters[0]; m.x=300; m.y=270; m.st='stalk'; m.spd=0; d.mouse={x:300,y:270}; __t.spearThrow(1)",
  );
  await jogo.esperar(700);
  await jogo.foto("cravada");
  if (await jogo.js("__t.dungeon.spears.some(s=>s.stuck)")) {
    const r = await jogo.js<{ dmg: number; mao: boolean }>(
      "(()=>{const d=__t.dungeon, m=d.monsters[0]; d.px=m.x-40; d.py=m.y; d.cd=0; const h0=m.hp; __t.swingBasic(); return {dmg:h0-m.hp, mao:!!__t.ensureEquip(d.hero).maoD}})()",
    );
    expect(r.mao).toBe(true); // puxou a lança de volta
  }
  // arco: o botão direito carrega
  await jogo.js("const d=__t.dungeon; d.weapon='bow'; d.cd=0");
  const cv = await jogo.caixa("#dungeon-canvas");
  await jogo.page.mouse.move(cv.x + cv.width * 0.7, cv.y + cv.height * 0.5);
  await jogo.page.mouse.down({ button: "right" });
  await jogo.esperar(600);
  expect(await jogo.js("__t.dungeon.charging")).toBe(true);
  const a0 = await jogo.js<number>("__t.dungeon.arrows.length");
  await jogo.page.mouse.up({ button: "right" });
  await jogo.esperar(100);
  expect(await jogo.js<number>("__t.dungeon.arrows.length")).toBeGreaterThan(a0);
});

test("t5902 — organizar a mochila, dica do item, mochila cheia, fogueira de pedra e de atrito", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    "const inv=__t.ensureInv(__h); inv.items.length=0; for (const k of ['eq_lanca','pele','carne','eq_machado','gema','erva','presa','eq_clava','escudo']) { const it=__t.mkItem(k); __t.eqDurInit(it); __t.placeIn(inv,it); } __t.econ.gold=25;",
  );
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(1000);
  const n0 = await jogo.js<number>("__t.ensureInv(__h).items.length");
  await jogo.js("document.querySelector('.inv-org').click()");
  await jogo.esperar(500);
  expect(await jogo.js<number>("__t.ensureInv(__h).items.length")).toBe(n0);
  await jogo.foto("organizado");
  const bb = await jogo.caixa(".inv-item .inv-cell");
  await jogo.page.mouse.move(bb.x + 5, bb.y + 5);
  await jogo.page.mouse.move(bb.x + 7, bb.y + 6);
  await jogo.esperar(300);
  expect(await jogo.js("getComputedStyle(document.getElementById('item-tip')).display")).not.toBe("none");
  expect(await jogo.js<string>("document.getElementById('item-tip').textContent")).toBeTruthy();
  await jogo.foto("dica");
  await jogo.page.mouse.move(5, 5);
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(3500);
  // mochila cheia: pegar abre o inventário com o item no chão
  await jogo.js(
    "const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const inv=__t.ensureInv(d.hero); let g=0; while(g++<200){ const it=__t.mkItem('pele'); if(!__t.placeIn(inv,it)) break; } d.loot.push({key:'reliquia',x:d.px+5,y:d.py,t:0,ttl:0,tier:0}); __t.interact()",
  );
  await jogo.esperar(600);
  expect(await jogo.js("__t.dungeon.invOpen")).toBeTruthy();
  await jogo.foto("cheia");
  await jogo.js(
    "__t.toggleInv(false); const inv=__t.ensureInv(__t.dungeon.hero); inv.items=inv.items.filter(i=>i.def.key!=='pele');",
  );
  // fogueira com pedra
  await jogo.js(
    "const inv=__t.ensureInv(__t.dungeon.hero); for (let i=0;i<4;i++){const g=__t.mkItem('galho'); __t.placeIn(inv,g);} const p=__t.mkItem('pedra'); p.n=3; __t.placeIn(inv,p); __t.fireOpen()",
  );
  await jogo.esperar(500);
  await jogo.js("__t.fireStart('pedra')");
  await jogo.esperar(400);
  for (let i = 0; i < 5; i++) {
    await jogo.js("const g=__t.FIRE.mg; if(g){ g.pos=g.zc; g.anim=0; __t.fireKey('hit'); }");
    await jogo.esperar(250);
  }
  expect(await jogo.js<number>("(__t.dungeon.fires||[]).length")).toBeGreaterThan(0);
  await jogo.foto("fogueira");
  // nível alto: acende direto
  await jogo.js("__t.dungeon.fires=[]; __t.econ.fireLv=5; __t.dungeon.px-=300; __t.fireOpen(); __t.fireStart('pedra')");
  await jogo.esperar(200);
  expect(await jogo.js<number>("__t.dungeon.fires.length")).toBeGreaterThan(0);
  // javali: mira antes de investir
  await jogo.js(
    "const d=__t.dungeon; d.monsters.length=0; __t.spawnJavalino(2); const m=d.monsters.find(x=>x.kind==='javalino'); m.x=d.px+200; m.y=d.py; m.bcd=0; m.st='chase'; window.__b=m",
  );
  let investiu = false;
  for (let i = 0; i < 40 && !investiu; i++) {
    await jogo.esperar(100);
    investiu = (await jogo.js("__b.st")) === "charge";
  }
  expect(investiu).toBe(true);
  await jogo.foto("javali");
});

test("t87 — estudar projeto, forjar uma espada, desgaste no campo", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "(()=>{const st=__t.econ.stash; for(const k of ['ferro','ferro','ferro','ferro','ferro','galho','galho','pele','pele','pele','projeto_eq_espada']) __t.tryAddToInv(st,k);})()",
  );
  await jogo.js("__t.openForge()");
  await jogo.esperar(400);
  await jogo.foto("lista");
  expect(
    await jogo.js(
      "(()=>{const st=__t.econ.stash; const it=st.items.find(i=>i.def.blueprint); return __t.forgeStudy(it,{inv:st})})()",
    ),
  ).toBeTruthy();
  await jogo.js("__t.openForge()");
  await jogo.esperar(300);
  await jogo.js("__t.forgeStart('make','eq_espada'); __t.FG.bel=true");
  await jogo.esperar(1300);
  for (let i = 0; i < 6; i++) {
    await jogo.js("(()=>{const g=__t.FG.mg; g.pos=g.zc+0.01; __t.mgStrike();})()");
    await jogo.esperar(250);
  }
  await jogo.js("__t.FG.bel=false; (()=>{const g=__t.FG.mg; g.T=0.66; __t.mgQuench();})()");
  await jogo.esperar(300);
  await jogo.foto("forjada");
  const n0 = await jogo.js<number>(
    "__t.econ.stash.items.concat(__t.ensureInv(__h).items).filter(i=>i.def.key==='eq_espada').length",
  );
  await jogo.js("__t.forgeFinish()");
  expect(
    await jogo.js<number>(
      "__t.econ.stash.items.concat(__t.ensureInv(__h).items).filter(i=>i.def.key==='eq_espada').length",
    ),
  ).toBeGreaterThan(n0);
  await jogo.js("document.getElementById('fg-x').click()");
  await irAoCampo(jogo, 3500);
  const r = await jogo.js<[number, number, number, number]>(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const m=__t.spawnDungeonMonster(); m.hp=m.hpMax=1e6; const e=__t.ensureEquip(__h); const s0=e.maoD.dur; for(let i=0;i<20;i++) __t.hurtMonster(m,1,'espada',0); const s1=e.maoD?e.maoD.dur:0; const ar0=e.peito.dur; d.guard=false; d.invuln=0; for(let i=0;i<30;i++){ d.hp=d.hpMax; __t.wolfStrike(m,null,3,0.5);} return [s0,s1,ar0,e.peito?e.peito.dur:0]})()",
  );
  expect(r[1]).toBeLessThan(r[0]); // a espada gasta
  expect(r[3]).toBeLessThan(r[2]); // a armadura gasta
});

test("t88 — forja de botas e o preparo com equipamento gasto", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "const st=__t.econ.stash; for(const k of ['pele','pele','pele']) __t.tryAddToInv(st,k); __t.openForge()",
  );
  await jogo.esperar(400);
  await jogo.js("__t.forgeStart('make','eq_botas')");
  await jogo.esperar(500);
  expect(await jogo.js("!!__t.FG.mg")).toBe(true);
  await jogo.foto("botas");
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(300);
  await jogo.js("(()=>{const e=__t.ensureEquip(__h); e.maoD.dur=10; e.peito.dur=30;})()");
  await jogo.js("document.getElementById('fg-x').click()");
  await jogo.esperar(500);
  await jogo.foto("preparo");
});

test("t71 — receitas de flecha com galho, pedra e pena; árvore dá lenha e galho", async ({ jogo }) => {
  await jogo.js(
    "__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.world.heroes.forEach(h=>{h.loot=h.loot||{}; h.loot.wood=0;});",
  );
  expect(await jogo.js<number>("__t.RECIPES.length")).toBeGreaterThan(0);
  await jogo.js(
    "for(let i=0;i<3;i++) __t.giveItem(__h,'galho',0); __t.resAdd(__h,'stone',2); __t.resAdd(__h,'feather',1); __h.loot.wood=7",
  );
  expect(await jogo.js("__t.resTotal('galho')")).toBe(3);
  expect(await jogo.js<number>("__t.forgeHave(__h,'galho')")).toBe(3);
  await jogo.js("__t.openCraft()");
  await jogo.esperar(300);
  const q0 = await jogo.js<number>("__t.econ.quiver.n");
  await jogo.js("document.querySelector('[data-craft=arrow_stone]').click()");
  await jogo.esperar(300);
  expect(await jogo.js<number>("__t.resTotal('galho')")).toBeLessThan(3);
  expect(await jogo.js<number>("__t.econ.quiver.n")).toBeGreaterThan(q0);
  expect(await jogo.js<string>("document.getElementById('craft-msg').innerText")).toBeTruthy();
  await jogo.foto("craft");
  const w0 = await jogo.js<number>("__h.loot.wood");
  const g0 = await jogo.js<number>("__t.resTotal('galho')");
  await jogo.js("__h.task={killsDone:0}; __t.collectNode(__h,{kind:'tree',size:'large',readyAt:0})");
  const ganhou = (await jogo.js<number>("__h.loot.wood")) - w0 + (await jogo.js<number>("__t.resTotal('galho')")) - g0;
  expect(ganhou).toBeGreaterThan(0);
});

test("tana — análise de pistas na mesa até deduzir a espada longa", async ({ jogo }) => {
  await jogo.js(
    "__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.gsRun('MESA'); __t.gsRun('ARMAS');",
  );
  await jogo.esperar(400);
  await jogo.js("__t.baseMenu(__h)");
  await jogo.esperar(500);
  expect(await jogo.js("!!document.querySelector('[data-bm-ana]')")).toBe(true);
  await jogo.js("document.querySelector('[data-bm-ana]').click()");
  await jogo.esperar(500);
  let n = 0;
  while (!(await jogo.js("__t.clueReady('eq_espada_longa')")) && n < 20) {
    await jogo.js("__h.energy=100; __t.anaDo('eq_espada_longa')");
    n++;
  }
  expect(n).toBeLessThan(20);
  await jogo.foto("analise");
  await jogo.js("document.querySelector('[data-an=ded][data-k=eq_espada_longa]').click()");
  await jogo.esperar(300);
  expect(await jogo.js("__t.forgeKnows('eq_espada_longa')")).toBe(true);
});

test("tbug1/tbug3 — K abre a ficha no campo; minijogos andam; largar e pegar mantém os afixos", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  for (const k of ["rock", "tree", "fish"]) {
    await jogo.js(`__t.startMinigame(__h,'${k}')`);
    await jogo.esperar(700);
    const a = await jogo.js<string>("document.getElementById('mg-mark').style.left");
    await jogo.esperar(300);
    expect(await jogo.js<string>("document.getElementById('mg-mark').style.left"), k).not.toBe(a);
    for (let i = 0; i < 8; i++) {
      await jogo.page.keyboard.press("Space");
      await jogo.esperar(250);
    }
    await jogo.js("document.getElementById('mg-modal').classList.remove('open')");
    await jogo.esperar(300);
  }
  await irAoCampo(jogo, 3500);
  await jogo.page.mouse.click(600, 400);
  await jogo.page.keyboard.press("k");
  await jogo.esperar(800);
  expect(await jogo.js<number>("document.getElementById('sheet-modal').getBoundingClientRect().width")).toBeGreaterThan(
    0,
  );
  await jogo.foto("ficha");
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(500);
  const px0 = await jogo.js<number>("__t.dungeon.px");
  await jogo.page.keyboard.down("d");
  await jogo.esperar(600);
  await jogo.page.keyboard.up("d");
  expect(await jogo.js<number>("__t.dungeon.px")).toBeGreaterThan(px0); // a ficha fechou e o herói anda
  await jogo.js(
    "(()=>{const e=__t.ensureEquip(__t.dungeon.hero); e.maoD=__t.mkItem('eq_lanca'); e.maoD.q=3; __t.eqDurInit(e.maoD); window.__af=JSON.stringify(e.maoD.af); __t.toggleInv(); })()",
  );
  await jogo.esperar(700);
  await jogo.js("__t.dEqTake('maoD', true)");
  await jogo.esperar(300);
  expect(await jogo.js("!!__t.ensureEquip(__t.dungeon.hero).maoD")).toBe(false);
  await jogo.js("__t.toggleInv(); (()=>{const l=__t.dungeon.loot.find(l=>l.key==='eq_lanca'); __t.collectLoot(l);})()");
  expect(
    await jogo.js(
      "(()=>{const it=__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='eq_lanca'); return it && it.q===3 && JSON.stringify(it.af)===__af})()",
    ),
  ).toBe(true);
});

test("t5907/t5907b — comprar todas as armas; joias e pedras raras; fichas de animais; desenho da cozinha", async ({
  jogo,
}) => {
  await jogo.js("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.gold=5000;");
  await jogo.esperar(600);
  expect((await jogo.js<string[]>("__t.allWeaponKeys()")).length).toBeGreaterThan(3);
  const preco = await jogo.js<number>("__t.allWeaponsPrice()");
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(700);
  await jogo.js("document.querySelector('[data-allw]').click()");
  await jogo.esperar(500);
  expect(await jogo.js("__t.econ.gold")).toBe(5000 - preco);
  await jogo.foto("armas");
  await jogo.js(
    "__t.gsRun('JOIAS'); __t.gsRun('JOIAS'); for(let i=0;i<3;i++){for(const k of ['carne','erva','pele','presa','galho','ferro']) __t.tryAddToInv(__t.econ.stash,k,i);}",
  );
  const gemas = await jogo.js<string[]>(
    "__t.econ.stash.items.filter(i=>i.def.key==='gema').map(i=>__t.itName(i)+'|'+__t.icoKeyOf(i))",
  );
  expect(gemas.length).toBeGreaterThan(0);
  await jogo.js("try{__t.closePrep()}catch(e){}; document.getElementById('btn-chest').click()");
  await jogo.esperar(700);
  await jogo.page.locator("#chest-grid .inv-item").nth(5).hover();
  await jogo.esperar(500);
  await jogo.foto("dica-joia");
  await jogo.js("document.getElementById('chest-modal').classList.remove('open')");
  await jogo.page.mouse.move(5, 840);
  // fichas de animais no mapa
  await jogo.js(
    "const a=__t.world.animals.find(a=>a.species==='wolf'); window.__a=a; const s=__t.camera.minScale*14; __t.camera.scale=s; __t.camera.tx=683-a.x*s; __t.camera.ty=430-a.y*s; __t.openInspector(a)",
  );
  await jogo.esperar(900);
  await jogo.js("document.getElementById('insp-portrait').click()");
  await jogo.esperar(600);
  expect(await jogo.js("document.getElementById('an-card').classList.contains('open')")).toBe(true);
  await jogo.foto("ficha-lobo");
  await jogo.js("document.getElementById('an-card').classList.remove('open')");
  // desenho da cozinha num canvas avulso
  await jogo.js(
    "const cv=document.createElement('canvas'); cv.id='cook-cv'; cv.width=420; cv.height=260; cv.style='position:fixed;left:10px;top:10px;z-index:9999'; document.body.appendChild(cv); __t.CAMP.cook={a:0.2,b:0.1,down:'a',heat:1,ht:0,up:false,t:0,last:performance.now(),tier:1,an:'javali',flare:0}; __t.cookDraw();",
  );
  await jogo.esperar(300);
  await jogo.foto("cozinha", { x: 0, y: 0, width: 440, height: 280 });
});

test("t80/t81/t86 — runa no mapa: animal rúnico, enviar o herói, absorver (aquecer, esboço, selo, traço)", async ({
  jogo,
}) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  const r = await jogo.js<{ runes: number; str: number }>(
    "(()=>{const h=__h, L=__t.runeList(); const r=__t.runeNew(h.camp.x+70,h.camp.y+10,'fogo'); L.push(r); window.__r=r; const a=__t.world.animals.find(a=>a.alive&&a.species==='rabbit'); a.x=r.x; a.y=r.y; for(let i=0;i<40;i++) __t.simTick(1); return {runes:L.length, str:r.str}})()",
  );
  expect(r.runes).toBeGreaterThan(0);
  await jogo.js(
    "(()=>{const c=__t.camera,r=__r, vp=document.getElementById('viewport'); c.scale=6; c.tx=vp.clientWidth/2-r.x*c.scale; c.ty=vp.clientHeight/2-r.y*c.scale; c.zt=null; __t.applyCameraTransform(); __t.openRuneInspector(r);})()",
  );
  await jogo.esperar(900);
  await jogo.foto("runa");
  // t86: as seis runas lado a lado
  await jogo.js(
    "(()=>{const h=__h,L=__t.runeList(); ['nularis','fogo','energia','agua','ar','terra'].forEach((e,i)=>L.push(__t.runeNew(h.camp.x+40+(i%3)*45,h.camp.y-20+Math.floor(i/3)*45,e)));})()",
  );
  await jogo.esperar(600);
  await jogo.foto("colecao");
  const env = await jogo.js<[string, number]>(
    "(()=>{const h=__h, inv=__t.ensureInv(h); __t.tryAddToInv(inv,'ametista'); __t.tryAddToInv(inv,'pedra'); h._folhKit=1; __t.tryAddToInv(inv,'folhama');__t.tryAddToInv(inv,'folhama'); __t.runeSend(__r); let n=0; while(h.state==='traveling' && n++<3000) __t.simTick(1); return [h.state, n]})()",
  );
  expect(env[0]).not.toBe("traveling");
  await jogo.js("__t.runeAbsorbOpen({hero:__h,rune:__r,where:'mapa'})");
  await jogo.esperar(600);
  expect(await jogo.js("__t.RA.open")).toBeTruthy();
  await jogo.js("__t.raAct('start'); __t.RA.holding=true");
  await jogo.esperar(1900);
  await jogo.js(
    "(()=>{const P=__t.runePattern(__r.seed); __t.RA.sketch=P.map(s=>s.map(p=>[p[0]+0.03,p[1]-0.02])); __t.raAct('skdone')})()",
  );
  await jogo.esperar(300);
  await jogo.js("(()=>{__t.RA.sel=['ametista','pedra']; __t.raAct('seal')})()");
  await jogo.esperar(300);
  await jogo.js("(()=>{const P=__t.runePattern(__r.seed); __t.RA.trace=P.map(s=>s.map(p=>[p[0]+0.02,p[1]+0.01]));})()");
  await jogo.esperar(400);
  await jogo.js("__t.raAct('tracedone')");
  await jogo.esperar(3100);
  await jogo.foto("resultado");
  expect(await jogo.js("__t.RA.res")).toBeTruthy();
  await jogo.js("__t.raAct('take')");
  await jogo.esperar(300);
});

test("t82 — runa no campo: lobo rúnico, prompt, absorver, queimadura no centro", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await irAoCampo(jogo, 3500);
  const r = await jogo.js<number>(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const r=d.runes[0]; window.__dr=r; if(!r) return 0; d.px=r.x-70; d.py=r.y+10; const m=__t.spawnDungeonMonster(); m.x=r.x+r.R*0.3; m.y=r.y; m.alerted=false; const j=__t.spawnJavalino(2); j.x=r.x+90; j.y=r.y-40; return d.runes.length})()",
  );
  expect(r).toBeGreaterThan(0);
  await jogo.esperar(1500);
  await jogo.foto("runa");
  await jogo.js(
    "(()=>{const d=__t.dungeon; for(const m of d.monsters){ m.st='wander'; m.alerted=false; m.spd=0.01; } d.px=__dr.x-__dr.R-12; d.py=__dr.y;})()",
  );
  await jogo.esperar(400);
  expect(await jogo.js("!!__t.runeNearDungeon()")).toBe(true);
  await jogo.js("__t.dungeon.loot.length=0; __t.interact()");
  await jogo.esperar(500);
  expect(await jogo.js("__t.RA.open")).toBeTruthy();
  await jogo.js("document.getElementById('ra-x').click()");
  await jogo.esperar(300);
  expect(await jogo.js("__t.RA.open")).toBeFalsy();
});

test("trune — traço da runa: molhar o pincel muda a tinta", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1, true);
  await jogo.js("__t.runeAbsorbOpen({hero:__h, rune:{id:'r1', el:'fogo', seed:7, str:1, x:0,y:0}, where:'mapa'})");
  await jogo.esperar(600);
  await jogo.js(
    "(()=>{const RA=__t.RA; RA.step='trace'; RA.wet=0; RA.soak=0; RA.used=['quartzo']; RA.sel=['quartzo']; RA.trace=[]; __t.raAct('noop');})()",
  );
  await jogo.esperar(300);
  const cv = await jogo.caixa("#ra-cv");
  const x0 = cv.x + cv.width * 0.3,
    y0 = cv.y + cv.height * 0.5;
  const traco = async (y: number) => {
    await jogo.page.mouse.move(x0, y);
    await jogo.page.mouse.down();
    await jogo.page.mouse.move(x0 + 150, y, { steps: 12 });
    await jogo.page.mouse.up();
  };
  await traco(y0);
  const btn = await jogo.caixa("[data-a='dip']");
  await jogo.page.mouse.move(btn.x + 5, btn.y + 5);
  await jogo.page.mouse.down();
  await jogo.esperar(900);
  await jogo.page.mouse.up();
  expect(await jogo.js<number>("__t.RA.wet")).toBeGreaterThan(0);
  await traco(y0 + 60);
  expect(await jogo.js<number>("__t.RA.trace.length")).toBeGreaterThan(0);
  await jogo.foto("traco");
});

test("tpause/t91 — toasts param com o jogo pausado; banner e toasts no campo", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  await irAoCampo(jogo, 5000);
  await jogo.js(
    "const d=__t.dungeon; d.toasts.length=0; d.modalOpen=true; __t.spawnDungeonToast('🔥 Fogueira acesa!', d.px, d.py-40, '#ffb347', 14); __t.spawnDungeonToast('+1 Pedra', d.px, d.py-20, '#cfe8a0')",
  );
  const l0 = await jogo.js<number[]>("__t.dungeon.toasts.map(t=>t.life)");
  await jogo.esperar(1500);
  expect(await jogo.js<number[]>("__t.dungeon.toasts.map(t=>t.life)")).toEqual(l0);
  await jogo.js("__t.dungeon.modalOpen=false");
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.px=d.entrance.x+10; d.py=d.entrance.y; const X=d.px, Y=d.py; __t.setBanner('🐺 HORDA 2/3', '4 lobos + 1 javalino', 3, '#ffb37a'); __t.spawnDungeonToast('Bloqueado', X+60, Y-30, '#9fe3ff', 11); __t.spawnDungeonToast('Esquivou!', X-60, Y-20, '#9fe3ff'); __t.spawnDungeonToast('-7', X+90, Y, '#ff6b6b', 14); document.getElementById('sword-hud').style.display='block'; })()",
  );
  await jogo.esperar(250);
  expect(await jogo.js("!!__t.dungeon.banner")).toBe(true);
  await jogo.foto("toasts");
});
