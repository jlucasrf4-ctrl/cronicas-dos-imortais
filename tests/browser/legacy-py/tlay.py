import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("const inv=__t.ensureInv(__h); for (const k of ['eq_lanca','pele','carne','eq_machado','gema','erva','presa','pele','pele']) { const it=__t.mkItem(k); __t.eqDurInit(it); __t.placeIn(inv,it); }")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.loot.push({key:'reliquia',x:d.px+5,y:d.py,t:0,ttl:0,tier:0}); __t.toggleInv(true)"); pg.wait_for_timeout(700)
    print(J("[document.getElementById('inv-left').style.maxWidth, document.getElementById('inv-left').offsetWidth, document.getElementById('inv-eq')&&document.getElementById('inv-eq').scrollWidth]")); pg.screenshot(path="s_lay.png"); print(errs[:3]); b.close()
