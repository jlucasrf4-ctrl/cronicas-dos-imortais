/* Inventário em grade: qualidades (tiers), pilhas, aljava, baú, arrastar entre grades e para o chão,
   boneco de equipamento, divisão de pilha, feixe de flechas, menu do item, análise, loja de mochilas.
   Portado de legacy-py: t5, t6, t9, t60, t61, t62, t64, t65, t66, t102, t103, t105, t109, tinv3, tinvsp, tlay, tqv,
   tqv2, ttier, tpick, tbug2, t5907c, tana2. */
import { test, expect, entrarComHeroi, irAoCampo, campoDireto, type Jogo } from "./comum.ts";

/** Arrasta com o mouse de `a` até `b` (com um passo curto antes, para o arrasto começar). */
async function arrastar(jogo: Jogo, a: number[], b: number[], passos = 6) {
  await jogo.page.mouse.move(a[0], a[1]);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(a[0] + 15, a[1] + 5);
  await jogo.page.mouse.move(b[0], b[1], { steps: passos });
  await jogo.page.mouse.up();
  await jogo.esperar(300);
}

/** Centro da primeira célula ocupada do item `expr` dentro da grade `seletor` (células de 14 px). */
function centroDoItem(jogo: Jogo, seletor: string, expr: string) {
  return jogo.js<number[]>(
    `(()=>{const g=document.querySelector('${seletor}'), r=g.getBoundingClientRect(), it=${expr}; let rr=0,cc=0; outer: for(let i=0;i<it.shape.length;i++)for(let j=0;j<it.shape[0].length;j++) if(it.shape[i][j]){rr=i;cc=j;break outer;} return [r.left+(it.x+cc+0.5)*14, r.top+(it.y+rr+0.5)*14]})()`,
  );
}

function cantoDe(jogo: Jogo, id: string, dx = 25, dy = 25) {
  return jogo.js<number[]>(
    `(()=>{const r=document.getElementById('${id}').getBoundingClientRect(); return [r.right-${dx}, r.bottom-${dy}]})()`,
  );
}

test("t5 — qualidades, recursos como itens, aljava, mover rápido e a loja", async ({ jogo }) => {
  await jogo.js(
    "__t.closeTitle(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.updateHeroPanelUI()",
  );
  // formas e valores crescem com a qualidade
  const val = await jogo.js<number[]>("[0,1,2].map(t=>__t.itemVal({def:__t.ITEM_DEFS.carne,tier:t}))");
  expect(val[1]).toBeGreaterThan(val[0]);
  expect(val[2]).toBeGreaterThan(val[1]);
  const dist = await jogo.js<number[][]>(
    "(()=>{const c=[0,0,0];for(let i=0;i<4000;i++)c[__t.rollTier(false)]++;const d=[0,0,0];for(let i=0;i<4000;i++)d[__t.rollTier(true)]++;return [c,d]})()",
  );
  expect(dist[0][0]).toBeGreaterThan(dist[0][2]); // qualidade alta é rara
  await jogo.js("__t.giveMeat(__h,12)");
  expect(await jogo.js<number>("__h.inv.items.length")).toBeGreaterThan(0);
  await jogo.js("__t.resAdd(__h,'stone',10); __t.resAdd(__h,'feather',5)");
  expect(await jogo.js("__t.resCount(__h,'stone')")).toBe(10);
  expect(await jogo.js("__t.resCount(__h,'feather')")).toBe(5);
  await jogo.js("__t.openBag(__h.id)");
  await jogo.esperar(400);
  await jogo.foto("mochila");
  expect(await jogo.js<number>("__t.invGrids.length")).toBeGreaterThan(1);
  // v7.7: recursos vão primeiro para a mochila (a aljava só quando a mochila não tem lugar)
  expect(
    await jogo.js<number>("__h.inv.items.filter(i=>i.def.key==='pedra').length"),
    "pedras na mochila",
  ).toBeGreaterThan(0);
  expect(await jogo.js<number>("__t.qvInv(__h).items.filter(i=>i.def.key==='pedra').length"), "nenhuma na aljava").toBe(
    0,
  );
  // mover rápido: uma pilha de pedra da mochila para a aljava e de volta
  const ida = await jogo.js<boolean>(
    "(()=>{const b=__h.inv, it=b.items.find(i=>i.def.key==='pedra'); window.__p=it; const gr=__t.invGrids.find(g=>g.inv===b); __t.quickMove(it,gr); __t.renderInv(); return __t.qvInv(__h).items.includes(it);})()",
  );
  expect(ida, "foi para a aljava").toBe(true);
  const volta = await jogo.js<boolean>(
    "(()=>{const q=__t.qvInv(__h), gr=__t.invGrids.find(g=>g.inv===q); __t.quickMove(window.__p,gr); __t.renderInv(); return __h.inv.items.includes(window.__p);})()",
  );
  expect(volta, "voltou para a mochila").toBe(true);
  expect(await jogo.js("__t.resCount(__h,'stone')")).toBe(10); // mover não perde nada
  await jogo.js("__t.resSpend(__h,'stone',3)");
  expect(await jogo.js("__t.resCount(__h,'stone')")).toBe(7);
  // loja: mochila, baú e aljava maiores
  await jogo.js("__t.econ.test=false; __t.econ.gold=1000");
  await jogo.js("document.getElementById('btn-market').click()");
  await jogo.esperar(300);
  const antes = await jogo.js<number[]>("[__t.ensureInv(__h).cols*__t.ensureInv(__h).rows, __t.econ.gold]");
  await jogo.page.click("#mk-bags [data-bag]");
  const depois = await jogo.js<number[]>("[__t.ensureInv(__h).cols*__t.ensureInv(__h).rows, __t.econ.gold]");
  expect(depois[0]).toBeGreaterThan(antes[0]);
  expect(depois[1]).toBeLessThan(antes[1]);
  await jogo.foto("loja");
});

