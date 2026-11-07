/* v7.7 — pular o tutorial do acampamento (intro/tutorial.ts: ctPular): o botão Pular da fala do Caçador (antes só servia
   na introdução e no acampamento não fazia nada) e o da janela da fogueira do tutorial. */
import { test, expect, entrarComHeroi, esperarAte, type Jogo } from "./comum.ts";

const FIM =
  "JSON.stringify({modal:!!document.querySelector('#fire-modal.open'), modalOpen:__t.dungeon.modalOpen, campTut:__t.econ.campTut, tent:!!__t.econ.tent, nap:!!__t.econ.hunterNap, missao:__t.campanha().etapa, dlg:!!__t.ISC.dlg})";
const ESPERADO = { modal: false, modalOpen: false, campTut: 3, tent: true, nap: true, missao: "a2_livre", dlg: false };

async function chegar(jogo: Jogo) {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 1;");
  await jogo.js("__t.enterCamp(__h)");
  expect(await esperarAte(jogo, "!!__t.ISC.dlg", 4000), "o Caçador fala").toBe(true);
}

test("pular o tutorial do acampamento pela fala do Caçador", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await chegar(jogo);
  await jogo.esperar(300);
  const bt = await jogo.js<{ vis: boolean; txt: string }>(
    "(()=>{const b=document.getElementById('isc-skip'); return {vis: !!b && getComputedStyle(b).display!=='none', txt: b?b.textContent:''};})()",
  );
  expect(bt.vis, "o botão aparece").toBe(true);
  expect(bt.txt).toContain("Pular tutorial");
  await jogo.page.click("#isc-skip");
  await jogo.esperar(400);
  expect(JSON.parse(await jogo.js<string>(FIM))).toEqual(ESPERADO);
});

test("pular o tutorial pela janela da fogueira (minigame)", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await chegar(jogo);
  await jogo.js("(()=>{const D=__t.ISC.dlg; if(D) D.done && (()=>{})(); })()");
  // passa a fala e abre a fogueira apagada com E
  for (let i = 0; i < 30 && (await jogo.js("!!__t.ISC.dlg")); i++) {
    await jogo.page.mouse.click(683, 300);
    await jogo.esperar(120);
  }
  await jogo.js("(()=>{const d=__t.dungeon, f=__t.CPS.fire; d.px=f.x+18; d.py=f.y+10;})()");
  await jogo.esperar(400);
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, "!!document.querySelector('#fire-modal.open')", 3000), "a fogueira abriu").toBe(true);
  await jogo.page.click("#fire-pular");
  await jogo.esperar(400);
  expect(JSON.parse(await jogo.js<string>(FIM))).toEqual(ESPERADO);
});
