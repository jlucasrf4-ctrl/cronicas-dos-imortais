/* Dano por tipo e armadura, fôlego e desmaio (KO), cravar a arma (segurar/arrancar), laço (corda), faca e
   finalizar, bichos do campo aberto (coelho, cervo, pássaros, lobo neutro), galho → lança de madeira.
   Portado de legacy-py: tdano, tdano2, tdano3, tdano4, tdano5, tcrav, tcrav2, tcrav3, trope, trope2, tfaca, tvis62,
   t68, t70, t70b, t72, t74, t75, t75b, t77b. tperf e tprof (FPS e perfil de CPU) viraram tests/browser/tools/perf. */
import { test, expect, entrarComHeroi, irAoCampo, type Jogo } from "./comum.ts";

const centroDoCanvas = (jogo: Jogo) =>
  jogo.js<number[]>(
    "(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()",
  );

async function campoComLobo(jogo: Jogo) {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 4500);
}

test("cravada — lâmina presa, profundidade até 18% e tiques de 1 vida / 2 fôlego", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.closeTitle(); __h.state='idle'; __t.launchTraining(__h.id)");
  await jogo.esperar(3000);
  const resultado = await jogo.js<{
    meio: number[];
    inteiro: number[];
    max: number;
    solto: number;
    deslocamento: number[];
  }>(`(()=>{
    const d=__t.dungeon;
    d.monsters.length=0; d.flow='x'; d.banner=null; d.dead=false; d.camp=false;
    d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2;
    __t.CZ.jog=1.2;
    const e=__t.ensureEquip(__h), it=__t.mkItem('eq_espada');
    __t.eqDurInit(it); e.maoD=it; d.weapon='melee'; d.gstam=100;
    const m=window.__w=__t.trainWolf();
    m.x=d.px+45; m.y=d.py; m.hp=m.hpMax=1000;
    m.fol=m.folMax=1000; m.folLost=0; m.ko=0;
    __t.CRAV2.foge=0; __t.cravStart(m,'eq_espada');
    const C=d.crav; C.deb=999; __t.cravPress();
    __t.cravTick(0.5); const meio=[1000-m.hp,1000-m.fol];
    __t.cravTick(0.5); const inteiro=[1000-m.hp,1000-m.fol];
    __t.cravTick(1); __t.cravTick(0.5); const max=C.dep;
    __t.cravRelease(); __t.cravTick(0.5); const solto=C.dep;
    const a=__t.armaCravadaMatriz(1.3);
    m.x+=17; m.y+=11; d.px+=17; d.py+=11;
    const b=__t.armaCravadaMatriz(1.3);
    return {meio,inteiro,max,solto,deslocamento:[b[12]-a[12],b[14]-a[14]]};
  })()`);
  expect(resultado.meio).toEqual([0, 0]);
  expect(resultado.inteiro).toEqual([1, 2]);
  expect(resultado.max).toBeCloseTo(0.18);
  expect(resultado.solto).toBeCloseTo(0.18);
  expect(resultado.deslocamento[0]).toBeCloseTo(17);
  expect(resultado.deslocamento[1]).toBeCloseTo(11);
  await jogo.esperar(300);
  await jogo.foto("espada_presa_18_porcento");
});

