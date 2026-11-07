import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[4]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const d=__t.dungeon; d.invuln=999; for(let i=0;i<6;i++){__t.spawnDungeonMonster();} })()"); pg.wait_for_timeout(800)
    F="new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<4000) requestAnimationFrame(f); else r((n/4).toFixed(1))} requestAnimationFrame(f)})"
    print("base", J(F))
    J("__t.OPT.outline=false"); print("no outline", J(F)); J("__t.OPT.outline=true")
    J("(()=>{const g=__t.GL3; g._p=g.list.push; window.__noShadow=true; const pl=__t.glPush; })()")
    # disable shadows by patching list items cast=false via wrapper of glRender
    J("(()=>{const G=__t.GL3; const f0=__t.glRender; window.__gr0=f0; })()")
    print(J("typeof __t.glRender"))
    b.close()
