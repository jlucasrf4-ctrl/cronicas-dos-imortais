import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.gsRun('MESA'); __t.econ.test=true;"); pg.wait_for_timeout(400)
    J("__t.enterCamp(__h)"); pg.wait_for_timeout(5000)
    print("camp", J("__t.dungeon.active && __t.dungeon.camp"), J("JSON.stringify(__t.CPS.tools)"))
    J("const d=__t.dungeon; d.px=__t.CPS.tools.x-30; d.py=__t.CPS.tools.y+10;"); pg.wait_for_timeout(800)
    print("near", J("__t.campNear()"), J("document.getElementById('camp-prompt') && document.getElementById('camp-prompt').textContent"))
    pg.screenshot(path="k_camp.png")
    J("__t.interact()"); pg.wait_for_timeout(500); print("carp open", J("!!document.querySelector('#carp-modal.open')"), "paused", J("__t.dungeon.modalOpen"))
    J("document.getElementById('carp-modal').classList.remove('open')"); pg.wait_for_timeout(500); print("unpaused", J("__t.dungeon.modalOpen"))
    J("const d=__t.dungeon; d.px=__t.CPS.mesa.x+25; d.py=__t.CPS.mesa.y;"); pg.wait_for_timeout(500); print("near2", J("__t.campNear()")); pg.screenshot(path="k_mesa.png")
    J("__t.interact()"); pg.wait_for_timeout(400); print("ana open", J("!!document.querySelector('#ana-modal.open')")); J("document.getElementById('ana-modal').classList.remove('open')"); pg.wait_for_timeout(400)
    J("__t.tryAddToInv(__t.econ.stash,'carne',1); __t.campOpen(); __t.campAct('cook');"); pg.wait_for_timeout(300); J("__t.CAMP.cook.a=0.85; __t.CAMP.cook.b=0.82; __t.cookFinish()"); pg.wait_for_timeout(700)
    print(J("""(()=>{const e=document.elementFromPoint(683,430); const s=document.getElementById('cook-splash'); return [e&&(e.id||e.className), s&&s.parentNode.tagName, s&&getComputedStyle(s).zIndex]})()"""))
    pg.screenshot(path="k_cook.png")
    print(errs[:3]); b.close()
