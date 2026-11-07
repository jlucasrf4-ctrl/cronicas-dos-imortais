/* Mapa do mundo: inspetores, janelas, trabalho/minijogos, câmera e zoom, quadrantes (regiões simuladas),
   navegação, efeitos flutuantes, caça pelo mapa, carpintaria, Vila Musgo, seguir o herói, salvar/carregar.
   Portado de legacy-py: t4, t8, t34, t40, t41, t42, t50, t51, t52, t76, t77, t106, tmap, tmap2, tnav, tcen, tfx,
   tfx2, tvis66, thunt, tbal, tcarp, ttap, tbase, tmob2.
   Não portados: t25 (abria v38.html, um build que não existe mais), tmap_b (comparava com vtest_before.html; os
   dois projetos do Playwright fazem isso agora), tload/tfps (medem tempo real: viraram tests/browser/tools/perf). */
import { test, expect, entrarComHeroi, avancarHora } from "./comum.ts";

test("t4 — inspetor da raposa, carne na mochila, janelas arrastáveis", async ({ jogo }) => {
  const r = await jogo.js<{ name: string; bars: string[] }>(
    "(()=>{const f=__t.world.wild.find(w=>w.alive&&w.species==='fox')||__t.addWild('fox',300,300,{}); __t.openWildInspector(f); const g=id=>document.getElementById(id).textContent; return {name:g('insp-name'),bars:['b-hunger','b-thirst','b-energy','b-health'].map(i=>document.getElementById(i).style.width)}})()",
  );
  expect(r.name).toBeTruthy();
  expect(r.bars.every((b) => /%$/.test(b))).toBe(true);
  await jogo.esperar(300);
  await jogo.foto("raposa");
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla'); __t.updateHeroPanelUI()");
  const carne = await jogo.js<{ pack: number; sellable: number }>(
    "(()=>{const h=__h; __t.giveMeat(h,8); return {pack:__t.meatInPack(h),sellable:h.inv.items.filter(i=>i.def.key==='carne').length}})()",
  );
  expect(carne.pack).toBeGreaterThan(0);
  if (await jogo.tem("openHeroInspector")) {
    await jogo.js("__t.openHeroInspector(__h)");
    await jogo.esperar(200);
    await jogo.page.click("[data-act=ibag]");
    await jogo.esperar(400);
    await jogo.foto("mochila");
    await jogo.page.click("#inspector-close");
  }
  const box = await jogo.caixa("#hero-panel h2");
  await jogo.page.mouse.move(box.x + 20, box.y + 8);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(box.x + 400, box.y + 200, { steps: 6 });
  await jogo.page.mouse.up();
  await jogo.esperar(300);
  await jogo.page.locator("#stats-panel .win-x").click();
  await jogo.esperar(200);
  await jogo.foto("janelas");
  expect(await jogo.js<string>("document.getElementById('hero-panel').style.left")).toBeTruthy();
  expect(await jogo.js("document.getElementById('stats-panel').classList.contains('win-hidden')")).toBe(true);
});

test("t8 — trabalho: escolha entre minijogo e automático, pedra, pesca, baú", async ({ jogo }) => {
  await jogo.js("__t.closeTitle(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.updateHeroPanelUI()");
  await jogo.js("__t.askWork(__h,'rock',()=>{window.__auto=1})");
  await jogo.esperar(200);
  expect(await jogo.js("document.getElementById('wm-modal').classList.contains('open')")).toBe(true);
  await jogo.foto("escolha");
  await jogo.page.click("#wm-auto");
  expect(await jogo.js("window.__auto")).toBe(1);
  await jogo.js("__t.askWork(__h,'rock',()=>{window.__auto=2})");
  await jogo.page.click("#wm-play");
  await jogo.esperar(300);
  expect(await jogo.js("document.getElementById('mg-modal').classList.contains('open')")).toBe(true);
  for (let i = 0; i < 6; i++) {
    await jogo.esperar(250);
    await jogo.page.keyboard.press("Space");
  }
  await jogo.esperar(200);
  await jogo.foto("minijogo");
  await jogo.page.click("#mg-hit");
  await jogo.esperar(200);
  // pesca só perto da água
  expect(await jogo.js("(()=>{const w=__t.world.waterPoints[0]; return !!__t.fishSpot(w.x+5,w.y)})()")).toBe(true);
  expect(await jogo.js("!!__t.fishSpot(-500,-500)")).toBe(false);
  // coelho: sem escolha, direto
  await jogo.js("window.__x=0; __t.askWork(__h,'rabbit',()=>{window.__x=1})");
  expect(await jogo.js("window.__x")).toBe(1);
  await jogo.js("document.getElementById('btn-chest').click()");
  await jogo.esperar(300);
  await jogo.foto("bau");
});

