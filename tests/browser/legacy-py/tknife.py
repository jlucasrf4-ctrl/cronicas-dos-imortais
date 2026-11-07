import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4000)
    J("const d=__t.dungeon; d.monsters.length=0; window.__m=__t.trainWolf(); __m.x=d.px+d.tile*0.7; __m.y=d.py; d.mouse={x:__m.x,y:__m.y}; __t.ensureEquip(d.hero).maoD=null; d.weapon='melee'; d.cd=0;")
    hp0=J("__m.hp"); J("__t.swingBasic()"); pg.wait_for_timeout(200); print("no weapon dmg", round(hp0-J("__m.hp"),2))
    J("__t.tryAddItem(__t.dungeon.hero,'eq_faca_velha'); __t.dungeon.cd=0; __t.dungeon.comboT=0"); pg.wait_for_timeout(500)
    J("const d=__t.dungeon; __m.x=d.px+d.tile*0.5; __m.y=d.py; d.mouse={x:__m.x,y:__m.y}"); hp0=J("__m.hp"); J("__t.swingBasic()"); pg.wait_for_timeout(200); print("knife", J("!!__t.knifeIn(__t.dungeon.hero)"), J("[__t.dungeon.cd,__t.dungeon.guard,__t.dungeon.parryVis,__t.dungeon.modalOpen,__m.alive, Math.round(Math.hypot(__m.x-__t.dungeon.px,__m.y-__t.dungeon.py))]")); print("bag knife dmg", round(hp0-J("__m.hp"),2), "maoD after", J("__t.ensureEquip(__t.dungeon.hero).maoD"))
    print(errs[:3]); b.close()
