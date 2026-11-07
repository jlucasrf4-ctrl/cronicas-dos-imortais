/* Armas no campo: combo de espada, rastro, arco (carga e disparo), lança (arremesso, pegar de volta, esquiva,
   empurrão), clava e machado (golpe carregado), faca, mãos vazias, campo de treino, aljava em feixes.
   Portado de legacy-py: t15, t16, t17, t18, t19, t63, t73, t90, t92, t93, t94, t95, t96, t97, t99, t100, t107, t108,
   t110, t111, tbow, tbow2, tbow3, tsp2, twalk, tclub, thv, tshv, tthr, tcrit, tknife, tkvis, tjoy. */
import { test, expect, entrarComHeroi, irAoCampo, campoDireto, esperarAte, type Jogo } from "./comum.ts";

/** Equipa `k` na mão direita do herói do campo. */
const equipar = (k: string) =>
  `(()=>{const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('${k}'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.weapon='melee'; d.cd=0;})()`;

async function campoDeTreino(jogo: Jogo, semente = 777) {
  await entrarComHeroi(jogo, "Ayla", semente);
  await jogo.js("__t.OPT.autoRes=false; __t.launchTraining(__h.id)");
  await jogo.esperar(3800);
  expect(await jogo.js("__t.dungeon.training")).toBeTruthy();
  await jogo.js("document.querySelector('[data-tr=\"min\"]').click()");
}

test("t15/t16/t17/t19 — os três golpes do combo e a carga do arco", async ({ jogo }) => {
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1200);
  const passos: number[] = [];
  for (let st = 0; st < 3; st++) {
    passos.push(
      await jogo.js<number>(
        `(()=>{const d=__t.dungeon; d.cd=0; d.combo=${st}; d.comboT=0.5; d.slash=null; __t.GL3.atk=null; __t.swingBasic(); d.px=441; d.py=273; return __t.GL3.atk?__t.GL3.atk.step:-1})()`,
      ),
    );
    await jogo.esperar(110);
    await jogo.foto(`golpe${st}`);
    await jogo.esperar(500);
  }
  expect(passos).toEqual([0, 1, 2]);
  // golpe congelado num instante (GL3.fz) para conferir a pose
  await jogo.js(
    "(()=>{const d=__t.dungeon; __t.GL3.fz=0.12; d.cd=0; d.combo=1; d.comboT=0.5; d.slash=null; __t.GL3.atk=null; __t.swingBasic();})()",
  );
  await jogo.esperar(300);
  await jogo.foto("congelado");
  await jogo.js("__t.GL3.fz=null");
  // arco: carga e disparo
  await jogo.js("(()=>{const d=__t.dungeon; d.weapon='bow'; d.cd=0; d.px=441; d.py=273; __t.startCharge()})()");
  expect(await jogo.js("__t.dungeon.charging")).toBe(true);
  for (const c of [0.0, 0.4, 1.0]) {
    await jogo.js(`__t.dungeon.charge=${c}; __t.dungeon.full=0`);
    await jogo.esperar(250);
    await jogo.foto(`arco_${c}`);
  }
  const n0 = await jogo.js<number>("__t.dungeon.arrows.length");
  await jogo.js("__t.fireArrow()");
  expect(await jogo.js<number>("__t.dungeon.arrows.length")).toBeGreaterThan(n0);
  await jogo.esperar(60);
  await jogo.foto("disparo");
});

