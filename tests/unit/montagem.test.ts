import { existsSync, readdirSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { arquivosDeEstilo, inlineAssets } from "../../tools/lib/montagem.ts";
import { construirJogo } from "../../tools/lib/construir.ts";
import { acharBuracos } from "../../tools/lib/buracos.ts";
import { scriptPrincipal, checarSintaxe } from "../../tools/lib/html.ts";

// Fase 2: a fonte única (index.html + src/, ordem em src/manifest.ts) remontava o jogo da referência v7.6 byte a byte
// (única diferença: os bytes dos ícones, por causa da correção de buracos, antigo p61, aplicada na extração).
// Fase 3: o JS muda (as cadeias de sobrescrita são fundidas, sem mudar o comportamento), então só o que fica fora do
// script principal continua igual à referência. O JS é conferido pela sintaxe e pelo smoke checklist do mantenedor.
// Fase 4: o HTML vem do build do Vite (tools/lib/construir.ts). O JS virou um <script type="module"> e o Vite o põe no
// fim do <head>, em vez do fim do <body>. Módulo é adiado (roda depois de o documento inteiro ser lido, antes do
// DOMContentLoaded), como o script clássico no fim do <body>; então só o lugar do script muda.
const lf = (s: string) => s.replace(/\r\n/g, "\n");
const RE_ICO = /<style id="ico-css">\n([\s\S]*?)<\/style>/;
// v8.0: o número da versão no <title> muda (index.html); o resto do título continua igual
const semIcones = (s: string) => s.replace(RE_ICO, "<ICO/>").replace(/(<title>[^<]*?) v[\d.]+(<\/title>)/, "$1$2");
/** Tira o script principal (e a quebra de linha antes dele), esteja onde estiver. */
const semScript = (s: string) => {
  const js = scriptPrincipal(s);
  const fim = s.indexOf(js) + js.length + "</script>".length;
  const ini = s.lastIndexOf("<script", s.indexOf(js));
  return s.slice(0, s.lastIndexOf("\n", ini)) + s.slice(fim);
};
/** v7.7: tira o texto dos estilos novos (src/styles/*_v7.7_*.css): a v7.7 muda o visual de propósito. O texto vem
    como no build, com os arquivos (as fontes da vinheta Voidd) já em data URI. */
const semV77 = (s: string) =>
  arquivosDeEstilo()
    .filter((f) => /_v(7\.7|8\.\d+)_/.test(f)) // v8.0: os estilos novos da v8 também
    .reduce((t, f) => t.replace(inlineAssets(".", lf(readFileSync(f, "utf8"))), ""), s);
const chavesIco = (s: string) =>
  s
    .match(RE_ICO)![1]
    .split("\n")
    .map((l) =>
      l === "" ? "" : l.match(/^\.ico-(\w+)\{background-image:url\(data:image\/webp;base64,[A-Za-z0-9+/=]+\)\}$/)?.[1],
    );

for (const [teste, ref] of [
  [false, "reference/game_v7.6.html"],
  [true, "reference/vtest_v7.6.html"],
] as const) {
  describe(`montagem = ${ref}`, () => {
    const original = lf(readFileSync(ref, "utf8"));
    let montado = "";
    beforeAll(async () => {
      montado = await construirJogo({ teste });
    });

    it("HTML idêntico fora do script principal, do bloco de ícones e dos estilos da v7.7", () => {
      expect(semScript(semIcones(semV77(montado))) === semScript(semIcones(original))).toBe(true);
    });

    it("um script só, módulo ES, no fim do <head>", () => {
      expect(montado.match(/<script/g)).toHaveLength(1);
      expect(montado).toMatch(/<\/style>\n {2}<script type="module" crossorigin>[\s\S]*<\/script>\n<\/head>/);
    });

    // v7.7: ícones novos só entram no fim do bloco (rn_* das runas, corda, relíquia por qualidade, cinto e bolsa)
    it("ícones: as chaves da v7.6 na mesma ordem (as novas no fim) e no formato que o ICOS lê", () => {
      const a = chavesIco(montado),
        ref = chavesIco(original);
      expect(a).not.toContain(undefined);
      expect(a.slice(0, ref.length - 1)).toEqual(ref.slice(0, -1));
      expect(
        a.slice(ref.length - 1).filter((k) => k && !/^(rn_|corda$|reliquia(_[23])?$|eq_cinto$|eq_bolsa$)/.test(k)),
      ).toEqual([]);
    });
  });
}

describe("fonte", () => {
  it("o JS empacotado passa no node --check (sem import/export: roda até como script clássico)", async () => {
    expect(checarSintaxe(scriptPrincipal(await construirJogo({ teste: false })))).toBeNull();
  });

  it("o JSON dos marcadores @inline-json entra também nos módulos .ts (antes do TypeScript tirar os comentários)", async () => {
    const js = scriptPrincipal(await construirJogo({ teste: false }));
    expect(js).not.toContain("@inline-json");
    expect(js).toMatch(/MAPDATA = \{\s*"K":/);
  });

  it("window.__t só no build de teste (o Vite elimina o gancho do build normal)", async () => {
    expect(scriptPrincipal(await construirJogo({ teste: false }))).not.toContain("__t");
    expect(scriptPrincipal(await construirJogo({ teste: true }))).toContain("window.__t = {");
  });

  it("todo estilo do manifesto existe, e nenhum .css de src/styles ficou de fora", () => {
    for (const f of arquivosDeEstilo()) expect(existsSync(f), f).toBe(true);
    const emDisco = readdirSync("src/styles").map((f) => `src/styles/${f}`);
    expect(emDisco.sort()).toEqual(arquivosDeEstilo().sort());
  });

  it("src/main.ts chama cada iniciar…() de src/inicio uma vez, depois de importar", () => {
    const main = readFileSync("src/main.ts", "utf8");
    const importadas = [...main.matchAll(/^import \{ (iniciar\w+) \} from "\.\/inicio\//gm)].map((m) => m[1]);
    const chamadas = [...main.matchAll(/^(iniciar\w+)\(\);$/gm)].map((m) => m[1]);
    expect(importadas.length).toBeGreaterThan(0);
    expect(chamadas).toEqual(importadas);
  });
});

describe("acharBuracos (correção de ícones)", () => {
  // 7x7 opaco e claro, com um furo transparente de 3 px no meio e um canto transparente ligado à borda
  const w = 7,
    h = 7;
  const img = new Uint8Array(w * h * 4).fill(200);
  const transp = (x: number, y: number) => (img[(y * w + x) * 4 + 3] = 0);
  transp(3, 3);
  transp(3, 2);
  transp(2, 3);
  transp(0, 0);
  transp(1, 0);

  it("acha o furo interno e ignora o que encosta na borda", () => {
    expect(acharBuracos(img, w, h).sort((a, b) => a - b)).toEqual([2 * w + 3, 3 * w + 2, 3 * w + 3]);
  });

  it("ignora furo escuro (fundo da folha de sprites)", () => {
    const escuro = img.slice();
    for (const i of [2 * w + 3, 3 * w + 2, 3 * w + 3]) escuro.fill(10, i * 4, i * 4 + 3);
    expect(acharBuracos(escuro, w, h)).toEqual([]);
  });
});
