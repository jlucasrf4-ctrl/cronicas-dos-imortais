import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m: m.type in("error","warning") and "TUNNEL" not in m.text and errs.append(m.text))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J(pg,"__t.openPrep(__h.id)"); pg.wait_for_timeout(1500)
    pg.screenshot(path="s_prep.png", clip={"x":350,"y":80,"width":300,"height":260})
    J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=400; d.py=270; for(let i=0;i<3;i++){const m=__t.spawnDungeonMonster(); m.x=480+i*40; m.y=230+i*30; m.spd=0.01;} const j=__t.spawnJavalino(2); j.x=330; j.y=330; j.spd=0.01; __t.D3.ZM=2.2; window.dispatchEvent(new Event('resize'));})()""")
    pg.wait_for_timeout(1800)
    box=pg.locator("#dungeon-canvas").bounding_box(); pg.screenshot(path="s_dg.png", clip={"x":box['x'],"y":box['y'],"width":box['width'],"height":box['height']})
    print(errs[:6]); b.close()
