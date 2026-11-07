import { defineConfig } from "vitest/config";

// Testes unitários em Node, sem navegador. Os testes de navegador (Playwright) ficam em tests/browser/.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
    // Alguns testes importam todos os módulos, rodam o tsc ou montam o bundle: em máquinas mais lentas
    // passam dos 5 s/10 s padrão.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
