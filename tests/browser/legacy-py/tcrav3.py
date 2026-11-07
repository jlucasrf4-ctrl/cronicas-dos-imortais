import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("const d=__t.dungeon; d.monsters.length=0; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile/2; window.__w=__t.trainWolf(); __w.x=d.px+30; __w.y=d.py+10; d.gstam=100; d.invuln=0; __t.cravStart(__w,'eq_espada')")
    box=J("(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
    pg.mouse.move(box[0]-300,box[1]-200)
    for i in range(3):
        pg.wait_for_timeout(500); print(J("JSON.stringify({atk:__t.GL3.atk, yaw:__t.GL3.hyaw, fz:__t.GL3.fz, a:Math.atan2(__w.y-__t.dungeon.py,__w.x-__t.dungeon.px), w:__t.dungeon.weapon, eq:__h.equip&&__h.equip.maoD&&__h.equip.maoD.def&&__h.equip.maoD.def.key})"))
    pg.screenshot(path="c3.png", clip={"x":box[0]-200,"y":box[1]-150,"width":400,"height":300})
    print("errs", errs[:3]); b.close()
