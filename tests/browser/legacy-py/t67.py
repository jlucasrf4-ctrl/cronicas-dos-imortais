import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.closeTitle(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(__h.id)")
    pg.wait_for_timeout(3000)
    J(pg,"(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=440; d.py=300; const m=__t.spawnDungeonMonster({}); m.x=d.px+300; m.y=d.py+20; window.__m=m})()")
    for i in range(5):
        pg.wait_for_timeout(600); print(J(pg,"[__m.alerted, __m.st, Math.round(__m.x), Math.round(__m.y), __m.alive, Math.round(__t.dungeon.px), __t.dungeon.hp]"))
    print(errs[:3]); b.close()