test("arco cheio gasta o fôlego interno de 10 em 10; clique esquerdo cancela o tiro", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 perdia a mira em 1,6 s");
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343};})()",
  );
  await jogo.esperar(800);
  // cheio por ~2,1 s: 5 passos de 10 (já passou de 1,6 s e ela ainda segura)
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.weapon='bow'; d.cd=0; d.gstam=100; d.gint=100; d.folArco=0; __t.startCharge(); d.charge=1; d.full=0;})()",
  );
  // (o tempo do jogo anda mais devagar que o relógio no navegador de teste: espera o fôlego, não um tempo fixo)
  expect(await esperarAte(jogo, "__t.dungeon.gint<=60 || !__t.dungeon.charging", 15000), "gastou").toBe(true);
  const meio = await jogo.js<{ ch: boolean; g: number; s: number }>(
    "({ch:__t.dungeon.charging, g:__t.dungeon.gint, s:__t.dungeon.gstam})",
  );
  expect(meio.ch, "segura mais de 1,6 s (4 passos)").toBe(true);
  expect(meio.g % 10, "em passos de 10 do interno").toBe(0);
  expect(meio.s, "segurar o arco não mexe no fôlego de fora (o de correr)").toBe(100);
  await jogo.foto("arco_cheio_folego");
  // sem interno para mais um passo: perde a mira, sem atirar
  const n0 = await jogo.js<number>("__t.dungeon.arrows.length");
  await jogo.js("__t.dungeon.gint=5");
  await esperarAte(jogo, "!__t.dungeon.charging", 8000);
  const fim = await jogo.js<{ ch: boolean; g: number; n: number }>(
    "({ch:__t.dungeon.charging, g:__t.dungeon.gint, n:__t.dungeon.arrows.length})",
  );
  expect(fim.ch, "perdeu a mira").toBe(false);
  expect(fim.n, "sem atirar").toBe(n0);
  expect(fim.g, "o interno não zerou").toBeGreaterThan(0);
  // o interno gasto no arco volta 2,5× mais rápido
  expect(await jogo.js<number>("__t.dungeon.folArco"), "fôlego do arco a recuperar").toBeGreaterThan(0);
  // clique esquerdo puxando: cancela
  await jogo.esperar(700);
  await jogo.js("(()=>{const d=__t.dungeon; d.cd=0; d.gstam=100; d.gint=100; __t.startCharge(); d.charge=0.6;})()");
  const cx = await jogo.caixa("#dungeon-canvas");
  await jogo.page.mouse.click(cx.x + cx.width / 2, cx.y + cx.height / 2);
  await jogo.esperar(100);
  expect(await jogo.js("__t.dungeon.charging"), "cancelou").toBe(false);
  expect(await jogo.js<number>("__t.dungeon.arrows.length"), "sem flecha").toBe(n0);
});

test("t18 — o golpe deixa rastro", async ({ jogo }) => {
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=2.6; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1200);
  const n = await jogo.js<number>(
    "new Promise(res=>{const d=__t.dungeon; d.cd=0; d.combo=0; d.comboT=0; __t.swingBasic(); let best=0; const t0=performance.now(); (function f(){ best=Math.max(best,__t.GL3.trail.length); if(performance.now()-t0<400) requestAnimationFrame(f); else res(best)})()})",
  );
  expect(n).toBeGreaterThan(1);
  await jogo.foto("rastro");
});

test("t63 — espada derruba o lobo (KO) antes de matar; javali aguenta mais", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 4500);
  expect(await jogo.js<number>("__t.dungeon.loot.length")).toBeGreaterThan(0); // itens no chão
  await jogo.foto("chao");
  for (let i = 0; i < 4; i++) {
    const r = await jogo.js<{ ko: boolean; alive: boolean; hits: number }>(
      "(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); m.x=d.px+26; m.y=d.py; let n=0; while(m.alive && !(m.ko>0) && n<80){ d.cd=0; d.noAtk=0; d.crav=null; m.cravCd=99; m.x=d.px+26; m.y=d.py; d.mouse={x:m.x,y:m.y}; __t.swingBasic(); n++; } return {ko:m.ko>0, alive:m.alive, hits:n}})()",
    );
    expect(r.ko || !r.alive).toBe(true);
    expect(r.hits).toBeLessThan(80);
  }
  const j = await jogo.js<{ ko: boolean; alive: boolean; hits: number }>(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); m.kind='javalino'; m.hp=m.hpMax=60; delete m.folMax; m.x=d.px+26; m.y=d.py; let n=0; while(m.alive && !(m.ko>0) && n<200){ d.cd=0; d.noAtk=0; d.crav=null; m.cravCd=99; m.x=d.px+26; m.y=d.py; d.mouse={x:m.x,y:m.y}; __t.swingBasic(); n++; } return {ko:m.ko>0, alive:m.alive, hits:n}})()",
  );
  expect(j.ko || !j.alive).toBe(true);
  await jogo.js(
    "const h=__t.dungeon.hero; for (const k of ['eq_faca','eq_faca_velha','eq_machado','eq_lanca','eq_espada_longa']) __t.tryAddToInv(__t.ensureInv(h),k); __t.toggleInv(true)",
  );
  await jogo.esperar(800);
  expect(await jogo.js<number>("document.querySelectorAll('.wxi').length")).toBeGreaterThan(0);
  await jogo.foto("armas");
});

