/* 2026-11-06 — o primeiro personagem escolhe rosto e cores (o corpo segue sorteado); os seguintes nascem sorteados. */
import { test, expect } from "./comum.ts";

test("criação: só o primeiro personagem escolhe rosto e cores", async ({ jogo }) => {
  test.skip(jogo.referencia, "escolha nova de 2026-11-06");
  await jogo.js(
    "__t.enterGame(); __t.world.heroes.length=0; __t.openCreateModal(); document.getElementById('create-name').value='Lia'",
  );
  await jogo.js("__t.confirmCreateHero()");
  const r = await jogo.js<{
    painel: boolean;
    corpo0: string;
    corpo1: string;
    cabeca: string;
    pele: string;
    cabelo: string;
    deusa: boolean;
  }>(`(()=>{
    const h=__t.world.heroes.at(-1), el=document.getElementById('cr-escolha');
    const corpo0=h.visual.corpo, cab0=h.visual.cabeca;
    el.querySelector('[data-passo="1"]').click();
    el.querySelector('[data-pele="#8d5a3c"]').click();
    el.querySelector('[data-cabelo="#9a3b1e"]').click();
    return {painel:!!el, corpo0, corpo1:h.visual.corpo, cabeca:h.visual.cabeca===cab0?'':h.visual.cabeca, pele:h.visual.pele,
      cabelo:h.visual.cabelo, deusa:corpo0.startsWith('deusa_')};
  })()`);
  expect(r.painel).toBe(true);
  expect(r.corpo1).toBe(r.corpo0);
  expect(r.cabeca).not.toBe("");
  expect(r.pele).toBe("#8d5a3c");
  expect(r.cabelo).toBe("#9a3b1e");
  expect(r.deusa).toBe(false);
  await jogo.esperar(600);
  await jogo.foto("criacao_escolha");
  // o segundo personagem nasce sorteado, sem o painel
  await jogo.js("__t.econ.test=true; __t.openCreateModal(); document.getElementById('create-name').value='Bia'; __t.confirmCreateHero()");
  expect(await jogo.js("!!document.getElementById('cr-escolha')")).toBe(false);
  expect(await jogo.js("__t.world.heroes.length")).toBe(2);
});
