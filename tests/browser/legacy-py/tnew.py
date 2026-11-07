import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.world.heroes.length=0; delete __t.econ.introDone; window.__h=__t.createHero('A',__t.bornFromSeed(1)); document.getElementById('create-modal').classList.add('open'); __t.playBirth(__h);"); pg.wait_for_timeout(500)
    J("__t.closeCreateModal()"); pg.wait_for_timeout(2500)
    print("mode", J("__t.dungeon.active && __t.dungeon.mode"), "ph", J("__t.ISC.ph"), "maoD", J("!!__t.ensureEquip(__h).maoD"), "arrows", J("__t.econ.quiver.n"))
    print(errs[:3]); b.close()
