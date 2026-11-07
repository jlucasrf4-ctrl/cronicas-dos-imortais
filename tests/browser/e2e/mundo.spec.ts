/* v8.0 — mundo ligado, passo 1 (map/mundo.ts): o campo aberto pelo mapa é o pedaço do mapa em volta da heroína. Ela
   aparece no meio; andar no campo move a heroína no mapa na hora; sair a devolve onde ela está agora. O acampamento
   continua arena solta. */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

test("campo = pedaço do mapa: aparece no meio, anda no mapa junto e sai onde está", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não liga o campo ao mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  // como map/transicao.ts entra: JOGO.pending + a posição dela no mapa, heroína parada
  const p0 = await jogo.js<{ x: number; y: number }>(
    "(()=>{__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0; const h=__h; h.x+=60; h.y-=40; const p={x:h.x,y:h.y}; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true); return p;})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.mode==='campo'", 4000)).toBe(true);
  // no meio (a menos de uma casa: o canto da janela fica na grade de casas do mundo)
  const meio = await jogo.js<number[]>(
    "(()=>{const d=__t.dungeon; return [Math.abs(d.px-d.cols*d.tile/2)/d.tile, Math.abs(d.py-d.rows*d.tile/2)/d.tile, !!d.origem];})()",
  );
  expect(meio[0], "no meio do campo").toBeLessThan(1);
  expect(meio[1]).toBeLessThan(1);
  expect(meio[2], "com origem").toBe(true);

  // anda 5 casas para a direita e 3 para cima: no mapa ela vai junto (para a direita e para cima)
  await jogo.js("(()=>{const d=__t.dungeon; d.px+=5*d.tile; d.py-=3*d.tile;})()");
  await jogo.esperar(400);
  const p1 = await jogo.js<{ x: number; y: number }>("({x:__h.x, y:__h.y})");
  expect(p1.x - p0.x, "andou para a direita no mapa").toBeGreaterThan(20);
  expect(p0.y - p1.y, "andou para cima no mapa").toBeGreaterThan(12);
  expect((p1.x - p0.x) / (p0.y - p1.y), "na mesma proporção do campo").toBeCloseTo(5 / 3, 1);
  await jogo.foto("campo");

  // sai: volta ao mapa onde está agora (não onde entrou)
  await jogo.js("__t.exitDungeon()");
  expect(await esperarAte(jogo, "!__t.dungeon.active && __h.state==='field'", 4000)).toBe(true);
  await jogo.esperar(400);
  const p2 = await jogo.js<{ x: number; y: number }>("({x:__h.x, y:__h.y})");
  expect(Math.hypot(p2.x - p1.x, p2.y - p1.y), "saiu onde estava no campo").toBeLessThan(2);
});

test("campo aberto: a janela desliza sem perder o lugar; a água do mapa barra", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não liga o campo ao mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0;");
  expect(await esperarAte(jogo, "__t.MAPART.ready", 8000)).toBe(true);
  // um ponto de terra com água a menos de 2 casas para a direita (beira de rio, lago ou mar), perto do acampamento
  const p = await jogo.js<{ x: number; y: number } | null>(`(()=>{
    const h=__h, e=__t.MUNDO.escala, T=42;
    for (let r=20; r<900; r+=10) for (let a=0;a<6.28;a+=0.15){
      const x=h.x+Math.cos(a)*r, y=h.y+Math.sin(a)*r;
      if (__t.aguaEm(x,y) || __t.aguaEm(x-T*e,y) || __t.aguaEm(x,y-T*e) || __t.aguaEm(x,y+T*e)) continue;
      if (__t.arvoresEm(x-2*T*e,y-2*T*e,x+3*T*e,y+2*T*e).length) continue;
      if (__t.aguaEm(x+1.6*T*e,y) && __t.aguaEm(x+2.4*T*e,y)) return {x,y};
    }
    return null;})()`);
  expect(p, "achou uma beira d'água").not.toBeNull();
  await jogo.js(
    `(()=>{const h=__h; h.x=${p!.x}; h.y=${p!.y}; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()`,
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 4000)).toBe(true);
  await jogo.esperar(1500);

  // andando para a direita (D) ela para na água: não passa de 2,4 casas
  const x0 = await jogo.js<number>("__t.dungeon.px");
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(3500);
  await jogo.page.keyboard.up("KeyD");
  const andou = await jogo.js<number>(`(__t.dungeon.px - ${x0}) / __t.dungeon.tile`);
  expect(andou, "andou até a beira").toBeGreaterThan(0.5);
  expect(andou, "não entrou na água").toBeLessThan(2.4);
  expect(await jogo.js(`__t.aguaEm(__h.x, __h.y)`), "no mapa ela está em terra").toBe(false);
  await jogo.foto("beira");

  // 12 casas para cima de uma vez: a janela desliza (ela volta ao meio) e o mapa continua no lugar certo
  const antes = await jogo.js<{ ox: number; oy: number; hx: number; hy: number }>(
    "({ox:__t.dungeon.origem.x, oy:__t.dungeon.origem.y, hx:__h.x, hy:__h.y})",
  );
  await jogo.js("(()=>{const d=__t.dungeon; d.py -= 12*d.tile;})()");
  await jogo.esperar(500);
  const depois = await jogo.js<{ ox: number; oy: number; hx: number; hy: number; meio: number }>(
    "(()=>{const d=__t.dungeon; return {ox:d.origem.x, oy:d.origem.y, hx:__h.x, hy:__h.y, meio:Math.abs(d.py-d.rows*d.tile/2)/d.tile};})()",
  );
  const e = await jogo.js<number>("__t.MUNDO.escala*42");
  expect(depois.oy, "a janela deslizou para cima").toBeLessThan(antes.oy - 6 * e);
  expect(depois.meio, "ela voltou para o meio da janela").toBeLessThan(1);
  expect(antes.hy - depois.hy, "no mapa ela subiu 12 casas").toBeCloseTo(12 * e, 0);
  expect(Math.abs(depois.hx - antes.hx), "e não andou para o lado").toBeLessThan(0.5);
  await jogo.foto("deslizou");
});

