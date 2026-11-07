import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    for name,boss,x0,y0,vx,vy in [("Alfa: flecha de cima na cabeça",True,530,120,0,600),("Alfa: de cima no rabo",True,470,120,0,600),("Alfa: de cima, além do focinho",True,560,120,0,600),("lobo: de cima na cabeça",False,516,120,0,600)]:
        J(pg,f"""(()=>{{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.birds.length=0; d.arrows.length=0; d.px=250; d.py=420;
          const m=__t.spawnDungeonMonster({{boss:{str(boss).lower()}}}); m.x=500; m.y=300; m.st='recover'; m.t=999; m.ang=0; m._yaw=0; m._gx=500; m._gy=300; window._m=m; window._hp0=m.hp;
          d.arrows.push({{x:{x0}, y:{y0}, vx:{vx}, vy:{vy}, life:0.6, dmg:5, hits:new Set(), full:false}});}})()""")
        pg.wait_for_timeout(1200)
        print(name, "→ dano", J(pg,"+(_hp0-_m.hp).toFixed(1)"))
    print(errs[:3]); b.close()
