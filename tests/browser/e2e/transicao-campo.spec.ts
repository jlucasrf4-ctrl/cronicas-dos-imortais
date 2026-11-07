/* v7.7 — entrar e sair do campo pelo zoom (map/transicao.ts, Bloco 6 parte 3): no zoom máximo, rolar para dentro só
   entra com o cursor numa heroína selecionada (o anel enche nela); o mapa mergulha, a tela escurece e o campo abre
   com a câmera alta, que desce. Rolar para fora no campo sobe a câmera (dica com o quanto falta) e volta ao mapa
   aproximado na heroína, que se afasta. E entra com a heroína selecionada. */
import { test, expect, entrarComHeroi, esperarAte, type Jogo } from "./comum.ts";

/** Heroína solta no mapa, no zoom máximo e centrada; sem lobos no campo. */
async function noMapa(jogo: Jogo) {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "(()=>{__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0; const h=__h; h.state='field'; h.task=null; const c=__t.camera; c.zt=null; c.scale=c.maxScale; const vp=document.getElementById('viewport'); c.tx=vp.clientWidth/2-h.x*c.scale; c.ty=vp.clientHeight/2-h.y*c.scale; __t.applyCameraTransform();})()",
  );
  await jogo.esperar(400);
}
const telaHeroi = (jogo: Jogo) =>
  jogo.js<{ x: number; y: number }>(
    "(()=>{const r=document.getElementById('viewport').getBoundingClientRect(), c=__t.camera; return {x:r.left+c.tx+__h.x*c.scale, y:r.top+c.ty+__h.y*c.scale};})()",
  );

test("campo pelo zoom: só na heroína selecionada, mergulho contínuo e saída simétrica", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 entra pelo portal, com qualquer heroína");
  test.setTimeout(150_000); // entra e sai do campo: com a suíte inteira rodando passa de 60 s
  await noMapa(jogo);
  const p = await telaHeroi(jogo);

  // sem seleção, rolar para dentro na heroína não entra
  await jogo.page.mouse.move(p.x, p.y);
  for (let i = 0; i < 6; i++) {
    await jogo.page.mouse.wheel(0, -200);
    await jogo.esperar(60);
  }
  await jogo.esperar(1500);
  expect(await jogo.js("__t.dungeon.active"), "sem seleção não entra").toBe(false);

  // selecionada, mas com o cursor longe dela: também não
  await jogo.js("__t.SEL.grupo=[__h.id]");
  await jogo.page.mouse.move(p.x + 150, p.y + 90);
  for (let i = 0; i < 6; i++) {
    await jogo.page.mouse.wheel(0, -200);
    await jogo.esperar(60);
  }
  await jogo.esperar(1500);
  expect(await jogo.js("__t.dungeon.active"), "cursor longe não entra").toBe(false);

  // selecionada e com o cursor nela: o anel enche e entra
  await jogo.js(
    "(()=>{window.__fs=[]; const s=()=>{ if(__t.dungeon.active && __t.D3.gl) __fs.push(__t.CZ.f); if(__fs.length<400) requestAnimationFrame(s); }; s();})()",
  );
  await jogo.page.mouse.move(p.x, p.y);
  await jogo.page.mouse.wheel(0, -100);
  await jogo.esperar(60);
  expect(await jogo.js("__t.JOGO.alvo"), "o anel é dela").toBe(await jogo.js("__h.id"));
  await jogo.foto("1_anel");
  for (let i = 0; i < 3; i++) {
    await jogo.page.mouse.wheel(0, -200);
    await jogo.esperar(60);
  }
  expect(
    await esperarAte(jogo, "/scale/.test(document.getElementById('viewport').style.transform)", 2000, 20),
    "o mapa continua aproximando (escala CSS)",
  ).toBe(true);
  await jogo.esperar(350);
  await jogo.foto("2_mergulho");
  expect(await esperarAte(jogo, "__t.dungeon.active", 4000, 100)).toBe(true);
  expect(await jogo.js("document.getElementById('portal-transition').classList.contains('active')"), "sem portal").toBe(
    false,
  );
  // a câmera começa alta no campo e desce sem voltar (amostra de CZ.f a cada quadro, posta antes de entrar)
  expect(await esperarAte(jogo, "!!__t.CZ.voo && __t.CZ.voo.t0>0", 3000, 20), "o voo começou").toBe(true);
  await jogo.esperar(250);
  await jogo.foto("3_campo_alto");
  await jogo.esperar(1600);
  const fs = await jogo.js<number[]>("__fs");
  expect(Math.min(...fs), "o campo abre com a câmera alta").toBeLessThan(0.6);
  expect(
    fs.every((f, i) => !i || f >= fs[i - 1] - 1e-6),
    "e ela só desce",
  ).toBe(true);
  expect(await jogo.js<number>("__t.CZ.f"), "até o normal").toBeGreaterThan(0.97);
  expect(await jogo.js<string>("getComputedStyle(document.getElementById('zoom-veu')).opacity")).toBe("0");
  await jogo.foto("4_campo");

  // saída: rolar para fora no mais afastado sobe a câmera aos poucos, com a dica
  const vp = await jogo.js<number[]>("[innerWidth/2, innerHeight/2]");
  await jogo.page.mouse.move(vp[0], vp[1]);
  await jogo.page.mouse.wheel(0, 90);
  await jogo.esperar(400);
  expect(await jogo.js("document.getElementById('saida-dica').classList.contains('on')"), "dica da saída").toBe(true);
  expect(await jogo.js<number>("__t.CZ.f"), "a câmera já subiu um pouco").toBeLessThan(0.95);
  await jogo.foto("5_saindo");
  // (a roda zera depois de 1,2 s parada, e a foto demora: três seguidas bastam sozinhas)
  for (let i = 0; i < 3; i++) {
    await jogo.page.mouse.wheel(0, 90);
    await jogo.esperar(40);
  }
  await jogo.esperar(250);
  await jogo.foto("6_subindo");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 3000, 100)).toBe(true);
  await jogo.esperar(250);
  await jogo.foto("7_mapa_perto");
  expect(await jogo.js("__h.state")).toBe("field");
  await jogo.esperar(1800);
  const s = await jogo.js<number[]>("[__t.camera.scale, __t.camera.maxScale]");
  expect(s[0], "o mapa se afastou depois de voltar").toBeLessThan(s[1]);
  expect(await jogo.js<string>("document.getElementById('viewport').style.transform")).toBe("");
  await jogo.foto("8_mapa");
});

test("campo pelo E: com a heroína selecionada", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o E no mapa");
  await noMapa(jogo);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(1500);
  expect(await jogo.js("__t.dungeon.active"), "sem seleção o E não entra").toBe(false);
  await jogo.js("__t.SEL.grupo=[__h.id]");
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, "__t.dungeon.active", 4000, 100)).toBe(true);
  expect(await jogo.js("__t.dungeon.mode")).toBe("campo");
});
