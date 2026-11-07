/* v8.0 — a fogueira acesa ilumina em volta à noite (FOGO_LUZ em data/mapa.ts, luzFogueira em render/luz_do_dia.ts) e
   as chamas não escurecem com a noite. Fotos: noite (com e sem a luz), poente e dia, para o mantenedor aprovar. */
import { test, expect, entrarComHeroi, esperarAte, passarDialogo } from "./comum.ts";
import type { Jogo } from "./comum.ts";

const DIA = 1440;

async function hora(jogo: Jogo, h: number) {
  await jogo.js(`(()=>{const w=__t.world; w.tick=Math.floor(w.tick/${DIA})*${DIA}+${h * 60}; w.paused=true;})()`);
  await jogo.esperar(500);
}

test("fogueira do acampamento ilumina à noite", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v8.0");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 3; __t.econ.tent = true; __t.enterCamp(__h)",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 8000, 250)).toBe(true);
  await jogo.esperar(1000);
  await passarDialogo(jogo);
  await jogo.js("(()=>{const d=__t.dungeon,F=__t.CPS.fire; d.px=F.x+70; d.py=F.y+40;})()");

  await hora(jogo, 23);
  expect(await jogo.js<number>("__t.GL3.fogos.length"), "a fogueira registrou a luz").toBeGreaterThan(0);
  await jogo.foto("noite");
  const forca = await jogo.js<number>("__t.FOGO_LUZ.noite");
  await jogo.js("__t.FOGO_LUZ.noite = 0");
  await jogo.esperar(300);
  await jogo.foto("noite_sem_luz");
  await jogo.js(`__t.FOGO_LUZ.noite = ${forca}`);
  await hora(jogo, 19);
  await jogo.foto("poente");
  await hora(jogo, 12);
  await jogo.foto("dia");
});
