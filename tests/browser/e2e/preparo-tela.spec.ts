/* v7.7 — tela de preparação repaginada (ui/preparo_tela.ts): a silhueta no lugar do retrato 3D, as compras na coluna
   da mochila, o Baú no lugar da Forja (abre o baú com o herói e, ao fechar, volta ao preparo), e o encaixe da mochila
   responde ao clique uma vez só. */
import { test, expect, entrarComHeroi } from "./comum.ts";

test("preparo: silhueta, compras na coluna da mochila, sem Forja, com Baú", async ({ jogo }) => {
  test.skip(jogo.referencia, "tela da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.openPrep(__h.id)");
  await jogo.esperar(600);
  const t = await jogo.js<Record<string, boolean>>(
    "(()=>{const v=(id)=>{const e=document.getElementById(id); return !!e && e.getBoundingClientRect().width>0}; const img=document.getElementById('prep-silhueta'); return {silhueta: v('prep-silhueta') && img.complete && img.naturalWidth>0, retrato: v('prep-portrait3d') || v('prep-portrait'), forja: !!document.getElementById('prep-forge'), bau: v('prep-bau'), compras: !!document.querySelector('.prep-bags #prep-shop'), mochila: !!document.querySelector('#prep-lado #prep-mochila [data-slot=mochila]'), arma2: v('prep-alt')}})()",
  );
  expect(t).toEqual({
    silhueta: true,
    retrato: false,
    forja: false,
    bau: true,
    compras: true,
    mochila: true,
    arma2: true,
  });
  await jogo.foto("preparo");
});

test("preparo: o Baú abre o baú com o herói e, ao fechar, volta ao preparo", async ({ jogo }) => {
  test.skip(jogo.referencia, "tela da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.openPrep(__h.id)");
  await jogo.esperar(600);
  await jogo.page.click("#prep-bau");
  await jogo.esperar(400);
  const aberto = await jogo.js<boolean[]>(
    "[document.getElementById('chest-modal').classList.contains('open'), document.getElementById('prep-modal').classList.contains('open'), document.getElementById('chest-hero').value===__h.id]",
  );
  expect(aberto, "baú aberto, preparo fechado, herói escolhido").toEqual([true, false, true]);
  await jogo.page.click("#chest-close");
  await jogo.esperar(400);
  expect(await jogo.js("document.getElementById('prep-modal').classList.contains('open')"), "voltou ao preparo").toBe(
    true,
  );
  // o baú aberto pelo mapa não abre o preparo ao fechar
  await jogo.js("__t.closePrep(); document.getElementById('btn-chest').click()");
  await jogo.esperar(300);
  await jogo.page.click("#chest-close");
  await jogo.esperar(300);
  expect(await jogo.js("document.getElementById('prep-modal').classList.contains('open')")).toBe(false);
});

test("preparo: encaixe vazio mostra o contorno dourado do que vai nele", async ({ jogo }) => {
  test.skip(jogo.referencia, "tela da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.openPrep(__h.id)");
  await jogo.esperar(600);
  // equipado: sem contorno; vazio (elmo, arma 2): com contorno carregado
  await jogo.js("__t.ensureEquip(__h).cabeca=null; __t.renderPrep()");
  await jogo.esperar(300);
  const r = await jogo.js<Record<string, boolean>>(
    "(()=>{const ok=(sel)=>{const i=document.querySelector(sel+' img.p77-vazio'); return !!i && i.complete && i.naturalWidth>0}; return {elmo: ok('[data-slot=cabeca]'), peito: ok('[data-slot=peito]'), arma2: ok('#prep-alt [data-alt=maoD]')}})()",
  );
  expect(r).toEqual({ elmo: true, peito: false, arma2: true });
  await jogo.foto("contornos");
});

test("preparo: clicar no encaixe da mochila guarda no baú uma vez só", async ({ jogo }) => {
  test.skip(jogo.referencia, "tela da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.openPrep(__h.id)");
  await jogo.esperar(600);
  const n0 = await jogo.js<number>("__t.econ.stash.items.filter(i=>i.def.key==='eq_mochila').length");
  await jogo.page.click("#prep-mochila [data-slot=mochila]");
  await jogo.esperar(300);
  const r = await jogo.js<{ sem: boolean; noBau: number }>(
    "({sem: !__t.ensureEquip(__h).mochila, noBau: __t.econ.stash.items.filter(i=>i.def.key==='eq_mochila').length})",
  );
  expect(r).toEqual({ sem: true, noBau: n0 + 1 });
});
