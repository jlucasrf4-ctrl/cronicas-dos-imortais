/* v8.0 — a Vila Musgo andável (map/vila_cena.ts, data/vila.ts VILA_CENA; mantenedor, 2026-10-24: "clico nela e já
   entro em um mapa de cidade mesmo"). Entrar pelo mapa abre a cena; na porta, o E abre só aquele lugar (sem as abas);
   as casas barram; o círculo verde volta ao mapa com a heroína na vila; o bote da doca sai da vila e atravessa. */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

const naVila = "__t.dungeon.active && __t.dungeon.vila";

async function entrar(jogo: Parameters<typeof entrarComHeroi>[0]) {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "(()=>{__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.gold=100; __t.world.tick=24*60+12*60; const c=__t.musgoCity(), h=__h; h.x=c.x; h.y=c.y+6; h.state='field'; __t.vilaEntrar(h);})()",
  );
  expect(await esperarAte(jogo, naVila, 8000), "entrou na vila").toBe(true);
  await jogo.esperar(900);
}
/** Põe a heroína na porta do lugar (um pouco abaixo, na direção da rua). */
const naPorta = (id: string) =>
  `(()=>{const p=__t.vilaPorta('${id}'), d=__t.dungeon; d.px=p.x; d.py=p.y+8; d.moveTarget=null;})()`;

test("vila andável: entrar, a porta abre o lugar sem abas, as casas barram, sair volta ao mapa", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a vila andável");
  test.setTimeout(120_000);
  await entrar(jogo);
  await jogo.foto("vila_entrada");

  // na porta do Empório, o painel diz o lugar e o E abre a janela só dele
  await jogo.js(naPorta("emporio"));
  await jogo.esperar(400);
  expect(await jogo.js<string>("document.getElementById('acoes').textContent")).toContain("Empório");
  await jogo.foto("vila_emporio_porta");
  await jogo.page.keyboard.press("KeyE");
  await jogo.page.waitForSelector("#musgo-modal.open");
  expect(await jogo.page.locator("#musgo-modal .vila-abas").count(), "sem a barra de abas").toBe(0);
  expect(await jogo.page.locator("#musgo-modal .mt-head b").innerText()).toContain("Empório");
  expect(await jogo.js("__t.dungeon.modalOpen"), "parada enquanto a janela está aberta").toBe(true);
  await jogo.page.keyboard.press("Escape");
  expect(await esperarAte(jogo, "!document.querySelector('#musgo-modal.open') && !__t.dungeon.modalOpen", 2000)).toBe(
    true,
  );

  // a taverna abre a taverna
  await jogo.js(naPorta("taverna"));
  await jogo.esperar(300);
  await jogo.page.keyboard.press("KeyE");
  await jogo.page.waitForSelector("#musgo-modal.open [data-vl='boato']");
  await jogo.page.click("#musgo-modal [data-mz='x']");

  // a parede do Empório barra: andando para cima a partir da porta, ela não entra na casa
  await jogo.js(naPorta("emporio"));
  await jogo.page.keyboard.down("KeyW");
  await jogo.esperar(1200);
  await jogo.page.keyboard.up("KeyW");
  const fundo = await jogo.js<number>("__t.dungeon.py / __t.dungeon.tile");
  expect(fundo, "parou na frente da parede (frente do Empório em z≈5,4)").toBeGreaterThan(5.3);

  // a praça e a doca, para ver
  await jogo.js("(()=>{const d=__t.dungeon; d.px=14*d.tile; d.py=10*d.tile;})()");
  await jogo.esperar(700);
  await jogo.foto("vila_praca");
  await jogo.js(naPorta("doca"));
  await jogo.esperar(700);
  await jogo.foto("vila_doca");

  // o círculo verde: volta ao mapa, na vila
  await jogo.js("(()=>{const d=__t.dungeon; d.px=d.entrance.x; d.py=d.entrance.y;})()");
  await jogo.esperar(300);
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 6000), "saiu").toBe(true);
  expect(await jogo.js("__h.state"), "no mapa, na vila").toBe("field");
  expect(await jogo.js("__t.heroNaVila() === __h")).toBe(true);
  expect(await jogo.js("__t.dungeon.vila"), "a vila desligou").toBe(false);
});

test("vila andável: o bote da doca sai da vila e atravessa para a área de caça", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a vila andável");
  test.setTimeout(90_000);
  await entrar(jogo);
  await jogo.js(naPorta("doca"));
  await jogo.esperar(300);
  await jogo.page.keyboard.press("KeyE");
  await jogo.page.click("#musgo-modal [data-vl='bote']");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 6000), "saiu da vila").toBe(true);
  expect(
    await esperarAte(jogo, "(()=>{const D=__t.docaCaca(); return Math.hypot(__h.x-D.x, __h.y-D.y) < 4;})()", 8000),
    "atravessou",
  ).toBe(true);
});
