import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); window.__h=h; __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    pg.screenshot(path="d3_a.png")
    J(pg,"""(()=>{for(let i=0;i<3;i++)__t.spawnDungeonMonster({}); __t.spawnDungeonMonster({boss:true}); const d=__t.dungeon; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile*0.6;})()""")
    pg.wait_for_timeout(1200); pg.screenshot(path="d3_b.png")
    print(errs[:5])
    b.close()
