/* Acampamento (entrar com zoom, fogueira, cozinhar, bigorna, carpintaria, mesa, sair), cupinzeiros, fogueira no
   campo, ferida e fome, tamanduá (domar, nome, painel, bolsa, montar, IA, escovar), interface de celular (abas,
   pinça, joystick, botões editáveis), javali (investida, rolar, escudo, parry).
   Portado de legacy-py: tcamp, tcamp2, tcamp3, tcamp4, tcamp5, tcampv, tE, tfire, tsurv, tgs, trodeo, ttam, ttam2,
   tai, tcoat, tmob, t83, t84, tbtn, tbtn2, tboar, tboar2. */
import { test, expect, entrarComHeroi, irAoCampo, esperarAte, type Jogo } from "./comum.ts";

async function noAcampamento(jogo: Jogo, extra = "") {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js(`${extra} __t.enterCamp(__h)`);
  expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 8000, 250)).toBe(true);
  await jogo.esperar(1000);
}

test("tcamp — acampamento: fogueira, cozinhar, bigorna, ferida, sair", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  expect(await jogo.js<number>("__t.termiteList().length")).toBeGreaterThan(0);
  await jogo.js("__t.enterCamp(__h)");
  await jogo.esperar(3500);
  expect(await jogo.js("__t.dungeon.active && __t.dungeon.camp")).toBe(true);
  await jogo.foto("acampamento");
  await jogo.js("const d=__t.dungeon; d.px=__t.CPS.fire.x-30; d.py=__t.CPS.fire.y");
  await jogo.esperar(400);
  expect(await jogo.js("__t.campNear()")).toBeTruthy();
  await jogo.js("__t.econ.test=true; __t.interact()");
  await jogo.esperar(500);
  expect(await jogo.js("__t.CAMP.open")).toBeTruthy();
  await jogo.js("__h.loot=__h.loot||{}; __h.loot.meat=3; __t.campAct('cook')");
  await jogo.esperar(2500);
  await jogo.foto("cozinha");
  await jogo.js("const k=__t.CAMP.cook; k.a=0.85; k.b=0.8; __t.cookFinish()");
  await jogo.esperar(300);
  expect(
    await jogo.js<number>("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='carne_assada').length"),
  ).toBeGreaterThan(0);
  await jogo.js("__t.campClose(); const d=__t.dungeon; d.px=__t.CPS.anvil.x+5; d.py=__t.CPS.anvil.y+20");
  await jogo.esperar(300);
  expect(await jogo.js("__t.campNear()")).toBeTruthy();
  await jogo.js("__t.interact()");
  await jogo.esperar(800);
  await jogo.foto("bigorna");
  await jogo.js(
    "document.querySelectorAll('.v3-modal.open').forEach(m=>m.classList.remove('open')); __t.dungeon.modalOpen=false",
  );
  // ferida: o golpe baixa o teto de vida
  const f = await jogo.js<{ w: number; cap: number; max: number }>(
    "(()=>{const d=__t.dungeon; d.camp=false; d.hp=d.hpMax; d.wound=0; d.training=false; d.invuln=0; __t.hurtPlayer(20,0,null); const r={w:d.wound, cap:__t.hpCap(), max:d.hpMax}; d.camp=true; return r})()",
  );
  expect(f.w).toBeGreaterThan(0);
  expect(f.cap).toBeLessThan(f.max);
  await jogo.js("const d=__t.dungeon; d.px=d.entrance.x; d.py=d.entrance.y; __t.interact()");
  await jogo.esperar(2500);
  expect(await jogo.js("__t.dungeon.active")).toBe(false);
  await jogo.foto("de-volta");
});

