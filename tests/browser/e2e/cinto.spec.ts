/* v7.7 — cinto com presilhas (items/cinto.ts): todo herói tem um cinto comum (1 presilha, só faca); A+ 2 e SS 3
   presilhas, bolsa só fora da 1ª, no máximo 2 facas, a bolsa tem grade própria e não leva recipientes; arrastar uma
   faca para a presilha na preparação; o cinto com faca e bolsa sobrevive a salvar e carregar; finalizar com E só com
   faca no cinto, que gasta (a Simples quebra); a carpintaria faz cabo, couro, faca simples, cinto e bolsa gastando
   os materiais; a Forja não lista o que não se forja; o linho se compra na Vila Musgo. */
import { test, expect, entrarComHeroi, esperarAte, irAoCampo } from "./comum.ts";

test("cinto: comum por padrão, regras das presilhas e bolsa", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  const r = await jogo.js<Record<string, unknown>>(
    `(()=>{const h=__h, inv=__t.ensureInv(h), c0=__t.cintoDe(h);
      const comum=[c0.def.key, c0.tier, __t.presilhas(c0).length];
      const e=__t.ensureEquip(h); e.cinto=__t.mkItem('eq_cinto',2); const p=__t.presilhas(e.cinto).length;
      const f1=__t.mkItem('eq_faca'), f2=__t.mkItem('eq_faca_simples'), f3=__t.mkItem('eq_faca_velha'), b=__t.novaBolsa();
      for (const it of [f1,f2,f3,b]) __t.placeIn(inv,it);
      const m=[__t.prenderNoCinto(h,b,0,inv), __t.prenderNoCinto(h,f1,0,inv), __t.prenderNoCinto(h,f2,1,inv), __t.prenderNoCinto(h,f3,2,inv), __t.prenderNoCinto(h,b,2,inv)];
      return {comum, p, m, naMochila:[f1,f2,b].some(it=>inv.items.includes(it)), velhaFicou: inv.items.includes(f3),
        mochilaNaBolsa: __t.placeIn(b.conteudo, __t.mkItem('eq_mochila')), cintoNaBolsa: __t.placeIn(b.conteudo, __t.mkItem('eq_cinto')),
        ervaNaBolsa: __t.tryAddToInv(b.conteudo,'erva'), faca: __t.facaNoCinto(h).def.key};})()`,
  );
  expect(r.comum, "cinto comum A, 1 presilha").toEqual(["eq_cinto", 0, 1]);
  expect(r.p, "SS: 3 presilhas").toBe(3);
  const m = r.m as string[];
  expect(m[0], "bolsa não vai na 1ª").toContain("primeira presilha");
  expect(m[1]).toContain("Prendeu");
  expect(m[2]).toContain("Prendeu");
  expect(m[3], "3ª faca").toContain("No máximo 2");
  expect(m[4]).toContain("Prendeu");
  expect(r.naMochila, "saíram da mochila").toBe(false);
  expect(r.velhaFicou, "a recusada fica na mochila").toBe(true);
  expect([r.mochilaNaBolsa, r.cintoNaBolsa, !!r.ervaNaBolsa]).toEqual([false, false, true]);
  expect(r.faca).toBe("eq_faca");
});

