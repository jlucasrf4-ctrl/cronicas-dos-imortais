import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True); pg=ctx.new_page()
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.openPrep(__h.id)"); pg.wait_for_timeout(800)
    J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500); J(pg,"__t.dungeon.flow='x'")
    print(J(pg,"(()=>{const r=document.getElementById('dungeon-exit').getBoundingClientRect(); return [r.left,r.right]})()"))
    J(pg,"__t.toggleInv()"); pg.wait_for_timeout(500)
    print(J(pg,"(()=>{const c=document.getElementById('inv-card').getBoundingClientRect(), x=document.getElementById('inv-close').getBoundingClientRect(), g=document.getElementById('inv-grid').getBoundingClientRect(); return [c.left,c.right,x.right,g.left,g.right]})()"))
    pg.screenshot(path="m4_inv.png"); b.close()