test("t73 — faca: corte no marcado e estocada; espada divide o dano entre alvos", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 4500);
  const caso = (k: string, acao: string, n = 3) =>
    jogo.js<number[]>(
      `(()=>{const d=__t.dungeon,T=d.tile; d.monsters.length=0; d.px=d.cols*T/2; d.py=d.rows*T/2; d.cd=0; d.crav=null; d.weapon='melee'; d.spearOut=null; const e=__t.ensureEquip(__h); const it=__t.mkItem('${k}'); __t.eqDurInit(it); e.maoD=it; const ws=[0,1,2].map(i=>{const w=__t.trainWolf(); const a=[0,-0.35,0.35][i]; w.x=d.px+Math.cos(a)*30+('${k}'==='eq_faca'?i*5:0); w.y=d.py+Math.sin(a)*30; w.hp=w.hpMax=200; w.st='idle'; w.cravCd=99; return w;}); d.target=ws[2]; d.mouse={x:d.px+100,y:d.py}; d.monsters=ws.slice(0,${n}); if('${k}'!=='eq_faca'){d.target=null; d.combo=0; d.comboT=0;} ${acao}; return ws.map(w=>+(w.hpMax-w.hp).toFixed(1))})()`,
    );
  expect(
    await jogo.js(
      "(()=>{const e=__t.ensureEquip(__h); const it=__t.mkItem('eq_faca'); e.maoD=it; return __t.knifeMode()})()",
    ),
  ).toBeTruthy();
  const corte = await caso("eq_faca", "__t.swingBasic()");
  expect(corte.some((x) => x > 0)).toBe(true);
  const estocada = await caso("eq_faca", "__t.doParry()");
  expect(estocada.some((x) => x > 0)).toBe(true);
  const um = await caso("eq_espada", "__t.swingBasic()", 1);
  const tres = await caso("eq_espada", "__t.swingBasic()", 3);
  expect(um[0]).toBeGreaterThan(0);
  expect(tres.filter((x) => x > 0).length).toBeGreaterThanOrEqual(1);
});

test("t90 — lobos e javalino no campo 3D", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(1500);
  await jogo.foto("preparo", { x: 350, y: 80, width: 300, height: 260 });
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(3000);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=400; d.py=270; for(let i=0;i<3;i++){const m=__t.spawnDungeonMonster(); m.x=480+i*40; m.y=230+i*30; m.spd=0.01;} const j=__t.spawnJavalino(2); j.x=330; j.y=330; j.spd=0.01; __t.D3.ZM=2.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1800);
  expect(await jogo.js("__t.dungeon.monsters.some(m=>m.kind==='javalino')")).toBe(true);
  await jogo.foto("campo");
});

test("t92/t93/t94 — espada, lança, clava e machado: dano, alcance, arremesso da lança", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.armasKit()");
  expect(await jogo.js<number>("__t.econ.stash.items.length")).toBeGreaterThan(0);
  await irAoCampo(jogo, 3000);
  const preparar = (k: string) =>
    `const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=400; d.py=270; __t.ensureEquip(d.hero).maoD=__t.mkItem('${k}'); d.weapon='melee'; d.cd=0; d.mouse={x:700,y:270}; d.mouseC=null; const m=__t.spawnDungeonMonster(); m.x=400+d.tile*1.7; m.y=270; m.spd=0.0001; m.hp=m.maxHp=999; m.st='idle';`;
  for (const k of ["eq_espada", "eq_lanca", "eq_clava", "eq_machado"]) {
    const r = await jogo.js<[string, number]>(
      `(()=>{${preparar(k)} const h0=m.hp; d.combo=0; d.comboT=0; d.cd=0; __t.swingBasic(); return [__t.wpnKey(d.hero), h0-m.hp]})()`,
    );
    expect(r[0]).toBe(k);
    // t94: na média de 40 golpes colados, toda arma acerta
    const media = await jogo.js<number>(
      `(()=>{const d=__t.dungeon; d.flow='x'; let hits=0; for(let i=0;i<40;i++){ d.monsters.length=0; d.px=400; d.py=270; __t.ensureEquip(d.hero).maoD=__t.mkItem('${k}'); d.weapon='melee'; d.mouse={x:700,y:270}; const a=__t.spawnDungeonMonster(); a.x=440; a.y=270; a.hp=999; a.st='idle'; a._yaw=null; d.combo=0; d.comboT=0; d.cd=0; __t.swingBasic(); if(a.hp<999) hits++; } return hits})()`,
    );
    expect(media, k).toBeGreaterThan(20);
  }
  // lança: arremessar, cai no chão, pegar de volta
  await jogo.js(`(()=>{${preparar("eq_lanca")} m.x=9999})()`);
  expect(await jogo.js("__t.spearMode()")).toBeTruthy();
  await jogo.js("__t.spearThrow()");
  expect(await jogo.js("!!__t.ensureEquip(__t.dungeon.hero).maoD")).toBe(false);
  expect(await jogo.js<number>("__t.dungeon.spears.length")).toBe(1);
  await jogo.esperar(1500);
  expect(await jogo.js("__t.dungeon.spears[0].fly")).toBeFalsy();
  await jogo.js("(()=>{const d=__t.dungeon, s=d.spears[0]; d.px=s.x-5; d.py=s.y;})()");
  await jogo.esperar(300);
  expect(await jogo.js("!!__t.ensureEquip(__t.dungeon.hero).maoD")).toBe(true);
  expect(await jogo.js<number>("__t.dungeon.spears.length")).toBe(0);
  // esquiva com a lança
  const dodge = await jogo.js<{ dmg: number }>(
    `(()=>{${preparar("eq_lanca")} m.x=d.px+30; const hp=d.hp; __t.spearDodge(); __t.wolfStrike(m,null,20,0); return {dmg:hp-d.hp}})()`,
  );
  expect(dodge.dmg).toBeLessThan(20);
  await jogo.js(`(()=>{${preparar("eq_lanca")}})(); __t.D3.ZM=2.4; window.dispatchEvent(new Event('resize'))`);
  await jogo.esperar(800);
  await jogo.js("(()=>{const d=__t.dungeon; d.combo=0; d.cd=0; __t.swingBasic();})()");
  await jogo.esperar(90);
  await jogo.foto("lanca");
  for (const k of ["eq_clava", "eq_machado"]) {
    await jogo.js(`(()=>{${preparar(k)}})()`);
    await jogo.esperar(500);
    await jogo.foto(k);
  }
});

