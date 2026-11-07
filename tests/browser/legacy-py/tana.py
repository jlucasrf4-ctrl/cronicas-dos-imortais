import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.gsRun('MESA'); __t.gsRun('ARMAS');"); pg.wait_for_timeout(400)
    print("known espada_longa", J("__t.forgeKnows('eq_espada_longa')"))
    J("__t.baseMenu(__h)"); pg.wait_for_timeout(500); print("ana btn", J("!!document.querySelector('[data-bm-ana]')"))
    J("document.querySelector('[data-bm-ana]').click()"); pg.wait_for_timeout(500)
    n=0
    while not J("__t.clueReady('eq_espada_longa')") and n<20:
        J("__h.energy=100; __t.anaDo('eq_espada_longa')"); n+=1
    print("analyses needed", n, "lv", J("JSON.stringify(__h.skills.percepcao)"))
    pg.screenshot(path="a_ana.png")
    J("document.querySelector('[data-an=ded][data-k=eq_espada_longa]').click()"); pg.wait_for_timeout(300)
    print("known after", J("__t.forgeKnows('eq_espada_longa')"))
    pg.screenshot(path="a_ana2.png")
    print(errs[:3]); b.close()
