/* v7.7 — heroína low poly: o herói do campo e o retrato do preparo usam o modelo 3D novo (tronco, braços e pernas
   direitos/esquerdos). Confere que as peças existem e que nada quebra parada, andando, no golpe e com escudo;
   as fotos ficam em tests/browser/resultados/ para comparar a olho. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

const PECAS =
  "['torsoH','bracoD','bracoE','pernaD','pernaE','escudo'].every(k=>__t.GL3.hero&&__t.GL3.hero[k]&&__t.GL3.hero[k].n>0)";

test("heroína: faca na mão (v7.7: 60% menor, parecia espada)", async ({ jogo }) => {
  test.skip(jogo.referencia, "o tamanho da faca mudou na v7.7");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=4.5; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_faca_velha'); __t.eqDurInit(it); e.maoD=it; e.maoE=null; __t.GL3.heroKey=''; d.weapon='melee'; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1200);
  await jogo.foto("faca");
});

test("heroína: retrato, parada, andando, golpe e escudo", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.openPrep(__h.id)");
  await jogo.esperar(1500);
  await jogo.foto("retrato");
  await jogo.js("__t.closePrep && __t.closePrep()");
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1200);
  if (!jogo.referencia) expect(await jogo.js(PECAS), "peças da heroína").toBe(true);
  await jogo.foto("parada");
  // andando: pressiona D por um instante
  await jogo.page.keyboard.down("d");
  await jogo.esperar(350);
  await jogo.foto("andando");
  await jogo.page.keyboard.up("d");
  await jogo.esperar(400);
  // golpe congelado no meio (GL3.fz)
  await jogo.js(
    "(()=>{const d=__t.dungeon; __t.GL3.fz=0.12; d.cd=0; d.combo=1; d.comboT=0.5; d.slash=null; __t.GL3.atk=null; __t.swingBasic();})()",
  );
  await jogo.esperar(300);
  await jogo.foto("golpe");
  await jogo.js("__t.GL3.fz=null");
  // escudo na mão esquerda
  await jogo.js(
    "(()=>{const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_escudo'); __t.eqDurInit(it); e.maoE=it; __t.GL3.heroKey='';})()",
  );
  await jogo.esperar(600);
  await jogo.foto("escudo");
});

test("heroína animada: combo de espada (3 golpes do pacote Sword and Shield)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a heroína animada");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1000);
  const passos: number[] = [];
  for (const k of [0, 1, 2])
    for (const fz of [0.06, 0.16, 0.3]) {
      passos.push(
        await jogo.js<number>(
          `(()=>{const d=__t.dungeon; __t.GL3.fz=${fz}; d.cd=0; d.combo=${k}; d.comboT=${k ? 0.5 : 0}; d.slash=null; __t.GL3.atk=null; __t.swingBasic(); return __t.GL3.atk ? __t.GL3.atk.step : (d.slash ? d.slash.step : -1);})()`,
        ),
      );
      await jogo.esperar(350);
      await jogo.foto(`combo_${k}_${Math.round(fz * 100)}`);
    }
  await jogo.js("__t.GL3.fz=null");
  expect(
    passos.every((p) => p >= 0),
    "o golpe saiu",
  ).toBe(true);
});

test("heroína animada: arco (puxar, mirar, soltar), estocada de lança e defesa com escudo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a heroína animada");
  const ANIM = "__t.GL3.list.some(x=>x.mesh&&x.mesh.n===14340)";
  const equipar = (k: string) =>
    `(()=>{const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('${k}'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.weapon='melee'; d.cd=0;})()`;
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1000);
  // arco: puxando (metade da carga), mirando (carga cheia) e soltando
  await jogo.js("(()=>{const d=__t.dungeon; d.weapon='bow'; __t.startCharge();})()");
  await jogo.esperar(450);
  expect(await jogo.js(ANIM), "puxando com a malha animada").toBe(true);
  await jogo.foto("arco_puxando");
  await jogo.esperar(1100);
  await jogo.foto("arco_mirando");
  await jogo.js("__t.fireArrow()");
  await jogo.esperar(120);
  await jogo.foto("arco_soltando");
  await jogo.esperar(800);
  // lança: golpe congelado no pico da estocada
  await jogo.js(equipar("eq_lanca"));
  await jogo.esperar(400);
  await jogo.js(
    "(()=>{const d=__t.dungeon; __t.GL3.fz=0.08; d.cd=0; d.slash=null; __t.GL3.atk=null; __t.swingBasic();})()",
  );
  await jogo.esperar(300);
  expect(await jogo.js(ANIM), "estocada com a malha animada").toBe(true);
  await jogo.foto("lanca_estocada");
  await jogo.js("__t.GL3.fz=null");
  await jogo.esperar(500);
  // espada e escudo: defesa
  await jogo.js(equipar("eq_espada"));
  await jogo.js(
    "(()=>{const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_escudo'); __t.eqDurInit(it); e.maoE=it; __t.GL3.heroKey=''; __t.GL3.atk=null; d.slash=null; d.guard=true;})()",
  );
  await jogo.esperar(500);
  expect(await jogo.js(ANIM), "defesa com a malha animada").toBe(true);
  await jogo.foto("escudo_defesa");
  await jogo.js("__t.dungeon.guard=false");
});

test("heroína animada: reação ao levar dano e bloqueio com escudo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a heroína animada");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1000);
  // levou dano: hurtFlash = 0,45 s (como hurtPlayerBase)
  await jogo.js("(()=>{__t.dungeon.hurtFlash=0.45;})()");
  await jogo.esperar(120);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "toca o atingido").toBe("atingido");
  await jogo.foto("reacao_atingido");
  await jogo.esperar(700);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "volta depois da reação").not.toBe("atingido");
  // espada e escudo, guarda erguida, o escudo segurou um golpe agora
  await jogo.js(
    "(()=>{const d=__t.dungeon; const e=__t.ensureEquip(d.hero); for (const [s,k] of [['maoD','eq_espada'],['maoE','eq_escudo']]) {const it=__t.mkItem(k); __t.eqDurInit(it); e[s]=it;} __t.GL3.heroKey=''; d.weapon='melee'; __t.GL3.atk=null; d.slash=null; d.guard=true;})()",
  );
  await jogo.esperar(500);
  await jogo.js("(()=>{__t.dungeon._blqEm=performance.now();})()");
  await jogo.esperar(120);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "toca o bloqueio").toBe("escudo_bloqueio");
  await jogo.foto("reacao_bloqueio");
  await jogo.esperar(800);
  expect(await jogo.js<string>("__t.heroinaEstado()"), "volta à guarda").toBe("escudo");
  await jogo.js("__t.dungeon.guard=false");
});

/** A malha animada (esqueleto) está na lista de desenho deste quadro? */
const ANIMADA = "__t.GL3.list.some(x=>x.mesh&&x.mesh.n===14340)";

