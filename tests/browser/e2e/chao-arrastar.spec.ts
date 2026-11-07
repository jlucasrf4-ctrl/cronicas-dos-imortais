/* v7.7 — documento mestre 4.4/4.5: arrastar para a área do chão larga o item inteiro no mundo, ao lado do personagem;
   soltar num recipiente onde não cabe exatamente vai para o lugar livre mais perto (antes voltava calado); "Organizar"
   não perde nada. */
import { test, expect, entrarComHeroi, campoDireto, type Jogo } from "./comum.ts";

async function arrastar(jogo: Jogo, de: [number, number], para: [number, number]) {
  await jogo.page.mouse.move(de[0], de[1]);
  await jogo.page.mouse.down();
  for (let i = 1; i <= 8; i++)
    await jogo.page.mouse.move(de[0] + ((para[0] - de[0]) * i) / 8, de[1] + ((para[1] - de[1]) * i) / 8);
  await jogo.page.mouse.up();
  await jogo.esperar(200);
}
/** Centro da 1ª casa do item `expr` na grade `sel`. */
const casa = (sel: string, expr: string) =>
  `(()=>{const g=document.querySelector('${sel}'), it=${expr}, r=g.getBoundingClientRect(), gr=__t.invGrids.find(o=>o.el===g), cw=r.width/gr.inv.cols, ch=r.height/gr.inv.rows; let c=0,l=0; fora: for(l=0;l<it.shape.length;l++) for(c=0;c<it.shape[l].length;c++) if(it.shape[l][c]) break fora; return [r.left+(it.x+c+0.5)*cw, r.top+(it.y+l+0.5)*ch];})()`;

test("arrastar para o chão larga no mundo; soltar em casa ocupada acha o lugar mais perto; organizar não perde", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "regra da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon, h=d.hero; d.monsters.length=0; d.loot.length=0; const inv=__t.ensureInv(h); inv.items.length=0; __t.giveItem(h,'galho',0); __t.giveItem(h,'erva',0); window.__g=inv.items.find(i=>i.def.key==='galho'); window.__e=inv.items.find(i=>i.def.key==='erva');})()",
  );
  await jogo.js("__t.toggleInv(true)");
  await jogo.esperar(800);
  // 1) galho → área do chão (em qualquer ponto dela): sai da mochila e vira item no mundo, perto
  const de = await jogo.js<[number, number]>(casa("#inv-grid", "window.__g"));
  const gg = await jogo.caixa("#inv-ground");
  await arrastar(jogo, de, [gg.x + gg.width - 20, gg.y + gg.height - 15]);
  const r1 = await jogo.js<{ naMochila: boolean; noMundo: number; perto: boolean }>(
    "(()=>{const d=__t.dungeon; const l=d.loot.find(o=>o.key==='galho'); return {naMochila: __t.ensureInv(d.hero).items.includes(window.__g), noMundo: d.loot.length, perto: !!l && Math.hypot(l.x-d.px,l.y-d.py)<40};})()",
  );
  expect(r1.naMochila, "saiu da mochila").toBe(false);
  expect(r1.noMundo, "virou item no chão").toBe(1);
  expect(r1.perto, "ao lado do personagem").toBe(true);
  // 2) erva solta em cima de outro item da aljava (casa ocupada): vai para o lugar livre mais perto, não volta
  const de2 = await jogo.js<[number, number]>(casa("#inv-grid", "window.__e"));
  const para2 = await jogo.js<[number, number]>(casa("#inv-qv", "__t.qvInv(__t.dungeon.hero).items[0]"));
  await arrastar(jogo, de2, para2);
  expect(await jogo.js("__t.qvInv(__t.dungeon.hero).items.includes(window.__e)"), "entrou na aljava").toBe(true);
  // 3) organizar: o mesmo número de itens antes e depois
  const n0 = await jogo.js<number>("__t.qvInv(__t.dungeon.hero).items.length");
  await jogo.js("__t.organizeInv(__t.qvInv(__t.dungeon.hero))");
  expect(await jogo.js<number>("__t.qvInv(__t.dungeon.hero).items.length"), "organizar não perde").toBe(n0);
  await jogo.foto("chao_arrastar");
});
