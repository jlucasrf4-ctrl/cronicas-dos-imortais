import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4000)
    J("const d=__t.dungeon; d.monsters.length=0; const e=__t.ensureEquip(d.hero); e.maoD=null; e.maoE=null; __t.tryAddItem(d.hero,'eq_faca_velha'); d.weapon='melee'; d.mouse={x:d.px+60,y:d.py};")
    pg.wait_for_timeout(600)
    c=J("[683,430]")
    pg.screenshot(path="k1_idle.png")
    J("__t.dungeon.cd=0; __t.swingBasic()"); pg.wait_for_timeout(70); pg.screenshot(path="k2_stab.png")
    combos=[]
    for i in range(4): J("__t.dungeon.cd=0; __t.swingBasic()"); combos.append(J("__t.dungeon.slash && __t.dungeon.slash.step")); pg.wait_for_timeout(120)
    print("steps", combos)
    print(errs[:3]); b.close()
