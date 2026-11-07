import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.gsRun('TAMANDUA'); __t.mnt().coat='dourado'; __t.mnt().dirt=80;"); pg.wait_for_timeout(800)
    J("const p=__h.camp, s=__t.camera.minScale*12; __t.camera.scale=s; __t.camera.tx=683-(p.x+20)*s; __t.camera.ty=430-(p.y-6)*s;"); pg.wait_for_timeout(900); pg.screenshot(path="c_map.png")
    J("__t.mountPanel()"); pg.wait_for_timeout(600); pg.screenshot(path="c_panel.png")
    J("document.querySelector('[data-ma=brush]').click()"); pg.wait_for_timeout(600)
    box=pg.locator("#mp-cv").bounding_box()
    pg.mouse.move(box["x"]+60, box["y"]+120); pg.mouse.down()
    import math
    for i in range(140):
        x=box["x"]+box["width"]*(0.25+0.5*((i*0.37)%1)); y=box["y"]+box["height"]*(0.15+0.8*((i*0.137)%1)); pg.mouse.move(x,y,steps=2)
        if i==40: pg.screenshot(path="c_brush1.png")
    pg.mouse.up(); pg.wait_for_timeout(200); print("phase", J("__t.MP.brush && __t.MP.brush.ph"), J("__t.MP.brush && Math.round(__t.MP.brush.prog*100)"))
    pg.mouse.move(box["x"]+60, box["y"]+120); pg.mouse.down()
    for i in range(200):
        x=box["x"]+box["width"]*(0.25+0.5*((i*0.29)%1)); y=box["y"]+box["height"]*(0.15+0.8*((i*0.113)%1)); pg.mouse.move(x,y,steps=2)
        if J("__t.MP.brush && __t.MP.brush.ph")!="soap": break
    pg.mouse.up(); pg.screenshot(path="c_soap.png"); print("phase2", J("__t.MP.brush && __t.MP.brush.ph"))
    J("document.getElementById('br-bucket') && document.getElementById('br-bucket').click()"); pg.wait_for_timeout(1800); print("phase3", J("__t.MP.brush && __t.MP.brush.ph"), "dirt", J("__t.mnt().dirt")); pg.screenshot(path="c_done.png")
    # dungeon 3D with coat
    J("document.getElementById('br-ok') && document.getElementById('br-ok').click(); __t.mpClose(); __t.mnt().with=__h.id; __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.mount.x=d.px+60; d.mount.y=d.py; d.mount.st='attend'; d.mount.att=99;"); pg.wait_for_timeout(800); pg.screenshot(path="c_3d.png")
    J("__t.dungeon.mount.x=__t.dungeon.px+20; __t.mountToggle()"); pg.wait_for_timeout(700); pg.screenshot(path="c_ride.png")
    print(errs[:5]); b.close()
