/* v7.7 — clique direito no acampamento com a heroína já nele entra de novo (intro/cinematica.ts: o pointerup do mapa
   só trata o botão esquerdo como toque). Antes, depois de sair do acampamento a heroína ficava selecionada e o
   clique direito nela, em cima do acampamento, abria o menu dela (#base-menu) por cima de tudo em vez de entrar. */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

/** Onde o acampamento está na tela. */
const TELA =
  "(()=>{const c=__t.camera, p=__h.camp, r=document.getElementById('viewport').getBoundingClientRect(); return {x:r.left+p.x*c.scale+c.tx, y:r.top+p.y*c.scale+c.ty}})()";

test("acampamento: clique direito nele entra de novo depois de sair (sem abrir o menu da heroína)", async ({
  jogo,
}) => {
  test.skip(jogo.referencia, "o controle de RTS é da v7.7");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.closeTitle(); const e=__t.econ; e.introDone=true; e.campTut=3; e.tent=true;");
  await jogo.esperar(800);
  for (let i = 0; i < 2; i++) {
    const p = await jogo.js<{ x: number; y: number }>(TELA);
    await jogo.page.mouse.click(p.x, p.y, { button: "right" });
    expect(await esperarAte(jogo, "__t.dungeon.active && __t.dungeon.camp", 4000), "entrou (vez " + (i + 1) + ")").toBe(
      true,
    );
    expect(
      await jogo.js("document.getElementById('base-menu')?.classList.contains('open') || false"),
      "sem o menu",
    ).toBe(false);
    await jogo.js("__t.exitDungeon()");
    expect(await esperarAte(jogo, "!__t.dungeon.active", 4000)).toBe(true);
    await jogo.esperar(1200);
  }
});
