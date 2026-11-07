import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(600)
    J(pg,"""(()=>{const h=__h,L=__t.runeList(),c=__t.camera,vp=document.getElementById('viewport'); const els=['nularis','fogo','energia','agua','ar','terra'];
      els.forEach((e,i)=>{const r=__t.runeNew(h.camp.x+40+(i%3)*45,h.camp.y-20+Math.floor(i/3)*45,e); L.push(r);}); const r0=L[L.length-6];
      c.scale=4.2; c.tx=vp.clientWidth/2-(r0.x+45)*c.scale; c.ty=vp.clientHeight/2-(r0.y+22)*c.scale; c.zt=null; __t.applyCameraTransform();})()""")
    pg.wait_for_timeout(800); pg.screenshot(path="col_map.png")
    print(errs[:4]); b.close()
