import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=false; __t.introStart(__h)"); pg.wait_for_timeout(4500)
    pg.keyboard.down("KeyD"); pg.wait_for_timeout(1500); pg.keyboard.up("KeyD")
    for i in range(30):
        if J("__t.ISC.ph")=="boar": break
        pg.wait_for_timeout(500)
    print("ph", J("__t.ISC.ph"), "big", J("__t.ISC.boar.big"), "name", J("__t.ISC.boar.name"))
    # player tries to dodge: run perpendicular constantly (W/S alternating) and roll
    shot=0
    for i in range(60):
        k="KeyW" if (i//4)%2==0 else "KeyS"; pg.keyboard.down(k); pg.wait_for_timeout(450); pg.keyboard.up(k)
        if i%6==3: pg.keyboard.press("Space")
        st=J("JSON.stringify({ph:__t.ISC.ph, hp:Math.round(__t.dungeon.hp/__t.dungeon.hpMax*100), bst:__t.ISC.boar&&__t.ISC.boar.st, hits:__t.ISC.gotHit||0, t:Math.round(__t.ISC.t)})")
        if i%3==0: print(st)
        if '"bst":"charge"' in st and not shot: shot=1; pg.screenshot(path="i6_charge.png")
        if J("__t.ISC.ph")!="boar": break
    print("final", J("__t.ISC.ph"), J("Math.round(__t.dungeon.hp/__t.dungeon.hpMax*100)"))
    pg.wait_for_timeout(600); pg.screenshot(path="i7_rescue.png")
    print(errs[:4]); b.close()
