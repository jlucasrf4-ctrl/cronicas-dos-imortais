import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.closeTitle(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); for(const k of ['carne','pele','presa','gema']) __t.tryAddItem(__h,k,0); __t.launchDungeon(__h.id)")
    pg.wait_for_timeout(3000); J(pg,"__t.dungeon.flow='x'; __t.dungeon.monsters.length=0")
    pg.keyboard.press("KeyI"); pg.wait_for_timeout(500)
    cell=pg.locator("#inv-grid .inv-item").nth(1).locator(".inv-cell").first; bb=cell.bounding_box(); g=pg.locator("#inv-grid").bounding_box()
    pg.mouse.move(bb['x']+4,bb['y']+4); pg.mouse.down(); pg.mouse.move(g['x']+150,g['y']+100,steps=10); pg.wait_for_timeout(400)
    pg.screenshot(path="inv_drag.png"); print(J(pg,"document.querySelectorAll('#inv-grid .ghost').length")); pg.mouse.up(); b.close()
