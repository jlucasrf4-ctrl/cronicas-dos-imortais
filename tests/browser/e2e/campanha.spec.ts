/* v7.7 — campanha (campanha/campanha.ts): o quadro do objetivo no mapa, escondido durante a fala, e as missões do
   Ato 1 andando com o tutorial do acampamento (chegar → fogueira/jantar → barraca). */
import { test, expect, entrarComHeroi, esperarAte, passarDialogo } from "./comum.ts";

const missao = "__t.campanha().etapa";
const quadroOn = "document.getElementById('missao').classList.contains('on')";

test("campanha: objetivo no mapa e as missões do acampamento", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  // depois da abertura, ainda sem ir ao acampamento (save de antes da campanha: a etapa sai das marcas)
  await jogo.js("__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 1; delete __t.econ.campanha;");
  expect(await jogo.js(missao)).toBe("a1_acampamento");
  expect(
    await esperarAte(
      jogo,
      `${quadroOn} && document.getElementById('missao').textContent.includes('acampamento')`,
      3000,
    ),
    "o quadro mostra a missão no mapa",
  ).toBe(true);
  await jogo.foto("mapa");

  // chega ao acampamento: o Caçador fala (o quadro some durante a fala) e a missão passa para a noite
  await jogo.js("__t.enterCamp(__h)");
  expect(await esperarAte(jogo, "!!__t.ISC.dlg", 4000), "o Caçador fala").toBe(true);
  expect(await jogo.js(missao)).toBe("a1_noite");
  expect(await jogo.js("document.querySelector('#isc-dlg .idl-who b').textContent")).toBe("Caçador");
  await jogo.esperar(400);
  expect(await jogo.js(quadroOn), "escondido na fala").toBe(false);
  await passarDialogo(jogo);

  // a barraca (o fim do tutorial): a fala da tabela com a ação na 2ª página, e a campanha vai ao Ato 2
  await jogo.js("__t.ctTent()");
  expect(await esperarAte(jogo, "!!__t.ISC.dlg", 2000)).toBe(true);
  await passarDialogo(jogo);
  expect(await jogo.js("[!!__t.econ.tent, !!__t.econ.hunterNap, __t.econ.campTut]")).toEqual([true, true, 3]);
  expect(await jogo.js(missao)).toBe("a2_livre");
  // o aviso "💤 cochilando" da cena fica 6 s; enquanto isso o quadro dá lugar a ele
  expect(await jogo.js(quadroOn), "não briga com o objetivo da cena").toBe(false);
  expect(await esperarAte(jogo, quadroOn, 9000), "o quadro volta no campo").toBe(true);
  await jogo.foto("acampamento");

  // dormir conclui o tempo livre: de manhã o Caçador chama (❗), o painel diz "Falar com o Caçador" e o E dá a fala
  // da Brasa, que passa para a missão do lobo
  await jogo.js("__t.campanhaEvento('dormiu')");
  expect(await jogo.js(missao)).toBe("a3_brasa");
  await jogo.js(
    "(()=>{const d=__t.dungeon; __t.econ.hunterNap=false; d.px=__t.CPS.hunter.x+20; d.py=__t.CPS.hunter.y; return __t.campNear()})()",
  );
  expect(
    await esperarAte(jogo, "document.getElementById('acoes').textContent.includes('quer falar')", 2000),
    "painel: o Caçador chama",
  ).toBe(true);
  await jogo.foto("chamado");
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, "!!__t.ISC.dlg", 2000), "a fala da Brasa").toBe(true);
  expect(
    await esperarAte(jogo, "document.getElementById('isc-dlg').textContent.includes('Brasa')", 3000),
    "fala da Brasa (o texto aparece letra a letra)",
  ).toBe(true);
  await jogo.foto("fala-brasa");
  await passarDialogo(jogo, 30); // 7 páginas
  expect(await jogo.js(missao)).toBe("a3_lobo");

  // gameshark: pular e recomeçar
  await jogo.js("__t.gsRun('RECOMECAR')");
  expect(await jogo.js(missao)).toBe("a1_abertura");
  await jogo.js("__t.gsRun('PULARMISSAO')");
  expect(await jogo.js(missao)).toBe("a1_acampamento");
});

test("campanha: o Caçador chama no mapa (balão ❗ sobre o acampamento)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 3; __t.campanhaIr('a3_brasa')");
  await jogo.esperar(1500);
  await jogo.foto("mapa-chamado");
});
