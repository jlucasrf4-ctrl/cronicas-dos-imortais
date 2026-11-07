/* Chamadas de desenho do WebGL por quadro no campo (draw calls, vértices, trocas de programa e de buffer).
   Uso: node tests/browser/tools/perf/glstat.ts [--ref]. Substitui o antigo glstat.py. */
import { abrirJogo, cenario } from "../abrir.ts";

const s = await abrirJogo();
await cenario(s, "campo");
await s.js(
  "(()=>{const gl=__t.GL3.gl; const S={calls:0,verts:0,prog:0,buf:0}; const da=gl.drawArrays.bind(gl), de=gl.drawElements.bind(gl), up=gl.useProgram.bind(gl), bb=gl.bindBuffer.bind(gl); gl.drawArrays=(m,f,c)=>{S.calls++;S.verts+=c;return da(m,f,c)}; gl.drawElements=(m,c,t,o)=>{S.calls++;S.verts+=c;return de(m,c,t,o)}; gl.useProgram=(p)=>{S.prog++;return up(p)}; gl.bindBuffer=(t,b)=>{S.buf++;return bb(t,b)}; window.__S=S;})()",
);
await s.esperar(2000);
console.log(
  "por quadro",
  await s.js(
    "(()=>{const S=__S; for(const k in S) S[k]=0; return new Promise(r=>{let n=0; function f(){n++; if(n<30) requestAnimationFrame(f); else r(Object.fromEntries(Object.entries(S).map(([k,v])=>[k,Math.round(v/30)])))} requestAnimationFrame(f)})})()",
  ),
);
console.log("itens na lista", await s.js("__t.GL3.list.length"));
console.log("canvas", await s.js("[__t.GL3.cv.width, __t.GL3.cv.height, devicePixelRatio]"));
await s.browser.close();
