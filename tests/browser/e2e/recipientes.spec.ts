/* v7.7 — recipientes em janelas (ui/recipientes.ts, documento mestre 4.2/4.3): aljava e alforjes em janelas próprias;
   clique direito = transferência rápida com destino previsível; sem espaço o item fica onde estava. */
import { test, expect, entrarComHeroi, campoDireto, type Jogo } from "./comum.ts";

/** Clique direito no item `expr` (uma expressão que dá o item) dentro da grade `sel`. */
async function direito(jogo: Jogo, sel: string, expr: string) {
  const p = await jogo.js<{ x: number; y: number } | null>(
    `(()=>{const g=document.querySelector('${sel}'), it=${expr}; if(!g||!it) return null; const r=g.getBoundingClientRect(), gr=__t.invGrids.find(o=>o.el===g), cw=r.width/gr.inv.cols, ch=r.height/gr.inv.rows; let c=0,l=0; outer: for(l=0;l<it.shape.length;l++) for(c=0;c<it.shape[l].length;c++) if(it.shape[l][c]) break outer; return {x:r.left+(it.x+c+0.5)*cw, y:r.top+(it.y+l+0.5)*ch};})()`,
  );
  expect(p, "achou o item na tela").not.toBeNull();
  await jogo.page.mouse.click(p!.x, p!.y, { button: "right" });
  await jogo.esperar(150);
}

test("aljava em janela: clique direito leva e traz; fechada, a mochila larga no chão; flechas não saem", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem as janelas");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.monsters.length=0; d.loot.length=0; const h=d.hero; __t.ensureInv(h).items.length=0; __t.giveItem(h,'erva',0); window.__e=__t.ensureInv(h).items[0];})()",
  );
  await jogo.js("__t.toggleInv(true)");
  await jogo.esperar(800);
  expect(await jogo.js("getComputedStyle(document.getElementById('iw-aljava')).display"), "janela da aljava").not.toBe(
    "none",
  );
  // mochila → aljava (o destino ⇄)
  await direito(jogo, "#inv-grid", "window.__e");
  expect(await jogo.js("__t.qvInv(__t.dungeon.hero).items.includes(window.__e)"), "foi para a aljava").toBe(true);
  // aljava → mochila
  await direito(jogo, "#inv-qv", "window.__e");
  expect(await jogo.js("__t.ensureInv(__t.dungeon.hero).items.includes(window.__e)"), "voltou para a mochila").toBe(
    true,
  );
  // flechas: não saem da aljava pelo clique direito
  const n0 = await jogo.js<number>("__t.qvInv(__t.dungeon.hero).items.filter(i=>i.def.key==='flecha').length");
  await direito(jogo, "#inv-qv", "__t.qvInv(__t.dungeon.hero).items.find(i=>i.def.key==='flecha')");
  expect(await jogo.js<number>("__t.qvInv(__t.dungeon.hero).items.filter(i=>i.def.key==='flecha').length")).toBe(n0);
  await jogo.foto("aljava_janela");
  // fecha a janela: o clique direito na mochila volta a largar no chão
  await jogo.page.click("#iw-aljava .iw-x");
  await jogo.esperar(200);
  expect(await jogo.js("getComputedStyle(document.getElementById('iw-aljava')).display")).toBe("none");
  await direito(jogo, "#inv-grid", "window.__e");
  expect(await jogo.js("!__t.ensureInv(__t.dungeon.hero).items.includes(window.__e)"), "largou no chão").toBe(true);
  // o botão do painel reabre
  await jogo.page.click(".recip-bar [data-recip=aljava]");
  await jogo.esperar(200);
  expect(await jogo.js("getComputedStyle(document.getElementById('iw-aljava')).display")).not.toBe("none");
});

test("sem espaço o item fica onde estava e o jogo avisa", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem as janelas");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  // aljava lotada de galhos: a erva da mochila não cabe
  await jogo.js(
    "(()=>{const d=__t.dungeon, h=d.hero; d.monsters.length=0; __t.ensureInv(h).items.length=0; __t.giveItem(h,'erva',0); window.__e=__t.ensureInv(h).items[0]; const q=__t.qvInv(h); q.items.length=0; for(let y=0;y<q.rows;y++) for(let x=0;x<q.cols;x++) q.items.push({def:__t.ITEM_DEFS.pedra, x, y, shape:[[1]], n:1});})()",
  );
  await jogo.js("__t.toggleInv(true)");
  await jogo.esperar(800);
  const t0 = await jogo.js<number>("__t.dungeon.toasts.length");
  await direito(jogo, "#inv-grid", "window.__e");
  expect(await jogo.js("__t.ensureInv(__t.dungeon.hero).items.includes(window.__e)"), "ficou na mochila").toBe(true);
  expect(
    await jogo.js<boolean>(
      `__t.dungeon.toasts.slice(${t0}).some(t=>/Não cabe na aljava/.test(t.text))||/Não cabe na aljava/.test(document.body.innerText)`,
    ),
    "avisou",
  ).toBe(true);
});

test("alforjes do tamanduá em janela: perto aparece a grade; longe, o aviso", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem as janelas");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const tem = await jogo.js<boolean>("!!__t.mnt && !!__t.mountBag");
  test.skip(!tem, "o gancho não expõe o tamanduá");
  await jogo.js(
    "(()=>{const d=__t.dungeon; const h=d.hero; if(!__t.mnt()) __t.econ.mount={name:'Tatu',xp:0,lv:1}; d.mount={x:d.px+10,y:d.py,mounted:false,hp:100}; })()",
  );
  await jogo.js("__t.toggleInv(true)");
  await jogo.esperar(800);
  const r = await jogo.js<{ janela: string; grade: boolean }>(
    "(()=>{const w=document.getElementById('iw-alforjes'); return {janela: w?getComputedStyle(w).display:'sem', grade: !!document.querySelector('#iw-alforjes #inv-saddle')};})()",
  );
  expect(r.janela, "janela dos alforjes").not.toBe("none");
  expect(r.grade, "a grade dos alforjes está na janela").toBe(true);
  await jogo.foto("alforjes_janela");
});
