/* v7.7 — documento mestre, bloco 1: alvo prioritário (laranja, automático) × foco (branco, clique esquerdo), troca automática do alvo,
   rastreio (nó Rastreador, field/rastreio.ts), fôlego que zera e a ginga de 20%. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

/** Campo limpo, herói no meio, arma corpo a corpo; `n` lobos parados (st recover) perto do herói. */
const PREPARO = (n: number) =>
  "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.birdQ=[]; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; d.weapon='melee'; d.target=null; d.foco=null; for(let i=0;i<" +
  n +
  ";i++){__t.spawnDungeonMonster({}); const m=d.monsters[i]; m.x=d.px+60+i*40; m.y=d.py+40; m.st='recover'; m.t=99; m.hp=m.hpMax=999;}})()";

test("clique esquerdo marca o foco (sem trava de mira, sem desligar no 2º clique); Esc tira; cliques não criam bichos", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem o foco");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(PREPARO(2));
  await jogo.esperar(300);
  const box = await jogo.caixa("#dungeon-canvas");
  const mx = box.x + box.width * 0.62,
    my = box.y + box.height * 0.5;
  await jogo.page.mouse.move(mx, my);
  await jogo.esperar(100);
  // arco (o clique esquerdo não golpeia): o lobo 1 vai para baixo do cursor; o lobo 0 já é o alvo prioritário
  await jogo.js(
    "(()=>{const d=__t.dungeon, m=d.monsters[1]; d.weapon='bow'; m.x=d.mouse.x; m.y=d.mouse.y; m.st='recover'; m.t=99; d.target=d.monsters[0];})()",
  );
  await jogo.page.mouse.click(mx, my);
  await jogo.esperar(100);
  const r = await jogo.js<{ foco: boolean; alvo: boolean; hp: number; n: number }>(
    "(()=>{const d=__t.dungeon; return {foco:d.foco===d.monsters[1], alvo:d.target===d.monsters[0], hp:d.monsters[1].hp, n:d.monsters.length};})()",
  );
  expect(r.foco, "o lobo sob o cursor virou o foco").toBe(true);
  expect(r.alvo, "com alvo vivo, o alvo prioritário não mudou").toBe(true);
  expect(r.hp, "marcar o foco não feriu").toBe(999);
  expect(r.n, "nenhum bicho a mais").toBe(2);
  await jogo.foto("alvo_e_foco");
  // 2º clique no mesmo bicho: o foco continua
  await jogo.page.mouse.click(mx, my);
  await jogo.esperar(80);
  expect(await jogo.js("__t.dungeon.foco===__t.dungeon.monsters[1]"), "o 2º clique não desliga").toBe(true);
  // sem trava de mira: a mira segue o mouse, não o foco
  const mira = await jogo.js<number>(
    "(()=>{const d=__t.dungeon, f=d.monsters[1]; f.x=d.px+30; f.y=d.py; d.mouse={x:d.px, y:d.py+80}; return __t.aimAngle();})()",
  );
  expect(Math.abs(mira - Math.PI / 2), "mira no mouse").toBeLessThan(0.01);
  // Esc tira o foco; o alvo fica
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(50);
  expect(await jogo.js("[__t.dungeon.foco==null, __t.dungeon.target===__t.dungeon.monsters[0]]")).toEqual([true, true]);
  // vários cliques comuns no chão e no bicho: o número de bichos não muda
  for (let i = 0; i < 4; i++) {
    await jogo.page.mouse.click(mx + i * 7, my);
    await jogo.esperar(80);
  }
  expect(await jogo.js<number>("__t.dungeon.monsters.length"), "cliques não criam bichos").toBe(2);
});

test("sem alvo, o foco liga o alvo também; com arma corpo a corpo o clique no bicho marca o foco e golpeia", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem o foco");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(PREPARO(1));
  await jogo.esperar(300);
  const box = await jogo.caixa("#dungeon-canvas");
  const mx = box.x + box.width * 0.55,
    my = box.y + box.height * 0.5;
  await jogo.page.mouse.move(mx, my);
  await jogo.esperar(100);
  await jogo.js(
    "(()=>{const d=__t.dungeon, m=d.monsters[0]; m.x=d.mouse.x; m.y=d.mouse.y; m.st='recover'; m.t=99; d.target=null; d.foco=null; d.cd=0;})()",
  );
  await jogo.page.mouse.click(mx, my);
  await jogo.esperar(60);
  const r = await jogo.js<boolean[]>(
    "(()=>{const d=__t.dungeon, m=d.monsters[0]; return [d.foco===m, d.target===m, (d.cd||0)>0];})()",
  );
  expect(r, "foco, alvo e golpe").toEqual([true, true, true]);
});

