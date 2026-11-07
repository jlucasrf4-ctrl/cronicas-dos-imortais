/* v7.7 — campanha C2 (campanha/cercado.ts): o cercado dos lobos no acampamento. Aparece com um lobo em econ.lobos;
   ver o cercado e dar carne andam com a campanha; a cerca bloqueia e a heroína entra/sai só pela porteira aberta;
   com ela aberta, lobo com vínculo abaixo de 2 foge (o do Caçador volta no dia seguinte) e com 2 ou mais não; o
   Caçador trata todo dia (pontos por dia que passa) e a carne da mão dá mais; o vínculo sobe pelos pontos. */
import { test, expect, entrarComHeroi, esperarAte, menuLobo, darComidaAoLobo } from "./comum.ts";

const missao = "__t.campanha().paralela"; // v8.0: o cercado é da linha paralela dos lobos
const acoes = "document.getElementById('acoes').textContent";
/** Centro do cercado (CERCADO.dx/dy a partir da fogueira, em tiles) e as meias medidas (CERCADO.mw/mh). */
const CENTRO =
  "(()=>{const d=__t.dungeon,F=__t.CPS.fire,T=d.tile; return {x:F.x+4*T, y:F.y-1.6*T, w:1.5*T, h:1.1*T, T}})()";
type Ret = { x: number; y: number; w: number; h: number; T: number };
/** Põe a heroína em (x, y). */
const em = (x: number, y: number) => `(()=>{const d=__t.dungeon; d.px=${x}; d.py=${y};})()`;

async function noCercado(jogo: Parameters<typeof entrarComHeroi>[0], pontos: number, etapa: string) {
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    `__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.lobos=[{sexo:'M',pelagem:2,vinculo:0,dono:'cacador',desde:__t.world.tick,pontos:${pontos},diaCacador:Math.floor(__t.world.tick/1440)}]; __t.campanhaIr('${etapa}'); __t.enterCamp(__h)`,
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.fire", 6000)).toBe(true);
  return jogo.js<Ret>(CENTRO);
}

test("cercado: lobo dentro, a cerca bloqueia, carne da mochila e o vínculo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  const C = await noCercado(jogo, 0, "a3_espera");
  // perto da cerca (por baixo, longe da porteira): a campanha vê o cercado e pede para alimentar; o E abre o menu
  // do lobo e, sem comida, "Dar comida" fica apagado
  await jogo.js(em(C.x, C.y + C.h + 0.6 * C.T));
  expect(await esperarAte(jogo, `${missao} === 'a3_alimentar'`, 3000), "viu o cercado").toBe(true);
  expect(await esperarAte(jogo, `${acoes}.includes('Lobo · opções')`, 2000), "painel").toBe(true);
  const ops = await menuLobo(jogo);
  expect(
    ops.some((t) => t.includes("Dar comida") && t.includes("sem comida")),
    "sem comida",
  ).toBe(true);
  expect(await jogo.js("document.querySelector('#lobo-menu button:nth-of-type(2)').disabled")).toBe(true);
  await jogo.foto("cercado-menu");
  await jogo.page.keyboard.press("Escape");
  expect(await jogo.js("!document.getElementById('lobo-menu') && !__t.dungeon.modalOpen"), "fechou").toBe(true);
  // com a porteira fechada não entra: posta no meio do cercado, sai pela borda
  await jogo.js(em(C.x + 3, C.y + 2));
  await jogo.esperar(300);
  expect(
    await jogo.js(`(()=>{const d=__t.dungeon; return Math.abs(d.px-${C.x})>${C.w} || Math.abs(d.py-${C.y})>${C.h}})()`),
    "empurrada para fora",
  ).toBe(true);
  // com carne: menu → Dar comida → escolhe na mochila (1 ponto), a missão avança, e no mesmo dia já comeu
  await jogo.js(`__t.tryAddToInv(__t.ensureInv(__t.dungeon.hero),'carne',0)`);
  await jogo.js(em(C.x, C.y + C.h + 0.6 * C.T));
  expect(await esperarAte(jogo, `${acoes}.includes('Lobo · opções')`, 2000)).toBe(true);
  await darComidaAoLobo(jogo, "carne");
  expect(await jogo.js("!__t.dungeon.invOpen"), "a mochila fecha").toBe(true);
  expect(await jogo.js(missao)).toBe("a3_vinculo");
  expect(await jogo.js("__t.econ.lobos[0].pontos")).toBe(1);
  expect(
    (await menuLobo(jogo)).some((t) => t.includes("já comeu hoje")),
    "um por dia",
  ).toBe(true);
  await jogo.page.keyboard.press("Escape");
  // 3 dias depois: o Caçador tratou (3 pontos) → 4 pontos = vínculo 1; o painel mostra
  await jogo.js(`__t.world.tick += 3 * 24 * 60`);
  expect(await esperarAte(jogo, `${acoes}.includes('vínculo 1/4')`, 2000), "vínculo 1").toBe(true);
  expect(await jogo.js("__t.econ.lobos[0].pontos")).toBe(4);
});

