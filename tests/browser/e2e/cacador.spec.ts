/* v7.7 — Caçador animado (esqueleto): em pé no acampamento e dormindo no colchonete. As chamadas de desenho do
   Caçador ficam dentro de try/catch que engolem erros, então o teste confere que a malha dele foi desenhada. */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

/** A malha animada do Caçador (5.513 triângulos) está na lista de desenho deste quadro? */
const CACADOR = "__t.GL3.list.some(x=>x.mesh&&x.mesh.n===16539)";

test("Caçador animado: em pé no acampamento e dormindo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o Caçador animado");
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone = true; __t.enterCamp(__h)"); // o Caçador mora no acampamento depois da intro
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 8000, 250)).toBe(true);
  await jogo.esperar(1200);
  expect(await jogo.js("!!__t.ISC.campNpc"), "Caçador no acampamento").toBe(true);
  // a câmera perto dele
  await jogo.js(
    "(()=>{const d=__t.dungeon,n=__t.ISC.campNpc; d.px=n.x-60; d.py=n.y+20; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(900);
  expect(await jogo.js(CACADOR), "Caçador animado em pé").toBe(true);
  await jogo.foto("cacador_em_pe");
  await jogo.js("__t.econ.hunterNap = true");
  await jogo.esperar(900);
  expect(await jogo.js(CACADOR), "Caçador animado dormindo").toBe(true);
  await jogo.foto("cacador_dormindo");
  await jogo.js("__t.econ.hunterNap = false");
});
