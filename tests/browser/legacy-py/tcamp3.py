import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1500)
    J("window.__log=[]; const t0=performance.now(); (function f(){ __log.push([Math.round(performance.now()-t0), +__t.camera.scale.toFixed(2), __t.dungeon.active]); if(performance.now()-t0<1600) requestAnimationFrame(f); })(); document.querySelector('[data-act=camp]').click()")
    pg.wait_for_timeout(1800); L=J("__log"); print(L[::max(1,len(L)//15)])
    print(errs[:5]); b.close()
