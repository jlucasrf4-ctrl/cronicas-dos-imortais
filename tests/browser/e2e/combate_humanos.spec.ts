/* v8.1 — luta contra humanos sem avisos na tela (mantenedor 2026-10-31): o bandido não solta anel nem ⚠ ao preparar
   o golpe (a arma brilha no fim do preparo), e caído o acerto é o corpo deitado (não os pés). */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

test("bandido: sem anel no preparo; caído, o corpo deitado é a área de acerto", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem os bandidos");
  test.setTimeout(180000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "(()=>{__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0; const h=__h; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 5000)).toBe(true);
  await jogo.esperar(2500);
  await jogo.js("document.getElementById('perigo')?.classList.remove('on'); __t.dungeon.modalOpen = false");
  // um bandido encapuzado bem perto, já com a vez de atacar
  await jogo.js(`(()=>{const d=__t.dungeon; d.monsters=d.monsters.filter(m=>!m.bandido); d.px += 6*d.tile; d.py += 4*d.tile;
    __t.bandoChega(1, 0, 1.2); const b=d.monsters.find(m=>m.bandido); b.bandido='capuz'; b.bVez=true; b.pcd=0; b.bEspera=9;
    window.__b=b; d.target=b; d.foco=b;})()`);
  expect(await esperarAte(jogo, "__b.st==='windup'", 12000), "ele prepara um golpe").toBe(true);
  const aneis = await jogo.js<number>("(__t.dungeon.rings||[]).length");
  expect(aneis, "nenhum anel de aviso no preparo").toBe(0);
  await jogo.foto("h1-preparo");
  // derrubado: o corpo deitado vai longe dos pés, e um golpe no meio do corpo deitado acerta
  await jogo.js("__b.ko = 30; __b.downT = 30; __b.st='recover'; __b.t=30;");
  expect(await esperarAte(jogo, "!!__b.corpoCaido", 3000), "mediu o corpo caído").toBe(true);
  const corpo = await jogo.js<number[]>("__b.corpoCaido");
  const comprimento = Math.hypot(corpo[2] - corpo[0], corpo[3] - corpo[1]);
  expect(comprimento, "o corpo deitado tem tamanho de gente").toBeGreaterThan(30);
  const B = await jogo.js<{ ax: number; ay: number; bx: number; by: number; r: number }>("__t.wolfBody(__b)");
  expect(Math.hypot(B.bx - __pe(B).x, B.by - __pe(B).y), "a cápsula vai até a cabeça").toBeGreaterThan(20);
  await jogo.foto("h2-caido");
});

// os pés: o começo da cápsula (perto da posição do bandido)
function __pe(B: { ax: number; ay: number }) {
  return { x: B.ax, y: B.ay };
}