test("t6 — arrastar pedras da aljava para a mochila e juntar pilhas", async ({ jogo }) => {
  await jogo.js(
    "__t.closeTitle(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.resAdd(__h,'stone',6); __t.econ.quiver.n=10; __t.openBag(__h.id)",
  );
  await jogo.esperar(300);
  const total = () => jogo.js<number>("__t.resCount(__h,'stone')");
  const itens = await jogo.js<number[][]>("__t.qvInv(__h).items.filter(i=>i.def.key==='pedra').map(i=>[i.x,i.y])");
  if (itens.length) {
    const a = await centroDoItem(jogo, "#bag-qv", "__t.qvInv(__h).items.find(i=>i.def.key==='pedra')");
    const r = await jogo.caixa("#bag-pack");
    await arrastar(jogo, a, [r.x + 20, r.y + 20]);
  }
  expect(await total()).toBe(6);
  await jogo.foto("arrastou");
});

test("t9 — mochila cheia de itens de todas as qualidades", async ({ jogo }) => {
  await jogo.js(
    "(()=>{__t.closeTitle(); __t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); window.__h=h; __t.econ.quiver.n=10; for(const [k,t] of [['carne',0],['carne',1],['carne',2],['presa',0],['presa',2],['pele',1],['lingote',0],['escudo',0],['reliquia',2],['peixe',1],['gema',2],['erva',0],['erva',0]]) __t.tryAddItem(h,k,t); __t.resAdd(h,'stone',6); __t.resAdd(h,'feather',3); __t.tryAddQuiver(h,'erva',0); __t.openBag(h.id)})()",
  );
  await jogo.esperar(300);
  expect(await jogo.js<number>("__h.inv.items.length")).toBeGreaterThan(8);
  await jogo.foto("mochila");
});

