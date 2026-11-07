/* v7.7 — ordens de trabalho no mapa (map/selecao.ts, alvoOrdem): com a heroína selecionada, a dica ao lado do cursor
   diz o que o botão direito faz ali, com o verbo certo (data/mapa.ts ORDEM); botão direito num cervo manda caçar
   cervo ali; numa árvore, cortar madeira. */
import { test, expect, entrarComHeroi, type Jogo } from "./comum.ts";

/** Heroína solta e selecionada no mapa, no zoom máximo e centrada. */
async function noMapa(jogo: Jogo) {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "(()=>{__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; const h=__h; h.state='field'; h.task=null; const c=__t.camera; c.zt=null; c.scale=c.maxScale; const vp=document.getElementById('viewport'); c.tx=vp.clientWidth/2-h.x*c.scale; c.ty=vp.clientHeight/2-h.y*c.scale; __t.applyCameraTransform(); __t.SEL.grupo=[h.id];})()",
  );
  await jogo.esperar(400);
}
/** Ponto do mundo na tela. */
const tela = (jogo: Jogo, expr: string) =>
  jogo.js<{ x: number; y: number }>(
    `(()=>{const p=${expr}; const r=document.getElementById('viewport').getBoundingClientRect(), c=__t.camera; return {x:r.left+c.tx+p.x*c.scale, y:r.top+c.ty+p.y*c.scale};})()`,
  );

test("ordem: dica no cervo e botão direito manda caçar cervo ali", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem as ordens pelo botão direito");
  await noMapa(jogo);
  // um cervo parado a 40 unidades da heroína (sem andar: velocidade zerada)
  const ok = await jogo.js<boolean>(
    "(()=>{const a=__t.world.animals.find(o=>o.species==='deer'&&o.alive!==false); if(!a) return false; window.__cervo=a; a.x=__h.x+40; a.y=__h.y; a.vx=a.vy=0; a.state='idle'; return true;})()",
  );
  expect(ok).toBe(true);
  // move e confere no mesmo passo (o cervo anda devagar entre duas chamadas)
  const p = await tela(jogo, "__cervo");
  await jogo.page.mouse.move(p.x - 20, p.y - 20);
  await jogo.page.mouse.move(p.x, p.y, { steps: 3 });
  const dica = await jogo.js<string>("document.getElementById('ordem-dica').textContent");
  expect(dica).toContain("Caçar cervo");
  expect(await jogo.js("document.getElementById('viewport').dataset.ordem")).toBe("cacar");
  await jogo.foto("1_dica_cervo");
  await jogo.page.mouse.click(p.x, p.y, { button: "right" });
  await jogo.esperar(200);
  const t = await jogo.js<{ st: string; sp: string; r: number }>(
    "({st:__h.state, sp:__h.task&&__h.task.targetSpecies, r:__h.task&&__h.task.r})",
  );
  expect(t.sp).toBe("deer");
  expect(["traveling", "hunting"]).toContain(t.st);
  expect(t.r, "área de caça").toBeGreaterThan(0);
});

test("ordem: árvore = cortar madeira; sem seleção, sem dica; botões com o verbo do trabalho", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem as ordens pelo botão direito");
  await noMapa(jogo);
  const tem = await jogo.js<boolean>(
    "(()=>{const n=__t.world.nodes.filter(o=>o.kind==='tree'&&__t.nodeReady(o)).sort((a,b)=>Math.hypot(a.x-__h.x,a.y-__h.y)-Math.hypot(b.x-__h.x,b.y-__h.y))[0]; if(!n) return false; window.__arv=n; const c=__t.camera, vp=document.getElementById('viewport'); c.tx=vp.clientWidth/2-n.x*c.scale; c.ty=vp.clientHeight/2-n.y*c.scale; __t.applyCameraTransform(); return true;})()",
  );
  expect(tem).toBe(true);
  await jogo.esperar(200);
  const p = await tela(jogo, "__arv");
  await jogo.page.mouse.move(p.x - 15, p.y - 15);
  await jogo.page.mouse.move(p.x, p.y, { steps: 3 });
  expect(await jogo.js<string>("document.getElementById('ordem-dica').textContent")).toContain("Cortar madeira");
  await jogo.foto("1_dica_arvore");
  // sem seleção, nada de dica
  await jogo.js("__t.SEL.grupo=[]");
  await jogo.page.mouse.move(p.x + 1, p.y + 1);
  expect(await jogo.js("document.getElementById('ordem-dica').classList.contains('on')")).toBe(false);
  // o botão do painel usa o verbo do trabalho escolhido
  await jogo.js("(()=>{__h.huntSpecies='rock'; __t.updateHeroPanelUI();})()");
  expect(await jogo.js<string>("document.querySelector('[data-act=huntz]').textContent")).toContain(
    "Quebrar pedra aqui",
  );
});