test("v7.7 — assar tira a carne da mochila aberta; o bicho e a qualidade mudam a cura", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 tem o defeito");
  await noAcampamento(jogo);
  // como no tutorial: o Caçador dá a carne de javali SS e a mochila fica aberta
  await jogo.js(
    "const h=__t.dungeon.hero; __t.tryAddToInv(__t.ensureInv(h),'carne',2); __t.ensureInv(h).items.at(-1).an='javali'; __t.toggleInv(true)",
  );
  const naTela = "document.querySelectorAll('#inv-grid .inv-item').length";
  const n0 = await jogo.js<number>(naTela);
  await jogo.js("__t.CAMP.noWood=true; __t.campOpen(); __t.campAct('cook')");
  expect(await jogo.js<number>(naTela), "a carne saiu da mochila na tela").toBe(n0 - 1);
  await jogo.js("const k=__t.CAMP.cook; k.a=0.85; k.b=0.85; __t.cookFinish()");
  expect(await jogo.js<number>(naTela), "a carne assada apareceu na mochila").toBe(n0);
  const assada = await jogo.js<{ qc: number; an: string; tier: number }>(
    "(()=>{const it=__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='carne_assada'); return {qc:it.qc, an:it.an, tier:it.tier}})()",
  );
  expect(assada).toEqual({ qc: 2, an: "javali", tier: 2 });
  // carnes assadas diferentes curam diferente
  const cura = await jogo.js<number[]>(
    "(()=>{const d=__t.ITEM_DEFS.carne_assada, v=(an,qc,tier)=>__t.valorComida({def:d,an,qc,tier}).wound; return [v('coelho',0,0), v('javali',0,0), v('javali',2,0), v('javali',2,2)]})()",
  );
  expect(new Set(cura).size).toBe(4);
  expect(cura[0]).toBeLessThan(cura[1]);
  expect(cura[2]).toBeLessThan(cura[3]);
});

test("tcamp2/tcamp3/tcamp4 — o botão do acampamento aproxima o zoom e entra; cupinzeiro de perto", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.esperar(700);
  await jogo.js(
    "window.__log=[]; const t0=performance.now(); (function f(){ __log.push([performance.now()-t0, __t.camera.scale, __t.dungeon.active]); if(performance.now()-t0<1600) requestAnimationFrame(f); })(); document.querySelector('[data-act=camp]').click()",
  );
  await jogo.esperar(1800);
  const log = await jogo.js<[number, number, boolean][]>("__log");
  expect(log[log.length - 1][1]).toBeGreaterThan(log[0][1]); // o zoom aproxima antes de entrar
  expect(await esperarAte(jogo, "__t.dungeon.camp", 5000, 250)).toBe(true);
  await jogo.js("const d=__t.dungeon; d.px=d.entrance.x; d.py=d.entrance.y; __t.interact()");
  await jogo.esperar(3000);
  await jogo.js(
    "const t=__t.termiteList()[0], s=__t.camera.minScale*8; __t.camera.scale=s; __t.camera.tx=683-t.x*s; __t.camera.ty=430-t.y*s;",
  );
  await jogo.esperar(800);
  await jogo.foto("cupinzeiro");
});

test("tcamp5/tE — ferramentas (carpintaria), mesa (análise), E pega a pedra antes de abrir a fogueira", async ({
  jogo,
}) => {
  await noAcampamento(jogo, "__t.gsRun('MESA'); __t.econ.test=true;");
  await jogo.js("const d=__t.dungeon; d.px=__t.CPS.tools.x-30; d.py=__t.CPS.tools.y+10;");
  await jogo.esperar(800);
  expect(await jogo.js("__t.campNear()")).toBeTruthy();
  await jogo.js("__t.interact()");
  await jogo.esperar(500);
  expect(await jogo.js("!!document.querySelector('#carp-modal.open')")).toBe(true);
  expect(await jogo.js("__t.dungeon.modalOpen")).toBeTruthy();
  await jogo.js("document.getElementById('carp-modal').classList.remove('open')");
  await jogo.esperar(500);
  expect(await jogo.js("__t.dungeon.modalOpen")).toBeFalsy();
  await jogo.js("const d=__t.dungeon; d.px=__t.CPS.mesa.x+25; d.py=__t.CPS.mesa.y;");
  await jogo.esperar(500);
  await jogo.js("__t.interact()");
  await jogo.esperar(400);
  expect(await jogo.js("!!document.querySelector('#ana-modal.open')")).toBe(true);
  await jogo.js("document.getElementById('ana-modal').classList.remove('open'); __t.dungeon.modalOpen=false");
  await jogo.esperar(400);
  // tE: pedra no chão perto da fogueira: o primeiro E pega a pedra
  await jogo.js(
    "const d=__t.dungeon, F=__t.CPS.fire, T=d.tile; d.px=F.x-T*1.2; d.py=F.y; d.loot.push({key:'pedra',x:d.px-6,y:d.py,ground:true,t:0,ttl:0})",
  );
  const n = await jogo.js<number>("__t.dungeon.loot.length");
  await jogo.js("__t.interact()");
  await jogo.esperar(300);
  expect(await jogo.js<number>("__t.dungeon.loot.length")).toBeLessThan(n);
  expect(await jogo.js("!!(__t.CAMP&&__t.CAMP.open)")).toBe(false);
  await jogo.js("__t.interact()");
  await jogo.esperar(300);
  expect(await jogo.js("!!(__t.CAMP&&__t.CAMP.open)")).toBe(true);
});

