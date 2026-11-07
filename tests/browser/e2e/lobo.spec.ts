/* v7.7 — campanha C2, passo 1b (campanha/lobos.ts): a missão do lobo. A expedição garante um lobo; derrubado na
   corda, a decisão é no jogo (sem janela): esperar ele levantar na corda = domado, carregado até a saída ele vai ao
   cercado (econ.lobos) e o Caçador chama; finalizado com a faca, o Caçador lamenta e a missão volta; a primeira
   mordida rasga a roupa do peito. O finalizar só alcança perto do corpo do bicho. */
import { test, expect, entrarComHeroi, esperarAte, irAoCampo, passarDialogo } from "./comum.ts";

const missao = "__t.campanha().etapa";
const LOBO = "o=>o.alive&&o.atk==='bite'&&!o.critter&&!o.boss&&!o.kind&&!o.dummy";
const DOM = "__t.dungeon.monsters.find(o=>o.alive&&o.bound&&o.bound.dom)";

/** O lobo da expedição, laçado e sem fôlego: o laço o domina no próximo quadro. */
const DERRUBAR = `(()=>{const d=__t.dungeon, m=d.monsters.find(${LOBO}); if(!m) return false; d.monsters.forEach(o=>{if(o!==m) o.alive=false}); m.x=d.px+60; m.y=d.py; m.bound={t:0,len:80,tire:0,_ok:true}; m.ko=2; m.fol=0; m.folRes=0; return true})()`;

/** Sai pela saída verde com E (o caminho de verdade da expedição), o lobo da corda logo atrás. */
async function sairComE(jogo: Parameters<typeof irAoCampo>[0]) {
  await jogo.js(
    `(()=>{const d=__t.dungeon,m=${DOM}; d.px=d.entrance.x; d.py=d.entrance.y; if(m){m.x=d.px+75; m.y=d.py}})()`,
  );
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 4000), "saiu do campo").toBe(true);
}

async function naMissao(jogo: Parameters<typeof irAoCampo>[0]) {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js("__t.closeTitle(); __t.econ.introDone = true; __t.econ.campTut = 3; __t.campanhaIr('a3_lobo')");
  await irAoCampo(jogo);
  // expedição do preparo: os lobos vêm na 1ª horda, depois do aquecimento (no "campo" do mapa, campoPovoar garante um)
  expect(await esperarAte(jogo, `__t.dungeon.monsters.some(${LOBO})`, 12000), "chegou um lobo").toBe(true);
}

test("lobo: derrubado → levanta na corda (domado) → saída → cercado, e o Caçador chama", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  test.setTimeout(120000); // expedição, saída, acampamento e diálogo: ~60 s no SwiftShader
  await naMissao(jogo);
  expect(await jogo.js(DERRUBAR)).toBe(true);
  // o lobo de verdade: pelagem 3 (ruivo), o sexo com que nasceu e o tamanho
  const sexo = await jogo.js<string>(
    `(()=>{const m=${DOM}||__t.dungeon.monsters.find(${LOBO}); m.coat=3; m.big=1.1; return m.sex})()`,
  );
  expect(["M", "F"], "o lobo nasce com sexo").toContain(sexo);
  expect(await esperarAte(jogo, `!!${DOM}`, 2000), "caído na corda").toBe(true);
  expect(await jogo.js("document.getElementById('isc-choice')?.classList.contains('on') || false"), "sem janela").toBe(
    false,
  );
  expect(await jogo.js("__t.dungeon.modalOpen || false")).toBe(false);
  expect(await jogo.js(missao), "caído ainda não é domado").toBe("a3_lobo");
  await jogo.foto("caido");
  // levanta domado (LACO.caido s depois)
  expect(await esperarAte(jogo, `${DOM}?.bound.fase === 'domado'`, 7000), "levantou domado").toBe(true);
  expect(await jogo.js(missao)).toBe("a3_carregar");
  await jogo.foto("domado_no_campo");
  expect(await jogo.js("__t.finishTarget()"), "domado de pé não é finalizável").toBe(null);
  // a saída de verdade, não exitDungeon direto: o E na saída não pode finalizar o lobo que vem atrás
  await sairComE(jogo);
  const r = await jogo.js<[string, number, string]>(
    `[${missao}, (__t.econ.lobos||[]).length, (__t.econ.lobos||[])[0]?.dono]`,
  );
  expect(r).toEqual(["a3_cercado", 1, "cacador"]);
  // o mesmo bicho: sexo, pelagem e ficha
  const L = await jogo.js<{ sexo: string; pelagem: number; ficha: { escala: number; id: string } }>(
    "__t.econ.lobos[0]",
  );
  expect([L.sexo, L.pelagem, L.ficha.escala]).toEqual([sexo, 3, 1.1]);
  expect(L.ficha.id).toBeTruthy();
  // no acampamento: o ❗ e a fala do lobo vivo
  await jogo.esperar(1500);
  await jogo.js("__t.enterCamp(__h)");
  await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.hunter", 6000);
  await jogo.esperar(800);
  await jogo.foto("cercado_mesmo_lobo");
  await jogo.js("(()=>{const d=__t.dungeon; d.px=__t.CPS.hunter.x+20; d.py=__t.CPS.hunter.y;})()");
  await jogo.esperar(300);
  await jogo.page.keyboard.press("KeyE");
  expect(
    await esperarAte(jogo, "document.getElementById('isc-dlg').textContent.includes('vivo')", 3000),
    "fala do lobo vivo",
  ).toBe(true);
  await passarDialogo(jogo, 20);
  // v8.0: a corrente segue para a costura; o cercado vira a linha paralela dos lobos
  expect(await jogo.js(`[${missao}, __t.campanha().paralela]`)).toEqual(["a3_costura", "a3_espera"]);
});

