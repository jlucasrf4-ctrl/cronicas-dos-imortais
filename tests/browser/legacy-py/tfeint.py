import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=false; __t.introStart(__h)"); pg.wait_for_timeout(4500)
    pg.keyboard.down("KeyD"); pg.wait_for_timeout(1500); pg.keyboard.up("KeyD")
    for i in range(30):
        if J("__t.ISC.ph")=="boar": break
        pg.wait_for_timeout(500)
    sts=set()
    for i in range(24):
        pg.wait_for_timeout(500); sts.add(J("__t.ISC.boar.st"))
    print("no shots: states", sts, "hits", J("__t.ISC.gotHit||0"), "shots", J("__t.ISC.shots"))
    J("__t.ISC.shots=2")
    for i in range(24):
        pg.wait_for_timeout(500)
        if J("__t.ISC.gotHit||0"): break
    print("after 2 shots: hits", J("__t.ISC.gotHit||0"))
    b.close()
