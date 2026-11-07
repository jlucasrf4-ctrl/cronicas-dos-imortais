import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    for nm,kw in [("pc",dict(viewport={"width":1366,"height":860})),("mob",dict(viewport={"width":390,"height":844},is_mobile=True,has_touch=True))]:
        ctx=b.new_context(**kw); pg=ctx.new_page(); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
        J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(500)
        W=kw["viewport"]["width"]; H=kw["viewport"]["height"]
        J(f"const p=__h.camp, s=__t.camera.minScale*10; __t.camera.scale=s; __t.camera.tx={W/2}-p.x*s; __t.camera.ty={H/2}-p.y*s;"); pg.wait_for_timeout(700)
        pg.screenshot(path=f"b_{nm}_map.png")
        pt=J("(()=>{const r=document.getElementById('viewport').getBoundingClientRect(); return [r.left+__t.camera.tx+__h.x*__t.camera.scale, r.top+__t.camera.ty+__h.y*__t.camera.scale]})()")
        if nm=="mob": pg.touchscreen.tap(pt[0],pt[1])
        else: pg.mouse.click(pt[0],pt[1])
        pg.wait_for_timeout(500); print(nm, pt, J("document.getElementById('inspector').className+' '+document.getElementById('insp-name').textContent")); print(nm,"menu open", J("!!document.querySelector('#base-menu.open')"))
        pg.screenshot(path=f"b_{nm}_menu.png")
        J("document.querySelector('#base-menu [data-bm=exp]') && document.querySelector('#base-menu [data-bm=exp]').click()"); pg.wait_for_timeout(500)
        print(nm,"prep open", J("!!document.querySelector('#prep-modal.open, .prep.open') || (typeof prep!=='undefined')"), J("document.getElementById('prep-shop')&&document.getElementById('prep-shop').offsetParent!==null"))
        print(errs[:3]); ctx.close()
    b.close()