test("cravada — lança atravessa a pele sem deslocar os corpos", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.closeTitle(); __h.state='idle'; __t.launchTraining(__h.id)");
  await jogo.esperar(3000);
  await jogo.js(`(()=>{
    const d=__t.dungeon;
    d.monsters.length=0; d.flow='x'; d.banner=null;
    d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2;
    const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it);
    __t.ensureEquip(__h).maoD=it; d.weapon='melee'; d.gstam=100;
    const m=window.__w=__t.trainWolf();
    m.x=d.px+80; m.y=d.py; m.hp=m.hpMax=1000;
    m.fol=m.folMax=1000; m.ko=0;
    __t.CRAV2.foge=0; __t.cravStart(m,'eq_lanca'); d.crav.deb=999;
    __t.cravTick(0); __t.CZ.jog=1.2; __t.D3.ZM=2.5;
  })()`);
  await jogo.esperar(400);
  await jogo.foto("lanca_inicio");
  const r = await jogo.js<{ corpo: number; contato: number; avancou: number; esperado: number }>(`(()=>{
    const d=__t.dungeon, C=d.crav, m=C.m;
    const pos=[d.px,d.py,m.x,m.y], mao=[d.px+10,30,d.py];
    const pontos=__t.armaPontos(C.key), ponta=Math.max(...pontos.map(p=>p[0])),
      comprimento=ponta-Math.min(...pontos.map(p=>p[0]));
    C.dep=0;
    const a=__t.armaCravadaMatriz(1.3,mao), eixo=[a[0]/1.3,a[1]/1.3,a[2]/1.3],
      tipA=[a[12]+a[0]*ponta,a[13]+a[1]*ponta,a[14]+a[2]*ponta],
      pele=__t.contatoPeleBicho(m,tipA.map((v,i)=>v-eixo[i]*100),eixo);
    if(!pele) throw Error('A lança não encontrou a pele real do animal');
    __t.cravPress(); __t.cravTick(2); __t.cravRelease();
    const b=__t.armaCravadaMatriz(1.3,mao),
      tipB=[b[12]+b[0]*ponta,b[13]+b[1]*ponta,b[14]+b[2]*ponta];
    return {
      corpo:Math.hypot(d.px-pos[0],d.py-pos[1],m.x-pos[2],m.y-pos[3]),
      contato:Math.hypot(...tipA.map((v,i)=>v-pele[i])),
      avancou:tipB.reduce((s,v,i)=>s+(v-tipA[i])*eixo[i],0),
      esperado:comprimento*1.3*0.18
    };
  })()`);
  expect(r.corpo).toBeCloseTo(0);
  expect(r.contato).toBeLessThan(0.01);
  expect(r.avancou).toBeCloseTo(r.esperado, 3);
  expect(r.avancou).toBeGreaterThan(5);
  await jogo.esperar(300);
  await jogo.foto("lanca_18_porcento");
});

/** Campo aberto (modo "campo", com bichos) sem lobos. */
async function campoAberto(jogo: Jogo, lobos = 0) {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    `__t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=${lobos}; __t.econ.test=false;`,
  );
  await jogo.js("__t.jogoEnter()");
  await jogo.esperar(5000);
  expect(await jogo.js("__t.dungeon.active")).toBe(true);
}

