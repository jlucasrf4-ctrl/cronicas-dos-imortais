import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type=="error" and "ERR_TUNNEL" not in m.text else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2500)
    pg.screenshot(path="ts1.png")
    pg.mouse.click(600,400); pg.wait_for_timeout(1200); pg.screenshot(path="ts2.png")
    pg.keyboard.press("ArrowDown"); pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(200)
    J(pg,"document.querySelector('[data-act=options]').click()"); pg.wait_for_timeout(500); pg.screenshot(path="ts3.png")
    print(errs[:5]); b.close()