test("alvo prioritário automático: o último que você feriu ou que te atacou; o foco não muda", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não troca o alvo sozinha");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(PREPARO(3));
  await jogo.esperar(200);
  const r = await jogo.js<boolean[]>(
    "(()=>{const d=__t.dungeon, [a,b,c]=d.monsters, out=[]; d.target=a; d.foco=c; __t.hurtMonster(b, 5, 'espada', 0); out.push(d.target===b, d.foco===c); __t.hurtPlayer(1, 0, a); out.push(d.target===a, d.foco===c); return out;})()",
  );
  expect(r).toEqual([true, true, true, true]);
});
test("fôlego: o interno zera, a corrida trava até 25% e o footwork custa 20 de fora e 25 do interno", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(PREPARO(0));
  // footwork (ginga): interno 100 → 75, fora 100 → 80 (v8.0: o interno não é mais o teto); com 19 de fora ou 24 do interno não sai
  const g = await jogo.js<number[]>(
    "(()=>{const d=__t.dungeon, h=d.hero; h.equip=h.equip||{}; const e=__t.ensureEquip(h); e.maoE=null; d.gint=100; d.gstam=100; d.dodge=null; d.dodgeCd=0; __t.espacoCorpo(); const a=Math.round(d.gint), b=Math.round(d.gstam); d.dodge=null; d.dodgeCd=0; d.gstam=19; __t.espacoCorpo(); const c=d.dodge?1:0; d.dodge=null; d.dodgeCd=0; d.gint=24; d.gstam=24; __t.espacoCorpo(); return [a, b, c, d.dodge?1:0];})()",
  );
  expect(g).toEqual([75, 80, 0, 0]);
  // fôlego zerado por qualquer motivo trava a corrida até voltar a 25
  await jogo.js("(()=>{const d=__t.dungeon; d.gint=0; d.gstam=0; d.runLock=false; d.gregen=0;})()");
  await jogo.esperar(150);
  expect(await jogo.js("__t.dungeon.runLock"), "zerou = sem corrida").toBe(true);
  await jogo.js("(()=>{const d=__t.dungeon; d.gint=100; d.gstam=26;})()");
  await jogo.esperar(150);
  expect(await jogo.js("__t.dungeon.runLock"), "voltou a 25 = corre de novo").toBe(false);
});

test("rastreio: só com o Rastreador; 4 por perto, cheio recusa, ✕ tira, quem sai do raio sai", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o rastreio");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(PREPARO(6));
  await jogo.esperar(300);
  const linhas = "document.querySelectorAll('#rastreio .rs-l').length";
  const visivel = "(()=>{const e=document.getElementById('rastreio'); return !!e && e.style.display!=='none'})()";
  expect(await jogo.js(visivel), "sem o nó, sem painel").toBe(false);
  // nó Rastreador rank 1 (a genética da Ayla 777 não favorece o nó: confere abaixo)
  const rank = await jogo.js<number>(
    "(()=>{const h=__t.dungeon.hero; h.nodes=h.nodes||{}; h.nodes.rastreador=1; return __t.nodeRank(h,'rastreador');})()",
  );
  await jogo.esperar(400);
  const cap = rank === 2 ? 5 : 4;
  expect(await jogo.js(visivel), "com o nó, painel").toBe(true);
  expect(await jogo.js<number>(linhas), "enche até o limite").toBe(cap);
  await jogo.foto("rastreio");
  // cheio: incluir à mão é recusado (os de agora ficam)
  const fora = await jogo.js<boolean>(
    "(()=>{const d=__t.dungeon, m=d.monsters.find(x=>!__t.RASTRO.lista.includes(x)); __t.rastreioAlternar(m); return !__t.RASTRO.lista.includes(m);})()",
  );
  expect(fora, "cheio recusa").toBe(true);
  // ✕ tira o primeiro (outro bicho por perto pode entrar no lugar; o tirado não volta sozinho)
  await jogo.js("window.__tirado=__t.RASTRO.lista[0]");
  await jogo.page.click("#rastreio .rs-l button");
  await jogo.esperar(300);
  expect(await jogo.js("__t.RASTRO.lista.includes(window.__tirado)"), "o ✕ tirou").toBe(false);
  // quem sai do raio sai da lista
  await jogo.js(
    "(()=>{const d=__t.dungeon; window.__longe=__t.RASTRO.lista.slice(0,2); for(const m of window.__longe){m.x=d.px+d.tile*30; m.y=d.py;}})()",
  );
  await jogo.esperar(300);
  expect(await jogo.js("window.__longe.some(m=>__t.RASTRO.lista.includes(m))"), "saíram do raio").toBe(false);
});
