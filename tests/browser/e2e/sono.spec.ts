/* v7.7 — campanha C1: dormir na barraca (campanha/sono.ts). Z perto da tenda: de dia recusa; à noite a tela escurece,
   o mundo avança até as 6h e ela acorda com vida e fôlego cheios, a fome um pouco maior e o Caçador acordado. */
import { test, expect, entrarComHeroi, esperarAte, campoDireto, campoLimpo } from "./comum.ts";

const NA_TENDA = "(()=>{const d=__t.dungeon; d.px=__t.CPS.tent.x; d.py=__t.CPS.tent.y+4; return __t.campNear()})()";
const acoes = "document.getElementById('acoes').textContent";

test("acampamento: a HUD mostra a passagem do tempo (ícone e barrinhas, sem número)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o tempo na HUD do campo");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; __t.enterCamp(__h)");
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 6000)).toBe(true);
  const tempo =
    "(()=>{const el=document.getElementById('dh-hora'); return {cls:el.className, cheias:el.querySelectorAll('b.ch').length, total:el.querySelectorAll('b').length, txt:el.textContent.replace(/[☀️🌙]/gu,'').trim(), w:el.getBoundingClientRect().width}})()";
  type Tempo = { cls: string; cheias: number; total: number; txt: string; w: number };
  // 9h: dia, faltam 10h30 até as 19h30 → 6 de 7
  await jogo.js("__t.world.tick = 24*60 + 9*60");
  expect(await esperarAte(jogo, "document.getElementById('dh-hora').classList.contains('dia')", 2000)).toBe(true);
  let t = await jogo.js<Tempo>(tempo);
  expect([t.cheias, t.total, t.txt]).toEqual([6, 7, ""]);
  expect(t.w, "visível").toBeGreaterThan(0);
  await jogo.foto("tempo_manha");
  // 18h40: entardecer, a última barrinha (laranja)
  await jogo.js("__t.world.tick = 24*60 + 18*60 + 40");
  expect(await esperarAte(jogo, "document.getElementById('dh-hora').classList.contains('tarde')", 2000)).toBe(true);
  t = await jogo.js<Tempo>(tempo);
  expect([t.cheias, t.total]).toEqual([1, 7]);
  await jogo.foto("tempo_entardecer");
  // 22h: noite, faltam 7h30 até as 5h30 → 4 de 5
  await jogo.js("__t.world.tick = 24*60 + 22*60");
  expect(await esperarAte(jogo, "document.getElementById('dh-hora').classList.contains('noite')", 2000)).toBe(true);
  t = await jogo.js<Tempo>(tempo);
  expect([t.cheias, t.total]).toEqual([4, 5]);
  await jogo.foto("tempo_noite");
  expect(
    await jogo.js(
      "(()=>{const a=document.getElementById('dh-hora').getBoundingClientRect(), b=document.getElementById('dungeon-hp-wrap').getBoundingClientRect(); return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2) < 12})()",
    ),
    "na mesma linha da vida",
  ).toBe(true);
});