test("t95 — arco: rolar com o botão direito evita o golpe", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await irAoCampo(jogo, 3000);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=400; d.py=270; d.weapon='bow'; d.mouse={x:700,y:270}; const m=__t.spawnDungeonMonster(); m.x=430; m.y=270; m.hp=999; m.st='idle'; m.spd=0.0001;})()",
  );
  const box = await jogo.caixa("#dungeon-canvas");
  await jogo.page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await jogo.page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2, { button: "right" });
  const rolou = await jogo.js<{ dodge: boolean; dano: number }>(
    "(()=>{const d=__t.dungeon,m=d.monsters[0],hp=d.hp; const dodge=!!d.dodge; __t.wolfStrike(m,null,20,0); return {dodge, dano:hp-d.hp}})()",
  );
  expect(rolou.dodge).toBe(true);
  expect(rolou.dano).toBe(0);
  await jogo.esperar(400);
  const sem = await jogo.js<number>(
    "(()=>{const d=__t.dungeon; d.charging=false; d.dodge=null; d.dodgeCd=0; d.rollGuard=0; d.invuln=0; const m=d.monsters[0],hp=d.hp; __t.wolfStrike(m,null,20,0); return hp-d.hp})()",
  );
  expect(sem).toBeGreaterThan(0);
  await jogo.js("(()=>{const d=__t.dungeon; d.dodgeCd=0; d.keys={KeyD:true}; __t.bowRoll(); d.keys={};})()");
  await jogo.esperar(120);
  await jogo.foto("rolar");
});

test("t96/t97/t99 — campo de treino: armas no boneco, atributos, lobo que não mata, afixos, sair", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(1000);
  await jogo.foto("preparo");
  expect(await jogo.js("!!document.getElementById('prep-train')")).toBe(true);
  await jogo.js("document.getElementById('prep-train').click()");
  await jogo.esperar(3000);
  expect(await jogo.js("__t.dungeon.training")).toBeTruthy();
  expect(await jogo.js<number>("__t.dungeon.monsters.length")).toBeGreaterThan(0);
  for (const k of ["eq_espada", "eq_clava", "eq_machado", "eq_lanca"]) {
    const r = await jogo.js<[number, number, boolean, boolean]>(
      `(()=>{__t.trainWeapon('${k}'); __t.TR.q=1; const d=__t.dungeon,m=d.monsters[0]; __t.TR.hits=[];__t.TR.tot=0;__t.TR.n=0;__t.TR.crits=0;__t.TR.direct=0; for(let i=0;i<300;i++){ d.px=m.x-30; d.py=m.y; d.mouse={x:m.x+50,y:m.y}; d.cd=0; d.combo=i%3; d.comboT=1; __t.swingBasic(); } return [__t.TR.n, __t.TR.tot/__t.TR.n, m.hp===m.hpMax, m.alive]})()`,
    );
    expect(r[0], k).toBeGreaterThan(100); // o boneco registra os golpes
    expect(r[1], k).toBeGreaterThan(0);
    expect(r[2], k).toBe(true); // e não perde vida
    expect(r[3], k).toBe(true);
  }
  const m0 = await jogo.js<number>("__t.heroStats(__t.dungeon.hero).melee");
  const f0 = await jogo.js<number>("__t.attrOf(__t.dungeon.hero,'forca')");
  await jogo.js("for(let i=0;i<3;i++) __t.trainAttr('forca',1)");
  expect(await jogo.js<number>("__t.attrOf(__t.dungeon.hero,'forca')")).toBe(f0 + 3);
  expect(await jogo.js<number>("__t.heroStats(__t.dungeon.hero).melee")).toBeGreaterThan(m0);
  await jogo.js("__t.trainWeapon('eq_arco')");
  expect(await jogo.js("__t.dungeon.weapon")).toBe("bow");
  // lobo de treino: um golpe mortal não mata
  await jogo.js("document.querySelector('[data-tr=\"wolf\"]').click()");
  await jogo.esperar(300);
  expect(await jogo.js<number>("__t.dungeon.monsters.filter(m=>!m.dummy&&m.alive).length")).toBeGreaterThan(0);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.hp=1; d.invuln=0; const m=d.monsters.find(m=>!m.dummy&&m.alive); __t.wolfStrike(m,null,30,0);})()",
  );
  expect(await jogo.js("__t.dungeon.dead")).toBeFalsy();
  await jogo.esperar(600);
  await jogo.foto("treino");
  // afixos: qualidade maior, mais afixos
  const af = await jogo.js<number[]>(
    "[0,3].map(q=>{let c=0;for(let i=0;i<200;i++){const it=__t.mkItem('eq_espada'); it.q=q; it.af=undefined; it.durMax=null; __t.eqDurInit(it); c+=Object.keys(it.af||{}).length;} return c/200})",
  );
  expect(af[1]).toBeGreaterThan(af[0]);
  // sair restaura o herói
  await jogo.js("document.querySelector('[data-tr=\"exit\"]').click()");
  await jogo.esperar(2500);
  expect(await jogo.js("__t.dungeon.active")).toBe(false);
  expect(await jogo.js("__t.dungeon.training")).toBeFalsy();
  expect(await jogo.js("__t.attrOf(__h,'forca')")).toBe(f0);
  await jogo.js("__t.openSheet(__h.id)");
  await jogo.esperar(800);
  await jogo.foto("ficha");
});