test("tdano — dano por tipo e armadura, fôlego do javali com flechas, cravar e arrancar, dicas", async ({ jogo }) => {
  await campoComLobo(jogo);
  const ap = await jogo.js<unknown>("__t.aplicarDano(10,[15,75,10],[4,12,4],0)");
  expect(ap).toBeTruthy();
  expect(await jogo.js<number[]>("__t.armorRes(__t.dungeon.hero)")).toHaveLength(3);
  const red = await jogo.js<number>("__t.armorRed(__t.dungeon.hero)");
  expect(red).toBeGreaterThanOrEqual(0);
  expect(red).toBeLessThan(1);
  // golpe com Math.random alto: sem crítico
  const golpe = await jogo.js<number>(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); window.__m=m; m.x=d.px+26; m.y=d.py; d.mouse={x:m.x,y:m.y}; d.cd=0; const r=Math.random; Math.random=()=>0.99; const h0=m.hp; __t.swingBasic(); Math.random=r; return h0-m.hp})()",
  );
  expect(golpe).toBeGreaterThan(0);
  // três flechas cravadas no javali drenam o fôlego até o desmaio
  await jogo.js(
    "(()=>{const b=__t.trainWolf(); window.__b=b; b.kind='javalino'; b.hp=b.hpMax=60; b.x=__t.dungeon.px+150; b.y=__t.dungeon.py; delete b.folMax; __t.ensureFol(b); const r=Math.random; Math.random=()=>0.01; for(let i=0;i<3;i++) __t.arrowStick(b,{vx:1,vy:0},3); Math.random=r;})()",
  );
  expect(await jogo.js<number>("__b.stk.length")).toBe(3);
  const fol0 = await jogo.js<number>("__b.fol");
  await jogo.esperar(4000);
  expect(await jogo.js<number>("__b.fol")).toBeLessThan(fol0);
  // cravar a espada: segurar acumula, soltar não arranca; apertar e soltar arranca
  await jogo.js(
    "window.__w=__t.trainWolf(); __w.x=__t.dungeon.px+24; __w.y=__t.dungeon.py; __t.dungeon.gstam=100; __t.cravStart(__w,'eq_espada'); __t.cravPress()",
  );
  expect(await jogo.js("!!__t.dungeon.crav")).toBe(true);
  await jogo.esperar(2000);
  expect(await jogo.js<number>("__t.dungeon.crav ? __t.dungeon.crav.stored : 0")).toBeGreaterThan(0);
  await jogo.js("__t.cravRelease()");
  expect(await jogo.js("!!__t.dungeon.crav")).toBe(true);
  const arrancar = await jogo.js<{ dano: number; crav: boolean }>(
    "(()=>{const h0=__w.hp; __t.cravPress(); __t.cravRelease(); return {dano:h0-__w.hp, crav:!!__t.dungeon.crav}})()",
  );
  expect(arrancar.dano).toBeGreaterThan(0);
  expect(arrancar.crav).toBe(false);
  // dicas dos itens e a ficha
  expect(
    (
      await jogo.js<string[][]>(
        "__t.itemStatLines(__t.ensureEquip(__t.dungeon.hero).maoD||{def:__t.ITEM_DEFS.eq_espada})",
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(await jogo.js<string>("__t.statsHtml(__t.dungeon.hero)")).toContain("<");
  await jogo.foto("fim");
});

test("tdano2/tdano3/tdano4/tdano5 — cravado sem segurar solta sozinho e cobra um preço", async ({ jogo }) => {
  await campoComLobo(jogo);
  await jogo.js(
    "const d=__t.dungeon; d.monsters.length=0; window.__w=__t.trainWolf(); __w.x=d.px+24; __w.y=d.py; __t.cravStart(__w,'eq_espada')",
  );
  expect(await jogo.js<number>("__t.dungeon.crav.max")).toBeGreaterThan(0);
  // perto do fim: o próximo passo solta a arma (tdano4/tdano5, no mesmo instante)
  const fim = await jogo.js<{ crav: boolean; noAtk: number }>(
    "(()=>{const d=__t.dungeon; d.crav.t=d.crav.max-0.01; d.invuln=0; __t.cravTick(0.05); return {crav:!!d.crav, noAtk:d.noAtk||0}})()",
  );
  expect(fim.crav).toBe(false);
  expect(fim.noAtk).toBeGreaterThan(0);
  // sem atacar logo depois (tdano3)
  expect(await jogo.js("(()=>{const h0=__w.hp; __t.dungeon.cd=0; __t.swingBasic(); return h0===__w.hp})()")).toBe(true);
  // segurar com o mouse de verdade (tdano3)
  await jogo.esperar(1600);
  await jogo.js(
    "__w.cravCd=0; __w.x=__t.dungeon.px+24; __w.y=__t.dungeon.py; __t.dungeon.noAtk=0; __t.cravStart(__w,'eq_espada')",
  );
  const c = await centroDoCanvas(jogo);
  await jogo.page.mouse.move(c[0], c[1]);
  await jogo.page.mouse.down();
  await jogo.esperar(1200);
  expect(await jogo.js("__t.dungeon.crav && __t.dungeon.crav.hold")).toBeTruthy();
  await jogo.foto("segurando");
  await jogo.page.mouse.up();
  const h0 = await jogo.js<number>("__w.hp");
  await jogo.page.mouse.down();
  await jogo.esperar(80);
  await jogo.page.mouse.up();
  await jogo.esperar(100);
  expect(await jogo.js<number>("__w.hp")).toBeLessThan(h0); // clique arranca
});

test("tcrav/tcrav2/tcrav3 — cravar: zoom ao segurar, andar arrasta, botão direito arranca; laço só no marcado", async ({
  jogo,
}) => {
  await campoComLobo(jogo);
  await jogo.js(
    "const d=__t.dungeon; d.monsters.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; window.__w=__t.trainWolf(); __w.x=d.px+30; __w.y=d.py; d.gstam=100; d.invuln=0; __t.cravStart(__w,'eq_espada')",
  );
  const c = await centroDoCanvas(jogo);
  await jogo.page.mouse.move(c[0], c[1]);
  await jogo.page.mouse.down();
  await jogo.esperar(1500);
  expect(await jogo.js("!!__t.dungeon.crav")).toBe(true);
  expect(await jogo.js<number>("__t.CZ.f")).not.toBe(0); // a câmera aproxima
  await jogo.foto("segurando");
  await jogo.page.mouse.up();
  await jogo.esperar(300);
  const h0 = await jogo.js<number>("__w.hp");
  await jogo.page.mouse.click(c[0], c[1], { button: "right" });
  await jogo.esperar(200);
  expect(await jogo.js<number>("__w.hp")).toBeLessThan(h0);
  expect(await jogo.js("!!__t.dungeon.crav")).toBe(false);
  // lança cravada também (tcrav2)
  await jogo.js(
    "const d=__t.dungeon; d.monsters.length=0; window.__w=__t.trainWolf(); __w.x=d.px+30; __w.y=d.py+10; d.gstam=100; d.invuln=0; __t.cravStart(__w,'eq_lanca')",
  );
  expect(await jogo.js("!!__t.dungeon.crav")).toBe(true);
  await jogo.page.mouse.down();
  await jogo.esperar(1300);
  await jogo.foto("lanca");
  await jogo.page.mouse.up();
  await jogo.page.mouse.click(c[0], c[1], { button: "right" });
  // laço só no alvo marcado
  await jogo.js("window.__z=__t.trainWolf(); __z.hp=__z.hpMax; __t.dungeon.target=null");
  expect(await jogo.js("!!__t.canBind(__z)")).toBe(false);
  await jogo.js("__t.dungeon.target=__z");
  expect(await jogo.js("!!__t.canBind(__z)")).toBe(true);
});

test("trope/trope2/tfaca — faca, laço com G, cabo de guerra e finalizar com E", async ({ jogo }) => {
  await campoComLobo(jogo);
  // v7.7: finalizar com E só com faca no cinto (a v7.6 não tem cinto: lá a faca vai na mochila)
  await jogo.js(
    "(()=>{const h=__t.dungeon.hero; if (__t.cintoDe) __t.presilhas(__t.cintoDe(h))[0]=__t.mkItem('eq_faca'); else __t.tryAddToInv(__t.ensureInv(h),'eq_faca')})()",
  );
  expect(await jogo.js("!!__t.ropeItem(__t.dungeon.hero)")).toBe(true);
  // facada
  const faca = await jogo.js<number>(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); window.__m=m; m.x=d.px+28; m.y=d.py; d.mouse={x:m.x,y:m.y}; const h0=m.hp; __t.knifeStab(); return h0-m.hp})()",
  );
  expect(faca).toBeGreaterThan(0);
  // laço no lobo fraco
  await jogo.js(
    "__m.hp=__m.hpMax*0.3; __m.x=__t.dungeon.px+__t.dungeon.tile*3; __m.y=__t.dungeon.py; __t.dungeon.target=__m; __t.dungeon.mouse={x:__m.x,y:__m.y}",
  );
  expect(await jogo.js("!!__t.canBind(__m)")).toBe(true);
  await jogo.page.keyboard.down("KeyG");
  await jogo.esperar(600);
  expect(await jogo.js("!!__m.bound")).toBe(true);
  await jogo.esperar(1500);
  await jogo.foto("cabo-de-guerra");
  await jogo.page.keyboard.up("KeyG");
  await jogo.js("const d=__t.dungeon; d.px=__m.x-d.tile*0.8; d.py=__m.y;");
  await jogo.esperar(200);
  expect(await jogo.js("!!__t.finishTarget()")).toBe(true);
  await jogo.foto("finalizar");
  const nl = await jogo.js<number>("__t.dungeon.loot.length");
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(1200);
  expect(await jogo.js("__m.alive")).toBe(false);
  expect(await jogo.js<number>("__t.dungeon.loot.length")).toBeGreaterThan(nl);
  // atordoar com pouca vida desmaia
  await jogo.js("window.__m2=__t.trainWolf(); __m2.hp=__m2.hpMax*0.2; __t.applyStun(__m2,1.0);");
  await jogo.esperar(300);
  expect(await jogo.js<number>("__m2.ko||0")).toBeGreaterThan(0);
});

