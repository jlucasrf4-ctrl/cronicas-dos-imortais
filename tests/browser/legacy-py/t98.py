import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1000)
    J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const d=__t.dungeon; d.px=168; d.py=273;})()"); pg.wait_for_timeout(800)
    pg.screenshot(path="s_cmp1.png", clip={"x":0,"y":250,"width":700,"height":400})
    b.close()