test("t60/t61/t62 — arrastar na grade do campo: mover, fora, aljava, em cima de outro, fantasma", async ({ jogo }) => {
  await jogo.js(
    "__t.closeTitle(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); for(const k of ['carne','pele','presa','gema','pedra','pedra']) __t.tryAddItem(__h,k,0);",
  );
  await campoDireto(jogo, 3000);
  await jogo.js("__t.dungeon.flow='x'; __t.dungeon.monsters.length=0");
  await jogo.page.keyboard.press("KeyI");
  await jogo.esperar(500);
  expect(await jogo.js("__t.dungeon.invOpen")).toBeTruthy();
  const conta = () => jogo.js<number>("__h.inv.items.length+__t.qvInv(__h).items.length");
  const n0 = await conta();
  const g = await jogo.caixa("#inv-grid");
  const q = await jogo.caixa("#inv-qv");
  const celula = async (i: number) => {
    const bb = await jogo.page.locator("#inv-grid .inv-item").nth(i).locator(".inv-cell").first().boundingBox();
    return [bb!.x + 4, bb!.y + 4];
  };
  // t62: durante o arrasto aparece o fantasma
  const a = await celula(1);
  await jogo.page.mouse.move(a[0], a[1]);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(g.x + 150, g.y + 100, { steps: 10 });
  await jogo.esperar(200);
  expect(await jogo.js<number>("document.querySelectorAll('#inv-grid .ghost').length")).toBeGreaterThan(0);
  await jogo.foto("fantasma");
  await jogo.page.mouse.up();
  await jogo.esperar(300);
  // t60/t61: nenhum arrasto perde ou duplica item
  await arrastar(jogo, await celula(0), [g.x + g.width + 150, g.y + 50], 10);
  await arrastar(jogo, await celula(0), [q.x + q.width - 10, q.y + 10], 10);
  await arrastar(jogo, await celula(1), [g.x + 30, g.y + 30], 10);
  await arrastar(jogo, await celula(2), [g.x + g.width - 20, g.y + g.height - 20], 10);
  const n1 = await jogo.js<number>(
    "__h.inv.items.length+__t.qvInv(__h).items.length+((__t.dungeon.gInv&&__t.dungeon.gInv.items.length)||0)+__t.dungeon.loot.length",
  );
  expect(n1).toBeGreaterThanOrEqual(n0);
  expect(await conta()).toBeLessThanOrEqual(n0);
});

test("t64 — baú: tirar tudo para a mochila", async ({ jogo }) => {
  await jogo.js(
    "__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); for(const k of ['carne','pele','gema','presa']) __t.tryAddToInv(__t.econ.stash,k,0); __t.tryAddItem(__h,'erva',0)",
  );
  await jogo.js("document.getElementById('btn-chest').click()");
  await jogo.esperar(500);
  const antes = await jogo.js<number[]>("[__t.econ.stash.items.length, __h.inv.items.length]");
  await jogo.js("document.getElementById('chest-all-out').click()");
  const depois = await jogo.js<number[]>("[__t.econ.stash.items.length, __h.inv.items.length]");
  expect(depois[0]).toBeLessThan(antes[0]);
  expect(depois[0] + depois[1]).toBe(antes[0] + antes[1]);
  expect(await jogo.js("document.getElementById('chest-msg').textContent")).toBeTruthy();
});

test("t65 — pilhas de pedra e pena no campo, durabilidade, herói olha para o mouse", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  expect(await jogo.js<number>("__t.mapZoomLimit()")).toBeGreaterThan(0);
  await irAoCampo(jogo, 5000);
  expect(await jogo.js<number[]>("['pedra','pena','penaag'].map(k=>__t.ITEM_DEFS[k].stack)")).toEqual(
    expect.arrayContaining([expect.any(Number)]),
  );
  await jogo.js("const h=__t.dungeon.hero; __t.resAdd(h,'stone',5); __t.resAdd(h,'feather',3); __t.toggleInv(true)");
  await jogo.esperar(600);
  // cada pilha cabe onde está
  const ok = await jogo.js<boolean[]>(
    "(()=>{const h=__t.dungeon.hero; const out=[]; for (const inv of [__t.ensureInv(h), __t.qvInv(h)]) for (const it of inv.items) if(it.def.key==='pedra'||it.def.key==='pena'){ out.push(__t.canPlace(inv, it.shape, it.x, it.y, it)); } return out})()",
  );
  expect(ok.length).toBeGreaterThan(0);
  expect(ok.every(Boolean)).toBe(true);
  await jogo.foto("pilhas");
  await jogo.js("__t.toggleInv(false)");
  const dur = await jogo.js<number[][]>(
    "(()=>{const e=__t.ensureEquip(__t.dungeon.hero); return Object.keys(e).filter(k=>e[k]&&e[k].durMax).map(k=>[e[k].dur,e[k].durMax])})()",
  );
  for (const [d, m] of dur) expect(d).toBeLessThanOrEqual(m);
  await jogo.page.mouse.move(100, 400);
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(900);
  await jogo.page.keyboard.up("KeyD");
  expect(Number.isFinite(await jogo.js<number>("__t.GL3.hyaw"))).toBe(true);
  await jogo.foto("olhar");
});

