import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { jogo } from "./tools/vite-plugin-jogo.ts";

// Fonte única. index.html + src/ (src/main.ts e os módulos que ele importa; estilos em src/manifest.ts) -> um HTML só, abrível
// direto do disco.
//   vite build              -> dist/game.html   (o jogo)
//   vite build --mode test  -> dist/vtest.html  (o mesmo + window.__t, para os testes de navegador)
//   vite                    -> dev server (http://localhost:5173/), recarrega quando um arquivo de src/ muda
// O build não minifica nem rebaixa a sintaxe (o navegador roda o mesmo código da fonte), e não injeta o polyfill de
// modulepreload (é um módulo só, dentro do HTML).
export default defineConfig(({ mode }) => {
  const teste = mode === "test";
  return {
    plugins: [viteSingleFile(), jogo({ saida: teste ? "vtest.html" : "game.html" })],
    server: {
      port: 5173,
      strictPort: false,
      // 2026-11-06: uma pasta de resultados de teste corrompida pelo disco derrubava o vigia de arquivos (scandir
      // UNKNOWN) e o jogo não abria. O dev server só precisa vigiar index.html, src/ e tools/.
      watch: {
        ignored: [
          "**/tests/browser/resultados/**",
          "**/build/**",
          "**/dist/**",
          "**/backups/**",
          "**/arquivos de transferência/**",
        ],
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: !teste,
      target: "esnext",
      minify: false,
      modulePreload: { polyfill: false },
    },
  };
});
