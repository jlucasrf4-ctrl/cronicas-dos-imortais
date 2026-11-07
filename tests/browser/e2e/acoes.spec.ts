/* v7.7 — painel de ações no canto (src/ui/acoes.ts): mostra o que o E faz agora, no lugar do texto que flutuava
   acima do herói e do aviso do acampamento. */
import { test, expect, entrarComHeroi, campoDireto, esperarAte, passarDialogo } from "./comum.ts";

/** Ações do painel como "tecla:texto|detalhe" (detalhe sem HTML). */
const ACOES = "__t.acoesAgora().map(a=>a.tecla+':'+a.texto+(a.detalhe?'|'+a.detalhe.replace(/<[^>]+>/g,''):''))";
const PAINEL =
  "(()=>{const e=document.getElementById('acoes'); return e && e.classList.contains('on') ? e.textContent : ''})()";

test("painel de ações: pegar no campo, qualidade, some na fala, E faz o que o painel diz", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o painel");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2;})()",
  );
  await jogo.esperar(400);
  // galho aos pés
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.loot.push({key:'galho',tier:0,t:0,ttl:0,x:d.px+6,y:d.py,ground:true});})()",
  );
  await jogo.esperar(300);
  const a1 = await jogo.js<string[]>(ACOES);
  expect(a1[0], "primeira ação").toMatch(/^E:Pegar\|Galho/);
  expect(await jogo.js<string>(PAINEL), "painel visível com a ação").toContain("Pegar");
  await jogo.foto("painel_pegar");
  // E pega o galho
  const pegou = await jogo.js<boolean>(
    "(()=>{const d=__t.dungeon,n=d.loot.length; __t.interact(); return d.loot.length===n-1;})()",
  );
  expect(pegou, "E pegou o que o painel mostrava").toBe(true);
  // item com qualidade: o rótulo vai no detalhe
  await jogo.js("(()=>{const d=__t.dungeon; d.loot.push({key:'carne',tier:2,t:0,ttl:0,x:d.px+6,y:d.py});})()");
  await jogo.esperar(300);
  const a2 = await jogo.js<string[]>(ACOES);
  expect(a2[0], "carne SS").toMatch(/^E:Pegar\|.+ SS$/);
  await jogo.foto("painel_qualidade");
  // com uma fala na tela o painel some
  await jogo.js("__t.say([['Teste.']], ()=>{})");
  await jogo.esperar(300);
  expect(await jogo.js<string>(PAINEL), "painel some na fala").toBe("");
  await passarDialogo(jogo);
});

test("E: toque pega direto; segurar abre a mochila com o item na mão; clique arruma", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o segurar E");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const galho =
    "(()=>{const d=__t.dungeon; d.loot.push({key:'galho',tier:0,t:0,ttl:0,x:d.px+6,y:d.py,ground:true});})()";
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.birdQ=[]; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2;})()",
  );
  await jogo.esperar(400);
  // toque: pega e a mochila continua fechada
  await jogo.js(galho);
  await jogo.esperar(250);
  expect((await jogo.js<string[]>(ACOES))[1], "linha do segurar").toBe("E:Segure · arrumar na mochila");
  // toque: apertar e soltar no mesmo instante (sem quadro no meio: com WebGL por software um quadro passa de 0,45 s)
  await jogo.js(
    "(()=>{for(const t of ['keydown','keyup']) window.dispatchEvent(new KeyboardEvent(t,{code:'KeyE',key:'e'}));})()",
  );
  await jogo.esperar(250);
  expect(
    await jogo.js(
      "JSON.stringify({galhos:__t.dungeon.loot.filter(l=>l.key==='galho').length, inv:__t.dungeon.invOpen})",
    ),
    "toque pegou direto",
  ).toBe(JSON.stringify({ galhos: 0, inv: false })); // só o galho: um pássaro pode soltar uma pena por perto
  // segurar: no meio, o círculo enchendo; no fim, a mochila aberta com o galho na mão
  await jogo.js(galho);
  await jogo.esperar(250);
  await jogo.page.keyboard.down("e");
  await jogo.esperar(150);
  expect(await jogo.js("__t.dungeon.invOpen"), "aos 150 ms ainda não abriu").toBe(false);
  await jogo.foto("segurar_meio");
  await jogo.esperar(700);
  expect(await jogo.js("__t.dungeon.invOpen"), "mochila aberta").toBe(true);
  expect(
    await jogo.js(
      "!!__t.invDrag && __t.invDrag.it.def.key==='galho' && __t.dungeon.loot.filter(l=>l.key==='galho').length===1",
    ),
    "o galho na mão (ainda no chão até arrumar)",
  ).toBe(true);
  await jogo.page.keyboard.up("e");
  await jogo.foto("segurar_mochila");
  // clique na mochila: o galho entra nela e sai do chão
  const g = await jogo.caixa("#inv-grid");
  await jogo.page.mouse.move(g.x + 12, g.y + 12);
  await jogo.page.mouse.move(g.x + 14, g.y + 14);
  await jogo.page.mouse.down();
  await jogo.page.mouse.up();
  await jogo.esperar(200);
  expect(
    await jogo.js(
      "!__t.invDrag && !__t.dungeon.loot.some(l=>l.key==='galho') && __t.ensureInv(__t.dungeon.hero).items.some(i=>i.def.key==='galho')",
    ),
    "galho arrumado na mochila",
  ).toBe(true);
  await jogo.foto("segurar_arrumado");
});

test("painel de ações com a arma cravada: segurar esquerdo empurra, direito arranca", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o painel");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.loot.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; __t.spawnDungeonMonster(); const m=d.monsters[d.monsters.length-1]; m.x=d.px+40; m.y=d.py; __t.cravStart(m,'eq_espada');})()",
  );
  await jogo.esperar(300);
  const a = await jogo.js<string[]>(ACOES);
  expect(a[0]).toMatch(/^Esq:(Segure · empurrar a arma|Empurrando…)/);
  expect(a[1]).toMatch(/^Dir:Arrancar a arma/);
  await jogo.foto("painel_cravada");
});

test("painel de ações no acampamento: fogueira e Caçador", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o painel");
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.econ.introDone = true; __t.enterCamp(__h)");
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 8000, 250)).toBe(true);
  await jogo.esperar(1000);
  // o Caçador fala ao chegar: durante a fala o painel fica escondido
  if (await jogo.js("!!__t.ISC.dlg")) expect(await jogo.js<string[]>(ACOES), "sem ações na fala").toEqual([]);
  await passarDialogo(jogo);
  expect(await jogo.js("!__t.ISC.dlg && !__t.dungeon.modalOpen"), "fala terminou").toBe(true);
  await jogo.js("(()=>{const d=__t.dungeon,F=__t.CPS.fire; d.loot.length=0; d.px=F.x-30; d.py=F.y;})()");
  await jogo.esperar(400);
  expect((await jogo.js<string[]>(ACOES))[0], "perto da fogueira").toMatch(/^E:(Fogueira|Acender a fogueira)/); // no tutorial ela ainda está apagada
  await jogo.foto("painel_fogueira");
  await jogo.js("(()=>{const d=__t.dungeon,H=__t.CPS.hunter; d.px=H.x+20; d.py=H.y+10;})()");
  await jogo.esperar(400);
  expect((await jogo.js<string[]>(ACOES))[0], "perto do Caçador").toMatch(/^E:(Conversar|Falar) com o Caçador/);
  await jogo.foto("painel_cacador");
});
