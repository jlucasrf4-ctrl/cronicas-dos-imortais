/* descartável (2026-11-06): fotos do tingimento de pele/cabelo no palco da criação, para comparar antes/depois.
   FOTO_PREFIXO=antes|depois escolhe o nome dos arquivos. */
import { test, expect } from "./comum.ts";

const VISUAIS = [
  { corpo: "corpo_f02", cabeca: "propria" },
  { corpo: "corpo_f05", cabeca: "busto_10" },
  { corpo: "heroina", cabeca: "loira_trancas" },
  { corpo: "corpo_f03", cabeca: "morena_argolas" },
];
const CORES: [string, { pele?: string; cabelo?: string }][] = [
  ["original", {}],
  ["escura", { pele: "#8d5a3c", cabelo: "#1f1a18" }],
  ["clara", { pele: "#f2d3bd", cabelo: "#d8b06a" }],
];

test("tingimento: fotos", async ({ jogo }) => {
  test.setTimeout(240000);
  const pre = process.env.FOTO_PREFIXO || "foto";
  await jogo.js(
    "__t.enterGame(); __t.econ.test=true; __t.world.heroes.length=0; __t.openCreateModal(); document.getElementById('create-name').value='Lia'; __t.confirmCreateHero()",
  );
  await jogo.esperar(1500);
  const caixa = await jogo.caixa("#cr-port");
  for (const v of VISUAIS)
    for (const [nome, cor] of CORES) {
      await jogo.js(`(()=>{const h=__t.world.heroes.at(-1); h.visual=${JSON.stringify({ ...v, ...cor })};})()`);
      await jogo.esperar(700);
      await jogo.foto(`${pre}_${v.corpo}_${v.cabeca}_${nome}`, caixa);
    }
  expect(jogo.erros).toEqual([]);
});
