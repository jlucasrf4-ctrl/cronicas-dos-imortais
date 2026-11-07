import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(800); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const inv=__t.ensureInv(__t.dungeon.hero); for(const k of ['eq_lanca','eq_espada','eq_espada_longa','eq_machado','eq_clava','eq_arco_longo','eq_elmo','eq_botas_ref','eq_cota','galho','pena','penaag','carne','pele','peixe','gema','ametista','ferro','folhama','presa','eq_escudo_ref']){ const it=__t.mkItem(k); __t.placeIn(inv,it);} })()")
    J("__t.toggleInv()"); pg.wait_for_timeout(1000); pg.screenshot(path="s_i_inv2.png", clip={"x":320,"y":40,"width":720,"height":300})
    print(errs[:4]); b.close()