test("bichos do mapa são os do campo: entram onde estão, andam no mapa junto, morrem no mapa", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não liga o campo ao mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0;");
  expect(await esperarAte(jogo, "__t.MAPART.ready", 8000)).toBe(true);
  // um coelho no mapa a 5 casas dela, em terra
  const ok = await jogo.js<boolean>(`(()=>{
    const h=__h, e=__t.MUNDO.escala*42;
    for (let a=0;a<6.28;a+=0.4){ const x=h.x+Math.cos(a)*5*e, y=h.y+Math.sin(a)*5*e;
      if (__t.aguaEm(x,y)) continue; window.__coelho=__t.spawnAnimal('rabbit',x,y,1); return true; }
    return false;})()`);
  expect(ok, "achou terra para o coelho").toBe(true);
  await jogo.js(
    "(()=>{const h=__h; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 4000)).toBe(true);
  expect(
    await esperarAte(jogo, "__t.dungeon.monsters.some(m=>m.bichoMapa===window.__coelho)", 3000),
    "o coelho do mapa entrou no campo",
  ).toBe(true);
  // no campo, onde está no mapa (menos de meia casa de diferença)
  const dif =
    await jogo.js<number>(`(()=>{const d=__t.dungeon, m=d.monsters.find(m=>m.bichoMapa===window.__coelho), c=window.__coelho, e=__t.MUNDO.escala;
    return Math.hypot(d.origem.x+m.x*e-c.x, d.origem.y+m.y*e-c.y)/(e*42);})()`);
  expect(dif, "no mesmo lugar").toBeLessThan(0.5);
  expect(await jogo.js("__t.BICHOS.presos.has(window.__coelho)"), "o mapa não o move").toBe(true);

  // anda 3 casas no campo: no mapa ele vai junto
  const antes = await jogo.js<number>("window.__coelho.x");
  await jogo.js(
    "(()=>{const d=__t.dungeon, m=d.monsters.find(m=>m.bichoMapa===window.__coelho); m.x+=3*d.tile; m.st='graze'; m.tgt=null; m.t=99;})()",
  );
  await jogo.esperar(300);
  const andou = await jogo.js<number>(`(window.__coelho.x - ${antes}) / (__t.MUNDO.escala*42)`);
  expect(andou, "no mapa andou junto").toBeGreaterThan(2);

  // derrubado no campo: morre no mapa
  await jogo.js(
    "(()=>{const d=__t.dungeon, m=d.monsters.find(m=>m.bichoMapa===window.__coelho); m.hp=0; m.alive=false; d.monsters=d.monsters.filter(o=>o!==m);})()",
  );
  expect(await esperarAte(jogo, "window.__coelho.alive===false", 2000), "morreu no mapa").toBe(true);

  // ao sair, ninguém fica preso
  await jogo.js("__t.exitDungeon()");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 4000)).toBe(true);
  expect(await jogo.js("__t.BICHOS.presos.size")).toBe(0);
});

