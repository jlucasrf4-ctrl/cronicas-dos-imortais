import { describe, expect, it } from "vitest";
import { GS_CODES } from "../../src/ui/gameshark.ts";

// v7.7 — os códigos digitados direto no mapa disparam quando o fim do que foi digitado (as últimas 12 letras, GS.buf)
// bate com um código, na ordem da tabela. Um código não pode disparar no meio de outro (ex.: LOBO dentro de LOBOMAX).
describe("códigos do GameShark", () => {
  const codigos = Object.keys(GS_CODES);

  it("cabem no buffer de 12 letras e são só letras", () => {
    for (const c of codigos) expect(c, c).toMatch(/^[A-Z]{1,12}$/);
  });

  it("digitar um código não dispara outro no meio nem no fim", () => {
    for (const b of codigos)
      for (let n = 1; n <= b.length; n++) {
        const digitado = b.slice(0, n);
        // o primeiro da tabela que bate com o fim do que já foi digitado
        const dispara = codigos.find((a) => digitado.endsWith(a));
        if (n < b.length) expect(dispara, `"${dispara}" dispara no meio de "${b}"`).toBeUndefined();
        else expect(dispara, `"${b}" dispara "${dispara}"`).toBe(b);
      }
  });
});