test("t34 — salvar, avançar, carregar, menu de pausa e Continuar depois de recarregar", async ({ jogo }) => {
  await jogo.js(
    "__t.enterGame(); __t.createHero('Ayla',__t.bornFromSeed(777)); __t.createHero('Bento',__t.bornFromSeed(12)); __t.econ.gold=540; __t.updateHeroPanelUI()",
  );
  await jogo.esperar(1500);
  const r = await jogo.js<[boolean, number]>("(()=>{const ok=__t.saveTo('1'); return [ok, __t.world.tick]})()");
  expect(r[0]).toBeTruthy();
  await jogo.js("document.querySelector('[data-hs=\"8\"]').click()");
  await jogo.esperar(3000);
  expect(await jogo.js<number>("__t.world.tick")).toBeGreaterThan(r[1]);
  await jogo.js("__t.econ.gold=1; __t.world.heroes.pop()");
  expect(await jogo.js("__t.loadFrom('1')")).toBeTruthy();
  expect(await jogo.js("__t.econ.gold")).toBe(540);
  expect(await jogo.js("__t.world.heroes.map(h=>h.name).join(',')")).toBe("Ayla,Bento");
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(500);
  expect(await jogo.js("__t.world.paused")).toBe(true);
  await jogo.foto("menu");
  await jogo.js("document.querySelector('[data-g=save]').click()");
  await jogo.esperar(400);
  await jogo.foto("slots");
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(200);
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(300);
  expect(await jogo.js("__t.world.paused")).toBe(false);
  await jogo.page.reload();
  for (let i = 0; i < 300 && !(await jogo.js("!!window.__t")); i++) await jogo.page.waitForTimeout(100);
  await jogo.esperar(2500);
  await jogo.page.mouse.click(600, 400);
  await jogo.esperar(800);
  await jogo.foto("continuar");
  await jogo.js("document.querySelector('[data-act=continue]').click()");
  await jogo.esperar(1500);
  expect(await jogo.js("__t.TS.open")).toBe(false);
  expect(await jogo.js("__t.world.heroes.map(h=>h.name).join(',')")).toBe("Ayla,Bento");
  expect(await jogo.js("__t.econ.gold")).toBe(540);
});

test("t40/t41 — mapa vetorial em vários zooms, camadas de flora e fauna", async ({ jogo }) => {
  expect(await jogo.js("__t.MAPART && __t.MAPART.ready")).toBeTruthy();
  await jogo.js(
    "__t.enterGame(); __t.world.tick=12*60; __t.world.paused=true; document.getElementById('toggle-flora').click(); document.getElementById('toggle-fauna').click()",
  );
  await jogo.esperar(2500);
  await jogo.foto("inteiro");
  for (const [sc, cx, cy, nome] of [
    [3, 433, 337, "z3"],
    [8, 440, 330, "z8"],
    [4, 770, 630, "porto"],
    [5, 700, 215, "montanha"],
  ] as const) {
    await jogo.js(
      `(()=>{const c=__t.camera, vw=innerWidth, vh=innerHeight; c.scale=Math.max(c.minScale,${sc}); c.tx=vw/2-${cx}*c.scale; c.ty=vh/2-${cy}*c.scale; __t.applyCameraTransform(); })()`,
    );
    await jogo.esperar(2000);
    await jogo.foto(nome);
  }
  expect(await jogo.js<number>("__t.CITIES.length")).toBeGreaterThan(0);
});

