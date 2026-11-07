/* Montagem do jogo a partir da fonte única (Fases 2 e 4 do ROADMAP).

   index.html tem um marcador, trocado aqui na ordem do manifesto (src/manifest.ts):
     <!--@jogo:estilos-->  -> os blocos <style> (o último é <style id="ico-css">, que o ICOS lê com regex)
   e carrega src/main.ts como <script type="module">, que o Vite empacota com os módulos que ele importa.
   Referências a arquivos:
     "/src/assets/....webp" (em HTML, CSS ou JS) -> no build vira data URI; no dev o Vite serve o arquivo.
       Vale para .webp/.png/.jpg e, desde a v7.7, para fontes .woff2 (src/assets/fonts/, a vinheta Voidd).
     /* @inline-json src/assets/x.json *\/ {}    -> o texto do JSON entra no lugar (dev e build).
   Usado pelo plugin do Vite (tools/vite-plugin-jogo.ts) e pelo build dos testes (tools/lib/construir.ts). */
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { estilos } from "../../src/manifest.ts";

const ler = (raiz: string, rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Os arquivos de estilo (o dev server recarrega a página quando um muda). */
export function arquivosDeEstilo(): string[] {
  return estilos.flatMap((b) => b.arquivos);
}

export function montarEstilos(raiz: string): string {
  return estilos
    .map((b) => `<style${b.id ? ` id="${b.id}"` : ""}>\n${b.arquivos.map((f) => ler(raiz, f)).join("")}</style>`)
    .join("\n");
}

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".m4a": "audio/mp4",
};
const RE_ASSET = /\/src\/assets\/[\w\-./]+\.(?:webp|png|jpe?g|woff2|m4a)/g;
const RE_JSON = /\/\* @inline-json (\S+) \*\/ \{\}/g;

/** "/src/assets/x.webp" -> "data:image/webp;base64,…" */
export function inlineAssets(raiz: string, texto: string): string {
  return texto.replace(RE_ASSET, (url) => {
    const dados = readFileSync(join(raiz, url.slice(1))).toString("base64");
    return `data:${MIME[extname(url).toLowerCase()]};base64,${dados}`;
  });
}

export function inlineJson(raiz: string, texto: string): string {
  return texto.replace(RE_JSON, (_, rel: string) => ler(raiz, rel).replace(/\n$/, ""));
}

/** Troca o marcador de estilos do index.html pelos <style>. */
export function montarHtml(raiz: string, html: string, op: { inline: boolean }): string {
  const marca = "<!--@jogo:estilos-->";
  if (html.split(marca).length !== 2) throw new Error(`index.html: esperado 1 marcador ${marca}`);
  const s = html.replace(marca, () => montarEstilos(raiz));
  return op.inline ? inlineAssets(raiz, s) : s;
}