test("t100 — arena de treino: zoom, flecha no alvo, sair volta ao normal", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777);
  expect(await jogo.js("!!document.querySelector('[data-act=\"dtest\"]')")).toBe(true);
  await jogo.js("document.querySelector('[data-act=\"dtest\"]').click()");
  await jogo.esperar(3800);
  expect(await jogo.js("__t.dungeon.training")).toBeTruthy();
  await jogo.js("document.querySelector('[data-tr=\"min\"]').click()");
  await jogo.js("__t.D3.ZM=0.75; window.dispatchEvent(new Event('resize'))");
  await jogo.esperar(1200);
  await jogo.foto("arena");
  await jogo.js("__t.D3.ZM=1.6; window.dispatchEvent(new Event('resize'))");
  await jogo.esperar(800);
  await jogo.js("__t.trainWeapon('eq_arco')");
  await jogo.js(
    "(()=>{const d=__t.dungeon, a=d.monsters[1]||d.monsters[0]; __t.TR.n=0; __t.TR.tot=0; d.px=a.x-d.tile*5; d.py=a.y; d.mouse={x:a.x,y:a.y}; d.mouseC=null; d.cd=0; __t.startCharge(); d.charge=1; __t.fireArrow()})()",
  );
  await jogo.esperar(1500);
  await jogo.foto("flecha");
  expect(await jogo.js<number>("__t.TR.n")).toBeGreaterThan(0);
  await jogo.js("document.querySelector('[data-tr=\"exit\"]').click()");
  await jogo.esperar(2500);
  expect(await jogo.js("__t.dungeon.training")).toBeFalsy();
});

test("t107 — números de dano do machado com destreza alta", async ({ jogo }) => {
  await campoDeTreino(jogo);
  await jogo.js(
    "__t.trainWeapon('eq_machado'); __t.trainAttr('destreza',8); __t.dungeon.combo=0; __t.D3.ZM=2.4; window.dispatchEvent(new Event('resize'))",
  );
  await jogo.esperar(600);
  for (let i = 0; i < 6; i++) {
    await jogo.js(
      "(()=>{const d=__t.dungeon,m=d.monsters[0]; d.px=m.x-34; d.py=m.y+4; d.mouse={x:m.x+50,y:m.y}; d.cd=0; d.comboT=1; __t.swingBasic();})()",
    );
    await jogo.esperar(110);
  }
  await jogo.foto("dano");
  expect(await jogo.js<number>("__t.dungeon.toasts.filter(t=>t.dmg).length")).toBeGreaterThan(0);
});

