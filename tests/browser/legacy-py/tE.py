import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.enterCamp(__h.id)"); pg.wait_for_timeout(3000)
    J("const d=__t.dungeon, F=__t.CPS.fire, T=d.tile; d.px=F.x-T*1.2; d.py=F.y; d.loot.push({key:'pedra',x:d.px-6,y:d.py,ground:true,t:0,ttl:0})")
    print("near", J("__t.campNear()"), "camp", J("__t.dungeon.camp"))
    n=J("__t.dungeon.loot.length"); J("__t.interact()"); pg.wait_for_timeout(300)
    print("took stone", J("__t.dungeon.loot.length")<n, "camp open", J("!!(__t.CAMP&&__t.CAMP.open)"))
    J("__t.interact()"); pg.wait_for_timeout(300); print("then fire open", J("!!(__t.CAMP&&__t.CAMP.open)"))
    print(errs[:3]); b.close()
