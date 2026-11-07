import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    J(pg,"""(()=>{const h=__h, L=__t.runeList(); const r=__t.runeNew(h.camp.x+70,h.camp.y+10,'fogo'); L.push(r); window.__r=r;
     const c=__t.camera,vp=document.getElementById('viewport'); c.scale=6; c.tx=vp.clientWidth/2-r.x*c.scale; c.ty=vp.clientHeight/2-r.y*c.scale; c.zt=null; __t.applyCameraTransform();})()""")
    pg.wait_for_timeout(800)
    print(J(pg,"[__t.camera.scale, __t.camera.tx, __t.camera.ty, __r.x, __r.y, document.getElementById('viewport').clientWidth]"))
    pg.screenshot(path="r_dbg.png")
    print(errs[:5]); b.close()
