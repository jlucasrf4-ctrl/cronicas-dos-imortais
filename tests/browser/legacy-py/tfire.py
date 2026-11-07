import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; __t.econ.test=true; __t.fireOpen()"); pg.wait_for_timeout(400); pg.screenshot(path="fm0.png")
    J("__t.fireStart('pedra')"); pg.wait_for_timeout(300); J("const g=__t.FIRE.mg; g.pos=g.zc; __t.fireKey('hit')"); pg.wait_for_timeout(120); pg.screenshot(path="fm1.png")
    J("__t.fireClose(); __t.fireOpen(); __t.fireStart('galho')"); 
    for i in range(14): J(f"__t.fireKey('{'L' if i%2==0 else 'R'}')"); pg.wait_for_timeout(150)
    pg.screenshot(path="fm2.png")
    J("__t.fireClose(); const d=__t.dungeon; d.fires=[{x:d.px+40,y:d.py,t:100,max:130}]"); pg.wait_for_timeout(900); pg.screenshot(path="fm3.png")
    print(errs[:4]); b.close()