test("t42 — título com o mapa novo e o mercado", async ({ jogo }) => {
  await jogo.page.mouse.click(600, 400);
  await jogo.esperar(1500);
  await jogo.foto("titulo");
  await jogo.js("__t.enterGame(); __t.createHero('Ayla',__t.bornFromSeed(777)); __t.renderMarket()");
  await jogo.esperar(500);
  await jogo.js("document.getElementById('btn-market') && document.getElementById('btn-market').click()");
  await jogo.esperar(700);
  await jogo.foto("mercado");
});

test("t50 — quadrantes: olhar outro quadrante com a câmera não troca a região ativa (v7.7)", async ({ jogo }) => {
  const r = await jogo.js<[boolean, string, number]>("[__t.MAPART.ready, __t.QUAD.active, __t.world.animals.length]");
  expect(r[0]).toBeTruthy();
  expect(r[2]).toBeGreaterThan(0);
  await jogo.js("__t.enterGame(); __t.world.tick=12*60; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777))");
  expect(await jogo.js("__t.quadName(__t.quadOf(__h.camp.x,__h.camp.y))")).toBeTruthy();
  await jogo.esperar(2500);
  await jogo.js(
    "(()=>{const c=__t.camera; c.scale=c.minScale; c.tx=0; c.ty=0; __t.constrainCamera(); __t.applyCameraTransform();})()",
  );
  await jogo.esperar(2500);
  await jogo.foto("mundo");
  const q0 = await jogo.js<string>("__t.QUAD.active");
  await jogo.js(
    "(()=>{const c=__t.camera, ct=__t.CITIES.find(x=>x.id==='rio'), vw=innerWidth, vh=innerHeight; c.scale=1.2; c.tx=vw/2-ct.x*c.scale; c.ty=vh/2-ct.y*c.scale; __t.applyCameraTransform();})()",
  );
  await jogo.esperar(4000);
  await jogo.foto("rio");
  const q1 = await jogo.js<string>("__t.QUAD.active");
  expect(typeof q1).toBe("string");
  if (!jogo.referencia)
    expect(q1).toBe(q0); // v7.7: só a ida de um herói troca a região (na v7.6 a câmera trocava)
  else if (q1 !== q0) expect(await jogo.js<string[]>("Object.keys(__t.QUAD.store)")).toContain(q0);
});

test("t51 — quadrante guardado no save; save antigo (mundo pequeno) migra", async ({ jogo }) => {
  await jogo.js("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.econ.gold=300");
  await jogo.js("__t.quadActivate('2,2')");
  await jogo.js("__t.quadActivate('0,4')");
  expect(await jogo.js<string[]>("Object.keys(__t.QUAD.store)")).toContain("2,2");
  expect(await jogo.js("__t.saveTo('1')")).toBeTruthy();
  await jogo.js("__t.quadActivate('2,2')");
  await jogo.js("__t.loadFrom('1')");
  expect(await jogo.js("__t.QUAD.active")).toBe("0,4");
  const cx = await jogo.js<number>("__t.world.heroes[0].camp.x");
  await jogo.js(
    "(()=>{const d=JSON.parse(localStorage.getItem('cdi.save.1')); delete d.K; for(const h of d.world.heroes){h.x/=4;h.y/=4;h.camp.x/=4;h.camp.y/=4;} delete d.world.qstore; delete d.world.activeQ; localStorage.setItem('cdi.save.2',JSON.stringify(d)); localStorage.setItem('cdi.savemeta.2',localStorage.getItem('cdi.savemeta.1'));})()",
  );
  await jogo.js("__t.loadFrom('2')");
  expect(Math.abs((await jogo.js<number>("__t.world.heroes[0].camp.x")) - cx)).toBeLessThan(2); // coordenadas ×4
  expect(await jogo.js<number>("__t.world.animals.length")).toBeGreaterThan(0);
  await jogo.js(
    "(()=>{const h=__t.world.heroes[0], ct=__t.CITIES.find(c=>c.id==='rio'); h.task={x:ct.x+40,y:ct.y+30,killsDone:0,species:'rabbit',maxMin:700}; h.state='traveling';})()",
  );
  await jogo.esperar(1500);
});

