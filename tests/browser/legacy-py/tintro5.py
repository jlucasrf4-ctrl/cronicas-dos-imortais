import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=false; __t.introStart(__h)"); pg.wait_for_timeout(4500)
    pg.keyboard.down("KeyD"); pg.wait_for_timeout(1500); pg.keyboard.up("KeyD")
    for i in range(30):
        if J("__t.ISC.ph")=="boar": break
        pg.wait_for_timeout(500)
    J("__t.econ.quiver.n=0")
    for i in range(40):
        pg.wait_for_timeout(700)
        print(J("JSON.stringify({ph:__t.ISC.ph,hp:Math.round(__t.dungeon.hp),bst:__t.ISC.boar&&__t.ISC.boar.st,t:__t.ISC.boar&&+(__t.ISC.boar.t||0).toFixed(1),bcd:__t.ISC.boar&&+(__t.ISC.boar.bcd||0).toFixed(1),dist:__t.ISC.boar&&Math.round(Math.hypot(__t.ISC.boar.x-__t.dungeon.px,__t.ISC.boar.y-__t.dungeon.py)),safe:__t.dSafe()})"))
        if J("__t.ISC.ph")!="boar": break
    b.close()
