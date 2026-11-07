import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("__h.skills=__h.skills||{}; for(let i=0;i<4;i++) __t.giveItem(__h,'galho',0)")
    for lv in (1,2,3):
        J("__h.skills.percepcao={level:%d,xp:0}; __t.galhoObservar(__h)"%lv); pg.wait_for_timeout(200)
        print("Nv",lv,"(sem faca?)", J("!__t.knifeIn(__h)"), "->", J("document.getElementById('obs-pop').innerText.replace(/\\n/g,' | ')"))
    J("__t.giveItem(__h,'eq_faca',0)"); J("__t.galhoObservar(__h)"); pg.wait_for_timeout(200)
    print("Nv3 com faca ->", J("document.getElementById('obs-pop').innerText.replace(/\\n/g,' | ')"), "| sabe:", J("__t.forgeKnows('eq_lanca_madeira')"))
    pg.screenshot(path="t74.png")
    J("__t.galhoTalhar(__h)"); print("galhos", J("__t.itemCnt(__h,'galho')"), "tem lança", J("__t.ensureInv(__h).items.some(i=>i.def.key==='eq_lanca_madeira')"))
    J("(()=>{const inv=__t.ensureInv(__h), it=inv.items.find(i=>i.def.key==='eq_lanca_madeira'); inv.items.splice(inv.items.indexOf(it),1); __t.ensureEquip(__h).maoD=it; __t.dungeon.weapon='melee';})()")
    print("spearMode", J("__t.spearMode()"), "icon", J("__t.icoKeyOf(__t.ensureEquip(__h).maoD)"))
    # menu do item
    print("errs", errs[:3]); b.close()
