import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(500)
    # remove rabbits near camp to force far area
    print("near rabbit d", J("(()=>{const t=__t.nearestTarget('rabbit',__h.camp.x,__h.camp.y,9999); return Math.round(Math.hypot(t.x-__h.camp.x,t.y-__h.camp.y))})()"))
    J("for(const a of __t.world.animals) if(a.species==='rabbit' && Math.hypot(a.x-__h.camp.x,a.y-__h.camp.y)<120){a.x+=200;}")
    J("__h.huntSpecies='rabbit'; __h.huntHours=6; __t.huntHere(__h)"); pg.wait_for_timeout(200)
    J("(()=>{const a=[...document.querySelectorAll('#wm-modal button')].find(b=>/sozinho/i.test(b.textContent)); a&&a.click()})()")
    print("task", J("__h.task && [Math.round(Math.hypot(__h.task.x-__h.camp.x,__h.task.y-__h.camp.y)), __h.task.r]"))
    fx=0; mx=0
    for i in range(8):
        J("document.getElementById('ff-hour').click()"); pg.wait_for_timeout(150); fx=max(fx,J("__t.MAPFX.length"))
        if J("__h.task"): mx=max(mx,J("Math.round(Math.hypot(__h.task.x-__h.camp.x,__h.task.y-__h.camp.y))"))
    print("kills/state", J("__h.state"), "floaters seen", fx, "max center dist", mx)
    J("const s=__t.camera.minScale*8; __t.camera.scale=s; __t.camera.tx=683-__h.x*s; __t.camera.ty=430-__h.y*s; __t.MAPFX.push({h:__h,x:__h.x,y:__h.y-6,txt:'+1 carne',ico:'meat_coelho_1',t0:performance.now()})"); pg.wait_for_timeout(400); pg.screenshot(path="c_fx.png")
    # carpentry
    J("__t.econ.test=false; __h.loot.wood=10; __t.carpOpen(__h)"); pg.wait_for_timeout(500); pg.screenshot(path="c_carp.png")
    J("document.querySelector('[data-cp=plane]').click()"); pg.wait_for_timeout(400)
    bb=pg.locator("#cp-cv").bounding_box()
    for row in range(8):
        y=bb["y"]+bb["height"]*(0.33+row*0.05); pg.mouse.move(bb["x"]+10,y); pg.mouse.down(); pg.mouse.move(bb["x"]+bb["width"]-10,y,steps=10); pg.mouse.up()
    pg.wait_for_timeout(300); pg.screenshot(path="c_plane.png"); pg.wait_for_timeout(900)
    print("tabuas", J("__t.tabCount()"), "wood", J("__h.loot.wood"))
    J("__h.loot.wood=20"); 
    for k in range(3):
        J("document.querySelector('[data-cp=plane]') && document.querySelector('[data-cp=plane]').click()"); pg.wait_for_timeout(300); bb=pg.locator("#cp-cv").bounding_box()
        for row in range(8):
            y=bb["y"]+bb["height"]*(0.33+row*0.05); pg.mouse.move(bb["x"]+10,y); pg.mouse.down(); pg.mouse.move(bb["x"]+bb["width"]-10,y,steps=8); pg.mouse.up()
        pg.wait_for_timeout(1000)
    print("tabuas", J("__t.tabCount()"), "rows before", J("__t.econ.stash.rows"))
    J("document.querySelector('[data-cp=caixa]').click()"); pg.wait_for_timeout(300)
    print("caixas", J("__t.econ.caixas"), "rows", J("__t.econ.stash.rows"), "tabuas", J("__t.tabCount()"))
    pg.screenshot(path="c_carp2.png")
    print(errs[:3]); b.close()