test("t66 — pilhas de erva e folhama, curar com erva, dividir pilha, feixe de flechas, menu do item", async ({
  jogo,
}) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  await irAoCampo(jogo, 5000);
  // o kit de 2 folhamas das runas (runeGiveKit, a cada 30 min de jogo) já conta como entregue: senão cai no meio do teste
  await jogo.js(
    "const h=__t.dungeon.hero; h._folhKit=1; const inv=__t.ensureInv(h); inv.items=inv.items.filter(i=>i.def.slot); for(let i=0;i<5;i++) __t.tryAddToInv(inv,'erva'); for(let i=0;i<7;i++) __t.tryAddToInv(inv,'folhama'); for(let i=0;i<4;i++) __t.tryAddToInv(inv,'carne');",
  );
  const ervas = () =>
    jogo.js<number>("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='erva').reduce((a,i)=>a+(i.n||1),0)");
  const e0 = await ervas();
  expect(e0).toBe(5);
  await jogo.js("__t.dungeon.hp=__t.dungeon.hpMax*0.5; __t.dungeon.herbCd=0; __t.healHerb()");
  expect(await ervas()).toBe(4);
  expect(await jogo.js<number>("__t.dungeon.hp/__t.dungeon.hpMax")).toBeGreaterThan(0.5);
  await jogo.js("__t.toggleInv(true)");
  await jogo.esperar(600);
  await jogo.foto("pilhas");
  // Shift + arrastar divide a pilha de folhama
  const folhas = () =>
    jogo.js<number[]>("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='folhama').map(i=>i.n||1)");
  const f0 = await folhas();
  const p = await jogo.js<number[]>(
    "(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='folhama'&&(i.n||1)>1); const g=[...document.querySelectorAll('*')].find(e=>e._gr&&e._gr.inv===inv&&e.getBoundingClientRect().width>0); const r=g.getBoundingClientRect(); let rr=0,cc=0; it.shape.forEach((row,ri)=>row.forEach((v,ci)=>{ if(v&&!rr&&!cc){rr=ri;cc=ci} })); const k=r.width/g.offsetWidth; return [r.left+(it.x+cc+0.5)*14*k, r.top+(it.y+rr+0.5)*14*k]})()",
  );
  await jogo.page.keyboard.down("Shift");
  await jogo.page.mouse.move(p[0], p[1]);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(p[0] + 120, p[1] + 150, { steps: 6 });
  await jogo.page.mouse.up();
  await jogo.page.keyboard.up("Shift");
  await jogo.esperar(300);
  const f1 = await folhas();
  expect(f1.reduce((a, b) => a + b, 0)).toBe(f0.reduce((a, b) => a + b, 0));
  // flechas da aljava para um feixe na mochila, e de volta
  const q0 = await jogo.js<number>("__t.econ.quiver.n");
  await jogo.js(
    "(()=>{const h=__t.dungeon.hero, qv=__t.qvInv(h), pk=qv.items.find(i=>i.def.key==='flecha'); return pk && __t.arrowsToBag(pk, null, __t.ensureInv(h))})()",
  );
  const feixe = await jogo.js<number[]>(
    "__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='feixe_flechas').map(i=>i.n)",
  );
  if (feixe.length) {
    expect(await jogo.js<number>("__t.econ.quiver.n")).toBeLessThan(q0);
    await jogo.js(
      "(()=>{const h=__t.dungeon.hero, inv=__t.ensureInv(h), b=inv.items.find(i=>i.def.key==='feixe_flechas'); __t.bundleReload(b, inv)})()",
    );
    expect(await jogo.js<number>("__t.econ.quiver.n")).toBe(q0);
  }
  // menu do item
  await jogo.js("__t.tryAddToInv(__t.ensureInv(__t.dungeon.hero),'eq_machado'); __t.renderInv()");
  await jogo.esperar(300);
  const menu = await jogo.js<string[]>(
    "(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='eq_machado'); const g=[...document.querySelectorAll('*')].find(e=>e._gr&&e._gr.inv===inv); __t.invItemMenu(it, g._gr, 300, 300); return [...document.querySelectorAll('#inv-menu button')].map(b=>b.textContent)})()",
  );
  expect(menu.length).toBeGreaterThan(0);
  await jogo.foto("menu");
});