test("cinto: arrastar a faca para a presilha na preparação e clicar para soltar; salvar e carregar", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "__t.closeTitle(); __t.ensureInv(__h).items.length=0; __t.giveItem(__h,'eq_faca_simples',0); __t.openPrep(__h.id)",
  );
  await jogo.esperar(600);
  const a = await jogo.js<number[]>(
    "(()=>{const it=__t.ensureInv(__h).items.find(i=>i.def.key==='eq_faca_simples'); const g=document.getElementById('prep-pack'), b=g.getBoundingClientRect(), k=b.width/g.offsetWidth; const r=it.shape.findIndex(l=>l.some(Boolean)), c=it.shape[r].findIndex(Boolean); return [b.left+(it.x+c+.5)*14*k, b.top+(it.y+r+.5)*14*k]})()",
  );
  const p = await jogo.js<number[]>(
    "(()=>{const r=document.querySelector('#prep-cinto [data-presilha=\"0\"]').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]})()",
  );
  await jogo.page.mouse.move(a[0], a[1]);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(a[0] + 15, a[1] + 5);
  await jogo.page.mouse.move(p[0], p[1], { steps: 8 });
  await jogo.page.mouse.up();
  await jogo.esperar(300);
  expect(await jogo.js("(__t.presilhas(__t.cintoDe(__h))[0]||{def:{}}).def.key"), "foi para o cinto").toBe(
    "eq_faca_simples",
  );
  expect(await jogo.js("__t.ensureInv(__h).items.length"), "saiu da mochila").toBe(0);
  await jogo.foto("faca_no_cinto");
  // salvar e carregar com uma bolsa cheia no cinto (num cinto A+)
  const s = await jogo.js<{ chave: string; bolsa: number; ervas: number }>(
    `(()=>{const e=__t.ensureEquip(__h), f=__t.presilhas(e.cinto)[0]; e.cinto=__t.mkItem('eq_cinto',1); __t.presilhas(e.cinto)[0]=f;
      const b=__t.novaBolsa(); __t.tryAddToInv(b.conteudo,'erva'); __t.tryAddToInv(b.conteudo,'erva'); __t.presilhas(e.cinto)[1]=b;
      __t.applySave(JSON.parse(__t.saveBlob())); const h2=__t.world.heroes[0], p=__t.presilhas(__t.cintoDe(h2));
      return {chave: p[0]&&p[0].def.key, bolsa: p.length, ervas: p[1]&&p[1].conteudo ? p[1].conteudo.items.reduce((a,i)=>a+(i.n||1),0) : -1};})()`,
  );
  expect(s).toEqual({ chave: "eq_faca_simples", bolsa: 2, ervas: 2 });
  // clicar na presilha devolve a faca para a mochila
  await jogo.js("__t.closePrep(); window.__h=__t.world.heroes[0]; __t.openPrep(__h.id)");
  await jogo.esperar(500);
  expect(await jogo.js("__t.invGrids.filter(g=>g.inv.bolsa).length"), "a grade da bolsa no preparo").toBe(1);
  await jogo.page.click('#prep-cinto [data-presilha="0"]');
  await jogo.esperar(300);
  expect(
    await jogo.js(
      "[!__t.presilhas(__t.cintoDe(__h))[0], __t.ensureInv(__h).items.some(i=>i.def.key==='eq_faca_simples')]",
    ),
  ).toEqual([true, true]);
});

test("cinto: finalizar com E só com faca no cinto; a faca simples gasta e quebra", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  await irAoCampo(jogo, 4500);
  const CAIDO =
    "(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); m.x=d.px+24; m.y=d.py; m.ko=5; window.__m=m; return !!__t.finishTarget()})()";
  // sem faca no cinto (faca na mochila não conta): não finaliza
  await jogo.js(
    "(()=>{const h=__t.dungeon.hero; __t.ensureEquip(h).maoD=null; __t.tryAddToInv(__t.ensureInv(h),'eq_faca'); __t.presilhas(__t.cintoDe(h))[0]=null})()",
  );
  expect(await jogo.js(CAIDO), "o bicho caído está ao alcance").toBe(true);
  await jogo.js("__t.finishStart(__m)");
  expect(await jogo.js("!!__t.dungeon.finish"), "sem faca no cinto não começa").toBe(false);
  // com a faca simples quase sem fio no cinto: finaliza e ela quebra
  await jogo.js(
    "(()=>{const h=__t.dungeon.hero, f=__t.mkItem('eq_faca_simples'); __t.eqDurInit(f); f.dur=1; __t.presilhas(__t.cintoDe(h))[0]=f})()",
  );
  expect(await jogo.js(CAIDO)).toBe(true);
  await jogo.js("__t.finishStart(__m)");
  expect(await esperarAte(jogo, "!__m.alive && !__t.dungeon.finish", 6000), "finalizado").toBe(true);
  expect(await jogo.js("__t.presilhas(__t.cintoDe(__t.dungeon.hero))[0]"), "a faca simples quebrou").toBe(null);
});

