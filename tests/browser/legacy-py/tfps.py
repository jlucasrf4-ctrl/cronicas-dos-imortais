import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860})
    pg.goto(BUILD_URL + ""+sys.argv[1]); pg.wait_for_timeout(3000)
    pg.evaluate("(()=>{__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)})()"); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    if len(sys.argv)>2: pg.evaluate(sys.argv[2])
    pg.wait_for_timeout(500)
    print(sys.argv[1], "fps:", pg.evaluate("new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<3000) requestAnimationFrame(f); else r(n/3)} requestAnimationFrame(f)})"))
    b.close()
