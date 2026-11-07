/* Tela de título, cinemática de abertura, nascimento e a cena da intro (javali, resgate, caçador, erva,
   flechas, análise da faca, acampamento).
   Portado de legacy-py: t30, t31, t32, t33, t85, tfeint, tobj, tnew, tintrom, tv64, tintro3, tintro4, tintro5 e
   tintro9 (que é a última versão de tintro, tintro6, tintro7 e tintro8: o mesmo passeio, cada vez mais longo). */
import { test, expect, esperarAte, passarDialogo, comecarIntro, entrarComHeroi, campoDireto } from "./comum.ts";

test("t30 — título: clique abre o menu, setas e opções", async ({ jogo }) => {
  await jogo.foto("titulo");
  await jogo.page.mouse.click(600, 400);
  await jogo.esperar(1200);
  expect(await jogo.js("document.getElementById('title-screen').classList.contains('menu')")).toBe(true);
  await jogo.foto("menu");
  await jogo.page.keyboard.press("ArrowDown");
  await jogo.page.keyboard.press("ArrowDown");
  await jogo.esperar(200);
  await jogo.js("document.querySelector('[data-act=options]').click()");
  await jogo.esperar(500);
  await jogo.foto("opcoes");
});

async function novoJogo(jogo: import("./comum.ts").Jogo) {
  await jogo.page.mouse.click(600, 400);
  await jogo.esperar(800);
  await jogo.js("document.querySelector('[data-act=new]').click()");
  await jogo.esperar(1000);
  expect(await jogo.js("__t.INTRO.open")).toBe(true);
}

test("t31 — abertura: slides, cinemática e a criação no fim", async ({ jogo }) => {
  test.setTimeout(150_000);
  await novoJogo(jogo);
  await jogo.esperar(1600);
  await jogo.foto("slide1");
  for (let i = 0; i < 4; i++) {
    await jogo.js("__t.INTRO.open && document.getElementById('intro').click()");
    await jogo.esperar(300);
  }
  await jogo.esperar(1500);
  await jogo.js("document.getElementById('intro').click()");
  await jogo.esperar(2500);
  for (const T of [3.0, 6.9, 10.1, 12.4, 19.0]) {
    await jogo.js(`__t.INTRO.fz = ${T}`);
    await jogo.esperar(450);
    await jogo.foto(`cine_${T}`);
  }
  await jogo.js("__t.INTRO.fz=null;__t.INTRO.t0 = performance.now() - 21.6*1000");
  await esperarAte(jogo, "!__t.INTRO.open", 5000);
  expect(await jogo.js("__t.INTRO.open")).toBeFalsy();
  await esperarAte(jogo, "document.getElementById('create-modal').classList.contains('open')", 5000);
  expect(await jogo.js("document.getElementById('create-modal').classList.contains('open')")).toBe(true);
  expect(await jogo.js("__t.world.heroes.length")).toBe(0);
  await jogo.foto("depois");
});

test("t32/t33 — pular para a cinemática e percorrê-la", async ({ jogo }) => {
  await novoJogo(jogo);
  await jogo.js("__t.INTRO.i=3; __t.INTRO.phase='text'; document.getElementById('intro').click()");
  await jogo.esperar(2200);
  await jogo.foto("slide5");
  await jogo.js("__t.INTRO.i=10; __t.INTRO.phase='text'; document.getElementById('intro').click()");
  await jogo.esperar(2000);
  for (const T of [2.5, 9.0, 12.6, 18.8]) {
    await jogo.js(`__t.INTRO.t0 = performance.now() - ${T}*1000`);
    await jogo.esperar(150);
    expect(await jogo.js<number>("(performance.now()-__t.INTRO.t0)/1000")).toBeGreaterThanOrEqual(T);
    await jogo.foto(`cine_${T}`);
  }
  for (const T of [8.0, 10.45, 12.35]) {
    await jogo.js(`__t.INTRO.fz=${T}`);
    await jogo.esperar(900);
    await jogo.foto(`fz_${T}`);
  }
});

test("t85 — playIntro + cineStart direto", async ({ jogo }) => {
  await jogo.js("__t.playIntro()");
  await jogo.esperar(800);
  await jogo.js("__t.cineStart()");
  expect(await jogo.js("__t.INTRO.phase")).toBeTruthy();
  for (const T of [6.0, 8.6, 13.5]) {
    await jogo.js(`__t.INTRO.t0=performance.now()-${T}*1000`);
    await jogo.esperar(250);
    await jogo.foto(`c_${T}`);
  }
});

