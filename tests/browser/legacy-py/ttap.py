import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True); pg=ctx.new_page(); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(500)
    pg.touchscreen.tap(30,600); pg.wait_for_timeout(800); J("document.querySelectorAll('.v3-modal.open,#inspector.open').forEach(e=>e.classList.remove('open'))")
    J("const p=__h.camp, s=__t.camera.minScale*10; __t.camera.scale=s; __t.camera.tx=195-p.x*s; __t.camera.ty=422-p.y*s;"); pg.wait_for_timeout(700)
    pt=J("(()=>{const r=document.getElementById('viewport').getBoundingClientRect(); return [r.left+__t.camera.tx+__h.x*__t.camera.scale, r.top+__t.camera.ty+__h.y*__t.camera.scale]})()")
    J("window.__ev=[]; for(const t of ['pointerdown','pointerup','touchstart','touchend','click']) document.getElementById('viewport').addEventListener(t,e=>__ev.push(t+':'+(e.pointerType||'')),true)")
    J("document.getElementById('viewport').addEventListener('pointerup',e=>{const r=document.getElementById('viewport').getBoundingClientRect(); const wx=(e.clientX-r.left-__t.camera.tx)/__t.camera.scale, wy=(e.clientY-r.top-__t.camera.ty)/__t.camera.scale; __ev.push('d='+Math.hypot(__h.x-wx,__h.y-wy).toFixed(1)+' st='+__h.state+' sc='+__t.camera.scale.toFixed(2)+' cm='+__t.commandMode+' ov='+(typeof mapOverview))})")
    pg.touchscreen.tap(pt[0],pt[1]); pg.wait_for_timeout(600); print(J("__ev"), J("!!document.querySelector('#base-menu.open')"))
    b.close()
