import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("const d=__t.dungeon; d.monsters.length=0; window.__m=__t.trainWolf(); __m.hp=__m.hpMax*0.3; __m.x=d.px+d.tile*3; __m.y=d.py; d.mouse={x:__m.x,y:__m.y}")
    pg.keyboard.down("KeyG")
    for i in range(10):
        pg.wait_for_timeout(100); print(J("JSON.stringify({r:!!__t.dungeon.rope, b:__m.bound&&{esc:__m.bound.esc.toFixed(2),t:__m.bound.t.toFixed(2)}, st:__m.st, fol:__m.fol, ko:__m.ko, hold:__t.dungeon.ropeHold, toasts:(__t.dungeon.toasts||[]).slice(-2).map(x=>x.text)})"))
    b.close()