for (const tenda of [false, true]) {
  test(`tcampv — acampamento do caçador, tenda ${tenda ? "montada" : "não montada"}`, async ({ jogo }) => {
    await noAcampamento(jogo, `__t.econ.hunterCamp=true; __t.econ.tent=${tenda};`);
    await jogo.esperar(2000);
    await jogo.foto("acampamento");
  });
}

test("tfire — fogueira no campo: pedra, atrito e fogo aceso", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 3500);
  await jogo.js("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; __t.econ.test=true; __t.fireOpen()");
  await jogo.esperar(400);
  expect(await jogo.js("!!document.querySelector('#fire-modal.open')")).toBe(true);
  await jogo.js("__t.fireStart('pedra')");
  await jogo.esperar(300);
  await jogo.js("const g=__t.FIRE.mg; g.pos=g.zc; __t.fireKey('hit')");
  await jogo.esperar(120);
  await jogo.foto("pedra");
  await jogo.js("__t.fireClose(); __t.fireOpen(); __t.fireStart('galho')");
  for (let i = 0; i < 14; i++) {
    await jogo.js(`__t.fireKey('${i % 2 === 0 ? "L" : "R"}')`);
    await jogo.esperar(150);
  }
  await jogo.foto("atrito");
  await jogo.js("__t.fireClose(); const d=__t.dungeon; d.fires=[{x:d.px+40,y:d.py,t:100,max:130}]");
  await jogo.esperar(900);
  await jogo.foto("fogo");
});

test("tsurv — com fome a ferida não fecha e o HUD mostra", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await irAoCampo(jogo, 3500);
  await jogo.js(
    "const d=__t.dungeon; d.monsters.forEach(m=>m.alive=false); d.invuln=0; __h.hunger=70; __t.hurtPlayer(25,0,null); d.sinceHurt=0",
  );
  await jogo.esperar(9000);
  const r = await jogo.js<{ hp: number; cap: number; hud: string }>(
    "({hp:__t.dungeon.hp, cap:__t.hpCap(), hud:document.getElementById('surv-hud').textContent})",
  );
  expect(r.hp).toBeLessThanOrEqual(r.cap);
  expect(r.hud).toBeTruthy();
  await jogo.foto("hud", { x: 0, y: 0, width: 700, height: 110 });
});

