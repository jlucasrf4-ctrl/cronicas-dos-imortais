import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const d=__t.dungeon; d.invuln=999; for(let i=0;i<6;i++){__t.spawnDungeonMonster();} })()")
    F="new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<4000) requestAnimationFrame(f); else r((n/4).toFixed(1))} requestAnimationFrame(f)})"
    for i in range(4): print("t",i, "fps", J(F), "rs", J("__t.PERF.rs"), "sBuilds", J("__t.GL3.sBuilds"), J("JSON.stringify([__t.GL3.cv.width,__t.GL3.cv.height])"))
    pg.screenshot(path="s_perf.png")
    print(errs[:3]); b.close()
