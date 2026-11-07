import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    pg.mouse.click(600,400); pg.wait_for_timeout(500)
    J(pg,"document.querySelector('[data-act=new]').click()"); pg.wait_for_timeout(800); J(pg,"__t.introSkip()"); pg.wait_for_timeout(800)
    J(pg,"document.getElementById('create-cancel').click(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.world.tick=11*60; __t.updateHeroPanelUI()")
    pg.wait_for_timeout(3000); pg.screenshot(path="ng_view.png")
    print(J(pg,"[__t.quadName(__t.QUAD.active), __h.camp.x|0, __h.camp.y|0, __t.camera.scale.toFixed(2)]"), errs[:4]); b.close()
