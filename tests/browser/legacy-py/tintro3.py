import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=false; __t.introStart(__h)"); pg.wait_for_timeout(1500)
    print("quiver", J("__t.econ.quiver.n"))
    pg.wait_for_timeout(3000); pg.keyboard.down("KeyD"); pg.wait_for_timeout(1500); pg.keyboard.up("KeyD"); pg.wait_for_timeout(1500)
    for i in range(30):
        if J("__t.ISC.ph")=="boar": break
        pg.wait_for_timeout(500)
    print("ph", J("__t.ISC.ph"))
    J("__t.econ.quiver.n=0")
    p0=None; shot=0
    for i in range(80):
        pg.wait_for_timeout(500)
        st=J("JSON.stringify({ph:__t.ISC.ph, lock:!!__t.ISC.lock, lh:__t.ISC.lockHits||0, bst:__t.ISC.boar&&__t.ISC.boar.st, dist:__t.ISC.boar&&Math.round(Math.hypot(__t.ISC.boar.x-__t.dungeon.px,__t.ISC.boar.y-__t.dungeon.py)), px:Math.round(__t.dungeon.px), down:+(__t.dungeon.down||0).toFixed(1)})")
        if i%2==0: print(i/2, st)
        if '"lh":1' in st and not shot: shot=1; pg.screenshot(path="i5_down.png")
        if J("__t.ISC.ph") not in ("boar",): break
    print("final ph", J("__t.ISC.ph"))
    # keyboard move attempt during lock was tested by px constancy above
    for i in range(30):
        pg.wait_for_timeout(500)
        if J("__t.ISC.ph")=="talk" and J("!!__t.ISC.dlg"): break
    txts=[]
    for i in range(14):
        J("const el=document.getElementById('isc-text'); if(el) el._typing=false;"); pg.wait_for_timeout(150); txts.append(J("(document.getElementById('isc-text')||{}).textContent")); J("__t.dlgAdvance()"); pg.wait_for_timeout(200)
        if J("__t.ISC.ph")=="herb": break
    print("dialog", txts)
    print("herb ph", J("__t.ISC.ph"), "hp", J("Math.round(__t.dungeon.hp)+'/'+__t.dungeon.hpMax"))
    J("__t.dungeon.hp=__t.dungeon.hpMax; __t.dungeon.wound=0"); pg.wait_for_timeout(1500); print("after full hp ph", J("__t.ISC.ph"))
    print(errs[:4]); b.close()
