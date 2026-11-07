import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1000)
    J("__t.tameStart(__t.wildAnteaters()[0])"); pg.wait_for_timeout(1500); J("__t.tameGo()"); pg.wait_for_timeout(600); pg.screenshot(path="tam_tame.png"); J("__t.tameWin(); __t.tameName()")
    J("const it=__t.mkItem('pele'); __t.placeIn(__t.mountBag(), it);")
    J("__t.enterCamp(__h)"); pg.wait_for_timeout(4500); print("camp mount", J("JSON.stringify(__t.dungeon.mount)"))
    J("const d=__t.dungeon; d.px=d.mount.x+30; d.py=d.mount.y+10;"); pg.wait_for_timeout(600); pg.screenshot(path="tam_camp.png")
    J("__t.interact()"); pg.wait_for_timeout(500); print("panel", J("__t.MP? 1:0"), J("document.getElementById('mount-modal').classList.contains('open')")); J("__t.mpClose()")
    J("const d=__t.dungeon; d.px=d.mount.x+40; d.py=d.mount.y; __t.toggleInv(true)"); pg.wait_for_timeout(600); pg.screenshot(path="tam_inv.png"); print("saddle", J("getComputedStyle(document.getElementById('ib-saddle')).display"))
    print(errs[:5]); b.close()
