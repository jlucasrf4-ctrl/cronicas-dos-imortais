import { expect, it } from "vitest";
import { readdirSync } from "node:fs";

// Fase 4: todo módulo do jogo carrega no Node (sem DOM nem canvas), então qualquer lógica pura pode ser importada
// por um teste. Carregar só declara: o que mexe na página roda nas funções iniciar…() de src/inicio, chamadas por
// src/main.ts (fora deste teste). Um módulo que acessa document/window ao carregar quebra aqui.
const FORA = new Set(["src/inicio", "src/assets", "src/styles", "src/dev"]);
const modulos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return FORA.has(p) ? [] : modulos(p);
    return e.name.endsWith(".ts") && p !== "src/main.ts" && dir !== "src" ? [p] : [];
  });

it("todo módulo de src/ carrega no Node sem tocar no DOM", async () => {
  const lista = modulos("src"),
    falhas: string[] = [];
  expect(lista.length).toBeGreaterThan(100);
  for (const f of lista) {
    try {
      await import(/* @vite-ignore */ `../../${f}`);
    } catch (e) {
      falhas.push(`${f}: ${String(e).slice(0, 160)}`);
    }
  }
  expect(falhas).toEqual([]);
});
