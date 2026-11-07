import { defineConfig, devices } from "@playwright/test";

// Testes de navegador (Fase 6): Chromium headless abre o build de teste direto do disco (file://), como o jogador.
// Os specs rodam no build atual (dist/vtest.html, gere com `npm run build`) e na referência congelada
// (reference/vtest_v7.6.html), para separar o que o build quebrou do que já vinha da v7.6.
export default defineConfig({
  testDir: "tests/browser/e2e",
  testMatch: "*.spec.ts",
  outputDir: "tests/browser/resultados",
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1366, height: 860 },
    screenshot: "only-on-failure",
    // WebGL em software (SwiftShader, o padrão do headless). NÃO usar `--use-angle=d3d11` (GPU de verdade) nesta
    // máquina: em 2026-10-12 as rodadas com ele travaram o driver AMD e desligaram o PC várias vezes.
  },
  // `npm run test:browser` roda só o build; `npm run test:browser:ref` roda os dois (o dobro do tempo). A referência
  // serve para conferir um assert novo: se passa na v7.6, descreve o comportamento original.
  projects: [
    { name: "build", metadata: { arquivo: "dist/vtest.html" } },
    { name: "v7.6", metadata: { arquivo: "reference/vtest_v7.6.html" } },
  ],
});
