import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field';"); pg.wait_for_timeout(800)
    cen=lambda: J("(()=>{const vp=document.getElementById('viewport'); return [Math.round((vp.clientWidth/2-__t.camera.tx)/__t.camera.scale), Math.round((vp.clientHeight/2-__t.camera.ty)/__t.camera.scale)]})()")
    print("herói", J("[__h.x,__h.y]"), "centro câmera", cen())
    J("__h.walkTo={x:__h.x+120,y:__h.y-60}; __h.state='walking'"); pg.wait_for_timeout(2500)
    print("andando: herói", J("[Math.round(__h.x),Math.round(__h.y)]"), "centro", cen())
    pg.screenshot(path="t77_a.png")
    vp=J("(()=>{const r=document.getElementById('viewport').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
    pg.mouse.move(vp[0],vp[1]); pg.mouse.down(); pg.mouse.move(vp[0]+200,vp[1]+80,steps=6); pg.mouse.up(); pg.wait_for_timeout(500)
    print("arrastou: solto", J("__t.SEGUIR.solto"), "botão", J("document.getElementById('segue-btn').classList.contains('on')"))
    J("document.getElementById('segue-btn').click()"); pg.wait_for_timeout(1500); print("voltou: centro", cen(), "herói", J("[Math.round(__h.x),Math.round(__h.y)]"))
    s0=J("__t.camera.scale"); 
    for i in range(30): pg.mouse.wheel(0,300); pg.wait_for_timeout(40)
    pg.wait_for_timeout(1500); print("zoom out: escala", round(s0,2), "->", round(J("__t.camera.scale"),2), "limite antigo", round(J("__t.mapZoomLimit()"),2))
    pg.screenshot(path="t77_b.png")
    for i in range(40): pg.mouse.wheel(0,-300); pg.wait_for_timeout(30)
    pg.wait_for_timeout(1500); J("__t.JOGO.inPush=0.25; __t.JOGO.inT=performance.now()"); pg.wait_for_timeout(100); pg.screenshot(path="t77_c.png")
    print("errs", errs[:3]); b.close()