test("t102/t103/t105 — ícones pintados no painel, no preparo, no chão e na mochila; toasts", async ({ jogo }) => {
  expect(await jogo.js<number>("Object.keys(__t.ICOS).length")).toBeGreaterThan(50);
  await jogo.js("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await jogo.esperar(1000);
  await jogo.foto("painel", { x: 0, y: 60, width: 240, height: 380 });
  await jogo.js("__t.openSheet(__h.id)");
  await jogo.esperar(800);
  await jogo.foto("ficha");
  await jogo.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape'}))");
  await jogo.esperar(300);
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(1500);
  await jogo.foto("preparo");
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(3500);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; for(const [i,k] of ['carne','gema','eq_lanca','penaag'].entries()){ d.loot.push({key:k,x:d.px+60+i*20,y:d.py-40+i*20,ground:false,tier:0,t:0,ttl:0});} const inv=__t.ensureInv(d.hero); for(const k of ['eq_lanca','eq_espada','eq_machado','eq_clava','eq_elmo','galho','pena','penaag','pele','peixe','gema','ferro','folhama','presa']){ const it=__t.mkItem(k); __t.placeIn(inv,it);} ['💥','🩸','💫','Bloqueado','Parry!'].forEach((t,i)=>__t.spawnDungeonToast(t, d.px-120+i*36, d.py-30, '#fff'));})()",
  );
  await jogo.esperar(1500);
  await jogo.foto("chao");
  await jogo.js("__t.toggleInv()");
  await jogo.esperar(1000);
  expect(await jogo.js<number>("document.querySelectorAll('#inv-grid .inv-item').length")).toBeGreaterThan(5);
  await jogo.foto("mochila", { x: 320, y: 40, width: 720, height: 300 });
});

test("t109/tinvsp/tlay — preparo com itens de qualidade, lanças longas e arrasto", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "(()=>{const e=__t.ensureEquip(__h); e.maoD.q=3; if(e.cabeca) e.cabeca.q=0; if(e.peito) e.peito.q=2;})()",
  );
  await jogo.js(
    "const inv=__t.ensureInv(__h); for (const k of ['eq_lanca','eq_lanca','eq_machado','eq_clava','pele','carne','gema','erva']) { const it=__t.mkItem(k); __t.eqDurInit(it); __t.placeIn(inv,it); } const q=__t.mkItem('eq_lanca'); q.shape=[[1],[1],[1],[1],[1],[1]]; __t.placeIn(inv,q); __t.fixLongShapes();",
  );
  // depois de fixLongShapes nenhuma lança fica com a forma antiga de 6 células
  expect(
    await jogo.js<number>(
      "__t.ensureInv(__h).items.filter(i=>i.def.key==='eq_lanca'&&i.shape.length===6&&i.shape[0].length===1).length",
    ),
  ).toBe(0);
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(1000);
  await jogo.foto("preparo");
  const bb = await jogo.page.locator("#prep-modal .inv-item .inv-cell").first().boundingBox();
  await jogo.page.mouse.move(bb!.x + 10, bb!.y + 10);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(bb!.x + 130, bb!.y + 60, { steps: 5 });
  await jogo.esperar(300);
  expect(await jogo.js("!!__t.invDrag")).toBe(true);
  await jogo.foto("arrasto");
  await jogo.page.mouse.up();
});

