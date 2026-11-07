import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); for(const k of ['carne','pele','gema','presa']) __t.tryAddToInv(__t.econ.stash,k,0); __t.tryAddItem(__h,'erva',0)")
    J(pg,"document.getElementById('btn-chest').click()"); pg.wait_for_timeout(500)
    c=lambda: J(pg,"[__t.econ.stash.items.length, __h.inv.items.length, document.getElementById('chest-msg').textContent]")
    J(pg,"document.getElementById('chest-all-out').click()"); print("baú→mochila", c())
    J(pg,"document.getElementById('chest-all-in').click()"); print("mochila→baú", c()); pg.screenshot(path="chest_btn.png"); print(errs[:3]); b.close()
