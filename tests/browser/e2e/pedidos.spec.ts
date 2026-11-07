/* v7.7 — campanha C2, passo 3 (campanha/pedidos.ts): os pedidos de carne do Caçador. Depois de alimentar o lobo, o
   pedido vem (❗); falar anuncia e o objetivo mostra o pedido; carne do bicho errado não serve; a certa entrega,
   dá vínculo aos lobos dele e marca o próximo pedido para dali a 2 dias. */
import { test, expect, entrarComHeroi, esperarAte, passarDialogo } from "./comum.ts";

const missao = "__t.campanha().etapa";
const lobos = "__t.campanha().paralela"; // v8.0: os pedidos são da linha paralela dos lobos
const acoes = "document.getElementById('acoes').textContent";
const PERTO = "(()=>{const d=__t.dungeon; d.px=__t.CPS.hunter.x+20; d.py=__t.CPS.hunter.y;})()";
/** Põe `n` carnes cruas de `an` na mochila (qualidade A). */
const carne = (an: string, n: number) =>
  `(()=>{const inv=__t.ensureInv(__t.dungeon.hero); for(let k=0;k<${n};k++){ __t.tryAddToInv(inv,'carne',0); inv.items[inv.items.length-1].an='${an}'; }})()`;

test("pedidos: o Caçador pede, o objetivo mostra, a carne certa entrega e dá vínculo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.hunterNap=false; e.lobos=[{sexo:'F',pelagem:1,vinculo:0,dono:'cacador',desde:__t.world.tick,pontos:0}]; __t.campanhaIr('a3_vinculo'); __t.campanha().feitas.a3_alimentar=1; e.pedidoProx=0; __t.enterCamp(__h)",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.hunter", 6000)).toBe(true);
  // com o lobo ainda no vínculo 0 o primeiro pedido não vem (ele fugiria com a porteira aberta)
  await jogo.esperar(1200);
  expect(await jogo.js("!!__t.econ.pedido"), "sem pedido no vínculo 0").toBe(false);
  // no vínculo 2 (8 pontos) o primeiro pedido chega e o Caçador chama
  await jogo.js("__t.econ.lobos[0].pontos = 8");
  expect(await esperarAte(jogo, "!!__t.econ.pedido", 2000), "pedido criado").toBe(true);
  expect(await jogo.js("[__t.econ.pedido.an, __t.econ.pedido.n, __t.econ.pedido.anunciado]")).toEqual([
    "coelho",
    2,
    false,
  ]);
  await jogo.js(PERTO);
  expect(await esperarAte(jogo, `${acoes}.includes('quer falar')`, 2000), "❗").toBe(true);
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, "!!__t.ISC.dlg", 2000)).toBe(true);
  await passarDialogo(jogo, 20);
  expect(await jogo.js(lobos)).toBe("a3_pedido");
  expect(
    await esperarAte(jogo, "document.getElementById('missao').textContent.includes('2 carnes de coelho')", 3000),
    "o objetivo mostra o pedido",
  ).toBe(true);
  await jogo.foto("pedido");
  // carne de cervo não serve
  await jogo.js(carne("cervo", 2));
  await jogo.esperar(400);
  expect(await jogo.js(acoes)).not.toContain("Entregar");
  // a de coelho serve: entrega, dá vínculo e marca o próximo
  await jogo.js(carne("coelho", 2));
  expect(await esperarAte(jogo, `${acoes}.includes('Entregar a carne')`, 2000), "pode entregar").toBe(true);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(300);
  await passarDialogo(jogo, 10);
  const r = await jogo.js<[string, number, boolean, number, number]>(
    `[${lobos}, __t.econ.lobos[0].pontos, !!__t.econ.pedido, __t.econ.pedidoProx - Math.floor(__t.world.tick/1440), __t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='carne'&&i.an==='coelho').reduce((s,i)=>s+(i.n||1),0)]`,
  );
  expect(r).toEqual(["a3_cuidar", 8 + 3, false, 2, 0]);
});

test("costura: depois do cercado o Caçador chama e ensina a armadura de couro", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.hunterNap=false; __t.campanhaIr('a3_costura'); __t.enterCamp(__h)",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.hunter", 6000)).toBe(true);
  expect(await jogo.js("__t.forgeKnows('eq_armadura')"), "ainda não sabe").toBe(false);
  await jogo.js(PERTO);
  expect(await esperarAte(jogo, `${acoes}.includes('quer falar')`, 2000), "❗").toBe(true);
  await jogo.page.keyboard.press("KeyE");
  expect(
    await esperarAte(jogo, "document.getElementById('isc-dlg').textContent.includes('roupa')", 3000),
    "a fala da costura",
  ).toBe(true);
  await passarDialogo(jogo, 20);
  expect(await jogo.js(`[${missao}, __t.forgeKnows('eq_armadura')]`)).toEqual(["a3_armadura", true]);
  expect(
    await esperarAte(jogo, "document.getElementById('missao').textContent.includes('armadura de couro')", 3000),
  ).toBe(true);
});
