/* v8.0 — a noite no mapa (desenharCamadaMapa em map/quadro.ts, tabela NOITE_MAPA): de dia o mapa fica limpo, à noite um
   véu azul escurece tudo. Confere o pixel do meio da camada #map-nevoa ao meio-dia, às 18h30 e às 23h. E o campo 3D
   (luzCampo em render/luz_do_dia.ts, uNoite no shader): a cena fica bem mais escura às 23h. */
import sharp from "sharp";
import { test, expect, entrarComHeroi, campoDireto, campoLimpo } from "./comum.ts";

test("mapa: escurece à noite e clareia de dia", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não escurece o mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  // o alfa no meio da tela (sem névoa ali: a heroína está no centro)
  const alfaNa = async (hora: number, foto: string) => {
    await jogo.js(
      `(()=>{const w=__t.world, h=__h, c=__t.camera, vp=document.getElementById('viewport'); w.tick=Math.floor(w.tick/1440)*1440+${hora * 60}; c.tx=vp.clientWidth/2-h.x*c.scale; c.ty=vp.clientHeight/2-h.y*c.scale; __t.applyCameraTransform();})()`,
    );
    await jogo.esperar(300);
    await jogo.foto(foto);
    return jogo.js<number>(
      "(()=>{const cv=document.getElementById('map-nevoa'); return cv.getContext('2d').getImageData(cv.width>>1, cv.height>>1, 1, 1).data[3];})()",
    );
  };
  await jogo.js("__t.econ.introDone = true"); // a camada de cima só aparece depois da cena inicial
  const dia = await alfaNa(12, "meio-dia"),
    poente = await alfaNa(18.5, "poente"),
    noite = await alfaNa(23, "noite");
  expect(dia, "meio-dia: sem véu").toBe(0);
  expect(poente, "18h30: já escurecendo").toBeGreaterThan(30);
  expect(noite, "23h: noite fechada").toBeGreaterThan(poente);
});

test("campo: a cena 3D escurece à noite", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não escurece o campo");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await campoLimpo(jogo);
  // brilho médio do meio da tela (sharp lê a foto; o canvas WebGL não guarda o quadro para ler de dentro)
  const brilhoAs = async (hora: number, foto: string) => {
    await jogo.js(`(()=>{const w=__t.world; w.tick=Math.floor(w.tick/1440)*1440+${hora * 60};})()`);
    await jogo.esperar(400);
    await jogo.foto(foto);
    const png = await jogo.page.screenshot({ clip: { x: 400, y: 250, width: 500, height: 300 } }),
      { channels } = await sharp(png).stats();
    return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
  };
  const dia = await brilhoAs(12, "campo-dia"),
    noite = await brilhoAs(23, "campo-noite");
  expect(noite, "23h: bem mais escuro que ao meio-dia").toBeLessThan(dia * 0.75);
});
