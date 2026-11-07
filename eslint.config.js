import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Ferramentas, testes, configs e (desde a Fase 8.2) o código do jogo em src/.
export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "build/",
      "dist/",
      "reference/",
      "src/**/*.css",
      "src/assets/",
      "tests/browser/legacy-py/",
      "tests/browser/tools/sim/bot.js",
      "tests/browser/resultados/",
      "assets/",
      "backups/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // `try { … localStorage … } catch {}`: ignorar a falha é o comportamento da v7.6.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // As etapas da Fase 3 repassam a chamada com `fnBase.apply(this, arguments as Repasse)`;
      // trocar por `...args` muda o bundle (ver ROADMAP, 8.2).
      "prefer-rest-params": "off",
      // `a ? f() : g()` e `x || y()` como instrução são o estilo do jogo.
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      // `catch (_) {}` é o idioma do jogo; um parâmetro que só existe para a assinatura começa com `_`.
      "@typescript-eslint/no-unused-vars": ["error", { caughtErrors: "none", argsIgnorePattern: "^_" }],
    },
  },
);
