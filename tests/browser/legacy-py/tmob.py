import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); ctx=b.new_context(viewport={"width":844,"height":390},is_mobile=True,has_touch=True,device_scale_factor=2); pg=ctx.new_page(); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(4000)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.gsRun('TAMANDUA'); __t.mnt().with=__h.id;"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4000)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.mount.x=d.px+25; d.mount.y=d.py;"); pg.wait_for_timeout(600)
    print("btn", J("(()=>{const b=document.getElementById('tb-mount'); return b? [getComputedStyle(b).display, b.textContent, JSON.stringify(b.getBoundingClientRect())]:null})()"))
    bb=J("(()=>{const r=document.getElementById('tb-mount').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]})()")
    pg.touchscreen.tap(*bb); pg.wait_for_timeout(400); print("mounted", J("__t.dungeon.mount.mounted"))
    pg.screenshot(path="s_mob_mount.png"); print(errs[:4]); b.close()
