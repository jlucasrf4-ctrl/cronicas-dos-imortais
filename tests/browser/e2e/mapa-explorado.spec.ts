/* v8.3 — mapa explorado e minimapa (map/explorar.ts, ui/hud.ts), caderno do cartógrafo (N, map/caderno.ts) e
   armadilhas (map/armadilhas.ts: o aviso pisca perto delas, a perícia de cartógrafo aumenta o alcance, pisar dispara). */
import { test, expect, entrarComHeroi } from "./comum.ts";

/* a mesma conta de map/armadilhas.ts (dispersao e armadilhaEm): a armadilha de uma célula é fixa */
const CONTA_ARMADILHA = `
  const dispersao = (cx, cy) => {
    let h = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const armadilhaEm = (cx, cy) => {
    if (dispersao(cx, cy) >= 0.02) return false;
    const x = (cx + 0.5) * 40, y = (cy + 0.5) * 40;
    return __t.CITIES.every((c) => Math.hypot(c.x - x, c.y - y) >= 160);
  };
  const achar = () => {
    const c0 = __t.CITIES[0];
    const cx0 = Math.floor(c0.x / 40), cy0 = Math.floor(c0.y / 40);
    for (let cx = cx0 - 60; cx < cx0 + 60; cx++)
      for (let cy = cy0 - 60; cy < cy0 + 60; cy++) if (armadilhaEm(cx, cy)) return { cx, cy };
    return null;
  };
`;

test.setTimeout(240_000);

test("mapa explorado: névoa do minimapa, botões do minimapa, caderno (N)", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.econ.introDone = true;");
  await jogo.esperar(400);

  // 1. andar pelo mapa explora áreas novas
  const antes = await jogo.js<number>("(__t.econ.explorado || []).length");
  await jogo.js("(()=>{const c=__t.CITIES[0]; __h.x = c.x + 300; __h.y = c.y + 300; })()");
  await jogo.esperar(1500);
  const depois = await jogo.js<number>("(__t.econ.explorado || []).length");
  expect(depois, "áreas exploradas aumentam quando o herói anda").toBeGreaterThan(antes);

  // 2. botões do minimapa existem
  expect(await jogo.js("!!document.getElementById('mm-mais') && !!document.getElementById('mm-menos') && !!document.getElementById('mm-marca')")).toBe(true);
  const mm = await jogo.caixa("#minimap");
  await jogo.foto("minimapa", mm);

  // 3. caderno: N abre, Esc fecha, e o texto fica salvo
  await jogo.page.keyboard.press("KeyN");
  await jogo.esperar(200);
  expect(await jogo.js("document.getElementById('caderno').classList.contains('on')")).toBe(true);
  await jogo.page.locator("#cad-texto").fill("Armadilha perto da cidade.");
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(200);
  expect(await jogo.js("document.getElementById('caderno').classList.contains('on')")).toBe(false);
  expect(await jogo.js("__t.econ.caderno && __t.econ.caderno.notas")).toBe("Armadilha perto da cidade.");
});

test("armadilha: aviso pela distância conforme a perícia, disparo e marcação", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.econ.introDone = true; __h.skills = __h.skills || {}; __h.skills.cartografo = { level: 0, xp: 0 };");
  await jogo.esperar(400);
  const alvo = await jogo.js<{ cx: number; cy: number } | null>(`(() => { ${CONTA_ARMADILHA} return achar(); })()`);
  expect(alvo, "há uma armadilha perto da cidade 0").not.toBeNull();
  const aviso =
    "!!document.getElementById('armadilha-aviso') && document.getElementById('armadilha-aviso').className.includes('on')";

  // a 60 unidades da armadilha: sem perícia não avisa; com perícia 3 (alcance 68) avisa
  await jogo.js(`__h.x = ${(alvo!.cx + 0.5) * 40 + 60}; __h.y = ${(alvo!.cy + 0.5) * 40};`);
  await jogo.esperar(500);
  expect(await jogo.js(aviso), "sem perícia, 60 unidades longe não avisa").toBe(false);
  await jogo.js("__h.skills.cartografo.level = 3;");
  await jogo.esperar(600);
  expect(await jogo.js(aviso), "com perícia 3, 60 unidades longe já avisa").toBe(true);
  await jogo.foto("aviso-armadilha");

  // pisar dispara uma vez e tira vida
  const vidaAntes = await jogo.js<number>("__h.hp");
  await jogo.js(`__h.x = ${(alvo!.cx + 0.5) * 40}; __h.y = ${(alvo!.cy + 0.5) * 40};`);
  await jogo.esperar(500);
  const disparadas = await jogo.js<number>("(__t.econ.armadilhasDisparadas || []).length");
  expect(disparadas).toBeGreaterThan(0);
  expect(await jogo.js<number>("__h.hp")).toBeLessThan(vidaAntes);
  await jogo.js(`__h.x = ${(alvo!.cx + 0.5) * 40}; __h.y = ${(alvo!.cy + 0.5) * 40};`);
  await jogo.esperar(300);
  expect(await jogo.js("(__t.econ.armadilhasDisparadas || []).length"), "dispara uma vez só").toBe(disparadas);

  // o botão 📍 marca o ponto do herói (clique pelo DOM, como os outros testes do projeto)
  await jogo.js("document.getElementById('mm-marca').click()");
  await jogo.esperar(200);
  expect(await jogo.js<number>("(__t.econ.marcasMapa || []).length")).toBe(1);
});
