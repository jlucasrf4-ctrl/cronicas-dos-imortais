import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='wave'; d.banner=null; d.px=441; d.py=300; const m=__t.spawnDungeonMonster({boss:true}); m.x=480;m.y=300; for(let i=0;i<2;i++){const w=__t.spawnDungeonMonster({}); w.x=400+i*60; w.y=340}})()""")
    box=pg.locator("#dungeon-canvas").bounding_box()
    for i in range(14):
        pg.mouse.click(box['x']+box['width']*0.55, box['y']+box['height']*0.55); pg.wait_for_timeout(180)
        if i%4==2: pg.mouse.click(box['x']+box['width']*0.55, box['y']+box['height']*0.55, button="right")
    pg.screenshot(path="g_d.png"); print(errs[:3]); b.close()