test("v8.0 — a fera da runa é o coelho de fogo do Tripo (coelho_fogo.json)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem a fera feita por código");
  await jogo.js("__t.playIntro()");
  await jogo.esperar(800);
  await jogo.js("__t.cineStart()");
  await jogo.esperar(300);
  expect(await jogo.js("!!__t.INTRO.M.fogo"), "a malha do coelho de fogo foi montada").toBe(true);
  for (const T of [7.4, 11.0, 12.4, 14.5]) {
    await jogo.js(`__t.INTRO.fz=${T}`);
    await jogo.esperar(700);
    await jogo.foto(`fogo_${T}`);
  }
  await jogo.js("__t.INTRO.fz=null");
});

test("tnew — herói novo: nascimento leva à cena da intro com arco e flechas", async ({ jogo }) => {
  await jogo.js(
    "__t.enterGame(); __t.world.heroes.length=0; delete __t.econ.introDone; window.__h=__t.createHero('A',__t.bornFromSeed(1)); document.getElementById('create-modal').classList.add('open'); __t.playBirth(__h);",
  );
  await jogo.esperar(500);
  await jogo.js("__t.closeCreateModal()");
  await jogo.esperar(2500);
  expect(await jogo.js("__t.dungeon.active")).toBe(true);
  expect(await jogo.js("__t.ISC.on")).toBeTruthy();
  expect(await jogo.js("!!__t.ensureEquip(__h).maoD")).toBe(true);
  expect(await jogo.js<number>("__t.econ.quiver.n")).toBeGreaterThan(0);
});

test("tobj — andar para a direita revela o objetivo", async ({ jogo }) => {
  await comecarIntro(jogo);
  await jogo.esperar(4500);
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(1500);
  await jogo.page.keyboard.up("KeyD");
  await jogo.esperar(1200);
  expect(await jogo.js("__t.ISC.ph")).toBeTruthy();
  const r = await jogo.js<{ width: number }>("document.getElementById('isc-obj').getBoundingClientRect().toJSON()");
  expect(r.width).toBeGreaterThan(0);
});

async function ateOJavali(jogo: import("./comum.ts").Jogo) {
  await comecarIntro(jogo);
  await jogo.esperar(4500);
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(1500);
  await jogo.page.keyboard.up("KeyD");
  expect(await esperarAte(jogo, "__t.ISC.ph==='boar'", 15000, 500)).toBe(true);
  await jogo.js("__t.ISC.esq = 3"); // v8.0: sem a lição do rolamento (missoes.spec.ts testa ela)
}

test("tfeint — sem flechas o javali só ameaça; com 2 tiros ele ataca", async ({ jogo }) => {
  await ateOJavali(jogo);
  const sts = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await jogo.esperar(500);
    sts.add(await jogo.js<string>("__t.ISC.boar.st"));
  }
  expect(sts.size).toBeGreaterThan(0);
  await jogo.js("__t.ISC.shots=2");
  expect(await esperarAte(jogo, "__t.ISC.gotHit||__t.ISC.ph!=='boar'", 12000, 500)).toBe(true);
});

test("tintro3/tintro5 — o javali derruba o herói e o caçador fala", async ({ jogo }) => {
  await ateOJavali(jogo);
  await jogo.js("__t.econ.quiver.n=0");
  expect(await esperarAte(jogo, "__t.ISC.ph!=='boar'", 40000, 500)).toBe(true);
  expect(await esperarAte(jogo, "__t.ISC.ph==='talk' && __t.ISC.dlg", 15000, 500)).toBe(true);
  const falas: string[] = [];
  for (let i = 0; i < 14; i++) {
    await jogo.js("const el=document.getElementById('isc-text'); if(el) el._typing=false;");
    await jogo.esperar(150);
    falas.push(await jogo.js<string>("(document.getElementById('isc-text')||{}).textContent||''"));
    await jogo.js("__t.dlgAdvance()");
    await jogo.esperar(200);
    if ((await jogo.js("__t.ISC.ph")) === "herb") break;
  }
  expect(falas.filter((f) => f.trim()).length).toBeGreaterThan(0);
  expect(await jogo.js("__t.ISC.ph")).toBe("herb");
});