test("t52 — novo jogo pulando a abertura", async ({ jogo }) => {
  await jogo.page.mouse.click(600, 400);
  await jogo.esperar(500);
  await jogo.js("document.querySelector('[data-act=new]').click()");
  await jogo.esperar(800);
  await jogo.js("__t.introSkip()");
  await jogo.esperar(800);
  await jogo.js(
    "document.getElementById('create-cancel').click(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.world.tick=11*60; __t.updateHeroPanelUI()",
  );
  await jogo.esperar(3000);
  expect(await jogo.js("__t.world.heroes.length")).toBe(1);
  await jogo.foto("mapa");
});

test("t76 — Vila Musgo: botões perto e longe, empório, venda e bote", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    "__t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.econ.gold=40; __t.econ.test=false;",
  );
  expect(await jogo.js("!!__t.musgoCity()")).toBe(true);
  expect(await jogo.js("__t.ITEM_DEFS.eq_calca.name")).toBeTruthy();
  await jogo.js("__t.openCityInspector(__t.musgoCity())");
  await jogo.esperar(300);
  const longe = await jogo.js<string[]>("[...document.querySelectorAll('#insp-actions button')].map(b=>b.textContent)");
  await jogo.js("(()=>{const c=__t.musgoCity(); __h.x=c.x+5; __h.y=c.y+5; __t.openCityInspector(c)})()");
  await jogo.esperar(300);
  const perto = await jogo.js<string[]>("[...document.querySelectorAll('#insp-actions button')].map(b=>b.textContent)");
  expect(perto.length).toBeGreaterThanOrEqual(longe.length);
  await jogo.js("document.getElementById('inspector').classList.remove('open'); __t.empOpen(__h)");
  await jogo.esperar(300);
  await jogo.js(
    "document.querySelector('#musgo-modal [data-k=corda]').click(); document.querySelector('#musgo-modal [data-k=pele]').click()",
  );
  await jogo.esperar(200);
  expect(await jogo.js<number>("__t.econ.gold")).toBeLessThan(40);
  await jogo.foto("emporio");
  await jogo.js("document.querySelector('#musgo-modal [data-t=venda]').click()");
  await jogo.esperar(200);
  const n = await jogo.js<number>("document.querySelectorAll('#musgo-modal [data-mz=sell]').length");
  if (n > 0) {
    const ouro = await jogo.js<number>("__t.econ.gold");
    await jogo.js("document.querySelector('#musgo-modal [data-mz=sell]').click()");
    await jogo.esperar(200);
    expect(await jogo.js<number>("__t.econ.gold")).toBeGreaterThanOrEqual(ouro);
  }
  await jogo.foto("venda");
  const antes = await jogo.js<number[]>("[__h.x,__h.y]");
  await jogo.js("document.querySelector('#musgo-modal [data-mz=bote]').click()");
  await jogo.esperar(2200);
  expect(await jogo.js<number[]>("[__h.x,__h.y]")).not.toEqual(antes); // o bote leva o herói à doca
  await jogo.foto("bote");
  await jogo.js("__t.camZoomTo(__h.camp.x,__h.camp.y,__t.mapZoomLimit(),10)");
  await jogo.esperar(1500);
  await jogo.foto("zoom");
});

test("t77 — a câmera segue o herói; arrastar solta; zoom na roda", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3; __h.state='field';");
  const centro = () =>
    jogo.js<number[]>(
      "(()=>{const vp=document.getElementById('viewport'); return [(vp.clientWidth/2-__t.camera.tx)/__t.camera.scale, (vp.clientHeight/2-__t.camera.ty)/__t.camera.scale]})()",
    );
  // v7.7 (RTS): a câmera começa livre; F liga o seguir
  if (!jogo.referencia) await jogo.page.keyboard.press("KeyF");
  await jogo.js("__h.walkTo={x:__h.x+120,y:__h.y-60}; __h.state='walking'");
  await jogo.esperar(2500);
  const c = await centro();
  const h = await jogo.js<number[]>("[__h.x,__h.y]");
  expect(Math.hypot(c[0] - h[0], c[1] - h[1])).toBeLessThan(60);
  await jogo.foto("seguindo");
  const vp = await jogo.js<number[]>(
    "(()=>{const r=document.getElementById('viewport').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()",
  );
  // v7.7 (RTS): quem arrasta o mapa no mouse é o botão do meio
  const botao = jogo.referencia ? "left" : "middle";
  await jogo.page.mouse.move(vp[0], vp[1]);
  await jogo.page.mouse.down({ button: botao });
  await jogo.page.mouse.move(vp[0] + 200, vp[1] + 80, { steps: 6 });
  await jogo.page.mouse.up({ button: botao });
  await jogo.esperar(500);
  expect(await jogo.js("__t.SEGUIR.solto")).toBeTruthy();
  await jogo.js("document.getElementById('segue-btn').click()");
  await jogo.esperar(1500);
  expect(await jogo.js("__t.SEGUIR.solto")).toBeFalsy();
  const s0 = await jogo.js<number>("__t.camera.scale");
  for (let i = 0; i < 30; i++) {
    await jogo.page.mouse.wheel(0, 300);
    await jogo.esperar(40);
  }
  await jogo.esperar(1500);
  expect(await jogo.js<number>("__t.camera.scale")).toBeLessThan(s0);
  await jogo.foto("zoom-fora");
  for (let i = 0; i < 40; i++) {
    await jogo.page.mouse.wheel(0, -300);
    await jogo.esperar(30);
  }
  await jogo.esperar(1500);
  await jogo.foto("zoom-dentro");
});

