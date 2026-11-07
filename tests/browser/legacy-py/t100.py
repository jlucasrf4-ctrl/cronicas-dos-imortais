import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    print("btn", J("!!document.querySelector('[data-act=\"dtest\"]')"))
    J("document.querySelector('[data-act=\"dtest\"]').click()"); pg.wait_for_timeout(3500)
    print(J("JSON.stringify([__t.dungeon.training, __t.dungeon.cols, __t.dungeon.rows, __t.dungeon.monsters.map(m=>m.model)])"))
    J("document.querySelector('[data-tr=\"min\"]').click()")
    J("__t.D3.ZM=0.75; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(1200); pg.screenshot(path="s_arena_wide.png")
    J("__t.D3.ZM=1.6; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(1000)
    # flecha no alvo
    J("__t.trainWeapon('eq_arco')")
    r=J("""()=>{const d=__t.dungeon, a=d.monsters[1]; d.px=a.x-__t.dungeon.tile*5; d.py=a.y; d.mouse={x:a.x,y:a.y}; d.cd=0; __t.startCharge(); d.charge=1; return 1}""")
    pg.wait_for_timeout(100); J("__t.dungeon.charging && (()=>{ const e=new KeyboardEvent('keyup',{code:'Space'}); window.dispatchEvent(e); })()")
    J("(()=>{ if(__t.dungeon.charging){ window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'})); } })()")
    pg.wait_for_timeout(1500); print("arrow hits", J("JSON.stringify([__t.TR.n, __t.TR.tot.toFixed(1)])"))
    pg.screenshot(path="s_arena_bow.png")
    J("document.querySelector('[data-tr=\"exit\"]') || document.querySelector('[data-tr=\"min\"]').click()")
    J("document.querySelector('[data-tr=\"min\"]').click()"); J("document.querySelector('[data-tr=\"exit\"]').click()"); pg.wait_for_timeout(2500)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(800); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    print("normal", J("JSON.stringify([__t.dungeon.training, __t.dungeon.cols, __t.dungeon.rows, __t.dungeon.monsters.length])"))
    print(errs[:4]); b.close()
