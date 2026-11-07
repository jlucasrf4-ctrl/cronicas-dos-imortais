/* v7.7 — campanha C2, passo 4 (campanha/cercado.ts: casalTick): o 2º lobo que o Caçador traz sozinho (sexo oposto,
   sem missão), o filhote quando o casal chega ao vínculo 4, e soltar os pais (E na cerca; passado o prazo, o Caçador
   solta). */
import { test, expect, entrarComHeroi, esperarAte, passarDialogo } from "./comum.ts";

const missao = "__t.campanha().paralela"; // v8.0: o casal e o filhote são da linha paralela dos lobos
const acoes = "document.getElementById('acoes').textContent";
const DIA = 24 * 60;
/** O Caçador com um lobo macho capturado há 4 dias, já no vínculo 4; o primeiro pedido entregue. */
const PREPARO = `__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.hunterNap=false; e.pedidoProx=1e9; e.lobos=[{sexo:'M',pelagem:2,vinculo:0,dono:'cacador',desde:__t.world.tick-4*${DIA},pontos:30,diaCacador:Math.floor(__t.world.tick/${DIA})}]; __t.campanhaIr('a3_cuidar'); __t.campanha().feitas.a3_pedido=1; __t.enterCamp(__h)`;
// na cerca por baixo (longe da porteira, que fica no lado esquerdo)
const CERCA = "(()=>{const d=__t.dungeon,F=__t.CPS.fire,T=d.tile; d.px=F.x+4*T; d.py=F.y-1.6*T+1.7*T;})()";
const LOBOS = "__t.econ.lobos.map(L=>(L.filhote?'f':'')+L.sexo).join(',')";

test("casal: o 2º lobo chega sozinho, nasce o filhote, E solta os pais", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(PREPARO);
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.hunter", 6000)).toBe(true);
  // passados 3 dias da captura, o Caçador traz uma loba (sem missão)
  expect(await esperarAte(jogo, "__t.econ.lobos.length === 2", 2000), "chegou o 2º").toBe(true);
  expect(await jogo.js(LOBOS)).toBe("M,F");
  expect(await jogo.js(missao), "sem missão nova").toBe("a3_cuidar");
  // a loba chega ao vínculo 4: nasce o filhote e o Caçador chama
  await jogo.js("__t.econ.lobos[1].pontos = 30");
  expect(await esperarAte(jogo, "__t.econ.lobos.some(L=>L.filhote)", 2000), "nasceu").toBe(true);
  expect(await jogo.js(missao)).toBe("a3_filhote");
  await jogo.js("(()=>{const d=__t.dungeon; d.px=__t.CPS.hunter.x+20; d.py=__t.CPS.hunter.y;})()");
  await jogo.esperar(300);
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, "!!__t.ISC.dlg", 2000)).toBe(true);
  await passarDialogo(jogo, 20);
  expect(await jogo.js(missao)).toBe("a3_soltar");
  // na cerca: "Soltar os pais"; E solta, fica só o filhote
  await jogo.js(CERCA);
  expect(await esperarAte(jogo, `${acoes}.includes('Soltar os pais')`, 2000), "painel").toBe(true);
  await jogo.foto("casal-filhote");
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(600);
  await jogo.foto("pais-soltos");
  expect(await jogo.js(`[${LOBOS}.split(',').every(s=>s[0]==='f'), ${missao}]`)).toEqual([true, "a3_cria"]);
});

test("filhote solto: com carne na mochila ele vem atrás de você e come da sua mão", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  // só o filhote, com os pais soltos há 2 dias; o sorteio da visita fixo em "solto"
  await jogo.js(
    `(()=>{__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.hunterNap=false; e.pedidoProx=1e9; const t=__t.world.tick; e.lobos=[{sexo:'F',pelagem:3,vinculo:0,dono:'cacador',desde:t-3*${DIA},filhote:true,pontos:0,paisSoltosEm:t-2*${DIA},diaCacador:Math.floor(t/${DIA})}]; __t.campanhaIr('a3_cria'); window.__rnd=Math.random; Math.random=()=>0.1; __t.enterCamp(__h);})()`,
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.hunter", 6000)).toBe(true);
  await jogo.esperar(800);
  await jogo.js("Math.random = window.__rnd");
  // 3 carnes na mochila, perto do Caçador: ele sente o cheiro e vem até você
  await jogo.js(
    "(()=>{const d=__t.dungeon, inv=__t.ensureInv(d.hero); for(let k=0;k<3;k++) __t.tryAddToInv(inv,'carne',0); d.px=__t.CPS.hunter.x-1.5*d.tile; d.py=__t.CPS.hunter.y+1.5*d.tile;})()",
  );
  expect(await esperarAte(jogo, `${acoes}.includes('Dar carne ao filhote')`, 6000), "veio até você").toBe(true);
  await jogo.foto("filhote-solto");
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(300);
  expect(
    await jogo.js(`[__t.econ.lobos[0].pontos, __t.econ.lobos[0].comeuDia === Math.floor(__t.world.tick/${DIA})]`),
  ).toEqual([1, true]);
  expect(await esperarAte(jogo, `${acoes}.includes('já comeu hoje')`, 2000)).toBe(true);
});

test("casal: passado o prazo, o próprio Caçador solta os pais", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(PREPARO);
  expect(await esperarAte(jogo, "__t.econ.lobos.length === 2", 6000)).toBe(true);
  await jogo.js("__t.econ.lobos[1].pontos = 30");
  expect(await esperarAte(jogo, "__t.econ.lobos.some(L=>L.filhote)", 2000)).toBe(true);
  await jogo.js(`__t.world.tick += 3 * ${DIA}`);
  expect(await esperarAte(jogo, "__t.econ.lobos.length === 1", 2000), "o Caçador soltou").toBe(true);
  expect(await jogo.js(missao)).toBe("a3_cria");
  expect(await jogo.js("__t.econ.lobos[0].filhote")).toBe(true);
});
