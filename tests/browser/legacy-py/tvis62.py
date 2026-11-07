import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("const d=__t.dungeon; d.monsters.length=0; window.__b=__t.trainWolf(); __b.x=d.px+140; __b.y=d.py+40; Math.random=(()=>{const r=Math.random;return ()=>0.01})(); __t.arrowStick(__b,{vx:1,vy:0},3); __t.arrowStick(__b,{vx:1,vy:0.4},3); window.__w=__t.trainWolf(); __w.x=d.px+24; __w.y=d.py; __t.cravStart(__w,'eq_espada'); __t.cravPress(); ")
    J("Math.random=(()=>{let s=7;return ()=>{s=(s*16807)%2147483647;return s/2147483647}})()")
    pg.wait_for_timeout(1500)
    pg.screenshot(path="v62_crav.png")
    print(errs[:3]); b.close()
