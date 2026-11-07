/* Plugin do Vite que monta o jogo a partir de index.html + src/ (Fases 2 e 4 do ROADMAP).

   - O JS é o de src/main.ts e dos módulos que ele importa (o Vite os empacota num <script type="module"> só).
   - transformIndexHtml (order "post", depois do Vite): troca o marcador do index.html pelos <style> de
     src/manifest.ts.
   - No build, as referências "/src/assets/..." viram data URIs (HTML, CSS e módulos de src/).
   - `/* @inline-json <arquivo> *\/ {}` vira o texto do JSON nos módulos de src/ (dev e build).
   - No dev server, mudar um arquivo de estilo ou de src/assets/ recarrega a página (os módulos o Vite já vigia).
   - No fim do build, renomeia dist/index.html para dist/game.html (ou dist/vtest.html no modo "test"). */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { arquivosDeEstilo, inlineAssets, inlineJson, montarHtml } from "./lib/montagem.ts";
import { PASTA_NOVOS, importarPasta } from "./lib/importar.ts";

const barras = (caminho: string) => caminho.replace(/\\/g, "/");

/* v8.1 — o Modo Editor no servidor ao vivo (src/editor/dados.ts fala com isto):
   GET  /__editor/ping                  "ok" (o editor sabe que pode gravar no arquivo)
   POST /__editor/salvar[?historico=1]  grava src/assets/map/decoracao.json (+ uma cópia com data em editor-historico/)
   GET  /__editor/historico             as cópias, mais novas primeiro: [{ arq, quando, pecas, recados }]
   GET  /__editor/versao?arq=…          uma cópia
   GET  /__editor/modelos               os modelos importados (src/assets/editor/modelos.json)
   E vigia modelos-novos/: cada .glb novo vira modelo (tools/lib/importar.ts) e o editor aberto recebe
   "editor:modelos" sem recarregar. */
const DECORACAO = "src/assets/map/decoracao.json";
const HISTORICO = "editor-historico";
const HIST_MAX = 300;
function editorNoServidor(server: ViteDevServer, raiz: string) {
  const responder = (res: import("node:http").ServerResponse, cod: number, corpo: string, tipo = "text/plain") => {
    res.statusCode = cod;
    res.setHeader("Content-Type", tipo + "; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(corpo);
  };
  const pastaHist = join(raiz, HISTORICO);
  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url || "/", "http://x");
    if (!url.pathname.startsWith("/__editor/")) return next();
    const rota = url.pathname.slice(10);
    try {
      if (rota === "ping") return responder(res, 200, "ok");
      if (rota === "salvar" && req.method === "POST") {
        let corpo = "";
        req.setEncoding("utf8");
        req.on("data", (p: string) => (corpo += p));
        req.on("end", () => {
          try {
            const d = JSON.parse(corpo);
            if (!d || d.versao !== 1 || typeof d.cenas !== "object") throw new Error("arquivo de decoração inválido");
            writeFileSync(join(raiz, DECORACAO), corpo);
            if (url.searchParams.get("historico")) {
              mkdirSync(pastaHist, { recursive: true });
              const agora = new Date(),
                p2 = (n: number) => String(n).padStart(2, "0"),
                nome = `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}_${p2(agora.getHours())}-${p2(agora.getMinutes())}-${p2(agora.getSeconds())}.json`;
              writeFileSync(join(pastaHist, nome), corpo);
              const velhos = readdirSync(pastaHist)
                .filter((f) => f.endsWith(".json"))
                .sort();
              for (const f of velhos.slice(0, Math.max(0, velhos.length - HIST_MAX))) unlinkSync(join(pastaHist, f));
            }
            responder(res, 200, "ok");
          } catch (e) {
            responder(res, 400, String((e as Error).message || e));
          }
        });
        return;
      }
      if (rota === "historico") {
        const lista = existsSync(pastaHist)
          ? readdirSync(pastaHist)
              .filter((f) => /^[\d_-]+\.json$/.test(f))
              .sort()
              .reverse()
              .map((arq) => {
                let pecas = 0,
                  recados = 0;
                try {
                  const d = JSON.parse(readFileSync(join(pastaHist, arq), "utf8"));
                  for (const l of Object.values(d.cenas || {})) pecas += (l as unknown[]).length;
                  for (const l of Object.values(d.recados || {})) recados += (l as unknown[]).length;
                } catch {
                  // cópia estragada: entra na lista com 0 peças
                }
                const m = arq.match(/^(\d+)-(\d+)-(\d+)_(\d+)-(\d+)-(\d+)/);
                return { arq, quando: m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : arq, pecas, recados };
              })
          : [];
        return responder(res, 200, JSON.stringify(lista), "application/json");
      }
      if (rota === "versao") {
        const arq = url.searchParams.get("arq") || "";
        if (!/^[\d_-]+\.json$/.test(arq) || !existsSync(join(pastaHist, arq))) return responder(res, 404, "não achei");
        return responder(res, 200, readFileSync(join(pastaHist, arq), "utf8"), "application/json");
      }
      if (rota === "modelos") {
        const f = join(raiz, "src/assets/editor/modelos.json");
        return responder(res, 200, existsSync(f) ? readFileSync(f, "utf8") : '{"modelos":{}}', "application/json");
      }
      responder(res, 404, "rota do editor desconhecida");
    } catch (e) {
      responder(res, 500, String((e as Error).message || e));
    }
  });
  // modelos-novos/: converte o que chegar (uma rodada por vez; o que chega no meio entra na próxima)
  const fila = { rodando: false, deNovo: false };
  const importar = async () => {
    if (fila.rodando) {
      fila.deNovo = true;
      return;
    }
    fila.rodando = true;
    try {
      const r = await importarPasta(raiz);
      for (const f of r.ok) server.config.logger.info(`[editor] modelo importado: ${f}`);
      for (const e of r.erros) server.config.logger.warn(`[editor] não deu para importar ${e}`);
      if (r.ok.length || r.erros.length)
        server.ws.send({ type: "custom", event: "editor:modelos", data: { ok: r.ok, erros: r.erros } });
    } catch (e) {
      server.config.logger.warn(`[editor] importação: ${(e as Error).message || e}`);
    } finally {
      fila.rodando = false;
      if (fila.deNovo) {
        fila.deNovo = false;
        void importar();
      }
    }
  };
  mkdirSync(join(raiz, PASTA_NOVOS), { recursive: true });
  server.watcher.add(join(raiz, PASTA_NOVOS));
  const daPasta = (arq: string) => barras(relative(raiz, arq)).startsWith(PASTA_NOVOS + "/") && /\.glb$/i.test(arq);
  let espera: ReturnType<typeof setTimeout> | null = null;
  const logo = () => {
    // o arquivo pode ainda estar sendo copiado: espera ele parar de mudar
    if (espera) clearTimeout(espera);
    espera = setTimeout(() => void importar(), 1500);
  };
  server.watcher.on("add", (a) => daPasta(a) && logo());
  server.watcher.on("change", (a) => daPasta(a) && logo());
  void importar();
}

