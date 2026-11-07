/* v7.7 — mapa estilo RTS (map/selecao.ts): esquerdo arrastando seleciona, clique no chão não anda (limpa a seleção),
   direito dá a ordem (pedra = coletar com o minijogo na chegada; chão = andar, com marcador), meio arrastando e WASD
   movem a câmera (a heroína não anda), F liga o seguir, Espaço centraliza, Ctrl+1 guarda e 1 chama o grupo. */
import { test, expect, entrarComHeroi } from "./comum.ts";

test("mapa RTS: caixa de seleção, ordens com o direito, câmera no meio, WASD, F, Espaço e grupos", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o controle de RTS");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  // perto o bastante para clicar nas pedras; o herói fica solto no mapa ("field")
  await jogo.js(
    "(()=>{const h=__h; h.state='field'; h.task=null; const c=__t.camera; c.zt=null; c.scale=Math.min(c.maxScale, 2.2); const vp=document.getElementById('viewport'); c.tx=vp.clientWidth/2-h.x*c.scale; c.ty=vp.clientHeight/2-h.y*c.scale; __t.applyCameraTransform();})()",
  );
  await jogo.esperar(400);
  const tela = (wx: string, wy: string) =>
    jogo.js<{ x: number; y: number }>(
      `(()=>{const r=document.getElementById('viewport').getBoundingClientRect(), c=__t.camera; return {x:r.left+c.tx+(${wx})*c.scale, y:r.top+c.ty+(${wy})*c.scale};})()`,
    );
  const cam = () => jogo.js<number[]>("[__t.camera.tx, __t.camera.ty]");
  const pos = () => jogo.js<number[]>("[__h.x, __h.y]");
  expect(await jogo.js("__t.SEGUIR.solto"), "a câmera começa livre").toBe(true);

  // esquerdo arrastando em volta do herói: seleciona, e o mapa não se move
  const p = await tela("__h.x", "__h.y"),
    c0 = await cam();
  await jogo.page.mouse.move(p.x - 40, p.y - 40);
  await jogo.page.mouse.down();
  await jogo.page.mouse.move(p.x + 40, p.y + 40, { steps: 5 });
  await jogo.foto("caixa");
  await jogo.page.mouse.up();
  expect(await jogo.js<string[]>("__t.SEL.grupo"), "o herói ficou selecionado").toEqual([
    await jogo.js<string>("__h.id"),
  ]);
  expect(await cam(), "a caixa não move o mapa").toEqual(c0);

  // clique esquerdo no chão: não anda e limpa a seleção
  const h0 = await pos(),
    vazio = await jogo.js<number[]>(
      "(()=>{for(let r=40;r<200;r+=10) for(let a=0;a<6.28;a+=0.5){const x=__h.x+Math.cos(a)*r, y=__h.y+Math.sin(a)*r; if(!__t.mapHitsSomething(x,y) && !__t.world.veg.some(p=>Math.hypot(p.x-x,p.y-y)<12)) return [x,y];} return [__h.x+60,__h.y];})()",
    ),
    chao = await tela(String(vazio[0]), String(vazio[1]));
  await jogo.page.mouse.click(chao.x, chao.y);
  await jogo.esperar(200);
  expect(await jogo.js("__h.state"), "clique esquerdo não anda").toBe("field");
  expect(await pos()).toEqual(h0);
  expect(await jogo.js<number>("__t.SEL.grupo.length"), "chão vazio limpa a seleção").toBe(0);

  // botão do meio arrastando move a câmera
  await jogo.page.mouse.move(chao.x, chao.y);
  await jogo.page.mouse.down({ button: "middle" });
  await jogo.page.mouse.move(chao.x + 60, chao.y + 20, { steps: 4 });
  await jogo.page.mouse.up({ button: "middle" });
  const c1 = await cam();
  expect(Math.round(c1[0] - c0[0]), "o meio arrasta o mapa").toBe(60);

  // WASD move a câmera, e a heroína fica onde está
  await jogo.page.keyboard.down("KeyD");
  await jogo.esperar(450);
  await jogo.page.keyboard.up("KeyD");
  await jogo.esperar(300);
  expect((await cam())[0], "D leva a câmera para a direita").toBeLessThan(c1[0] - 50);
  expect(await pos(), "a heroína não anda com o WASD").toEqual(h0);

  // Espaço centraliza na heroína (sem seleção: a heroína do mapa)
  await jogo.page.keyboard.press("Space");
  await jogo.esperar(600);
  const meio = await jogo.js<number[]>(
    "(()=>{const vp=document.getElementById('viewport'),c=__t.camera; return [(vp.clientWidth/2-c.tx)/c.scale-__h.x, (vp.clientHeight/2-c.ty)/c.scale-__h.y];})()",
  );
  expect(Math.hypot(meio[0], meio[1]), "centralizou").toBeLessThan(4);

  // direito numa pedra pronta (sem seleção: a heroína) = coletar, minijogo na chegada
  const pedra = await jogo.js<{ x: number; y: number } | null>(
    "(()=>{let b=null,bd=1e9; for(const n of __t.world.nodes) if(n.kind==='rock' && __t.nodeReady(n)){const d=Math.hypot(n.x-__h.x,n.y-__h.y); if(d<bd&&d>30){bd=d;b=n;}} return b&&{x:b.x,y:b.y};})()",
  );
  expect(pedra, "há uma pedra no mapa").not.toBeNull();
  await jogo.js(
    `(()=>{const c=__t.camera, vp=document.getElementById('viewport'); c.tx=vp.clientWidth/2-${pedra!.x}*c.scale; c.ty=vp.clientHeight/2-${pedra!.y}*c.scale; __t.applyCameraTransform();})()`,
  );
  await jogo.esperar(200);
  const pp = await tela(String(pedra!.x), String(pedra!.y));
  await jogo.page.mouse.click(pp.x, pp.y, { button: "right" });
  await jogo.esperar(150);
  const t = await jogo.js<{ st: string; mg: boolean; kind: string; sel: number }>(
    "({st:__h.state, mg:!!(__h.task&&__h.task.mg), kind:__h.task&&__h.task.targetSpecies, sel:__t.SEL.grupo.length})",
  );
  expect(t).toEqual({ st: "traveling", mg: true, kind: "rock", sel: 1 });
  await jogo.js(`(()=>{__h.x=${pedra!.x}+8; __h.y=${pedra!.y};})()`);
  await jogo.esperar(1500);
  expect(await jogo.js("document.getElementById('mg-modal').classList.contains('open')"), "abriu na chegada").toBe(
    true,
  );
  await jogo.js("__t.mgClose()");

  // direito no chão = andar, com o marcador da ordem
  await jogo.js("__h.state='field'; __h.task=null;");
  const pc = await tela("__h.x+60", "__h.y");
  await jogo.page.mouse.click(pc.x, pc.y, { button: "right" });
  await jogo.esperar(100);
  expect(await jogo.js("__h.state"), "direito anda").toBe("walking");
  expect(await jogo.js("document.querySelectorAll('.ordem-ping').length"), "marcador").toBeGreaterThan(0);
  await jogo.foto("ordem");

  // F liga e desliga o seguir; Ctrl+1 guarda e 1 chama o grupo
  await jogo.page.keyboard.press("KeyF");
  expect(await jogo.js("__t.SEGUIR.solto"), "F segue").toBe(false);
  await jogo.page.keyboard.press("KeyF");
  expect(await jogo.js("__t.SEGUIR.solto"), "F solta").toBe(true);
  await jogo.page.keyboard.press("Control+Digit1");
  await jogo.page.keyboard.press("Escape");
  await jogo.esperar(150);
  await jogo.js("__t.SEL.grupo.length=0");
  await jogo.page.keyboard.press("Digit1");
  expect(await jogo.js<string[]>("__t.SEL.grupo"), "1 chama o grupo").toEqual([await jogo.js<string>("__h.id")]);
});
