import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    J("(()=>{const e=__t.ensureEquip(__h); e.maoD.q=3; e.cabeca.q=0; e.peito.q=2;})()")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1000)
    J("(()=>{const inv=__t.ensureInv(__h); for(const [k,q] of [['eq_machado',3],['eq_espada',1]]){const it=__t.mkItem(k); it.q=q; __t.placeIn(inv,it);} })()")
    J("__t.closePrep && __t.closePrep()"); J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1000)
    # start a drag on first item
    el=pg.locator("#prep-modal .inv-item .inv-cell").first
    bb=el.bounding_box(); pg.mouse.move(bb['x']+10,bb['y']+10); pg.mouse.down(); pg.mouse.move(bb['x']+130,bb['y']+60, steps=5); pg.wait_for_timeout(300)
    pg.screenshot(path="s_drag.png", clip={"x":340,"y":80,"width":680,"height":300}); pg.mouse.up()
    print(errs[:4]); b.close()
