import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1366,"height":800}); pg=ctx.new_page()
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2500)
    J(pg,"__t.enterGame(); const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.createHero('Bento',__t.bornFromSeed(12)); __t.econ.gold=540; __t.updateHeroPanelUI()")
    pg.wait_for_timeout(1500); pg.screenshot(path="hud1.png")
    r=J(pg,"(()=>{const ok=__t.saveTo('1'); return [ok, localStorage.getItem('cdi.save.1').length, __t.world.tick, __t.world.animals.length]})()"); print("salvou:", r)
    J(pg,"document.querySelector('[data-hs=\"8\"]').click()"); pg.wait_for_timeout(3000)
    r1=J(pg,"[__t.world.tick, __t.econ.gold]"); J(pg,"__t.econ.gold=1; __t.world.heroes.pop()")
    ok=J(pg,"__t.loadFrom('1')"); r2=J(pg,"[__t.world.tick, __t.econ.gold, __t.world.heroes.map(h=>h.name).join(','), __t.world.animals.length]"); print("antes de carregar:", r1, "depois:", r2, ok)
    pg.wait_for_timeout(4000); print("sim após load tick:", J(pg,"__t.world.tick"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(500); pg.screenshot(path="menu1.png")
    print("pausado com menu:", J(pg,"__t.world.paused"))
    J(pg,"document.querySelector('[data-g=save]').click()"); pg.wait_for_timeout(400); pg.screenshot(path="slots1.png")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    print("menu fechado, pausado:", J(pg,"__t.world.paused"), J(pg,"!!document.querySelector('.mv-panel.open')"))
    # recarrega a página: título deve mostrar Continuar
    pg.reload(); pg.wait_for_timeout(2500); pg.mouse.click(600,400); pg.wait_for_timeout(800); pg.screenshot(path="ts_cont.png")
    J(pg,"document.querySelector('[data-act=continue]').click()"); pg.wait_for_timeout(1500)
    print("continuar:", J(pg,"[__t.TS.open, __t.world.heroes.map(h=>h.name).join(','), __t.econ.gold]"))
    print(errs[:5]); b.close()
