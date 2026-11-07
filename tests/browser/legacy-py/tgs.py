import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1000)
    # simple human-like controller (reaction 150ms) for taming
    J("__t.tameStart(__t.wildAnteaters()[0])"); pg.wait_for_timeout(1500)
    wins=0
    for trial in range(3):
        J("__t.tameGo(); window.__ctl=setInterval(()=>{const g=__t.TAME.g; if(!g) return; const want=-g.pos*1.2-g.vel*0.6; __t.TAME.keys.L=want<-0.15; __t.TAME.keys.R=want>0.15;},150)")
        for i in range(60):
            pg.wait_for_timeout(250)
            if not J("!!__t.TAME.g"): break
        r=J("document.getElementById('tame-tip').textContent.slice(0,30)"); J("clearInterval(__ctl)"); print("trial", trial, r)
        if "acalmou" in r: wins+=1; break
    pg.keyboard.press("Escape"); J("document.getElementById('tame-modal').classList.remove('open'); __t.TAME.open=false")
    J("__t.econ.mount=null"); pg.mouse.click(683,430); 
    for ch in "TAMANDUA": pg.keyboard.press("Key"+ch)
    pg.wait_for_timeout(300); print("gs mount", J("__t.mnt() && __t.mnt().name"))
    for ch in "VINCULO": pg.keyboard.press("Key"+ch)
    pg.wait_for_timeout(200); print("lv", J("__t.mountLv()"))
    J("__t.gsOpen()"); pg.wait_for_timeout(400); pg.screenshot(path="s_gs.png")
    print(errs[:5]); b.close()
