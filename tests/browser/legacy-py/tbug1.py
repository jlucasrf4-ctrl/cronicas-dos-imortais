import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console", lambda m: m.type=="error" and errs.append(m.text))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    pg.mouse.click(600,400); pg.keyboard.press("k"); pg.wait_for_timeout(800)
    print("sheet open", J("__t.sheet? JSON.stringify(__t.sheet):'?'"), errs[:5])
    pg.screenshot(path="s_k.png")
    pg.keyboard.press("k"); pg.wait_for_timeout(500); pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
    print("after", J("JSON.stringify({open: __t.sheet && __t.sheet.open, paused: __t.dungeon.paused, px: __t.dungeon.px})"))
    pg.keyboard.down("d"); pg.wait_for_timeout(600); pg.keyboard.up("d"); print("moved px", J("__t.dungeon.px"))
    print(errs[:5]); b.close()
