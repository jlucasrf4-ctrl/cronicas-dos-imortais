/* Fase 5: o que o tsc diria de src/ se nenhum módulo tivesse `// @ts-nocheck`.
   Monta um programa com o tsconfig do projeto e um CompilerHost que entrega os arquivos de src/ com a linha da
   diretiva trocada por `//` (o número de linhas não muda, então as posições dos erros valem para o arquivo real).
   Nada é gravado em disco. */
import path from "node:path";
import ts from "typescript";

export interface ErroTs {
  arquivo: string; // relativo à raiz, com "/"
  linha: number;
  coluna: number;
  codigo: number;
  texto: string;
}

const DIRETIVA = /^\/\/ @ts-nocheck.*$/m;

export function tiraNocheck(texto: string): string {
  return texto.replace(DIRETIVA, "//");
}

export function temNocheck(texto: string): boolean {
  return DIRETIVA.test(texto);
}

/** Roda o tsc em src/ (sem as diretivas) e devolve os erros dos arquivos de src/. */
export function errosSemNocheck(raiz: string, opcoesExtra: ts.CompilerOptions = {}): ErroTs[] {
  raiz = path.resolve(raiz); // os nomes do programa são absolutos
  const cfgPath = path.join(raiz, "tsconfig.json");
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  if (cfg.error) throw new Error(ts.flattenDiagnosticMessageText(cfg.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, raiz);
  const src = path.join(raiz, "src") + path.sep;
  const nomes = parsed.fileNames.filter((f) => path.resolve(f).startsWith(src));
  const opcoes = { ...parsed.options, ...opcoesExtra, noEmit: true };
  const host = ts.createCompilerHost(opcoes);
  const ler = host.readFile.bind(host);
  host.readFile = (f) => {
    const t = ler(f);
    return t !== undefined && path.resolve(f).startsWith(src) ? tiraNocheck(t) : t;
  };
  const prog = ts.createProgram(nomes, opcoes, host);
  const out: ErroTs[] = [];
  for (const d of ts.getPreEmitDiagnostics(prog)) {
    if (!d.file || !path.resolve(d.file.fileName).startsWith(src)) continue;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    out.push({
      arquivo: path.relative(raiz, d.file.fileName).replace(/\\/g, "/"),
      linha: line + 1,
      coluna: character + 1,
      codigo: d.code,
      texto: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
    });
  }
  return out;
}

/** "Property 'x' does not exist on type 'T'" agrupado por tipo → propriedade → onde. */
export function propriedadesFaltando(erros: ErroTs[], tipos: Set<string>): Map<string, Map<string, string[]>> {
  const m = new Map<string, Map<string, string[]>>();
  for (const e of erros) {
    if (e.codigo !== 2339 && e.codigo !== 2551) continue;
    const r = /^Property '([^']+)' does not exist on type '([^']+)'/.exec(e.texto);
    if (!r || !tipos.has(r[2])) continue;
    if (!m.has(r[2])) m.set(r[2], new Map());
    const t = m.get(r[2])!;
    if (!t.has(r[1])) t.set(r[1], []);
    t.get(r[1])!.push(`${e.arquivo}:${e.linha}`);
  }
  return m;
}
