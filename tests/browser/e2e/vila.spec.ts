/* v8.0 — a vila em janela (map/vila.ts, data/vila.ts; ROADMAP Etapa 2): abas Empório, Taverna, Quadro, Doca e
   Igreja na janela da Vila Musgo. Campanha: taverna (boato) → doca (8 galhos + 20 de ouro; pronto em 2 dias) →
   igreja (o Imortal lê a afinidade) → a7_cavaleiros. Quadro paga ouro por entregas; dormir na taverna custa ouro. */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

const missao = "__t.campanha().etapa";
const clicar = (jogo: { page: import("@playwright/test").Page }, sel: string) => jogo.page.click("#musgo-modal " + sel);
/** Passa a conversa aberta na janela da vila até fechar. */
async function passarFala(jogo: { page: import("@playwright/test").Page }) {
  for (let i = 0; i < 8; i++) {
    const b = jogo.page.locator("#musgo-modal [data-vl='fala']");
    if (!(await b.count())) return;
    await b.click();
  }
}

test("vila: taverna → doca → igreja levam a campanha do Ato 5 ao 7; quadro e dormir pagam/cobram", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a vila em janela");
  test.setTimeout(120_000);
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "(()=>{__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.gold=100; __t.campanhaIr('a5_taverna'); __t.campanha().flags.boteFurado=true; const c=__t.musgoCity(), h=__h; h.x=c.x; h.y=c.y; h.state='idle'; __t.empOpen(h);})()",
  );
  await jogo.page.waitForSelector("#musgo-modal.open");
  await jogo.foto("vila_emporio");

  // taverna: o boato
  await clicar(jogo, "[data-a='taverna']");
  await clicar(jogo, "[data-vl='boato']");
  await jogo.foto("vila_taverna_fala");
  await passarFala(jogo);
  expect(await jogo.js(missao), "ouviu o boato").toBe("a6_doca");

  // dormir na taverna custa ouro
  const g0 = await jogo.js<number>("__t.econ.gold");
  await clicar(jogo, "[data-vl='dormir']");
  expect(await jogo.js<number>("__t.econ.gold"), "dormir custa 6").toBe(g0 - 6);
  await esperarAte(jogo, "__t.world.fastForwardTarget<=0", 15000, 300);

  // doca: sem galhos não dá; com 8 galhos e ouro, o conserto começa
  await clicar(jogo, "[data-a='doca']");
  expect(await jogo.page.locator("#musgo-modal [data-vl='conserto']").isDisabled(), "sem galhos").toBe(true);
  await jogo.js(
    "(()=>{const inv=__t.ensureInv(__h); for(let i=0;i<8;i++) __t.tryAddToInv(inv,'galho',0); __t.empOpen(__h);})()",
  );
  await clicar(jogo, "[data-vl='conserto']");
  await passarFala(jogo);
  expect(await jogo.js(missao), "bote entregue").toBe("a6_espera");
  expect(await jogo.js("!!__t.campanha().flags.boteConsertoAte")).toBe(true);
  // dois dias depois o bote está pronto
  await jogo.js("__t.world.tick = __t.campanha().flags.boteConsertoAte + 1");
  expect(await esperarAte(jogo, "!!__t.campanha().flags.boteConsertado", 8000), "bote consertado").toBe(true);

  // igreja: o Imortal lê a afinidade
  await jogo.js("__t.empOpen(__h)");
  await clicar(jogo, "[data-a='igreja']");
  await clicar(jogo, "[data-vl='imortal']");
  await clicar(jogo, "[data-vl='fala']"); // página 2: a afinidade
  const txt = await jogo.page.locator("#musgo-modal .vila-fala").innerText();
  expect(txt.includes("{afinidade}"), "a afinidade aparece no lugar da marca").toBe(false);
  await jogo.foto("vila_igreja");
  await passarFala(jogo);
  expect(await jogo.js(missao), "falou com o Imortal").toBe("a7_cavaleiros");

  // quadro: entregar um pedido paga ouro
  const quadro = await jogo.js<{ item: string; n: number; ouro: number }>("(()=>{__t.empOpen(__h); return null;})()");
  expect(quadro).toBeNull();
  await clicar(jogo, "[data-a='quadro']");
  const k = await jogo.page.locator("#musgo-modal [data-vl='entregar']").first().getAttribute("data-k");
  await jogo.js(
    `(()=>{const P=__t.QUADRO[${k}], inv=__t.ensureInv(__h); for(let i=0;i<P.n;i++) __t.tryAddToInv(inv,P.item,0); __t.empOpen(__h);})()`,
  );
  await clicar(jogo, "[data-a='quadro']");
  const g1 = await jogo.js<number>("__t.econ.gold");
  await clicar(jogo, `[data-vl='entregar'][data-k='${k}']`);
  expect(await jogo.js<number>("__t.econ.gold"), "o quadro pagou").toBeGreaterThan(g1);
  await jogo.foto("vila_quadro");
});