test("tgs/trodeo/ttam — domar o tamanduá, dar nome, painel, bolsa, montar e ele seguir", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  expect(await jogo.js<number>("__t.wildAnteaters().length")).toBeGreaterThan(0);
  await jogo.js(
    "const a=__t.wildAnteaters()[0], p=__t.wildPos(a); const s=__t.camera.minScale*10; __t.camera.scale=s; __t.camera.tx=683-p.x*s; __t.camera.ty=430-p.y*s;",
  );
  await jogo.esperar(900);
  await jogo.foto("no-mapa");
  await jogo.js("__t.tameStart(__t.wildAnteaters()[0])");
  await jogo.esperar(1500);
  await jogo.js("__t.tameGo()");
  await jogo.esperar(900);
  expect(await jogo.js("!!__t.TAME.g")).toBe(true);
  await jogo.js("__t.TAME.g.anim={a:8,b:9,t:0}; __t.TAME.g.txt={t:'Giro para a esquerda!',k:1}");
  await jogo.esperar(120);
  await jogo.foto("rodeio");
  await jogo.js("__t.TAME.g.anim=null; __t.tameWin()");
  await jogo.esperar(200);
  await jogo.js("__t.tameName()");
  await jogo.esperar(300);
  expect(await jogo.js("!!__t.mnt()")).toBe(true);
  await jogo.js("__t.mountPanel()");
  await jogo.esperar(500);
  await jogo.foto("painel");
  await jogo.js("document.querySelector('[data-mt=bag]').click()");
  await jogo.esperar(500);
  await jogo.foto("bolsa");
  await jogo.js("__t.mpClose(); __t.mnt().with=__h.id; __t.openPrep(__h.id)");
  await jogo.esperar(600);
  expect(await jogo.js("!!document.querySelector('#prep-mount input:checked')")).toBe(true);
  await jogo.js("document.getElementById('prep-go').click()");
  await jogo.esperar(3500);
  expect(await jogo.js("!!__t.dungeon.mount")).toBe(true);
  await jogo.js(
    "const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.mount.x=d.px+30; d.mount.y=d.py; __t.mountToggle()",
  );
  await jogo.esperar(300);
  expect(await jogo.js("__t.dungeon.mount.mounted")).toBeTruthy();
  const px0 = await jogo.js<number>("__t.dungeon.px");
  await jogo.js("__t.dungeon.keys.KeyD=true");
  await jogo.esperar(1500);
  await jogo.js("__t.dungeon.keys.KeyD=false");
  expect(await jogo.js<number>("__t.dungeon.px")).toBeGreaterThan(px0);
  await jogo.foto("montado");
  await jogo.js("__t.mountToggle(); const d=__t.dungeon; d.px-=300;");
  await jogo.esperar(200);
  await jogo.js("__t.mountToggle()"); // chamar
  await jogo.esperar(1800);
  await jogo.foto("seguindo");
  await jogo.js("__t.toggleInv(true)");
  await jogo.esperar(600);
  expect(await jogo.js("getComputedStyle(document.getElementById('ib-saddle')).display")).not.toBe("none");
  await jogo.foto("sela");
  // códigos: TAMANDUA dá uma montaria, VINCULO sobe o nível
  await jogo.js("__t.toggleInv(false); __t.exitDungeon && __t.dungeon.active && __t.exitDungeon()");
  await jogo.esperar(2500);
  await jogo.js("__t.econ.mount=null");
  await jogo.page.mouse.click(683, 430);
  for (const ch of "TAMANDUA") await jogo.page.keyboard.press("Key" + ch);
  await jogo.esperar(300);
  expect(await jogo.js("!!__t.mnt()")).toBe(true);
  const lv0 = await jogo.js<number>("__t.mountLv()");
  for (const ch of "VINCULO") await jogo.page.keyboard.press("Key" + ch);
  await jogo.esperar(200);
  expect(await jogo.js<number>("__t.mountLv()")).toBeGreaterThanOrEqual(lv0);
});

test("ttam2 — o tamanduá no acampamento: painel e sela no inventário", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.tameStart(__t.wildAnteaters()[0])");
  await jogo.esperar(1500);
  await jogo.js("__t.tameGo()");
  await jogo.esperar(600);
  await jogo.js("__t.tameWin(); __t.tameName(); const it=__t.mkItem('pele'); __t.placeIn(__t.mountBag(), it);");
  await jogo.js("__t.enterCamp(__h)");
  await jogo.esperar(4500);
  expect(await jogo.js("!!__t.dungeon.mount")).toBe(true);
  await jogo.js("const d=__t.dungeon; d.px=d.mount.x+30; d.py=d.mount.y+10;");
  await jogo.esperar(600);
  await jogo.js("__t.interact()");
  await jogo.esperar(500);
  expect(await jogo.js("document.getElementById('mount-modal').classList.contains('open')")).toBe(true);
  await jogo.js("__t.mpClose(); const d=__t.dungeon; d.px=d.mount.x+40; d.py=d.mount.y; __t.toggleInv(true)");
  await jogo.esperar(600);
  expect(await jogo.js("getComputedStyle(document.getElementById('ib-saddle')).display")).not.toBe("none");
});