test("porteira: abre com E, a heroína entra e sai só por ela; lobo de vínculo 0 foge e o Caçador recupera", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  const C = await noCercado(jogo, 0, "a3_vinculo");
  const fora = { x: C.x - C.w - 0.5 * C.T, y: C.y },
    dentro = { x: C.x - C.w + 0.6 * C.T, y: C.y };
  await jogo.js(em(fora.x, fora.y));
  expect(await esperarAte(jogo, `${acoes}.includes('Abrir a porteira')`, 2000), "painel: abrir").toBe(true);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(200);
  // o lobo de vínculo 0 corre para a porteira aberta e foge
  expect(await esperarAte(jogo, "(__t.econ.lobos||[]).length === 0", 6000), "fugiu").toBe(true);
  await jogo.foto("porteira-aberta");
  expect(await jogo.js("(__t.econ.lobosFugidos||[]).length")).toBe(1);
  // entra pela porteira aberta; fecha por dentro; não sai pela cerca
  await jogo.js(em(dentro.x, dentro.y));
  await jogo.esperar(200);
  await jogo.js(em(dentro.x - 0.2 * C.T, dentro.y));
  expect(await esperarAte(jogo, `${acoes}.includes('Fechar a porteira')`, 2000)).toBe(true);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(200);
  await jogo.js(em(C.x - C.w - C.T, C.y + 0.8 * C.h)); // tenta passar pela cerca
  await jogo.esperar(200);
  expect(await jogo.js(`__t.dungeon.px > ${C.x - C.w}`), "a cerca segura por dentro").toBe(true);
  // no dia seguinte o Caçador o traz de volta
  await jogo.js("__t.world.tick += 24 * 60 + 5");
  expect(await esperarAte(jogo, "(__t.econ.lobos||[]).length === 1", 2000), "voltou").toBe(true);
  expect(await jogo.js("(__t.econ.lobosFugidos||[]).length")).toBe(0);
});

test("porteira: com vínculo 2 o lobo não tenta fugir", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  const C = await noCercado(jogo, 8, "a3_vinculo"); // 8 pontos = vínculo 2
  await jogo.js(em(C.x - C.w - 0.5 * C.T, C.y));
  expect(await esperarAte(jogo, `${acoes}.includes('Abrir a porteira')`, 2000)).toBe(true);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(4000);
  expect(await jogo.js("[(__t.econ.lobos||[]).length, (__t.econ.lobosFugidos||[]).length]")).toEqual([1, 0]);
});

/** O 1º lobo do cercado: posição, se está solto (fora), na coleira, e a distância até a heroína em tiles. */
const LOBO0 =
  "(()=>{const b=__t.cercadoBichos().bichos[0], d=__t.dungeon; return b ? {x:b.x, y:b.y, fora:!!b.fora, guiado:!!b.guiado, dist:Math.hypot(b.x-d.px,b.y-d.py)/d.tile} : null})()";

