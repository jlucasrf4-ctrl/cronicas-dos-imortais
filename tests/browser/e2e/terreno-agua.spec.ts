/* v8.0 — o relevo do chão e a lâmina d'água do campo aberto (render/gl/relevo.ts, agua.ts, mundo_cena.ts): na beira
   d'água ao meio-dia, de cima e de perto (a câmera de perto olhando para a água atrás dela). */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

test("terreno e água: beira d'água de cima e de perto", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não liga o campo ao mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0;");
  expect(await esperarAte(jogo, "__t.MAPART.ready", 8000)).toBe(true);
  // terra firme a ~2 casas da água; guarda a direção da água
  const p = await jogo.js<{ x: number; y: number; ax: number; ay: number } | null>(`(()=>{
    const h=__h, e=__t.MUNDO.escala, T=42, A=__t.aguaEm;
    for (let r=0; r<4000; r+=25) for (let a=0;a<6.28;a+=0.2){
      const x=h.camp.x+Math.cos(a)*r, y=h.camp.y+Math.sin(a)*r;
      if ([0,1,2,3,4,5,6,7].some(q=>A(x+Math.cos(q*0.785)*T*e, y+Math.sin(q*0.785)*T*e))) continue;
      for (let b=0;b<6.28;b+=0.1) if (A(x+Math.cos(b)*2.2*T*e, y+Math.sin(b)*2.2*T*e)) return {x,y,ax:Math.cos(b),ay:Math.sin(b)};
    }
    return null;})()`);
  expect(p, "achou a beira d'água").not.toBeNull();
  await jogo.js(
    `(()=>{const h=__h, w=__t.world; w.tick=Math.floor(w.tick/1440)*1440+12*60; w.paused=true; h.x=${p!.x}; h.y=${p!.y}; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()`,
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 4000)).toBe(true);
  await jogo.js("(()=>{const d=__t.dungeon; d.monsters.length=0; d.flow='x'; d.banner=null;})()");
  await jogo.esperar(2500);
  await jogo.foto("beira_cima");
  // de costas para a água: a câmera de perto fica na frente dela e vê a água atrás
  await jogo.js(`__t.GL3.hyaw = Math.atan2(${-p!.ay}, ${-p!.ax})`);
  const caixa = await jogo.page.locator("#dungeon-view").boundingBox();
  await jogo.page.mouse.move(caixa!.x + caixa!.width / 2, caixa!.y + caixa!.height / 2);
  for (let i = 0; i < 8; i++) {
    await jogo.page.mouse.wheel(0, -100);
    await jogo.esperar(120);
  }
  await jogo.esperar(2500);
  await jogo.foto("beira_perto");
  expect(jogo.erros, "sem erros no console").toEqual([]);
});