test("tai — IA do tamanduá no campo: passeia, atende o chamado", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.gsRun('TAMANDUA'); __t.mnt().with=__h.id;");
  await irAoCampo(jogo, 3500);
  await jogo.js("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=450; d.py=270;");
  const estados = new Set<string>();
  for (let i = 0; i < 4; i++) {
    await jogo.esperar(1500);
    estados.add(await jogo.js<string>("__t.dungeon.mount.st"));
  }
  await jogo.foto("passeio");
  await jogo.js("__t.mountToggle()");
  await jogo.esperar(3000);
  const dist = await jogo.js<number>(
    "(()=>{const d=__t.dungeon,M=d.mount; return Math.hypot(M.x-d.px,M.y-d.py)/d.tile})()",
  );
  expect(dist).toBeLessThan(8);
  await jogo.foto("chamado");
});

test("tcoat — escovar o tamanduá sujo: escova, sabão, balde", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.js("__t.gsRun('TAMANDUA'); __t.mnt().coat='dourado'; __t.mnt().dirt=80;");
  await jogo.js(
    "const p=__h.camp, s=__t.camera.minScale*12; __t.camera.scale=s; __t.camera.tx=683-(p.x+20)*s; __t.camera.ty=430-(p.y-6)*s;",
  );
  await jogo.esperar(900);
  await jogo.foto("mapa");
  await jogo.js("__t.mountPanel()");
  await jogo.esperar(600);
  await jogo.js("document.querySelector('[data-ma=brush]').click()");
  await jogo.esperar(600);
  const box = await jogo.caixa("#mp-cv");
  const esfregar = async (n: number, a: number, b: number, ate?: string) => {
    await jogo.page.mouse.move(box.x + 60, box.y + 120);
    await jogo.page.mouse.down();
    for (let i = 0; i < n; i++) {
      await jogo.page.mouse.move(
        box.x + box.width * (0.25 + 0.5 * ((i * a) % 1)),
        box.y + box.height * (0.15 + 0.8 * ((i * b) % 1)),
        { steps: 2 },
      );
      if (ate && i % 10 === 0 && (await jogo.js("__t.MP.brush && __t.MP.brush.ph")) !== ate) break;
    }
    await jogo.page.mouse.up();
    await jogo.esperar(200);
  };
  const ph0 = await jogo.js<string>("__t.MP.brush && __t.MP.brush.ph");
  await esfregar(140, 0.37, 0.137);
  const ph1 = await jogo.js<string>("__t.MP.brush && __t.MP.brush.ph");
  await esfregar(200, 0.29, 0.113, "soap");
  await jogo.js("document.getElementById('br-bucket') && document.getElementById('br-bucket').click()");
  await jogo.esperar(1800);
  await jogo.foto("limpo");
  expect([ph0, ph1, await jogo.js("__t.MP.brush && __t.MP.brush.ph")]).not.toEqual([ph0, ph0, ph0]); // as fases avançam
  expect(await jogo.js<number>("__t.mnt().dirt")).toBeLessThan(80);
});

test("t84 — campo: botão de sair e o inventário cabem na tela", async ({ jogo }) => {
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await irAoCampo(jogo, 3500);
  await jogo.js("__t.dungeon.flow='x'");
  const sair = await jogo.js<number[]>(
    "(()=>{const r=document.getElementById('dungeon-exit').getBoundingClientRect(); return [r.left,r.right]})()",
  );
  expect(sair[1]).toBeLessThanOrEqual(1366);
  await jogo.js("__t.toggleInv()");
  await jogo.esperar(500);
  const inv = await jogo.js<number[]>(
    "(()=>{const c=document.getElementById('inv-card').getBoundingClientRect(); return [c.left,c.right]})()",
  );
  expect(inv[0]).toBeGreaterThanOrEqual(0);
  expect(inv[1]).toBeLessThanOrEqual(1366);
});

