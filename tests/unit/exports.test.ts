import { describe, expect, it } from "vitest";
import { exportsSemUso } from "../../tools/lib/exports-sem-uso.ts";

// Fase 8.2: o ESLint não vê export sem uso. Uma export que só o próprio módulo usa perde o `export`; a que ninguém usa, sai.
describe("exports de src/", () => {
  it("toda export é importada por outro arquivo (src/, tests/ ou tools/)", () => {
    expect(exportsSemUso(".").map((e) => `${e.arquivo}:${e.linha} ${e.nome}`)).toEqual([]);
  });
});
