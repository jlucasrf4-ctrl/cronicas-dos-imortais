/* FPS de um cenário, com e sem contorno e sem o renderizador 3D.
   Uso: node tests/browser/tools/perf/fps.ts [campo|campo-aberto|mapa] [largura] [altura] [--ref]
   Substitui os antigos fpsexp.py, fpsexp2.py, tfps.py e tperf.py. */
import { abrirJogo, args, cenario, medirFps } from "../abrir.ts";

const qual = (args[0] ?? "campo") as "campo" | "campo-aberto" | "mapa";
const largura = Number(args[1] ?? 1366),
  altura = Number(args[2] ?? 860);
const s = await abrirJogo({ largura, altura });
await cenario(s, qual);
console.log(`${qual} ${largura}×${altura}`);
console.log("normal       ", await medirFps(s));
await s.js("__t.OPT.outline=false");
console.log("sem contorno ", await medirFps(s));
await s.js("__t.OPT.outline=true");
if (qual !== "mapa") {
  await s.js("__t.GL3._home=true");
  console.log("sem 3D       ", await medirFps(s));
  await s.js("__t.GL3._home=false");
}
if (qual === "campo-aberto") {
  // tperf: um cervo fugindo perto do herói
  await s.js(
    "(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2; const c=__t.critSpawn('deer'); c.x=d.px+2*T; c.y=d.py; c.sex='M';})()",
  );
  console.log("cervo fugindo", await medirFps(s));
}
await s.browser.close();
