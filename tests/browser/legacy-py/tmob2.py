import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    for nm,vp in [("land",{"width":740,"height":320}),("port",{"width":390,"height":844})]:
        ctx=b.new_context(viewport=vp,is_mobile=True,has_touch=True,device_scale_factor=2); pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
        pg.evaluate("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1200)
        print(nm, pg.evaluate("[...document.querySelectorAll('#zoom-controls > *')].map(e=>e.id+':'+getComputedStyle(e).display+':'+Math.round(e.getBoundingClientRect().top))"), pg.evaluate("getComputedStyle(document.getElementById('zoom-controls')).display"))
        pg.screenshot(path="m_"+nm+".png"); print(errs[:3]); ctx.close()
    b.close()
