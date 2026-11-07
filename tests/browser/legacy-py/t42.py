import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    pg.mouse.click(600,400); pg.wait_for_timeout(1500); pg.screenshot(path="ts_newmap.png")
    J(pg,"__t.enterGame(); const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.renderMarket && __t.renderMarket()")
    pg.wait_for_timeout(500)
    print("tempo de 1 tile r=4 (ms):", J(pg,"(()=>{const t=performance.now(); for(let i=0;i<5;i++) __t.MAPART && 0; return 0})()"))
    J(pg,"document.getElementById('btn-market') && document.getElementById('btn-market').click()"); pg.wait_for_timeout(700); pg.screenshot(path="mk_new.png")
    print(errs[:5]); b.close()
