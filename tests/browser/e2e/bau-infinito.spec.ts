/* v7.7 — baú infinito (items/bau_infinito.ts): o baú do acampamento guarda tudo (a grade de dentro cresce sozinha) e
   aparece como lista de quadradinhos; arrastar um quadradinho põe o item na mochila, soltar qualquer item na lista
   guarda. A compra de baú maior saiu do mercado. */
import { test, expect } from "./comum.ts";

test("baú infinito: guarda tudo, lista de quadradinhos, arrasto nos dois sentidos", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem o baú de tamanho fixo");
  const r = await jogo.js<{ n: number; ok: number }>(`(()=>{
    __t.closeTitle(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __h._folhKit=1;
    const st=__t.econ.stash; st.items.length=0; let ok=0, n=0;
    for(const k of ['eq_lanca','eq_machado','eq_clava','eq_espada','eq_arco','eq_escudo','eq_armadura','eq_elmo','eq_calca','eq_botas','pele','carne','peixe','presa','gema','erva','ferro','galho','lingote','reliquia','tabua','corda','couro'])
      for(let t=0;t<3;t++){ n++; if(__t.tryAddToInv(st,k,t)) ok++; }
    __t.ensureInv(__h).items.length=0;
    document.getElementById('btn-chest').click();
    return {n, ok};
  })()`);
  expect(r.ok, "nada ficou de fora (o baú 24×18 antigo não levava tudo isso)").toBe(r.n);
  await jogo.esperar(500);
  expect(await jogo.js<number>("document.querySelectorAll('#chest-grid .bau-peca').length")).toBe(r.n);
  await jogo.foto("1_lista");

  // baú → mochila
  const a = await jogo.caixa("#chest-grid .bau-peca .inv-cell");
  const m = await jogo.caixa("#pack-grid");
  await jogo.page.mouse.move(a.x + 10, a.y + 10);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(m.x + 40, m.y + 40, { steps: 8 });
  await jogo.page.mouse.move(m.x + 30, m.y + 30, { steps: 3 });
  await jogo.page.mouse.up();
  await jogo.esperar(200);
  expect(await jogo.js<number>("__t.ensureInv(__h).items.length"), "foi para a mochila").toBe(1);
  expect(await jogo.js<number>("__t.econ.stash.items.length")).toBe(r.n - 1);

  // mochila → qualquer ponto da lista
  const b = await jogo.caixa("#pack-grid .inv-item .inv-cell");
  const c = await jogo.caixa("#chest-grid");
  await jogo.page.mouse.move(b.x + 5, b.y + 5);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(c.x + c.width / 2, c.y + c.height - 20, { steps: 8 });
  expect(await jogo.js("document.getElementById('chest-grid').classList.contains('alvo')"), "a lista acende").toBe(
    true,
  );
  await jogo.page.mouse.up();
  await jogo.esperar(200);
  expect(await jogo.js<number>("__t.ensureInv(__h).items.length")).toBe(0);
  expect(await jogo.js<number>("__t.econ.stash.items.length")).toBe(r.n);

  // a dica do item funciona no quadradinho
  const p = await jogo.caixa("#chest-grid .bau-peca .inv-cell");
  await jogo.page.mouse.move(p.x + 8, p.y + 8);
  await jogo.page.mouse.move(p.x + 10, p.y + 10);
  await jogo.esperar(300);
  expect(await jogo.js<string>("document.getElementById('item-tip').textContent")).toBeTruthy();

  // o mercado não vende mais baú maior
  await jogo.js("document.getElementById('chest-close').click(); document.getElementById('btn-market').click()");
  await jogo.esperar(300);
  expect(await jogo.js("!!document.querySelector('#mk-bags [data-chest]')")).toBe(false);
  expect(await jogo.js<string>("document.getElementById('mk-bags').textContent")).toContain("sem limite");
});