test("tvis62 — flechas cravadas e espada cravada aparecem", async ({ jogo }) => {
  await campoComLobo(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; window.__b=__t.trainWolf(); __b.x=d.px+140; __b.y=d.py+40; const r=Math.random; Math.random=()=>0.01; __t.arrowStick(__b,{vx:1,vy:0},3); __t.arrowStick(__b,{vx:1,vy:0.4},3); Math.random=r; window.__w=__t.trainWolf(); __w.x=d.px+24; __w.y=d.py; __t.cravStart(__w,'eq_espada'); __t.cravPress();})()",
  );
  await jogo.esperar(1500);
  expect(await jogo.js<number>("__b.stk.length")).toBe(2);
  await jogo.foto("cravadas");
});

test("t68 — campo aberto: coelho foge, morre e deixa carne; lobo neutro", async ({ jogo }) => {
  await campoAberto(jogo, 1);
  expect(await jogo.js("__t.dungeon.mode")).toBe("campo");
  expect(await jogo.js<number>("__t.dungeon.monsters.filter(m=>m.critter).length")).toBeGreaterThan(0);
  await jogo.esperar(3000);
  await jogo.foto("campo");
  const coelho = await jogo.js<number[] | null>(
    "(()=>{const d=__t.dungeon, m=d.monsters.find(x=>x.critter&&x.sp==='rabbit'&&x.alive); if(!m) return null; d.px=m.x-40; d.py=m.y; window.__r=m; return [m.x,m.y]})()",
  );
  if (coelho) {
    await jogo.esperar(1200);
    const p = await jogo.js<number[]>("[__r.x,__r.y]");
    expect(Math.hypot(p[0] - coelho[0], p[1] - coelho[1])).toBeGreaterThan(5); // fugiu
    const n0 = await jogo.js<number>("__t.dungeon.loot.length");
    await jogo.js("__t.hurtMonster(__r, 99, 'arco', 1)");
    await jogo.esperar(300);
    expect(await jogo.js("__r.alive")).toBe(false);
    expect(await jogo.js<number>("__t.dungeon.loot.length")).toBeGreaterThan(n0);
  }
  if (await jogo.js("__t.dungeon.monsters.some(x=>x.neutral)")) {
    await jogo.js("const d=__t.dungeon, w=d.monsters.find(x=>x.neutral); window.__w=w; d.px=w.x-60; d.py=w.y;");
    await jogo.esperar(800);
    expect(await jogo.js("__w.alive")).toBe(true);
  }
});