test("vínculo 2: solto pelo acampamento; você entra no cercado e ele vem atrás", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  const C = await noCercado(jogo, 8, "a3_vinculo");
  expect(await esperarAte(jogo, `${LOBO0} && ${LOBO0}.fora`, 3000), "solto").toBe(true);
  const L = (await jogo.js<{ x: number; y: number }>(LOBO0))!;
  expect(Math.abs(L.x - C.x) > C.w || Math.abs(L.y - C.y) > C.h, "fora da cerca").toBe(true);
  await jogo.foto("lobo-solto");
  // abre a porteira e entra: ele vem pela porteira e fica perto
  await jogo.js(em(C.x - C.w - 0.5 * C.T, C.y));
  expect(await esperarAte(jogo, `${acoes}.includes('Abrir a porteira')`, 2000)).toBe(true);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(200);
  await jogo.js(em(C.x - C.w + 0.6 * C.T, C.y));
  await jogo.esperar(200);
  await jogo.js(em(C.x + 0.5 * C.T, C.y));
  expect(await esperarAte(jogo, "__t.cercadoBichos().dentro", 1000), "entrou").toBe(true);
  expect(await esperarAte(jogo, `!${LOBO0}.fora && ${LOBO0}.dist < 2`, 10000), "veio atrás, lá dentro").toBe(true);
  await jogo.foto("lobo-segue-no-cercado");
  expect(await jogo.js("(__t.econ.lobos||[]).length"), "não fugiu").toBe(1);
});

test("menu do lobo: afagar dá vínculo uma vez por dia; coleira: vem atrás e, solto da corda, fica solto", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  const C = await noCercado(jogo, 8, "a3_vinculo");
  expect(await esperarAte(jogo, `${LOBO0} && ${LOBO0}.fora`, 3000)).toBe(true);
  // o lobo parado embaixo do cercado, longe das estações; você ao lado dele
  const P = { x: C.x, y: C.y + C.h + 2.2 * C.T };
  await jogo.js(
    `(()=>{const b=__t.cercadoBichos().bichos[0]; b.x=${P.x}; b.y=${P.y}; b.alvo={x:${P.x},y:${P.y}}; b.t=999; const d=__t.dungeon; d.px=${P.x + 0.8 * C.T}; d.py=${P.y};})()`,
  );
  expect(await esperarAte(jogo, `${acoes}.includes('Lobo · opções')`, 2000), "painel").toBe(true);
  const ops = await menuLobo(jogo, "Afagar");
  expect(ops.map((t) => t.replace(/^\d/, "").split(/[a-z]{2,} /i)[0]).length).toBeGreaterThanOrEqual(3);
  expect(
    ops.some((t) => t.includes("Conduzir")),
    "tem coleira",
  ).toBe(true);
  expect(
    ops.some((t) => t.includes("Soltar este lobo")),
    "o do Caçador você não solta",
  ).toBe(false);
  expect(await jogo.js("__t.econ.lobos[0].pontos")).toBe(9);
  await menuLobo(jogo, "Afagar");
  expect(await jogo.js("__t.econ.lobos[0].pontos"), "uma vez por dia").toBe(9);
  // coleira: você anda e ele vem atrás, a uma corda de distância
  await menuLobo(jogo, "Conduzir");
  expect(await jogo.js(`${LOBO0}.guiado`)).toBe(true);
  for (let i = 1; i <= 6; i++) {
    await jogo.js(em(P.x + 0.8 * C.T + i * 0.5 * C.T, P.y + i * 0.3 * C.T));
    await jogo.esperar(150);
  }
  expect(await esperarAte(jogo, `${LOBO0}.dist < 1.6`, 3000), "veio atrás").toBe(true);
  await jogo.foto("coleira");
  expect(await jogo.js(`${acoes}`)).toContain("Lobo na coleira");
  await menuLobo(jogo, "Soltar a corda");
  expect(await jogo.js(`[${LOBO0}.guiado, ${LOBO0}.fora]`), "solto pelo acampamento").toEqual([false, true]);
});

