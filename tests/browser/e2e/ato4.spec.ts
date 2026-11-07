/* v8.0 — campanha, ponte do Ato 3 para o 4 (data/campanha.ts a3_armadura → a4_vila → a4_vender → a5_taverna;
   mantenedor, 2026-10-24: "logo depois do Ato 3, ou quando juntar 100 em gold no baú"; e, no mesmo dia, "a missão do
   lobo atrasa a história": os lobos viraram linha paralela). Forjar a armadura de couro termina o Ato 3; dormir com
   a a3_cria fecha só a linha dos lobos. O Caçador chama e manda vender na vila a pé (o bote fica furado:
   campanha.flags.boteFurado); vender no Empório conclui. Dormir ou vender não pulam o Ato 3; o baú com 100+ só avisa. */
import { test, expect, entrarComHeroi, esperarAte, passarDialogo } from "./comum.ts";

const missao = "__t.campanha().etapa";

test("Ato 3 → 4: a armadura fecha o Ato 3, o Caçador manda vender a pé, vender na vila conclui", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  test.setTimeout(120_000);
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.hunterNap=false;");

  // no meio do Ato 3, dormir e vender na vila NÃO pulam missões
  await jogo.js("__t.campanhaIr('a3_lobo'); __t.campanhaEvento('dormiu');");
  expect(await jogo.js(missao), "dormir no Ato 3 não pula").toBe("a3_lobo");

  // na armadura, com a linha dos lobos no fim (a3_cria): dormir fecha só os lobos
  await jogo.js("__t.campanhaIr('a3_armadura'); __t.campanhaIr('a3_cria'); __t.enterCamp(__h)");
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.tent", 6000)).toBe(true);
  const dia = 24 * 60;
  await jogo.js(
    `(()=>{const d=__t.dungeon; __t.world.tick=${dia}+22*60; d.px=__t.CPS.tent.x; d.py=__t.CPS.tent.y+__t.dungeon.tile*0.6;})()`,
  );
  await jogo.page.keyboard.press("KeyZ");
  expect(await esperarAte(jogo, "__t.campanha().paralela===null", 30000), "a linha dos lobos fechou").toBe(true);
  expect(await jogo.js(missao), "a corrente principal não pulou").toBe("a3_armadura");
  // fim do Ato 3: forjar a armadura de couro
  await jogo.js("__t.campanhaEvento('forjou_eq_armadura')");
  expect(await esperarAte(jogo, `${missao}==='a4_vila'`, 3000), "Ato 4").toBe(true);
  await jogo.esperar(800);

  // o Caçador chama (❗): a fala e o bote furado
  expect(await jogo.js("__t.atenderChamado()")).toBe(true);
  await passarDialogo(jogo, 8);
  expect(await esperarAte(jogo, `${missao}==='a4_vender'`, 3000), "missão de vender").toBe(true);
  expect(await jogo.js("!!__t.campanha().flags.boteFurado"), "o bote está furado").toBe(true);
  await jogo.foto("vender");

  // o bote não atravessa
  await jogo.js("__t.exitDungeon()");
  expect(await esperarAte(jogo, "!__t.dungeon.active", 6000)).toBe(true);
  await jogo.esperar(1200);
  const antes = await jogo.js<number[]>("[__h.x, __h.y]");
  await jogo.js("__h.state='field'; __t.boteViagem(__h, 'vila')");
  await jogo.esperar(1500);
  expect(await jogo.js<number[]>("[__h.x, __h.y]"), "o bote não levou").toEqual(antes);

  // a pé na vila: vender uma pele no Empório conclui
  await jogo.js(
    "(()=>{const c=__t.musgoCity(), h=__h; h.x=c.x; h.y=c.y; h.state='idle'; __t.tryAddToInv(__t.ensureInv(h),'pele',0); __t.empOpen(h);})()",
  );
  await jogo.page.click("#musgo-modal [data-t='venda']");
  await jogo.page.click("#musgo-modal [data-mz='sell']");
  expect(await esperarAte(jogo, `${missao}==='a5_taverna'`, 3000), "vendeu: Ato 4 concluído").toBe(true);
});

test("baú com 100+ de ouro no Ato 3: só um aviso, sem pular missões", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a campanha");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "(()=>{__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; __t.campanhaIr('a3_lobo'); for(let i=0;i<12;i++) __t.tryAddToInv(e.stash,'pele',2);})()",
  );
  expect(await esperarAte(jogo, "!!__t.campanha().flags.avisoBau", 8000), "avisou do baú").toBe(true);
  expect(await jogo.js(missao), "sem pular").toBe("a3_lobo");
});