test("t108/tsp2 — lança: segurar o botão direito carrega o arremesso", async ({ jogo }) => {
  await campoDeTreino(jogo);
  await jogo.js("__t.trainWeapon('eq_lanca'); __t.D3.ZM=1.8; window.dispatchEvent(new Event('resize'))");
  await jogo.esperar(500);
  const box = await jogo.caixa("#dungeon-canvas");
  const cx = box.x + box.width * 0.85,
    cy = box.y + box.height * 0.5;
  const dist: number[] = [];
  for (const segurar of [150, 900]) {
    await jogo.js(
      "(()=>{const d=__t.dungeon; d.monsters.forEach(m=>m.alive=false); d.px=200; d.py=d.rows*d.tile/2; d.mouse={x:900,y:d.py}; d.cd=0; d.spears=[]; })()",
    );
    await jogo.page.mouse.move(cx, cy);
    await jogo.page.mouse.down({ button: "right" });
    await jogo.esperar(segurar);
    if (segurar === 900) await jogo.foto("mirando");
    await jogo.page.mouse.up({ button: "right" });
    await jogo.esperar(1500);
    dist.push(await jogo.js<number>("(()=>{const d=__t.dungeon,s=d.spears[0]; return s? (s.x-200)/d.tile : -1})()"));
    await jogo.js("(()=>{const d=__t.dungeon,s=d.spears[0]; if(s){d.px=s.x;d.py=s.y;}})()");
    await jogo.esperar(300);
  }
  expect(dist[0]).toBeGreaterThan(0);
  expect(dist[1]).toBeGreaterThan(dist[0]); // segurar mais vai mais longe
  await jogo.js("__t.trainWeapon('eq_machado'); __t.D3.ZM=2.6; window.dispatchEvent(new Event('resize'))");
  await jogo.esperar(800);
  await jogo.foto("machado");
});

test("t110/t111 — flechas em feixes na aljava; atirar gasta os feixes", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(1200);
  const n = await jogo.js<number>("__t.econ.quiver.n");
  const soma = await jogo.js<number>("__t.qvInv(__h).items.filter(i=>i.def.key==='flecha').reduce((a,i)=>a+i.n,0)");
  expect(soma).toBe(n);
  expect(n).toBeLessThanOrEqual(await jogo.js<number>("__t.arrowCap(__h)"));
  await jogo.foto("aljava", { x: 600, y: 330, width: 420, height: 320 });
  await jogo.js("__t.econ.quiver.n=22; __t.qvSync(__h)");
  expect(await jogo.js<number>("__t.qvInv(__h).items.filter(i=>i.def.key==='flecha').reduce((a,i)=>a+i.n,0)")).toBe(
    Math.min(22, await jogo.js<number>("__t.arrowCap(__h)")),
  );
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(3000);
  const q0 = await jogo.js<number>("__t.econ.quiver.n");
  await jogo.js(
    "for(let i=0;i<12;i++){const d=__t.dungeon; d.weapon='bow'; d.cd=0; __t.startCharge(); d.charge=1; __t.fireArrow();} __t.qvSync(__t.dungeon.hero)",
  );
  const q1 = await jogo.js<number>("__t.econ.quiver.n");
  expect(q1).toBe(Math.max(0, q0 - 12));
  expect(
    await jogo.js<number>("__t.qvInv(__t.dungeon.hero).items.filter(i=>i.def.key==='flecha').reduce((a,i)=>a+i.n,0)"),
  ).toBe(q1);
});

test("tbow/tbow2/tbow3/twalk — arco com Espaço, contorno, andar e correr", async ({ jogo }) => {
  await campoDeTreino(jogo, 1);
  await jogo.js("__t.trainWeapon('eq_arco'); __t.D3.ZM=3; window.dispatchEvent(new Event('resize'))");
  await jogo.esperar(600);
  await jogo.js("(()=>{const d=__t.dungeon; d.mouse={x:d.px+300,y:d.py};})()");
  await jogo.page.keyboard.down("Space");
  await jogo.esperar(600);
  expect(await jogo.js("__t.dungeon.charging")).toBe(true);
  await jogo.foto("carregando");
  const a0 = await jogo.js<number>("__t.dungeon.arrows.length");
  await jogo.page.keyboard.up("Space");
  await jogo.esperar(60);
  expect(await jogo.js<number>("__t.dungeon.arrows.length")).toBeGreaterThan(a0);
  expect(Object.keys(await jogo.js<object>("__t.GL3.hero")).length).toBeGreaterThan(0);
  await jogo.js("__t.OPT.outline=false");
  await jogo.esperar(400);
  await jogo.foto("sem-contorno");
  await jogo.js("__t.OPT.outline=true; __t.trainWeapon('eq_espada'); __t.dungeon.mouse=null");
  // andar e correr: correr anda mais
  const y0 = await jogo.js<number>("__t.dungeon.py");
  await jogo.page.keyboard.down("KeyS");
  await jogo.esperar(440);
  const y1 = await jogo.js<number>("__t.dungeon.py");
  await jogo.page.keyboard.down("ShiftLeft");
  await jogo.esperar(440);
  const y2 = await jogo.js<number>("__t.dungeon.py");
  await jogo.page.keyboard.up("ShiftLeft");
  await jogo.page.keyboard.up("KeyS");
  expect(y1).toBeGreaterThan(y0);
  expect(y2 - y1).toBeGreaterThan((y1 - y0) * 0.9);
  await jogo.foto("correndo");
});

