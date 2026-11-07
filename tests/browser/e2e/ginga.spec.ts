/* v7.7 — ginga (field/armas.ts: gingar, tabela GINGA): Espaço com arma corpo a corpo e sem escudo dá um passo curto de
   lado; o golpe que chega na janela passa direto, sem mexer no bicho. Com escudo, o Espaço continua erguendo a guarda. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("ginga: sem escudo o Espaço desvia no tempo certo; com escudo ergue a guarda", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a ginga");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const preparar = (escudo: boolean) =>
    jogo.js(
      `(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; d.mouse={x:d.px+80,y:d.py}; d.invuln=0; d.hp=d.hpMax; d.gstam=100; d.dodge=null; d.dodgeCd=0; d.guard=false; d.weapon='melee'; const e=__t.ensureEquip(d.hero); e.maoD=__t.mkItem('eq_faca'); ${escudo ? "const s=__t.mkItem('eq_escudo'); __t.eqDurInit(s); e.maoE=s;" : "e.maoE=null;"} __t.GL3.heroKey=''; const m=__t.spawnDungeonMonster({}); m.x=d.px+30; m.y=d.py; m.hp=999; m.st='idle';})()`,
    );
  await preparar(false);
  await jogo.esperar(200);
  const p0 = await jogo.js<number[]>("(()=>{const d=__t.dungeon; d.gingaGuard=0; return [d.px,d.py]})()");
  await jogo.page.keyboard.press("Space");
  // na janela: o golpe passa direto, o bicho fica como estava
  const r = await jogo.js<{ guard: boolean; janela: boolean; dano: number; st: string; hp: number }>(
    "(()=>{const d=__t.dungeon,m=d.monsters[0],hp=d.hp,st=m.st; const janela=d.gingaGuard>0; __t.wolfStrike(m,null,20,0); return {guard:!!d.guard, janela, dano:hp-d.hp, st:m.st===st?'igual':m.st, hp:m.hp}})()",
  );
  expect(r.guard, "sem escudo não ergue guarda").toBe(false);
  expect(r.janela, "a ginga abriu a janela").toBe(true);
  expect(r.dano, "golpe na janela não dá dano").toBe(0);
  expect(r.st, "o bicho não é afetado").toBe("igual");
  expect(r.hp).toBe(999);
  await jogo.esperar(350);
  // parada, a ginga vai de lado em relação à mira (aqui a mira aponta para +x, então o passo é em y)
  const passo = await jogo.js<number>(`Math.hypot(__t.dungeon.px-${p0[0]}, __t.dungeon.py-${p0[1]})`);
  expect(passo, "deu um passo curto").toBeGreaterThan(5);
  // fora da janela o golpe acerta
  const dano = await jogo.js<number>(
    "(()=>{const d=__t.dungeon,m=d.monsters[0],hp=d.hp; d.gingaGuard=0; d.invuln=0; __t.wolfStrike(m,null,20,0); return hp-d.hp})()",
  );
  expect(dano, "fora do tempo acerta").toBeGreaterThan(0);
  await jogo.foto("ginga");
  // com escudo: Espaço segura a guarda (sem ginga)
  await preparar(true);
  await jogo.esperar(200);
  await jogo.page.keyboard.down("Space");
  await jogo.esperar(100);
  const g = await jogo.js<{ guard: boolean; ginga: boolean }>(
    "({guard:!!__t.dungeon.guard, ginga:__t.dungeon.gingaGuard>0})",
  );
  await jogo.page.keyboard.up("Space");
  expect(g).toEqual({ guard: true, ginga: false });
});
