/* v7.7 — mochila como item equipável e desequipável (items/mochilas.ts): save antigo ganha a mochila equipada sem perder
   nada; guardar nos alforjes leva o conteúdo junto e a heroína fica sem mochila; vestir de volta; mochila não entra em
   mochila; o conteúdo sobrevive a salvar e carregar sem duplicar. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

const MONTARIA =
  "if(!__t.econ.mount) __t.econ.mount={name:'Tatu',xp:0,hp:100,sta:100,with:null,since:0,brushDay:0,feedDay:0,bag:null,coat:'selvagem',dirt:0}; d.mount={x:d.px,y:d.py+20,ang:0,mounted:false,st:'idle',ph:0,mv:0,flee:0,hp:100};";

test("mochila: equipada por padrão, guarda nos alforjes com o conteúdo, veste de novo", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  // save antigo: sem o encaixe → ganha a mochila equipada e o conteúdo fica
  const mig = await jogo.js<{ tem: boolean; n: number; n0: number }>(
    "(()=>{const h=__t.dungeon.hero; const inv=__t.ensureInv(h); __t.giveItem(h,'galho',0); __t.giveItem(h,'erva',0); const n0=inv.items.length; delete h.equip.mochila; const e=__t.ensureEquip(h); return {tem: !!e.mochila && e.mochila.def.key==='eq_mochila', n: __t.ensureInv(h).items.length, n0};})()",
  );
  expect(mig.tem, "ganhou a mochila equipada").toBe(true);
  expect(mig.n, "nada se perdeu").toBe(mig.n0);
  // mochila não entra em mochila
  expect(
    await jogo.js("__t.placeIn(__t.ensureInv(__t.dungeon.hero), __t.mkItem('eq_mochila'))"),
    "mochila em mochila",
  ).toBe(false);
  // com o tamanduá perto, clicar no encaixe guarda nos alforjes, com o conteúdo
  await jogo.js(`(()=>{const d=__t.dungeon; d.monsters.length=0; ${MONTARIA}})()`);
  await jogo.js("__t.toggleInv(true)");
  await jogo.esperar(600);
  await jogo.page.click("#inv-doll [data-eqs=mochila]");
  await jogo.esperar(300);
  const g = await jogo.js<{ semMochila: boolean; cols: number; naCarga: boolean; dentro: number; aviso: boolean }>(
    "(()=>{const h=__t.dungeon.hero, b=__t.mountBag(), m=b.items.find(i=>i.def.key==='eq_mochila'); return {semMochila: !__t.ensureEquip(h).mochila, cols: __t.ensureInv(h).cols, naCarga: !!m, dentro: m&&m.conteudo?m.conteudo.items.length:-1, aviso: !!document.querySelector('#inv-grid.sem-mochila')};})()",
  );
  expect(g.semMochila, "tirou do corpo").toBe(true);
  expect(g.cols, "sem mochila, sem grade").toBe(0);
  expect(g.naCarga, "foi para os alforjes").toBe(true);
  expect(g.dentro, "levou o conteúdo").toBe(mig.n0);
  expect(g.aviso, "o aviso de sem mochila").toBe(true);
  await jogo.foto("sem_mochila");
  // vestir de novo a partir dos alforjes
  const v = await jogo.js<{ tem: boolean; n: number; naCarga: boolean }>(
    "(()=>{const h=__t.dungeon.hero, b=__t.mountBag(), m=b.items.find(i=>i.def.key==='eq_mochila'); __t.equipItem(h, m, b); return {tem: __t.ensureEquip(h).mochila===m, n: __t.ensureInv(h).items.length, naCarga: b.items.includes(m)};})()",
  );
  expect(v).toEqual({ tem: true, n: mig.n0, naCarga: false });
});

test("mochila guardada: abre numa janela pelo menu do item e o conteúdo dá para mexer", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  // uma segunda mochila, com uma erva dentro, nos alforjes
  await jogo.js(
    `(()=>{const d=__t.dungeon; d.monsters.length=0; ${MONTARIA} const m=__t.mkItem('eq_mochila'); m.conteudo={cols:24,rows:15,items:[],mochila:true}; __t.placeIn(m.conteudo, __t.mkItem('erva')); __t.placeIn(__t.mountBag(), m); __t.toggleInv(true);})()`,
  );
  await jogo.esperar(600);
  const uid = await jogo.js<number>(
    "(()=>{const m=__t.mountBag().items.find(i=>i.def.key==='eq_mochila'); __t.abrirMochilaGuardada(m); return m.uid;})()",
  );
  await jogo.esperar(300);
  const jan = jogo.page.locator(`#iw-m${uid}`);
  await expect(jan, "a janela da mochila guardada").toBeVisible();
  await expect(jan.locator(".gridbox .inv-item"), "a erva aparece").toHaveCount(1);
  await jogo.foto("mochila_guardada");
  // fechar tira a janela
  await jan.locator(".iw-x").click();
  await expect(jan).toHaveCount(0);
});

test("mochila extra: a loja do preparo e a carpintaria põem uma vazia no baú", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777);
  const r = await jogo.js<{ loja: number; ouro: number; carp: number; vazia: boolean }>(
    "(()=>{__t.closeTitle(); const conta=()=>__t.econ.stash.items.filter(i=>i.def.key==='eq_mochila').length; __t.econ.gold=100; const c0=conta(); __t.openPrep(__h.id); const b=document.querySelector('[data-mochila]'); b.click(); const loja=conta()-c0, ouro=__t.econ.gold; const rc=__t.CARP_RECIPES.find(r=>r.id==='mochila'); rc.done(); const m=__t.econ.stash.items.filter(i=>i.def.key==='eq_mochila').pop(); return {loja, ouro, carp: conta()-c0, vazia: !!m.conteudo && m.conteudo.items.length===0};})()",
  );
  expect(r.loja, "comprou uma").toBe(1);
  expect(r.ouro, "pagou 40").toBe(60);
  expect(r.carp, "a carpintaria fez outra").toBe(2);
  expect(r.vazia, "vem vazia").toBe(true);
});

test("aljava: guardada leva as flechas e o conteúdo, o arco fica sem; vestida, voltam", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    `(()=>{const d=__t.dungeon; d.monsters.length=0; ${MONTARIA} __t.econ.quiver.n=20; __t.toggleInv(true);})()`,
  );
  await jogo.esperar(600);
  const antes = await jogo.js<{ tem: boolean; pedras: number }>(
    "(()=>{const h=__t.dungeon.hero; __t.tryAddQuiver(h,'pedra'); return {tem: !!__t.ensureEquip(h).aljava, pedras: __t.qvInv(h).items.filter(i=>i.def.key==='pedra').length};})()",
  );
  expect(antes.tem, "aljava equipada por padrão").toBe(true);
  await jogo.page.click("#inv-doll [data-eqs=aljava]");
  await jogo.esperar(300);
  const g = await jogo.js<{
    sem: boolean;
    cols: number;
    n: number;
    flechas: number;
    dentro: number;
    pacotes: number;
    aviso: boolean;
  }>(
    "(()=>{const h=__t.dungeon.hero, a=__t.mountBag().items.find(i=>i.def.key==='eq_aljava'); return {sem: !__t.ensureEquip(h).aljava, cols: __t.qvInv(h).cols, n: __t.econ.quiver.n, flechas: a?a.flechas:-1, dentro: a&&a.conteudo?a.conteudo.items.filter(i=>i.def.key==='pedra').length:-1, pacotes: a&&a.conteudo?a.conteudo.items.filter(i=>i.def.key==='flecha').length:-1, aviso: !!document.querySelector('.sem-aljava')};})()",
  );
  expect(g).toEqual({ sem: true, cols: 0, n: 0, flechas: 20, dentro: antes.pedras, pacotes: 0, aviso: true });
  await jogo.foto("sem_aljava");
  const v = await jogo.js<{ n: number; pacotes: number; pedras: number }>(
    "(()=>{const h=__t.dungeon.hero, b=__t.mountBag(), a=b.items.find(i=>i.def.key==='eq_aljava'); __t.equipItem(h, a, b); const q=__t.qvInv(h); return {n: __t.econ.quiver.n, pacotes: q.items.filter(i=>i.def.key==='flecha').reduce((s,i)=>s+i.n,0), pedras: q.items.filter(i=>i.def.key==='pedra').length};})()",
  );
  expect(v).toEqual({ n: 20, pacotes: 20, pedras: antes.pedras });
});

test("aljava extra: a loja do preparo e a carpintaria; aljava não entra na mochila", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777);
  const r = await jogo.js<{ loja: number; ouro: number; carp: number; naMochila: boolean }>(
    "(()=>{__t.closeTitle(); const conta=()=>__t.econ.stash.items.filter(i=>i.def.key==='eq_aljava').length; __t.econ.gold=100; const c0=conta(); __t.openPrep(__h.id); document.querySelector('[data-mochila=eq_aljava]').click(); const loja=conta()-c0, ouro=__t.econ.gold; __t.CARP_RECIPES.find(r=>r.id==='aljava').done(); return {loja, ouro, carp: conta()-c0, naMochila: __t.placeIn(__t.ensureInv(__h), __t.mkItem('eq_aljava'))};})()",
  );
  expect(r).toEqual({ loja: 1, ouro: 75, carp: 2, naMochila: false });
});

test("mochila guardada no baú sobrevive a salvar e carregar, sem duplicar", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777);
  const r = await jogo.js<{ antes: number; noBau: number; equipada: boolean; dentroBau: number; grade: number }>(
    "(()=>{__t.closeTitle(); const h=__h; __t.giveItem(h,'galho',0); __t.giveItem(h,'erva',0); const antes=__t.ensureInv(h).items.length; const e=__t.ensureEquip(h); __t.unequip(h,'mochila',__t.ensureInv(h)); const blob=__t.saveBlob(); __t.applySave(JSON.parse(blob)); const h2=__t.world.heroes[0]; const m=__t.econ.stash.items.filter(i=>i.def.key==='eq_mochila'); return {antes, noBau: m.length, equipada: !!__t.ensureEquip(h2).mochila, dentroBau: m[0]&&m[0].conteudo?m[0].conteudo.items.length:-1, grade: __t.ensureInv(h2).cols};})()",
  );
  expect(r.noBau, "uma mochila no baú").toBe(1);
  expect(r.equipada, "a heroína continua sem mochila").toBe(false);
  expect(r.dentroBau, "o conteúdo foi junto").toBe(r.antes);
  expect(r.grade, "sem grade").toBe(0);
});
