import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
import sys
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.hunterCamp=true; __t.econ.tent=%s; __t.enterCamp(__h)" % sys.argv[1]); pg.wait_for_timeout(4000)
    J("const d=__t.dungeon; d.px=__t.CPS.fire.x-d.tile*1.5; d.py=__t.CPS.fire.y+d.tile*1.2"); pg.wait_for_timeout(800); pg.screenshot(path="cv_%s.png" % sys.argv[1]); b.close()
