import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(1500)
    pg.screenshot(path="s_j_map.png")
    J("__t.openSheet(__h.id)"); pg.wait_for_timeout(800); pg.screenshot(path="s_j_sheet.png"); J("document.querySelector('.sh-close, #sheet-close') && document.querySelector('.sh-close, #sheet-close').click()")
    J("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape'}))"); pg.wait_for_timeout(300)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(800); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const d=__t.dungeon; d.flow='x'; const inv=__t.ensureInv(d.hero); for(const [k,q] of [['eq_espada',0],['eq_espada_longa',1],['eq_machado',2],['eq_elmo',3],['eq_escudo_ref',3]]){ const it=__t.mkItem(k); it.q=q; __t.placeIn(inv,it);} ['💥','🩸','💫','Bloqueado','Sem flechas!','Parry!','+🔱','Marcado x1,5'].forEach((t,i)=>__t.spawnDungeonToast(t, d.px-120+i*36, d.py-30, '#fff')); })()")
    pg.wait_for_timeout(250); box=pg.locator("#dungeon-canvas").bounding_box(); pg.screenshot(path="s_j_toast.png", clip={"x":box['x']+200,"y":box['y']+150,"width":700,"height":350})
    J("__t.toggleInv()"); pg.wait_for_timeout(800); pg.screenshot(path="s_j_inv.png", clip={"x":320,"y":40,"width":720,"height":300})
    print(errs[:5]); b.close()
