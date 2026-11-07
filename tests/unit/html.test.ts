import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checarSintaxe, scriptPrincipal, scriptsInline } from "../../tools/lib/html.ts";

describe("scriptPrincipal", () => {
  it("pega o maior <script> inline (ignora os com src)", () => {
    const html = `<script src="x.js"></script><script>a()</script><script>
      bbbbbb()
    </script><script>c()</script><script type="module" src="/y.js"></script>`;
    expect(scriptsInline(html)).toHaveLength(3);
    expect(scriptPrincipal(html).trim()).toBe("bbbbbb()");
  });

  it("aceita <script type=module crossorigin> (build da Fase 4)", () => {
    expect(scriptsInline(`<script type="module" crossorigin>m()</script><scripts>`)).toEqual(["m()"]);
  });

  it("em empate fica com o primeiro (igual ao max() do Python)", () => {
    expect(scriptPrincipal("<script>aa</script><script>bb</script>")).toBe("aa");
  });

  it("falha se não houver script", () => {
    expect(() => scriptPrincipal("<p>nada</p>")).toThrow();
  });
});

describe("checarSintaxe", () => {
  it("aceita JS válido e rejeita inválido", () => {
    expect(checarSintaxe("let x = 1; function f() { return x; }")).toBeNull();
    expect(checarSintaxe("let x = ;")).toMatch(/SyntaxError/);
  });
});

// Guarda da Fase 0: a referência congelada não pode mudar (hashes de reference/README.md).
describe("referência v7.6", () => {
  const sha = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");

  it("arquivos intactos", () => {
    expect(sha("reference/game_v7.6.html")).toBe("e2d930f8a6442a34f45080479c369e07d6dc253516830a321c8c71be50d1a3f6");
    expect(sha("reference/vtest_v7.6.html")).toBe("491777ac4a2727bdbbd146a92cc91405ccdc81bdc841e7621df6f61a704703e7");
  });

  it("o JS principal passa no node --check", () => {
    expect(checarSintaxe(scriptPrincipal(readFileSync("reference/game_v7.6.html", "utf8")))).toBeNull();
  });
});
