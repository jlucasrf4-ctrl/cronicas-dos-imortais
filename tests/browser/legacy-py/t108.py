import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    J("__t.launchTraining(__h.id)"); pg.wait_for_timeout(3800)
    J("document.querySelector('[data-tr=\"min\"]').click(); __t.trainWeapon('eq_lanca'); __t.D3.ZM=1.8; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(500)
    box=pg.locator("#dungeon-canvas").bounding_box()
    for hold in [150, 900]:
        J("(()=>{const d=__t.dungeon; d.monsters.forEach(m=>m.alive=false); d.px=200; d.py=d.rows*d.tile/2; d.mouse={x:900,y:d.py}; d.cd=0; d.spears=[]; })()")
        # real right mouse: down on canvas then up
        cx=box['x']+box['width']*0.85; cy=box['y']+box['height']*0.5
        pg.mouse.move(cx,cy); J("(()=>{const d=__t.dungeon; d.mouse={x:900,y:d.py};})()")
        pg.mouse.down(button="right"); pg.wait_for_timeout(hold)
        if hold==900: pg.screenshot(path="s_spaim.png")
        print("charging", J("JSON.stringify(__t.dungeon.spCh && +__t.dungeon.spCh.ch.toFixed(2))"))
        pg.mouse.up(button="right"); pg.wait_for_timeout(1500)
        print(hold, J("(()=>{const d=__t.dungeon,s=d.spears[0]; return s? JSON.stringify([s.fly, +( (s.x-200)/d.tile).toFixed(2)]):'none'})()"))
        J("(()=>{const d=__t.dungeon,s=d.spears[0]; if(s){d.px=s.x;d.py=s.y;}})()"); pg.wait_for_timeout(300)
    # axe in hand
    J("__t.trainWeapon('eq_machado'); __t.D3.ZM=2.6; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(800); pg.screenshot(path="s_axe.png")
    print(errs[:4]); b.close()
