/* Qual renderizador WebGL o Chromium headless usa com cada opção de inicialização (GPU de verdade ou SwiftShader).
   Uso: node tests/browser/tools/perf/gl.ts. Substitui o antigo tgl.py. */
import { chromium } from "@playwright/test";

const expr =
  "(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return 'nenhum';const e=g.getExtension('WEBGL_debug_renderer_info');return (g instanceof WebGL2RenderingContext?'gl2 ':'gl1 ')+(e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'')})()";
for (const launchArgs of [
  [],
  ["--use-angle=d3d11"],
  ["--use-angle=gl"],
  ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
]) {
  const b = await chromium.launch({ args: launchArgs });
  const p = await b.newPage();
  console.log(JSON.stringify(launchArgs).padEnd(50), await p.evaluate(expr));
  await b.close();
}