test("t106 — os animais do mundo têm espécie", async ({ jogo }) => {
  await jogo.js("__t.enterGame()");
  await jogo.esperar(800);
  expect(
    await jogo.js(
      "(()=>{const a=__t.world.animals.find(a=>a.species==='fox')||__t.world.animals[0]; return a.species})()",
    ),
  ).toBeTruthy();
});

test("tmap — escala do mundo e zoom até o limite", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3; __h.state='field';");
  expect(await jogo.js<number>("__t.WORLD_K")).toBeGreaterThan(0);
  const lim = await jogo.js<number>("__t.mapZoomLimit()");
  expect(lim).toBeGreaterThan(0);
  await jogo.foto("mapa0");
  await jogo.js("__t.camZoomTo(2000, 1500, __t.camera.minScale*1.0, 10)");
  await jogo.esperar(1500);
  await jogo.foto("mapa1");
});

test("tmap2/tnav — navegação: componentes, A*, animais fora d'água, desvio", async ({ jogo }) => {
  test.setTimeout(180_000);
  await entrarComHeroi(jogo, "A", 1);
  const nav = await jogo.js<{ ready: boolean; comps: number; main: number }>(
    "(()=>{const N=__t.NAV; return {ready:N.ready, comps:N.compSize.length, main:N.compSize[N.mainComp]}})()",
  );
  expect(nav.ready).toBeTruthy();
  expect(nav.main).toBeGreaterThan(100);
  expect(await jogo.js("__t.findPath(560,2240,440,2400) !== undefined")).toBe(true);
  // A* entre pontos da componente principal
  const astar = await jogo.js<{ ok: number; n: number }>(
    "(()=>{const N=__t.NAV;const pts=[];for(let k=0;k<N.w*N.h;k+=97) if(!N.blocked[k]&&N.comp[k]===N.mainComp) pts.push(k); let ok=0,n=0; for(let i=0;i<40;i++){const a=pts[(i*7919)%pts.length],b=pts[(i*104729+13)%pts.length]; const r=__t.findPath(N.ox+(a%N.w)*N.step,N.oy+((a/N.w)|0)*N.step,N.ox+(b%N.w)*N.step,N.oy+((b/N.w)|0)*N.step,Infinity); n++; if(r) ok++;} return {ok,n}})()",
  );
  expect(astar.ok).toBe(astar.n);
  // 600 passos de simulação: os animais não entram na água
  const agua = await jogo.js<number[]>(
    "(()=>{const inW=()=>__t.world.animals.filter(a=>a.alive&&__t.isWaterCell(a.x,a.y)).length; const a=inW(); for(let i=0;i<600;i++) __t.simTick(__t.CONFIG.TICK_MIN); return [a, inW(), __t.world.animals.filter(a=>a.alive).length]})()",
  );
  expect(agua[1]).toBeLessThanOrEqual(Math.max(agua[0], 2));
  expect(agua[2]).toBeGreaterThan(0);
  // desvio: entre dois pontos sem linha de visão o caminho contorna a água
  const desvio = await jogo.js<{ wet: number; arrived: boolean } | string>(
    "(()=>{const N=__t.NAV;const pts=[];for(let k=0;k<N.w*N.h;k+=37) if(!N.blocked[k]&&N.comp[k]===N.mainComp) pts.push(k); for(let t=0;t<500;t++){const a=pts[(t*7919)%pts.length],b=pts[(t*104729+13)%pts.length];const ax=N.ox+(a%N.w)*N.step,ay=N.oy+((a/N.w)|0)*N.step,bx=N.ox+(b%N.w)*N.step,by=N.oy+((b/N.w)|0)*N.step; const st=Math.hypot(bx-ax,by-ay); if(st<40||st>150||__t.losClear(ax,ay,bx,by)) continue; const o={x:ax,y:ay,dir:0,energy:100,species:'deer'}; let wet=0,steps=0,d=1e9; while(steps<600&&d>1){d=__t.moveStep(o,bx,by,2,1,true,Infinity); if(__t.isWaterCell(o.x,o.y)) wet++; steps++} return {wet,arrived:d<=1}} return 'none'})()",
  );
  if (typeof desvio !== "string") {
    expect(desvio.arrived).toBe(true);
    expect(desvio.wet).toBe(0);
  }
});

