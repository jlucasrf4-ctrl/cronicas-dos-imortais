/* Fase 2 do ROADMAP — extrator (roda UMA vez): divide o HTML montado v7.6 em fonte única.

   Uso:  node tools/extract.ts [--forcar]
   Lê reference/game_v7.6.html e escreve:
     index.html                         marcação (head + body), com os marcadores do plugin
     src/styles/NN_*.css                os 2 blocos <style> de regras, divididos nos comentários de seção
     src/styles/icones-pintados.css     o <style id="ico-css">, com url(/src/assets/icons/<chave>.webp)
     src/assets/icons/<chave>.webp      os 1.122 ícones pintados
     src/assets/map/mapa.webp           a imagem do mapa (<img id="map-img">)
     src/assets/map/mapdata.json        o MAPDATA (texto original, sem reformatar)
     src/assets/art/atlas.webp          o ATLAS de sprites
     src/js/base/NN_*.js                o código da base v4.3 (+ edições dos patches), cortado nos cabeçalhos
     src/js/modulos/vX_*.js             cada módulo de recurso, no ponto onde o patch o inseriu
     src/dev/testHook.js                o window.__t do build de teste
     src/manifest.ts                    a ordem de tudo
   Depois, tests/unit/montagem.test.ts confere que a montagem devolve o HTML original byte a byte (com LF). */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const RAIZ = process.cwd();
const REF = "reference/game_v7.6.html";
const REF_TESTE = "reference/vtest_v7.6.html";

if (existsSync("src/manifest.ts") && !process.argv.includes("--forcar")) {
  console.error("src/manifest.ts já existe: a extração já foi feita. Use --forcar para refazer (sobrescreve src/).");
  process.exit(1);
}

const escrever = (rel: string, dados: string | Buffer) => {
  mkdirSync(dirname(join(RAIZ, rel)), { recursive: true });
  writeFileSync(join(RAIZ, rel), dados);
};
const lf = (s: string) => s.replace(/\r\n/g, "\n");
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
const dois = (n: number) => String(n).padStart(2, "0");

/** Divide o texto em linhas mantendo o "\n" no fim de cada uma (juntar devolve o original). */
const linhas = (s: string): string[] => s.match(/[^\n]*\n|[^\n]+$/g) ?? [];
/** Corta `ls` (linhas com \n) nos índices dados (cada índice começa um pedaço). */
const cortar = (ls: string[], inicios: number[]) =>
  inicios.map((ini, i) => ls.slice(ini, inicios[i + 1] ?? ls.length).join(""));

const html = lf(readFileSync(REF, "utf8"));

/* ---------- 1. blocos <style> e <script> ---------- */
const reEstilo = /<style( id="ico-css")?>\n([\s\S]*?)<\/style>/g;
const blocos = [...html.slice(0, html.indexOf("</head>")).matchAll(reEstilo)];
if (blocos.length !== 3 || blocos[2][1] === undefined)
  throw new Error("esperados 3 <style> no <head>, o último ico-css");
const iniEstilos = blocos[0].index!;
const fimEstilos = blocos[2].index! + blocos[2][0].length;
if (html.slice(fimEstilos, fimEstilos + 8) !== "\n</head>") throw new Error("esperado </head> depois dos estilos");

const iniScript = html.indexOf("<script>");
const fimScript = html.indexOf("</script>", iniScript) + "</script>".length;
if (html.lastIndexOf("</script>") !== fimScript - 9) throw new Error("esperado um único <script> no fim do body");
const js = html.slice(iniScript + "<script>\n".length, fimScript - "</script>".length);

/* ---------- 2. imagens ---------- */
const MAPA = "/src/assets/map/mapa.webp";
const ATLAS = "/src/assets/art/atlas.webp";
const reMapa = /(<img id="map-img" src=")data:image\/webp;base64,([A-Za-z0-9+/=]+)(")/;
const mMapa = html.match(reMapa);
if (!mMapa) throw new Error("<img id=map-img> não encontrado");
escrever(MAPA.slice(1), Buffer.from(mMapa[2], "base64"));

/* ---------- 3. index.html ---------- */
const indexHtml =
  html.slice(0, iniEstilos) +
  "<!--@jogo:estilos-->" +
  html.slice(fimEstilos, iniScript).replace(reMapa, `$1${MAPA}$3`) +
  "<!--@jogo:script-->" +
  html.slice(fimScript);
