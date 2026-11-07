import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.gsRun('TAMANDUA'); __t.mnt().with=__h.id;"); pg.wait_for_timeout(600)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=450; d.py=270;")
    st=lambda: J("(()=>{const d=__t.dungeon,M=d.mount; return [M.st, +(Math.hypot(M.x-d.px,M.y-d.py)/d.tile).toFixed(1), M.sniff>0?'fareja':'', +(M.att||0).toFixed(1)]})()")
    for i in range(8): pg.wait_for_timeout(1500); print("roam", st())
    pg.screenshot(path="s_ai_roam.png")
    J("__t.mountToggle()"); 
    for i in range(6): pg.wait_for_timeout(1000); print("call", st())
    pg.screenshot(path="s_ai_attend.png")
    for i in range(8): pg.wait_for_timeout(1500); print("ignored", st())
    print(errs[:4]); b.close()