test("t70/t77b — coelho, cervos e pássaros; pássaros voam e soltam penas; cervo foge sem tremer", async ({ jogo }) => {
  await campoAberto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2; const r=__t.critSpawn('rabbit'); r.x=d.px+40; r.y=d.py+20; r.ang=Math.PI; r.tgt=null; r.t=99; r.st='graze'; const a=__t.critSpawn('deer'); a.sex='M'; a.x=d.px+110; a.y=d.py-10; a.tgt=null; a.t=99; a.st='wander'; const f=__t.critSpawn('deer'); f.sex='F'; f.x=d.px+110; f.y=d.py+60; f.tgt=null; f.t=99; f.st='graze'; d.birds.forEach((b,i)=>{b.x=d.px-60-i*20; b.y=d.py+30; b.tx=b.x+1; b.ty=b.y; b.st='idle'; b.t=99; b.flyT=99;}); __t.CAMPO_VIDA.perto=0; __t.CRIT_SP.rabbit.scare=0; __t.CRIT_SP.deer.scare=0; __t.AVE.susto=0;})()",
  );
  await jogo.esperar(800);
  await jogo.foto("bichos");
  if (await jogo.js<number>("__t.dungeon.birds.length")) {
    await jogo.js(
      "(()=>{const d=__t.dungeon; __t.AVE.susto=2.4; for (const b of d.birds) {b.flyT=99;} d.px=d.birds[0].x+20; d.py=d.birds[0].y; })()",
    );
    await jogo.esperar(500);
    expect(await jogo.js("__t.dungeon.birds.some(b=>b.st!=='idle')")).toBe(true);
    await jogo.foto("voo");
  }
  // t77b: seguir um cervo devagar; ele não fica virando de um lado para o outro
  await jogo.js(
    "(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); window.__c=__t.critSpawn('deer'); __c.x=d.px+3*T; __c.y=d.py; __c.sex='M'; __t.CRIT_SP.deer.scare=1; window.__trk=[]; window.__tk=setInterval(()=>__trk.push(__c.ang),40);})()",
  );
  for (let i = 0; i < 12; i++) {
    await jogo.js(
      "(()=>{const d=__t.dungeon,T=d.tile; const a=Math.atan2(__c.y-d.py,__c.x-d.px); const dist=Math.hypot(__c.x-d.px,__c.y-d.py); if(dist>4.2*T){d.px+=Math.cos(a)*T*0.5; d.py+=Math.sin(a)*T*0.5;}})()",
    );
    await jogo.esperar(300);
  }
  const angs = await jogo.js<number[]>("(clearInterval(__tk), __trk)");
  let viradas = 0;
  for (let i = 1; i < angs.length; i++) {
    const d = Math.abs(((((angs[i] - angs[i - 1] + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
    if (d > 0.5) viradas++;
  }
  expect(angs.length).toBeGreaterThan(20);
  expect(viradas).toBeLessThan(angs.length / 4);
});

test("t70b — cervo flechado perde fôlego até desmaiar; coelho cai com uma flechada", async ({ jogo }) => {
  await campoAberto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2; window.__c=__t.critSpawn('deer'); __c.x=d.px+5*T; __c.y=d.py; d.target=__c; __t.hurtMonster(__c, 30, 'arco', 1); __t.arrowStick(__c, {vx:1,vy:0}); })()",
  );
  const fol0 = await jogo.js<number>("__c.fol");
  await jogo.esperar(5000);
  expect((await jogo.js<number>("__c.fol")) < fol0 || !(await jogo.js("__c.alive"))).toBe(true);
  expect(
    await jogo.js("(()=>{const r=__t.critSpawn('rabbit'); __t.hurtMonster(r, 20, 'arco', 1); return r.alive})()"),
  ).toBe(false);
});

