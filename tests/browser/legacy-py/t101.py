import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(1000)
    pg.screenshot(path="s_panel.png", clip={"x":0,"y":60,"width":230,"height":360})
    J("document.querySelector('[data-act=\"dtest\"]').click()"); pg.wait_for_timeout(3800)
    J("__t.D3.ZM=0.8; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(1200); pg.screenshot(path="s_arena_final.png")
    b.close()