test("tinv3/tqv/tqv2 — aljava → mochila, aljava → chão, duplo clique equipa, arma 2, trocar de arma", async ({
  jogo,
}) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(
    "const inv=__t.ensureInv(__h); for (const k of ['eq_machado','pele','carne','gema']) { const it=__t.mkItem(k); __t.eqDurInit(it); __t.placeIn(inv,it); }",
  );
  // tqv2: no preparo, aljava → mochila
  await jogo.js(
    "const q=__t.qvInv(__h); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g0=g; __t.openPrep(__h.id)",
  );
  await jogo.esperar(800);
  await jogo.js(
    "(()=>{const g=__t.invGrids.find(g=>g.inv.qv); g.el.dataset.t='qv'; const b=__t.invGrids.find(g=>!g.inv.qv && g.inv!==__t.econ.stash); b.el.dataset.t='bag';})()",
  );
  const a0 = await jogo.js<number[]>(
    "(()=>{const r=document.querySelector('[data-t=qv]').getBoundingClientRect(); return [r.left+(__g0.x+0.5)*14, r.top+(__g0.y+0.5)*14]})()",
  );
  const b0 = await jogo.js<number[]>(
    "(()=>{const r=document.querySelector('[data-t=bag]').getBoundingClientRect(); return [r.right-25, r.bottom-25]})()",
  );
  await arrastar(jogo, a0, b0);
  expect(await jogo.js("__t.ensureInv(__h).items.includes(__g0)")).toBe(true);
  await jogo.js("__t.closePrep && __t.closePrep()");
  await irAoCampo(jogo, 3500);
  await jogo.js(
    "const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.loot.push({key:'reliquia',x:d.px+5,y:d.py,t:0,ttl:0,tier:0}); const q=__t.qvInv(d.hero); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g=g; __t.toggleInv(true)",
  );
  await jogo.esperar(700);
  await jogo.foto("inventario");
  // aljava → mochila
  await arrastar(jogo, await centroDoItem(jogo, "#inv-qv", "__g"), await cantoDe(jogo, "inv-grid", 50, 50));
  expect(await jogo.js("__t.ensureInv(__t.dungeon.hero).items.includes(__g)")).toBe(true);
  expect(await jogo.js("__t.qvInv(__t.dungeon.hero).items.includes(__g)")).toBe(false);
  // aljava → chão
  await jogo.js(
    "const q=__t.qvInv(__t.dungeon.hero); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g2=g; __t.renderInv()",
  );
  await jogo.esperar(300);
  await arrastar(jogo, await centroDoItem(jogo, "#inv-qv", "__g2"), await cantoDe(jogo, "inv-ground", 50, 50));
  expect(await jogo.js("__t.dungeon.gInv.items.includes(__g2)")).toBe(true);
  // duplo clique no machado equipa
  const m = await centroDoItem(
    jogo,
    "#inv-grid",
    "__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='eq_machado')",
  );
  await jogo.page.mouse.dblclick(m[0], m[1]);
  await jogo.esperar(300);
  expect(
    await jogo.js("__t.ensureEquip(__t.dungeon.hero).maoD && __t.ensureEquip(__t.dungeon.hero).maoD.def.key"),
  ).toBe("eq_machado");
  // a espada que saiu vai para o espaço da arma 2
  if (await jogo.js("!!__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='eq_espada')")) {
    const e = await centroDoItem(
      jogo,
      "#inv-grid",
      "__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='eq_espada')",
    );
    const s2 = await jogo.js<number[]>(
      "(()=>{const r=document.querySelector('#inv-doll [data-eqs=maoD2]').getBoundingClientRect(); return [r.left+15,r.top+15]})()",
    );
    await arrastar(jogo, e, s2);
    expect(await jogo.js("(__t.ensureEquip(__t.dungeon.hero).maoD2||{def:{}}).def.key")).toBe("eq_espada");
  }
  await jogo.foto("equipado");
  await jogo.js("__t.toggleInv(false)");
  await jogo.esperar(200);
  // Q alterna entre os dois conjuntos
  const sets = new Set<string>();
  for (let i = 0; i < 4; i++)
    sets.add(
      await jogo.js<string>(
        "(()=>{__t.dungeon.cd=0; __t.switchWeapon(); return String(__t.setNo(__t.dungeon.hero))})()",
      ),
    );
  expect(sets.size).toBe(2);
  // pena da aljava → mochila
  await jogo.js(
    "__t.toggleInv(true); const q=__t.qvInv(__t.dungeon.hero); const g=__t.mkItem('pena'); __t.placeIn(q,g); window.__g3=g; __t.renderInv()",
  );
  await jogo.esperar(300);
  if (await jogo.js("__t.qvInv(__t.dungeon.hero).items.includes(__g3)")) {
    await arrastar(jogo, await centroDoItem(jogo, "#inv-qv", "__g3"), await cantoDe(jogo, "inv-grid", 20, 20));
    expect(await jogo.js("__t.ensureInv(__t.dungeon.hero).items.includes(__g3)")).toBe(true);
  }
});