test("t72 — laçar um cervo, puxões até dominar, ele vem junto", async ({ jogo }) => {
  await campoAberto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2; d.gstam=100; if(!__t.ropeItem(__h)) __t.giveItem(__h,'corda',0); window.__c=__t.critSpawn('deer'); __c.x=d.px+3*T; __c.y=d.py; __c.sex='M'; d.target=__c; __t.CRIT_SP.deer.scare=0; d.mouse={x:__c.x,y:__c.y}; __t.ropeThrow(); })()",
  );
  await jogo.esperar(600);
  expect(await jogo.js("!!__c.bound")).toBe(true);
  await jogo.foto("lacou");
  let dominou = false;
  for (let i = 0; i < 14 && !dominou; i++) {
    await jogo.page.keyboard.press("g");
    await jogo.esperar(450);
    dominou = await jogo.js<boolean>("!!(__c.bound && __c.bound.dom)");
  }
  expect(dominou).toBe(true);
  await jogo.esperar(1000);
  const c0 = await jogo.js<number[]>("[__c.x,__c.y]");
  await jogo.page.keyboard.down("a");
  await jogo.esperar(2500);
  await jogo.page.keyboard.up("a");
  const c1 = await jogo.js<number[]>("[__c.x,__c.y]");
  expect(Math.hypot(c1[0] - c0[0], c1[1] - c0[1])).toBeGreaterThan(10); // veio junto
  await jogo.foto("puxando");
});