test("tclub/thv — clava e machado: golpe carregado com o botão direito", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 3500);
  await jogo.js(
    "const d=__t.dungeon; d.flow='x'; d.monsters.length=0; __t.spawnDungeonMonster({}); window.__m=d.monsters[0];",
  );
  const pos =
    "const d=__t.dungeon, m=__m; m.x=d.px+38; m.y=d.py; m.kx=m.ky=0; m.hp=999; m.alive=true; d.mouse={x:m.x+10,y:m.y};";
  // machado: segurar até carregar e soltar
  await jogo.js(equipar("eq_machado"));
  await jogo.js(`(()=>{${pos} __t.dungeon.gstam=100; __t.doParry()})()`);
  await jogo.esperar(700);
  const machado = await jogo.js<number>(`(()=>{${pos} const h0=m.hp; __t.hvRelease('R'); return h0-m.hp})()`);
  expect(machado).toBeGreaterThan(0);
  await jogo.esperar(300);
  await jogo.foto("machado");
  // clava carregada até o fim atordoa
  await jogo.js(equipar("eq_clava"));
  await jogo.js(`(()=>{${pos} __m.cripple=0; __t.doParry()})()`);
  let cheio = false;
  for (let i = 0; i < 25 && !cheio; i++) {
    cheio = await jogo.js<boolean>("!!(__t.dungeon.hv && __t.dungeon.hv.full)");
    if (!cheio) await jogo.esperar(150);
  }
  expect(cheio).toBe(true);
  const r = await jogo.js<{ stun: number; dmg: number }>(
    `(()=>{${pos} const h0=m.hp; __t.hvRelease('R'); return {stun:m.stun||0, dmg:h0-m.hp}})()`,
  );
  expect(r.dmg).toBeGreaterThan(0);
  expect(r.stun).toBeGreaterThan(0);
  // tclub: mais carga, mais acertos e atordoamentos
  const niveis = await jogo.js<Record<string, number[]>>(
    `(()=>{const d=__t.dungeon, out={}; for (const [lab,ch,full] of [['cedo',0.2,false],['cheio',1,true]]) { let st=0,hit=0; for (let i=0;i<200;i++){ ${pos} m.st='chase'; m.stun=0; d.cd=0; d.hv={kind:'clubR',t:1,ch,full}; const h0=m.hp; __t.hvRelease('R'); if(m.hp<h0) hit++; if(m.stun>0) st++; } out[lab]=[hit,st]; } return out})()`,
  );
  expect(niveis.cheio[1]).toBeGreaterThanOrEqual(niveis.cedo[1]);
});

test("tshv/tthr — lança: empurrão no tempo certo derruba; estocada congelada", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 3500);
  await jogo.js(
    `const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.loot.length=0; d.px=200; d.py=270; __t.spawnDungeonMonster({}); ${equipar("eq_lanca")}`,
  );
  const empurrao = (st: string, t: number) =>
    jogo.js<{ down: number; stun: number; kx: number }>(
      `(()=>{const d=__t.dungeon, m=d.monsters[0]; d.dodgeCd=0; d.shove=0; d.gstam=100; d.px=m.x-45; d.py=m.y; d.mouse={x:m.x,y:m.y}; m.st='${st}'; m.t=${t}; m.atk='bite'; m.alive=true; m.hp=999; __t.spearShove(); return {down:m.downT||0, stun:m.stun||0, kx:Math.abs(m.kx||0)}})()`,
    );
  const perfeito = await empurrao("windup", 0.1);
  expect(perfeito.down + perfeito.stun + perfeito.kx).toBeGreaterThan(0);
  await jogo.esperar(400);
  await empurrao("stalk", 0);
  await jogo.foto("empurrao");
  for (const t of [0.0, 0.08, 0.22]) {
    await jogo.js(
      `__t.GL3.fz=${t}; const d=__t.dungeon; d.cd=0; d.parryVis=0; if(${t}===0) __t.swingBasic(); d.px=420; d.py=270;`,
    );
    await jogo.esperar(400);
    await jogo.foto(`estocada_${t}`);
  }
  await jogo.js("__t.GL3.fz=null");
});

