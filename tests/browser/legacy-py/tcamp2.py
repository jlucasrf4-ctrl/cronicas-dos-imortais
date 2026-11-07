import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1500)
    J("document.querySelector('[data-act=camp]').click()"); pg.wait_for_timeout(500); pg.screenshot(path="s_cz_mid.png")
    pg.wait_for_timeout(4000); print("in camp", J("__t.dungeon.camp"), J("getComputedStyle(document.getElementById('dungeon-hint')).visibility"))
    J("const d=__t.dungeon; d.px=d.entrance.x; d.py=d.entrance.y; __t.interact()"); pg.wait_for_timeout(3000)
    J("const t=__t.termiteList()[0]; window.__tm=t"); 
    pg.screenshot(path="s_cz_back.png")
    # zoom close to a termite
    J("const t=__tm, s=__t.camera.minScale*8; __t.camera.scale=s; __t.camera.tx=683-t.x*s; __t.camera.ty=430-t.y*s;"); pg.wait_for_timeout(800); pg.screenshot(path="s_termite.png")
    print(errs[:5]); b.close()
