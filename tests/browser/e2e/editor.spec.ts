/* v8.1 — o Modo Editor (src/editor/editor.ts): F2 no campo aberto abre o editor com o jogo pausado; colocar uma peça
   da biblioteca, mover arrastando, girar com a roda, desfazer, apagar, recado, pincel, luz/efeito, a hora e a
   prévia de estação; fechar deixa as peças no campo; "Testar aqui" põe a heroína no ponto. Sem o modo ao vivo (o
   teste abre o arquivo do disco), grava no navegador. */
import { test, expect, entrarComHeroi, esperarAte, type Jogo } from "./comum.ts";

async function abrirCampo(jogo: Jogo) {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "(()=>{__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0; const h=__h; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 5000)).toBe(true);
  await jogo.esperar(2500);
  // um evento de perigo (bandidos, Runa Natural) que abra por cima não atrapalha o teste
  await jogo.js("document.getElementById('perigo')?.classList.remove('on'); __t.dungeon.modalOpen = false");
  // começa sem decoração (o build traz a do mantenedor; aqui nada é gravado no arquivo, só no navegador do teste)
  await jogo.js("__t.ED.dados = {versao:1,cenas:{},recados:{},conjuntos:{},terreno:[],proximo:1}; __t.ED.versao++");
}
const pecas = (jogo: Jogo) => jogo.js<number>("(__t.ED.dados.cenas.mundo||[]).length");

test("Modo Editor: pincel de terreno (água vira água de verdade, desfaz), mini mapa, zoom afastado", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem o editor");
  test.setTimeout(360000);
  await abrirCampo(jogo);
  const pg = jogo.page;
  await pg.keyboard.press("F2");
  await jogo.esperar(500);
  await expect(pg.locator("#ed-mini"), "mini mapa aberto").toBeVisible();
  // o ponto do mapa no meio da tela (a câmera começa na heroína)
  const cena = await jogo.caixa("#dungeon-canvas");
  const meio = { x: cena.x + cena.width / 2, y: cena.y + cena.height / 2 };
  const alvo = await jogo.js<{ x: number; y: number }>(
    "(()=>{const c=__t.dungeon.origem, e=__t.MUNDO.escala; return {x:c.x+__t.D3.cx*e, y:c.y+__t.D3.cz*e};})()",
  );
  expect(await jogo.js(`__t.aguaEm(${alvo.x}, ${alvo.y})`), "começa em terra").toBe(false);
  // pinta água no meio
  await pg.keyboard.press("KeyI");
  await pg.locator('[data-tm="agua"]').click();
  await pg.mouse.move(meio.x - 60, meio.y);
  await pg.mouse.down();
  await pg.mouse.move(meio.x + 60, meio.y, { steps: 8 });
  await pg.mouse.up();
  expect(await jogo.js<number>("__t.ED.dados.terreno.length"), "pinceladas").toBeGreaterThan(2);
  expect(await jogo.js(`__t.aguaEm(${alvo.x}, ${alvo.y})`), "virou água").toBe(true);
  await jogo.esperar(2500);
  await jogo.foto("t1-lago");
  // desfazer volta a terra
  await pg.keyboard.press("Control+KeyZ");
  await jogo.esperar(400);
  expect(await jogo.js(`__t.aguaEm(${alvo.x}, ${alvo.y})`), "desfez").toBe(false);
  // afastar ao máximo: o cenário não pisca (os blocos da tela ficam na memória)
  await pg.keyboard.press("Escape");
  await pg.mouse.move(meio.x, meio.y);
  for (let i = 0; i < 16; i++) await pg.mouse.wheel(0, 120);
  await jogo.esperar(6000);
  await jogo.foto("t2-afastado");
  // mini mapa: clicar leva a câmera
  const cam0 = await jogo.js<number>("__t.D3.cx");
  const mini = await jogo.caixa("#ed-mini-cv");
  await pg.mouse.click(mini.x + mini.width * 0.2, mini.y + mini.height * 0.5);
  expect(Math.abs((await jogo.js<number>("__t.D3.cx")) - cam0), "a câmera foi").toBeGreaterThan(200);
  await pg.keyboard.press("KeyM");
  await expect(pg.locator("#ed-mini")).toBeHidden();
});

