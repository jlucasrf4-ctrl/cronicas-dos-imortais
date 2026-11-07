import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); for(const k of ['pele','carne','presa','pele','gema','erva','galho','ferro']) for(let t=0;t<3;t++) __t.tryAddToInv(__t.econ.stash,k,t);")
    J("document.getElementById('btn-chest').click()"); pg.wait_for_timeout(700)
    g=pg.locator("#chest-grid").bounding_box(); pg.screenshot(path="w_tier.png", clip={"x":g["x"]-5,"y":g["y"]-5,"width":g["width"]+10,"height":g["height"]+10})
    it=pg.locator("#chest-grid .inv-item.tier2 .inv-cell").first.bounding_box()
    pg.mouse.move(it["x"]+5,it["y"]+5); pg.mouse.down(); pg.mouse.move(it["x"]+60,it["y"]+90,steps=8); pg.wait_for_timeout(200)
    pg.screenshot(path="w_tier_drag.png", clip={"x":g["x"]-5,"y":g["y"]-5,"width":g["width"]+10,"height":g["height"]+10}); pg.mouse.up()
    print(errs[:3]); b.close()
