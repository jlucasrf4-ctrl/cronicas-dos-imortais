import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(500)
    print(J("""new Promise(res=>{const A=__t.MAPFX; const f={h:__h,x:__h.x,y:__h.y-6,txt:'+1',ico:'x',t0:performance.now()}; A.push(f); const log=[]; let n=0; const tick=()=>{log.push([Math.round(performance.now()-f.t0), A.length, A.indexOf(f)]); if(++n<20) requestAnimationFrame(tick); else res(log)}; requestAnimationFrame(tick)})"""))
    b.close()