test("lobo: sair com ele ainda caído na corda também leva ao cercado", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await naMissao(jogo);
  expect(await jogo.js(DERRUBAR)).toBe(true);
  expect(await esperarAte(jogo, `!!${DOM}`, 2000)).toBe(true);
  await sairComE(jogo);
  expect(await jogo.js(`[${missao}, (__t.econ.lobos||[]).length]`)).toEqual(["a3_cercado", 1]);
});

test("lobo: finalizar perto → o Caçador precisava dele vivo; longe não alcança", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await naMissao(jogo);
  // finalizar precisa de uma faca no cinto (v7.7, items/cinto.ts)
  await jogo.js("__t.presilhas(__t.cintoDe(__t.dungeon.hero))[0] = __t.mkItem('eq_faca')");
  expect(await jogo.js(DERRUBAR)).toBe(true);
  expect(await esperarAte(jogo, `!!${DOM}`, 2000)).toBe(true);
  // a 60 unidades do centro (o antigo 1,5 tile alcançava) o finalizar não pega
  expect(await jogo.js("__t.finishTarget()"), "longe: não alcança").toBe(null);
  // encosta no lobo e aperta E (situação e ação no mesmo js: o laço arrasta entre chamadas)
  await jogo.js(
    // v8.0: o finalizar só mata o lobo com pouca vida (FINALIZAR.mata); com muita, é o golpe fundo e ele levanta
    `(()=>{const d=__t.dungeon,m=${DOM}; d.px=m.x-Math.cos(m._yaw||0)*24; d.py=m.y-Math.sin(m._yaw||0)*24; m.bound.caiT=4; m.hp=m.hpMax*0.2;})()`,
  );
  expect(await jogo.js("!!__t.finishTarget()"), "perto: alcança").toBe(true);
  await jogo.page.keyboard.press("KeyE");
  expect(await esperarAte(jogo, `!__t.dungeon.monsters.some(${LOBO})`, 3000), "finalizado").toBe(true);
  expect(await esperarAte(jogo, "!!__t.campanha().flags.abateLimpo", 4000), "o Caçador lamenta").toBe(true);
  expect(await jogo.js(missao), "a missão segue em laçar").toBe("a3_lobo");
  expect(await jogo.js("(__t.dungeon.banner && __t.dungeon.banner.sub) || ''")).toContain("vivo");
  await jogo.foto("abatido");
});

test("lobo: a primeira mordida da missão rasga a roupa do peito", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await naMissao(jogo);
  const r = await jogo.js<[boolean, boolean, boolean]>(
    `(()=>{const d=__t.dungeon,h=d.hero,e=__t.ensureEquip(h); e.peito=__t.mkItem('eq_armadura'); const m=d.monsters.find(${LOBO}); d.invuln=0; d.hp=d.hpMax; __t.hurtPlayer(3,0,m); const rasgou=!e.peito; e.peito=__t.mkItem('eq_armadura'); d.invuln=0; __t.hurtPlayer(3,0,m); return [rasgou, !!e.peito, !!__t.campanha().flags.roupaRasgou]})()`,
  );
  expect(r, "rasga uma vez só").toEqual([true, true, true]);
});
