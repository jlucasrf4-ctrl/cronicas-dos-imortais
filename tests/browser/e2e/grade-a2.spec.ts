/* v7.7 — grade A2 (items/grade_a2.ts): as formas perdem os dentes (retângulos; o machado em L), a moldura segue o
   contorno da peça e os saves antigos ganham as formas novas (o que não couber vai para o baú). */
import { test, expect, entrarComHeroi, campoDireto, campoLimpo } from "./comum.ts";

test("formas sem dentes, machado em L e moldura no contorno", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem as formas com dentes");
  const formas = await jogo.js<Record<string, string>>(
    `(()=>{const o={}; for(const k in __t.ITEM_DEFS){ const sh=__t.ITEM_DEFS[k].shape; if(sh) o[k]=sh.map(r=>r.map(v=>v?'#':'.').join('')).join('/'); } return o;})()`,
  );
  const comVao = Object.entries(formas)
    .filter(([, f]) => f.includes("."))
    .map(([k]) => k);
  expect(comVao.sort(), "só o machado e os pacotes (pedra, penas) têm vão").toEqual([
    "eq_machado",
    "pedra",
    "pena",
    "penaag",
  ]);
  expect(formas.eq_machado).toBe("###/###/###/###/.##/.##/.##");
  expect(formas.eq_botas, "5×3 recortada → 4×3").toBe("####/####/####");
  expect(formas.eq_mochila, "retângulo não muda").toBe("######/######/######/######/######/######");

  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await campoLimpo(jogo);
  await jogo.js(
    `(()=>{const h=__h; h._folhKit=1; const inv=__t.ensureInv(h); inv.items.length=0; __t.tryAddItem(h,'eq_machado'); __t.toggleInv(true); __t.renderInv();})()`,
  );
  await jogo.esperar(300);
  const m = await jogo.js<{ celulas: number; quinas: number; vao: boolean; pontos: boolean }>(
    `(()=>{const w=document.querySelector('#inv-grid .inv-item'); const cs=[...w.querySelectorAll('.inv-cell')];
      return {celulas:cs.length, quinas:w.querySelectorAll('.a2-tl,.a2-tr,.a2-bl,.a2-br').length,
        vao:!w.querySelector('.inv-fill'), pontos:getComputedStyle(document.getElementById('inv-grid')).backgroundImage.includes('radial')};})()`,
  );
  expect(m.celulas).toBe(18);
  expect(m.quinas, "o L tem 5 quinas de fora").toBe(5);
  expect(m.vao, "o vão do L fica à mostra").toBe(true);
  expect(m.pontos, "grade de pontinhos").toBe(true);
  await jogo.foto("machado_l");
});

test("save antigo: formas novas, o item fica no lugar ou vai para o baú", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a grade A2");
  await entrarComHeroi(jogo, "Ayla", 777);
  const r = await jogo.js<{ botas: string; x: number; y: number; aoBau: number; noBau: boolean; defShape: string }>(
    `(()=>{const h=__h; h._folhKit=1; const inv=__t.ensureInv(h); inv.items.length=0;
      const b=__t.mkItem('eq_botas'); b.def=JSON.parse(JSON.stringify(b.def)); b.shape=[[1,0,0,0,1],[1,0,0,0,1],[1,1,0,1,1]]; b.def.shape=b.shape;
      b.x=2; b.y=2; inv.items.push(b);
      // uma pele antiga 6×6 numa grade 6×6 com pedras (forma que não muda) nos 4 cantos (nos dentes dela): a pele nova (5×5) não cabe
      const lot={cols:6,rows:6,items:[]}; const p=__t.mkItem('pele'); p.shape=[[0,1,1,1,1,0],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[0,1,0,0,1,0]];
      p.x=0; p.y=0; lot.items.push(p);
      for(const [x,y] of [[0,0],[5,0],[0,5],[5,5]]){ const e=__t.mkItem('pedra'); e.x=x; e.y=y; e.shape=[[1]]; lot.items.push(e); }
      h.inv2=lot;
      const n=__t.migrarFormasA2();
      return {botas:b.shape.map(r=>r.join('')).join('/'), x:b.x, y:b.y, aoBau:n, noBau:__t.econ.stash.items.includes(p),
        defShape:b.def.shape.map(r=>r.join('')).join('/')};})()`,
  );
  expect(r.botas).toBe("1111/1111/1111");
  expect([r.x, r.y], "fica onde estava").toEqual([2, 2]);
  expect(r.defShape, "a cópia do def no save também").toBe("1111/1111/1111");
  expect(r.aoBau, "a pele não coube").toBe(1);
  expect(r.noBau, "e foi para o baú").toBe(true);
});
