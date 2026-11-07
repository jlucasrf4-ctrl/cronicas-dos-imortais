/* v7.7 — vinheta de abertura Voidd (src/intro/voidd.ts). No build de teste ela não toca sozinha (só sai a capa de
   carregamento): aqui é tocada pelo gancho, por cima da tela de título, como no jogo. */
import { test, expect, esperarAte } from "./comum.ts";

test("voidd: a capa de carregamento saiu e a tela de título está aberta", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a vinheta Voidd");
  expect(await jogo.js("document.documentElement.classList.contains('voidd-pronto')")).toBe(true);
  expect(await jogo.js("document.getElementById('title-screen').classList.contains('open')")).toBe(true);
  expect(await jogo.js("!!document.getElementById('voidd')")).toBe(false);
});

test("voidd: toca por cima do título; a tecla só pula a vinheta (o menu do título não acorda)", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a vinheta Voidd");
  test.setTimeout(90_000);
  await jogo.js("window.__fim = 0; __t.tocarVinhetaVoidd(() => window.__fim++)");
  expect(await jogo.js("__t.VOIDD.aberta")).toBe(true);
  expect(await jogo.js("!!document.querySelector('#voidd canvas')")).toBe(true);
  // começa quando os quadros ficam estáveis; o Voodi entra
  await jogo.esperar(3000);
  await jogo.foto("vinheta");
  // o logo: o V e o O são a arte do GPT (src/assets/art/voidd_*.webp, embutidas no HTML)
  await jogo.js("__t.VOIDD.ir(14.2)");
  await jogo.esperar(1200);
  expect(await jogo.js("document.getElementById('voidd-v').naturalWidth > 0")).toBe(true);
  expect(await jogo.js("getComputedStyle(document.getElementById('voidd-v')).opacity")).toBe("1");
  await jogo.foto("logo");
  await jogo.page.keyboard.press("Escape");
  expect(await esperarAte(jogo, "window.__fim === 1 && !document.getElementById('voidd')", 5000, 100)).toBe(true);
  expect(await jogo.js("__t.VOIDD.aberta")).toBe(false);
  expect(await jogo.js("document.getElementById('title-screen').classList.contains('menu')")).toBe(false);
});

test("voidd: clique pula; o clique não chega à tela de título", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem a vinheta Voidd");
  await jogo.js("window.__fim = 0; __t.tocarVinhetaVoidd(() => window.__fim++)");
  // antes de começar (esperando quadros estáveis) o clique não pula; VOIDD.ir começa já
  await jogo.esperar(300);
  await jogo.page.mouse.click(400, 300);
  await jogo.esperar(1000);
  expect(await jogo.js("__t.VOIDD.aberta")).toBe(true);
  await jogo.js("__t.VOIDD.ir(1)");
  await jogo.esperar(500);
  await jogo.page.mouse.click(400, 300);
  expect(await esperarAte(jogo, "window.__fim === 1 && !document.getElementById('voidd')", 5000, 100)).toBe(true);
  expect(await jogo.js("document.getElementById('title-screen').classList.contains('menu')")).toBe(false);
});
