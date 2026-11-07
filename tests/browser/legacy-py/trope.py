import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("const d=__t.dungeon; d.monsters.length=0; window.__m=__t.trainWolf(); __m.hp=__m.hpMax*0.3; __m.x=d.px+d.tile*3; __m.y=d.py; d.mouse={x:__m.x,y:__m.y}")
    print(J("JSON.stringify({rope:!!__t.ropeItem(__t.dungeon.hero), can:__t.canBind(__m), fin:!!__t.dungeon.finish, r:!!__t.dungeon.rope, inv:__t.dungeon.invOpen, modal:__t.dungeon.modalOpen})"))
    pg.keyboard.down("KeyG"); pg.wait_for_timeout(100); print("rope after", J("!!__t.dungeon.rope || !!__m.bound"))
    pg.wait_for_timeout(500); print("bound", J("!!__m.bound"), J("[__m.x-__t.dungeon.px, __m.st, __m.ko]"))
    print(errs[:3]); b.close()
