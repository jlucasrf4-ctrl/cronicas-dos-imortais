import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import sys
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.px=441; d.py=280; d.mouse={x:600,y:330};
      const cs=[0,1,2,3,4,5]; cs.forEach((c,i)=>{const w=__t.spawnDungeonMonster({}); w.coat=c; w.x=330+i*45; w.y=360; w.st='idle'; w._yaw=i*0.6;});
      const bz=__t.spawnDungeonMonster({boss:true}); bz.x=560; bz.y=250; d.modalOpen=true;})()""")
    pg.wait_for_timeout(800)
    box=pg.locator("#dungeon-canvas").bounding_box()
    pg.screenshot(path="g_close.png", clip={"x":box['x']+box['width']*0.2,"y":box['y']+box['height']*0.15,"width":box['width']*0.6,"height":box['height']*0.7})
    print(errs[:3]); b.close()
