import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); ctx=b.new_context(viewport={"width":844,"height":390},is_mobile=True,has_touch=True,device_scale_factor=2); pg=ctx.new_page(); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    pg.touchscreen.tap(30,300); pg.wait_for_timeout(500)
    J("__t.enterGame(); __t.world.heroes.length=0; delete __t.econ.introDone; window.__h=__t.createHero('A',__t.bornFromSeed(1)); document.getElementById('create-modal').classList.add('open'); __t.playBirth(__h);"); pg.wait_for_timeout(600)
    for i in range(6): pg.touchscreen.tap(420,200); pg.wait_for_timeout(150)
    print("all shown", J("[...document.querySelectorAll('#cr-reveal .cr-step')].every(s=>s.classList.contains('show'))"))
    pg.screenshot(path="m_birth.png")
    J("__t.closeCreateModal()"); pg.wait_for_timeout(1000)
    for i in range(60):
        ph=J("__t.ISC.ph")
        if ph=="talk": break
        if ph=="rescue" and i%5==0: print(J("JSON.stringify({t:__t.ISC.t, n:__t.ISC.npc&&{x:Math.round(__t.ISC.npc.x),y:Math.round(__t.ISC.npc.y),go:__t.ISC.npc.go,came:__t.ISC.npc.came}, arrow:__t.ISC.arrow&&__t.ISC.arrow.k, on:__t.ISC.on, mode:__t.dungeon.mode})"))
        pg.wait_for_timeout(600)
    print("ph", ph, "dlg", J("!!__t.ISC.dlg")); pg.screenshot(path="m_dlg.png")
    n0=J("__t.ISC.dlg && __t.ISC.dlg.i")
    for i in range(8): pg.touchscreen.tap(200,150); pg.wait_for_timeout(250)
    print("after taps ph", J("__t.ISC.ph"), "dlg", J("!!__t.ISC.dlg"))
    # fps sample
    print("fps", J("new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(n/2)}; requestAnimationFrame(f)})"))
    print(errs[:4]); b.close()
