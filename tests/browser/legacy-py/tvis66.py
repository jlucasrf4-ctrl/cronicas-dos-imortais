import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3;"); pg.wait_for_timeout(6000)
    print("animals", J("__t.world.animals.length"), J("['rabbit','deer','wolf','boar'].map(k=>k+':'+__t.populationOf(k)+'/'+__t.SPECIES[k].carryingCapacity)"))
    J("const h=__t.world.heroes[0]; const s=__t.camera.scale; __t.camera.tx=683-h.x*s; __t.camera.ty=430-h.y*s; __t.applyCameraTransform()"); pg.wait_for_timeout(800); pg.screenshot(path="v66_map.png"); print(errs[:3]); b.close()