test("t74 — observar o galho por nível de percepção; talhar uma lança de madeira", async ({ jogo }) => {
  await campoComLobo(jogo);
  await jogo.js("__h.skills=__h.skills||{}; for(let i=0;i<4;i++) __t.giveItem(__h,'galho',0)");
  const textos: string[] = [];
  for (const lv of [1, 3]) {
    await jogo.js(`__h.skills.percepcao={level:${lv},xp:0}; __t.galhoObservar(__h)`);
    await jogo.esperar(200);
    textos.push(await jogo.js<string>("document.getElementById('obs-pop').innerText"));
  }
  expect(textos[1].length).toBeGreaterThanOrEqual(textos[0].length);
  await jogo.js("__t.giveItem(__h,'eq_faca',0); __t.galhoObservar(__h)");
  await jogo.esperar(200);
  expect(await jogo.js("__t.forgeKnows('eq_lanca_madeira')")).toBe(true);
  await jogo.foto("observar");
  const g0 = await jogo.js<number>("__t.itemCnt(__h,'galho')");
  await jogo.js("__t.galhoTalhar(__h)");
  expect(await jogo.js<number>("__t.itemCnt(__h,'galho')")).toBeLessThan(g0);
  expect(await jogo.js("__t.ensureInv(__h).items.some(i=>i.def.key==='eq_lanca_madeira')")).toBe(true);
  await jogo.js(
    "(()=>{const inv=__t.ensureInv(__h), it=inv.items.find(i=>i.def.key==='eq_lanca_madeira'); inv.items.splice(inv.items.indexOf(it),1); __t.ensureEquip(__h).maoD=it; __t.dungeon.weapon='melee';})()",
  );
  expect(await jogo.js("__t.spearMode()")).toBeTruthy();
});

test("t75/t75b — chance de cravar, arremesso carregado crava mais, segurar sangra, prompt de finalizar", async ({
  jogo,
}) => {
  await campoComLobo(jogo);
  await jogo.js("window.__w=__t.trainWolf()");
  expect(await jogo.js<number>("__t.cravChanceMelee(__w, __t.DANO.ARMAS.eq_lanca, 'eq_lanca')")).toBeGreaterThan(0);
  const ch = await jogo.js<number[]>(
    "[0.5,1.0].map(ch=>{let n=0; for(let i=0;i<2000;i++) if(__t.spearThrowStick(__w,false,{ch})) n++; return n/2000})",
  );
  expect(ch[1]).toBeGreaterThanOrEqual(ch[0]);
  await jogo.js(
    "(()=>{const d=__t.dungeon,T=d.tile; d.monsters.length=0; d.px=d.cols*T/2; d.py=d.rows*T/2; const e=__t.ensureEquip(__h); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; window.__w=__t.trainWolf(); __w.x=d.px+60; __w.y=d.py; __w.hp=__w.hpMax=60; d.gstam=100; __t.cravStart(__w,'eq_lanca');})()",
  );
  await jogo.esperar(500);
  const h0 = await jogo.js<number>("__w.hp");
  const c = await centroDoCanvas(jogo);
  await jogo.page.mouse.move(c[0] + 200, c[1]);
  await jogo.page.mouse.down();
  await expect.poll(() => jogo.js<number>("__w.hp"), { timeout: 8000 }).toBeLessThan(h0);
  await jogo.foto("segurando");
  await jogo.page.mouse.up();
  await jogo.page.mouse.click(c[0], c[1], { button: "right" });
  await jogo.esperar(300);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; window.__k=__t.trainWolf(); __k.x=d.px+30; __k.y=d.py; __k.ko=10; d.loot.push({key:'pedra',ground:true,t:0,ttl:0,x:d.px-10,y:d.py+8});})()",
  );
  await jogo.esperar(500);
  expect(await jogo.js("__t.finPrompt()")).toBeTruthy();
  await jogo.foto("finalizar");
  // t75b: cravar num cervo com lança e com espada
  for (const k of ["eq_lanca", "eq_espada"]) {
    await jogo.js(
      `(()=>{const d=__t.dungeon,T=d.tile; d.monsters.length=0; d.crav=null; d.px=d.cols*T/2; d.py=d.rows*T/2; const e=__t.ensureEquip(__h); const it=__t.mkItem('${k}'); __t.eqDurInit(it); e.maoD=it; window.__w=__t.critSpawn('deer'); __w.sex='M'; __w.x=d.px+70; __w.y=d.py; __w.hp=__w.hpMax=200; d.gstam=100; __t.CRIT_SP.deer.scare=0; __t.cravStart(__w,'${k}'); __t.CRAV2.foge=0;})()`,
    );
    expect(await jogo.js("!!__t.dungeon.crav"), k).toBe(true);
    await jogo.esperar(600);
    await jogo.foto(`cervo_${k}`);
    await jogo.js("__t.cravRip && __t.cravRip()");
    await jogo.esperar(300);
  }
});