test("equipamento: duplo clique veste e clique no espaço devolve à mochila", async ({ jogo }) => {
  test.skip(jogo.referencia, "a referência não inclui os ajustes atuais de equipamento");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await irAoCampo(jogo);
  await jogo.js(`(()=>{
    const h=__t.dungeon.hero, e=__t.ensureEquip(h), inv=__t.ensureInv(h);
    h.visual={corpo:'heroina',cabeca:'propria'};
    e.peito=null;
    window.__armaduraTeste=__t.mkItem('eq_armadura');
    __t.placeIn(inv,__armaduraTeste);
    __t.toggleInv(true);
    __t.renderInv();
  })()`);
  await jogo.foto("armadura_antes");
  const pos = await centroDoItem(jogo, "#inv-grid", "__armaduraTeste");
  await jogo.page.mouse.dblclick(pos[0], pos[1]);
  await jogo.esperar(500);
  expect(
    await jogo.js(
      "__t.ensureEquip(__t.dungeon.hero).peito===__armaduraTeste && !__t.ensureInv(__t.dungeon.hero).items.includes(__armaduraTeste)",
    ),
    "a armadura sai da mochila e entra no encaixe",
  ).toBe(true);
  await jogo.foto("armadura_equipada");

  const slot = await jogo.caixa("#inv-doll [data-eqs=peito]");
  await jogo.page.mouse.click(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await jogo.esperar(500);
  expect(
    await jogo.js(
      "!__t.ensureEquip(__t.dungeon.hero).peito && __t.ensureInv(__t.dungeon.hero).items.includes(__armaduraTeste)",
    ),
    "clicar no encaixe tira a armadura e a devolve à mochila",
  ).toBe(true);
  await jogo.foto("armadura_desequipada");
  expect(jogo.erros, "sem erros no console").toEqual([]);
});

test("ttier — baú com qualidades e arrasto de item de qualidade alta", async ({ jogo }) => {
  await jogo.js(
    "__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); for(const k of ['pele','carne','presa','pele','gema','erva','galho','ferro']) for(let t=0;t<3;t++) __t.tryAddToInv(__t.econ.stash,k,t);",
  );
  await jogo.js("document.getElementById('btn-chest').click()");
  await jogo.esperar(700);
  expect(await jogo.js<number>("document.querySelectorAll('#chest-grid .inv-item.tier2').length")).toBeGreaterThan(0);
  const g = await jogo.caixa("#chest-grid");
  await jogo.foto("bau", { x: g.x - 5, y: g.y - 5, width: g.width + 10, height: g.height + 10 });
  const it = await jogo.caixa("#chest-grid .inv-item.tier2 .inv-cell");
  await jogo.page.mouse.move(it.x + 5, it.y + 5);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(it.x + 60, it.y + 90, { steps: 8 });
  await jogo.esperar(200);
  await jogo.foto("arrasto");
  await jogo.page.mouse.up();
});

test("tpick — pegar pedras do chão empilha e avisa", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  await irAoCampo(jogo, 5000);
  const s0 = await jogo.js<number>("__t.resCount(__t.dungeon.hero,'stone')");
  for (let k = 0; k < 4; k++) {
    await jogo.js(
      "const d=__t.dungeon; d.loot.push({key:'pedra',x:d.px+5,y:d.py,ground:true,t:0,ttl:0}); d.toasts.length=0; __t.collectLoot(d.loot[d.loot.length-1])",
    );
    await jogo.esperar(200);
    expect(await jogo.js<number>("__t.dungeon.toasts.length")).toBeGreaterThan(0);
  }
  expect(await jogo.js<number>("__t.resCount(__t.dungeon.hero,'stone')")).toBe(s0 + 4);
  for (const k of ["pedra", "pena", "erva", "galho", "folhama"])
    expect((await jogo.js<number[][]>(`__t.tierShape('${k}',0)`)).length).toBeGreaterThan(0);
});

