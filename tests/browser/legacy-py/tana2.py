import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(5000)
    J("__t.tryAddToInv(__t.ensureInv(__t.dungeon.hero),'eq_machado'); __t.toggleInv(true)"); pg.wait_for_timeout(400)
    J("(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='eq_machado'); __t.itemAnalyze(it)})()"); pg.wait_for_timeout(400)
    print("inv open after analyze", J("__t.dungeon.invOpen"), J("(__t.dungeon.toasts||[]).slice(-1).map(t=>t.text)")); pg.screenshot(path="ana2.png")
    J("__t.econ.mesa=true; __t.toggleInv(true)"); pg.wait_for_timeout(300); J("(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='eq_machado'); __t.itemAnalyze(it)})()"); pg.wait_for_timeout(400)
    print("with mesa: inv", J("__t.dungeon.invOpen"), "ana modal", J("!!document.querySelector('#ana-modal.open')"))
    print(errs[:3]); b.close()