test("javali do mapa entra no campo aberto como o javali da investida e morre no mapa", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não liga o campo ao mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0;");
  expect(await esperarAte(jogo, "__t.MAPART.ready", 8000)).toBe(true);
  const ok = await jogo.js<boolean>(`(()=>{
    const h=__h, e=__t.MUNDO.escala*42;
    for (let a=0;a<6.28;a+=0.4){ const x=h.x+Math.cos(a)*7*e, y=h.y+Math.sin(a)*7*e;
      if (__t.aguaEm(x,y)) continue; window.__javali=__t.spawnAnimal('boar',x,y,3); return true; }
    return false;})()`);
  expect(ok, "achou terra para o javali").toBe(true);
  await jogo.js(
    "(()=>{const h=__h; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 4000)).toBe(true);
  expect(
    await esperarAte(jogo, "__t.dungeon.monsters.some(m=>m.bichoMapa===window.__javali)", 3000),
    "o javali do mapa entrou no campo",
  ).toBe(true);
  const m = await jogo.js<{ kind: string; name: string }>(
    "(()=>{const m=__t.dungeon.monsters.find(m=>m.bichoMapa===window.__javali); return {kind:m.kind, name:m.name};})()",
  );
  expect(m, "é o javali da investida").toEqual({ kind: "javalino", name: "Javali" });
  await jogo.foto("javali_campo");
  await jogo.js(
    "(()=>{const d=__t.dungeon, m=d.monsters.find(m=>m.bichoMapa===window.__javali); m.hp=0; m.alive=false; d.monsters=d.monsters.filter(o=>o!==m);})()",
  );
  expect(await esperarAte(jogo, "window.__javali.alive===false", 2000), "morreu no mapa").toBe(true);
});

test("fim da cena inicial: campo ao sul da base, itens e o lobo no caminho, entra pela fogueira", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a caminhada");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=1; __t.CAMPO_VIDA.loboChance=0; __t.econ.quiver.n=3;",
  );
  expect(await esperarAte(jogo, "__t.MAPART.ready", 8000)).toBe(true);
  expect(await jogo.js("__t.caminhadaIni(__h)"), "começou").toBe(true);
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 4000), "já no campo aberto").toBe(true);
  // ao sul da base, longe dela
  const ini = await jogo.js<number[]>("[__h.x-__h.camp.x, __h.y-__h.camp.y]");
  expect(ini[1], "ao sul").toBeGreaterThan(60);
  expect(
    await esperarAte(jogo, "document.getElementById('isc-obj')?.classList.contains('on')", 3000),
    "o objetivo aponta a base",
  ).toBe(true);
  expect(
    await esperarAte(jogo, "getComputedStyle(document.getElementById('zoom-veu')).opacity==='0'", 5000),
    "a tela clareou",
  ).toBe(true);
  await jogo.foto("caminhada");

  // anda para o norte de 4 em 4 casas: os itens do caminho aparecem no chão
  for (let i = 0; i < 4; i++) {
    await jogo.js("(()=>{const d=__t.dungeon; d.py -= 4*d.tile;})()");
    await jogo.esperar(250);
  }
  expect(
    await jogo.js<number>("__t.dungeon.loot.filter(l=>l.key==='flecha'||l.key==='carne_assada').length"),
    "flechas e comida no chão",
  ).toBeGreaterThan(0);
  // pega uma flecha: vai para a aljava
  const q0 = await jogo.js<number>("__t.econ.quiver.n");
  await jogo.js("(()=>{const d=__t.dungeon, l=d.loot.find(l=>l.key==='flecha'); if(l) __t.collectLoot(l);})()");
  expect(await jogo.js<number>("__t.econ.quiver.n"), "a flecha foi para a aljava").toBe(q0 + 1);
  // v8.1: no meio do caminho um lobo passa a segui-la
  expect(
    await esperarAte(jogo, "__t.dungeon.monsters.some(m=>m.alive && /Lobo/.test(m.name||''))", 3000),
    "o lobo do caminho",
  ).toBe(true);

  // v8.1: perto da base o acampamento está no campo aberto; chegando à fogueira ela entra, sem subir ao mapa
  await jogo.js(`(()=>{const d=__t.dungeon, h=__h, e=__t.MUNDO.escala;
    d.px = (h.camp.x - d.origem.x)/e; d.py = (h.camp.y + 7*d.tile*e - d.origem.y)/e;})()`);
  await jogo.esperar(400);
  await jogo.foto("caminhada_acampamento");
  await jogo.js(`(()=>{const d=__t.dungeon, h=__h, e=__t.MUNDO.escala;
    d.px = (h.camp.x - d.origem.x)/e; d.py = (h.camp.y + 10 - d.origem.y)/e;})()`);
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 5000), "entrou no acampamento").toBe(true);
  expect(await jogo.js("__t.dungeon.origem"), "a cena do acampamento").toBeNull();
});

test("acampamento continua arena solta (sem origem no mapa)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não liga o campo ao mapa");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.enterCamp(__h)");
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 4000)).toBe(true);
  expect(await jogo.js("__t.dungeon.origem")).toBeNull();
});
