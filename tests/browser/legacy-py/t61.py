import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.closeTitle(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); for(const k of ['carne','pele','presa','gema','pedra','pedra']) __t.tryAddItem(__h,k,0); __t.launchDungeon(__h.id)")
    pg.wait_for_timeout(3000); J(pg,"__t.dungeon.flow='x'; __t.dungeon.monsters.length=0")
    pg.keyboard.press("KeyI"); pg.wait_for_timeout(500)
    cnt=lambda: J(pg,"__h.inv.items.length+':'+__t.qvInv(__h).items.length")
    print("início", cnt())
    def drag(i,tx,ty,label):
        cell=pg.locator("#inv-grid .inv-item").nth(i).locator(".inv-cell").first; bb=cell.bounding_box()
        pg.mouse.move(bb['x']+4,bb['y']+4); pg.mouse.down(); pg.mouse.move(tx,ty,steps=10); pg.wait_for_timeout(300); pg.mouse.up(); pg.wait_for_timeout(300); print(label, cnt())
    g=pg.locator("#inv-grid").bounding_box(); q=pg.locator("#inv-qv").bounding_box()
    drag(0,g['x']+g['width']+150,g['y']+50,"fora da grade")
    drag(0,q['x']+q['width']-10,q['y']+10,"para aljava")
    drag(1,g['x']+30,g['y']+30,"em cima de outro")
    drag(2,g['x']+g['width']-20,g['y']+g['height']-20,"canto")
    print(errs[:3]); b.close()
