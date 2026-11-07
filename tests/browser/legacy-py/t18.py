import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:441+100,y:273+70}; __t.D3.ZM=2.6; window.dispatchEvent(new Event('resize'));})()""")
    pg.wait_for_timeout(1200)
    box=pg.locator("#dungeon-canvas").bounding_box()
    n=J(pg,"""new Promise(res=>{const d=__t.dungeon; d.cd=0; d.combo=0; d.comboT=0; __t.swingBasic(); let best=0; const t0=performance.now(); (function f(){ best=Math.max(best,__t.GL3.trail.length); if(performance.now()-t0<400) requestAnimationFrame(f); else res(best)})()})""")
    print("amostras do rastro:", n)
    J(pg,"(()=>{const d=__t.dungeon; d.cd=0; d.combo=1; d.comboT=0.5; __t.swingBasic()})()"); pg.wait_for_timeout(30)
    pg.screenshot(path="trail.png", clip={"x":box['x']+box['width']/2-200,"y":box['y']+box['height']/2-200,"width":400,"height":330})
    print(errs[:3]); b.close()
