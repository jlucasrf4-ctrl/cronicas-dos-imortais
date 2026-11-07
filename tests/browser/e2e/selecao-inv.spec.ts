/* v7.7 — seleção de vários itens na mochila (items/selecao_inv.ts): arrastar um retângulo a partir de uma casa vazia
   seleciona os itens que ele toca; a barra manda tudo o que pode ao acampamento de uma vez; com seleção, o toque num
   item marca/desmarca; Esc limpa sem fechar a mochila. */
import { test, expect, entrarComHeroi, campoDireto, campoLimpo, type Jogo } from "./comum.ts";

/** No campo, mochila vazia com 3 carnes, 2 galhos e uma pedra, aberta. */
async function mochilaCheia(jogo: Jogo) {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await campoLimpo(jogo);
  await jogo.js(
    `(()=>{const h=__h, inv=__t.ensureInv(h); inv.items.length=0; h._folhKit=1; // sem o kit de folhamas no meio do teste
      for(let i=0;i<3;i++) __t.tryAddItem(h,'carne'); for(let i=0;i<2;i++) __t.tryAddItem(h,'galho'); __t.tryAddItem(h,'pedra');
      h.loot=h.loot||{}; h.loot.meat=0; h.loot.wood=0; __t.toggleInv(true);})()`,
  );
  await jogo.esperar(300);
}
/** Centro da casa (c, r) da mochila, na tela. */
const casa = (jogo: Jogo, c: number, r: number) =>
  jogo.js<{ x: number; y: number }>(
    `(()=>{const b=document.getElementById('inv-grid').getBoundingClientRect(), k=b.width/__t.ensureInv(__h).cols; return {x:b.left+(${c}+.5)*k, y:b.top+(${r}+.5)*k};})()`,
  );

test("mochila: retângulo seleciona, a barra envia tudo ao acampamento", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a seleção de vários itens");
  await mochilaCheia(jogo);
  // do canto de baixo à direita (vazio) até o de cima à esquerda: pega tudo
  const dim = await jogo.js<number[]>("[__t.ensureInv(__h).cols, __t.ensureInv(__h).rows]");
  const a = await casa(jogo, dim[0] - 1, dim[1] - 1),
    b = await casa(jogo, 0, 0);
  await jogo.page.mouse.move(a.x, a.y);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await jogo.page.mouse.move(b.x, b.y, { steps: 4 });
  await jogo.foto("1_arrastando");
  await jogo.page.mouse.up();
  await jogo.esperar(200);
  // carne empilha, galho não e as pedras se arrumam em pacotes: conta as peças agora, e as que vão ao acampamento
  const n0 = await jogo.js<number>("__t.ensureInv(__h).items.length");
  const vai = await jogo.js<number>("__t.ensureInv(__h).items.filter(i=>/^(carne|galho)$/.test(i.def.key)).length");
  expect(n0 - vai, "a pedra fica").toBeGreaterThan(0);
  expect(await jogo.js<number>("document.querySelectorAll('#inv-grid .inv-item.inv-sel').length")).toBe(n0);
  const txt = await jogo.js<string>("document.getElementById('inv-selbar').textContent");
  expect(txt).toContain(n0 + " selecionados");
  expect(txt).toContain("(" + vai + " de " + n0 + ")"); // a pedra não vai
  await jogo.foto("2_selecionados");

  // um toque num item com seleção: desmarca (não abre o menu)
  const pedra = await jogo.js<{ x: number; y: number }>(
    "(()=>{const it=__t.ensureInv(__h).items.find(i=>i.def.key==='pedra'); const r=it.shape.findIndex(l=>l.some(Boolean)), c=it.shape[r].findIndex(Boolean); const b=document.getElementById('inv-grid').getBoundingClientRect(), k=b.width/__t.ensureInv(__h).cols; return {x:b.left+(it.x+c+.5)*k, y:b.top+(it.y+r+.5)*k};})()",
  );
  await jogo.page.mouse.click(pedra.x, pedra.y);
  await jogo.esperar(150);
  expect(await jogo.js("!!document.getElementById('inv-menu')"), "sem menu").toBe(false);
  expect(await jogo.js<string>("document.getElementById('inv-selbar').textContent")).toContain(
    n0 - 1 + " selecionados",
  );

  await jogo.page.click("#inv-selbar [data-a=enviar]");
  await jogo.esperar(200);
  const fim = await jogo.js<{ n: number; meat: number; wood: number; bar: boolean }>(
    "({n:__t.ensureInv(__h).items.length, meat:__h.loot.meat, wood:__h.loot.wood, bar:document.getElementById('inv-selbar').classList.contains('on')})",
  );
  expect(
    await jogo.js<number>("__t.ensureInv(__h).items.filter(i=>/^(carne|galho)$/.test(i.def.key)).length"),
    "não sobrou carne nem galho",
  ).toBe(0);
  expect(fim.n, "o resto ficou na mochila").toBeGreaterThan(0);
  expect(fim.meat).toBeGreaterThanOrEqual(3);
  expect(fim.wood).toBe(4);
  // o que não vai continua marcado (a barra fica, sem o botão de enviar); sem nada marcado a barra some
  expect(await jogo.js("!!document.querySelector('#inv-selbar.on [data-a=enviar]')"), "sem enviar").toBe(false);
  await jogo.foto("3_enviado");
});

