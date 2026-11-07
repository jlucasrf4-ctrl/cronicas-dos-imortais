import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2500)
    pg.mouse.click(600,400); pg.wait_for_timeout(500)
    J(pg,"document.querySelector('[data-act=new]').click()"); pg.wait_for_timeout(800)
    J(pg,"__t.INTRO.i=10; document.getElementById('intro').click()"); pg.wait_for_timeout(2500)
    print("cine com GL:", J(pg,"!!document.querySelector('#cine #dungeon-gl')"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(800)
    print("após pular: intro", J(pg,"__t.INTRO.open"), "GL voltou p/ masmorra:", J(pg,"!!document.querySelector('#dungeon-stage-wrap #dungeon-gl')"), "criar aberto:", J(pg,"document.getElementById('create-modal').classList.contains('open')"))
    J(pg,"document.getElementById('create-cancel').click()")
    J(pg,"(()=>{const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.econ.test=true; __t.launchDungeon(h.id)})()"); pg.wait_for_timeout(3000)
    J(pg,"(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; const m=__t.spawnDungeonMonster({}); m.x=d.px+60; m.y=d.py})()"); pg.wait_for_timeout(1200)
    pg.screenshot(path="dg_after.png"); print("rgl:", J(pg,"document.getElementById('dungeon-stage-wrap').className"))
    print(errs[:5]); b.close()
