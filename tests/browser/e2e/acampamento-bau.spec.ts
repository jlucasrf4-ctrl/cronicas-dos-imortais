/* v7.7 — documento mestre 5.1/5.2: o baú do acampamento abre ao lado da mochila (E perto dele) e a tenda é o ponto de
   preparo (E abre a preparação sem sair do acampamento; partir de lá vai para a expedição). */
import { test, expect, entrarComHeroi, esperarAte, passarDialogo } from "./comum.ts";
import type { Jogo } from "./comum.ts";

const ACOES = "__t.acoesAgora().map(a=>a.tecla+':'+a.texto)";

async function noAcampamento(jogo: Jogo) {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 3; __t.econ.tent = true; __t.enterCamp(__h)",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 8000, 250)).toBe(true);
  await jogo.esperar(1000);
  await passarDialogo(jogo);
  await jogo.js("(()=>{const d=__t.dungeon; d.loot.length=0; d.mount=null;})()");
}

test("baú do acampamento: E perto abre a janela ao lado da mochila; clique direito guarda", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await noAcampamento(jogo);
  await jogo.js("(()=>{const d=__t.dungeon,B=__t.CPS.bau; d.px=B.x+30; d.py=B.y+10;})()");
  await jogo.esperar(400);
  expect((await jogo.js<string[]>(ACOES))[0], "perto do baú").toBe("E:Abrir o baú");
  await jogo.foto("bau_cena");
  await jogo.js("__t.interact()");
  await jogo.esperar(500);
  await expect(jogo.page.locator("#iw-bau"), "a janela do baú").toBeVisible();
  // clique direito num item da mochila vai para o baú (a janela do baú é o destino)
  await jogo.js(
    "(()=>{const h=__t.dungeon.hero, it=__t.mkItem('eq_arco'); __t.placeIn(__t.ensureInv(h), it); window.__arco=it; __t.renderInv();})()",
  );
  await jogo.esperar(200);
  const p = await jogo.js<{ x: number; y: number } | null>(
    "(()=>{const g=document.getElementById('inv-grid'), it=window.__arco, gr=__t.invGrids.find(o=>o.el===g); if(!gr) return null; const r=g.getBoundingClientRect(), cw=r.width/gr.inv.cols, ch=r.height/gr.inv.rows; let c=0,l=0; outer: for(l=0;l<it.shape.length;l++) for(c=0;c<it.shape[l].length;c++) if(it.shape[l][c]) break outer; return {x:r.left+(it.x+c+0.5)*cw, y:r.top+(it.y+l+0.5)*ch};})()",
  );
  expect(p, "achou o arco na tela").not.toBeNull();
  await jogo.page.mouse.click(p!.x, p!.y, { button: "right" });
  await jogo.esperar(300);
  const d = await jogo.js<{ bau: boolean; mochila: boolean }>(
    "({bau: __t.econ.stash.items.includes(window.__arco), mochila: __t.ensureInv(__t.dungeon.hero).items.includes(window.__arco)})",
  );
  expect(d, "foi para o baú").toEqual({ bau: true, mochila: false });
  await jogo.foto("bau_janela");
});

test("tenda: E abre a preparação no acampamento; fechar volta; partir vai para a expedição", async ({ jogo }) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await noAcampamento(jogo);
  await jogo.js("(()=>{const d=__t.dungeon,T=__t.CPS.tent; d.px=T.x-20; d.py=T.y-30;})()");
  await jogo.esperar(400);
  expect((await jogo.js<string[]>(ACOES))[0], "perto da tenda").toBe("E:Preparar a expedição");
  await jogo.js("__t.interact()");
  await jogo.esperar(500);
  await expect(jogo.page.locator("#prep-modal"), "preparo aberto").toHaveClass(/open/);
  await expect(jogo.page.locator("#prep-go"), "o painel aparece por cima do acampamento").toBeVisible();
  expect(await jogo.js("__t.dungeon.active && __t.dungeon.camp && __t.dungeon.modalOpen"), "ainda no acampamento").toBe(
    true,
  );
  await jogo.foto("tenda_preparo");
  await jogo.js("__t.closePrep()");
  expect(await jogo.js("__t.dungeon.modalOpen"), "fechou, volta a andar").toBe(false);
  await jogo.js("__t.interact()");
  await jogo.esperar(400);
  await jogo.js("document.getElementById('prep-go').click()");
  expect(
    await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.mode === 'expedition'", 9000, 250),
    "entrou na expedição",
  ).toBe(true);
  expect(await jogo.js("__t.dungeon.mode")).toBe("expedition");
});