test("sono: Z na tenda só à noite; pula até o amanhecer e recupera", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o dormir");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js(
    "__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true; e.hunterNap=true; __t.enterCamp(__h)",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp && !!__t.CPS.tent", 6000)).toBe(true);
  const dia = 24 * 60;
  // de dia (meio-dia): o painel avisa e o Z não faz nada
  await jogo.js(`__t.world.tick = ${dia} + 12*60`);
  expect(await jogo.js(NA_TENDA)).toBe("tenda");
  expect(await esperarAte(jogo, `${acoes}.includes('só à noite')`, 2000), "painel: só à noite").toBe(true);
  await jogo.page.keyboard.press("KeyZ");
  await jogo.esperar(300);
  expect(await jogo.js("document.getElementById('sono')?.classList.contains('on') || false")).toBe(false);

  // à noite (22h), ferida, cansada e com fome 30
  await jogo.js(
    `(()=>{const d=__t.dungeon,h=d.hero; __t.world.tick=${dia}+22*60; d.wound=8; d.hp=5; d.gstam=10; d.gint=20; h.hunger=30;})()`,
  );
  expect(await jogo.js(NA_TENDA)).toBe("tenda");
  expect(await esperarAte(jogo, `${acoes}.includes('Dormir até o amanhecer')`, 2000)).toBe(true);
  await jogo.page.keyboard.press("KeyZ");
  expect(await esperarAte(jogo, "document.getElementById('sono').classList.contains('on')", 1500), "escureceu").toBe(
    true,
  );
  await jogo.foto("dormindo");
  expect(await esperarAte(jogo, "!__t.dungeon.modalOpen", 30000), "acordou").toBe(true);
  const r = await jogo.js<Record<string, number | boolean>>(
    `(()=>{const d=__t.dungeon,h=d.hero,t=__t.world.tick; return {dia:Math.floor(t/${dia}), hora:(t%${dia})/60, cheia:d.hp===__t.hpCap(), ferida:d.wound, gstam:d.gstam, gint:d.gint, fome:Math.round(h.hunger), cochilo:!!__t.econ.hunterNap}})()`,
  );
  // ~22h → 6h ≈ 8 h: fome 30 + 8×2 ≈ 46; ferida 8 − 8×10 → 0 (o relógio anda um pouco no escurecer e no clarear)
  expect(r.hora as number, "acordou às 6h").toBeGreaterThanOrEqual(6);
  expect(r.hora as number).toBeLessThan(6.5);
  expect(r.fome as number).toBeGreaterThanOrEqual(45);
  expect(r.fome as number).toBeLessThanOrEqual(46);
  expect({ ...r, hora: 0, fome: 0 }).toEqual({
    dia: 2,
    hora: 0,
    cheia: true,
    ferida: 0,
    gstam: 100,
    gint: 100,
    fome: 0,
    cochilo: false,
  });
  await jogo.foto("amanheceu");
});

test("aviso da noite: longe do acampamento, às 17h e às 19h30, uma vez cada", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o aviso");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await campoLimpo(jogo);
  const dia = 24 * 60,
    banner = "(__t.dungeon.banner && __t.dungeon.banner.text) || ''";
  await jogo.js(`__t.econ.campTut = 3; __t.world.tick = ${dia} + 16*60`);
  await jogo.esperar(600);
  expect(await jogo.js(banner), "antes das 17h, nada").toBe("");
  await jogo.js(`__t.world.tick = ${dia} + 17*60 + 1`);
  expect(await esperarAte(jogo, `${banner}.includes('escurecendo')`, 2000), "escurecendo").toBe(true);
  await jogo.foto("escurecendo");
  await jogo.js("__t.dungeon.banner = null");
  await jogo.esperar(600);
  expect(await jogo.js(banner), "não repete").toBe("");
  await jogo.js(`__t.world.tick = ${dia} + 19*60 + 31`);
  expect(await esperarAte(jogo, `${banner}.includes('Anoiteceu')`, 2000), "anoiteceu").toBe(true);
});

test("aviso da noite no mapa: só com a heroína longe da base", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o aviso");
  await entrarComHeroi(jogo, "Ayla", 777);
  const dia = 24 * 60,
    toast = "document.getElementById('mv-toast')?.textContent || ''";
  // na base: nada
  await jogo.js(
    `(()=>{__t.closeTitle(); __t.econ.campTut=3; const h=__h; h.x=h.camp.x; h.y=h.camp.y; __t.world.tick=${dia}+17*60+1;})()`,
  );
  await jogo.esperar(800);
  expect(await jogo.js(toast)).not.toContain("escurecendo");
  // longe da base, na noite seguinte
  await jogo.js(
    `(()=>{const h=__h; h.x=h.camp.x+120; h.y=h.camp.y; h.task=null; __t.world.tick=${2 * dia}+17*60+1;})()`,
  );
  expect(await esperarAte(jogo, `(${toast}).includes('escurecendo')`, 2000), "avisou no mapa").toBe(true);
});
