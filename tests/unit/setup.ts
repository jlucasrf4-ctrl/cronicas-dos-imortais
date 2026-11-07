// Antes de cada arquivo de teste (vitest.config.ts → setupFiles).
// Os módulos de src/ só declaram coisas ao carregar, com uma exceção do navegador: render/sprites.ts cria o atlas com
// `new Image()` (o legado põe o .src depois). Os testes de lógica pura importam módulos que, pelos imports, chegam
// até ele; em Node não existe Image, então aqui entra um substituto mínimo (só se não houver um).
const g = globalThis as unknown as { Image?: unknown };
if (typeof g.Image === "undefined")
  g.Image = class {
    src = "";
    width = 0;
    height = 0;
    complete = false;
    onload: (() => void) | null = null;
  };
