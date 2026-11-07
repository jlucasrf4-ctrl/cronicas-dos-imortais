import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[4]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv)>1 else "vtest.html"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + ""+f); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const d=__t.dungeon; d.invuln=999; for(let i=0;i<6;i++){__t.spawnDungeonMonster();} })()"); pg.wait_for_timeout(800)
    print(J("""(()=>{const gl=__t.GL3.gl; const S={calls:0,verts:0,prog:0,tex:0,buf:0}; const da=gl.drawArrays.bind(gl), de=gl.drawElements.bind(gl), up=gl.useProgram.bind(gl), bb=gl.bindBuffer.bind(gl), ba=gl.bindVertexArray?gl.bindVertexArray.bind(gl):null;
      gl.drawArrays=(m,f,c)=>{S.calls++;S.verts+=c;return da(m,f,c)}; gl.drawElements=(m,c,t,o)=>{S.calls++;S.verts+=c;return de(m,c,t,o)}; gl.useProgram=(p)=>{S.prog++;return up(p)}; gl.bindBuffer=(t,b)=>{S.buf++;return bb(t,b)};
      window.__S=S; return 'ok'})()"""))
    pg.wait_for_timeout(2000)
    print(J("(()=>{const S=__S; for(const k in S) S[k]=0; return new Promise(r=>{let n=0; function f(){n++; if(n<30) requestAnimationFrame(f); else r(JSON.stringify(Object.fromEntries(Object.entries(S).map(([k,v])=>[k,Math.round(v/30)]))))} requestAnimationFrame(f)})})()"))
    print("list", J("__t.GL3.list.length"), "scene verts", J("(()=>{const s=__t.GL3.scene; return JSON.stringify({floor:s.floor.n||s.floor.count, deco:s.deco.n||s.deco.count, keys:Object.keys(s.floor)})})()"))
    print("canvas", J("JSON.stringify([__t.GL3.cv.width, __t.GL3.cv.height, devicePixelRatio])"))
    b.close()
