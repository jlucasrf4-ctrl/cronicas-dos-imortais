import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1500)
    print(J("(()=>{ try{__t.navBuild&&__t.navBuild();}catch(e){} const a=__t.compAt(560,2240), m=__t.compAt(440,2400); const p=__t.findPath(560,2240,440,2400); return JSON.stringify({a,m,len:p&&p.length, ready:__t.NAV.ready, main:__t.NAV.mainComp, sizes:__t.NAV.compSize.slice(0,8)}) })()"))
    b.close()
