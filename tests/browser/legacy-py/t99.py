import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1000)
    J("document.getElementById('prep-train').click()"); pg.wait_for_timeout(3500)
    J("__t.trainWeapon('eq_machado')")
    for i in range(10):
        J("(()=>{const d=__t.dungeon,m=d.monsters[0]; d.px=m.x-34; d.py=m.y+4; d.mouse={x:m.x+50,y:m.y}; d.cd=0; __t.swingBasic();})()"); pg.wait_for_timeout(260)
    J("__t.D3.ZM=2.3; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(300)
    J("(()=>{const d=__t.dungeon,m=d.monsters[0]; d.cd=0; __t.swingBasic();})()"); pg.wait_for_timeout(120)
    pg.screenshot(path="s_tr_hit.png")
    J("document.querySelector('[data-tr=\"exit\"]').click()"); pg.wait_for_timeout(2500)
    J("__t.openSheet && __t.openSheet(__h.id)"); pg.wait_for_timeout(800); pg.screenshot(path="s_sheet.png")
    print(errs[:4])
    m=b.new_page(viewport={"width":844,"height":390}, is_mobile=True, has_touch=True); J=m.evaluate
    m.goto(BUILD_URL + "vtest.html"); m.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); J("__t.launchTraining(__h.id)"); m.wait_for_timeout(3500)
    m.screenshot(path="s_tr_mob.png"); J("document.querySelector('[data-tr=\"min\"]').click()"); m.wait_for_timeout(300); m.screenshot(path="s_tr_mob2.png")
    b.close()
