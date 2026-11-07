/* v7.7 — balão do acampamento (ui/menu_base.ts, campDrawExpedicao): não fica mais sempre "⚔ Expedição"; só aparece
   com um motivo — heroína que estava ferida na base e se recuperou (toque = preparo da expedição) ou receita da
   carpintaria ao alcance (toque = carpintaria). Depois do toque o aviso some. */
import { test, expect, entrarComHeroi, esperarAte, type Jogo } from "./comum.ts";

/** Heroína na base, câmera no acampamento, tutorial já feito. */
async function naBase(jogo: Jogo) {
  await entrarComHeroi(jogo);
  await jogo.js(
    "(()=>{__t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; const h=__h; h.state='idle'; h.task=null; h.hp=h.hpMax; const c=__t.camera; c.zt=null; c.scale=c.maxScale; const vp=document.getElementById('viewport'); c.tx=vp.clientWidth/2-h.x*c.scale; c.ty=vp.clientHeight/2-h.y*c.scale; __t.applyCameraTransform();})()",
  );
  await jogo.esperar(800);
}
/** Centro do balão na tela (null sem balão). */
const balao = (jogo: Jogo) =>
  jogo.js<[number, number] | null>(
    "(()=>{const B=__t.MAPCTL.bal; if(!B||performance.now()-B.t>600) return null; const r=document.getElementById('viewport').getBoundingClientRect(), c=__t.camera; return [r.left+c.tx+B.x*c.scale, r.top+c.ty+B.y*c.scale];})()",
  );

test("balão do acampamento: some sem motivo; heroína recuperada → preparo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 mostra sempre ⚔ Expedição");
  await naBase(jogo);
  expect(await balao(jogo), "sem motivo, sem balão").toBeNull();
  await jogo.foto("1_sem_balao");
  // fica ferida na base e depois se recupera
  await jogo.js("__h.hp=__h.hpMax*0.4");
  await jogo.esperar(800);
  expect(await balao(jogo), "ferida ainda não avisa").toBeNull();
  await jogo.js("__h.hp=__h.hpMax; __h.wound=0");
  expect(await esperarAte(jogo, "__t.MAPCTL.bal && __t.MAPCTL.bal.kind==='aviso'", 3000)).toBe(true);
  await jogo.foto("2_recuperada");
  const b = await balao(jogo);
  expect(b).not.toBeNull();
  await jogo.page.mouse.click(b![0], b![1]);
  expect(await esperarAte(jogo, "__t.prep.open", 3000), "abriu o preparo").toBe(true);
  await jogo.foto("3_preparo");
  await jogo.js(
    "document.querySelectorAll('.v3-modal.open,.mv-panel.open').forEach(e=>e.classList.remove('open')); __t.prep.open=false",
  );
  await jogo.esperar(800);
  expect(await balao(jogo), "aviso visto some").toBeNull();
});

test("balão do acampamento: receita da carpintaria ao alcance → carpintaria", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 mostra sempre ⚔ Expedição");
  await naBase(jogo);
  await jogo.js(
    "for(let i=0;i<4;i++){const it=__t.mkItem('tabua'); if(!__t.placeIn(__t.econ.stash,it)) __t.econ.stash.items.push(it);}",
  );
  expect(await esperarAte(jogo, "__t.MAPCTL.bal && __t.MAPCTL.bal.kind==='aviso'", 3000)).toBe(true);
  await jogo.foto("4_carpintaria");
  const b = await balao(jogo);
  await jogo.page.mouse.click(b![0], b![1]);
  expect(await esperarAte(jogo, "__t.CARP.open", 3000), "abriu a carpintaria").toBe(true);
});
