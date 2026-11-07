/* v8.0 — as armas desenhadas (render/gl/armas3d.ts, de tools/gerar-armas.ts; mantenedor 2026-10-25: "o modelo das
   armas melee estão bem feios"): cada arma na mão da heroína animada, o arco puxando (corda das pontas do arco novo)
   e o escudo no braço. Fotos de dia, de perto. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("armas desenhadas: cada uma na mão, arco e escudo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem as armas desenhadas");
  test.setTimeout(120_000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:641,y:300}; __t.world.tick=24*60+12*60; __t.D3.ZM=4.2; window.dispatchEvent(new Event('resize'));})()",
  );
  const equipar = (slot: string, k: string) =>
    `(()=>{const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('${k}'); __t.eqDurInit(it); e.${slot}=it; __t.GL3.heroKey='';})()`;
  for (const k of [
    "eq_espada",
    "eq_espada_longa",
    "eq_machado",
    "eq_clava",
    "eq_lanca",
    "eq_lanca_madeira",
    "eq_faca_velha",
    "eq_faca_simples",
    "eq_faca",
  ]) {
    await jogo.js(equipar("maoD", k) + ";__t.dungeon.weapon='melee'");
    await jogo.esperar(400);
    expect(await jogo.js(`!!__t.GL3.mesh['a3_${k}']`), k + " desenhada").toBe(true);
    await jogo.foto("arma_" + k);
  }
  // escudo no braço (com a espada)
  await jogo.js(equipar("maoD", "eq_espada") + ";" + equipar("maoE", "eq_escudo"));
  await jogo.esperar(400);
  await jogo.foto("arma_escudo");
  // arcos puxando
  for (const k of ["eq_arco", "eq_arco_longo"]) {
    await jogo.js(equipar("costas", k) + ";(()=>{const d=__t.dungeon; d.weapon='bow'; __t.startCharge();})()");
    await jogo.esperar(700);
    await jogo.foto("arma_" + k);
    await jogo.js("__t.fireArrow()");
    await jogo.esperar(500);
  }
  expect(jogo.erros, "sem erros no console").toEqual([]);
});
