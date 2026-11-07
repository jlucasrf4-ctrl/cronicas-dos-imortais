import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field';"); pg.wait_for_timeout(800)
    print("K", J("__t.WORLD_K"), "camp", J("JSON.stringify(__h.camp)"), "hero", J("[__h.x,__h.y]"), "scale", J("[__t.camera.scale,__t.camera.minScale,__t.camera.maxScale]"), "lim", J("__t.mapZoomLimit()"))
    pg.screenshot(path="map0.png")
    J("(()=>{const vp=document.getElementById('viewport'); __t.camZoomTo(2000, 1500, __t.camera.minScale*1.0, 10);})()"); pg.wait_for_timeout(1500)
    pg.screenshot(path="map1.png")
    print("errs", errs[:3]); b.close()
