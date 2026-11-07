import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1000)
    J("__t.tameStart(__t.wildAnteaters()[0])"); pg.wait_for_timeout(1500); pg.screenshot(path="r0.png")
    J("__t.tameGo()"); pg.wait_for_timeout(900); J("__t.TAME.g.anim={a:8,b:9,t:0}; __t.TAME.g.txt={t:'Giro para a esquerda!',k:1}"); pg.wait_for_timeout(120); pg.screenshot(path="r1.png")
    J("__t.TAME.g.anim=null; __t.TAME.g.pos=0.5; __t.TAME.g.vel=0"); pg.wait_for_timeout(60); pg.screenshot(path="r2.png")
    J("__t.TAME.g.pos=1.2"); pg.wait_for_timeout(300); pg.screenshot(path="r3.png")
    print(errs[:4]); b.close()
