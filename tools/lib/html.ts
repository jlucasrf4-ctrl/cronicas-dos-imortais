/* Utilitários para ler o HTML montado do jogo (sem DOM; roda em Node). */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Conteúdo de todo `<script>` inline (sem `src`), na ordem do arquivo. A referência v7.6 tem `<script>` clássico;
    desde a Fase 4 o build gera `<script type="module" crossorigin>`. */
export function scriptsInline(html: string): string[] {
  return [...html.matchAll(/<script((?:\s+[\w-]+(?:="[^"]*")?)*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\ssrc=/.test(m[1]))
    .map((m) => m[2]);
}

/** O maior `<script>` inline: é o JS principal do jogo (o mesmo que o build grava em build/work/main.js). */
export function scriptPrincipal(html: string): string {
  const scripts = scriptsInline(html);
  if (scripts.length === 0) throw new Error("nenhum <script> inline encontrado no HTML");
  // reduce com ">" mantém o primeiro em caso de empate, como o max() do Python.
  return scripts.reduce((maior, s) => (s.length > maior.length ? s : maior));
}

/** Roda `node --check` no código (script clássico); devolve null se ok, ou a mensagem de erro. */
export function checarSintaxe(js: string): string | null {
  const dir = mkdtempSync(join(tmpdir(), "cdi-check-"));
  try {
    const arq = join(dir, "main.js");
    writeFileSync(arq, js, "utf8");
    const r = spawnSync(process.execPath, ["--check", arq], { encoding: "utf8" });
    return r.status === 0 ? null : r.stderr.slice(-3000) || "node --check falhou";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