test("tboar/tboar2 — javali: investida derruba; rolar, escudo e parry", async ({ jogo }) => {
  await entrarComHeroi(jogo, "A", 1);
  await jogo.esperar(3500);
  expect(await jogo.js<number>("__t.populationOf('boar')")).toBeGreaterThan(0);
  await irAoCampo(jogo, 3500);
  const prep =
    "const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=300; d.py=270; d.down=0; d.dazed=0; d.rollGuard=0; d.dodgeGuard=0; d.parryVis=0; d.guard=false; d.gstam=100; d.guardBroken=0; d.invuln=0; d.weapon='melee'; d.mouse={x:600,y:270}; const m=__t.spawnJavalino(2); m.x=320; m.y=270; window.__m=m;";
  const caso = (acao: string) =>
    jogo.js<{ down: number; st: string }>(
      `(()=>{${prep} ${acao}; __t.boarHit(__m); return {down:__t.dungeon.down||0, st:__m.st}})()`,
    );
  const rolar = await caso("d.rollGuard=0.3");
  const escudo = await caso("d.guard=true");
  const parry = await caso("d.parryVis=0.2");
  const nada = await caso("");
  expect(nada.down).toBeGreaterThan(0); // sem defesa, derruba
  expect(rolar.down).toBe(0);
  expect(parry.down).toBe(0);
  expect(escudo.down).toBeLessThanOrEqual(nada.down);
  // investida de verdade
  await jogo.js(`(()=>{${prep} __m.x=480; __m.bcd=0;})()`);
  expect(await esperarAte(jogo, "__m.st==='charge' || __t.dungeon.down>0", 4000, 100)).toBe(true);
  await jogo.esperar(1500);
  await jogo.foto("investida");
});

test.describe("celular", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test("tmob — botão de montar no celular", async ({ jogo }) => {
    await entrarComHeroi(jogo, "A", 1);
    await jogo.js("__t.gsRun('TAMANDUA'); __t.mnt().with=__h.id;");
    await irAoCampo(jogo, 4000);
    await jogo.js("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.mount.x=d.px+25; d.mount.y=d.py;");
    await jogo.esperar(600);
    const bb = await jogo.js<number[]>(
      "(()=>{const r=document.getElementById('tb-mount').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]})()",
    );
    await jogo.page.touchscreen.tap(bb[0], bb[1]);
    await jogo.esperar(400);
    expect(await jogo.js("__t.dungeon.mount.mounted")).toBeTruthy();
  });

  test("tbtn/tbtn2 — editar a posição dos botões; em edição o toque não ataca; salva", async ({ jogo }) => {
    await entrarComHeroi(jogo, "A", 1);
    await irAoCampo(jogo, 4500);
    await jogo.js(
      "__t.dungeon.monsters.length=0; window.__n=0; document.getElementById('tb-atk').addEventListener('pointerdown',()=>window.__n++)",
    );
    await jogo.page.tap("#tb-atk");
    await jogo.esperar(200);
    expect(await jogo.js("__n")).toBe(1);
    expect(await jogo.js("!!document.getElementById('tb-layout')")).toBe(true);
    await jogo.page.tap("#tb-layout");
    await jogo.esperar(300);
    expect(await jogo.js("__t.TBL.edit")).toBeTruthy();
    expect(await jogo.js("__t.dungeon.modalOpen")).toBeTruthy();
    const a0 = await jogo.caixa("#tb-atk");
    const cx = a0.x + a0.width / 2,
      cy = a0.y + a0.height / 2;
    await jogo.page.mouse.move(cx, cy);
    await jogo.page.mouse.down();
    await jogo.page.mouse.move(cx - 300, cy - 120, { steps: 12 });
    await jogo.page.mouse.up();
    await jogo.esperar(200);
    const a1 = await jogo.caixa("#tb-atk");
    expect(Math.abs(a1.x - a0.x) + Math.abs(a1.y - a0.y)).toBeGreaterThan(50);
    await jogo.page.click("[data-tl=p]");
    await jogo.foto("editando");
    await jogo.page.click("[data-tl=k]");
    await jogo.esperar(300);
    expect(await jogo.js("__t.TBL.edit")).toBeFalsy();
    expect(await jogo.js("__t.tblLoad()")).toBeTruthy(); // ficou salvo
  });
});