test("tcen — C centraliza o acampamento; botões de zoom", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.camera.scale=__t.camera.minScale; __t.camera.tx=0; __t.camera.ty=0");
  await jogo.esperar(300);
  await jogo.page.mouse.click(700, 500);
  await jogo.page.keyboard.press("KeyC");
  await jogo.esperar(1200);
  const r = await jogo.js<number[]>(
    "(()=>{const p=__h.camp, s=__t.camera.scale, vp=document.getElementById('viewport').getBoundingClientRect(); return [p.x*s+__t.camera.tx, p.y*s+__t.camera.ty, vp.width/2, vp.height/2]})()",
  );
  expect(Math.abs(r[0] - r[2])).toBeLessThan(80);
  expect(Math.abs(r[1] - r[3])).toBeLessThan(80);
  expect(await jogo.js("!!document.getElementById('zoom-hero') && !!document.getElementById('zoom-camp')")).toBe(true);
  await jogo.js("document.getElementById('zoom-hero').click()");
  await jogo.esperar(1000);
  await jogo.foto("centro");
});

test("tfx/tfx2 — texto flutuante no mapa some sozinho", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    "const s=__t.camera.minScale*8; __t.camera.scale=s; __t.camera.tx=683-__h.x*s; __t.camera.ty=430-__h.y*s;",
  );
  await jogo.js(
    "window.__fx={h:__h,x:__h.x,y:__h.y-6,txt:'+1 carne',ico:'meat_coelho_1',t0:performance.now()}; __t.MAPFX.push(__fx)",
  );
  await jogo.esperar(300);
  expect(await jogo.js("__t.MAPFX.includes(__fx)")).toBe(true);
  await jogo.foto("fx", { x: 533, y: 300, width: 300, height: 200 });
  await jogo.esperar(5000);
  expect(await jogo.js("__t.MAPFX.includes(__fx)")).toBe(false);
});

test("tvis66 — populações dentro da capacidade", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  await jogo.esperar(6000);
  const pops = await jogo.js<number[][]>(
    "['rabbit','deer','wolf','boar'].map(k=>[__t.populationOf(k), __t.SPECIES[k].carryingCapacity])",
  );
  for (const [n, cap] of pops) {
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(cap * 1.5);
  }
});

