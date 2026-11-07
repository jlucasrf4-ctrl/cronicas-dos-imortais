import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type in("error","warning") and "ERR_TUNNEL" not in m.text and "GL Driver" not in m.text else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    print("ready:", J(pg,"__t.MAPART && __t.MAPART.ready"))
    J(pg,"__t.enterGame(); __t.world.tick=12*60; __t.world.paused=true; __t.layers && 0"); pg.wait_for_timeout(2500); pg.screenshot(path="m1.png")
    for sc,cx,cy,name in [(3,433,337,"m2.png"),(8,440,330,"m3.png"),(2.2,640,230,"m4.png")]:
        J(pg,f"(()=>{{const c=__t.camera, vw=innerWidth, vh=innerHeight; c.scale={sc}; c.tx=vw/2-{cx}*c.scale; c.ty=vh/2-{cy}*c.scale; __t.applyCameraTransform&&__t.applyCameraTransform(); }})()"); pg.wait_for_timeout(2500); pg.screenshot(path=name)
    print(errs[:5]); b.close()
