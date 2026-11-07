import { test, expect, entrarComHeroi } from "./comum.ts";

test("prévia de modelos: criaturas, cabeças e animações sem trocar o personagem salvo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a referência não tem a prévia de modelos");
  test.setTimeout(150_000);
  await entrarComHeroi(jogo, "Ayla", 777);
  const visualOriginal = await jogo.js("JSON.stringify(__h.visual)");
  await jogo.js("__t.gsRun('MODELOS')");
  await jogo.esperar(1200);
  expect(await jogo.js("!!document.querySelector('#modelos-teste canvas')")).toBe(true);
  const escolher = (nome: string) =>
    jogo.js(
      `(()=>{const s=document.querySelector('#mt-modelo');s.value='${nome}';s.dispatchEvent(new Event('change'));})()`,
    );
  for (const nome of ["corpo_f01", "cacador", "aldeao_1", "quimera", "grifo", "hidra"]) {
    await escolher(nome);
    await jogo.esperar(250);
    expect(await jogo.js("document.querySelector('#mt-clip').options.length")).toBeGreaterThan(3);
    if (nome === "corpo_f01") {
      await jogo.foto("corpo_f01_busto_novo");
      await jogo.js(
        "document.querySelector('#mt-zoom').value='2.2';document.querySelector('#mt-zoom').dispatchEvent(new Event('input'))",
      );
      await jogo.esperar(250);
      await jogo.foto("rosto_f01_detalhe");
    }
  }
  await jogo.js(
    "document.querySelector('#mt-clip').value='ataque';document.querySelector('#mt-clip').dispatchEvent(new Event('change'))",
  );
  await jogo.esperar(450);
  const quadro = await jogo.js<{ minY: number; maxY: number; assinatura: number }>("__t.quadroModeloTeste()");
  expect(quadro.minY).toBeGreaterThan(-5);
  expect(quadro.maxY).toBeGreaterThan(40);
  await jogo.esperar(300);
  expect(await jogo.js("__t.quadroModeloTeste().assinatura")).not.toBe(quadro.assinatura);
  await jogo.foto("hidra_ataque");
  await jogo.js("document.querySelector('[data-mt=pausa]').click()");
  expect(await jogo.js("document.querySelector('[data-mt=pausa]').textContent")).toBe("Continuar");
  await jogo.js("document.querySelector('[data-mt=fechar]').click()");
  expect(await jogo.js("!!document.querySelector('#modelos-teste')")).toBe(false);
  expect(await jogo.js("JSON.stringify(__h.visual)")).toBe(visualOriginal);
});
