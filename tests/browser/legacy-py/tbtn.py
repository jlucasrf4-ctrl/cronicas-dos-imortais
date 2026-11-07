import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    ctx=b.new_context(viewport={"width":844,"height":390},is_mobile=True,has_touch=True,device_scale_factor=2); pg=ctx.new_page(); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    def enter():
        pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
        J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500); J("__t.dungeon.monsters.length=0")
    enter()
    print("layout btn", J("!!document.getElementById('tb-layout')"))
    pg.tap("#tb-layout"); pg.wait_for_timeout(300); print("edit", J("__t.TBL.edit"), "paused", J("__t.dungeon.modalOpen"))
    bb=pg.locator("#tb-atk").bounding_box(); cx,cy=bb["x"]+bb["width"]/2, bb["y"]+bb["height"]/2
    sw0=J("__t.dungeon.swing||0")
    pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx-300,cy-120,steps=12); pg.mouse.up(); pg.wait_for_timeout(200)
    print("moved to", pg.locator("#tb-atk").bounding_box(), "swing", J("__t.dungeon.swing||0")==sw0)
    pg.click("[data-tl=p]"); pg.click("[data-tl=p]"); pg.wait_for_timeout(100); print("size", pg.locator("#tb-atk").bounding_box()["width"])
    bb=pg.locator("#tb-swap").bounding_box(); print('swap bb',bb, J("document.elementFromPoint(%d,%d).id"%(bb["x"]+20,bb["y"]+20))); pg.mouse.move(bb["x"]+20,bb["y"]+20); pg.mouse.down(); print('sel',J("__t.TBL.sel"), J("JSON.stringify(__t.TBL.drag&&{id:__t.TBL.drag.id})")); pg.mouse.move(80,300,steps=8); pg.mouse.up(); print('swap now', pg.locator("#tb-swap").bounding_box())
    pg.screenshot(path="m_edit.png")
    pg.click("[data-tl=k]"); pg.wait_for_timeout(300); print("edit", J("__t.TBL.edit"), "paused", J("__t.dungeon.modalOpen"), J("JSON.stringify(__t.tblLoad())"))
    enter(); pg.wait_for_timeout(1200)
    print("after reload", pg.locator("#tb-atk").bounding_box(), pg.locator("#tb-swap").bounding_box())
    pg.screenshot(path="m_after.png")
    print(errs[:3]); b.close()
