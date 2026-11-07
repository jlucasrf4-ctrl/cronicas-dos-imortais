import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1200)
    print("bundles", J("JSON.stringify(__t.qvInv(__h).items.filter(i=>i.def.key==='flecha').map(i=>[i.n,i.x,i.y,i.shape.length+'x'+i.shape[0].length]))"), J("__t.econ.quiver.n"), J("__t.arrowCap(__h)"))
    pg.screenshot(path="s_qv1.png", clip={"x":600,"y":330,"width":420,"height":320})
    # drag first bundle to the right
    el=pg.locator("#prep-modal .inv-item .inv-cell").nth(0)
    cells=pg.locator("#prep-qv .inv-item .inv-cell, [id*=qv] .inv-item .inv-cell")
    print("qv cells", cells.count())
    c0=cells.nth(0).bounding_box(); pg.mouse.move(c0['x']+5,c0['y']+5); pg.mouse.down(); pg.mouse.move(c0['x']+5+14*6,c0['y']+5+14*7, steps=6); pg.wait_for_timeout(200); pg.mouse.up(); pg.wait_for_timeout(300)
    print("after drag", J("JSON.stringify(__t.qvInv(__h).items.filter(i=>i.def.key==='flecha').map(i=>[i.n,i.x,i.y]))"))
    pg.screenshot(path="s_qv2.png", clip={"x":600,"y":330,"width":420,"height":320})
    # shift-click try move to mochila
    c0=cells.nth(0).bounding_box(); pg.keyboard.down("Shift"); pg.mouse.click(c0['x']+5,c0['y']+5); pg.keyboard.up("Shift"); pg.wait_for_timeout(300)
    print("mochila has flecha?", J("__t.ensureInv(__h).items.some(i=>i.def.key==='flecha')"))
    # fire arrows reduces bundles
    J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    for i in range(12): J("(()=>{const d=__t.dungeon; d.weapon='bow'; d.cd=0; __t.startCharge(); d.charge=1; __t.fireArrow();})()")
    J("__t.qvSync(__t.dungeon.hero)")
    print("after 12 shots", J("__t.econ.quiver.n"), J("JSON.stringify(__t.qvInv(__t.dungeon.hero).items.filter(i=>i.def.key==='flecha').map(i=>i.n))"))
    print(errs[:4]); b.close()
