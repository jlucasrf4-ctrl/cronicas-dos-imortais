/* Fase 5: mostra o que o tsc reclamaria de src/ sem os `// @ts-nocheck` e, com --com, com opções mais estritas
   (lógica em lib/sem-nocheck.ts).

   Uso:  npm run tools:sem-nocheck                     erros por arquivo (só os que têm a diretiva), do menor ao maior
         npm run tools:sem-nocheck -- --com noImplicitAny   (repita --com) liga a opção do tsc e lista todo módulo
         npm run tools:sem-nocheck -- <trecho>         os erros dos arquivos cujo caminho contém <trecho>
         npm run tools:sem-nocheck -- --tipos          campos usados que faltam nos tipos de src/core/tipos.ts
         npm run tools:sem-nocheck -- --codigos        quantos erros de cada código TS
   As opções combinam (--com strictNullChecks --codigos, --com noImplicitAny field/). Não muda nada em disco.
   Um módulo com 0 erros pode perder a diretiva (ou passar a valer com a opção nova). */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { errosSemNocheck, propriedadesFaltando, temNocheck } from "./lib/sem-nocheck.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const args: string[] = [];
const opcoes: Record<string, boolean> = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--com") opcoes[process.argv[++i]] = true;
  else args.push(process.argv[i]);
}
const estrito = Object.keys(opcoes).length > 0;
const erros = errosSemNocheck(raiz, opcoes);
const comDiretiva = (f: string) => temNocheck(readFileSync(path.join(raiz, f), "utf8"));
// sem --com: só os módulos que ainda têm a diretiva; com --com: todos
const conta = (f: string) => estrito || comDiretiva(f);

if (args.includes("--tipos")) {
  const tiposTxt = readFileSync(path.join(raiz, "src/core/tipos.ts"), "utf8");
  const tipos = new Set([...tiposTxt.matchAll(/^export (?:interface|type) (\w+)/gm)].map((m) => m[1]));
  const faltas = propriedadesFaltando(erros, tipos);
  if (!faltas.size) console.log("nenhum campo faltando nos tipos de src/core/tipos.ts");
  for (const [t, ps] of faltas) {
    console.log(`\n${t} (${ps.size})`);
    for (const [p, onde] of [...ps].sort((a, b) => a[0].localeCompare(b[0])))
      console.log(`  ${p}  ${onde.slice(0, 3).join(" ")}${onde.length > 3 ? ` +${onde.length - 3}` : ""}`);
  }
} else if (args.includes("--codigos")) {
  const n = new Map<number, number>();
  for (const e of erros) n.set(e.codigo, (n.get(e.codigo) ?? 0) + 1);
  for (const [c, k] of [...n].sort((a, b) => b[1] - a[1])) console.log(`TS${c}  ${k}`);
  console.log(`total ${erros.length}`);
} else if (args.length) {
  const sel = erros.filter((e) => args.some((a) => e.arquivo.includes(a)));
  for (const e of sel) console.log(`${e.arquivo}:${e.linha}:${e.coluna} TS${e.codigo} ${e.texto.split("\n")[0]}`);
  console.log(`${sel.length} erros`);
} else {
  const porArquivo = new Map<string, number>();
  for (const e of erros) porArquivo.set(e.arquivo, (porArquivo.get(e.arquivo) ?? 0) + 1);
  const linhas: [string, number][] = [];
  for (const f of listarSrc(path.join(raiz, "src"))) {
    const rel = path.relative(raiz, f).replace(/\\/g, "/");
    if (conta(rel)) linhas.push([rel, porArquivo.get(rel) ?? 0]);
  }
  linhas.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  for (const [f, k] of linhas) console.log(`${String(k).padStart(5)}  ${f}`);
  const nossos = erros.filter((e) => conta(e.arquivo)).length;
  if (estrito)
    console.log(
      `\ncom ${Object.keys(opcoes).join(", ")}: ${erros.length} erros em ${linhas.filter((l) => l[1]).length} de ${linhas.length} módulos`,
    );
  else {
    console.log(`\n${linhas.length} módulos com @ts-nocheck, ${nossos} erros neles`);
    if (erros.length > nossos)
      console.log(`${erros.length - nossos} erros em módulos sem a diretiva (devem ser 0: veja npm run typecheck)`);
  }
}

function listarSrc(d: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "assets") out.push(...listarSrc(p));
    } else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}
