import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.camera.scale=__t.camera.minScale; __t.camera.tx=0; __t.camera.ty=0"); pg.wait_for_timeout(300)
    pg.mouse.click(700,500); pg.keyboard.press("KeyC"); pg.wait_for_timeout(1200)
    print("camp center", J("(()=>{const p=__h.camp, s=__t.camera.scale; return [Math.round(p.x*s+__t.camera.tx), Math.round(p.y*s+__t.camera.ty)]})()"), J("[innerWidth/2, innerHeight/2]"))
    print("btns", J("!!document.getElementById('zoom-hero') && !!document.getElementById('zoom-camp')"))
    J("document.getElementById('zoom-hero').click()"); pg.wait_for_timeout(1000); pg.screenshot(path="s_center.png")
    print(errs[:4]); b.close()
