import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.gold=5000;"); pg.wait_for_timeout(600)
    print("weapons", J("__t.allWeaponKeys()"), "price", J("__t.allWeaponsPrice()"))
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(700)
    print("btn", J("document.querySelector('[data-allw]') && document.querySelector('[data-allw]').textContent"))
    J("document.querySelector('[data-allw]').click()"); pg.wait_for_timeout(500)
    print("msg", J("document.getElementById('prep-msg').textContent"), "gold", J("__t.econ.gold"))
    pg.screenshot(path="w_prep.png")
    J("__t.gsRun('JOIAS'); __t.gsRun('JOIAS'); for(let i=0;i<3;i++){__t.tryAddToInv(__t.econ.stash,'carne',i);__t.tryAddToInv(__t.econ.stash,'erva',i);__t.tryAddToInv(__t.econ.stash,'pele',i);__t.tryAddToInv(__t.econ.stash,'presa',i);__t.tryAddToInv(__t.econ.stash,'galho',i);__t.tryAddToInv(__t.econ.stash,'ferro',i);}")
    print("gems", J("__t.econ.stash.items.filter(i=>i.def.key==='gema').map(i=>__t.itName(i)+'|'+__t.icoKeyOf(i)+'|'+__t.itemVal(i))"))
    print("mats", J("__t.econ.stash.items.filter(i=>i.def.key!=='gema'&&!i.def.slot).map(i=>__t.itName(i)+'|'+__t.icoKeyOf(i))"))
    J("document.getElementById('prep-modal') && document.getElementById('prep-modal').classList.remove('open'); try{__t.closePrep()}catch(e){}"); pg.wait_for_timeout(300)
    J("document.getElementById('btn-chest').click()"); pg.wait_for_timeout(700); pg.screenshot(path="w_chest.png")
    # tooltip
    el=pg.locator("#chest-grid .inv-item").nth(12); el.hover(); pg.wait_for_timeout(500); pg.screenshot(path="w_tip.png")
    J("document.getElementById('chest-modal').classList.remove('open'); try{0}catch(e){}")
    print(errs[:5]); b.close()