escrever("index.html", indexHtml);

/* ---------- 4. ícones pintados ---------- */
const reIco = /^\.ico-(\w+)\{background-image:url\(data:image\/webp;base64,([A-Za-z0-9+/=]+)\)\}$/;
let nIco = 0;
const icoCss = blocos[2][2]
  .split("\n")
  .map((l) => {
    if (l === "") return l;
    const m = l.match(reIco);
    if (!m) throw new Error("linha inesperada no ico-css: " + l.slice(0, 80));
    escrever(`src/assets/icons/${m[1]}.webp`, Buffer.from(m[2], "base64"));
    nIco++;
    return `.ico-${m[1]}{background-image:url(/src/assets/icons/${m[1]}.webp)}`;
  })
  .join("\n");
escrever("src/styles/icones-pintados.css", icoCss);

/* ---------- 5. CSS: corta nos comentários de seção (coluna 0) ---------- */
const arquivosCss: string[][] = [];
let nCss = 0;
for (const [b, re] of [
  [0, /^\/\*/],
  [1, /^\/\* (=====|v\d)/],
] as const) {
  const ls = linhas(blocos[b][2]);
  const inicios = [0, ...ls.flatMap((l, i) => (i > 0 && re.test(l) ? [i] : []))];
  const lista: string[] = [];
  cortar(ls, inicios).forEach((pedaco, i) => {
    const titulo = i === 0 && b === 0 ? "base" : slug(pedaco.split("\n")[0].replace(/^\/\*|\*\/.*$|=+/g, ""));
    const arq = `src/styles/${dois(nCss++)}_${titulo}.css`;
    escrever(arq, pedaco);
    lista.push(arq);
  });
  arquivosCss.push(lista);
}

/* ---------- 6. JS ---------- */
const lsJs = linhas(js);
const contar = (t: string) => js.split(t).length - 1;

// 6a. onde cada módulo começa (primeira linha única do arquivo do módulo, recuando as anteriores)
const mods = readdirSync("src/modules")
  .filter((f) => f.endsWith(".js"))
  .map((f) => {
    const ml = lf(readFileSync(join("src/modules", f), "utf8")).split("\n");
    const k = ml.findIndex((l) => l.trim().length > 25 && contar(l + "\n") === 1);
    if (k < 0) throw new Error("módulo sem linha única: " + f);
    const linha = lsJs.indexOf(ml[k] + "\n") - k;
    for (let j = 0; j < k; j++)
      if (lsJs[linha + j] !== ml[j] + "\n") throw new Error("início do módulo não bate: " + f);
    return { f, linha };
  })
  .sort((a, b) => a.linha - b.linha);
const iniMods = mods[0].linha;
const fimMods = lsJs.findIndex((l) => l.startsWith("/* ===== v3.10: QUALIDADE DOS ITENS"));

// 6b. a base: cabeçalhos "/* ===" fora da região dos módulos, + a linha do MAPDATA + o fechamento do IIFE
const NOMES_BASE = [
  "nucleo",
  "v3.8_nascimento_arvores",
  "v3.8_interface_ficha",
  "v3.8_ganchos_combate",
  "v3.9_janelas_mochila",
  "v3.0_economia_bau_mercado",
  "v3.10_minigames",
  "v3.4_fauna_recursos_crafting",
  "v3.7_criacao_preparo",
  "v3.6_expedicao",
  "v3.6_dungeon_projecao",
  "v3.12_webgl_lowpoly",
  "v3.17_mapdata",
  "v3.18_mundo_4x_mapa_vetorial",
  "v3.18_quadrantes",
  "v4.3_equipamento",
  "v3.6.7_dano_no_lobo",
  "v3.10_qualidade_itens",
  "v3.16_meta",
  "v3.16_historia_cinematica",
];
const iMapdata = lsJs.findIndex((l) => l.startsWith("const MAPDATA = {"));
const iFim = lsJs.lastIndexOf("})();\n");
if (lsJs[iFim - 1] !== "/*SIMHOOK*/\n") throw new Error("fechamento do IIFE não encontrado");
const iniBase = [
  0,
  ...lsJs.flatMap((l, i) => (i > 0 && (i < iniMods || i >= fimMods) && /^\/\* ?={3,}/.test(l) ? [i] : [])),
  iMapdata,
].sort((a, b) => a - b);
if (iniBase.length !== NOMES_BASE.length) throw new Error(`base: ${iniBase.length} seções, ${NOMES_BASE.length} nomes`);

