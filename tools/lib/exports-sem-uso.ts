/* Exports de src/ que nenhum arquivo do projeto (src/, tests/, tools/) importa (Fase 8.2 do ROADMAP).
   O ESLint (no-unused-vars) não enxerga isso: uma export conta como usada. Lê só a sintaxe (sem typecheck):
   cada `import { a, b } from "./x.ts"` / `export { a } from …` marca os nomes; `import * as` e `import("…")`
   marcam o módulo inteiro. Uma export que só o próprio módulo usa perde o `export`; a que ninguém usa, sai. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export interface ExportSemUso {
  arquivo: string;
  nome: string;
  linha: number;
}

function listar(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === "resultados" ? [] : listar(p);
    return /\.(ts|mts)$/.test(e.name) && !e.name.endsWith(".d.ts") ? [p] : [];
  });
}

export function exportsSemUso(raiz: string): ExportSemUso[] {
  const norm = (p: string) => path.resolve(p).toLowerCase();
  const src = norm(path.join(raiz, "src"));
  const arquivos = ["src", "tests", "tools"].flatMap((d) => listar(path.join(raiz, d)));
  const usados = new Map<string, Set<string>>(); // módulo -> nomes importados dele
  const inteiros = new Set<string>(); // módulos importados com `* as` ou import() dinâmico
  const nomesDe = (alvo: string) => usados.get(alvo) ?? usados.set(alvo, new Set()).get(alvo)!;

  for (const f of arquivos) {
    const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true);
    const alvoDe = (esp: ts.Expression | undefined) =>
      esp && ts.isStringLiteral(esp) && esp.text.startsWith(".") ? norm(path.resolve(path.dirname(f), esp.text)) : null;
    const visitar = (n: ts.Node): void => {
      if (ts.isImportDeclaration(n)) {
        const alvo = alvoDe(n.moduleSpecifier),
          nb = n.importClause?.namedBindings;
        if (alvo) {
          if (nb && ts.isNamespaceImport(nb)) inteiros.add(alvo);
          else if (nb) for (const e of nb.elements) nomesDe(alvo).add((e.propertyName ?? e.name).text);
          if (n.importClause?.name) nomesDe(alvo).add("default");
        }
      } else if (ts.isExportDeclaration(n)) {
        const alvo = alvoDe(n.moduleSpecifier);
        if (alvo && n.exportClause && ts.isNamedExports(n.exportClause))
          for (const e of n.exportClause.elements) nomesDe(alvo).add((e.propertyName ?? e.name).text);
        else if (alvo) inteiros.add(alvo);
      } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const alvo = alvoDe(n.arguments[0]);
        if (alvo) inteiros.add(alvo);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }

  const saida: ExportSemUso[] = [];
  for (const f of arquivos) {
    const alvo = norm(f);
    if (!alvo.startsWith(src + path.sep) || inteiros.has(alvo)) continue;
    const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true);
    const u = usados.get(alvo) ?? new Set();
    for (const st of sf.statements) {
      const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
      if (!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      const nomes: string[] = [];
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) nomes.push(d.name.text);
      } else if (
        (ts.isFunctionDeclaration(st) ||
          ts.isClassDeclaration(st) ||
          ts.isInterfaceDeclaration(st) ||
          ts.isTypeAliasDeclaration(st) ||
          ts.isEnumDeclaration(st)) &&
        st.name
      )
        nomes.push(st.name.text);
      const linha = sf.getLineAndCharacterOfPosition(st.getStart()).line + 1;
      for (const nome of nomes)
        if (!u.has(nome)) saida.push({ arquivo: path.relative(raiz, f).replace(/\\/g, "/"), nome, linha });
    }
  }
  return saida;
}
