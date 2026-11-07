import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)

    J("const d=__t.dungeon; d.monsters.length=0; window.__w=__t.trainWolf(); __w.x=d.px+24; __w.y=d.py; __t.cravStart(__w,'eq_espada'); d.crav.t=3.99")
    print(J("(()=>{const d=__t.dungeon, hp=d.hp; __t.cravTick(0.05); return JSON.stringify({hp0:hp, hp1:d.hp, max:d.hpMax, wound:d.wound, L:(__t.dungeon.toasts||[]).slice(-4).map(x=>x.text||x.t)})})()"))
    b.close()
