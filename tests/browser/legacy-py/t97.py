import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1000)
    J("document.getElementById('prep-train').click()"); pg.wait_for_timeout(3500)
    pg.screenshot(path="s_tr0.png")
    print(J("JSON.stringify({runes:(__t.dungeon.runes||[]).length, loot:__t.dungeon.loot.length, ent:__t.dungeon.entrance, px:__t.dungeon.px})"))
    b.close()
