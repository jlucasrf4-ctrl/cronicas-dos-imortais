/* v8.0 — tela de criação do personagem: a etapa do nome e a revelação, com o personagem sorteado (corpo + cabeça) no
   retrato em 3D, parado e sem espada nem escudo. */
import { test, expect } from "./comum.ts";

test("criação: nome, revelação, roupa e aparência de recrutável no retrato", async ({ jogo }) => {
  await jogo.js("__t.enterGame(); __t.openCreateModal(); document.getElementById('create-name').value='Lia'");
  await jogo.esperar(800);
  await jogo.foto("criacao_nome");
  await jogo.js("__t.confirmCreateHero()");
  const recemNascida = await jogo.js<{ corpo: string; cabeca: string; equipamento: string[] }>(
    "(()=>{const h=__t.world.heroes.at(-1); return {corpo:h.visual?.corpo, cabeca:h.visual?.cabeca, equipamento:['peito','pernas','pes'].map(k=>h.equip?.[k]?.def?.key||'')}})()",
  );
  expect(recemNascida.corpo).toMatch(/^corpo_f0[1-6]$/);
  expect(recemNascida.cabeca).toBe("propria");
  expect(recemNascida.equipamento).toEqual(["eq_armadura", "eq_calca", "eq_botas"]);
  await jogo.esperar(8500);
  await jogo.foto("criacao_revelacao");
  await jogo.js("document.querySelector('#cr-acoes [data-i=\"2\"]')?.click()");
  await jogo.esperar(450);
  await jogo.foto("criacao_arco_puxando");
  for (const corpo of ["corpo_f01", "corpo_f02", "corpo_f03", "corpo_f04", "corpo_f05", "corpo_f06"]) {
    await jogo.js(
      `(()=>{__t.world.heroes.at(-1).visual={corpo:'${corpo}',cabeca:'propria'}; document.querySelector('#cr-acoes [data-i="2"]')?.click()})()`,
    );
    await jogo.esperar(450);
    await jogo.foto(`recruta_arco_${corpo}`);
  }
  const migrada = await jogo.js<{ corpo: string; cabeca: string }>(
    "(()=>{const d=JSON.parse(__t.saveBlob()), h=d.world.heroes.at(-1); h.visual={corpo:'deusa_verao',cabeca:'propria'}; delete h.aparenciaVersao; __t.applySave(d); return __t.world.heroes.at(-1).visual})()",
  );
  expect(migrada.corpo).toMatch(/^corpo_f0[1-6]$/);
  expect(migrada.cabeca).toBe("propria");
  expect(await jogo.js("document.getElementById('create-modal').classList.contains('open')")).toBe(true);
});
