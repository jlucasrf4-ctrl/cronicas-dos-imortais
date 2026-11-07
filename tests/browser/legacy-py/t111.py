import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    J("__t.econ.quiver.n=21; __t.openPrep(__h.id)"); pg.wait_for_timeout(1200)
    print(J("JSON.stringify(__t.qvInv(__h).items.filter(i=>i.def.key==='flecha').map(i=>[i.n,i.x,i.y,i.shape.length+'x'+i.shape[0].length]))"), J("__t.arrowCap(__h)"))
    pg.screenshot(path="s_qv3.png", clip={"x":600,"y":330,"width":420,"height":320})
    J("__t.econ.quiver.n=22; __t.qvSync(__h)")
    print(J("JSON.stringify(__t.qvInv(__h).items.filter(i=>i.def.key==='flecha').map(i=>[i.n,i.shape.length+'x'+i.shape[0].length]))"))
    print(errs[:3]); b.close()