test("tintro4 — esquivar do javali correndo e rolando", async ({ jogo }) => {
  await ateOJavali(jogo);
  expect(await jogo.js("!!__t.ISC.boar")).toBe(true);
  let investiu = false;
  for (let i = 0; i < 40 && (await jogo.js("__t.ISC.ph")) === "boar"; i++) {
    const k = Math.floor(i / 4) % 2 === 0 ? "KeyW" : "KeyS";
    await jogo.page.keyboard.down(k);
    await jogo.esperar(450);
    await jogo.page.keyboard.up(k);
    if (i % 6 === 3) await jogo.page.keyboard.press("Space");
    if (!investiu && (await jogo.js("__t.ISC.boar && __t.ISC.boar.st")) === "charge") {
      investiu = true;
      await jogo.foto("investida");
    }
  }
  expect(investiu).toBe(true);
});

test.describe("celular", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test("tintrom — celular: toques no nascimento e nos diálogos", async ({ jogo }) => {
    test.setTimeout(120_000); // v8.0: o golpe e o resgate do Caçador vêm antes da conversa
    await jogo.page.touchscreen.tap(30, 300);
    await jogo.esperar(500);
    await jogo.js(
      "__t.enterGame(); __t.world.heroes.length=0; delete __t.econ.introDone; window.__h=__t.createHero('A',__t.bornFromSeed(1)); document.getElementById('create-modal').classList.add('open'); __t.playBirth(__h);",
    );
    await jogo.esperar(600);
    for (let i = 0; i < 6; i++) {
      await jogo.page.touchscreen.tap(420, 200);
      await jogo.esperar(150);
    }
    expect(
      await jogo.js("[...document.querySelectorAll('#cr-reveal .cr-step')].every(s=>s.classList.contains('show'))"),
    ).toBe(true);
    await jogo.foto("nascimento");
    await jogo.js("__t.closeCreateModal()");
    // v8.0: sem a lição do rolamento (depois de a cena começar: introSetup zera ISC.esq)
    await esperarAte(jogo, "!!__t.ISC.boar", 20000, 300);
    await jogo.js("__t.ISC.esq = 3");
    expect(await esperarAte(jogo, "__t.ISC.ph==='talk'", 40000, 600)).toBe(true);
    await jogo.foto("dialogo");
    for (let i = 0; i < 8; i++) {
      await jogo.page.touchscreen.tap(200, 150);
      await jogo.esperar(250);
    }
  });
});

test("tv64 — criar pela UI, pular a intro, sair do campo e voltar: moitas e saída", async ({ jogo }) => {
  await jogo.js(
    "__t.enterGame(); __t.openCreateModal(); document.getElementById('create-name').value='Lia'; __t.confirmCreateHero()",
  );
  await jogo.esperar(8500);
  await jogo.foto("criacao");
  await jogo.js("document.getElementById('cr-skip') && document.getElementById('cr-skip').click()");
  await jogo.esperar(1500);
  await jogo.js("__t.ISC.on && __t.iscSkip && __t.iscSkip()");
  await esperarAte(jogo, "__t.dungeon.active", 10000, 500);
  await jogo.js("__t.dungeon.active && __t.exitDungeon()");
  await jogo.esperar(2500);
  await jogo.js(
    "const h=__t.world.heroes[0]; __t.econ.campTut=3; h.state='idle'; h.x=h.camp.x; h.y=h.camp.y; __t.openPrep(h.id)",
  );
  await jogo.esperar(600);
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(5000);
  expect(await jogo.js("__t.dungeon.active")).toBe(true);
  expect(await jogo.js<number>("(__t.dungeon.bushes||[]).length")).toBeGreaterThan(0);
  await jogo.js("const d=__t.dungeon, B=d.bushes[0]; d.px=B.x; d.py=B.y; d.revealT=0");
  await jogo.esperar(500);
  expect(await jogo.js("__t.dSafe()")).toBe(true); // escondido na moita
  await jogo.foto("moita");
  await jogo.js("const d=__t.dungeon; d.px=d.entrance.x+d.tile*2.2; d.py=d.entrance.y");
  await jogo.esperar(500);
  await jogo.foto("saida");
});

