import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    for name,ty,tx in [("cabeça",300,560),("quadril",300,470),("lado (fora)",332,500),("centro",300,500)]:
        r=J(pg,f"""new Promise(res=>{{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.birds.length=0; d.px=250; d.py=300;
          const m=__t.spawnDungeonMonster({{boss:true}}); m.x=500; m.y=300; m.st='recover'; m.t=999; m.ang=0; m._yaw=0; m._gx=500; m._gy=300; const hp0=m.hp;
          d.arrows.push({{x:{tx}-200, y:{ty}, vx:600, vy:0, life:0.6, dmg:5, hits:new Set(), full:false}});
          setTimeout(()=>res([+(hp0-m.hp).toFixed(1), d.arrows.length]),900)}})""")
        print(name, "dano:", r)
    print(errs[:3]); b.close()
