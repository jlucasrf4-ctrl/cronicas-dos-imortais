/* v8.0 — a aba de missões (campanha/diario.ts: J ou clique no quadro, ✕/J/Esc fecham, pausa o campo) e a lição do
   rolamento na cena inicial (ISC_ESQUIVA em data/intro.ts: câmera lenta na 1ª investida, rolar passa por ela, o
   golpe seguinte acerta e o Caçador chega antes do segundo). */
import { test, expect, entrarComHeroi, esperarAte, comecarIntro, campoDireto } from "./comum.ts";

const aberta = "document.getElementById('diario')?.classList.contains('on')";

test("aba de missões: J abre com a missão, as dicas e as concluídas; ✕, J e Esc fecham", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 3; __t.campanhaIr('a3_lobo');");
  await jogo.js("__t.campanha().feitas.a1_abertura = 1; __t.campanha().feitas.a2_livre = 1;");

  await jogo.page.keyboard.press("KeyJ");
  expect(await esperarAte(jogo, aberta, 1000), "J abre").toBe(true);
  const txt = await jogo.js<string>("document.getElementById('diario').textContent");
  expect(txt).toContain("Um lobo vivo");
  expect(txt, "dicas da missão").toContain("aperte G");
  expect(txt, "concluídas").toContain("Sobreviver");
  expect(txt).toContain("Tempo livre");
  await jogo.foto("aba-mapa");
  await jogo.js("document.getElementById('diario-x').click()");
  expect(await jogo.js(aberta), "✕ fecha").toBe(false);

  // clicar no quadro do objetivo abre; Esc fecha
  expect(await esperarAte(jogo, "document.getElementById('missao').classList.contains('on')", 3000)).toBe(true);
  await jogo.js("document.getElementById('missao').click()");
  expect(await jogo.js(aberta), "clique no quadro abre").toBe(true);
  await jogo.page.keyboard.press("Escape");
  expect(await jogo.js(aberta), "Esc fecha").toBe(false);

  // no campo pausa enquanto aberta e devolve ao fechar
  await campoDireto(jogo);
  await jogo.page.keyboard.press("KeyJ");
  expect(await jogo.js("[" + aberta + ", __t.dungeon.modalOpen]")).toEqual([true, true]);
  await jogo.foto("aba-campo");
  await jogo.page.keyboard.press("KeyJ");
  expect(await jogo.js("[" + aberta + ", __t.dungeon.modalOpen]")).toEqual([false, false]);
});

test("cena inicial: câmera lenta na 1ª investida, rolar escapa, o golpe seguinte acerta e o Caçador chega", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem a lição do rolamento");
  await comecarIntro(jogo);
  await jogo.esperar(4500);
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(1500);
  await jogo.page.keyboard.up("KeyD");
  expect(await esperarAte(jogo, "__t.ISC.ph==='boar'", 15000, 500)).toBe(true);
  await jogo.js("__t.ISC.shots = 2"); // já atirou as flechas da finta: a próxima investida é de verdade

  expect(await esperarAte(jogo, "__t.ISC.esq === 1", 15000, 100), "a lição começa").toBe(true);
  expect(await jogo.js<number>("__t.dungeon.camLenta"), "câmera lenta").toBeLessThan(0.5);
  // perto dele o tempo congela, com a tela "Aperte ESPAÇO para desviar", e fica assim até rolar
  expect(await esperarAte(jogo, "__t.dungeon.camLenta === 0", 6000, 100), "o tempo congela").toBe(true);
  const tela = "document.getElementById('isc-esq')";
  expect(await jogo.js(`${tela}.classList.contains('on')`), "a tela do rolamento").toBe(true);
  expect(await jogo.js<string>(`${tela}.textContent`)).toContain("ESPAÇO para desviar");
  await jogo.esperar(3000);
  expect(await jogo.js("[__t.dungeon.camLenta, __t.ISC.esq, __t.ISC.gotHit || 0]"), "continua congelado").toEqual([
    0, 1, 0,
  ]);
  await jogo.foto("congelado");
  await jogo.page.keyboard.press("Space");
  expect(await esperarAte(jogo, "__t.ISC.esq >= 2", 1000, 50), "rolou").toBe(true);
  expect(await jogo.js(`${tela}.classList.contains('on')`), "a tela some").toBe(false);
  expect(await esperarAte(jogo, "__t.ISC.esq === 3", 3000, 100), "o tempo volta").toBe(true);
  expect(await jogo.js("__t.dungeon.camLenta"), "tempo normal").toBeUndefined();
  expect(await jogo.js("__t.ISC.gotHit || 0"), "passou por ele sem levar o golpe").toBe(0);

  // a próxima investida acerta uma vez e o Caçador chega antes da segunda
  expect(await esperarAte(jogo, "__t.ISC.gotHit >= 1 || __t.ISC.ph !== 'boar'", 20000, 250)).toBe(true);
  expect(await esperarAte(jogo, "__t.ISC.ph !== 'boar'", 8000, 100), "o resgate").toBe(true);
  expect(await jogo.js("__t.ISC.gotHit"), "levou um golpe só").toBe(1);
});
