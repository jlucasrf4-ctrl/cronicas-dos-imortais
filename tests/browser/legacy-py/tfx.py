import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if 'fx' in m.text else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(500)
    J("const s=__t.camera.minScale*8; __t.camera.scale=s; __t.camera.tx=683-__h.x*s; __t.camera.ty=430-__h.y*s;"); pg.wait_for_timeout(300)
    print(J("(()=>{const f={h:__h,x:__h.x,y:__h.y-6,txt:\"+1 carne\",ico:\"meat_coelho_1\",t0:performance.now()}; __t.MAPFX.push(f); setInterval(()=>{f.t0=performance.now()-500; if(__t.MAPFX.indexOf(f)<0) __t.MAPFX.push(f)},50); return __t.MAPFX.length})()")); pg.wait_for_timeout(300); pg.screenshot(path="c_fx.png", clip={"x":533,"y":300,"width":300,"height":200})
    print(J("[__t.MAPFX.length, typeof MAPFX, typeof MAPFX!=\"undefined\" && MAPFX===__t.MAPFX, JSON.stringify(Object.keys(__t).filter(k=>k.startsWith(\"MAP\")))]")); pg.wait_for_timeout(2000); print(J("__t.MAPFX.length")); print(errs)
    b.close()