test("Modo Editor: estações repintam o cenário (emblemas nos botões) e as peças de estação da biblioteca", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem o editor");
  test.setTimeout(360000);
  await abrirCampo(jogo);
  const pg = jogo.page;
  await pg.keyboard.press("F2");
  await jogo.esperar(500);
  await expect(pg.locator('.ed-est[data-est="inverno"] img'), "emblema no botão").toBeVisible();
  // peças de estação: a categoria Estações tem árvores com neve, floridas e de outono
  await pg.locator('#ed-cats [data-cat="estacoes"]').click();
  const nomes = await pg.locator("#ed-cards .ed-card").allTextContents();
  expect(nomes.some((n) => n.includes("inverno"))).toBe(true);
  expect(nomes.some((n) => n.includes("primavera"))).toBe(true);
  const cena = await jogo.caixa("#dungeon-canvas");
  const meio = { x: cena.x + cena.width / 2, y: cena.y + cena.height / 2 };
  for (const [i, nome] of ["Árvore (primavera)", "Árvore (outono)", "Pinheiro (inverno)"].entries()) {
    await pg.locator("#ed-cards .ed-card", { hasText: nome }).first().click();
    await pg.mouse.click(meio.x - 140 + i * 140, meio.y + 90);
  }
  expect(await jogo.js<string[]>("(__t.ED.dados.cenas.mundo||[]).map(p=>p.m)")).toEqual([
    "cen:folhosa_1@primavera",
    "cen:folhosa_1@outono",
    "cen:pinheiro_1@inverno",
  ]);
  await pg.keyboard.press("Escape");
  await jogo.esperar(800);
  await jogo.foto("e0-pecas-de-estacao");
  // a prévia: cada estação repinta o cenário
  for (const est of ["inverno", "primavera", "outono", "verao"]) {
    await pg.locator(`.ed-est[data-est="${est}"]`).click();
    await jogo.esperar(5000);
    await jogo.foto("e-" + est);
  }
  await pg.locator('.ed-est[data-est="verao"]').click();
  expect(await jogo.js("__t.ED.estacao")).toBe("");
});

test("Modo Editor: árvore posta vira recurso de verdade; árvores e pedras do mapa podem ser apagadas", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem o editor");
  test.setTimeout(360000);
  await abrirCampo(jogo);
  const pg = jogo.page;
  await pg.keyboard.press("F2");
  await jogo.esperar(500);
  const cena = await jogo.caixa("#dungeon-canvas");
  const meio = { x: cena.x + cena.width / 2, y: cena.y + cena.height / 2 };
  await pg.locator('#ed-cats [data-cat="arvores"]').click();
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.mouse.click(meio.x + 120, meio.y + 20);
  const id = await jogo.js<number>("__t.ED.dados.cenas.mundo[0].id");
  // fechado: a árvore posta entra no cenário como as do mapa (cortável, com colisão)
  await pg.keyboard.press("F2");
  await jogo.esperar(3000);
  expect(
    await jogo.js<boolean>(`(__t.dungeon.recursosCampo||[]).some(r => r.id === "deco:${id}" && r.tipo === "arvore")`),
    "a árvore posta é recurso",
  ).toBe(true);
  // num pedaço de mata, longe do acampamento: o pincel com Shift apaga as árvores do próprio mapa
  await pg.keyboard.press("F2");
  await jogo.esperar(400);
  await jogo.js("__t.D3.cx += 900; __t.D3.cz += 300");
  await jogo.esperar(2500);
  await pg.locator('#ed-cats [data-cat="plantas"]').click();
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.keyboard.press("KeyP");
  await jogo.js(
    "document.querySelector('#ed-pincel').value = 300; document.querySelector('#ed-pincel').dispatchEvent(new Event('input'))",
  );
  await pg.keyboard.down("Shift");
  await pg.mouse.move(meio.x - 150, meio.y);
  await pg.mouse.down();
  await pg.mouse.move(meio.x + 150, meio.y, { steps: 10 });
  await pg.mouse.up();
  await pg.keyboard.up("Shift");
  const removidos = await jogo.js<string[]>("__t.ED.dados.removidos || []");
  expect(removidos.length, "apagou peças do mapa").toBeGreaterThan(0);
  await jogo.esperar(3000);
  await jogo.foto("r1-clareira-aberta");
  // fechado, as apagadas não voltam como recurso
  await pg.keyboard.press("F2");
  await jogo.esperar(3000);
  const voltou = await jogo.js<boolean>(
    `(()=>{const R = new Set(${JSON.stringify(removidos)}); return (__t.dungeon.recursosCampo||[]).some(r => R.has(r.id));})()`,
  );
  expect(voltou, "as apagadas não são mais recurso").toBe(false);
});

