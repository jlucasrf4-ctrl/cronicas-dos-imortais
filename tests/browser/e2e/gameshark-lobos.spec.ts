/* v7.7 — GameShark para testar o arco dos lobos (ui/gameshark.ts + gsLobos em campanha/cercado.ts + gsPedido em
   campanha/pedidos.ts): MISSAOLOBO, LOBONOVO, LOBOMAIS, LOBOMAX, LOBOVOLTA, FILHOTE, PEDIDO, CARNE, PELES. */
import { test, expect, entrarComHeroi } from "./comum.ts";

test("gameshark dos lobos: cada código faz o que diz", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle()");
  const gs = (c: string) => jogo.js(`__t.gsRun('${c}')`);
  const nivel = "__t.econ.lobos.map(L=>(L.filhote?'f':'')+L.sexo+':'+L.vinculo).join(',')";

  await gs("MISSAOLOBO");
  expect(await jogo.js("[__t.campanha().etapa, __t.econ.campTut, !!__t.econ.tent]")).toEqual(["a3_lobo", 3, true]);

  await gs("LOBONOVO");
  await gs("LOBONOVO"); // o segundo é do sexo oposto
  expect(await jogo.js("__t.econ.lobos.map(L=>L.sexo).sort().join('')")).toBe("FM");
  await gs("LOBOMAIS");
  expect(await jogo.js(nivel)).toBe("M:1,F:1");
  await gs("LOBOMAX");
  expect(await jogo.js(nivel)).toBe("M:4,F:4");

  // fugido volta na hora
  await jogo.js("(()=>{const e=__t.econ, L=e.lobos.pop(); e.lobosFugidos=[{L, volta:1e12}];})()");
  await gs("LOBOVOLTA");
  expect(await jogo.js("[__t.econ.lobos.length, __t.econ.lobosFugidos.length]")).toEqual([2, 0]);

  await gs("FILHOTE");
  expect(await jogo.js("__t.econ.lobos.some(L=>L.filhote)"), "nasceu").toBe(true);

  await gs("PEDIDO");
  expect(await jogo.js("!!__t.econ.pedido && !__t.econ.pedido.anunciado"), "pedido novo").toBe(true);

  const conta = (k: string) =>
    jogo.js<number>(`__t.ensureInv(__h).items.filter(i=>i.def.key==='${k}').reduce((s,i)=>s+(i.n||1),0)`);
  const carne0 = await conta("carne"),
    assada0 = await conta("carne_assada"),
    pele0 = await conta("pele");
  await gs("CARNE");
  await gs("PELES");
  expect([
    (await conta("carne")) - carne0,
    (await conta("carne_assada")) - assada0,
    (await conta("pele")) - pele0,
  ]).toEqual([5, 1, 3]);
  expect(
    // a crua empilha (por bicho): soma as pilhas
    await jogo.js(
      "__t.ensureInv(__h).items.filter(i=>i.def.key==='carne'&&i.an==='coelho').reduce((s,i)=>s+(i.n||1),0)",
    ),
    "carne de coelho",
  ).toBeGreaterThanOrEqual(3);
});
