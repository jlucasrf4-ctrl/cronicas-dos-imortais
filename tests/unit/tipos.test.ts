import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { errosSemNocheck, temNocheck, tiraNocheck } from "../../tools/lib/sem-nocheck.ts";

// Fase 5: os módulos perderam o `// @ts-nocheck` um a um (5.2, 116 → 0). Catraca: nenhum volta a tê-lo; código
// novo é checado pelo tsc como todo o resto.
const TETO = 0;

const arquivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === "assets" ? [] : arquivos(p);
    return e.name.endsWith(".ts") ? [p] : [];
  });

describe("@ts-nocheck", () => {
  it(`no máximo ${TETO} módulos de src/ ainda têm a diretiva`, () => {
    const com = arquivos("src").filter((f) => temNocheck(readFileSync(f, "utf8")));
    expect(com.length).toBeLessThanOrEqual(TETO);
  });

  it("os tipos do domínio e o estado compartilhado são checados", () => {
    for (const f of ["src/core/tipos.ts", "src/core/state.ts", "src/data/itens.ts", "src/items/inventario.ts"])
      expect(temNocheck(readFileSync(f, "utf8")), f).toBe(false);
  });

  // Fase 5.3: `strict` ligado (noImplicitAny 2.493 → 0, strictNullChecks 3.046 → 0, o resto 119 → 0). Não pode
  // sair do tsconfig, nem ser desligado em parte por uma opção avulsa.
  it("o tsconfig liga strict, e src/ passa com ele", () => {
    const opc = ts.readConfigFile("tsconfig.json", ts.sys.readFile).config.compilerOptions;
    expect(opc.strict).toBe(true);
    for (const o of [
      "noImplicitAny",
      "strictNullChecks",
      "noImplicitThis",
      "strictFunctionTypes",
      "strictBindCallApply",
    ])
      expect(opc[o], o).not.toBe(false);
    expect(errosSemNocheck(".")).toEqual([]);
  });

  // Fase 5: os objetos de estado compartilhado têm interfaces `Estado…` (eram `Record<string, any>`, que desliga a
  // checagem em todo lugar que os usa).
  it("nenhum objeto de estado compartilhado é Record<string, any>", () => {
    for (const f of ["src/core/state.ts", "src/items/inventario.ts", "src/render/gl/geometria.ts"])
      expect(readFileSync(f, "utf8"), f).not.toMatch(/export const \w+: Record<string, any>/);
  });

  // Fase 5.5: o marcador `Solto` (= any) foi trocado por tipos de verdade em todo src/ e apagado de tipos.ts.
  it("nenhum módulo usa mais o marcador Solto", () => {
    const com = arquivos("src").filter((f) =>
      /\bSolto\b/.test(readFileSync(f, "utf8").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')),
    );
    expect(com).toEqual([]);
  });

  it("tools:sem-nocheck troca só a linha da diretiva, sem mudar a numeração", () => {
    const txt = "/* cabeçalho */\n// @ts-nocheck — motivo\nconst a = 1;\n// @ts-nocheck no meio fica\n";
    const out = tiraNocheck(txt);
    expect(out.split("\n")).toHaveLength(txt.split("\n").length);
    expect(out).toBe("/* cabeçalho */\n//\nconst a = 1;\n// @ts-nocheck no meio fica\n");
    expect(temNocheck(out)).toBe(true); // só a primeira sai: nos módulos a diretiva aparece uma vez, no cabeçalho
    expect(temNocheck("const a = 1;\n")).toBe(false);
  });
});