for (const [nome, vw, vh] of [
  ["em pé", 390, 844],
  ["deitado", 844, 390],
] as const) {
  test.describe(`celular ${nome}`, () => {
    test.use({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

    test(`t83 — abas, pinça para zoom, joystick e ataque (${nome})`, async ({ jogo }) => {
      await jogo.foto("titulo");
      await entrarComHeroi(jogo, "Ayla", 777, true);
      await jogo.esperar(400);
      expect(await jogo.js("__t.MOB.on")).toBeTruthy();
      await jogo.foto("mapa");
      await jogo.js("document.querySelector('#mob-nav button[data-t=heroes]').click()");
      await jogo.esperar(400);
      await jogo.foto("herois");
      await jogo.js("document.querySelector('#mob-nav button[data-t=pop]').click()");
      await jogo.esperar(400);
      await jogo.js("document.querySelector('#mob-nav button[data-t=pop]').click()");
      const pd =
        "((type,el,id,x,y)=>{const e=document.querySelector(el); e.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true,isPrimary:id===1}));})";
      const s0 = await jogo.js<number>("__t.camera.scale");
      let ev = `${pd}('pointerdown','#viewport',1,${vw / 2 - 40},${vh / 2}); ${pd}('pointerdown','#viewport',2,${vw / 2 + 40},${vh / 2});`;
      for (let k = 1; k < 6; k++)
        ev += `${pd}('pointermove','#viewport',1,${vw / 2 - 40 - k * 15},${vh / 2}); ${pd}('pointermove','#viewport',2,${vw / 2 + 40 + k * 15},${vh / 2});`;
      ev += `${pd}('pointerup','#viewport',1,${vw / 2 - 115},${vh / 2}); ${pd}('pointerup','#viewport',2,${vw / 2 + 115},${vh / 2});`;
      await jogo.js(ev);
      expect(await jogo.js<number>("__t.camera.scale")).not.toBe(s0); // a pinça muda o zoom
      await irAoCampo(jogo, 3500);
      await jogo.js("(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0;})()");
      await jogo.esperar(500);
      const p0 = await jogo.js<number[]>("[__t.dungeon.px,__t.dungeon.py]");
      const zr = await jogo.js<number[]>(
        "(()=>{const r=document.getElementById('tj-zone').getBoundingClientRect(); return [r.left,r.top,r.width,r.height]})()",
      );
      const jx = zr[0] + zr[2] * 0.4,
        jy = zr[1] + zr[3] * 0.6;
      await jogo.js(
        `${pd}('pointerdown','#tj-zone',5,${jx},${jy}); ${pd}('pointermove','#tj-zone',5,${jx + 45},${jy})`,
      );
      await jogo.esperar(900);
      await jogo.foto("joystick");
      await jogo.js(`${pd}('pointerup','#tj-zone',5,${jx + 45},${jy})`);
      expect(await jogo.js<number>("__t.dungeon.px")).toBeGreaterThan(p0[0]);
      await jogo.js("__t.spawnDungeonMonster()");
      await jogo.esperar(300);
      await jogo.js(`${pd}('pointerdown','#tb-atk',6,0,0)`);
      await jogo.esperar(200);
      await jogo.js(`${pd}('pointerup','#tb-atk',6,0,0)`);
      expect(Number.isFinite(await jogo.js<number>("__t.aimAngle()"))).toBe(true);
      await jogo.js("__t.toggleInv()");
      await jogo.esperar(600);
      await jogo.foto("inventario");
    });
  });
}