test("heroína animada: parada, andar, correr, coletar, cambalhota do arco e queda", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a heroína animada");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1200);
  expect(await jogo.js(ANIMADA), "malha animada desenhada").toBe(true);
  await jogo.foto("anim_parada");
  await jogo.page.keyboard.down("d");
  await jogo.esperar(500);
  await jogo.foto("anim_andar");
  await jogo.page.keyboard.down("Shift");
  await jogo.esperar(250);
  await jogo.foto("anim_correr");
  await jogo.page.keyboard.up("Shift");
  await jogo.page.keyboard.up("d");
  await jogo.esperar(600);
  // coletar: um item no chão aos pés dela, e E
  const coletou = await jogo.js<boolean>(
    "(()=>{const d=__t.dungeon; d.loot.push({key:'galho',tier:0,t:0,ttl:0,x:d.px+6,y:d.py}); const n=d.loot.length; __t.interact(); return d.loot.length<n;})()",
  );
  expect(coletou, "E pegou o galho do chão").toBe(true);
  await jogo.esperar(300);
  await jogo.foto("anim_coletar");
  await jogo.esperar(800);
  // cambalhota: com o arco, rola para a direita
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.weapon='bow'; d.dodgeCd=0; d.keys={KeyD:true}; __t.bowRoll(); d.keys={};})()",
  );
  await jogo.esperar(200);
  await jogo.foto("anim_rolar");
  expect(await jogo.js(ANIMADA), "cambalhota com a malha animada").toBe(true);
  await jogo.esperar(900);
  // queda
  await jogo.js("__t.dungeon.dead=true");
  await jogo.esperar(1800);
  await jogo.foto("anim_morrer");
  expect(await jogo.js(ANIMADA), "queda com a malha animada").toBe(true);
});