test("tintro9 — a intro inteira, do javali ao acampamento", async ({ jogo }) => {
  test.setTimeout(300_000);
  await comecarIntro(jogo);
  await jogo.esperar(1500);
  await jogo.foto("i1_cine");
  await jogo.esperar(3000);
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(1500);
  await jogo.page.keyboard.up("KeyD");
  await jogo.esperar(1500);
  expect(await jogo.js("!!__t.ISC.boar")).toBe(true);
  await jogo.foto("i2_javali");
  await jogo.js("__t.econ.quiver.n=0; __t.ISC.esq = 3"); // v8.0: sem a lição do rolamento
  expect(await esperarAte(jogo, "!['boar','explore'].includes(__t.ISC.ph)", 45000, 700)).toBe(true);
  await jogo.esperar(2750);
  await jogo.foto("i4_cacador");
  expect(await esperarAte(jogo, "__t.ISC.ph==='talk'", 10000, 500)).toBe(true);
  await passarDialogo(jogo);
  await jogo.page.keyboard.press("KeyH"); // come a erva
  await jogo.esperar(2500);
  await passarDialogo(jogo);
  await jogo.js(
    "for(let i=0;i<2;i++) __t.tryAddItem(__t.dungeon.hero,'galho'); __t.resAdd(__t.dungeon.hero,'stone',2); __t.resAdd(__t.dungeon.hero,'feather',1)",
  );
  await jogo.esperar(800);
  await passarDialogo(jogo, 6);
  expect(await jogo.js("!!document.querySelector('#isc-craft.on')")).toBe(true);
  // segurar o botão fabrica flechas
  const q0 = await jogo.js<number>("__t.econ.quiver.n");
  const bb = await jogo.caixa("#ich-hold");
  await jogo.page.mouse.move(bb.x + 20, bb.y + 10);
  await jogo.page.mouse.down();
  await jogo.esperar(2500);
  await jogo.page.mouse.up();
  await jogo.esperar(200);
  expect(await jogo.js<number>("__t.econ.quiver.n")).toBeGreaterThan(q0);
  await jogo.foto("i5_flechas");
  await jogo.page.click("#isc-craft [data-ic='ok']");
  await jogo.esperar(300);
  // até a análise da faca (pelo chip do inventário, se ele aparecer)
  for (let i = 0; i < 60; i++) {
    if (await jogo.js("!!__t.ISC.dlg")) {
      await jogo.js("__t.dlgAdvance(); __t.dlgAdvance()");
      await jogo.esperar(250);
    } else if (await jogo.js("!!document.querySelector('#isc-ana.on')")) break;
    else if (await jogo.js("!!document.querySelector('.inv-ana.hot')")) {
      await jogo.page.click(".inv-ana.hot", { force: true });
      await jogo.esperar(500);
    } else await jogo.esperar(500);
  }
  expect(await jogo.js("!!document.querySelector('#isc-ana.on')")).toBe(true);
  expect(
    await jogo.js("__t.ensureEquip(__t.dungeon.hero).maoD && __t.ensureEquip(__t.dungeon.hero).maoD.def.key"),
  ).toBeTruthy();
  for (let k = 0; k < 6; k++) {
    await jogo.page.click("#isc-ana [data-ia='look']");
    await jogo.esperar(120);
  }
  await jogo.foto("i7_analise");
  await jogo.page.click("#isc-ana [data-ia='learn']");
  await jogo.esperar(300);
  expect(await jogo.js("__t.forgeKnows('eq_faca')")).toBe(true);
  expect(await jogo.js<number>("__t.profLv(__t.dungeon.hero,'percepcao')")).toBeGreaterThanOrEqual(0);
  await passarDialogo(jogo, 6);
  expect(await jogo.js("__t.econ.introDone")).toBeTruthy();
  // o caçador vai embora; na saída, E volta ao mapa
  await jogo.esperar(8000);
  await jogo.js("const d=__t.dungeon; d.px=d.entrance.x; d.py=d.entrance.y;");
  await jogo.esperar(300);
  for (let i = 0; i < 5 && !(await jogo.js("__t.ISC._toMap")); i++) {
    await jogo.page.keyboard.press("KeyE");
    await jogo.esperar(300);
  }
  await jogo.esperar(2500);
  // o jogo segue no modo campo e depois no mapa
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.mode==='campo'", 30000, 500)).toBe(true);
  await jogo.esperar(1500);
  await jogo.foto("j1_campo");
  await jogo.page.mouse.move(683, 430);
  for (let k = 0; k < 4; k++) {
    await jogo.page.mouse.wheel(0, 150);
    await jogo.esperar(80);
  }
  expect(await esperarAte(jogo, "!__t.dungeon.active", 6000, 300)).toBe(true); // a roda afasta o zoom até o mapa
  await jogo.esperar(1500);
  await jogo.foto("m1_mapa");
  const y0 = await jogo.js<number>("__t.world.heroes[0].y");
  await jogo.page.keyboard.down("KeyW");
  await jogo.esperar(700);
  await jogo.page.keyboard.up("KeyW");
  expect(await jogo.js<number>("__t.world.heroes[0].y")).toBeLessThan(y0); // WASD anda no mapa
  await jogo.esperar(400);
  // o balão do acampamento leva ao acampamento
  const bx = await jogo.js<[number, number] | null>(
    "(()=>{const B=__t.MAPCTL.bal; if(!B) return null; const vp=document.getElementById('viewport').getBoundingClientRect(); return [vp.left+B.x*__t.camera.scale+__t.camera.tx, vp.top+B.y*__t.camera.scale+__t.camera.ty]})()",
  );
  expect(bx).not.toBeNull();
  await jogo.page.mouse.click(bx![0], bx![1]);
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 20000, 500)).toBe(true);
  await jogo.esperar(2500);
  await jogo.foto("c1_acampamento");
  await passarDialogo(jogo, 6);
  // fogueira
  await jogo.js("const d=__t.dungeon; d.px=__t.CPS.fire.x-d.tile*0.9; d.py=__t.CPS.fire.y;");
  await jogo.esperar(300);
  expect(await jogo.js("__t.campNear()")).toBeTruthy();
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(500);
  expect(await jogo.js("!!document.querySelector('#fire-modal.open')")).toBe(true);
  await jogo.js("__t.fireStart('pedra')");
  await jogo.esperar(200);
  for (let i = 0; i < 30 && (await jogo.js("!!document.querySelector('#fire-modal.open')")); i++) {
    await jogo.js("const g=__t.FIRE&&__t.FIRE.mg; if(g){g.pos=g.zc}");
    await jogo.page.keyboard.press("Space");
    await jogo.esperar(260);
  }
  expect(await jogo.js("!__t.CT.unlit")).toBe(true);
  await jogo.esperar(1500);
  await passarDialogo(jogo, 6);
  await jogo.esperar(600);
  await jogo.foto("c3_inventario");
  await jogo.js("__t.toggleInv(false)");
  await jogo.esperar(1000);
  expect(await jogo.js("!!document.querySelector('#isc-choice.on')")).toBe(true);
  await jogo.page.click("#isc-choice [data-ch='1']");
  await jogo.esperar(300);
  await passarDialogo(jogo, 6);
  await jogo.js("__t.cookFinish()");
  await jogo.esperar(3600);
  await passarDialogo(jogo, 8);
  expect(await jogo.js("__t.econ.tent")).toBeTruthy();
  await jogo.js("const d=__t.dungeon; d.px=__t.CPS.anvil.x-d.tile*0.5; d.py=__t.CPS.anvil.y;");
  await jogo.esperar(300);
  expect(await jogo.js("__t.campNear()")).toBeTruthy();
  await jogo.foto("c5_fim");
});

test("v7.7 — fala do Caçador com a mochila aberta não trava (antes travava no acampamento)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem o defeito");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  // a fala chega com a mochila aberta: a mochila fecha e a fala avança
  await jogo.js("__t.toggleInv(true)");
  expect(await jogo.js("__t.dungeon.invOpen")).toBe(true);
  await jogo.js("__t.say([['Jovem, estamos bem longe da cidade.']], ()=>{ window.__fim = 1; })");
  expect(await jogo.js("__t.dungeon.invOpen"), "a fala fechou a mochila").toBe(false);
  await passarDialogo(jogo);
  expect(await jogo.js("window.__fim === 1 && !__t.ISC.dlg"), "a fala terminou").toBe(true);
  // a mochila aberta durante uma fala fecha com Esc
  await jogo.js("__t.say([['Outra fala.']], ()=>{})");
  await jogo.js("__t.toggleInv(true)");
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(200);
  expect(await jogo.js("__t.dungeon.invOpen"), "Esc fechou a mochila").toBe(false);
  await passarDialogo(jogo);
  expect(await jogo.js("!__t.ISC.dlg && !__t.dungeon.modalOpen"), "jogo livre de novo").toBe(true);
});
