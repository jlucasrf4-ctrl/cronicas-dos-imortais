import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.runeAbsorbOpen({hero:__h, rune:{id:'r1', el:'fogo', seed:7, str:1, x:0,y:0}, where:'mapa'})"); pg.wait_for_timeout(600)
    J("(()=>{const RA=__t.RA; RA.step='trace'; RA.wet=0; RA.soak=0; RA.used=['quartzo']; RA.sel=['quartzo']; RA.trace=[]; __t.raAct('noop');})()"); pg.wait_for_timeout(300)
    cv=pg.locator("#ra-cv").bounding_box(); x0=cv['x']+cv['width']*0.3; y0=cv['y']+cv['height']*0.5
    # dry stroke
    pg.mouse.move(x0,y0); pg.mouse.down(); pg.mouse.move(x0+150,y0, steps=12); pg.mouse.up()
    # dip and stroke ideal
    btn=pg.locator("[data-a='dip']").bounding_box(); pg.mouse.move(btn['x']+5,btn['y']+5); pg.mouse.down(); pg.wait_for_timeout(900); pg.mouse.up(); print("wet", J("+__t.RA.wet.toFixed(2)"))
    pg.mouse.move(x0,y0+60); pg.mouse.down(); pg.mouse.move(x0+150,y0+60, steps=12); pg.mouse.up()
    # overwet
    pg.mouse.move(btn['x']+5,btn['y']+5); pg.mouse.down(); pg.wait_for_timeout(2200); pg.mouse.up(); print("wet2", J("+__t.RA.wet.toFixed(2)"))
    pg.mouse.move(x0,y0-60); pg.mouse.down(); pg.mouse.move(x0+120,y0-60, steps=12); pg.mouse.up()
    print("stats", J("JSON.stringify(__t.RA.trace.map(s=>s.map(q=>q[2]).join('')))"), "soak", J("+__t.RA.soak.toFixed(2)"))
    J("__t.raAct('noop')"); pg.wait_for_timeout(300); pg.screenshot(path="s_rune_wet.png")
    print(errs[:3]); b.close()
