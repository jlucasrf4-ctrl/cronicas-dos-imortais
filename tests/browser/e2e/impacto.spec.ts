/* v8.0 — impacto (data/combate.ts DANO.IMPACTO.minEfeito; mantenedor, 2026-10-24): o impacto sempre entra no dano,
   mas só arma de impacto de verdade (≥ 25% no mix) interrompe o bote do lobo. Espada (10%) e faca (5%) não. */
import { test, expect, campoDireto } from "./comum.ts";

test("só arma de impacto interrompe o bote; espada e faca não", async ({ jogo }) => {
  test.skip(jogo.referencia, "na v7.6 qualquer golpe interrompia");
  await jogo.js("__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));");
  await campoDireto(jogo);
  const r = await jogo.js<
    Record<string, string[]>
  >(`(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0;
    const e=__t.ensureEquip(d.hero), out={};
    for (const k of ['eq_espada','eq_faca','eq_clava']) {
      const it=__t.mkItem(k); __t.eqDurInit(it); e.maoD=it; d.weapon='melee';
      out[k]=[];
      for (let i=0;i<20;i++) {
        const m=__t.spawnDungeonMonster(); m.x=d.px+400; m.y=d.py; m.hp=m.hpMax=999; m.st='windup'; m.t=0.5; m.atk='bite';
        __t.hurtMonster(m, 5, k==='eq_faca'?'faca':'espada', 0);
        out[k].push(m.st); d.monsters.length=0;
      }
    }
    return out;})()`);
  expect(
    r.eq_espada.every((s) => s === "windup"),
    "espada não interrompe",
  ).toBe(true);
  expect(
    r.eq_faca.every((s) => s === "windup"),
    "faca não interrompe",
  ).toBe(true);
  expect(
    r.eq_clava.every((s) => s !== "windup"),
    "clava interrompe",
  ).toBe(true);
});