test("Modo Editor: colocar, mover, girar, desfazer, apagar, recado, pincel, atmosfera, testar", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o editor");
  test.setTimeout(360000);
  await abrirCampo(jogo);
  const pg = jogo.page;
  await pg.keyboard.press("F2");
  await jogo.esperar(400);
  expect(await jogo.js("__t.ED.on"), "abriu").toBe(true);
  await expect(pg.locator("#ed-raiz")).toBeVisible();
  await expect(pg.locator("#ed-cards .ed-card").first()).toBeVisible();
  await jogo.esperar(600); // miniaturas
  await jogo.foto("1-aberto");

  // o jogo fica parado: a heroína não anda com W
  const p0 = await jogo.js<number[]>("[__t.dungeon.px, __t.dungeon.py]");
  await pg.keyboard.down("KeyD");
  await jogo.esperar(400);
  await pg.keyboard.up("KeyD");
  const p1 = await jogo.js<number[]>("[__t.dungeon.px, __t.dungeon.py]");
  expect(p1, "a heroína não andou").toEqual(p0);

  // colocar: escolhe a 1ª árvore e clica no meio da cena
  const cena = await jogo.caixa("#dungeon-canvas");
  const meio = { x: cena.x + cena.width / 2, y: cena.y + cena.height / 2 + 40 };
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.mouse.click(meio.x, meio.y);
  await jogo.esperar(200);
  expect(await pecas(jogo), "pôs uma").toBe(1);
  // mais uma, de outra categoria (vila, com textura)
  await pg.locator('#ed-cats [data-cat="vila"]').click();
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.mouse.click(meio.x + 160, meio.y - 30);
  await jogo.esperar(200);
  expect(await pecas(jogo)).toBe(2);

  // mover: V, seleciona a árvore e arrasta
  await pg.keyboard.press("KeyV");
  await pg.mouse.move(meio.x, meio.y - 8);
  await pg.mouse.down();
  await pg.mouse.move(meio.x - 40, meio.y + 10, { steps: 6 });
  await pg.mouse.move(meio.x - 80, meio.y + 20, { steps: 6 });
  await pg.mouse.up();
  const sel = await jogo.js<number>("__t.ED.selecionados.size");
  expect(sel, "selecionou a árvore").toBe(1);
  const x1 = await jogo.js<number>("__t.ED.dados.cenas.mundo[0].x");
  // girar com a roda
  const g0 = await jogo.js<number>("__t.ED.dados.cenas.mundo[0].g||0");
  await pg.mouse.move(meio.x - 80, meio.y + 10);
  await pg.mouse.wheel(0, -120);
  await jogo.esperar(600);
  const g1 = await jogo.js<number>("__t.ED.dados.cenas.mundo[0].g||0");
  expect(Math.abs(g1 - g0), "girou").toBeGreaterThan(0.1);
  await jogo.foto("2-colocou-moveu");

  // desfazer volta o giro, depois o movimento
  await pg.keyboard.press("Control+KeyZ");
  expect(await jogo.js<number>("__t.ED.dados.cenas.mundo[0].g||0")).toBeCloseTo(g0, 3);
  await pg.keyboard.press("Control+KeyZ");
  expect(await jogo.js<number>("__t.ED.dados.cenas.mundo[0].x"), "voltou do arrasto").not.toBeCloseTo(x1, 0);
  await pg.keyboard.press("Control+KeyY");
  expect(await jogo.js<number>("__t.ED.dados.cenas.mundo[0].x"), "refez").toBeCloseTo(x1, 0);

  // apagar a selecionada (a árvore): Del
  // Reabrir após usar Colocar começa em seleção; clicar sai do foco da busca.
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.keyboard.press("F2");
  await pg.keyboard.press("F2");
  await expect(pg.locator("#ed-raiz")).toHaveAttribute("data-ferramenta", "mover");
  await jogo.js("__t.ED.selecionados.clear()");
  await pg.locator("#ed-busca").focus();
  await pg.mouse.click(meio.x - 80, meio.y + 12);
  expect(await jogo.js<number>("__t.ED.selecionados.size"), "selecionou pelo clique após a busca").toBe(1);
  // Apagar no térreo preserva as peças do segundo andar.
  await jogo.js("__t.ED.dados.cenas.mundo.push({id:999999,m:'luz:tocha',x:0,z:0,pavimento:1})");
  await pg.keyboard.press("Delete");
  expect(await pecas(jogo), "apagou só a selecionada").toBe(2);
  expect(await jogo.js<boolean>("__t.ED.dados.cenas.mundo.some(p=>p.id===999999)"), "preservou o segundo andar").toBe(true);
  await jogo.js("__t.ED.dados.cenas.mundo = __t.ED.dados.cenas.mundo.filter(p=>p.id!==999999)");

  // recado
  await pg.keyboard.press("KeyN");
  await pg.mouse.click(meio.x - 200, meio.y + 60);
  await jogo.esperar(150);
  await pg.keyboard.type("uma ponte aqui");
  await pg.keyboard.press("Enter");
  expect(await jogo.js<string>("__t.ED.dados.recados.mundo[0].texto")).toBe("uma ponte aqui");

  // pincel com moitas
  await pg.locator('#ed-cats [data-cat="plantas"]').click();
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.keyboard.press("KeyP");
  await pg.mouse.move(meio.x + 60, meio.y + 90);
  await pg.mouse.down();
  for (let i = 0; i < 12; i++) await pg.mouse.move(meio.x + 60 + i * 18, meio.y + 90 + Math.sin(i) * 20, { steps: 2 });
  await pg.mouse.up();
  const depoisPincel = await pecas(jogo);
  expect(depoisPincel, "o pincel pôs várias").toBeGreaterThan(4);

  // luz e fumaça
  await pg.keyboard.press("Escape");
  await pg.locator('#ed-cats [data-cat="luzes"]').click();
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.mouse.click(meio.x + 160, meio.y + 10);
  await pg.locator('#ed-cats [data-cat="efeitos"]').click();
  await pg.locator("#ed-cards .ed-card").first().click();
  await pg.mouse.click(meio.x + 150, meio.y - 40);
  expect(await pecas(jogo)).toBe(depoisPincel + 2);
  await jogo.esperar(800);
  await jogo.foto("3-pincel-recado-luz");

  // noite (hora fixada) e inverno
  await pg.locator("#ed-hora").fill("22");
  await pg.locator('.ed-est[data-est="inverno"]').click();
  await jogo.esperar(1500);
  await jogo.foto("4-noite-inverno");
  expect(await jogo.js("__t.ED.hora")).toBe(22);
  expect(await jogo.js("__t.ED.estacao")).toBe("inverno");

  // fechar: a prévia some, as peças ficam
  await pg.keyboard.press("F2");
  await jogo.esperar(500);
  expect(await jogo.js("__t.ED.on")).toBe(false);
  expect(await jogo.js("__t.ED.hora")).toBeNull();
  expect(await pecas(jogo)).toBe(depoisPincel + 2);
  await jogo.foto("5-fechado");
  // gravou no navegador (sem o modo ao vivo)
  expect(await jogo.js<boolean>("!!localStorage.getItem('mv_editor_rascunho')")).toBe(true);

  // testar aqui: abre, mouse num canto, T
  await pg.keyboard.press("F2");
  await jogo.esperar(300);
  await pg.mouse.move(meio.x + 200, meio.y);
  const alvo = await jogo.js<number>("__t.dungeon.px");
  await pg.keyboard.press("KeyT");
  await jogo.esperar(300);
  expect(await jogo.js("__t.ED.on")).toBe(false);
  expect(await jogo.js<number>("__t.dungeon.px"), "a heroína foi para o ponto").toBeGreaterThan(alvo + 40);
});
