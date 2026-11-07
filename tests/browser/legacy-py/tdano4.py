import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("const d=__t.dungeon; d.monsters.length=0; window.__w=__t.trainWolf(); __w.x=d.px+24; __w.y=d.py; __t.cravStart(__w,'eq_espada'); d.crav.t=3.99")
    J("window.__calls=[]; const o=window.spawnDungeonToast"); print(J("(()=>{const d=__t.dungeon, hp=d.hp; __t.cravTick(0.05); return JSON.stringify({wpn:d.weapon, dg:d.dodgeGuard, g:d.guard, gb:d.guardBroken, lost:hp-d.hp, c:!!d.crav, inv:d.invuln, alive:__w.alive, ko:__w.ko})})()"))
    b.close()
