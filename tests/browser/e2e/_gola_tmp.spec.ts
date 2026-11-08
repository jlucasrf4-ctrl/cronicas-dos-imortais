/* descartável (2026-11-07): o pescoço das cabeças trocadas no jogo, na câmera de perto (render/gl/gola.ts). De frente,
   3/4 e de costas, para comparar antes/depois. FOTO_PREFIXO=antes|depois. */
import { test, expect, campoDireto, campoLimpo } from "./comum.ts";

const COMBOS = [
  ["corpo_f02", "busto_05"],
  ["corpo_f02", "busto_13"],
  ["corpo_f02", "busto_15"],
  ["corpo_f02", "busto_16"],
  ["corpo_f03", "busto_10"],
  ["corpo_f05", "busto_13"],
  ["heroina", "busto_15"],
  ["lider", "busto_10"],
  ["lider", "busto_16"],
  ["heroina", "loira_trancas"],
  ["corpo_f01", "loira_trancas"],
  ["corpo_f06", "deusa_inverno"],
];
const VISTAS: [string, number][] = [
  ["frente", 0],
  ["tres4", 0.75],
  ["costas", Math.PI],
];

// a tela 2× maior: o canvas do campo não usa a densidade de pixels, e de perto a cabeça tinha ~60 px
test.use({ viewport: { width: 2732, height: 1720 } });

test("gola do pescoço: fotos de perto", async ({ jogo }) => {
  test.setTimeout(900000);
  const pre = process.env.FOTO_PREFIXO || "foto";
  await jogo.js(`__t.enterGame(); window.__h = __t.createHero("Lia", __t.bornFromSeed(777));`);
  await jogo.esperar(800);
  // meio-dia; roupa fixa (aventureira: o couro é sorteado a cada vez) para as fotos serem comparáveis
  await jogo.js("(()=>{ const w = __t.world; w.tick = Math.floor(w.tick / 1440) * 1440 + 720; })()");
  await jogo.js(
    "(()=>{ const e = __t.ensureEquip(__h); for (const k of ['peito', 'pernas', 'pes']) if (e[k]) e[k].visualRoupa = 'aventureira'; })()",
  );
  await campoDireto(jogo);
  await campoLimpo(jogo);
  const caixa = await jogo.caixa("#dungeon-view"),
    recorte = {
      x: caixa.x + caixa.width * 0.39,
      y: caixa.y + caixa.height * 0.14,
      width: caixa.width * 0.22,
      height: caixa.height * 0.3,
    };
  for (const [corpo, cabeca] of COMBOS) {
    await jogo.js(`(()=>{ __t.dungeon.hero.visual = { corpo: "${corpo}", cabeca: "${cabeca}" }; })()`);
    await jogo.esperar(600);
    for (const [nome, giro] of VISTAS) {
      await jogo.js(
        `(()=>{ const C = __t.CZ, d = __t.dungeon; C.pertoAlvo = 1; C.perto = 1; C.pertoPx = d.px; C.pertoPy = d.py;
          C.pertoYaw = (__t.GL3.hyaw ?? Math.PI / 2) + ${giro}; })()`,
      );
      await jogo.esperar(700);
      await jogo.foto(`${pre}_${corpo}_${cabeca}_${nome}`, recorte);
    }
  }
  expect(jogo.erros).toEqual([]);
});
