/* descartável (2026-11-06): as 8 cabeças antigas (F17–F24) no palco da criação, para comparar antes/depois da
   malha nova. FOTO_PREFIXO=antes|depois. */
import { test, expect } from "./comum.ts";

const CABECAS = [
  "loira_trancas",
  "ruiva_rabo",
  "morena_argolas",
  "acobreada_coque",
  "marinho_coque",
  "rosa",
  "verde_trancas",
  "morena_tiara",
];

test("cabeças antigas: fotos", async ({ jogo }) => {
  test.setTimeout(240000);
  const pre = process.env.FOTO_PREFIXO || "foto";
  await jogo.js(
    "__t.enterGame(); __t.econ.test=true; __t.world.heroes.length=0; __t.openCreateModal(); document.getElementById('create-name').value='Lia'; __t.confirmCreateHero()",
  );
  await jogo.esperar(1500);
  // roupa fixa (aventureira) para as fotos serem comparáveis
  await jogo.js(
    "(()=>{const h=__t.world.heroes.at(-1), e=__t.ensureEquip(h); for(const k of ['peito','pernas','pes']) if(e[k]) e[k].visualRoupa='aventureira';})()",
  );
  const caixa = await jogo.caixa("#cr-port");
  for (const cab of CABECAS) {
    await jogo.js(`(()=>{const h=__t.world.heroes.at(-1); h.visual={corpo:'corpo_f02',cabeca:'${cab}'};})()`);
    await jogo.esperar(700);
    await jogo.foto(`${pre}_${cab}`, caixa);
  }
  expect(jogo.erros).toEqual([]);
});