export function jogo(op: { saida?: string }): Plugin {
  let raiz = process.cwd();
  let build = false;
  let outDir = "dist";
  let grava = true;
  return {
    name: "jogo",
    configResolved(c) {
      raiz = c.root;
      build = c.command === "build";
      outDir = c.build.outDir;
      grava = c.build.write !== false;
    },
    // "pre": antes da transpilação do TypeScript, que tira os comentários (e com eles o marcador @inline-json)
    transform: {
      order: "pre",
      handler(codigo, id) {
        if (!barras(id).startsWith(barras(raiz) + "/src/")) return null;
        const json = inlineJson(raiz, codigo);
        const novo = build ? inlineAssets(raiz, json) : json;
        return novo === codigo ? null : novo;
      },
    },
    transformIndexHtml: {
      order: "post",
      handler: (html) => montarHtml(raiz, html, { inline: build }),
    },
    configureServer(server) {
      const vigiados = new Set(arquivosDeEstilo().map(barras));
      server.watcher.on("change", (arq) => {
        const rel = barras(relative(raiz, arq));
        if (!vigiados.has(rel) && !rel.startsWith("src/assets/")) return;
        // um JSON de src/assets/ entra no módulo pelo @inline-json: sem invalidar, o Vite servia o módulo já
        // transformado, com o JSON antigo (o tamanduá novo não aparecia no npm run dev)
        if (rel.startsWith("src/assets/")) server.moduleGraph.invalidateAll();
        // v8.1: o que o Modo Editor grava (a decoração, os modelos importados) não recarrega a página do editor
        if (rel === DECORACAO || rel.startsWith("src/assets/editor/")) return;
        server.ws.send({ type: "full-reload" });
      });
      editorNoServidor(server, raiz);
    },
    closeBundle() {
      if (build && grava && op.saida) renameSync(join(outDir, "index.html"), join(outDir, op.saida));
    },
  };
}
