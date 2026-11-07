import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.world.tick=12*60; __t.world.paused=true; document.getElementById('toggle-flora').click(); document.getElementById('toggle-fauna').click()")
    for sc,cx,cy,name in [(1.25,507,384,"w_all.png"),(4,770,630,"w_porto.png"),(5,700,215,"w_mont.png"),(2.5,200,120,"w_nw.png")]:
        J(pg,f"(()=>{{const c=__t.camera, vw=innerWidth, vh=innerHeight; c.scale=Math.max(c.minScale,{sc}); c.tx=vw/2-{cx}*c.scale; c.ty=vh/2-{cy}*c.scale; __t.applyCameraTransform(); }})()"); pg.wait_for_timeout(3000); pg.screenshot(path=name)
    # mercado com as novas cidades
    print("cidades:", J(pg,"__t.CITIES ? __t.CITIES.length : 'n/a'"))
    print(errs[:5]); b.close()