test("tbug2 — botão direito larga o item no chão; arrastar para a grade do chão", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 3500);
  await jogo.js(
    "(()=>{__t.dungeon.hero._folhKit=1; const inv=__t.ensureInv(__t.dungeon.hero); for(const k of ['eq_lanca','eq_machado']){const it=__t.mkItem(k); __t.placeIn(inv,it);} __t.toggleInv(); })()",
  );
  await jogo.esperar(800);
  const n0 = await jogo.js<number>("__t.ensureInv(__t.dungeon.hero).items.length");
  const bb = await jogo.caixa("#inv-grid .inv-item .inv-cell");
  await jogo.page.mouse.click(bb.x + 5, bb.y + 5, { button: "right" });
  await jogo.esperar(500);
  await jogo.foto("botao-direito");
  const n1 = await jogo.js<number>("__t.ensureInv(__t.dungeon.hero).items.length");
  expect(n1).toBeLessThanOrEqual(n0);
  if (await jogo.page.locator("#inv-ground").count()) {
    const c = await jogo.caixa("#inv-grid .inv-item .inv-cell");
    const gg = await jogo.caixa("#inv-ground");
    await arrastar(jogo, [c.x + 5, c.y + 5], [gg.x + 60, gg.y + 30], 8);
    expect(await jogo.js<number>("__t.ensureInv(__t.dungeon.hero).items.length")).toBeLessThan(n0);
  }
});

test("t5907c — carne de javalino no chão vira item com nome e ícone", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 9000);
  const an = await jogo.js<unknown[]>(
    "(()=>{const d=__t.dungeon; const m={x:d.px+30,y:d.py,kind:'javalino',alive:false}; d.monsters.push(m); __t.spawnLoot(m.x,m.y,true,false); return d.loot.filter(l=>l.key==='carne').map(l=>l.an)})()",
  );
  if (an.length) {
    const r = await jogo.js<string | null>(
      "(()=>{const d=__t.dungeon; const l=d.loot.find(l=>l.key==='carne'); d.hero.inv.items.length=0; __t.collectLoot(l); const it=__t.ensureInv(d.hero).items.find(i=>i.def.key==='carne'); return it&&(__t.itName(it)+'|'+__t.icoKeyOf(it))})()",
    );
    expect(r).toBeTruthy();
  }
});

test("tana2 — analisar um item: sem mesa avisa, com mesa abre a análise", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  await irAoCampo(jogo, 5000);
  await jogo.js("__t.tryAddToInv(__t.ensureInv(__t.dungeon.hero),'eq_machado'); __t.toggleInv(true)");
  await jogo.esperar(400);
  await jogo.js(
    "(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='eq_machado'); __t.itemAnalyze(it)})()",
  );
  await jogo.esperar(400);
  expect(await jogo.js("!!document.querySelector('#ana-modal.open')")).toBe(false);
  await jogo.foto("sem-mesa");
  await jogo.js("__t.econ.mesa=true; __t.toggleInv(true)");
  await jogo.esperar(300);
  await jogo.js(
    "(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='eq_machado'); __t.itemAnalyze(it)})()",
  );
  await jogo.esperar(400);
  expect(await jogo.js("!!document.querySelector('#ana-modal.open')")).toBe(true);
  await jogo.foto("com-mesa");
});
