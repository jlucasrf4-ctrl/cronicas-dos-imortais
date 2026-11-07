/* v7.7 — dano médio da arma (items/dano_medio.ts): o número num círculo na cor da qualidade, na mochila e na dica;
   a dica da arma é curta (tipos de dano, afixos, durabilidade, peso) e a ficha completa fica na mesa de análise. */
import { test, expect, entrarComHeroi, campoDireto, campoLimpo } from "./comum.ts";

test("arma: círculo com o dano médio, dica curta e ficha na mesa", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o dano médio");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await campoLimpo(jogo);
  await jogo.js(
    `(()=>{const h=__h, inv=__t.ensureInv(h); inv.items.length=0;
      for(const [k,q] of [['eq_faca',3],['eq_espada',1],['eq_clava',2],['eq_arco',0]]){ __t.tryAddItem(h,k); inv.items[inv.items.length-1].q=q; }
      __t.toggleInv(true); __t.renderInv();})()`,
  );
  await jogo.esperar(300);
  // um círculo por arma, com o número (vírgula decimal)
  const selos = await jogo.js<string[]>("[...document.querySelectorAll('#inv-grid .inv-dano')].map(e=>e.textContent)");
  expect(selos.length).toBe(4);
  for (const s of selos) expect(s, "DPS inteiro").toMatch(/^\d+$/);
  // faca Excelente: 2,6 × 0,95 × 1,14 × 0,55 × (1 + 1,15) ÷ (2 × 0,32) ≈ 5
  expect(selos).toContain("5");
  await jogo.foto("1_mochila");

  // passa o mouse na faca: dica curta
  const p = await jogo.js<{ x: number; y: number }>(
    "(()=>{const it=__t.ensureInv(__h).items.find(i=>i.def.key==='eq_faca'); const r=it.shape.findIndex(l=>l.some(Boolean)), c=it.shape[r].findIndex(Boolean); const b=document.getElementById('inv-grid').getBoundingClientRect(), k=b.width/__t.ensureInv(__h).cols; return {x:b.left+(it.x+c+.5)*k, y:b.top+(it.y+r+.5)*k};})()",
  );
  await jogo.page.mouse.move(p.x, p.y);
  await jogo.esperar(400);
  const dica = await jogo.js<string>("document.getElementById('item-tip').innerText");
  expect(dica).toContain("DPS");
  expect(dica.split("Excelente").length - 1, "a qualidade aparece uma vez só").toBe(1);
  expect(dica).toContain("45%");
  expect(dica).toContain("kg");
  expect(dica, "sem o multiplicador").not.toContain("×1,08");
  expect(dica, "sem o preço").not.toContain("💰");
  expect(dica, "sem a descrição").not.toContain("Faca forjada");
  await jogo.foto("2_dica");

  // a mesa de análise mostra a ficha completa
  await jogo.page.mouse.move(5, 5);
  await jogo.js("__t.toggleInv(false); __t.anaOpen(__h)");
  await jogo.esperar(200);
  // as 4 da mochila + as equipadas e as do baú
  expect(await jogo.js<number>("document.querySelectorAll('#ana-modal .an-ficha').length")).toBeGreaterThanOrEqual(4);
  await jogo.js("document.querySelector('#ana-modal .an-ficha').open=true");
  const ficha = await jogo.js<string>("document.querySelector('#ana-modal .an-ficha-c').innerText");
  expect(ficha).toContain("Dano médio");
  expect(ficha).toContain("Durabilidade");
  await jogo.foto("3_mesa");
});