type Pedaco = { ini: number; arq: string };
const pedacos: Pedaco[] = [
  ...iniBase.map((ini, i) => ({ ini, arq: `src/js/base/${dois(i)}_${NOMES_BASE[i]}.js` })),
  ...mods.map((m) => ({ ini: m.linha, arq: `src/js/modulos/${m.f}` })),
  { ini: iFim, arq: "src/js/base/99_fim.js" },
].sort((a, b) => a.ini - b.ini);
const textos = cortar(
  lsJs,
  pedacos.map((p) => p.ini),
);

// 6c. MAPDATA e ATLAS viram referências a arquivos
const arquivosJs = pedacos.map((p, i) => {
  let t = textos[i];
  if (p.arq.includes("mapdata")) {
    const m = t.match(/^const MAPDATA = (\{.*\});\n/);
    if (!m) throw new Error("linha do MAPDATA inesperada");
    JSON.parse(m[1]);
    escrever("src/assets/map/mapdata.json", m[1]);
    t = t.replace(m[1], () => "/* @inline-json src/assets/map/mapdata.json */ {}");
  }
  const reAtlas = /(const ATLAS = new Image\(\); ATLAS\.src = ")data:image\/webp;base64,([A-Za-z0-9+/=]+)(";)/;
  const mA = t.match(reAtlas);
  if (mA) {
    escrever(ATLAS.slice(1), Buffer.from(mA[2], "base64"));
    t = t.replace(reAtlas, `$1${ATLAS}$3`);
  }
  if (/data:image\//.test(t) && /base64,[A-Za-z0-9+/]{200}/.test(t))
    throw new Error("imagem embutida que sobrou em " + p.arq);
  escrever(p.arq, t);
  return p.arq;
});

/* ---------- 7. gancho de teste (o window.__t de scripts/make_test_build.py) ---------- */
const teste = lf(readFileSync(REF_TESTE, "utf8"));
const iHook = teste.indexOf("window.__t={");
const hook = teste.slice(iHook, teste.indexOf("\n", iHook) + 1);
escrever("src/dev/testHook.js", hook);

/* ---------- 8. manifesto ---------- */
const lista = (xs: string[]) => xs.map((x) => `    "${x}",`).join("\n");
escrever(
  "src/manifest.ts",
  `/* Ordem da montagem do jogo (Fase 2 do ROADMAP). Gerado uma vez por tools/extract.ts; daqui em diante, edite à mão.
   Quem lê: tools/lib/montagem.ts (plugin do Vite e testes). Caminhos relativos à raiz do projeto.
   - estilos: cada bloco vira um <style> no <head>, na ordem; o texto é a concatenação exata dos arquivos.
     O bloco "ico-css" precisa continuar com esse id e com uma regra .ico-<chave>{background-image:url(...)} por
     linha: o jogo lê esse <style> com regex para montar o ICOS (ver src/js/modulos/v5.2_icones_pintados.js).
   - scripts: concatenados num único <script> CLÁSSICO, na ordem (o IIFE abre em base/00 e fecha em base/99).
     Os arquivos não são JS válido isoladamente; só a concatenação é. O último tem que ser base/99_fim.js. */

export interface BlocoEstilo {
  id?: string;
  arquivos: string[];
}

export const estilos: BlocoEstilo[] = [
${[...arquivosCss.map((a) => `  {\n    arquivos: [\n${lista(a)}\n    ],\n  },`), `  { id: "ico-css", arquivos: ["src/styles/icones-pintados.css"] },`].join("\n")}
];

export const scripts: string[] = [
${arquivosJs.map((x) => `  "${x}",`).join("\n")}
];

/** Injetado antes do último script no build de teste (dist/vtest.html). */
export const ganchoTeste = "src/dev/testHook.js";
`,
);

console.log(
  `ok: ${nIco} ícones, ${nCss} CSS, ${arquivosJs.length} JS (${mods.length} módulos), mapa + atlas + mapdata.`,
);
console.log("Agora confira: npm test (tests/unit/montagem.test.ts compara a montagem com reference/ byte a byte).");
