import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.openCreateModal(); document.getElementById('create-name').value='Lia'; __t.confirmCreateHero()"); pg.wait_for_timeout(8500); pg.screenshot(path="v_create.png")
    J("document.getElementById('cr-skip') && document.getElementById('cr-skip').click()"); pg.wait_for_timeout(1500)
    J("__t.ISC.on && __t.iscSkip && __t.iscSkip()"); 
    for i in range(20):
        pg.wait_for_timeout(500)
        if J("__t.dungeon.active"): break
    J("__t.dungeon.active && __t.exitDungeon()"); pg.wait_for_timeout(2500)
    h=J("__t.world.heroes[0].id"); J("__t.econ.campTut=3; __t.world.heroes[0].state='idle'; __t.world.heroes[0].x=__t.world.heroes[0].camp.x; __t.world.heroes[0].y=__t.world.heroes[0].camp.y; __t.openPrep(__t.world.heroes[0].id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(5000)
    print("mode", J("__t.dungeon.mode"), "bushes", J("(__t.dungeon.bushes||[]).length"))
    J("const d=__t.dungeon, B=d.bushes[0]; d.px=B.x; d.py=B.y; d.revealT=0"); pg.wait_for_timeout(500)
    print("safe in bush", J("__t.dSafe()"), "exit zone", J("__t.inExitZone()"))
    pg.screenshot(path="v_bush.png")
    J("const d=__t.dungeon; d.px=d.entrance.x+d.tile*2.2; d.py=d.entrance.y"); pg.wait_for_timeout(500); pg.screenshot(path="v_exit.png")
    print(errs[:4]); b.close()