/** Seleciona os 2 quartzos pelo menu ("Selecionar todos") e devolve o centro do 1º na tela. */
async function selecionarQuartzos(jogo: Jogo) {
  const p = await jogo.js<{ x: number; y: number }>(
    "(()=>{const it=__t.ensureInv(__h).items.find(i=>i.def.key==='quartzo'); const b=document.getElementById('inv-grid').getBoundingClientRect(), k=b.width/__t.ensureInv(__h).cols; return {x:b.left+(it.x+1)*k, y:b.top+(it.y+1)*k};})()",
  );
  await jogo.page.mouse.click(p.x, p.y);
  await jogo.esperar(150);
  await jogo.page.click("#inv-menu [data-a=selTodos]");
  await jogo.esperar(150);
  expect(await jogo.js<number>("document.querySelectorAll('#inv-grid .inv-item.inv-sel').length")).toBe(2);
  return p;
}
async function arrastar(jogo: Jogo, a: { x: number; y: number }, b: { x: number; y: number }) {
  await jogo.page.mouse.move(a.x, a.y);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await jogo.page.mouse.move(b.x, b.y, { steps: 5 });
  await jogo.esperar(100);
}

test("mochila: arrastar um item selecionado leva a seleção inteira (aljava e chão)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a seleção de vários itens");
  await mochilaCheia(jogo);
  await jogo.js("(()=>{for(let i=0;i<2;i++) __t.tryAddItem(__h,'quartzo'); __t.renderInv();})()");
  await jogo.esperar(150);
  const quartzos = "__t.ensureInv(__h).items.filter(i=>i.def.key==='quartzo').length";
  // para a aljava (outra grade): os dois vão, o fantasma mostra ×2
  let p = await selecionarQuartzos(jogo);
  const qv = await jogo.caixa("#inv-qv");
  await arrastar(jogo, p, { x: qv.x + qv.width - 20, y: qv.y + qv.height - 20 });
  expect(await jogo.js<string>("document.querySelector('.inv-grupo')?.textContent || ''"), "fantasma ×2").toBe("×2");
  await jogo.foto("4_grupo_arrastando");
  await jogo.page.mouse.up();
  await jogo.esperar(200);
  expect(await jogo.js<number>(quartzos), "saíram da mochila").toBe(0);
  expect(await jogo.js<number>("__t.qvInv(__h).items.filter(i=>i.def.key==='quartzo').length"), "na aljava").toBe(2);
  await jogo.foto("5_grupo_na_aljava");

  // de volta para a mochila (pelo código) e agora para o chão: os dois vão para o mundo
  await jogo.js(
    "(()=>{const q=__t.qvInv(__h); for(const i of q.items.filter(i=>i.def.key==='quartzo')){ q.items.splice(q.items.indexOf(i),1); __t.placeIn(__t.ensureInv(__h),i);} __t.renderInv();})()",
  );
  await jogo.esperar(150);
  await jogo.page.keyboard.press("Escape"); // a seleção continua depois de mover: limpa antes de marcar de novo
  await jogo.esperar(150);
  p = await selecionarQuartzos(jogo);
  const chao = await jogo.caixa("#inv-ground");
  await arrastar(jogo, p, { x: chao.x + 40, y: chao.y + 30 });
  await jogo.page.mouse.up();
  await jogo.esperar(200);
  expect(await jogo.js<number>(quartzos), "largados no chão").toBe(0);
  expect(await jogo.js<number>("__t.dungeon.loot.filter(l=>l.key==='quartzo').length")).toBeGreaterThanOrEqual(2);
});

test("mochila: 'Selecionar todos' no menu e Esc limpa sem fechar", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a seleção de vários itens");
  await mochilaCheia(jogo);
  const p = await jogo.js<{ x: number; y: number }>(
    "(()=>{const it=__t.ensureInv(__h).items.find(i=>i.def.key==='galho'); const b=document.getElementById('inv-grid').getBoundingClientRect(), k=b.width/__t.ensureInv(__h).cols; return {x:b.left+(it.x+.5)*k, y:b.top+(it.y+.5)*k};})()",
  );
  await jogo.page.mouse.click(p.x, p.y);
  await jogo.esperar(150);
  await jogo.page.click("#inv-menu [data-a=selTodos]");
  await jogo.esperar(150);
  expect(await jogo.js<number>("document.querySelectorAll('#inv-grid .inv-item.inv-sel').length")).toBe(2);
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(150);
  expect(await jogo.js<number>("document.querySelectorAll('#inv-grid .inv-item.inv-sel').length")).toBe(0);
  expect(await jogo.js("__t.dungeon.invOpen"), "a mochila continua aberta").toBe(true);
});