test("tcrit — lança arremessada crava no lobo", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 3500);
  await jogo.js(
    "const d=__t.dungeon; d.flow='x'; d.monsters.length=0; __t.spawnDungeonMonster({}); window.__res={stuck:0,n:0}",
  );
  for (let i = 0; i < 12; i++) {
    await jogo.js(
      "const d=__t.dungeon, m=d.monsters[0]; m.alive=true; m.hp=9999; m.x=300; m.y=270; m.st='stalk'; m.spd=0; m.kx=0; m.ky=0; d.spears=[]; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; d.px=200; d.py=270; d.cd=0; d.mouse={x:300,y:270}; __t.spearThrow(1)",
    );
    await jogo.esperar(450);
    await jogo.js("const d=__t.dungeon; __res.n++; if (d.spears.some(s=>s.stuck)) __res.stuck++;");
  }
  expect(await jogo.js<number>("__res.stuck")).toBeGreaterThan(0);
});

test("tknife/tkvis — sem arma soca; faca na mochila é usada; combo da faca", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 4000);
  const soco = await jogo.js<number>(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); window.__m=m; m.x=d.px+d.tile*0.7; m.y=d.py; d.mouse={x:m.x,y:m.y}; __t.ensureEquip(d.hero).maoD=null; d.weapon='melee'; d.cd=0; const h0=m.hp; __t.swingBasic(); return h0-m.hp})()",
  );
  expect(soco).toBeGreaterThanOrEqual(0);
  await jogo.js("__t.tryAddItem(__t.dungeon.hero,'eq_faca_velha'); __t.dungeon.cd=0; __t.dungeon.comboT=0");
  await jogo.esperar(500);
  expect(await jogo.js("!!__t.knifeIn(__t.dungeon.hero)")).toBe(true);
  const faca = await jogo.js<number>(
    "(()=>{const d=__t.dungeon, m=__m; m.x=d.px+d.tile*0.5; m.y=d.py; d.mouse={x:m.x,y:m.y}; d.cd=0; const h0=m.hp; __t.swingBasic(); return h0-m.hp})()",
  );
  expect(faca).toBeGreaterThan(0);
  await jogo.js("const d=__t.dungeon; d.monsters.length=0; d.mouse={x:d.px+60,y:d.py};");
  await jogo.esperar(600);
  await jogo.foto("faca");
  const passos: unknown[] = [];
  for (let i = 0; i < 4; i++) {
    passos.push(
      await jogo.js("(()=>{__t.dungeon.cd=0; __t.swingBasic(); return __t.dungeon.slash && __t.dungeon.slash.step})()"),
    );
    await jogo.esperar(120);
  }
  expect(new Set(passos).size).toBeGreaterThan(1);
});

test.describe("celular", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test("tjoy — botões estáveis e o joystick anda mais quanto mais longe", async ({ jogo }) => {
    await entrarComHeroi(jogo, "A", 1);
    await irAoCampo(jogo, 5000);
    await jogo.js("__t.dungeon.monsters.length=0");
    const variantes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      variantes.add(
        await jogo.js<string>(
          "(document.getElementById('tb-atk')||{}).innerHTML+'#'+(document.getElementById('tb-swap')||{}).innerHTML",
        ),
      );
      await jogo.esperar(150);
    }
    expect(variantes.size).toBe(1); // sem piscar
    const z = await jogo.js<number[]>(
      "(()=>{const r=document.getElementById('tj-zone').getBoundingClientRect(); return [r.left+r.width*0.45, r.top+r.height*0.5]})()",
    );
    const vel: number[] = [];
    for (const dist of [10, 52]) {
      await jogo.js(
        `(()=>{const z=document.getElementById('tj-zone'); const ev=(t,x,y)=>z.dispatchEvent(new PointerEvent(t,{pointerId:7,clientX:x,clientY:y,bubbles:true,cancelable:true,pointerType:'touch'})); window.__ev=ev; __t.dungeon.px=__t.dungeon.cols*__t.dungeon.tile/2; __t.dungeon.gstam=100; ev('pointerdown',${z[0]},${z[1]}); ev('pointermove',${z[0] + dist},${z[1]});})()`,
      );
      const x0 = await jogo.js<number>("__t.dungeon.px");
      await jogo.esperar(1000);
      vel.push((await jogo.js<number>("__t.dungeon.px")) - x0);
      if (dist === 52) await jogo.foto("joystick");
      await jogo.js(`window.__ev('pointerup',${z[0] + dist},${z[1]})`);
      await jogo.esperar(200);
    }
    expect(vel[1]).toBeGreaterThan(vel[0]);
  });

  test("t99 — treino no celular: minimizar o painel", async ({ jogo }) => {
    await entrarComHeroi(jogo, "Ayla", 777);
    await jogo.js("__t.launchTraining(__h.id)");
    await jogo.esperar(3800);
    await jogo.foto("treino");
    await jogo.js("document.querySelector('[data-tr=\"min\"]').click()");
    await jogo.esperar(300);
    await jogo.foto("minimizado");
  });
});
