import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    ctx=b.new_context(viewport={"width":844,"height":390},is_mobile=True,has_touch=True); pg=ctx.new_page(); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("window.__n=0; document.getElementById('tb-atk').addEventListener('pointerdown',()=>window.__n++)")
    pg.tap("#tb-atk"); pg.wait_for_timeout(200); print("normal tap attacks:", J("__n"))
    pg.tap("#tb-layout"); pg.wait_for_timeout(200); pg.tap("#tb-atk"); pg.wait_for_timeout(200); print("edit tap attacks:", J("__n"))
    pg.tap("[data-tl=k]"); pg.wait_for_timeout(200); pg.tap("#tb-atk"); pg.wait_for_timeout(200); print("locked tap attacks:", J("__n"))
    print(errs[:3]); b.close()
