import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("const d=__t.dungeon; d.monsters.length=0; window.__w=__t.trainWolf(); __w.x=d.px+30; __w.y=d.py; d.gstam=100; d.invuln=0; __t.cravStart(__w,'eq_espada')")
    pg.wait_for_timeout(6000)
    print("6s solto:", J("JSON.stringify({c:!!__t.dungeon.crav, st:Math.round(__t.dungeon.gstam), fol:__w.fol.toFixed(1), dist:Math.round(Math.hypot(__w.x-__t.dungeon.px,__w.y-__t.dungeon.py)), T:__t.dungeon.tile})"))
    pg.screenshot(path="c_solto.png")
    box=J("(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
    J("__t.dungeon.gstam=100"); pg.mouse.move(box[0],box[1]); pg.mouse.down(); pg.wait_for_timeout(1500)
    print("hold:", J("JSON.stringify({c:!!__t.dungeon.crav, hold:__t.dungeon.crav&&__t.dungeon.crav.hold, zoom:__t.CZ.f.toFixed(3), st:Math.round(__t.dungeon.gstam), fol:__w.fol.toFixed(1), hp:__w.hp.toFixed(1)})"))
    pg.screenshot(path="c_hold.png"); pg.mouse.up(); pg.wait_for_timeout(300)
    print("up:", J("JSON.stringify({c:!!__t.dungeon.crav, hp:__w.hp.toFixed(1)})"))
    x0=J("__t.dungeon.px"); pg.keyboard.down("a"); pg.wait_for_timeout(1000); pg.keyboard.up("a")
    print("walk left dx", round(J("__t.dungeon.px")-x0), "dist", J("Math.round(Math.hypot(__w.x-__t.dungeon.px,__w.y-__t.dungeon.py))"), "c", J("!!__t.dungeon.crav"))
    hp0=J("__w.hp"); pg.mouse.click(box[0],box[1],button="right"); pg.wait_for_timeout(200)
    print("right rip dmg", round(hp0-J("__w.hp"),2), "c", J("!!__t.dungeon.crav"), "zoom", J("__t.CZ.f.toFixed(3)"))
    pg.wait_for_timeout(1200); print("zoom back", J("__t.CZ.f.toFixed(3)"))
    # segurar até alguém zerar
    J("__w.cravCd=0; __w.ko=0; __w.st='idle'; __w.hp=__w.hpMax; __w.fol=__w.folMax; __w.x=__t.dungeon.px+30; __w.y=__t.dungeon.py; __t.dungeon.gstam=100; __t.cravStart(__w,'eq_espada')")
    pg.mouse.move(box[0],box[1]); pg.mouse.down()
    for i in range(14):
        pg.wait_for_timeout(1000); r=J("JSON.stringify({c:!!__t.dungeon.crav, st:Math.round(__t.dungeon.gstam), fol:__w.fol.toFixed(1), ko:(__w.ko||0).toFixed(1)})"); print(i+1, r)
        if '"c":false' in r: break
    pg.mouse.up()
    # laço: marcado
    J("const d=__t.dungeon; window.__z=__t.trainWolf(); __z.hp=__z.hpMax; d.target=null"); print("bind sem marca", J("__t.canBind(__z)")); J("__t.dungeon.target=__z"); print("bind marcado", J("__t.canBind(__z)"))
    print("errs", errs[:3]); b.close()