test("coleira num lobo de vínculo 0: solto da corda fora do cercado, ele volta para dentro", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  const C = await noCercado(jogo, 0, "a3_vinculo");
  // abre a porteira com você dentro (para ele não fugir antes, a coleira já no lugar) — o teste põe a coleira direto
  await jogo.js(
    `(()=>{const b=__t.cercadoBichos().bichos[0]; b.x=${C.x - C.w - 1.5 * C.T}; b.y=${C.y + 1.5 * C.T}; b.fora=true; b.alvo=null; const d=__t.dungeon; d.px=b.x+0.8*d.tile; d.py=b.y;})()`,
  );
  await jogo.esperar(300);
  expect(await esperarAte(jogo, `!${LOBO0}.fora`, 8000), "voltou para o cercado").toBe(true);
  const L = (await jogo.js<{ x: number; y: number }>(LOBO0))!;
  expect(Math.abs(L.x - C.x) < C.w && Math.abs(L.y - C.y) < C.h, "lá dentro").toBe(true);
});

/** Quantos filhotes do Caçador existem (no cercado e fugidos) e quantos lobos ao todo. */
const CONTA =
  "(()=>{const e=__t.econ, todos=[...(e.lobos||[]), ...(e.lobosFugidos||[]).map(f=>f.L)]; return {filhotes:todos.filter(L=>L.filhote&&L.dono==='cacador').length, total:todos.length}})()";

test("porteira aberta com o filhote de vínculo 0: ele foge e volta, mas não nasce outro (não multiplica)", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  // como no save do mantenedor: o casal no vínculo 4, o filhote recém-nascido, sem a marca de "já nasceu"
  await jogo.js(
    "(()=>{__t.closeTitle(); const e=__t.econ, t=__t.world.tick, hoje=Math.floor(t/1440); e.introDone=true; e.campTut=3; e.tent=true; e.pedidoProx=1e9; const L=(o)=>Object.assign({vinculo:0,dono:'cacador',desde:t,diaCacador:hoje},o); e.lobos=[L({sexo:'M',pelagem:2,pontos:25}),L({sexo:'F',pelagem:0,pontos:25}),L({sexo:'F',pelagem:2,pontos:0,filhote:true,prazo:t+5*1440})]; __t.campanhaIr('a3_soltar'); const C=__t.campanha(); C.feitas.a3_pedido=1; C.flags.segundoLobo=true; __t.enterCamp(__h);})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.fire", 6000)).toBe(true);
  const C = await jogo.js<Ret>(CENTRO);
  await jogo.js(em(C.x - C.w - 0.5 * C.T, C.y));
  expect(await esperarAte(jogo, `${acoes}.includes('Abrir a porteira')`, 2000)).toBe(true);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(5000);
  expect(await jogo.js(CONTA), "o filhote fugiu, mas é um só").toEqual({ filhotes: 1, total: 3 });
  // os dias passam com a porteira aberta: ele volta e foge de novo, sem nascer outro
  for (let i = 0; i < 2; i++) {
    await jogo.js("__t.world.tick += 1441");
    await jogo.esperar(2500);
  }
  expect(await jogo.js(CONTA)).toEqual({ filhotes: 1, total: 3 });
});

test("save com filhotes repetidos (o bug de antes): fica só um", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "(()=>{__t.closeTitle(); const e=__t.econ, t=__t.world.tick; e.introDone=true; e.campTut=3; e.pedidoProx=1e9; const f=()=>({sexo:'F',pelagem:2,vinculo:0,dono:'cacador',desde:t,pontos:0,filhote:true}); e.lobos=[{sexo:'M',pelagem:2,vinculo:0,dono:'cacador',desde:t,pontos:25},f(),f(),f()]; e.lobosFugidos=[{L:f(),volta:1e12},{L:f(),volta:1e12}];})()",
  );
  expect(await esperarAte(jogo, "JSON.stringify(" + CONTA + ") === JSON.stringify({filhotes:1,total:2})", 3000)).toBe(
    true,
  );
});
