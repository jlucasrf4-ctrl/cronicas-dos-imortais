/* v7.7 — campanha C2, passo 5b (começo): lobo laçado fora da missão, depois que o Caçador já tem o cercado, é seu
   (campanha/lobos.ts loboNaSaida: dono "jogador"): vai com a heroína pelo mapa com a mesma pelagem, entra no cercado
   quando ela chega e, como ninguém trata dele, perde vínculo a cada dia sem comer da sua mão (cercado.ts). */
import { test, expect, entrarComHeroi, esperarAte, irAoCampo } from "./comum.ts";

const LOBO = "o=>o.alive&&o.atk==='bite'&&!o.critter&&!o.boss&&!o.kind&&!o.dummy";
const DIA = 24 * 60;

test("lobo seu: laçado depois da missão, branco no campo e branco no cercado, e perde vínculo sem comida", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  // o Caçador já tem o lobo marrom (pelagem 2) e a campanha passou da missão do laço
  await jogo.js(
    `__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.pedidoProx=1e9; e.lobos=[{sexo:'M',pelagem:2,vinculo:0,dono:'cacador',desde:__t.world.tick,pontos:4,diaCacador:Math.floor(__t.world.tick/${DIA})}]; __t.campanhaIr('a3_vinculo'); __t.campanha().feitas.a3_cercado=1;`,
  );
  await irAoCampo(jogo);
  expect(await esperarAte(jogo, `__t.dungeon.monsters.some(${LOBO})`, 12000), "chegou um lobo").toBe(true);
  // um lobo branco (pelagem 3) domado na corda; sai do campo
  await jogo.js(
    `(()=>{const d=__t.dungeon, m=d.monsters.find(${LOBO}); d.monsters.forEach(o=>{if(o!==m) o.alive=false}); m.coat=3; m.sex='F'; m.x=d.px+40; m.y=d.py; m.bound={t:0,len:80,tire:0,_ok:true,dom:true}; m.ko=2;})()`,
  );
  await jogo.js("__t.exitDungeon()");
  await jogo.esperar(1500);
  const L = await jogo.js<Record<string, unknown>>(
    "(()=>{const L=__t.econ.lobos[1]; return L ? {dono:L.dono, pelagem:L.pelagem, sexo:L.sexo} : null})()",
  );
  expect(L, "o branco veio, é seu").toEqual({ dono: "jogador", pelagem: 3, sexo: "F" });
  expect(await jogo.js("__t.campanha().paralela"), "a missão do Caçador não muda").toBe("a3_vinculo");
  // a expedição do preparo volta direto ao acampamento: ele já entra no cercado (pelo mapa, vai com ela até lá)
  expect(await esperarAte(jogo, "!__t.econ.lobos[1].comHeroi", 3000), "no cercado").toBe(true);
  // 3 dias sem comer da sua mão: o seu perde 3 pontos; o do Caçador ganha 3 (ele trata)
  await jogo.js(
    `(()=>{const e=__t.econ, hoje=Math.floor(__t.world.tick/${DIA}); e.lobos[1].pontos=5; e.lobos[1].diaCacador=hoje; e.lobos[0].diaCacador=hoje; e.lobos[0].pontos=4; __t.world.tick += 3*${DIA};})()`,
  );
  expect(await esperarAte(jogo, "__t.econ.lobos[1].pontos === 2", 2000), "o seu perdeu vínculo").toBe(true);
  expect(await jogo.js("__t.econ.lobos[0].pontos")).toBe(7);
});

/** No acampamento com estes lobos (o Caçador sem lobos, para não misturar). */
async function noAcampamento(jogo: Parameters<typeof entrarComHeroi>[0], lobos: string) {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    `(()=>{__t.closeTitle(); const e=__t.econ, t=__t.world.tick, hoje=Math.floor(t/${DIA}); e.introDone=true; e.campTut=3; e.tent=true; e.hunterNap=false; e.pedidoProx=1e9; e.lobos=(${lobos}).map(L=>Object.assign({vinculo:0,dono:'jogador',desde:t,diaCacador:hoje},L)); __t.campanhaIr('a3_cria'); __t.enterCamp(__h);})()`,
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.fire", 6000)).toBe(true);
}
const CERCA = "(()=>{const d=__t.dungeon,F=__t.CPS.fire,T=d.tile; d.px=F.x+4*T; d.py=F.y-1.6*T+1.7*T;})()";
const acoes = "document.getElementById('acoes').textContent";

test("seu casal: no vínculo 4 nasce o seu filhote; E solta os pais a tempo (ele cresce sem os pais)", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await noAcampamento(jogo, "[{sexo:'M',pelagem:1,pontos:25},{sexo:'F',pelagem:3,pontos:25}]");
  expect(await esperarAte(jogo, "__t.econ.lobos.some(L=>L.filhote&&L.dono==='jogador')", 2000), "nasceu").toBe(true);
  await jogo.js(CERCA);
  expect(await esperarAte(jogo, `${acoes}.includes('Soltar os pais do seu filhote')`, 2000)).toBe(true);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(400);
  expect(await jogo.js("__t.econ.lobos.map(L=>[L.filhote, !!L.semPais])")).toEqual([[true, true]]);
});

test("seu casal: passou o prazo com os pais lá, o filhote cresce lobo (não vira pet)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await noAcampamento(jogo, "[{sexo:'M',pelagem:1,pontos:25},{sexo:'F',pelagem:3,pontos:25}]");
  expect(await esperarAte(jogo, "__t.econ.lobos.some(L=>L.filhote)", 2000)).toBe(true);
  await jogo.js(
    `(()=>{const e=__t.econ; e.lobos.forEach(L=>{if(!L.filhote) L.pontos=200}); __t.world.tick += 3*${DIA};})()`,
  );
  expect(await esperarAte(jogo, "__t.econ.lobos.some(L=>L.filhote&&L.cresceuLobo)", 2000), "cresceu lobo").toBe(true);
  await jogo.js(CERCA);
  await jogo.esperar(400);
  expect(await jogo.js(acoes)).not.toContain("Soltar os pais");
});

test("R solta um lobo seu: com vínculo 0 ele morde e foge; com vínculo 4 rodeia", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await noAcampamento(jogo, "[{sexo:'M',pelagem:1,pontos:0}]");
  await jogo.js(CERCA);
  expect(await esperarAte(jogo, `${acoes}.includes('Soltar este lobo')`, 2000), "painel: R").toBe(true);
  const hp0 = await jogo.js<number>("__t.dungeon.hp");
  await jogo.page.keyboard.press("KeyR");
  expect(await jogo.js("__t.econ.lobos.length"), "saiu do cercado").toBe(0);
  expect(await esperarAte(jogo, `__t.dungeon.hp < ${hp0}`, 6000), "mordeu").toBe(true);
  await jogo.foto("solto-morde");
  // o de vínculo 4 rodeia
  await jogo.js(
    `__t.econ.lobos=[{sexo:'F',pelagem:3,vinculo:4,dono:'jogador',desde:__t.world.tick,pontos:25,diaCacador:Math.floor(__t.world.tick/${DIA})}]`,
  );
  await jogo.esperar(400);
  await jogo.js(CERCA);
  expect(await esperarAte(jogo, `${acoes}.includes('Soltar este lobo')`, 2000)).toBe(true);
  const hp1 = await jogo.js<number>("__t.dungeon.hp");
  await jogo.page.keyboard.press("KeyR");
  await jogo.esperar(2500);
  expect(await jogo.js(`__t.dungeon.hp >= ${hp1}`), "não morde").toBe(true);
});
