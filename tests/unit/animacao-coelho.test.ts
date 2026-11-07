import { expect, it } from "vitest";
import { pontoCoelhoCine } from "../../src/intro/animacao_coelho.ts";
it("coelho e monstro articulam as patas sem acumular deformação", () => {
  for (const monstro of [false, true]) {
    const a = pontoCoelhoCine(4, 1, 2, 10, 12, 0, 0.1, monstro, true);
    const b = pontoCoelhoCine(4, 1, 2, 10, 12, 0, 0.3, monstro, true);
    expect(a).not.toEqual(b);
    expect(a).toEqual(pontoCoelhoCine(4, 1, 2, 10, 12, 0, 0.1, monstro, true));
    expect(a.every(Number.isFinite)).toBe(true);
  }
});
