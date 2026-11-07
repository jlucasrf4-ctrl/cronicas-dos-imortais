import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    print("icons", J("Object.keys(__t.ICOS).length"))
    J("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(1000)
    pg.screenshot(path="s_i_panel.png", clip={"x":0,"y":60,"width":240,"height":380})
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1500); pg.screenshot(path="s_i_prep.png")
    J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const d=__t.dungeon; d.flow='x'; for(const k of ['carne','gema','eq_lanca','penaag']){ const l={key:k,x:d.px+60+Math.random()*80,y:d.py-40+Math.random()*80,ground:false,tier:0,t:0,ttl:0}; d.loot.push(l);} })()")
    pg.wait_for_timeout(1500); pg.screenshot(path="s_i_dg.png")
    J("__t.toggleInv()"); pg.wait_for_timeout(1200); pg.screenshot(path="s_i_inv.png")
    print(errs[:5]); b.close()