test("cinto: na mochila do campo, silhueta, faixa do cinto e a grade da bolsa; clicar na presilha solta", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone=true; __t.econ.campTut=3;");
  await irAoCampo(jogo, 4500);
  await jogo.js(
    "(()=>{const h=__t.dungeon.hero, b=__t.novaBolsa(); __t.tryAddToInv(b.conteudo,'erva'); __t.ensureEquip(h).cinto=__t.mkItem('eq_cinto',1); const p=__t.presilhas(__t.cintoDe(h)); p[0]=__t.mkItem('eq_faca'); p[1]=b; __t.toggleInv(true)})()",
  );
  await jogo.esperar(600);
  const r = await jogo.js<Record<string, unknown>>(
    "(()=>{const v=(s)=>{const e=document.querySelector(s); return !!e && e.getBoundingClientRect().width>0}; return {silhueta: v('#inv-doll .dsil'), retrato: !!document.querySelector('#inv-doll .dport'), cinto: v('#inv-doll .dcinto [data-eqs=cinto]'), presilhas: document.querySelectorAll('#inv-doll [data-presilha]').length, bolsa: __t.invGrids.some(g=>g.inv.bolsa && g.el.closest('#inv-bolsas'))}})()",
  );
  expect(r).toEqual({ silhueta: true, retrato: false, cinto: true, presilhas: 2, bolsa: true });
  await jogo.foto("mochila_campo");
  await jogo.page.click('#inv-doll [data-presilha="0"]');
  await jogo.esperar(300);
  expect(
    await jogo.js(
      "[!__t.presilhas(__t.cintoDe(__t.dungeon.hero))[0], __t.ensureInv(__t.dungeon.hero).items.some(i=>i.def.key==='eq_faca')]",
    ),
    "a faca voltou para a mochila",
  ).toEqual([true, true]);
});

test("cinto: carpintaria gasta os materiais; a Forja não lista o que não se forja; linho na Vila Musgo", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "__t.closeTitle(); __t.econ.test=false; const s=__t.econ.stash; s.items.length=0; for(const [k,n] of [['galho',2],['pele',2],['ferro',1],['pedra',1]]) for(let i=0;i<n;i++) __t.tryAddToInv(s,k); __t.carpOpen(__h)",
  );
  await jogo.esperar(500);
  const conta = (k: string) => `__t.econ.stash.items.filter(i=>i.def.key==='${k}').reduce((a,i)=>a+(i.n||1),0)`;
  const clicar = async (id: string) => {
    await jogo.page.click(`#carp-modal [data-cp="${id}"]`);
    await jogo.esperar(150);
  };
  await clicar("cabo");
  expect(await jogo.js(`[${conta("cabo")}, ${conta("galho")}]`), "1 galho → 1 cabo").toEqual([1, 1]);
  await clicar("couro");
  await jogo.js("__t.tryAddToInv(__t.econ.stash,'galho'); __t.carpOpen(__h)"); // redesenha: o botão volta a valer
  await jogo.esperar(500); // a carpintaria ignora cliques nos primeiros 400 ms depois de aberta
  await clicar("couro");
  expect(await jogo.js(`[${conta("couro")}, ${conta("pele")}]`), "2 peles → 2 couros").toEqual([2, 0]);
  await clicar("cinto");
  expect(
    await jogo.js(`[${conta("eq_cinto")}, ${conta("couro")}, ${conta("ferro")}]`),
    "cinto: 2 couros + ferro",
  ).toEqual([1, 0, 0]);
  // faca simples sem pedras suficientes (precisa de 2): o botão fica desligado
  expect(await jogo.js("document.querySelector('#carp-modal [data-cp=\"faca_simples\"]').disabled")).toBe(true);
  await jogo.foto("carpintaria");
  // Forja: a Faca Velha, a Simples e o cinto ficam fora (forja: false); a Faca de Caça leva cabo
  const f = await jogo.js<{ lista: string[]; caca: Record<string, number> }>(
    "({lista: ['eq_faca_velha','eq_faca_simples','eq_cinto','eq_faca'].filter(k=>__t.EQ_BASE[k] && __t.EQ_BASE[k].forja!==false), caca: __t.EQ_BASE.eq_faca.mat})",
  );
  expect(f.lista).toEqual(["eq_faca"]);
  expect(f.caca).toEqual({ ferro: 1, cabo: 1 });
  expect(await jogo.js("__t.MUSGO.loja.some(([k])=>k==='linho')"), "linho na loja").toBe(true);
});
