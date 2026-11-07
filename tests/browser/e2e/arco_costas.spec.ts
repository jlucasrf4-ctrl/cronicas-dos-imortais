/* v8.0 — as peças presas encostam no corpo de quem a heroína veste (encosto em animado.ts; mantenedor 2026-10-25:
   "o arco não fica no corpo, flutua perto dele", "aplique em tudo que flutuar"): o arco e o escudo guardados nas costas
   e o escudo no antebraço. Fotos de dia, de costas e de lado, com a heroína, a líder dos bandidos (a que mais
   flutuava), o bandido bruto (as peças entravam nele) e uma deusa. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("peças presas: encostadas no corpo, para cada aparência", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a heroína animada");
  test.setTimeout(120_000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; __t.world.tick=24*60+12*60; __t.D3.ZM=4.2; window.dispatchEvent(new Event('resize'));" +
      "const e=__t.ensureEquip(d.hero); for (const [s,k] of [['maoD','eq_espada'],['maoE','eq_escudo'],['costas','eq_arco']]) { const it=__t.mkItem(k); __t.eqDurInit(it); e[s]=it; } __t.GL3.heroKey='';})()",
  );
  for (const nome of [null, "lider_bandidos", "bandido_bruto", "deusa_outono"]) {
    const rot = nome ?? "heroina";
    await jogo.js(`(()=>{__t.vestir(null); ${nome ? `__t.vestir('${nome}');` : ""} __t.GL3.heroKey='';})()`);
    // espada e escudo, de costas (arco nas costas) e de lado (escudo no braço, virado para a câmera)
    await jogo.js("(()=>{const d=__t.dungeon; d.weapon='melee'; d.mouse={x:441,y:150};})()");
    await jogo.esperar(500);
    await jogo.foto("costas_" + rot);
    await jogo.js("(()=>{const d=__t.dungeon; d.mouse={x:641,y:273};})()");
    await jogo.esperar(500);
    await jogo.foto("braco_" + rot);
    // arco na mão: o escudo vai para as costas
    await jogo.js("(()=>{const d=__t.dungeon; d.weapon='bow'; d.mouse={x:441,y:150};})()");
    await jogo.esperar(500);
    await jogo.foto("escudo_costas_" + rot);
  }
  expect(jogo.erros, "sem erros no console").toEqual([]);
});
