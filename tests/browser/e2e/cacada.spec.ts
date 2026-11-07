/* v7.7 — fluxo de caça (map/cacada.ts): na caça automática de cervo, a heroína alcança a presa e o aviso aparece;
   v8.1: clicar nele mergulha no campo (ignorado, a caça segue automática); a presa nasce longe, marcada como foco,
   com cronômetro. Derrubou: ao sair, a caça segue (rendimento normal) e o cervo do mapa morre. O tempo acabou: a presa
   corre para a borda e foge, a heroína volta sozinha e o resto da caça fica fraco. Esc no aviso: segue automática. */
import { test, expect, entrarComHeroi, esperarAte, type Jogo } from "./comum.ts";

/** Heroína caçando cervo no mapa, com um cervo encostado nela (o laço do jogo faz o resto). */
async function cacandoCervo(jogo: Jogo) {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  return jogo.js<boolean>(
    `(()=>{__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0;
      const h=__h, a=__t.world.animals.find(o=>o.species==='deer' && o.alive!==false);
      if(!a) return false;
      window.__cervo=a; a.x=h.x+4; a.y=h.y+2;
      h.huntSpecies='deer'; h.state='hunting'; h.huntTimer=0; h.targetEntity=null; h.localTarget=null;
      h.task={x:h.x,y:h.y,ox:h.x,oy:h.y,r:60,targetSpecies:'deer',killsWanted:99999,killsDone:0,maxMin:600,field:true};
      return true;})()`,
  );
}
const presa = "__t.dungeon.monsters.find(m=>m.cacada)";

test("caçada: achou o cervo, entra no campo; o tempo acaba e ele foge pela borda", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o fluxo de caça");
  test.setTimeout(120_000);
  expect(await cacandoCervo(jogo), "há um cervo no mapa").toBe(true);
  expect(await esperarAte(jogo, "document.getElementById('cacada-aviso')?.classList.contains('on')", 8000, 50)).toBe(
    true,
  );
  expect(await jogo.js("__h.task.cacada")).toBe("aviso");
  await jogo.foto("1_aviso");
  await jogo.js("document.getElementById('cacada-aviso').click()");
  expect(await esperarAte(jogo, "__t.dungeon.active", 8000, 100), "o clique no aviso entra no campo").toBe(true);
  expect(await jogo.js("__t.dungeon.mode")).toBe("campo");
  expect(await esperarAte(jogo, "!!" + presa, 3000, 50), "a presa está no campo").toBe(true);
  const ini = await jogo.js<{ dist: number; foco: boolean; hud: string }>(
    `(()=>{const d=__t.dungeon, m=${presa}; return {dist:Math.hypot(m.x-d.px,m.y-d.py)/d.tile, foco:d.foco===m, hud:document.getElementById('cacada-hud').textContent};})()`,
  );
  expect(ini.dist, "nasce longe (critSpawn já evita 6 tiles; CACADA.distIni pede 9)").toBeGreaterThan(5.9);
  expect(ini.foco, "marcada como foco").toBe(true);
  expect(ini.hud).toMatch(/Cervo · (1:00|0:5\d)/);
  await jogo.esperar(1500);
  await jogo.foto("2_campo");

  // v8.0 — rastro (field/rastro.ts): nasce longe; as pegadas vão até a presa (ou há fezes: chegar nelas revela)
  expect(ini.dist, "no campo aberto, bem longe (CACADA.longe)").toBeGreaterThan(14);
  const fezes = await jogo.js<number>("(__t.dungeon.fezes||[]).length");
  if (fezes) {
    await jogo.js("(()=>{const d=__t.dungeon, f=d.fezes[0]; d.px=f.x; d.py=f.y;})()");
    await jogo.esperar(300);
  }
  const r0 = await jogo.js<{ n: number; fim: number }>(
    `(()=>{const d=__t.dungeon, m=${presa}, L=d.pegadas, T=d.tile;
      return {n:L.length, fim:Math.hypot(L[L.length-1].x-m.x,L[L.length-1].y-m.y)/T};})()`,
  );
  expect(r0.n, "há pegadas" + (fezes ? " (reveladas pelas fezes)" : "")).toBeGreaterThan(3);
  expect(r0.fim, "e chegam na presa").toBeLessThan(1.5);
  if (fezes) expect(await jogo.js<number>("__t.profLv(__h,'rastreio')"), "achar fezes treina Rastreio").toBe(1);
  await jogo.js(`(()=>{const m=${presa}, T=__t.dungeon.tile; m.x+=3*T; m.st='graze'; m.tgt=null; m.t=99;})()`);
  await jogo.esperar(300);
  expect(await jogo.js<number>("__t.dungeon.pegadas.length"), "andou: pegada nova").toBeGreaterThan(r0.n);
  // longe, fora da tela: a seta na borda aponta para ela
  await jogo.js(`(()=>{const d=__t.dungeon, m=${presa}, T=d.tile; m.x=d.px+16*T; m.y=d.py-4*T;})()`);
  await jogo.esperar(400);
  await jogo.foto("2b_seta");

  // o tempo acaba: ela corre para a borda (posta perto dela para o teste não demorar)
  await jogo.js(`(()=>{const m=${presa}, T=__t.dungeon.tile; m.x=T*2.2; m.cacFuga=true; m.st='flee';})()`);
  expect(await esperarAte(jogo, `!(${presa})`, 6000, 50), "saiu pela borda").toBe(true);
  expect(await jogo.js<string>("document.getElementById('cacada-hud').textContent")).toMatch(/fugiu/);
  await jogo.foto("3_fugiu");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 8000, 100), "volta sozinha ao mapa").toBe(true);
  await jogo.esperar(300);
  const fim = await jogo.js<{ st: string; c: string; fraca: boolean; vivo: boolean }>(
    "({st:__h.state, c:__h.task&&__h.task.cacada, fraca:!!(__h.task&&__h.task.fraca), vivo:__cervo.alive!==false})",
  );
  expect(fim).toEqual({ st: "hunting", c: "fugiu", fraca: true, vivo: true });
  await jogo.foto("4_mapa");
});