test("thunt — andar até uma pedra, trabalhar a área, voltar ao acampamento", async ({ jogo }) => {
  test.setTimeout(180_000);
  await entrarComHeroi(jogo, "A", 1);
  expect(await jogo.js("!!document.querySelector('[data-act=walk]')")).toBe(true);
  await jogo.js("document.querySelector('[data-act=walk]').click()");
  await jogo.js(
    "(()=>{const r=__t.world.nodes.find(n=>n.kind==='rock'&&Math.hypot(n.x-__h.camp.x,n.y-__h.camp.y)>150); window.__rk=r; __t.walkClick(__h.id, r.x+20, r.y)})()",
  );
  expect(await jogo.js("__h.walkTo")).toBeTruthy();
  for (let i = 0; i < 12 && (await jogo.js("__h.state")) !== "field"; i++) await avancarHora(jogo);
  expect(await jogo.js("__h.state")).toBe("field");
  expect(await jogo.js<number>("Math.hypot(__h.x-__h.camp.x,__h.y-__h.camp.y)")).toBeGreaterThan(100);
  await jogo.js("__h.huntSpecies='rock'; __h.huntHours=4; __t.huntHere(__h)");
  await jogo.esperar(300);
  await jogo.js(
    "(()=>{const bs=[...document.querySelectorAll('#wm-modal button')]; const a=bs.find(b=>/autom|sozinho/i.test(b.textContent)); a&&a.click()})()",
  );
  expect(await jogo.js("!!__h.task")).toBe(true);
  for (let i = 0; i < 8; i++) await avancarHora(jogo);
  await jogo.foto("trabalho");
  await jogo.js("__t.heroBack(__h)");
  for (let i = 0; i < 10 && (await jogo.js("__h.state")) !== "idle"; i++) await avancarHora(jogo);
  expect(await jogo.js("__h.state")).toBe("idle");
  for (const an of ["coelho", "lobo", "javali"])
    for (let t = 0; t < 3; t++)
      expect((await jogo.js<number[][]>(`__t.meatShape('${an}',${t})`)).length).toBeGreaterThan(0);
});

test("tbal — caçar 12 h de cada alvo rende algo", async ({ jogo }) => {
  test.setTimeout(300_000);
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    "__t.ensureInv(__h).cols=60; __t.ensureInv(__h).rows=60; __t.econ.stash.cols=90; __t.econ.stash.rows=90;",
  );
  const conta =
    "(()=>{let n=0; for(const inv of [__t.ensureInv(__h),__t.econ.stash,__h.qv||{items:[]}]) for(const i of inv.items) n+=(i.n||1); for(const k in __h.loot) n+=(+__h.loot[k]||0); return n})()";
  let rendeu = 0;
  for (const alvo of ["rabbit", "deer", "tree", "rock"]) {
    await jogo.js(
      "__h.x=__h.camp.x; __h.y=__h.camp.y; __h.state='idle'; __h.task=null; __h.energy=100; __h.hunger=0; __h.mgUntil=0;",
    );
    const antes = await jogo.js<number>(conta);
    await jogo.js(`__h.huntSpecies='${alvo}'; __h.huntHours=12; __t.huntHere(__h)`);
    await jogo.esperar(150);
    await jogo.js(
      "(()=>{const a=[...document.querySelectorAll('#wm-modal button')].find(b=>/sozinho/i.test(b.textContent)); a&&a.click()})()",
    );
    for (let i = 0; i < 16; i++) {
      await avancarHora(jogo);
      const st = await jogo.js("__h.state");
      if (st !== "hunting" && st !== "traveling" && i > 2) break;
    }
    if ((await jogo.js<number>(conta)) > antes) rendeu++;
  }
  expect(rendeu).toBeGreaterThanOrEqual(3);
});

