/* v7.7 — a erva cura e fecha o ferimento (−10) também com ervas empilhadas e com a vida no teto (vida máxima menos o
   ferimento). Antes, com 2+ ervas na mesma casa o ferimento nunca fechava, e no teto a erva era gasta sem curar. */
import { test, expect, entrarComHeroi, campoDireto, campoLimpo, esperarAte } from "./comum.ts";

/** Põe 3 ervas (empilhadas) na mochila, o ferimento e a vida pedidos; usa uma erva; devolve o estado logo depois. */
const usar = (ferimento: number, vida: string) =>
  `(()=>{const d=__t.dungeon, inv=__t.ensureInv(d.hero); inv.items=inv.items.filter(i=>i.def.key!=='erva');
    for(let i=0;i<3;i++) __t.tryAddItem(d.hero,'erva');
    d.invuln=999; d.wound=${ferimento}; d.hp=${vida}; d.herbCd=0; d.hotLeft=0;
    const un=()=>inv.items.filter(i=>i.def.key==='erva').reduce((s,i)=>s+(i.n||1),0), n0=un();
    __t.healHerb();
    return {gastou:n0-un(), ferimento:d.wound, hot:d.hotLeft||0, hp:d.hp, teto:d.hpMax-(d.wound||0)};})()`;

test("terva — erva empilhada fecha o ferimento; no teto ela cura até o novo teto", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await campoLimpo(jogo);
  // empilhadas, vida baixa: gasta uma, fecha 10 de ferimento e regenera
  const a = await jogo.js<{ gastou: number; ferimento: number; hot: number }>(usar(40, "d.hpMax*0.4"));
  expect(a.gastou).toBe(1);
  if (!jogo.referencia) expect(a.ferimento).toBe(30); // na v7.6 ficava em 40 (o bug)
  expect(a.hot).toBeGreaterThan(0);
  // vida no teto com ferimento: a erva é gasta, o ferimento fecha e a vida sobe até o novo teto
  const b = await jogo.js<{ gastou: number; ferimento: number; hp: number; teto: number }>(usar(40, "d.hpMax-40"));
  expect(b.gastou).toBe(1);
  if (jogo.referencia) return;
  expect(b.ferimento).toBe(30);
  expect(await esperarAte(jogo, `__t.dungeon.hp >= ${b.teto} - 0.5`, 15000)).toBe(true);
});