test("caçada: derrubou o cervo; ao sair a caça segue normal e o cervo do mapa morre", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o fluxo de caça");
  test.setTimeout(120_000);
  expect(await cacandoCervo(jogo)).toBe(true);
  expect(await esperarAte(jogo, "document.getElementById('cacada-aviso')?.classList.contains('on')", 8000, 50)).toBe(
    true,
  );
  await jogo.js("document.getElementById('cacada-aviso').click()");
  expect(await esperarAte(jogo, "__t.dungeon.active", 12000, 100)).toBe(true);
  expect(await esperarAte(jogo, "!!" + presa, 3000, 50)).toBe(true);
  await jogo.js(
    `(()=>{const m=${presa}; __t.hurtMonster(m, 999, 'arco', 0, true); /* sangramento: um tiro só não mata (CRIT_SP.tiroMax) */})()`,
  );
  expect(
    await esperarAte(jogo, "/abatido/.test(document.getElementById('cacada-hud').textContent)", 3000, 50),
    "o cronômetro vira 'abatido'",
  ).toBe(true);
  expect(await jogo.js<number>("__t.dungeon.loot.filter(l=>l.key==='carne').length"), "a carne caiu").toBeGreaterThan(
    0,
  );
  await jogo.foto("1_abatido");
  await jogo.esperar(1500);
  await jogo.js("__t.sairDoCampo()");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 6000, 100)).toBe(true);
  await jogo.esperar(300);
  const fim = await jogo.js<{ st: string; c: string; fraca: boolean; n: number; vivo: boolean }>(
    "({st:__h.state, c:__h.task.cacada, fraca:!!__h.task.fraca, n:__h.task.killsDone, vivo:__cervo.alive!==false})",
  );
  expect(fim).toEqual({ st: "hunting", c: "ok", fraca: false, n: 1, vivo: false });
});

test("caçada: Esc no aviso deixa a caça automática", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o fluxo de caça");
  expect(await cacandoCervo(jogo)).toBe(true);
  expect(await esperarAte(jogo, "document.getElementById('cacada-aviso')?.classList.contains('on')", 8000, 50)).toBe(
    true,
  );
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(4500);
  expect(await jogo.js("__t.dungeon.active"), "não entrou").toBe(false);
  expect(await jogo.js("__h.task && __h.task.cacada")).toBe("auto");
  expect(await jogo.js("document.getElementById('cacada-aviso').classList.contains('on')")).toBe(false);
});

test("caçada: ignorado, o aviso some e ela segue caçando sozinha (v8.1: o jogo não puxa)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 mergulhava sozinha");
  expect(await cacandoCervo(jogo)).toBe(true);
  expect(await esperarAte(jogo, "document.getElementById('cacada-aviso')?.classList.contains('on')", 8000, 50)).toBe(
    true,
  );
  expect(
    await esperarAte(jogo, "!document.getElementById('cacada-aviso').classList.contains('on')", 9000, 100),
    "o aviso some",
  ).toBe(true);
  expect(await jogo.js("__t.dungeon.active"), "não entrou").toBe(false);
  expect(await jogo.js("__h.task && __h.task.cacada")).toBe("auto");
});
