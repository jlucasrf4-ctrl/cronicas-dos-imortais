import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    for k,key in enumerate(["eq_espada","eq_lanca"]):
        J("const d=__t.dungeon; d.monsters.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; window.__w=__t.trainWolf(); __w.x=d.px+30; __w.y=d.py+10; d.gstam=100; d.invuln=0; __t.cravStart(__w,'"+key+"')")
        box=J("(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
        pg.wait_for_timeout(800); pg.mouse.move(box[0],box[1]); pg.mouse.down(); pg.wait_for_timeout(1300)
        pg.screenshot(path="c2_%d.png"%k, clip={"x":box[0]-300,"y":box[1]-220,"width":600,"height":420}); pg.mouse.up(); pg.mouse.click(box[0],box[1],button="right"); pg.wait_for_timeout(1500)
    print("errs", errs[:3]); b.close()
