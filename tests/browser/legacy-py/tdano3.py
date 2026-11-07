import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("const d=__t.dungeon; d.monsters.length=0; window.__w=__t.trainWolf(); __w.x=d.px+24; __w.y=d.py; __t.cravStart(__w,'eq_espada'); d.crav.t=3.9; d.invuln=0")
    hp=J("__t.dungeon.hp"); pg.wait_for_timeout(500)
    print(J("JSON.stringify({c:!!__t.dungeon.crav, noAtk:__t.dungeon.noAtk, lost:"+str(hp)+"-__t.dungeon.hp})"))
    hp0=J("__w.hp"); J("__t.dungeon.cd=0; __t.swingBasic()"); print("swing blocked during noAtk", hp0==J("__w.hp"))
    # mouse hold via real input on canvas
    pg.wait_for_timeout(1600); J("__w.cravCd=0; __w.x=__t.dungeon.px+24; __w.y=__t.dungeon.py; __t.cravStart(__w,'eq_espada')")
    box=J("(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
    pg.mouse.move(box[0],box[1]); pg.mouse.down(); pg.wait_for_timeout(1200); print("holding", J("__t.dungeon.crav&&__t.dungeon.crav.hold"), J("__t.dungeon.crav&&__t.dungeon.crav.stored.toFixed(1)"))
    pg.screenshot(path="d_hold.png")
    pg.mouse.up(); print("after up crav", J("!!__t.dungeon.crav")); hp0=J("__w.hp"); pg.mouse.down(); pg.wait_for_timeout(80); pg.mouse.up(); pg.wait_for_timeout(100); print("click rip", round(hp0-J("__w.hp"),2), J("!!__t.dungeon.crav"))
    print(errs[:4]); b.close()
