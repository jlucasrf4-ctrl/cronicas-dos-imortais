import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    print("pos", J("[__t.dungeon.px,__t.dungeon.py]")); print("pos", J("[__t.dungeon.px,__t.dungeon.py]")); print("rope", J("!!__t.ropeItem(__t.dungeon.hero) && __t.ropeItem(__t.dungeon.hero).it.uses"))
    J("const d=__t.dungeon; d.monsters.length=0; window.__m=__t.trainWolf(); __m.x=d.px+d.tile*1.0; __m.y=d.py;")
    hp0=J("__m.hp"); J("__t.dungeon.mouse=null"); 
    J("const d=__t.dungeon; d.mouseC={x:__m.x,y:__m.y}; d.mouse={x:__m.x,y:__m.y}")
    J("__m.x=__t.dungeon.px+28; __m.y=__t.dungeon.py; __t.dungeon.mouse={x:__m.x,y:__m.y}; __t.knifeStab()"); pg.wait_for_timeout(100); print("knife dmg", round(hp0-J("__m.hp"),2), J("[__m.x,__t.dungeon.px]"))
    # weaken then lasso
    J("__m.hp=__m.hpMax*0.3; __m.x=__t.dungeon.px+__t.dungeon.tile*3; __m.y=__t.dungeon.py;"); 
    pg.keyboard.down("KeyG"); pg.wait_for_timeout(600); print("bound", J("!!__m.bound"), J("[__m.x,__m.y,__t.dungeon.px,__m.bound&&__m.bound.len,__m.hp,__m.hpMax]"))
    pg.wait_for_timeout(1500); print("esc holding", J("__m.bound && __m.bound.esc.toFixed(2)"), "stam", J("Math.round(__t.dungeon.gstam)"))
    pg.screenshot(path="f_tug.png")
    pg.keyboard.up("KeyG"); 
    J("const d=__t.dungeon; d.px=__m.x-d.tile*0.8; d.py=__m.y;"); pg.wait_for_timeout(200)
    print("finish target", J("!!__t.finishTarget()"), J("JSON.stringify({b:!!__m.bound, al:__m.alive, d:Math.round(Math.hypot(__m.x-__t.dungeon.px,__m.y-__t.dungeon.py)), T:__t.dungeon.tile, camp:__t.dungeon.camp, act:__t.dungeon.active})"))
    pg.screenshot(path="f_fin0.png")
    nl=J("__t.dungeon.loot.length"); pg.keyboard.press("KeyE"); pg.wait_for_timeout(1200)
    print("dead", not J("__m.alive"), "new loot", J(f"__t.dungeon.loot.slice({nl}).map(l=>l.key+':'+l.tier)"))
    # KO via stun at low hp
    J("window.__m2=__t.trainWolf(); __m2.hp=__m2.hpMax*0.2; __t.applyStun(__m2,1.0);"); pg.wait_for_timeout(300); print("ko", J("__m2.ko"))
    pg.screenshot(path="f_ko.png")
    print(errs[:4]); b.close()