test("tcarp — caçar longe do acampamento; carpintaria: tábuas e caixa", async ({ jogo }) => {
  test.setTimeout(180_000);
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    "for(const a of __t.world.animals) if(a.species==='rabbit' && Math.hypot(a.x-__h.camp.x,a.y-__h.camp.y)<120){a.x+=200;}",
  );
  await jogo.js("__h.huntSpecies='rabbit'; __h.huntHours=6; __t.huntHere(__h)");
  await jogo.esperar(200);
  await jogo.js(
    "(()=>{const a=[...document.querySelectorAll('#wm-modal button')].find(b=>/sozinho/i.test(b.textContent)); a&&a.click()})()",
  );
  expect(await jogo.js("!!__h.task")).toBe(true);
  for (let i = 0; i < 8; i++) await avancarHora(jogo);
  // carpintaria: aplainar faz tábuas
  await jogo.js("__t.econ.test=false; __h.loot.wood=20; __t.carpOpen(__h)");
  await jogo.esperar(500);
  await jogo.foto("carpintaria");
  const aplainar = async () => {
    await jogo.js("document.querySelector('[data-cp=plane]') && document.querySelector('[data-cp=plane]').click()");
    await jogo.esperar(400);
    const bb = await jogo.caixa("#cp-cv");
    for (let row = 0; row < 8; row++) {
      const y = bb.y + bb.height * (0.33 + row * 0.05);
      await jogo.page.mouse.move(bb.x + 10, y);
      await jogo.page.mouse.down();
      await jogo.page.mouse.move(bb.x + bb.width - 10, y, { steps: 8 });
      await jogo.page.mouse.up();
      await jogo.esperar(30);
    }
    await jogo.esperar(1000);
  };
  for (let k = 0; k < 4; k++) await aplainar();
  const tabuas = await jogo.js<number>("__t.tabCount()");
  expect(tabuas).toBeGreaterThan(0);
  const linhas = await jogo.js<number>("__t.econ.stash.rows");
  await jogo.js("document.querySelector('[data-cp=caixa]').click()");
  await jogo.esperar(300);
  if ((await jogo.js<number>("__t.econ.caixas||0")) > 0)
    expect(await jogo.js<number>("__t.econ.stash.rows")).toBeGreaterThan(linhas);
  await jogo.foto("caixa");
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("ttap/tbase — tocar no herói abre o menu da base e a expedição", async ({ jogo }) => {
    await entrarComHeroi(jogo, "A", 1);
    await jogo.js("document.querySelectorAll('.v3-modal.open,#inspector.open').forEach(e=>e.classList.remove('open'))");
    await jogo.js(
      "const p=__h.camp, s=__t.camera.minScale*10; __t.camera.scale=s; __t.camera.tx=195-p.x*s; __t.camera.ty=422-p.y*s;",
    );
    await jogo.esperar(700);
    const pt = await jogo.js<number[]>(
      "(()=>{const r=document.getElementById('viewport').getBoundingClientRect(); return [r.left+__t.camera.tx+__h.x*__t.camera.scale, r.top+__t.camera.ty+__h.y*__t.camera.scale]})()",
    );
    await jogo.page.touchscreen.tap(pt[0], pt[1]);
    await jogo.esperar(600);
    expect(await jogo.js("!!document.querySelector('#base-menu.open')")).toBe(true);
    await jogo.foto("menu-base");
    await jogo.js("document.querySelector('#base-menu [data-bm=exp]').click()");
    await jogo.esperar(500);
    await jogo.foto("expedicao");
  });

  test("tmob2 — controles de zoom em pé", async ({ jogo }) => {
    await entrarComHeroi(jogo, "A", 1);
    await jogo.esperar(400);
    expect(await jogo.js("getComputedStyle(document.getElementById('zoom-controls')).display")).not.toBe("none");
    await jogo.foto("em-pe");
  });
});

test.describe("celular deitado", () => {
  test.use({ viewport: { width: 740, height: 320 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test("tmob2 — controles de zoom deitado", async ({ jogo }) => {
    await entrarComHeroi(jogo, "A", 1);
    await jogo.esperar(400);
    expect(await jogo.js<number>("document.querySelectorAll('#zoom-controls > *').length")).toBeGreaterThan(0);
    await jogo.foto("deitado");
  });
});

test("tbase — clique no herói (PC) abre o menu da base", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    "const p=__h.camp, s=__t.camera.minScale*10; __t.camera.scale=s; __t.camera.tx=683-p.x*s; __t.camera.ty=430-p.y*s;",
  );
  await jogo.esperar(700);
  const pt = await jogo.js<number[]>(
    "(()=>{const r=document.getElementById('viewport').getBoundingClientRect(); return [r.left+__t.camera.tx+__h.x*__t.camera.scale, r.top+__t.camera.ty+__h.y*__t.camera.scale]})()",
  );
  const aberto = () =>
    jogo.js(
      "!!document.querySelector('#base-menu.open') || document.getElementById('inspector').classList.contains('open')",
    );
  await jogo.page.mouse.click(pt[0], pt[1]);
  await jogo.esperar(500);
  // v7.7 (RTS, map/selecao.ts): o primeiro clique seleciona a heroína; clicar de novo nela abre o menu
  if (!jogo.referencia && !(await aberto())) {
    await jogo.page.mouse.click(pt[0], pt[1]);
    await jogo.esperar(500);
  }
  await jogo.foto("menu");
  expect(await aberto()).toBe(true);
});
