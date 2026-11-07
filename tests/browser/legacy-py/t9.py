import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); window.__h=h; __t.econ.quiver.n=10;
      for(const [k,t] of [['carne',0],['carne',1],['carne',2],['presa',0],['presa',2],['pele',1],['lingote',0],['escudo',0],['reliquia',2],['peixe',1],['gema',2],['erva',0],['erva',0]]) __t.tryAddItem(h,k,t);
      __t.resAdd(h,'stone',6); __t.resAdd(h,'feather',3); __t.tryAddQuiver(h,'erva',0); __t.openBag(h.id)})()""")
    pg.wait_for_timeout(400); pg.locator("#bag-win").screenshot(path="fine.png"); b.close()
