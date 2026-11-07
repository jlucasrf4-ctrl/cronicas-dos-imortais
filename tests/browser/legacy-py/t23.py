import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type in("error","warning") else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.birds.length=0; d.arrows.length=0; d.px=250; d.py=300;
          const m=__t.spawnDungeonMonster({boss:true}); m.x=500; m.y=300; m.st='recover'; m.t=999; m.ang=0; m._yaw=0; m._gx=500; m._gy=300; window._m=m; window._hp0=m.hp;})()""")
    for i in range(5):
        pg.wait_for_timeout(200)
        print(J(pg,"[_m.alive, __t.dungeon.monsters.includes(_m), _m.x|0, _m.y|0, +(_m._yaw||0).toFixed(2), _m.st, JSON.stringify(__t.wolfBody(_m))]"))
    print(errs[:5]); b.close()
